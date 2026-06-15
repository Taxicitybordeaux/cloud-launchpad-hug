// supabase/functions/osrm-route/index.ts
// Edge Function : route OSRM avec règle rocade A630 pour Bordeaux.
// - Appel OSRM public côté serveur (pas de CORS, pas de rate-limit côté client)
// - Waypoints A630 multiples ajoutés quand les 2 points sont dans la bbox métropole
//   ET que la distance à vol d'oiseau dépasse 3.5 km (abaissé depuis 5 km)
// - Route directe SANS alternatives (1 seule route via rocade, la plus précise)
// - Fallback route directe si rocade échoue
// - Timeout 8 s, retourne { distanceKm, durationSec, coords:[lat,lng][], via_rocade }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";

// Waypoints rocade A630 : plusieurs points réels pour guider OSRM sur la vraie rocade
// plutôt qu'un point unique qui peut induire des détours absurdes.
// Ordre : Nord-Ouest → Sud → Sud-Est (sens anti-horaire standard)
const ROCADE_WAYPOINTS: Array<{ lat: number; lng: number }> = [
  { lat: 44.872, lng: -0.645 }, // Échangeur Mérignac-Nord (A630 ↔ A10)
  { lat: 44.8066, lng: -0.6297 }, // Secteur Pessac / mi-rocade Ouest
  { lat: 44.778, lng: -0.567 }, // Échangeur Villenave d'Ornon / Sud
];

// BBox Bordeaux Métropole : lat 44.70–45.05, lng -0.85–-0.30
const BBOX = { latMin: 44.7, latMax: 45.05, lngMin: -0.85, lngMax: -0.3 };

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
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Calibration OSRM → distances réelles Bordeaux
// Buckets affinés pour le centre dense où OSRM sous-estime le plus.
function calibrateKm(rawKm: number): number {
  if (rawKm < 5) return rawKm * 1.12; // Centre dense, rues sinueuses
  if (rawKm < 12) return rawKm * 1.1; // Urbain élargi, boulevards
  if (rawKm < 25) return rawKm * 1.1; // Mixte rocade / périurbain
  if (rawKm < 60) return rawKm * 1.11; // Interurbain / autoroute courte
  return rawKm * 1.08; // Longue distance, OSRM précis
}

function calibrateSec(rawSec: number, rawKm: number): number {
  if (rawKm < 5) return rawSec * 1.12;
  if (rawKm < 12) return rawSec * 1.1;
  if (rawKm < 25) return rawSec * 1.1;
  if (rawKm < 60) return rawSec * 1.11;
  return rawSec * 1.08;
}

async function callOsrm(coords: Array<{ lat: number; lng: number }>, alternatives = 0): Promise<any | null> {
  const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    alternatives: String(alternatives),
  });
  const url = `${OSRM_ROUTE_URL}/${coordStr}?${params}`;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.code !== "Ok" || !Array.isArray(json.routes) || !json.routes.length) return null;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

// Choisit le meilleur waypoint de la rocade selon la position des 2 points.
// On garde uniquement les waypoints qui sont "entre" from et to géographiquement
// pour éviter les détours absurdes (ex: aller au Nord quand on va au Sud).
function selectRocadeWaypoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Array<{ lat: number; lng: number }> {
  const latMid = (from.lat + to.lat) / 2;
  const lngMid = (from.lng + to.lng) / 2;

  // Garde les waypoints rocade les plus proches du "couloir" entre from et to
  // (distance au milieu du segment), et on n'en garde qu'un seul pour éviter
  // les itinéraires trop contraints.
  const scored = ROCADE_WAYPOINTS.map((wp) => {
    const dMid = haversineKm({ lat: latMid, lng: lngMid }, wp);
    const dFrom = haversineKm(from, wp);
    const dTo = haversineKm(to, wp);
    return { wp, score: dMid + Math.abs(dFrom - dTo) * 0.3 };
  });
  scored.sort((a, b) => a.score - b.score);
  // On prend 1 seul waypoint sauf si le trajet est très long (>15km vol d'oiseau)
  const directKm = haversineKm(from, to);
  const count = directKm > 15 ? 2 : 1;
  return scored.slice(0, count).map((s) => s.wp);
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
    // Seuil abaissé à 3.5 km (l'ancien 5 km manquait beaucoup de trajets centre-ville)
    const useRocade = directKm > 3.5 && inBbox(from.lat, from.lng) && inBbox(to.lat, to.lng);

    let route: any = null;
    let viaRocade = false;

    // 1er essai : via rocade si éligible (waypoints sélectionnés intelligemment)
    if (useRocade) {
      const rocadeWps = selectRocadeWaypoints(from, to);
      const json = await callOsrm([from, ...rocadeWps, to], 0);
      if (json?.routes?.[0]) {
        route = json.routes[0];
        viaRocade = true;
      }
    }

    // Fallback : route directe (sans alternatives pour avoir la route la plus précise)
    if (!route) {
      const json = await callOsrm([from, to], 0);
      route = json?.routes?.[0] ?? null;
    }

    if (!route) {
      return new Response(JSON.stringify({ error: true, message: "Aucun itinéraire" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawKm = (route.distance ?? 0) / 1000;
    const rawSec = route.duration ?? 0;

    const coords: [number, number][] = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    );

    return new Response(
      JSON.stringify({
        distanceKm: calibrateKm(rawKm),
        durationSec: calibrateSec(rawSec, rawKm),
        coords,
        via_rocade: viaRocade,
        raw_km: rawKm, // debug
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
