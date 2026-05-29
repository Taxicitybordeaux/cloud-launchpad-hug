import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL       = "taxi.city033@gmail.com";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SRV_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY")!;
// Firebase service account JSON complet (stringifié) — même variable que push.server.ts
const SA_RAW            = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!;

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

// ─── Cache du token OAuth2 (durée de vie de l'isolat Deno, ~quelques minutes) ─
let cachedToken: { token: string; exp: number } | null = null;
let cachedSA: ServiceAccount | null = null;

function getServiceAccount(): ServiceAccount {
  if (cachedSA) return cachedSA;
  cachedSA = JSON.parse(SA_RAW) as ServiceAccount;
  return cachedSA;
}

// ─── Helpers JWT (identiques à push.server.ts, portés en Deno) ───────────────
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
  const claim  = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64  = base64UrlEncode(JSON.stringify(claim));
  const data      = `${headerB64}.${claimB64}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(data));
  const jwt    = `${data}.${base64UrlEncode(sigBuf)}`;

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
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

// ─── Envoi FCM à un token (logique identique à sendFcmToToken) ───────────────
type FcmResult = { ok: boolean; status: number; errorCode?: string };

async function sendFcmToToken(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<FcmResult> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: {
            title,
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: data.tag ?? "taxi-fcm",
            requireInteraction: true,
            vibrate: [200, 100, 200],
          },
          fcm_options: { link: "/admin/dashboard" },
          data,
        },
        data,
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
      },
    }),
  });

  if (res.ok) return { ok: true, status: res.status };

  let errorCode: string | undefined;
  try {
    const j: any = await res.json();
    errorCode = j?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode || j?.error?.status;
  } catch { /* ignore */ }
  console.error(`[fcm] token ${token.slice(0, 20)}… → ${res.status} ${errorCode}`);
  return { ok: false, status: res.status, errorCode };
}

// ─── Envoi à toute une audience + nettoyage tokens invalides ─────────────────
async function sendPushToAudience(
  supabase: ReturnType<typeof createClient>,
  audiences: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ sent: number; removed: number }> {
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("id, fcm_token, audience")
    .in("audience", audiences)
    .not("fcm_token", "is", null);

  if (error || !rows || rows.length === 0) {
    console.log("[push] aucun token trouvé pour", audiences, error?.message);
    return { sent: 0, removed: 0 };
  }

  let accessToken: string;
  let projectId: string;
  try {
    accessToken = await getAccessToken();
    projectId   = getServiceAccount().project_id;
  } catch (err) {
    console.error("[push] FCM auth failed", err);
    return { sent: 0, removed: 0 };
  }

  let sent = 0;
  const toRemove: string[] = [];

  await Promise.all(
    rows.map(async (sub: any) => {
      if (!sub.fcm_token) return;
      const r = await sendFcmToToken(accessToken, projectId, sub.fcm_token, title, body, {
        ...data,
        audience: sub.audience,
      });
      if (r.ok) {
        sent++;
      } else if (
        r.status === 404 ||
        r.status === 400 ||
        r.errorCode === "UNREGISTERED" ||
        r.errorCode === "INVALID_ARGUMENT"
      ) {
        toRemove.push(sub.id); // token expiré → on le supprime
      }
    }),
  );

  if (toRemove.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", toRemove);
    console.log(`[push] ${toRemove.length} token(s) invalide(s) supprimé(s)`);
  }

  return { sent, removed: toRemove.length };
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  try {
    const payload = await req.json();

    // Accepte : { reservation_id } (trigger SQL) | { record: {...} } (webhook) | champs directs
    let r = payload.record ?? payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRV_KEY);

    if (payload.reservation_id && !r.client_name && !r.nom) {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, nom, client_name, client_phone, telephone, client_email, email, depart, arrivee, destination, pickup_datetime, nb_passagers, passagers, bagages")
        .eq("id", payload.reservation_id)
        .single();
      if (error || !data) throw new Error(`Réservation introuvable : ${error?.message}`);
      r = data;
    }

    // ── Extraction des champs ──
    const clientName = r.client_name || r.nom || "Client";
    const phone      = r.client_phone || r.telephone || "—";
    const email      = r.client_email || r.email || "—";
    const depart     = r.depart || "—";
    const arrivee    = r.arrivee || r.destination || "—";
    const dt         = r.pickup_datetime || "—";
    const passagers  = r.nb_passagers || r.passagers || 1;
    const bagages    = r.bagages ?? 0;
    const reservId   = String(r.id ?? payload.reservation_id ?? "");

    const date =
      dt !== "—"
        ? new Date(dt).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            dateStyle: "short",
            timeStyle: "short",
          })
        : "—";

    const pushTitle = "🔔 Nouvelle réservation";
    const pushBody  = `${clientName} — ${depart} → ${arrivee}`;
    const pushData  = { reservation_id: reservId, tag: `new-res-${reservId}`, url: "/admin/dashboard" };

    // ── 1. Push FCM → admin + chauffeur (avec nettoyage tokens invalides) ──
    const fcmResult = await sendPushToAudience(supabase, ["admin", "chauffeur"], pushTitle, pushBody, pushData);
    console.log(`[notify] FCM sent=${fcmResult.sent} removed=${fcmResult.removed}`);

    // ── 2. Email Resend ──
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Taxi City <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `🚖 Nouvelle réservation — ${clientName}`,
        html: `
          <h2>Nouvelle demande de réservation</h2>
          <p><b>Nom :</b> ${clientName}</p>
          <p><b>Téléphone :</b> ${phone}</p>
          <p><b>Email :</b> ${email}</p>
          <hr/>
          <p><b>Date / heure :</b> ${date}</p>
          <p><b>Départ :</b> ${depart}</p>
          <p><b>Arrivée :</b> ${arrivee}</p>
          <hr/>
          <p><b>Passagers :</b> ${passagers}</p>
          <p><b>Bagages :</b> ${bagages}</p>
          <p style="color:#888">Pensez à rappeler le client rapidement.</p>
        `,
      }),
    });
    const emailBody = await emailRes.text();
    console.log("[notify] resend status", emailRes.status, emailBody);

    return new Response(
      JSON.stringify({ ok: true, email: emailRes.ok, fcm: fcmResult }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
