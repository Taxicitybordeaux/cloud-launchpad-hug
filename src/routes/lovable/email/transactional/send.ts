import * as React from "react";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Taxi City Bordeaux";
const SENDER_DOMAIN = "notify.taxicitybordeaux.fr";
const FROM_DOMAIN = "taxicitybordeaux.fr";

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";
  return `${localPart[0]}***@${domain}`;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/lovable/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = "https://auiagkpdpnfqxfngisfc.supabase.co";
        const supabaseServiceKey = process.env.TAXI_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        const lovableApiKey = process.env.LOVABLE_API_KEY ?? "";

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // ── Auth ──────────────────────────────────────────────────────────────
        // Accepts any of:
        //   1. X-Admin-Secret: <LOVABLE_API_KEY>   ← PIN-based admin (no Supabase session)
        //   2. Authorization: Bearer <LOVABLE_API_KEY>
        //   3. Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
        //   4. Authorization: Bearer <valid Supabase user JWT>
        const adminSecretHeader = request.headers.get("X-Admin-Secret");
        const authHeader = request.headers.get("Authorization");

        let authorized = false;

        if (adminSecretHeader) {
          // Path 1 — X-Admin-Secret header (bridge from PIN admin)
          authorized = lovableApiKey.length > 0 && adminSecretHeader === lovableApiKey;
        } else if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice("Bearer ".length).trim();
          if (token === supabaseServiceKey || (lovableApiKey && token === lovableApiKey)) {
            // Path 2 & 3 — service role key or LOVABLE_API_KEY as bearer
            authorized = true;
          } else {
            // Path 4 — Supabase user JWT
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser(token);
            authorized = !error && !!user;
          }
        }

        if (!authorized) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        // ─────────────────────────────────────────────────────────────────────

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let templateName: string;
        let recipientEmail: string;
        let idempotencyKey: string;
        let messageId: string;
        let templateData: Record<string, any> = {};
        try {
          const body = await request.json();
          templateName = body.templateName || body.template_name;
          recipientEmail = body.recipientEmail || body.recipient_email;
          messageId = crypto.randomUUID();
          idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId;
          if (body.templateData && typeof body.templateData === "object") {
            templateData = body.templateData;
          }
        } catch {
          return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }

        if (!templateName) {
          return Response.json({ error: "templateName is required" }, { status: 400 });
        }

        const template = TEMPLATES[templateName];
        if (!template) {
          console.error("Template not found in registry", { templateName });
          return Response.json(
            { error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}` },
            { status: 404 },
          );
        }

        const effectiveRecipient = template.to || recipientEmail;
        if (!effectiveRecipient) {
          return Response.json(
            { error: "recipientEmail is required (unless the template defines a fixed recipient)" },
            { status: 400 },
          );
        }

        const { data: suppressed, error: suppressionError } = await supabase
          .from("suppressed_emails")
          .select("id")
          .eq("email", effectiveRecipient.toLowerCase())
          .maybeSingle();

        if (suppressionError) {
          console.error("Suppression check failed", { error: suppressionError });
          return Response.json({ error: "Failed to verify suppression status" }, { status: 500 });
        }

        if (suppressed) {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: "suppressed",
          });
          return Response.json({ success: false, reason: "email_suppressed" });
        }

        const normalizedEmail = effectiveRecipient.toLowerCase();
        let unsubscribeToken: string;

        const { data: existingToken, error: tokenLookupError } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token, used_at")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (tokenLookupError) {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: "failed",
            error_message: "Failed to look up unsubscribe token",
          });
          return Response.json({ error: "Failed to prepare email" }, { status: 500 });
        }

        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token;
        } else if (!existingToken) {
          unsubscribeToken = generateToken();
          const { error: tokenError } = await supabase
            .from("email_unsubscribe_tokens")
            .upsert(
              { token: unsubscribeToken, email: normalizedEmail },
              { onConflict: "email", ignoreDuplicates: true },
            );

          if (tokenError) {
            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: "failed",
              error_message: "Failed to create unsubscribe token",
            });
            return Response.json({ error: "Failed to prepare email" }, { status: 500 });
          }

          const { data: storedToken, error: reReadError } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", normalizedEmail)
            .maybeSingle();

          if (reReadError || !storedToken) {
            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: "failed",
              error_message: "Failed to confirm unsubscribe token storage",
            });
            return Response.json({ error: "Failed to prepare email" }, { status: 500 });
          }
          unsubscribeToken = storedToken.token;
        } else {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: "suppressed",
            error_message: "Unsubscribe token used but email missing from suppressed list",
          });
          return Response.json({ success: false, reason: "email_suppressed" });
        }

        const element = React.createElement(template.component, templateData);
        const html = await render(element);
        const plainText = await render(element, { plainText: true });

        const resolvedSubject =
          typeof template.subject === "function" ? template.subject(templateData) : template.subject;

        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: effectiveRecipient,
          status: "pending",
        });

        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: effectiveRecipient,
            from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
            reply_to: "taxi.city033@gmail.com",
            sender_domain: SENDER_DOMAIN,
            subject: resolvedSubject,
            html,
            text: plainText,
            purpose: "transactional",
            label: templateName,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          console.error("Failed to enqueue email", JSON.stringify({ error: enqueueError, templateName }));
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: "failed",
            error_message: "Failed to enqueue email",
          });
          return Response.json({ error: "Failed to enqueue email" }, { status: 500 });
        }

        console.log("Transactional email enqueued", {
          templateName,
          recipient_redacted: redactEmail(effectiveRecipient),
        });

        return Response.json({ success: true, queued: true });
      },
    },
  },
});
