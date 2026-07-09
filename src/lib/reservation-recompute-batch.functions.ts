// Recalcul en lot de `reservations.duree_s` par plage de dates / statuts.
// Rate-limité (série + pause) pour ne pas dépasser les quotas Google.
// Réservé à l'admin (protégé côté route par `_admin` / driver-only UI).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roundSecondsToMinute } from "@/lib/duration";

const GOOG_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOG_DIRECTIONS = "https://maps.googleapis.com/maps/api/directions/json";

async function geocodeOnce(query: string, apiKey: string) {
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
) {
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
      (sum: number, l: any) => sum + (l?.duration_in_traffic?.value ?? l?.duration?.value ?? 0),
      0,
    );
    if (s > 0 && s < best) best = s;
  }
  return Number.isFinite(best) ? best : null;
}

const InputSchema = z.object({
  from: z.string().optional(), // ISO date "YYYY-MM-DD"
  to: z.string().optional(),
  statuses: z.array(z.string()).optional(), // ex ["pending","accepted","en_route"]
  limit: z.number().int().min(1).max(500).optional(),
  dryRun: z.boolean().optional(),
});

export const recomputeReservationsBatch = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { ok: false, reason: "missing_api_key" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("reservations")
      .select("id,depart,arrivee,destination,duree_s,distance_km,status,pickup_datetime")
      .order("pickup_datetime", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.from) q = q.gte("pickup_datetime", data.from);
    if (data.to) q = q.lte("pickup_datetime", data.to + "T23:59:59.999Z");
    if (data.statuses && data.statuses.length > 0) q = q.in("status", data.statuses);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const results: Array<{
      id: string;
      status: "updated" | "unchanged" | "skipped" | "error";
      previous_duree_s: number | null;
      new_duree_s: number | null;
      reason?: string;
    }> = [];

    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    let errored = 0;

    for (const row of rows ?? []) {
      const depart = (row.depart ?? "").trim();
      const arrivee = ((row as any).arrivee ?? (row as any).destination ?? "").trim();
      if (!depart || !arrivee) {
        skipped++;
        results.push({
          id: row.id,
          status: "skipped",
          previous_duree_s: row.duree_s ?? null,
          new_duree_s: null,
          reason: "missing_address",
        });
        continue;
      }

      try {
        const [from, to] = await Promise.all([geocodeOnce(depart, apiKey), geocodeOnce(arrivee, apiKey)]);
        if (!from || !to) {
          skipped++;
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
          skipped++;
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
          unchanged++;
          results.push({
            id: row.id,
            status: "unchanged",
            previous_duree_s: oldDureeS,
            new_duree_s: newDureeS,
          });
        } else {
          if (!data.dryRun) {
            const { error: upErr } = await supabaseAdmin
              .from("reservations")
              .update({ duree_s: newDureeS })
              .eq("id", row.id);
            if (upErr) throw new Error(upErr.message);
          }
          updated++;
          results.push({
            id: row.id,
            status: "updated",
            previous_duree_s: oldDureeS,
            new_duree_s: newDureeS,
          });
        }
      } catch (e) {
        errored++;
        results.push({
          id: row.id,
          status: "error",
          previous_duree_s: row.duree_s ?? null,
          new_duree_s: null,
          reason: e instanceof Error ? e.message : String(e),
        });
      }

      // Petit délai pour ne pas hammer l'API Google (staying well under QPS limits)
      await new Promise((r) => setTimeout(r, 120));
    }

    return {
      ok: true,
      dryRun: !!data.dryRun,
      total: rows?.length ?? 0,
      updated,
      unchanged,
      skipped,
      errored,
      results,
    };
  });
