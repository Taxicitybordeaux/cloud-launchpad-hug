import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import * as React from "react";
import { render } from "@react-email/components";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Taxi City Bordeaux";
const SENDER_DOMAIN = "notify.taxicitybordeaux.fr";
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
        const requestId = crypto.randomUUID();
        const log = (event: string, extra: Record<string, unknown> = {}) =>
          console.log(`[notify-reservation-client] ${event}`, JSON.stringify({ requestId, ...extra }));

        log("incoming", {
          url: request.url,
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
        });

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          log("error", { stage: "cfg" });
          return Response.json({ error: "cfg" }, { status: 500 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          log("error", { stage: "json" });
          return Response.json({ error: "json" }, { status: 400 });
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          log("error", { stage: "validation", issues: parsed.error.flatten() });
          return Response.json({ error: "invalid" }, { status: 400 });
        }
        const data = parsed.data;

        const supabase = createClient(supabaseUrl, serviceKey);

        // Vérifie que la résa existe et que l'email correspond — anti-relay
        const { data: reservation, error: lookupError } = await supabase
          .from("reservations")
          .select("email")
          .eq("id", data.reservation_id)
          .maybeSingle();
        if (lookupError) {
          log("error", { stage: "lookup", message: lookupError.message });
          return Response.json({ error: "lookup" }, { status: 500 });
        }
        if (!reservation) {
          log("error", { stage: "not_found", reservation_id: data.reservation_id });
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        if (!reservation.email || reservation.email.trim().toLowerCase() !== data.email.trim().toLowerCase()) {
          log("error", { stage: "forbidden", reservation_id: data.reservation_id });
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const tpl = TEMPLATES[TEMPLATE_NAME];
        if (!tpl) {
          log("error", { stage: "tpl_missing" });
          return Response.json({ error: "tpl" }, { status: 500 });
        }

        const recipient = data.email;
        const messageId = crypto.randomUUID();
        const idempotencyKey = `client-confirm-${data.reservation_id}`;

        const { error: logError } = await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: "pending",
        });
        if (logError) {
          if ((logError as any).code === "23505") {
            log("deduped", { idempotencyKey });
            return Response.json({ success: true, deduped: true });
          }
          log("error", { stage: "log_insert", message: (logError as any).message });
          return Response.json({ error: "log" }, { status: 500 });
        }

        const element = React.createElement(tpl.component, data);
        const html = await render(element);
        const text = await render(element, { plainText: true });
        const subject = typeof tpl.subject === "function" ? tpl.subject(data as any) : tpl.subject;

        // Unsubscribe token
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

        // URL hardcodée vers la prod — jamais dérivée de la requête entrante
        // + Authorization: Bearer <serviceKey> comme send-course-email.ts
        const EMAIL_BRIDGE_URL = "https://taxicitybordeaux.fr/lovable/email/transactional/send";
        log("sending", { bridge: EMAIL_BRIDGE_URL, messageId });

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
          log("error", { stage: "send", status: sendResp.status, body: errBody });
          await supabase
            .from("email_send_log")
            .update({ status: "failed", error_message: `send ${sendResp.status}: ${errBody}` })
            .eq("message_id", messageId);
          return Response.json({ error: "send_failed" }, { status: 500 });
        }

        await supabase.from("email_send_log").update({ status: "sent" }).eq("message_id", messageId);

        log("sent", { messageId });
        return Response.json({ success: true, messageId });
      },
    },
  },
});
