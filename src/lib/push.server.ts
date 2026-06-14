// FCM HTTP v1 sender — utilise FIREBASE_SERVICE_ACCOUNT_JSON
// Cloudflare Workers compatible : signature JWT via Web Crypto API.
import { getTaxiSupabaseAdmin } from "@/lib/taxi-supabase.server";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
  data?: Record<string, string | number | boolean | null | undefined>;
};

export type PushAudience = "admin" | "chauffeur" | "client";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

let cachedAccount: ServiceAccount | null = null;
let cachedToken: { token: string; exp: number } | null = null;

const APP_URL = "https://taxicitybordeaux.fr";

function toAbsoluteUrl(url: string | undefined): string {
  try {
    return new URL(url || "/", APP_URL).toString();
  } catch {
    return APP_URL;
  }
}

function stringifyData(data: Record<string, string | number | boolean | null | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

function getServiceAccount(): ServiceAccount {
  if (cachedAccount) return cachedAccount;
  // Lovable/Vite expose les variables serveur via import.meta.env (sans préfixe VITE_)
  // Node.js les expose via process.env — on tente les deux
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    (typeof import.meta !== "undefined" ? (import.meta as any).env?.FIREBASE_SERVICE_ACCOUNT_JSON : undefined) ||
    (typeof import.meta !== "undefined" ? (import.meta as any).env?.FIREBASE_SERVICE_ACCOUNT : undefined);
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
  cachedAccount = JSON.parse(raw) as ServiceAccount;
  return cachedAccount;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buf === "string") {
    bytes = new TextEncoder().encode(buf);
  } else if (buf instanceof ArrayBuffer) {
    bytes = new Uint8Array(buf);
  } else {
    bytes = buf;
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 30) return cachedToken.token;

  const sa = getServiceAccount();
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64 = base64UrlEncode(JSON.stringify(claim));
  const data = `${headerB64}.${claimB64}`;

  const keyBuf = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(data));
  const jwt = `${data}.${base64UrlEncode(sigBuf)}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`FCM token exchange failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

async function sendFcmToToken(
  accessToken: string,
  projectId: string,
  token: string,
  payload: PushPayload,
  audience: PushAudience,
): Promise<{ ok: boolean; status: number; errorCode?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const clickUrl = toAbsoluteUrl(payload.url);
  const tag = payload.tag || "taxi-fcm";
  const icon = toAbsoluteUrl(payload.icon || "/favicon.ico");
  const data = stringifyData({ url: clickUrl, tag, audience, ...(payload.data || {}) });
  // Idempotency key : unique par tentative pour que les retries réseau
  // passent vraiment — un ID stable ferait ignorer les retries par FCM
  // si la 1ère tentative a été reçue côté FCM mais le réseau a timeout.
  const baseIdem = `${payload.tag || "taxi-fcm"}:${token.slice(-12)}:${Date.now()}`;
  const body = {
    message: {
      token,
      // NE PAS mettre "notification" racine ici : si présent, FCM tente d'afficher
      // la notif lui-même sans passer par le Service Worker → silencieux sur Android
      // PWA en background (comportement observé). On délègue 100% au SW via
      // webpush.notification — c'est la version qui fonctionne en production.
      webpush: {
        headers: payload.requireInteraction ? { Urgency: "high", TTL: "86400" } : { TTL: "3600" },
        data,
        notification: {
          title: payload.title,
          body: payload.body,
          icon,
          badge: icon,
          tag,
          requireInteraction: !!payload.requireInteraction,
          vibrate: [200, 100, 200],
        },
        fcm_options: { link: clickUrl },
      },
      data,
    },
  };

  // Retry simple sur erreurs réseau et 5xx — backoff exponentiel court.
  // 429 (quota) → retry. Erreurs définitives (400/404/UNREGISTERED) → pas de retry.
  const MAX_ATTEMPTS = 3;
  let lastStatus = 0;
  let lastErrorCode: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Goog-Request-Id": `${baseIdem}:${attempt}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, status: res.status };
      lastStatus = res.status;
      try {
        const j: any = await res.json();
        lastErrorCode = j?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode || j?.error?.status;
      } catch {}
      // erreurs définitives — pas de retry
      if ([400, 401, 403, 404].includes(res.status)) {
        return { ok: false, status: res.status, errorCode: lastErrorCode };
      }
    } catch (e) {
      console.warn(`[push] FCM attempt ${attempt} network error`, e);
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  return { ok: false, status: lastStatus, errorCode: lastErrorCode };
}

type SubRow = {
  id: string;
  fcm_token: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
};

export async function sendPushToAudience(
  audience: PushAudience,
  payload: PushPayload,
  opts: { reservationId?: string; accountId?: string } = {},
): Promise<{ sent: number; removed: number }> {
  const supabaseAdmin = getTaxiSupabaseAdmin();
  let q = supabaseAdmin
    .from("push_subscriptions")
    .select("id, fcm_token, user_agent, last_seen_at")
    .eq("audience", audience)
    .not("fcm_token", "is", null)
    .order("last_seen_at", { ascending: false });
  if (audience === "client" && opts.reservationId) {
    q = q.eq("reservation_id", opts.reservationId);
  }
  // accountId is accepted for API symmetry with direct chat callers; no
  // column filter today — push_subscriptions has no client_account_id.
  void opts.accountId;
  const { data, error } = await q;
  if (error || !data || data.length === 0) return { sent: 0, removed: 0 };

  let accessToken: string;
  let projectId: string;
  try {
    accessToken = await getAccessToken();
    projectId = getServiceAccount().project_id;
    console.log(`[push] sendToAudience audience=${audience} subs=${data.length} fcm_project=${projectId}`);
  } catch (err) {
    console.error("[push] FCM auth failed", err);
    return { sent: 0, removed: 0 };
  }

  // Dédoublonnage à deux niveaux :
  //  - par fcm_token (évidence)
  //  - par user_agent (un même device iOS peut avoir plusieurs fcm_token
  //    régénérés au fil des sessions / installs PWA → cause des notifs ×N)
  // On garde la ligne la plus récente (les rows sont déjà triées DESC).
  const rows = (data as SubRow[]).filter((r) => !!r.fcm_token);
  const byToken = new Map<string, SubRow>();
  for (const r of rows) if (!byToken.has(r.fcm_token!)) byToken.set(r.fcm_token!, r);
  const seenUa = new Set<string>();
  const staleIds: string[] = [];
  const uniqueSubs: SubRow[] = [];
  for (const sub of byToken.values()) {
    // Clé = user_agent + derniers 8 chars du token pour éviter de confondre
    // 2 appareils différents ayant le même user_agent (ex: 2 iPhone 15 Safari).
    const uaKey = sub.user_agent ? `${sub.user_agent}::${sub.fcm_token!.slice(-8)}` : "";
    if (uaKey && seenUa.has(uaKey)) {
      staleIds.push(sub.id);
      continue;
    }
    if (uaKey) seenUa.add(uaKey);
    uniqueSubs.push(sub);
  }

  let sent = 0;
  const toRemove: string[] = [];

  await Promise.all(
    uniqueSubs.map(async (sub) => {
      if (!sub.fcm_token) return;
      const r = await sendFcmToToken(accessToken, projectId, sub.fcm_token, payload, audience);
      if (r.ok) {
        sent++;
      } else if (r.errorCode === "UNREGISTERED" || r.status === 404) {
        // Token définitivement révoqué par Firebase (app désinstallée ou token
        // explicitement invalidé) → on supprime.
        toRemove.push(sub.id);
      } else if (r.status === 400 || r.errorCode === "INVALID_ARGUMENT") {
        // 400/INVALID_ARGUMENT = device en arrière-plan depuis longtemps ou token
        // temporairement invalide — PAS une mort définitive. Si on supprime ici,
        // José perd sa souscription dès qu'il ferme le dashboard → cercle vicieux.
        // On purge uniquement si le token est inactif depuis plus de 30 jours.
        const lastSeen = sub.last_seen_at ? new Date(sub.last_seen_at).getTime() : 0;
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (lastSeen < thirtyDaysAgo) {
          toRemove.push(sub.id);
        } else {
          console.warn("[push] FCM 400/INVALID — token conservé, device inactif mais pas révoqué", sub.id);
        }
      } else {
        console.error("[push] FCM send failed", r.status, r.errorCode);
      }
    }),
  );

  const allToRemove = Array.from(new Set([...toRemove, ...staleIds]));
  if (allToRemove.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", allToRemove);
  }

  return { sent, removed: allToRemove.length };
}
