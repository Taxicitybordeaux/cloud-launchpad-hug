import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAudience } from "@/lib/push.server";

export type PushAudience = "admin" | "chauffeur" | "client";

const CHAUFFEUR_PHONE = "+33673072322";

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
      .select("id, nom, client_name, client_phone, telephone, depart, arrivee, destination, tracking_id")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (!r) throw new Error("not_found");

    const clientName = r.client_name || r.nom || "Client";
    const trajet = `${r.depart} → ${r.arrivee || r.destination || "—"}`;
    const phone = r.client_phone || r.telephone || "";
    const smsPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "+33");
    const url = r.tracking_id ? `/suivi/${r.tracking_id}` : `/reservation/${r.id}`;
    const appUrl = process.env.APP_URL ?? "";

    const labels: Record<string, { title: string; body: string }> = {
      accepted: {
        title: "✅ Course acceptée",
        body: `Bonjour ${clientName}, votre course a été confirmée par le chauffeur.`,
      },
      refused: { title: "❌ Course refusée", body: `Bonjour ${clientName}, votre demande n'a pas pu être acceptée.` },
      en_route: { title: "🚗 Chauffeur en route", body: `Votre chauffeur est en route vers vous — ${r.depart}.` },
      arrived: { title: "📍 Taxi à proximité", body: `Votre taxi est arrivé au point de prise en charge.` },
      completed: { title: "🏁 Course terminée", body: `Merci d'avoir voyagé avec Taxi City Bordeaux.` },
      cancelled: { title: "Course annulée", body: "Votre course a été annulée." },
    };
    const l = labels[data.status];

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

    const chauffeurLabels: Partial<Record<string, { title: string; body: string }>> = {
      accepted: { title: "🚕 Nouvelle course assignée", body: `${clientName} — ${trajet}` },
      en_route: { title: "🚗 Course démarrée", body: `En route vers ${r.depart} — ${clientName}` },
      arrived: { title: "📍 Arrivé au point de prise en charge", body: `${clientName} vous attend au départ.` },
      completed: { title: "🏁 Course terminée", body: `Course avec ${clientName} terminée.` },
    };

    let chauffeurResult = { sent: 0, removed: 0 };
    const chauffeurLabel = chauffeurLabels[data.status];
    if (chauffeurLabel) {
      chauffeurResult = await sendPushToAudience("chauffeur", {
        ...chauffeurLabel,
        url: "/admin/dashboard",
        tag: `chauffeur-${data.status}-${r.id}`,
        requireInteraction: ["accepted", "en_route", "arrived"].includes(data.status),
      });
    }

    // SMS de secours chauffeur si push non reçue
    let chauffeurSmsBody: string | null = null;
    if (chauffeurResult.sent === 0) {
      if (data.status === "accepted") {
        chauffeurSmsBody = encodeURIComponent(
          `🚕 Nouvelle course assignée\n${clientName} — ${trajet}\n📲 Dashboard : ${appUrl}/admin/dashboard`,
        );
      } else if (data.status === "en_route") {
        chauffeurSmsBody = encodeURIComponent(`🚗 Course démarrée — ${clientName}\nEn route vers ${r.depart}`);
      } else if (data.status === "arrived") {
        chauffeurSmsBody = encodeURIComponent(`📍 Arrivé au point de prise en charge — ${clientName}`);
      } else if (data.status === "completed") {
        chauffeurSmsBody = encodeURIComponent(`🏁 Course terminée — ${clientName}`);
      }
    }

    return {
      client: result,
      chauffeur: chauffeurResult,
      smsPhone: smsPhone || null,
      smsBody,
      chauffeurSmsPhone: chauffeurResult.sent === 0 && chauffeurSmsBody ? CHAUFFEUR_PHONE : null,
      chauffeurSmsBody,
    };
  });
