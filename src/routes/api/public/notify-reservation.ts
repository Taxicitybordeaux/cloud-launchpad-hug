import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "@react-email/components";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendPushToAudience } from "@/lib/push.server";

const SITE_NAME = "Taxi City Bordeaux";
const SENDER_DOMAIN = "notify.taxicitybordeaux.fr";
const TEMPLATE_NAME = "new-reservation-admin";
const INTERNAL_NOTIFY_SECRET = "taxi-city-reservation-trigger-v1";

const schema = z.object({
  reservation_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/notify-reservation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
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

        const supabase = createClient(supabaseUrl, serviceKey);

        const { data: reservation, error: lookupError } = await supabase
          .from("reservations")
          .select(
            "id, nom, telephone, email, pickup_datetime, depart, arrivee, passagers, bagages, service_type, message",
          )
          .eq("id", reservationId)
          .maybeSingle();
        if (lookupError) return Response.json({ error: "lookup" }, { status: 500 });
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
        const messageId = crypto.randomUUID();
        const idempotencyKey = `reservation-${reservationId}`;

        const { error: logError } = await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: "pending",
          idempotency_key: idempotencyKey,
        });
        if (logError) {
          if ((logError as any).code === "23505") {
            return Response.json({ success: true, deduped: true });
          }
          return Response.json({ error: "log" }, { status: 500 });
        }

        const element = React.createElement(template.component, data);
        const html = await render(element);
        const text = await render(element, { plainText: true });
        const subject =
          typeof template.subject === "function" ? template.subject(data as any) : template.subject;

        // Unsubscribe token
        const normalized = recipient.toLowerCase();
        let unsubscribeToken: string;
        const { data: existing } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token, used_at")
          .eq("email", normalized)
          .maybeSingle();
        if (existing && !existing.used_at) {
          unsubscribeToken = existing.token;
        } else {
          const bytes = new Uint8Array(32);
          crypto.getRandomValues(bytes);
          unsubscribeToken = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          await supabase
            .from("email_unsubscribe_tokens")
            .upsert(
              { token: unsubscribeToken, email: normalized },
              { onConflict: "email", ignoreDuplicates: true },
            );
          const { data: stored } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", normalized)
            .maybeSingle();
          if (stored?.token) unsubscribeToken = stored.token;
        }

        // Toujours pointer vers la prod, jamais vers l'origine de la requête entrante
        // (qui peut être l'URL de preview Lovable si le client est sur preview).
        // On ajoute Authorization: Bearer <serviceKey> exactement comme send-course-email.ts.
        const EMAIL_BRIDGE_URL = "https://taxicitybordeaux.fr/lovable/email/transactional/send";
        console.log("[notify-reservation] → bridge:", EMAIL_BRIDGE_URL, "messageId:", messageId);

        const sendResp = await fetch(EMAIL_BRIDGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            message_id: messageId,
            to: recipient,
            from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
            reply_to: "taxi.city033@gmail.com",
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: "transactional",
            label: TEMPLATE_NAME,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
          }),
        });

        if (!sendResp.ok) {
          const errBody = await sendResp.text().catch(() => "");
          console.error("[notify-reservation] bridge error", sendResp.status, errBody);
          await supabase
            .from("email_send_log")
            .update({ status: "failed", error_message: `send ${sendResp.status}: ${errBody}` })
            .eq("message_id", messageId);
          return Response.json({ error: "send_failed" }, { status: 500 });
        }

        await supabase
          .from("email_send_log")
          .update({ status: "sent" })
          .eq("message_id", messageId);

        console.log("[notify-reservation] sent ok, messageId:", messageId);

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
