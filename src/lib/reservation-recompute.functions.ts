// Recalcul serveur de `reservations.duree_s` (à la minute près) — corrige les
// anciennes réservations dont la durée avait été calculée sur le trajet le
// plus long via rocade (inflation de 60-100%). Idempotent : ne met à jour la
// ligne que si la nouvelle valeur diffère d'au moins 1 minute.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roundSecondsToMinute } from "@/lib/duration";

const GOOG_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOG_DIRECTIONS = "https://maps.googleapis.com/maps/api/directions/json";

async function geocodeOnce(query: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
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
      (sum: number, l: any) => sum + (l?.duration_in_traffic?.value ?? l?.duration?.value ?? 0),
      0,
    );
    if (s > 0 && s < best) best = s;
  }
  return Number.isFinite(best) ? best : null;
}

export const recomputeReservationDuration = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { ok: false, reason: "missing_api_key" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .select("id,depart,arrivee,destination,duree_s,status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, reason: "not_found" as const };
    if (row.status === "completed" || row.status === "cancelled" || row.status === "annulee") {
      return { ok: true, changed: false, duree_s: row.duree_s ?? null, skipped: "final_status" as const };
    }

    const depart = (row.depart ?? "").trim();
    const arrivee = (row.arrivee ?? row.destination ?? "").trim();
    if (!depart || !arrivee) return { ok: false, reason: "missing_address" as const };

    const [from, to] = await Promise.all([geocodeOnce(depart, apiKey), geocodeOnce(arrivee, apiKey)]);
    if (!from || !to) return { ok: false, reason: "geocode_failed" as const };

    const rawSec = await fastestDurationSec(from, to, apiKey);
    if (!rawSec) return { ok: false, reason: "directions_failed" as const };

    const newDureeS = roundSecondsToMinute(rawSec);
    const oldDureeS = row.duree_s ?? 0;
    const diffMin = Math.abs(newDureeS - oldDureeS) / 60;
    if (diffMin < 1) {
      return { ok: true, changed: false, duree_s: oldDureeS };
    }

    const { error: upErr } = await supabaseAdmin
      .from("reservations")
      .update({ duree_s: newDureeS })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, changed: true, duree_s: newDureeS, previous_duree_s: oldDureeS };
  });
