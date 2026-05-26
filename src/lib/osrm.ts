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

// Facteur correctif appliqué UNIQUEMENT dans les calculs locaux de fallback haversine.
// L'Edge Function (get_osrm_route SQL) applique déjà son propre facteur (1.32) —
// ne PAS réappliquer sur le résultat de getDistanceAndDurationKm.
// routeToAlt utilise les routes brutes OSRM (fetchRouteCoordinates) → on n'applique
// aucun facteur supplémentaire : la distance brute suffit pour les alternatives visuelles.
export const OSRM_DISTANCE_FACTOR = 1.0;

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
// Utilisé uniquement pour afficher la polyline sur la carte (admin_dashboard.tsx).
// Appelle OSRM directement — pas de calcul de prix, pas besoin de passer par le serveur.
export async function fetchRouteCoordinates(
  points: [number, number][], // tableau de [lng, lat]
  options: {
    overview?: "full" | "simplified" | false;
    alternatives?: boolean | number;
    geometries?: "geojson" | "polyline" | "polyline6";
  } = {},
): Promise<any | null> {
  const coords = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const params = new URLSearchParams();
  if (options.overview !== undefined) params.set("overview", String(options.overview));
  if (options.alternatives !== undefined) params.set("alternatives", String(options.alternatives));
  if (options.geometries) params.set("geometries", options.geometries);
  params.set("steps", "false");

  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── getRouteGeoCoords ───────────────────────────────────────────────────────
// Utilisé dans suivi/$id.tsx pour récupérer la polyline [lat, lng][] d'un itinéraire.
export async function getRouteGeoCoords(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<[number, number][]> {
  const data = await fetchRouteCoordinates([from, to], {
    overview: "full",
    geometries: "geojson",
  });
  if (!data?.routes?.[0]?.geometry?.coordinates) return [];
  // OSRM renvoie [lng, lat] → on inverse en [lat, lng] pour Leaflet
  return (data.routes[0].geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]);
}
