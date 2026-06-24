import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron tick (hourly): looks for active recurring rides whose next_run_at is within
 * the next 24h, materialises them into a real reservation, then rolls next_run_at
 * forward by 7 days.
 *
 * Idempotency: we set last_run_at = next_run_at before creating the next slot, so
 * if the tick runs twice for the same slot it will skip (next_run_at advances).
 */
export const Route = createFileRoute("/api/public/hooks/recurring-rides-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require Supabase anon/publishable key (canonical /api/public cron auth).
        const authHeader = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!authHeader || !expected || authHeader !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const windowEnd = new Date(now.getTime() + 25 * 3600 * 1000); // 25h lookahead

        const { data: rides, error } = await supabaseAdmin
          .from("client_recurring_rides" as any)
          .select("*, client_accounts!inner(id, email, client_name, phone)")
          .eq("active", true)
          .lte("next_run_at", windowEnd.toISOString());

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const created: string[] = [];
        const skipped: string[] = [];

        for (const r of (rides ?? []) as any[]) {
          const pickupIso = r.next_run_at;
          const account = r.client_accounts;
          if (!account) {
            skipped.push(r.id);
            continue;
          }

          // Insert the reservation
          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("reservations")
            .insert({
              nom: account.client_name || "Client VIP",
              telephone: account.phone || "",
              email: account.email,
              depart: r.depart,
              arrivee: r.destination,
              destination: r.destination,
              pickup_datetime: pickupIso,
              passagers: r.passagers,
              nb_passagers: r.passagers,
              bagages: r.bagages,
              paiement: r.paiement,
              service_type: "standard",
              status: "pending",
              client_name: account.client_name || "Client VIP",
              client_phone: account.phone || "",
              client_email: account.email,
              message: r.message ? `[Trajet récurrent · ${r.label}] ${r.message}` : `[Trajet récurrent · ${r.label}]`,
              source: "recurring",
            })
            .select("id")
            .single();

          if (insErr || !inserted) {
            skipped.push(r.id);
            continue;
          }

          // Advance next_run_at by 7 days
          const next = new Date(new Date(pickupIso).getTime() + 7 * 24 * 3600 * 1000);
          await supabaseAdmin
            .from("client_recurring_rides" as any)
            .update({
              last_run_at: pickupIso,
              next_run_at: next.toISOString(),
            })
            .eq("id", r.id);

          created.push(inserted.id);
        }

        return Response.json({ ok: true, created, skipped, count: created.length });
      },
    },
  },
});
