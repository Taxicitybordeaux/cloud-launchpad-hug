import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron tick (every 15 min): for each accepted/pending reservation whose
 * pickup_datetime is within the next 23h-25h window and that has not yet
 * received a J-1 reminder, send a client push notification and mark
 * reminder_j1_sent_at = now() to prevent re-sending.
 *
 * Auth: Supabase anon/publishable key in `apikey` header (canonical
 * /api/public cron auth, same as recurring-rides-tick).
 */
export const Route = createFileRoute("/api/public/hooks/ride-reminders-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!authHeader || !expected || authHeader !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToAudience } = await import("@/lib/push.server");

        const now = new Date();
        const windowStart = new Date(now.getTime() + 23 * 3600 * 1000);
        const windowEnd = new Date(now.getTime() + 25 * 3600 * 1000);

        const { data: rides, error } = await supabaseAdmin
          .from("reservations")
          .select("id, nom, client_name, depart, arrivee, destination, pickup_datetime")
          .in("status", ["accepted", "pending", "nouvelle"])
          .gte("pickup_datetime", windowStart.toISOString())
          .lte("pickup_datetime", windowEnd.toISOString())
          .is("reminder_j1_sent_at" as any, null);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const sent: string[] = [];
        for (const r of (rides ?? []) as any[]) {
          const clientName = r.client_name || r.nom || "Client";
          const dest = r.arrivee || r.destination || "—";
          let heure = "";
          try {
            heure = new Date(r.pickup_datetime).toLocaleString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Paris",
            });
          } catch {
            /* noop */
          }
          try {
            await sendPushToAudience(
              "client",
              {
                title: "📅 Rappel : votre course est demain",
                body: `${clientName}, votre taxi vers ${dest}${heure ? ` à ${heure}` : ""}.`,
                url: `/reservation/${r.id}`,
                tag: `client-j1-${r.id}`,
                requireInteraction: false,
                data: { reservation_id: r.id, kind: "j1_reminder" },
              },
              { reservationId: r.id },
            );
            await supabaseAdmin
              .from("reservations")
              .update({ reminder_j1_sent_at: now.toISOString() } as any)
              .eq("id", r.id);
            sent.push(r.id);
          } catch (e) {
            console.warn("[ride-reminders-tick] failed for", r.id, e);
          }
        }

        return Response.json({ ok: true, candidates: rides?.length ?? 0, sent: sent.length, ids: sent });
      },
    },
  },
});
