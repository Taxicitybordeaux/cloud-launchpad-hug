/**
 * @/lib/osrm.ts
 *
 * Appel centralisé à l'Edge Function `osrm-route`.
 * Cache mémoire + sessionStorage v3 — rejette km=0 / durée=0.
 *
 * Exports :
 *  - getLongestRoute(from, to)           → { distanceKm, durationSec, coords:[lat,lng][] }
 *  - getDistanceAndDurationKm(from, to)  → { distanceKm, dureeS } | null   (from/to en [lng,lat])
 *  - fetchRouteCoordinates(points)       → objet style OSRM (carte admin)
 *  - getRouteGeoCoords(from, to)         → { coords, distanceKm, durationSec }  (from/to en [lng,lat])
 */

import { supabase } from "@/integrations/supabase/client";

export const OSRM_DISTANCE_FACTOR = 1.0;

const CACHE_PREFIX = "osrm:longest:v3:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours
const FETCH_TIMEOUT_MS = 8000;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Types & Cache ───────────────────────────────────────────────────────────
type LongestRoute = {
  distanceKm: number;
  durationSec: number;
  coords: [number, number][]; // [lat, lng] prêt pour Leaflet
};

const memCache = new Map<string, { at: number; value: LongestRoute }>();

function cacheKey(from: [number, number], to: [number, number]): string {
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${CACHE_PREFIX}${r(from[0])},${r(from[1])}->${r(to[0])},${r(to[1])}`;
}

function isValidRoute(v: any): v is LongestRoute {
  return (
    !!v &&
    typeof v.distanceKm === "number" &&
    typeof v.durationSec === "number" &&
    v.distanceKm > 0 &&
    v.durationSec > 0 &&
    Array.isArray(v.coords) &&
    v.coords.length >= 2
  );
}

function readCache(key: string): LongestRoute | null {
  const m = memCache.get(key);
  if (m && Date.now() - m.at < CACHE_TTL_MS) {
    if (isValidRoute(m.value)) return m.value;
    memCache.delete(key);
    try {
      sessionStorage?.removeItem(key);
    } catch {}
  }
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: LongestRoute };
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    if (!isValidRoute(parsed.value)) {
      sessionStorage.removeItem(key);
      return null;
    }
    memCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: LongestRoute): void {
  if (!isValidRoute(value)) return;
  const entry = { at: Date.now(), value };
  memCache.set(key, entry);
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, JSON.stringify(entry));
    }
  } catch {}
}

// ─── Densification ───────────────────────────────────────────────────────────
function densifyCoords(coords: [number, number][], maxStepMeters = 25): [number, number][] {
  if (coords.length < 2) return coords;
  const out: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];
    const d = haversineMeters(lat1, lng1, lat2, lng2);
    if (d > maxStepMeters) {
      const steps = Math.min(10, Math.ceil(d / maxStepMeters));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
      }
    }
    out.push([lat2, lng2]);
  }
  return out;
}

async function invokeOsrmRoute(from: [number, number], to: [number, number]): Promise<any | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke("osrm-route", {
      body: {
        from_lat: from[0],
        from_lng: from[1],
        to_lat: to[0],
        to_lng: to[1],
      },
      signal: ctrl.signal,
    });
    if (error) return null;
    return data;
  } finally {
    clearTimeout(id);
  }
}

// ─── Parse une réponse normalisée Edge Function ou OSRM brute ───────────────
function parseRouteResponse(json: any): LongestRoute | null {
  if (Array.isArray(json?.coords) && json.coords.length >= 2) {
    const distanceKm = Number(json.distanceKm ?? json.distance_km ?? 0);
    const durationSec = Number(json.durationSec ?? json.duration_sec ?? 0);
    const rawCoords = json.coords
      .map((p: any) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : null))
      .filter((p: [number, number] | null): p is [number, number] =>
        !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]),
      );
    if (distanceKm <= 0 || durationSec <= 0 || rawCoords.length < 2) return null;
    return { distanceKm, durationSec, coords: densifyCoords(rawCoords, 25) };
  }

  const routes: any[] = Array.isArray(json?.routes) ? json.routes : [];
  if (!routes.length) return null;

  const best = routes.reduce((a, b) => ((b?.distance ?? 0) > (a?.distance ?? 0) ? b : a));
  const distanceKm = (best?.distance ?? 0) / 1000;
  const durationSec = best?.duration ?? 0;

  const rawCoords: [number, number][] = Array.isArray(best?.geometry?.coordinates)
    ? best.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
    : [];

  if (distanceKm <= 0 || durationSec <= 0 || rawCoords.length < 2) return null;
  return { distanceKm, durationSec, coords: densifyCoords(rawCoords, 25) };
}

// ─── Cœur : appel OSRM via Edge Function ─────────────────────────────────────
export async function getLongestRoute(
  from: [number, number], // [lat, lng]
  to: [number, number], // [lat, lng]
): Promise<LongestRoute> {
  const empty: LongestRoute = { distanceKm: 0, durationSec: 0, coords: [] };
  if (!from || !to) return empty;

  const key = cacheKey(from, to);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const json = await invokeOsrmRoute(from, to);
    const route = parseRouteResponse(json);
    if (!route) return empty;
    writeCache(key, route);
    return route;
  } catch {
    return empty;
  }
}

// ─── Wrappers compatibles ─────────────────────────────────────────────────────

/** from/to en [lng, lat] */
export async function getDistanceAndDurationKm(
  from: [number, number],
  to: [number, number],
): Promise<{ distanceKm: number; dureeS: number } | null> {
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  if (!r.coords.length && r.distanceKm === 0) return null;
  return { distanceKm: r.distanceKm, dureeS: r.durationSec };
}

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
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  return { coords: r.coords, distanceKm: r.distanceKm, durationSec: r.durationSec };
}
