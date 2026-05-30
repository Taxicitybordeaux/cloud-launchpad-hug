import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendPushToAudience } from "@/lib/push.server";

const TEMPLATE_NAME = "new-reservation-admin";
const INTERNAL_NOTIFY_SECRET = "taxi-city-reservation-trigger-v1";

const schema = z.object({
  reservation_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/notify-reservation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = "https://auiagkpdpnfqxfngisfc.supabase.co";
        const serviceKey = process.env.TAXI_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

        console.log("[notify-reservation] supabaseUrl:", supabaseUrl);
        console.log("[notify-reservation] serviceKey prefix:", serviceKey?.slice(0, 60));

        if (!serviceKey) {
          return Response.json({ error: "Server config error" }, { status: 500 });
        }

        const internalSecret = request.headers.get("X-Internal-Notify-Secret");
        const hasServiceBearer = request.headers.get("Authorization") === `Bearer ${serviceKey}`;
        if (internalSecret !== INTERNAL_NOTIFY_SECRET && !hasServiceBearer) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        const reservationId = parsed.data.reservation_id;
        console.log("[notify-reservation] reservationId:", reservationId);

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${serviceKey}` } },
        });

        const { data: reservation, error: lookupError } = await supabase
          .from("reservations")
          .select("id, nom, telephone, email, pickup_datetime, depart, arrivee, passagers, bagages, service_type")
          .eq("id", reservationId)
          .maybeSingle();
        if (lookupError) {
          console.error("[notify-reservation] lookupError:", JSON.stringify(lookupError));
          return Response.json({ error: "lookup" }, { status: 500 });
        }
        if (!reservation) return Response.json({ error: "not_found" }, { status: 404 });

        const data = {
          ...reservation,
          phone: reservation.telephone,
          admin_url: "https://taxicitybordeaux.fr/admin/dashboard",
        };
        const template = TEMPLATES[TEMPLATE_NAME];
        if (!template || !template.to) {
          return Response.json({ error: "Template not configured" }, { status: 500 });
        }
        const recipient = template.to;
        const idempotencyKey = `reservation-${reservationId}`;

        const EMAIL_BRIDGE_URL = "https://taxicitybordeaux.fr/lovable/email/transactional/send";
        console.log("[notify-reservation] → bridge:", EMAIL_BRIDGE_URL, "reservation:", reservationId);

        const sendResp = await fetch(EMAIL_BRIDGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            templateName: TEMPLATE_NAME,
            recipientEmail: recipient,
            idempotencyKey,
            templateData: data,
          }),
        });

        if (!sendResp.ok) {
          const errBody = await sendResp.text().catch(() => "");
          console.error("[notify-reservation] bridge error", sendResp.status, errBody);
          return Response.json({ error: "send_failed" }, { status: 500 });
        }

        console.log("[notify-reservation] email queued ok, reservation:", reservationId);

        try {
          await Promise.all([
            sendPushToAudience("admin", {
              title: "🆕 Nouvelle réservation",
              body: `${reservation.nom} · ${reservation.depart} → ${reservation.arrivee}`,
              url: "/admin/dashboard",
              tag: `new-res-${reservationId}`,
              requireInteraction: true,
            }),
            sendPushToAudience("chauffeur", {
              title: "🚕 Nouvelle course en attente",
              body: `${reservation.nom} · ${reservation.depart} → ${reservation.arrivee}`,
              url: "/admin/dashboard",
              tag: `new-res-chauffeur-${reservationId}`,
              requireInteraction: true,
            }),
          ]);
        } catch (e) {
          console.error("[push] notify failed", e);
        }

        return Response.json({ success: true });
      },
    },
  },
});
