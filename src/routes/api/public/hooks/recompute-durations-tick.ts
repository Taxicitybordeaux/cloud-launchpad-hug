import { createFileRoute } from "@tanstack/react-router";
import { roundSecondsToMinute } from "@/lib/duration";

/**
 * Cron tick (toutes les 5 min) : recalcule `reservations.duree_s` à la minute
 * près pour les anciennes réservations, par petits lots (10 lignes/appel),
 * afin d'éviter les timeouts serveur et de respecter les quotas Google Maps.
 *
 * Reprise garantie : chaque ligne traitée est marquée `duree_recomputed_at = now()`
 * (succès, skip ou erreur). L'appel suivant reprend automatiquement là où
 * l'appel précédent s'est arrêté, sans doublon ni perte.
 *
 * Auth : Supabase anon/publishable key en header `apikey` (même convention que
 * les autres hooks /api/public).
 */

const BATCH_SIZE = 10;
const GOOG_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOG_DIRECTIONS = "https://maps.googleapis.com/maps/api/directions/json";

async function geocodeOnce(
  query: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `${GOOG_GEOCODE}?address=${encodeURIComponent(query)}&region=fr&language=fr&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const loc = json?.results?.[0]?.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
  return { lat: loc.lat, lng: loc.lng };
}

async function fastestDurationSec(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  apiKey: string,
): Promise<number | null> {
  const params = new URLSearchParams({
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    alternatives: "true",
    mode: "driving",
    region: "fr",
    language: "fr",
    departure_time: "now",
    traffic_model: "best_guess",
    key: apiKey,
  });
  const res = await fetch(`${GOOG_DIRECTIONS}?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const routes = Array.isArray(json?.routes) ? json.routes : [];
  if (!routes.length) return null;
  let best = Infinity;
  for (const route of routes) {
    const legs = route?.legs ?? [];
    const s = legs.reduce(
      (sum: number, l: any) =>
        sum + (l?.duration_in_traffic?.value ?? l?.duration?.value ?? 0),
      0,
    );
    if (s > 0 && s < best) best = s;
  }
  return Number.isFinite(best) ? best : null;
}

export const Route = createFileRoute("/api/public/hooks/recompute-durations-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!authHeader || !expected || authHeader !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          return Response.json({ ok: false, reason: "missing_api_key" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rows, error } = await supabaseAdmin
          .from("reservations")
          .select("id,depart,arrivee,destination,duree_s,status,pickup_datetime")
          .is("duree_recomputed_at" as any, null)
          .not("status", "in", "(completed,cancelled,annulee)")
          .order("pickup_datetime", { ascending: false })
          .limit(BATCH_SIZE);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const results: {
          id: string;
          status: "updated" | "unchanged" | "skipped" | "error";
          previous_duree_s: number | null;
          new_duree_s: number | null;
          reason?: string;
        }[] = [];

        for (const row of (rows ?? []) as any[]) {
          const stamp = new Date().toISOString();
          try {
            const depart = (row.depart ?? "").trim();
            const arrivee = (row.arrivee ?? row.destination ?? "").trim();
            if (!depart || !arrivee) {
              await supabaseAdmin
                .from("reservations")
                .update({ duree_recomputed_at: stamp } as any)
                .eq("id", row.id);
              results.push({
                id: row.id,
                status: "skipped",
                previous_duree_s: row.duree_s ?? null,
                new_duree_s: null,
                reason: "missing_address",
              });
              continue;
            }

            const [from, to] = await Promise.all([
              geocodeOnce(depart, apiKey),
              geocodeOnce(arrivee, apiKey),
            ]);
            if (!from || !to) {
              await supabaseAdmin
                .from("reservations")
                .update({ duree_recomputed_at: stamp } as any)
                .eq("id", row.id);
              results.push({
                id: row.id,
                status: "skipped",
                previous_duree_s: row.duree_s ?? null,
                new_duree_s: null,
                reason: "geocode_failed",
              });
              continue;
            }

            const rawSec = await fastestDurationSec(from, to, apiKey);
            if (!rawSec) {
              await supabaseAdmin
                .from("reservations")
                .update({ duree_recomputed_at: stamp } as any)
                .eq("id", row.id);
              results.push({
                id: row.id,
                status: "skipped",
                previous_duree_s: row.duree_s ?? null,
                new_duree_s: null,
                reason: "directions_failed",
              });
              continue;
            }

            const newDureeS = roundSecondsToMinute(rawSec);
            const oldDureeS = row.duree_s ?? 0;
            const diffMin = Math.abs(newDureeS - oldDureeS) / 60;

            if (diffMin < 1) {
              await supabaseAdmin
                .from("reservations")
                .update({ duree_recomputed_at: stamp } as any)
                .eq("id", row.id);
              results.push({
                id: row.id,
                status: "unchanged",
                previous_duree_s: oldDureeS,
                new_duree_s: newDureeS,
              });
            } else {
              const { error: upErr } = await supabaseAdmin
                .from("reservations")
                .update({ duree_s: newDureeS, duree_recomputed_at: stamp } as any)
                .eq("id", row.id);
              if (upErr) throw new Error(upErr.message);
              results.push({
                id: row.id,
                status: "updated",
                previous_duree_s: oldDureeS,
                new_duree_s: newDureeS,
              });
            }
          } catch (e) {
            // Marque quand même comme traitée pour ne pas bloquer la file.
            try {
              await supabaseAdmin
                .from("reservations")
                .update({ duree_recomputed_at: new Date().toISOString() } as any)
                .eq("id", row.id);
            } catch {
              /* noop */
            }
            results.push({
              id: row.id,
              status: "error",
              previous_duree_s: row.duree_s ?? null,
              new_duree_s: null,
              reason: e instanceof Error ? e.message : String(e),
            });
          }

          // Rate-limit léger pour respecter Google Maps.
          await new Promise((r) => setTimeout(r, 120));
        }

        const counts = results.reduce(
          (acc, r) => {
            acc[r.status] = (acc[r.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        console.log(
          `[recompute-durations-tick] processed=${results.length}`,
          counts,
        );

        return Response.json({
          ok: true,
          processed: results.length,
          counts,
          results,
        });
      },
    },
  },
});
