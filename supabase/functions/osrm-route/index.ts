// supabase/functions/osrm-route/index.ts
// Edge Function : route OSRM avec règle rocade A630 pour Bordeaux.
// - Appel OSRM public côté serveur (pas de CORS, pas de rate-limit côté client)
// - Waypoint A630 (44.8066, -0.6297) ajouté quand les 2 points sont dans la bbox métropole
//   et que la distance à vol d'oiseau dépasse 5 km
// - alternatives=3, sélectionne la route la plus longue (km)
// - Timeout 7 s, retourne { distanceKm, durationSec, coords:[lat,lng][] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const ROCADE_WAYPOINT = { lat: 44.8066, lng: -0.6297 };

// BBox Bordeaux Métropole : lat 44.70–45.05, lng -0.85–-0.30
const BBOX = { latMin: 44.70, latMax: 45.05, lngMin: -0.85, lngMax: -0.30 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function inBbox(lat: number, lng: number) {
  return lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function pickLongest(routes: any[]) {
  if (!Array.isArray(routes) || !routes.length) return null;
  return routes.reduce((best, r) => ((r?.distance ?? 0) > (best?.distance ?? -1) ? r : best), routes[0]);
}

async function callOsrm(coords: Array<{ lat: number; lng: number }>, alternatives = 3) {
  const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    alternatives: String(alternatives),
  });
  const url = `${OSRM_ROUTE_URL}/${coordStr}?${params}`;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.code !== "Ok") return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const from = { lat: Number(body.from_lat), lng: Number(body.from_lng) };
    const to = { lat: Number(body.to_lat), lng: Number(body.to_lng) };

    if ([from.lat, from.lng, to.lat, to.lng].some((n) => !Number.isFinite(n))) {
      return new Response(JSON.stringify({ error: true, message: "Coordonnées invalides" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const directKm = haversineKm(from, to);
    const useRocade = directKm > 5 && inBbox(from.lat, from.lng) && inBbox(to.lat, to.lng);

    // 1er essai : via rocade si éligible
    let json = useRocade ? await callOsrm([from, ROCADE_WAYPOINT, to], 1) : null;
    let route = json ? pickLongest(json.routes ?? []) : null;

    // Fallback : route directe avec alternatives=3 + pick longest
    if (!route) {
      json = await callOsrm([from, to], 3);
      route = json ? pickLongest(json.routes ?? []) : null;
    }

    if (!route) {
      return new Response(JSON.stringify({ error: true, message: "Aucun itinéraire" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const coords: [number, number][] = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    );

    return new Response(
      JSON.stringify({
        distanceKm: (route.distance ?? 0) / 1000,
        durationSec: route.duration ?? 0,
        coords,
        via_rocade: useRocade,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: true, message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
