/**
 * @/lib/osrm.ts
 *
 * Point d'entrée unique pour OSRM :
 *  - getLongestRoute(from, to)           → { distanceKm, durationSec, coords:[lat,lng][] }
 *  - getDistanceAndDurationKm(...)       → wrapper compatible (prix / km)
 *  - fetchRouteCoordinates(...)          → wrapper compatible (carte admin)
 *  - getRouteGeoCoords(...)              → wrapper compatible (suivi)
 *
 * Règle métier (Bordeaux) : alternatives=3 + sélection du trajet LE PLUS LONG (km)
 * → correspond le plus souvent à un passage par la rocade.
 *
 * Toutes les pages (réservation, suivi, course, fin, mes-courses, admin)
 * passent par cette même fonction → distance, prix et polyline sont
 * GARANTIS identiques pour un même couple (from, to).
 *
 * Cache : mémoire process + sessionStorage (par onglet). Évite de relancer
 * OSRM lors d'un rechargement / d'une navigation entre pages.
 */

export const OSRM_DISTANCE_FACTOR = 1.0;

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const CACHE_PREFIX = "osrm:longest:v1:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

type LongestRoute = {
  distanceKm: number;
  durationSec: number;
  coords: [number, number][]; // [lat, lng] prêt pour Leaflet
};

// ─── Cache (mémoire + sessionStorage) ────────────────────────────────────────
const memCache = new Map<string, { at: number; value: LongestRoute }>();

function cacheKey(from: [number, number], to: [number, number]) {
  // Arrondi à ~11 m pour maximiser les hits sur des coords légèrement bruitées.
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${CACHE_PREFIX}${round(from[0])},${round(from[1])}->${round(to[0])},${round(to[1])}`;
}

function readCache(key: string): LongestRoute | null {
  const m = memCache.get(key);
  if (m && Date.now() - m.at < CACHE_TTL_MS) return m.value;
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: LongestRoute };
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    memCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: LongestRoute) {
  const entry = { at: Date.now(), value };
  memCache.set(key, entry);
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, JSON.stringify(entry));
    }
  } catch {
    // quota / disabled storage → on garde le cache mémoire seulement
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pickLongestRoute(routes: any[]): any | null {
  if (!Array.isArray(routes) || routes.length === 0) return null;
  return routes.reduce(
    (best, r) => ((r?.distance ?? 0) > (best?.distance ?? -1) ? r : best),
    routes[0],
  );
}

// Densifie une polyline : insère des points intermédiaires quand le segment
// dépasse `maxStepMeters`. OSRM en overview=full est déjà fin, mais cette
// passe garantit un rendu lisse type Uber même sur les longs segments droits.
function densifyCoords(coords: [number, number][], maxStepMeters = 25): [number, number][] {
  if (coords.length < 2) return coords;
  const out: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];
    const d = haversineMeters(lat1, lng1, lat2, lng2);
    if (d > maxStepMeters) {
      const steps = Math.min(20, Math.ceil(d / maxStepMeters));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
      }
    }
    out.push([lat2, lng2]);
  }
  return out;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildOsrmUrl(
  from: [number, number], // [lng, lat]
  to: [number, number],   // [lng, lat]
  overview: "full" | "simplified" | false,
  alternatives: boolean | number,
) {
  const params = new URLSearchParams({
    overview: overview === false ? "false" : overview,
    geometries: "geojson",
    alternatives:
      typeof alternatives === "number" ? String(alternatives) : alternatives ? "true" : "false",
  });
  return `${OSRM_ROUTE_URL}/${from[0]},${from[1]};${to[0]},${to[1]}?${params}`;
}

// ─── Cœur : récupère la route la plus longue (cache + alternatives=3) ───────
// `from` / `to` sont en [lat, lng] (format usuel côté UI).
export async function getLongestRoute(
  from: [number, number], // [lat, lng]
  to: [number, number],   // [lat, lng]
): Promise<LongestRoute> {
  const empty: LongestRoute = { distanceKm: 0, durationSec: 0, coords: [] };
  if (!from || !to) return empty;

  const key = cacheKey(from, to);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const url = buildOsrmUrl([from[1], from[0]], [to[1], to[0]], "full", 3);
    const res = await fetch(url);
    if (!res.ok) return empty;
    const json = await res.json();
    if (json?.error) return empty;

    const route = pickLongestRoute(json.routes ?? []);
    if (!route) return empty;

    const raw: [number, number][] = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    );
    const coords = densifyCoords(raw, 25);

    const value: LongestRoute = {
      distanceKm: (route.distance ?? 0) / 1000,
      durationSec: route.duration ?? 0,
      coords,
    };
    writeCache(key, value);
    return value;
  } catch {
    return empty;
  }
}

// ─── Wrappers compatibles avec l'existant ───────────────────────────────────
// Distance/durée (prix) — `from`/`to` en [lng, lat].
export async function getDistanceAndDurationKm(
  from: [number, number],
  to: [number, number],
): Promise<{ distanceKm: number; dureeS: number } | null> {
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  if (!r.coords.length && r.distanceKm === 0) return null;
  return { distanceKm: r.distanceKm, dureeS: r.durationSec };
}

// Carte admin — `points` en [lng, lat][]
export async function fetchRouteCoordinates(
  points: [number, number][],
  _options: {
    overview?: "full" | "simplified" | false;
    alternatives?: boolean | number;
    geometries?: "geojson" | "polyline" | "polyline6";
  } = {},
): Promise<any | null> {
  if (points.length < 2) return null;
  const [from, to] = [points[0], points[points.length - 1]];
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  if (!r.coords.length) return null;
  return {
    routes: [
      {
        distance: r.distanceKm * 1000,
        duration: r.durationSec,
        geometry: {
          type: "LineString",
          // GeoJSON en [lng, lat]
          coordinates: r.coords.map(([lat, lng]) => [lng, lat]),
        },
      },
    ],
    distance_km: r.distanceKm,
    duration_sec: r.durationSec,
  };
}

// Suivi — `from`/`to` en [lng, lat]
export async function getRouteGeoCoords(
  from: [number, number],
  to: [number, number],
): Promise<{ coords: [number, number][]; distanceKm: number; durationSec: number }> {
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  return { coords: r.coords, distanceKm: r.distanceKm, durationSec: r.durationSec };
}
