/**
 * @/lib/osrm.ts
 *
 * - getDistanceAndDurationKm  → passe par l'Edge Function Supabase osrm-route
 *   (évite les blocages CORS depuis le navigateur, sélectionne le trajet le plus long côté serveur)
 *
 * - fetchRouteCoordinates      → appel OSRM direct (affichage carte uniquement, pas de calcul de prix)
 *
 * - OSRM_DISTANCE_FACTOR       → conservé pour les calculs locaux (fallback haversine, routeToAlt…)
 */

// Facteur correctif appliqué localement pour les calculs de fallback.
// NB : l'Edge Function applique déjà ce facteur côté serveur —
// ne PAS le réappliquer sur le résultat de getDistanceAndDurationKm.
export const OSRM_DISTANCE_FACTOR = 1.0; // ORS retourne des distances précises, pas de facteur correctif

// ─── getDistanceAndDurationKm ────────────────────────────────────────────────
// Utilisé pour le calcul de prix (reserver.tsx via getOsrmRouteLongest,
// admin_dashboard.tsx directement).
// Passe désormais par l'Edge Function Supabase au lieu d'appeler OSRM en direct.
export async function getDistanceAndDurationKm(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<{ distanceKm: number; dureeS: number } | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const res = await fetch(`${supabaseUrl}/functions/v1/osrm-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        from_lng: from[0],
        from_lat: from[1],
        to_lng: to[0],
        to_lat: to[1],
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) return null;

    // L'Edge Function renvoie distance_km (avec OSRM_DISTANCE_FACTOR déjà appliqué)
    // et duration_sec.
    return {
      distanceKm: json.distance_km,
      dureeS: json.duration_sec,
    };
  } catch {
    return null;
  }
}

// ─── fetchRouteCoordinates ───────────────────────────────────────────────────
// Utilisé pour afficher la polyline sur la carte (admin_dashboard.tsx).
// Passe par l'Edge Function ORS pour éviter les blocages CORS et avoir des distances précises.
export async function fetchRouteCoordinates(
  points: [number, number][], // tableau de [lng, lat]
  options: {
    overview?: "full" | "simplified" | false;
    alternatives?: boolean | number;
    geometries?: "geojson" | "polyline" | "polyline6";
  } = {},
): Promise<any | null> {
  if (points.length < 2) return null;
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const [from, to] = [points[0], points[points.length - 1]];
    const res = await fetch(`${supabaseUrl}/functions/v1/osrm-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        from_lng: from[0],
        from_lat: from[1],
        to_lng: to[0],
        to_lat: to[1],
        overview: options.overview ?? "full",
        geometries: options.geometries ?? "geojson",
        alternatives: options.alternatives ?? false,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) return null;
    // On retourne un format compatible avec l'ancien format OSRM attendu par admin_dashboard
    return {
      routes: [
        {
          distance: (json.distance_km ?? 0) * 1000,
          duration: json.duration_sec ?? 0,
          geometry: json.geometry ?? null,
        },
      ],
      distance_km: json.distance_km,
      duration_sec: json.duration_sec,
    };
  } catch {
    return null;
  }
}

// ─── getRouteGeoCoords ───────────────────────────────────────────────────────
// Utilisé dans suivi/$id.tsx pour récupérer la polyline [lat, lng][] + distanceKm.
export async function getRouteGeoCoords(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<{ coords: [number, number][]; distanceKm: number; durationSec: number }> {
  const data = await fetchRouteCoordinates([from, to], {
    overview: "full",
    geometries: "geojson",
  });
  if (!data?.routes?.[0]?.geometry) return { coords: [], distanceKm: 0, durationSec: 0 };
  const route = data.routes[0];
  // ORS renvoie GeoJSON geometry — coordinates en [lng, lat] → inverser pour Leaflet
  const coordinates = route.geometry?.coordinates ?? [];
  const coords = (coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
  const distanceKm = data.distance_km ?? (route.distance ? route.distance / 1000 : 0);
  const durationSec = data.duration_sec ?? route.duration ?? 0;
  return { coords, distanceKm, durationSec };
}
