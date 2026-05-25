import { createServerFn } from "@tanstack/react-start";
import { DICTS, type Lang } from "@/i18n/dict";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAudience } from "@/lib/push.server";

export type PushAudience = "admin" | "chauffeur" | "client";

const subSchema = z.object({
  audience: z.enum(["admin", "chauffeur", "client"]),
  fcm_token: z.string().min(10).max(500),
  reservation_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data }) => {
    const endpoint = `fcm://${data.fcm_token}`;
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        audience: data.audience,
        endpoint,
        fcm_token: data.fcm_token,
        reservation_id: data.reservation_id ?? null,
        user_agent: data.user_agent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("[push] subscribe failed", error);
      throw new Error("subscribe_failed");
    }
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ fcm_token: z.string().min(10).max(500) }).parse(input))
  .handler(async ({ data }) => {
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

export const notifyNewReservation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: r } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, nom, client_name, client_phone, telephone, client_email, email, depart, arrivee, destination, pickup_datetime, nb_passagers, passagers, bagages",
      )
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (!r) throw new Error("not_found");

    const clientName = r.client_name || r.nom || "Client";
    const trajet = `${r.depart} → ${r.arrivee || r.destination || "—"}`;
    const phone = r.client_phone || r.telephone || "";
    const email = r.client_email || r.email || "";

    const adminResult = await sendPushToAudience("admin", {
      title: "🔔 Nouvelle réservation",
      body: `${clientName} — ${trajet}`,
      url: "/admin/dashboard",
      tag: `new-res-${r.id}`,
      requireInteraction: true,
    });

    const chauffeurResult = await sendPushToAudience("chauffeur", {
      title: "🚕 Nouvelle course en attente",
      body: `${clientName} — ${trajet}`,
      url: "/admin/dashboard",
      tag: `new-res-chauffeur-${r.id}`,
      requireInteraction: true,
    });

    let emailSent = false;
    try {
      const pickupFormatted = r.pickup_datetime
        ? new Date(r.pickup_datetime).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            dateStyle: "full",
            timeStyle: "short",
          })
        : "—";
      const res = await fetch(`${process.env.APP_URL ?? ""}/api/admin/send-course-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
        body: JSON.stringify({
          templateName: "new-reservation-admin",
          recipientEmail: "taxi.city033@gmail.com",
          idempotencyKey: `new-res-admin-${r.id}`,
          templateData: {
            nom: clientName,
            phone,
            email,
            depart: r.depart,
            arrivee: r.arrivee || r.destination || "—",
            pickup_datetime: pickupFormatted,
            passagers: r.nb_passagers || r.passagers || 1,
            bagages: r.bagages ?? 0,
            admin_url: `${process.env.APP_URL ?? ""}/admin/dashboard`,
          },
        }),
      });
      emailSent = res.ok;
    } catch (e) {
      console.error("[notifyNewReservation] email failed", e);
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
    const { data: r } = await supabaseAdmin
      .from("reservations")
      .select("id, nom, client_name, client_phone, telephone, depart, arrivee, destination, tracking_id, lang")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (!r) throw new Error("not_found");

    const clientName = r.client_name || r.nom || "Client";
    const trajet = `${r.depart} → ${r.arrivee || r.destination || "—"}`;
    const phone = r.client_phone || r.telephone || "";
    const smsPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "+33");
    const url = r.tracking_id ? `/suivi/${r.tracking_id}` : `/reservation/${r.id}`;
    const appUrl = process.env.APP_URL ?? "";

    // Labels traduits selon la langue de la réservation
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
        url: `${appUrl}${url}`,
        tag: `res-${r.id}`,
        requireInteraction: ["en_route", "arrived"].includes(data.status),
      },
      { reservationId: r.id },
    );

    let smsBody: string | null = null;
    if (smsPhone && data.status === "en_route") {
      smsBody = encodeURIComponent(
        `Bonjour ${clientName},\nVotre chauffeur est en route vers vous !\n${r.depart}\n📲 Suivez en direct : ${appUrl}${url}\nTel: 06 73 07 23 22`,
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
        title: "🚕 Nouvelle course assignée",
        body: `${clientName} — ${trajet}`,
        url: "/admin/dashboard",
        tag: `assign-${r.id}`,
        requireInteraction: true,
      });
    }

    return { client: result, chauffeur: chauffeurResult, smsPhone: smsPhone || null, smsBody };
  });
