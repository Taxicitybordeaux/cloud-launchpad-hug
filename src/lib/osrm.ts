/**
 * @/lib/osrm.ts
 *
 * Appel centralisé à l'Edge Function Supabase `osrm-route`.
 * L'Edge Function gère : rocade, calibration, timeout, CORS.
 * Ce fichier ne fait JAMAIS d'appel OSRM direct — tout passe par l'Edge Function.
 *
 * Cache mémoire + sessionStorage v7 — rejette km=0 / durée=0.
 *
 * Exports :
 *  - getLongestRoute(from, to)           → { distanceKm, durationSec, coords:[lat,lng][] }
 *  - getDistanceAndDurationKm(from, to)  → { distanceKm, dureeS } | null   (from/to en [lng,lat])
 *  - fetchRouteCoordinates(points)       → objet style OSRM (carte admin)
 *  - getRouteGeoCoords(from, to)         → { coords, distanceKm, durationSec }  (from/to en [lng,lat])
 *  - getRouteAlternatives(from, to)      → RouteAlternative[]  (from/to en [lat,lng])
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Calibration (miroir de l'Edge Function — utilisée uniquement en fallback) ──
// La calibration principale est faite côté Edge Function.
// Ces fonctions restent exportées pour compatibilité (certains composants les importent).
export function calibrationFactor(rawKm: number): number {
  if (rawKm < 5) return 1.12;
  if (rawKm < 12) return 1.1;
  if (rawKm < 25) return 1.1;
  if (rawKm < 60) return 1.11;
  return 1.08;
}
export function calibrateKm(rawKm: number): number {
  return rawKm * calibrationFactor(rawKm);
}
export function calibrateSec(rawSec: number, rawKm: number): number {
  return rawSec * calibrationFactor(rawKm);
}
// Conservé pour rétro-compat
export const OSRM_DISTANCE_FACTOR = 1.09;

// ─── Trajets connus (Gare ↔ Aéroport) ────────────────────────────────────────
export type AlternativeKind = "court" | "intermédiaire" | "rocade";
export const BORDEAUX_AIRPORT_EXACT_KM: Record<AlternativeKind, number> = {
  court: 17,
  intermédiaire: 20,
  rocade: 24,
};

const GARE_ST_JEAN_COORD: [number, number] = [44.8265, -0.5569];
const AIRPORT_HALL_A_COORD: [number, number] = [44.8291, -0.7028];
const KNOWN_ROUTE_RADIUS_M = 1600;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isGareStJeanText(value: string | null | undefined): boolean {
  const q = normalizeText(value);
  return (
    q.includes("charles domercq") ||
    q.includes("gare st jean") ||
    q.includes("gare saint jean") ||
    q.includes("bordeaux saint jean")
  );
}

function isAirportHallAText(value: string | null | undefined): boolean {
  const q = normalizeText(value);
  return (
    (q.includes("aeroport") || q.includes("airport") || q.includes("hall a")) &&
    (q.includes("bordeaux") || q.includes("merignac") || q.includes("hall a"))
  );
}

function isNearPoint(p: [number, number], target: [number, number]): boolean {
  return haversineMeters(p[0], p[1], target[0], target[1]) <= KNOWN_ROUTE_RADIUS_M;
}

export function isBordeauxAirportRoute(from: [number, number], to: [number, number]): boolean {
  return (
    (isNearPoint(from, GARE_ST_JEAN_COORD) && isNearPoint(to, AIRPORT_HALL_A_COORD)) ||
    (isNearPoint(from, AIRPORT_HALL_A_COORD) && isNearPoint(to, GARE_ST_JEAN_COORD))
  );
}

export function isBordeauxAirportRouteText(from: string | null | undefined, to: string | null | undefined): boolean {
  return (isGareStJeanText(from) && isAirportHallAText(to)) || (isAirportHallAText(from) && isGareStJeanText(to));
}

export function labelForAlternative(index: number, total: number): AlternativeKind {
  if (total <= 1) return "court";
  if (total === 2) return index === 0 ? "court" : "rocade";
  if (index === 0) return "court";
  if (index === total - 1) return "rocade";
  return "intermédiaire";
}

function forceExactKm<T extends { distanceKm: number; durationSec: number }>(route: T, exactKm: number): T {
  const durationFactor = route.distanceKm > 0 ? exactKm / route.distanceKm : 1;
  const baseDurationSec = route.durationSec > 0 ? route.durationSec : exactKm * 90;
  return {
    ...route,
    distanceKm: exactKm,
    durationSec: Math.max(60, Math.round(baseDurationSec * durationFactor)),
  };
}

// ─── Types & Cache ────────────────────────────────────────────────────────────
export type LongestRoute = {
  distanceKm: number;
  durationSec: number;
  coords: [number, number][]; // [lat, lng] prêt pour Leaflet
};

export type RouteAlternative = {
  distanceKm: number;
  durationSec: number;
  coords: [number, number][]; // [lat, lng]
};

const CACHE_PREFIX = "osrm:v7:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours
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

// ─── Densification des coordonnées pour affichage carte lisse ─────────────────
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

// ─── Appel Edge Function Supabase `osrm-route` ───────────────────────────────
// C'est le seul endroit où on fait un appel réseau pour le routage.
// La logique rocade est déléguée à l'Edge Function.
async function callEdgeFunction(
  from: [number, number], // [lat, lng]
  to: [number, number], // [lat, lng]
): Promise<LongestRoute | null> {
  try {
    const { data, error } = await supabase.functions.invoke("osrm-route", {
      body: {
        from_lat: from[0],
        from_lng: from[1],
        to_lat: to[0],
        to_lng: to[1],
      },
    });

    if (error || !data || data.error) {
      console.warn("[osrm] Edge Function error:", error ?? data?.message);
      return null;
    }

    // L'Edge Function renvoie déjà des km calibrés
    const distanceKm = Number(data.distanceKm ?? 0);
    const durationSec = Number(data.durationSec ?? 0);

    if (distanceKm <= 0 || durationSec <= 0) return null;

    const rawCoords: [number, number][] = Array.isArray(data.coords)
      ? data.coords
          .map((p: any) => (Array.isArray(p) ? ([Number(p[0]), Number(p[1])] as [number, number]) : null))
          .filter(
            (p: [number, number] | null): p is [number, number] =>
              !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]),
          )
      : [];

    if (rawCoords.length < 2) return null;

    return {
      distanceKm,
      durationSec,
      coords: densifyCoords(rawCoords, 25),
    };
  } catch (err) {
    console.error("[osrm] callEdgeFunction exception:", err);
    return null;
  }
}

// ─── Cœur : getLongestRoute ───────────────────────────────────────────────────
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
    const route = await callEdgeFunction(from, to);
    if (!route) return empty;

    // Trajet connu : force les km exacts Gare ↔ Aéroport
    const finalRoute = isBordeauxAirportRoute(from, to) ? forceExactKm(route, BORDEAUX_AIRPORT_EXACT_KM.rocade) : route;

    writeCache(key, finalRoute);
    return finalRoute;
  } catch {
    return empty;
  }
}

// ─── Wrappers compatibles ─────────────────────────────────────────────────────

/** from/to en [lng, lat] — wrapper pour l'API existante */
export async function getDistanceAndDurationKm(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<{ distanceKm: number; dureeS: number } | null> {
  // On inverse pour getLongestRoute qui attend [lat, lng]
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
  // points sont en [lng, lat] → on inverse
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
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<{ coords: [number, number][]; distanceKm: number; durationSec: number }> {
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  return { coords: r.coords, distanceKm: r.distanceKm, durationSec: r.durationSec };
}

// ─── Alternatives (pour sélecteur d'itinéraire chauffeur) ───────────────────
// Désormais on ne propose qu'une seule route (via l'Edge Function qui fait rocade).
// On simule 2 alternatives synthétiques si le chauffeur a besoin d'un choix :
// court (−15%) et rocade (via Edge Function = valeur nominale).
export async function getRouteAlternatives(
  from: [number, number], // [lat, lng]
  to: [number, number], // [lat, lng]
  forceBordeauxAirportExact = false,
): Promise<RouteAlternative[]> {
  if (!from || !to) return [];

  try {
    const route = await getLongestRoute(from, to);
    if (!route || route.distanceKm === 0) return [];

    if (forceBordeauxAirportExact || isBordeauxAirportRoute(from, to)) {
      const base: RouteAlternative = { ...route };
      return [
        forceExactKm({ ...base }, BORDEAUX_AIRPORT_EXACT_KM.court),
        forceExactKm({ ...base }, BORDEAUX_AIRPORT_EXACT_KM["intermédiaire"]),
        forceExactKm({ ...base }, BORDEAUX_AIRPORT_EXACT_KM.rocade),
      ];
    }

    // On génère 2 alternatives synthétiques autour de la route rocade :
    // - court   : estimation sans rocade (~15% de moins)
    // - rocade  : la vraie route calculée (via Edge Function avec waypoints rocade)
    const rocade: RouteAlternative = { ...route };
    const court: RouteAlternative = {
      distanceKm: parseFloat((route.distanceKm * 0.85).toFixed(2)),
      durationSec: Math.round(route.durationSec * 0.85),
      coords: route.coords,
    };

    // Dédup : si court et rocade sont trop proches (<0.5 km), on ne propose qu'une route
    if (Math.abs(rocade.distanceKm - court.distanceKm) < 0.5) {
      return [rocade];
    }

    return [court, rocade];
  } catch {
    return [];
  }
}
