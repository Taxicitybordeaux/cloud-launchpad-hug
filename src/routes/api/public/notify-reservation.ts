import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { getPushClientStrings, normalizePushLang } from "@/lib/push-i18n.server";

const TEMPLATE_NAME = "new-reservation-admin";
const INTERNAL_NOTIFY_SECRET = "taxi-city-reservation-trigger-v1";

const schema = z.object({
  reservation_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/notify-reservation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ getTaxiSupabaseAdmin, getTaxiSupabaseConfig }, { sendPushToAudience }] = await Promise.all([
          import("@/lib/taxi-supabase.server"),
          import("@/lib/push.server"),
        ]);
        let serviceKey = "";
        try {
          const cfg = getTaxiSupabaseConfig();
          serviceKey = cfg.serviceKey;
          console.log(
            "[notify-reservation] backend:",
            cfg.targetRef,
            "key:",
            cfg.selectedKeyName,
            "keyRef:",
            cfg.selectedRef,
          );
        } catch (err) {
          console.error("[notify-reservation] backend config failed", err);
        }

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

        const supabase = getTaxiSupabaseAdmin();

        const BASE_COLUMNS =
          "id, nom, client_name, telephone, client_phone, email, pickup_datetime, depart, arrivee, destination, passagers, bagages, service_type, suivi_id, client_account_id";

        let reservation: any = null;
        let lookupError: any = null;
        {
          // On tente d'abord avec la colonne "lang" (préférence de langue du
          // client au moment de la résa). Si la migration n'a pas encore été
          // appliquée, Postgres renvoie 42703 (colonne inconnue) → on retombe
          // sur la requête sans "lang" et on traduit en français par défaut.
          const withLang = await supabase
            .from("reservations")
            .select(`${BASE_COLUMNS}, lang`)
            .eq("id", reservationId)
            .maybeSingle();
          if (withLang.error && (withLang.error as any).code === "42703") {
            console.warn(
              "[notify-reservation] colonne 'lang' absente sur reservations — fallback fr. " +
                "Ajouter une migration: ALTER TABLE reservations ADD COLUMN lang text DEFAULT 'fr';",
            );
            const withoutLang = await supabase
              .from("reservations")
              .select(BASE_COLUMNS)
              .eq("id", reservationId)
              .maybeSingle();
            reservation = withoutLang.data;
            lookupError = withoutLang.error;
          } else {
            reservation = withLang.data;
            lookupError = withLang.error;
          }
        }
        if (lookupError) {
          console.error("[notify-reservation] lookupError:", JSON.stringify(lookupError));
          return Response.json({ error: "lookup" }, { status: 500 });
        }
        if (!reservation) return Response.json({ error: "not_found" }, { status: 404 });

        const data = {
          ...reservation,
          lang: normalizePushLang((reservation as any).lang),
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

        let emailQueued = false;
        try {
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

          emailQueued = sendResp.ok;
          if (!sendResp.ok) {
            const errBody = await sendResp.text().catch(() => "");
            console.error("[notify-reservation] bridge error", sendResp.status, errBody);
          } else {
            console.log("[notify-reservation] email queued ok, reservation:", reservationId);
          }
        } catch (emailErr) {
          console.error("[notify-reservation] email bridge threw", emailErr);
        }

        // Push chauffeur — envoyé ici (côté serveur, à la création de
        // la résa) pour ne plus dépendre d'un onglet dashboard ouvert.
        const clientName = reservation.client_name || reservation.nom || "Client";
        const trajet = `${reservation.depart} → ${reservation.arrivee || reservation.destination || "—"}`;
        try {
          const chauffeurResult = await sendPushToAudience("chauffeur", {
            title: "🚕 Nouvelle résa",
            body: `${clientName} — ${trajet}`,
            url: "/driver",
            tag: `chauffeur-res-${reservationId}`,
            requireInteraction: true,
          });
          console.log("[notify-reservation] push chauffeur:", JSON.stringify(chauffeurResult));
        } catch (pushErr) {
          console.error("[notify-reservation] push failed", pushErr);
          // On ne fait pas échouer la requête si le push échoue — l'email est déjà parti.
        }

        // Push CLIENT — accusé de réception "en attente de validation par le taxi"
        try {
          const clientLang = normalizePushLang((reservation as any).lang);
          const push = getPushClientStrings(clientLang);
          const suiviUrl = `/suivi/${(reservation as any).suivi_id || reservationId}`;
          const clientResult = await sendPushToAudience(
            "client",
            {
              title: push.pending_title,
              body: push.pending_body(trajet),
              url: suiviUrl,
              tag: `client-pending-${reservationId}`,
              requireInteraction: false,
              data: { reservation_id: reservationId, status: "pending" },
            },
            {
              reservationId,
              accountId: (reservation as any).client_account_id ?? undefined,
            },
          );
          console.log("[notify-reservation] push client:", JSON.stringify(clientResult), "lang:", clientLang);
        } catch (pushErr) {
          console.error("[notify-reservation] push client failed", pushErr);
        }

        return Response.json({ success: true, emailQueued });
      },
    },
  },
});
