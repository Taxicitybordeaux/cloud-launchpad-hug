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
export const OSRM_DISTANCE_FACTOR = 1.15;

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
