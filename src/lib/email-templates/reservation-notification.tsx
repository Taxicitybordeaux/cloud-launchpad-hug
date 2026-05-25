import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "@react-email/components";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendPushToReservation } from "@/lib/push.server";
import { assertSuiviId } from "@/lib/suivi-id";

const SITE_NAME = "Taxi City Bordeaux";
const SENDER_DOMAIN = "notify.taxicitybordeaux.fr";
const FROM_DOMAIN = "taxicitybordeaux.fr";
const TEMPLATE_NAME = "reservation-client-confirmation";

const schema = z.object({
  lang: z.enum(["fr", "en", "es", "it", "ar"]).optional(),
  nom: z.string().min(1).max(100),
  email: z.string().email().max(255),
  pickup_datetime: z.string().min(1).max(50),
  depart: z.string().min(1).max(300),
  arrivee: z.string().min(1).max(300),
  passagers: z.union([z.number(), z.string()]).optional(),
  bagages: z.union([z.number(), z.string()]).optional(),
  reservation_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/notify-reservation-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) return Response.json({ error: "cfg" }, { status: 500 });

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "json" }, { status: 400 });
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
        const data = parsed.data;

        const supabase = createClient(supabaseUrl, serviceKey);

        // Verify the reservation exists AND the supplied email matches the stored one.
        // Also fetch suivi_id to build the client tracking URL for the push notification.
        // Prevents using this endpoint as an open email relay.
        const { data: reservation, error: lookupError } = await supabase
          .from("reservations")
          .select("email, suivi_id")
          .eq("id", data.reservation_id)
          .maybeSingle();
        if (lookupError) return Response.json({ error: "lookup" }, { status: 500 });
        if (!reservation) return Response.json({ error: "not_found" }, { status: 404 });
        if (!reservation.email || reservation.email.trim().toLowerCase() !== data.email.trim().toLowerCase()) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const tpl = TEMPLATES[TEMPLATE_NAME];
        if (!tpl) return Response.json({ error: "tpl" }, { status: 500 });

        const recipient = data.email;
        const messageId = crypto.randomUUID();
        const idempotencyKey = `client-confirm-${data.reservation_id}`;

        // Idempotency gate: insert the log row FIRST. The unique index on
        // idempotency_key (where status <> 'failed') will reject duplicates
        // atomically, so a double-click cannot trigger two sends.
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

        const element = React.createElement(tpl.component, data);
        const html = await render(element);
        const text = await render(element, { plainText: true });
        const subject = typeof tpl.subject === "function" ? tpl.subject(data as any) : tpl.subject;

        const normalized = recipient.toLowerCase();
        let unsubscribeToken = "";
        const { data: existing } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token, used_at")
          .eq("email", normalized)
          .maybeSingle();
        if (existing && !existing.used_at) unsubscribeToken = existing.token;
        else {
          const bytes = new Uint8Array(32);
          crypto.getRandomValues(bytes);
          unsubscribeToken = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          await supabase
            .from("email_unsubscribe_tokens")
            .upsert({ token: unsubscribeToken, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
          const { data: stored } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", normalized)
            .maybeSingle();
          if (stored?.token) unsubscribeToken = stored.token;
        }

        const { error } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
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
            queued_at: new Date().toISOString(),
          },
        });
        if (error) {
          // Mark as failed so the unique index allows a retry.
          await supabase
            .from("email_send_log")
            .update({ status: "failed", error_message: "enqueue" })
            .eq("message_id", messageId);
          return Response.json({ error: "enqueue" }, { status: 500 });
        }

        // Fire-and-forget push to the client so they can track their ride.
        // Uses suivi_id (UUID v4) — NOT the old tracking_id.
        try {
          const suiviId = assertSuiviId(reservation.suivi_id);
          await sendPushToReservation(data.reservation_id, {
            title: "✅ Réservation confirmée",
            body: `${data.depart} → ${data.arrivee} · ${data.pickup_datetime}`,
            url: `/suivi/${suiviId}`,
            tag: `confirm-${data.reservation_id}`,
            requireInteraction: false,
          });
        } catch (e) {
          // Push is best-effort: log but never block the email response.
          console.error("[push] client notify failed", e);
        }

        return Response.json({ success: true });
      },
    },
  },
});
