import { createServerFn } from "@tanstack/react-start";
import { DICTS, type Lang } from "@/i18n/dict";
import { z } from "zod";

export type PushAudience = "chauffeur" | "client";

const FCM_TOKEN_RE = /^[A-Za-z0-9_\-:]{50,500}$/;

// Hash court et stable du user_agent, utilisé comme identifiant de device
// dans endpoint. Pas cryptographique — juste besoin de stabilité, pas de
// sécurité. "no-ua" si absent pour éviter que tous les UA vides collisionnent
// silencieusement avec un vrai device (cas déjà rare, accepté).
function hashUserAgent(ua: string | null): string {
  if (!ua) return "no-ua";
  let hash = 0;
  for (let i = 0; i < ua.length; i++) {
    hash = (hash << 5) - hash + ua.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const subSchema = z.object({
  audience: z.enum(["chauffeur", "client"]),
  fcm_token: z.string().regex(FCM_TOKEN_RE, "fcm_token format invalide"),
  reservation_id: z.string().uuid().optional().nullable(),
  client_account_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data }) => {
    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const ua = data.user_agent ?? null;
    const clientAccountId = data.audience === "client" ? (data.client_account_id ?? null) : null;
    const reservationId = data.audience === "client" ? (data.reservation_id ?? null) : null;

    // Endpoint stable par DEVICE (via hash du user_agent) + audience + cible.
    // Important : un même client peut avoir plusieurs réservations actives ;
    // l'ancien endpoint token+audience écrasait l'abonnement précédent.
    //
    // ⚠️ CORRECTIF : l'endpoint ne doit JAMAIS inclure fcm_token. iOS régénère
    // le token régulièrement (rotation auto 50j dans getFcmToken, refresh sur
    // visibilitychange, etc.) — si le token fait partie de la clé, chaque
    // rotation génère un endpoint différent, le delete-before-insert ne trouve
    // jamais l'ancienne ligne, et on accumule des lignes actives pour le même
    // device → notifications ×N côté iPhone. En gardant l'endpoint stable par
    // device (hash UA), la rotation de token remplace bien l'ancienne ligne.
    const targetKey = clientAccountId
      ? `account-${clientAccountId}`
      : reservationId
        ? `reservation-${reservationId}`
        : "generic";
    const deviceKey = hashUserAgent(ua);
    const endpoint = `${data.audience}-${targetKey}-${deviceKey}`;
    const nowIso = new Date().toISOString();

    // Cleanup ancienne ligne pour ce device/cible + vieux doublons du même token.
    // La base taxi historique n'a pas toujours toutes les colonnes récentes
    // (ex: client_account_id). On reste compatible en ne s'appuyant que sur
    // endpoint, qui encode déjà audience + cible + device.
    try {
      await Promise.all([
        supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint),
        supabaseAdmin.from("push_subscriptions").delete().eq("audience", data.audience).eq("fcm_token", data.fcm_token),
      ]);
    } catch (e) {
      console.warn("[push] pre-insert cleanup non-fatal error", e);
    }

    // Insert — inclut client_account_id / reservation_id pour ciblage précis
    const insertPayload: any = {
      audience: data.audience,
      endpoint,
      fcm_token: data.fcm_token,
      user_agent: ua,
      last_seen_at: nowIso,
      reservation_id: reservationId,
    };
    if (clientAccountId) insertPayload.client_account_id = clientAccountId;

    let { error: insErr } = await supabaseAdmin.from("push_subscriptions").insert(insertPayload);
    if ((insErr as any)?.code === "23505") {
      // Certaines bases anciennes ont encore un index unique global sur fcm_token.
      // Dans ce cas on remplace la ligne du token pour ne pas bloquer Android/iOS.
      await supabaseAdmin.from("push_subscriptions").delete().eq("fcm_token", data.fcm_token);
      const retry = await supabaseAdmin.from("push_subscriptions").insert(insertPayload);
      insErr = retry.error;
    }
    if (insErr) {
      console.error("[push] subscribe insert failed", insErr);
      throw new Error("subscribe_failed");
    }

    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ fcm_token: z.string().min(10).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    await supabaseAdmin.from("push_subscriptions").delete().eq("fcm_token", data.fcm_token);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ audience: z.enum(["chauffeur", "client"]) }).parse(input))
  .handler(async ({ data }) => {
    const { sendPushToAudience } = await import("@/lib/push.server");
    return sendPushToAudience(data.audience, {
      title: "🔔 Test notification",
      body: `Notification test envoyée à l'audience « ${data.audience} ».`,
      url: data.audience === "client" ? "/" : "/driver?token=DSF234",
      tag: "test-push",
    });
  });

// Push chauffeur quand un nouvel avis est écrit sur le site.
// Fire-and-forget côté client : jamais bloquant, jamais throw visible.
export const notifyNewReview = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        author_name: z.string().max(80).optional().nullable(),
        note: z.number().int().min(1).max(5),
        commentaire: z.string().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { sendPushToAudience } = await import("@/lib/push.server");
    const stars = "★".repeat(data.note) + "☆".repeat(5 - data.note);
    const who = (data.author_name ?? "").trim() || "Un client";
    const excerpt = (data.commentaire ?? "").trim().slice(0, 90);
    return sendPushToAudience("chauffeur", {
      title: `⭐ Nouvel avis ${stars}`,
      body: excerpt ? `${who} : « ${excerpt}${excerpt.length >= 90 ? "…" : ""} »` : `${who} vient de laisser un avis.`,
      url: "/driver?token=DSF234",
      tag: `new-review-${Date.now()}`,
    });
  });

// URL de prod hardcodée — process.env.APP_URL est vide en contexte serveur Lovable
const APP_URL = "https://taxicitybordeaux.fr";

// Appelée depuis reserver.tsx après l'insert d'une nouvelle réservation.
// Envoie push FCM à admin + chauffeur ET email à José via le bridge Lovable
// (même bridge que notify-reservation.ts, qui est prouvé fonctionnel).
export const notifyNewReservation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const [{ getTaxiSupabaseAdmin, getTaxiSupabaseConfig }] = await Promise.all([import("@/lib/taxi-supabase.server")]);

    const supabaseAdmin = getTaxiSupabaseAdmin();
    console.log("[notifyNewReservation] start", data.reservation_id);

    const { data: r, error: fetchErr } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, nom, client_name, client_phone, telephone, client_email, email, depart, arrivee, destination, pickup_datetime, nb_passagers, passagers, bagages, service_type, suivi_id, lang",
      )
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (fetchErr) {
      console.error("[notifyNewReservation] supabase fetch error", fetchErr);
      throw new Error("fetch_failed");
    }
    if (!r) throw new Error("not_found");

    const clientName = r.client_name || r.nom || "Client";
    const trajet = `${r.depart} → ${r.arrivee || r.destination || "—"}`;

    // ── Push chauffeur : PLUS ENVOYÉE ICI ─────────────────────────────────
    // Le trigger DB `trg_notify_reservation_http` appelle déjà
    // /api/public/notify-reservation qui envoie la push chauffeur.
    // L'envoyer ici en plus produisait un doublon ("Nouvelle course" +
    // "Nouvelle résa") sur le téléphone du chauffeur.
    const chauffeurResult = { sent: 0, removed: 0, skipped: "sent-by-db-trigger" as const };

    // ── Email à José via le bridge Lovable (même que notify-reservation.ts) ─
    let emailSent = false;
    try {
      const { serviceKey } = getTaxiSupabaseConfig();

      const emailPayload = {
        templateName: "new-reservation-admin",
        recipientEmail: "taxi.city033@gmail.com",
        idempotencyKey: `new-res-admin-${r.id}`,
        templateData: {
          id: r.id,
          nom: clientName,
          client_name: clientName,
          phone: r.client_phone || r.telephone || "",
          telephone: r.client_phone || r.telephone || "",
          email: r.client_email || r.email || "",
          depart: r.depart,
          arrivee: r.arrivee || r.destination || "—",
          destination: r.arrivee || r.destination || "—",
          pickup_datetime: r.pickup_datetime ?? "",
          passagers: r.nb_passagers || r.passagers || 1,
          bagages: r.bagages ?? 0,
          service_type: (r as any).service_type ?? "",
          admin_url: `${APP_URL}/driver?token=DSF234`,
        },
      };

      console.log("[notifyNewReservation] sending email via bridge →", `${APP_URL}/lovable/email/transactional/send`);
      const res = await fetch(`${APP_URL}/lovable/email/transactional/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
        },
        body: JSON.stringify(emailPayload),
      });
      emailSent = res.ok;
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("[notifyNewReservation] email bridge failed", res.status, errBody);
      } else {
        console.log("[notifyNewReservation] email queued ok");
      }
    } catch (e) {
      console.error("[notifyNewReservation] email fetch threw", e);
    }

    // ── Email de confirmation au CLIENT (avec son lien de suivi) ─────────────
    let clientEmailSent = false;
    const clientEmail = r.client_email || r.email || "";
    if (clientEmail) {
      try {
        const { serviceKey } = getTaxiSupabaseConfig();

        const clientEmailPayload = {
          templateName: "reservation-client-confirmation",
          recipientEmail: clientEmail,
          idempotencyKey: `new-res-client-${r.id}`,
          templateData: {
            lang: (r as any).lang || "fr",
            nom: clientName,
            pickup_datetime: r.pickup_datetime ?? "",
            depart: r.depart,
            arrivee: r.arrivee || r.destination || "—",
            passagers: r.nb_passagers || r.passagers || 1,
            bagages: r.bagages ?? 0,
            reservation_id: r.id,
            suivi_url: `${APP_URL}/suivi/${(r as any).suivi_id || r.id}`,
          },
        };

        console.log(
          "[notifyNewReservation] sending client confirmation email via bridge →",
          `${APP_URL}/lovable/email/transactional/send`,
        );
        const clientRes = await fetch(`${APP_URL}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
          },
          body: JSON.stringify(clientEmailPayload),
        });
        clientEmailSent = clientRes.ok;
        if (!clientRes.ok) {
          const errBody = await clientRes.text().catch(() => "");
          console.error("[notifyNewReservation] client email bridge failed", clientRes.status, errBody);
        } else {
          console.log("[notifyNewReservation] client email queued ok");
        }
      } catch (e) {
        console.error("[notifyNewReservation] client email fetch threw", e);
      }
    } else {
      console.warn("[notifyNewReservation] no client email on reservation", r.id);
    }

    return { chauffeur: chauffeurResult, emailSent, clientEmailSent };
  });

// Compute ETA in minutes from driver's current GPS to the pickup address
// using Google Distance Matrix REST. Returns null on failure / no data.
async function computeEtaMinutes(_reservationId: string, depart: string): Promise<number | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !depart) return null;
    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const { data: gps } = await supabaseAdmin
      .from("driver_gps" as any)
      .select("latitude, longitude, captured_at, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const lat = (gps as any)?.latitude;
    const lng = (gps as any)?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${encodeURIComponent(
      depart,
    )}&mode=driving&departure_time=now&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    const el = json?.rows?.[0]?.elements?.[0];
    const sec = el?.duration_in_traffic?.value ?? el?.duration?.value;
    if (typeof sec !== "number") return null;
    return Math.max(1, Math.round(sec / 60));
  } catch (e) {
    console.warn("[notifyReservationStatus] eta compute failed", e);
    return null;
  }
}

export const notifyReservationStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        status: z.enum(["accepted", "refused", "en_route", "arrived", "completed", "cancelled"]),
        update_status: z.boolean().optional(),
        suivi_key: z.string().min(1).max(120).optional(),
        eta_minutes: z.number().int().positive().max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const [{ getTaxiSupabaseAdmin }, { sendPushToAudience }] = await Promise.all([
      import("@/lib/taxi-supabase.server"),
      import("@/lib/push.server"),
    ]);
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const { data: r, error: fetchErr } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, nom, client_name, client_phone, telephone, depart, arrivee, destination, suivi_id, lang, client_account_id",
      )
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (fetchErr) {
      console.error("[notifyReservationStatus] fetch error", fetchErr);
      throw new Error(`fetch_failed: ${fetchErr.message}`);
    }
    if (!r) throw new Error("not_found");

    if (data.update_status) {
      if (!["en_route", "arrived", "completed"].includes(data.status)) throw new Error("forbidden");
      const suiviKey = data.suivi_key?.trim();
      const isValidSuiviKey = !!suiviKey && [r.id, r.suivi_id].filter(Boolean).includes(suiviKey);
      if (!isValidSuiviKey) throw new Error("forbidden");

      const { error: updateError } = await supabaseAdmin
        .from("reservations")
        .update({ status: data.status, updated_at: new Date().toISOString() })
        .eq("id", r.id);
      if (updateError) {
        console.error("[notifyReservationStatus] status update failed", updateError);
        throw new Error("status_update_failed");
      }
    }

    const clientName = r.client_name || r.nom || "Client";
    const trajet = `${r.depart} → ${r.arrivee || r.destination || "—"}`;
    const phone = r.client_phone || r.telephone || "";
    const smsPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "+33");
    const url = `/suivi/${(r as any).suivi_id || r.id}`;

    // ── Push CHAUFFEUR désactivée (notification "Active ton GPS" retirée) ─
    const chauffeurResult = { sent: 0, removed: 0 };

    // ── Push CLIENT : confirmation, approche, arrivée, fin de course ─────
    let clientResult = { sent: 0, removed: 0 };
    const target = { reservationId: r.id, accountId: (r as any).client_account_id ?? undefined };
    if (data.status === "accepted") {
      clientResult = await sendPushToAudience(
        "client",
        {
          title: "✅ Course confirmée",
          body: `José a confirmé votre course : ${trajet}.`,
          url,
          tag: `client-accepted-${r.id}`,
          requireInteraction: false,
          data: { reservation_id: r.id, status: "accepted" },
        },
        target,
      );
    } else if (data.status === "en_route") {
      const eta = data.eta_minutes ?? (await computeEtaMinutes(r.id, r.depart || ""));
      const etaTxt = eta ? ` (arrivée dans ~${eta} min)` : "";
      clientResult = await sendPushToAudience(
        "client",
        {
          title: "🚖 Votre taxi arrive",
          body: `Votre taxi arrive vers ${r.depart}${etaTxt}.`,
          url,
          tag: `client-en-route-${r.id}`,
          requireInteraction: false,
          data: { reservation_id: r.id, status: "en_route", eta_minutes: eta ?? null },
        },
        target,
      );
    } else if (data.status === "arrived") {
      clientResult = await sendPushToAudience(
        "client",
        {
          title: "✅ Votre taxi est arrivé",
          body: `Votre chauffeur vous attend au point de prise en charge.`,
          url,
          tag: `client-arrived-${r.id}`,
          requireInteraction: true,
          data: { reservation_id: r.id, status: "arrived" },
        },
        target,
      );
    } else if (data.status === "completed") {
      clientResult = await sendPushToAudience(
        "client",
        {
          title: "🏁 Course terminée",
          body: "Merci pour votre trajet avec Taxi City Bordeaux.",
          url,
          tag: `client-completed-${r.id}`,
          requireInteraction: false,
          data: { reservation_id: r.id, status: "completed" },
        },
        target,
      );
    }

    // SMS optionnel (lien wa.me/sms côté UI) — conservé
    let smsBody: string | null = null;
    if (smsPhone && data.status === "en_route") {
      smsBody = encodeURIComponent(
        `Bonjour ${clientName},\nVotre taxi arrive vers vous !\n${r.depart}\n📲 Suivez en direct : ${APP_URL}${url}\nTel: 06 73 07 23 22`,
      );
    }
    if (smsPhone && data.status === "arrived") {
      smsBody = encodeURIComponent(
        `Bonjour ${clientName},\nVotre taxi est arrive ! Il vous attend au point de prise en charge.\nTel: 06 73 07 23 22`,
      );
    }

    return { client: clientResult, chauffeur: chauffeurResult, smsPhone: smsPhone || null, smsBody };
  });

// ── Mise à jour du trajet (km + prix) par le chauffeur depuis la page suivi ──
// Le chauffeur choisit dans Maps son itinéraire (option C : longueur/voie rapide
// laissée à son jugement), revient sur /reservation/$id et saisit le nouveau km.
// On recalcule le prix et on notifie le client par push.
export const updateReservationRoute = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        suivi_key: z.string().min(1).max(120),
        distance_km: z.number().positive().max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const [{ getTaxiSupabaseAdmin }, { sendPushToAudience }, { calculerPrixMixte }, { buildPriceUpdatePush }] =
      await Promise.all([
        import("@/lib/taxi-supabase.server"),
        import("@/lib/push.server"),
        import("@/lib/tarif"),
        import("@/lib/push-messages"),
      ]);
    const supabaseAdmin = getTaxiSupabaseAdmin();

    const { data: r, error: fetchErr } = await supabaseAdmin
      .from("reservations")
      .select("id, suivi_id, pickup_datetime, prix_estime, distance_km, nom, client_name, lang, status")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (fetchErr) throw new Error(`fetch_failed: ${fetchErr.message}`);
    if (!r) throw new Error("not_found");

    // Autorisation 1/2 : la suivi_key doit correspondre à la réservation
    const key = data.suivi_key.trim();
    const validKey = [r.id, (r as any).suivi_id].filter(Boolean).includes(key);
    if (!validKey) throw new Error("forbidden");

    // Autorisation 2/2 (gating serveur) : la course DOIT être acceptée par l'admin.
    // Tant que le statut n'est pas 'accepted' (ou en cours après acceptation),
    // José ne peut pas modifier le trajet/prix — même si l'UI a un bug.
    const allowedStatuses = ["accepted", "en_route", "arrived"];
    const currentStatus = String((r as any).status ?? "").toLowerCase();
    if (!allowedStatuses.includes(currentStatus)) {
      throw new Error(`forbidden_status:${currentStatus || "unknown"}`);
    }

    const pickupIso = (r as any).pickup_datetime || new Date().toISOString();
    const newPrice = calculerPrixMixte(data.distance_km, pickupIso);
    const oldPrice = Number((r as any).prix_estime ?? 0);

    const { error: updErr } = await supabaseAdmin
      .from("reservations")
      .update({
        distance_km: data.distance_km,
        prix_estime: newPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (updErr) throw new Error(`update_failed: ${updErr.message}`);

    // ⚠️ Plus de push au CLIENT — la mise à jour du prix est visible en
    // temps réel sur /reservation/$id (le client voit le nouveau montant + km).
    return {
      ok: true,
      prix_estime: newPrice,
      distance_km: data.distance_km,
      old_prix_estime: oldPrice,
      push: { sent: 0, removed: 0 },
    };
  });

// ── Liste des échecs d'envoi push (admin) ─────────────────────────────────────
// L'admin saisit son PIN courant ; on le compare au mot de passe stocké côté
// client (pas de table dédiée aujourd'hui), donc on utilise un secret env
// ADMIN_PIN. Fallback "DSF234" pour rester aligné avec le PIN par défaut.
const ADMIN_PIN_DEFAULT = "DSF234";

function checkAdminPin(pin: string): boolean {
  const expected =
    process.env.ADMIN_PIN ||
    (typeof import.meta !== "undefined" ? (import.meta as any).env?.ADMIN_PIN : undefined) ||
    ADMIN_PIN_DEFAULT;
  if (!expected) return false;
  // comparaison constante-temps simple
  if (pin.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < pin.length; i++) diff |= pin.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const listPushFailures = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        pin: z.string().min(1).max(128),
        only_price_update: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!checkAdminPin(data.pin)) {
      throw new Error("forbidden");
    }
    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    let q = supabaseAdmin
      .from("push_send_failures")
      .select(
        "id, created_at, audience, tag, reservation_id, fcm_token_suffix, http_status, error_code, title, body, user_agent",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.only_price_update) {
      // Le tag des push "Prix mis à jour" est `res-<id>-price`
      q = q.like("tag", "%-price");
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(`fetch_failed: ${error.message}`);
    return { failures: rows ?? [] };
  });
