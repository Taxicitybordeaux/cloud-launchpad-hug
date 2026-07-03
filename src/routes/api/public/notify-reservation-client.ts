import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizePushLang } from "@/lib/push-i18n.server";

const TEMPLATE_NAME = "reservation-client-confirmation";

const schema = z.object({
  lang: z.enum(["fr", "en", "es", "pt", "it", "ar"]).optional(),
  nom: z.string().min(1).max(100),
  email: z.string().email().max(255),
  pickup_datetime: z.string().min(1).max(50),
  depart: z.string().min(1).max(300),
  arrivee: z.string().min(1).max(300),
  passagers: z.union([z.number(), z.string()]).optional(),
  bagages: z.union([z.number(), z.string()]).optional(),
  reservation_id: z.string().uuid(),
  suivi_url: z.string().url().optional(),
});

export const Route = createFileRoute("/api/public/notify-reservation-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID();
        const log = (event: string, extra: Record<string, unknown> = {}) =>
          console.log(`[notify-reservation-client] ${event}`, JSON.stringify({ requestId, ...extra }));

        log("incoming");

        const { getTaxiSupabaseAdmin, getTaxiSupabaseConfig } = await import("@/lib/taxi-supabase.server");
        const { serviceKey } = getTaxiSupabaseConfig();
        if (!serviceKey) {
          log("error", { stage: "config" });
          return Response.json({ error: "config" }, { status: 500 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "json" }, { status: 400 });
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          log("error", { stage: "validation", issues: parsed.error.flatten() });
          return Response.json({ error: "invalid" }, { status: 400 });
        }
        const data = { ...parsed.data, lang: normalizePushLang(parsed.data.lang) };

        // Anti-relay : la résa existe et l'email correspond
        const supabase = getTaxiSupabaseAdmin();
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
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        if (!reservation.email || reservation.email.trim().toLowerCase() !== data.email.trim().toLowerCase()) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const idempotencyKey = `client-confirm-${data.reservation_id}`;
        const EMAIL_BRIDGE_URL = "https://taxicitybordeaux.fr/lovable/email/transactional/send";

        log("sending", { bridge: EMAIL_BRIDGE_URL, template: TEMPLATE_NAME });

        try {
          const sendResp = await fetch(EMAIL_BRIDGE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              templateName: TEMPLATE_NAME,
              recipientEmail: data.email,
              idempotencyKey,
              templateData: data,
            }),
          });

          if (!sendResp.ok) {
            const errBody = await sendResp.text().catch(() => "");
            log("error", { stage: "send", status: sendResp.status, body: errBody });
            return Response.json({ error: "send_failed", status: sendResp.status }, { status: 500 });
          }

          log("queued");
          return Response.json({ success: true });
        } catch (err) {
          log("error", { stage: "fetch", message: (err as Error).message });
          return Response.json({ error: "fetch_failed" }, { status: 500 });
        }
      },
    },
  },
});
