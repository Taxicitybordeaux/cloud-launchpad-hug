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

export type PushAudience = "chauffeur" | "client";

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
      // notification racine : requis pour livraison mobile background (Android/iOS).
      // Sans ce champ FCM traite le message comme data-only et ne réveille pas le SW.
      // Le SW Firebase réaffiche ensuite avec toutes les options via onBackgroundMessage.
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        headers: { Urgency: "high", TTL: "86400" },
        fcm_options: { link: clickUrl },
        // data dans webpush : accessible dans payload.data côté SW Firebase SDK
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
      },
      // data racine : reçu par le push event natif iOS Safari PWA >= 16.4
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
  endpoint: string | null;
  fcm_token: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
};

// Fenêtre pendant laquelle un même `tag` (ex. "chauffeur-res-<id>",
// "client-status-<id>-accepted") ne sera envoyé qu'UNE fois par audience.
// 5 min couvre les rafales dues aux triggers, re-tentatives, doubles clics UI
// et rechargements service worker sans bloquer les vrais changements d'état.
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export async function sendPushToAudience(
  audience: PushAudience,
  payload: PushPayload,
  opts: { reservationId?: string; accountId?: string; dedupKey?: string } = {},
): Promise<{ sent: number; removed: number; deduped?: boolean }> {
  const supabaseAdmin = getTaxiSupabaseAdmin();

  // ── Déduplication idempotente ────────────────────────────────────────────
  // Verrou côté base : première insertion gagne, les autres sont skippées.
  // Clé = tag du payload par défaut (unique par événement). Si aucun tag n'est
  // fourni, on ne déduplique pas (message générique).
  const dedupKey = opts.dedupKey ?? payload.tag ?? null;
  if (dedupKey) {
    const expiresAt = new Date(Date.now() + DEDUP_WINDOW_MS).toISOString();
    const { data: inserted, error: dedupError } = await supabaseAdmin
      .from("push_dedup" as any)
      .insert({ tag: dedupKey, audience, expires_at: expiresAt })
      .select("tag")
      .maybeSingle();
    if (dedupError) {
      // Code 23505 = unique_violation → doublon détecté, on abandonne.
      const code = (dedupError as any).code;
      if (code === "23505") {
        console.log(`[push] dedup skip audience=${audience} tag=${dedupKey}`);
        return { sent: 0, removed: 0, deduped: true };
      }
      // Autre erreur (RLS, réseau) → on laisse passer plutôt que de bloquer.
      console.warn("[push] dedup insert failed, proceeding without guard", dedupError);
    } else if (!inserted) {
      // Ligne pré-existante non expirée : PostgREST peut renvoyer null.
      // Vérification explicite pour être sûr.
      const { data: existing } = await supabaseAdmin
        .from("push_dedup" as any)
        .select("expires_at")
        .eq("tag", dedupKey)
        .eq("audience", audience)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (existing) {
        console.log(`[push] dedup skip (race) audience=${audience} tag=${dedupKey}`);
        return { sent: 0, removed: 0, deduped: true };
      }
    }
    // Nettoyage best-effort des lignes expirées (asynchrone, non bloquant).
    supabaseAdmin
      .from("push_dedup" as any)
      .delete()
      .lt("expires_at", new Date().toISOString())
      .then(() => {}, () => {});
  }
  // ─────────────────────────────────────────────────────────────────────────

  let q = supabaseAdmin
    .from("push_subscriptions" as any)
    .select("id, endpoint, fcm_token, user_agent, last_seen_at")
    .eq("audience", audience)
    .not("fcm_token", "is", null)
    .order("last_seen_at", { ascending: false });
  if (audience === "client") {
    const endpointFilters: string[] = [];
    if (opts.reservationId) endpointFilters.push(`endpoint.like.*-client-reservation-${opts.reservationId}`);
    if (opts.accountId) endpointFilters.push(`endpoint.like.*-client-account-${opts.accountId}`);
    if (endpointFilters.length > 0) {
      q = q.or(endpointFilters.join(","));
    }
  }

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
  //  - par user_agent SEUL (un même device iOS régénère régulièrement son
  //    fcm_token sans que l'ancienne ligne soit supprimée en base → sans
  //    inclure le token dans la clé, on regroupe correctement toutes les
  //    lignes d'un même appareil malgré les tokens différents, et on ne
  //    garde que la plus récente). Inclure le token dans la clé (comme
  //    avant) empêchait toute déduplication réelle car deux tokens du même
  //    device n'ont jamais le même suffixe → c'était la cause des envois ×N.
  //  Risque accepté : 2 devices distincts avec un user_agent strictement
  //  identique seraient fusionnés à tort (cas rare vs. le bug ×N observé).
  const rows = (data as unknown as SubRow[]).filter((r) => !!r.fcm_token);
  const byToken = new Map<string, SubRow>();
  for (const r of rows) if (!byToken.has(r.fcm_token!)) byToken.set(r.fcm_token!, r);
  const seenUa = new Set<string>();
  const staleIds: string[] = [];
  const uniqueSubs: SubRow[] = [];
  for (const sub of byToken.values()) {
    const uaKey = sub.user_agent || "";
    if (uaKey && seenUa.has(uaKey)) {
      staleIds.push(sub.id);
      continue;
    }
    if (uaKey) seenUa.add(uaKey);
    uniqueSubs.push(sub);
  }

  let sent = 0;
  const toRemove: string[] = [];
  const failures: Array<{
    audience: PushAudience;
    tag: string | null;
    reservation_id: string | null;
    fcm_token_suffix: string | null;
    http_status: number | null;
    error_code: string | null;
    title: string;
    body: string;
    user_agent: string | null;
  }> = [];

  await Promise.all(
    uniqueSubs.map(async (sub) => {
      if (!sub.fcm_token) return;
      const r = await sendFcmToToken(accessToken, projectId, sub.fcm_token, payload, audience);
      if (r.ok) {
        sent++;
        return;
      }
      // Log every non-OK send for the admin failures dashboard
      failures.push({
        audience,
        tag: payload.tag ?? null,
        reservation_id: opts.reservationId ?? null,
        fcm_token_suffix: sub.fcm_token.slice(-12),
        http_status: r.status || null,
        error_code: r.errorCode ?? null,
        title: payload.title,
        body: payload.body,
        user_agent: sub.user_agent ?? null,
      });

      if (r.errorCode === "UNREGISTERED" || r.status === 404) {
        // Un token UNREGISTERED/404 peut être définitivement mort (app désinstallée)
        // OU un faux positif temporaire (device éteint, onglet fermé, SW pas encore
        // réveillé). On applique le même délai de grâce que pour les 400 : on ne
        // supprime que si le device n'a pas donné signe de vie depuis longtemps.
        const lastSeen = sub.last_seen_at ? new Date(sub.last_seen_at).getTime() : 0;
        const gracePeriodAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (lastSeen < gracePeriodAgo) {
          toRemove.push(sub.id);
        } else {
          console.warn("[push] FCM UNREGISTERED/404 — token conservé (délai de grâce 30j)", sub.id);
        }
      } else if (r.status === 400 || r.errorCode === "INVALID_ARGUMENT") {
        // 400/INVALID_ARGUMENT = device en arrière-plan depuis longtemps ou token
        // temporairement invalide — PAS une mort définitive. Si on supprime ici,
        // José perd sa souscription dès qu'il ferme le dashboard → cercle vicieux.
        // On purge uniquement si le token est inactif depuis plus de 30 jours.
        const lastSeen = sub.last_seen_at ? new Date(sub.last_seen_at).getTime() : 0;
        const thirtyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
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

  // Persist failures (best-effort — never block on a logging error)
  if (failures.length > 0) {
    try {
      await supabaseAdmin.from("push_send_failures").insert(failures);
    } catch (e) {
      console.warn("[push] failed to log push failures", e);
    }
  }

  return { sent, removed: allToRemove.length };
}
