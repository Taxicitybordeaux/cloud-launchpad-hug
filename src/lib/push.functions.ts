import { createServerFn } from "@tanstack/react-start";
import { DICTS, type Lang } from "@/i18n/dict";
import { z } from "zod";
import { getTaxiSupabaseAdmin } from "@/lib/taxi-supabase.server";
import { sendPushToAudience } from "@/lib/push.server";

export type PushAudience = "admin" | "chauffeur" | "client";

const FCM_TOKEN_RE = /^[A-Za-z0-9_\-:]{50,500}$/;

const subSchema = z.object({
  audience: z.enum(["admin", "chauffeur", "client"]),
  fcm_token: z.string().regex(FCM_TOKEN_RE, "fcm_token format invalide"),
  reservation_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const ua = data.user_agent ?? null;
    const endpoint = `fcm://${data.fcm_token}`;

    // 1) Upsert la souscription courante
    const { error: upErr } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        audience: data.audience,
        endpoint,
        fcm_token: data.fcm_token,
        reservation_id: data.reservation_id ?? null,
        user_agent: ua,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (upErr) {
      console.error("[push] subscribe failed", upErr);
      throw new Error("subscribe_failed");
    }

    // 2) Purge des anciens tokens du même device (même user_agent + audience).
    // iOS Safari/PWA régénère parfois le fcm_token à chaque session ou install,
    // ce qui laissait s'accumuler plusieurs lignes pour le même device →
    // notifications dupliquées (×8 observé sur iPhone).
    // IMPORTANT : on ne purge que les tokens dont les 8 derniers chars diffèrent
    // du token actuel — évite de supprimer un autre appareil avec le même user_agent
    // (ex: 2 iPhone 15 Safari du même modèle).
    if (ua) {
      // Récupère tous les tokens du même UA + audience (sauf le token actuel)
      const { data: stale, error: fetchErr } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, fcm_token")
        .eq("audience", data.audience)
        .eq("user_agent", ua)
        .neq("fcm_token", data.fcm_token);

      if (!fetchErr && stale && stale.length > 0) {
        // Ne purge que les tokens qui partagent les mêmes 8 derniers chars
        // (variantes du même token régénéré sur le même device)
        const currentSuffix = data.fcm_token.slice(-8);
        const toDelete = stale.filter((r) => r.fcm_token && r.fcm_token.slice(-8) === currentSuffix).map((r) => r.id);
        if (toDelete.length > 0) {
          const { error: delErr } = await supabaseAdmin.from("push_subscriptions").delete().in("id", toDelete);
          if (delErr) console.warn("[push] dedupe stale tokens failed", delErr);
        }
      }
    }

    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ fcm_token: z.string().min(10).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = getTaxiSupabaseAdmin();
    await supabaseAdmin.from("push_subscriptions").delete().eq("fcm_token", data.fcm_token);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ audience: z.enum(["admin", "chauffeur", "client"]) }).parse(input))
  .handler(async ({ data }) => {
    return sendPushToAudience(data.audience, {
      title: "🔔 Test notification",
      body: `Notification test envoyée à l'audience « ${data.audience} ».`,
      url: data.audience === "client" ? "/" : "/admin/dashboard",
      tag: "test-push",
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
    const supabaseAdmin = getTaxiSupabaseAdmin();
    console.log("[notifyNewReservation] start", data.reservation_id);

    const { data: r, error: fetchErr } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, nom, client_name, client_phone, telephone, client_email, email, depart, arrivee, destination, pickup_datetime, nb_passagers, passagers, bagages, service_type",
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

    // ── Push FCM admin + chauffeur ─────────────────────────────────────────
    const [adminResult, chauffeurResult] = await Promise.all([
      sendPushToAudience("admin", {
        title: "🔔 Nouvelle réservation",
        body: `${clientName} — ${trajet}`,
        url: "/admin/dashboard",
        tag: `new-res-${r.id}`,
        requireInteraction: true,
      }),
      sendPushToAudience("chauffeur", {
        title: "🚕 Nouvelle course en attente",
        body: `${clientName} — ${trajet}`,
        url: "/admin/dashboard",
        tag: `chauffeur-res-${r.id}`,
        requireInteraction: true,
      }),
    ]);
    console.log(
      "[notifyNewReservation] push admin:",
      JSON.stringify(adminResult),
      "chauffeur:",
      JSON.stringify(chauffeurResult),
    );

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
          admin_url: `${APP_URL}/admin/dashboard`,
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

    return { admin: adminResult, chauffeur: chauffeurResult, emailSent };
  });

export const notifyReservationStatus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        status: z.enum(["accepted", "refused", "en_route", "arrived", "completed", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const { data: r } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, nom, client_name, client_phone, telephone, depart, arrivee, destination, tracking_id, suivi_id, lang",
      )
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (!r) throw new Error("not_found");

    const clientName = r.client_name || r.nom || "Client";
    const trajet = `${r.depart} → ${r.arrivee || r.destination || "—"}`;
    const phone = r.client_phone || r.telephone || "";
    const smsPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "+33");
    const url = r.suivi_id
      ? `/suivi/${r.suivi_id}`
      : r.tracking_id
        ? `/suivi/${r.tracking_id}`
        : `/reservation/${r.id}`;

    const resLang = ((r as any).lang as Lang) || "fr";

    const PUSH_LABELS: Record<Lang, Record<string, { title: string; body: string }>> = {
      fr: {
        accepted: { title: "✅ Course acceptée", body: `Bonjour ${clientName}, votre course a été confirmée.` },
        refused: { title: "❌ Course refusée", body: `Bonjour ${clientName}, votre demande n'a pas pu être acceptée.` },
        en_route: { title: "🚗 Chauffeur en route", body: `Votre chauffeur est en route vers vous — ${r.depart}.` },
        arrived: { title: "📍 Taxi à proximité", body: `Votre taxi est arrivé au point de prise en charge.` },
        completed: { title: "🏁 Course terminée", body: `Merci d'avoir voyagé avec Taxi City Bordeaux.` },
        cancelled: { title: "Course annulée", body: "Votre course a été annulée." },
      },
      en: {
        accepted: { title: "✅ Booking confirmed", body: `Hello ${clientName}, your ride has been confirmed.` },
        refused: { title: "❌ Booking refused", body: `Hello ${clientName}, your request could not be accepted.` },
        en_route: { title: "🚗 Driver on the way", body: `Your driver is heading to you — ${r.depart}.` },
        arrived: { title: "📍 Taxi nearby", body: `Your taxi has arrived at the pickup point.` },
        completed: { title: "🏁 Ride completed", body: `Thank you for travelling with Taxi City Bordeaux.` },
        cancelled: { title: "Ride cancelled", body: "Your ride has been cancelled." },
      },
      es: {
        accepted: { title: "✅ Reserva confirmada", body: `Hola ${clientName}, su carrera ha sido confirmada.` },
        refused: { title: "❌ Reserva rechazada", body: `Hola ${clientName}, su solicitud no pudo ser aceptada.` },
        en_route: { title: "🚗 Conductor en camino", body: `Su conductor está en camino — ${r.depart}.` },
        arrived: { title: "📍 Taxi cerca", body: `Su taxi ha llegado al punto de recogida.` },
        completed: { title: "🏁 Carrera terminada", body: `Gracias por viajar con Taxi City Bordeaux.` },
        cancelled: { title: "Carrera cancelada", body: "Su carrera ha sido cancelada." },
      },
      pt: {
        accepted: { title: "✅ Reserva confirmada", body: `Olá ${clientName}, a sua corrida foi confirmada.` },
        refused: { title: "❌ Reserva recusada", body: `Olá ${clientName}, o seu pedido não pôde ser aceite.` },
        en_route: { title: "🚗 Motorista a caminho", body: `O seu motorista está a caminho — ${r.depart}.` },
        arrived: { title: "📍 Táxi próximo", body: `O seu táxi chegou ao ponto de recolha.` },
        completed: { title: "🏁 Corrida terminada", body: `Obrigado por viajar com Taxi City Bordeaux.` },
        cancelled: { title: "Corrida cancelada", body: "A sua corrida foi cancelada." },
      },
      it: {
        accepted: {
          title: "✅ Prenotazione confermata",
          body: `Salve ${clientName}, la sua corsa è stata confermata.`,
        },
        refused: {
          title: "❌ Prenotazione rifiutata",
          body: `Salve ${clientName}, la sua richiesta non è stata accettata.`,
        },
        en_route: { title: "🚗 Autista in arrivo", body: `Il suo autista è in arrivo — ${r.depart}.` },
        arrived: { title: "📍 Taxi nelle vicinanze", body: `Il suo taxi è arrivato al punto di partenza.` },
        completed: { title: "🏁 Corsa terminata", body: `Grazie per aver viaggiato con Taxi City Bordeaux.` },
        cancelled: { title: "Corsa annullata", body: "La sua corsa è stata annullata." },
      },
      ar: {
        accepted: { title: "✅ تم تأكيد الحجز", body: `مرحباً ${clientName}، تم تأكيد رحلتك.` },
        refused: { title: "❌ تم رفض الحجز", body: `مرحباً ${clientName}، لم نتمكن من قبول طلبك.` },
        en_route: { title: "🚗 السائق في الطريق", body: `سائقك في طريقه إليك — ${r.depart}.` },
        arrived: { title: "📍 السيارة قريبة", body: `وصلت سيارتك إلى نقطة الالتقاء.` },
        completed: { title: "🏁 انتهت الرحلة", body: `شكراً للتنقل مع Taxi City Bordeaux.` },
        cancelled: { title: "تم إلغاء الرحلة", body: "تم إلغاء رحلتك." },
      },
    };

    const langLabels = PUSH_LABELS[resLang] ?? PUSH_LABELS["fr"];
    const l = langLabels[data.status];

    const result = await sendPushToAudience(
      "client",
      {
        ...l,
        url: `${APP_URL}${url}`,
        tag: `res-${r.id}`,
        requireInteraction: ["en_route", "arrived"].includes(data.status),
      },
      { reservationId: r.id },
    );

    let smsBody: string | null = null;
    if (smsPhone && data.status === "en_route") {
      smsBody = encodeURIComponent(
        `Bonjour ${clientName},\nVotre chauffeur est en route vers vous !\n${r.depart}\n📲 Suivez en direct : ${APP_URL}${url}\nTel: 06 73 07 23 22`,
      );
    }
    if (smsPhone && data.status === "arrived") {
      smsBody = encodeURIComponent(
        `Bonjour ${clientName},\nVotre taxi est arrive ! Il vous attend au point de prise en charge.\nTel: 06 73 07 23 22`,
      );
    }

    let chauffeurResult = { sent: 0, removed: 0 };
    if (data.status === "accepted") {
      chauffeurResult = await sendPushToAudience("chauffeur", {
        title: "📍 Active ton GPS",
        body: `${clientName} — ${trajet}`,
        url: `${APP_URL}${url}?gps=1`,
        tag: `chauffeur-res-${r.id}`,
        requireInteraction: true,
      });
    }

    return { client: result, chauffeur: chauffeurResult, smsPhone: smsPhone || null, smsBody };
  });
