// FCM HTTP v1 sender — utilise FIREBASE_SERVICE_ACCOUNT_JSON
// Cloudflare Workers compatible : signature JWT via Web Crypto API.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
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

function getServiceAccount(): ServiceAccount {
  if (cachedAccount) return cachedAccount;
  // Lovable/Vite expose les variables serveur via import.meta.env (sans préfixe VITE_)
  // Node.js les expose via process.env — on tente les deux
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    (typeof import.meta !== "undefined"
      ? (import.meta as any).env?.FIREBASE_SERVICE_ACCOUNT_JSON
      : undefined) ||
    (typeof import.meta !== "undefined"
      ? (import.meta as any).env?.FIREBASE_SERVICE_ACCOUNT
      : undefined);
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
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(data),
  );
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
): Promise<{ ok: boolean; status: number; errorCode?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const clickUrl = payload.url ?? "/";
  // Idempotency key : FCM dédoublonne déjà via `tag` (collapsing côté
  // appareil), mais on ajoute un en-tête X-Goog-Request-Id stable par
  // (token, tag) pour qu'un retry réseau ne crée pas une seconde notif.
  const idem = `${payload.tag || "taxi-fcm"}:${token.slice(-12)}`;
  const body = {
    message: {
      token,
      // NE PAS mettre "notification" ici : si présent, FCM tente d'afficher la notif
      // lui-même sans passer par le Service Worker → silencieux sur Android background.
      // On délègue 100% au SW via webpush.notification.
      webpush: {
        headers: payload.requireInteraction ? { Urgency: "high", TTL: "86400" } : { TTL: "3600" },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: payload.tag || "taxi-fcm",
          requireInteraction: !!payload.requireInteraction,
          vibrate: [200, 100, 200],
        },
        fcm_options: { link: clickUrl },
        data: { url: clickUrl, tag: payload.tag || "taxi-fcm" },
      },
      data: { url: clickUrl, tag: payload.tag || "taxi-fcm" },
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
          "X-Goog-Request-Id": idem,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, status: res.status };
      lastStatus = res.status;
      try {
        const j: any = await res.json();
        lastErrorCode =
          j?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode || j?.error?.status;
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
  opts: { reservationId?: string } = {},
): Promise<{ sent: number; removed: number }> {
  let q = supabaseAdmin
    .from("push_subscriptions")
    .select("id, fcm_token, user_agent, last_seen_at")
    .eq("audience", audience)
    .not("fcm_token", "is", null)
    .order("last_seen_at", { ascending: false });
  if (audience === "client" && opts.reservationId) {
    q = q.eq("reservation_id", opts.reservationId);
  }
  const { data, error } = await q;
  if (error || !data || data.length === 0) return { sent: 0, removed: 0 };

  let accessToken: string;
  let projectId: string;
  try {
    accessToken = await getAccessToken();
    projectId = getServiceAccount().project_id;
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
    const uaKey = sub.user_agent || "";
    if (uaKey && seenUa.has(uaKey)) {
      // doublon device → on l'ignore pour l'envoi ET on le purge de la DB
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
      const r = await sendFcmToToken(accessToken, projectId, sub.fcm_token, payload);
      if (r.ok) {
        sent++;
      } else if (
        r.status === 404 ||
        r.status === 400 ||
        r.errorCode === "UNREGISTERED" ||
        r.errorCode === "INVALID_ARGUMENT"
      ) {
        toRemove.push(sub.id);
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
