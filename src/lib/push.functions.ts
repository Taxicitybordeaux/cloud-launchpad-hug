import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendPushToAudience } from "@/lib/push.server";

export type PushAudience = "admin" | "chauffeur" | "client";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
});

const subSchema = z.object({
  audience: z.enum(["admin", "chauffeur", "client"]),
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  reservation_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data }) => {
    // upsert by endpoint
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        audience: data.audience,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
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
  .inputValidator((input) => z.object({ endpoint: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ audience: z.enum(["admin", "chauffeur", "client"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("forbidden");
    const result = await sendPushToAudience(data.audience, {
      title: "🔔 Test notification",
      body: `Notification test envoyée à l'audience « ${data.audience} ».`,
      url: data.audience === "client" ? "/" : "/admin/dashboard",
      tag: "test-push",
    });
    return result;
  });

// ─────────────────────────────────────────────────────────────────
// Nouvelle réservation → push admin + push chauffeur + email taxi
// ─────────────────────────────────────────────────────────────────
export const notifyNewReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    // ── Push admin ──
    const adminResult = await sendPushToAudience("admin", {
      title: "🔔 Nouvelle réservation",
      body: `${clientName} — ${trajet}`,
      url: "/admin/dashboard",
      tag: `new-res-${r.id}`,
      requireInteraction: true,
    });

    // ── Push chauffeur ──
    const chauffeurResult = await sendPushToAudience("chauffeur", {
      title: "🚕 Nouvelle course en attente",
      body: `${clientName} — ${trajet}`,
      url: "/admin/dashboard",
      tag: `new-res-chauffeur-${r.id}`,
      requireInteraction: true,
    });

    // ── Email taxi (résumé réservation) ──
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        status: z.enum(["accepted", "refused", "en_route", "arrived", "completed", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // admin-only
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("forbidden");

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

    // ── Push client ──
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

    // ── Retourner le corps SMS pour en_route et arrived (déclenché depuis le dashboard) ──
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

    // ── Push chauffeur à l'acceptation ──
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
