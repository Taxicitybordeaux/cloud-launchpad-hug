/**
 * @/lib/osrm.ts — version centralisée
 *
 * Une seule source de vérité : `getLongestRoute()` (alternatives=3 + plus long km).
 * Tous les wrappers historiques (`getDistanceAndDurationKm`,
 * `fetchRouteCoordinates`, `getRouteGeoCoords`, `getOsrmPolylineLongest`)
 * délèguent à `getLongestRoute()` → prix, km affichés et polyline proviennent
 * strictement de la même réponse OSRM.
 *
 * Cache : mémoire process + sessionStorage (TTL 7 j, clé arrondie à ~11 m).
 * Densification : interpolation auto si gap > 25 m (rendu lissé type Uber).
 */

export const OSRM_DISTANCE_FACTOR = 1.0;

// ─── Cache ──────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const CACHE_PREFIX = "osrm.longest.v1:";
const memoryCache = new Map<string, { at: number; value: LongestRoute }>();

function keyFor(from: [number, number], to: [number, number]): string {
  // Arrondi à ~11 m (4 décimales)
  const r = (n: number) => n.toFixed(4);
  return `${CACHE_PREFIX}${r(from[0])},${r(from[1])}→${r(to[0])},${r(to[1])}`;
}

function readCache(k: string): LongestRoute | null {
  const mem = memoryCache.get(k);
  if (mem && Date.now() - mem.at < CACHE_TTL_MS) return mem.value;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage?.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: LongestRoute };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    memoryCache.set(k, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(k: string, value: LongestRoute) {
  const entry = { at: Date.now(), value };
  memoryCache.set(k, entry);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(k, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

// ─── Densification ──────────────────────────────────────────────────────────
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Interpole les segments > 25 m pour un rendu lissé type Uber. */
export function densifyCoords(coords: [number, number][], maxGapMeters = 25): [number, number][] {
  if (coords.length < 2) return coords;
  const out: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = haversineMeters(a, b);
    if (d > maxGapMeters) {
      const steps = Math.ceil(d / maxGapMeters);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    out.push(b);
  }
  return out;
}

// ─── Type de sortie centralisé ──────────────────────────────────────────────
export type LongestRoute = {
  coords: [number, number][]; // [lat, lng]
  distanceKm: number;
  durationSec: number;
};

// ─── getLongestRoute : la SEULE source ──────────────────────────────────────
export async function getLongestRoute(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<LongestRoute | null> {
  const k = keyFor(from, to);
  const cached = readCache(k);
  if (cached) return cached;

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
        overview: "full",
        geometries: "geojson",
        alternatives: 3, // l'edge function retient le plus long
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error) return null;

    const raw: [number, number][] =
      (json?.geometry?.coordinates as [number, number][] | undefined)?.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      ) ?? [];
    const coords = densifyCoords(raw, 25);

    const value: LongestRoute = {
      coords,
      distanceKm: Number(json.distance_km) || 0,
      durationSec: Number(json.duration_sec) || 0,
    };
    writeCache(k, value);
    return value;
  } catch {
    return null;
  }
}

// ─── Wrappers de compatibilité ─────────────────────────────────────────────
export async function getDistanceAndDurationKm(
  from: [number, number],
  to: [number, number],
): Promise<{ distanceKm: number; dureeS: number } | null> {
  const r = await getLongestRoute(from, to);
  if (!r) return null;
  return { distanceKm: r.distanceKm, dureeS: r.durationSec };
}

export async function fetchRouteCoordinates(
  points: [number, number][],
  _options: { overview?: "full" | "simplified" | false; alternatives?: boolean | number; geometries?: "geojson" | "polyline" | "polyline6" } = {},
): Promise<any | null> {
  if (points.length < 2) return null;
  const [from, to] = [points[0], points[points.length - 1]];
  const r = await getLongestRoute(from, to);
  if (!r) return null;
  // Format compatible avec l'ancien consommateur (admin.dashboard)
  return {
    routes: [
      {
        distance: r.distanceKm * 1000,
        duration: r.durationSec,
        geometry: {
          type: "LineString",
          coordinates: r.coords.map(([lat, lng]) => [lng, lat]),
        },
      },
    ],
    distance_km: r.distanceKm,
    duration_sec: r.durationSec,
  };
}

export async function getRouteGeoCoords(
  from: [number, number],
  to: [number, number],
): Promise<{ coords: [number, number][]; distanceKm: number; durationSec: number }> {
  const r = await getLongestRoute(from, to);
  if (!r) return { coords: [], distanceKm: 0, durationSec: 0 };
  return r;
}

/** Helper utilisé par reserver.tsx — renvoie [lat, lng][] prêt pour Leaflet. */
export async function getOsrmPolylineLongest(
  fromLatLng: [number, number], // [lat, lng]
  toLatLng: [number, number], // [lat, lng]
): Promise<[number, number][]> {
  const r = await getLongestRoute([fromLatLng[1], fromLatLng[0]], [toLatLng[1], toLatLng[0]]);
  return r?.coords ?? [];
}
