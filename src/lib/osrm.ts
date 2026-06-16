/**
 * @/lib/osrm.ts
 *
 * Appel centralisé à l'Edge Function Supabase `osrm-route`.
 * L'Edge Function gère : rocade, calibration, timeout, CORS.
 * Ce fichier ne fait JAMAIS d'appel OSRM direct — tout passe par l'Edge Function.
 * Il ne génère JAMAIS de distance à vol d'oiseau — si l'Edge Function échoue, on retourne null/0.
 *
 * Cache mémoire + sessionStorage v9 — rejette km=0 / durée=0.
 *
 * Exports :
 *  - getLongestRoute(from, to)           → { distanceKm, durationSec, coords:[lat,lng][] }
 *  - getDistanceAndDurationKm(from, to)  → { distanceKm, dureeS } | null   (from/to en [lng,lat])
 *  - fetchRouteCoordinates(points)       → objet style OSRM (carte admin)
 *  - getRouteGeoCoords(from, to)         → { coords, distanceKm, durationSec }  (from/to en [lng,lat])
 *  - calibrateKm(rawKm)                  → number  (calibration locale, utilisée en fallback)
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
// Ces distances EXACTES sont imposées quand l'itinéraire Gare ↔ Aéroport est détecté.
// Elles reflètent la réalité terrain (rocade) validée par José.
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

// labelForAlternative conservé pour rétro-compat (suivi__id.tsx peut encore l'importer)
export type RouteAlternative = {
  distanceKm: number;
  durationSec: number;
  coords: [number, number][];
};
export function labelForAlternative(index: number, total: number): AlternativeKind {
  if (total <= 1) return "court";
  if (total === 2) return index === 0 ? "court" : "rocade";
  if (index === 0) return "court";
  if (index === total - 1) return "rocade";
  return "intermédiaire";
}

// ─── Types & Cache ────────────────────────────────────────────────────────────
export type LongestRoute = {
  distanceKm: number;
  durationSec: number;
  coords: [number, number][]; // [lat, lng] prêt pour Leaflet
};

const CACHE_PREFIX = "osrm:v9:";
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
// En cas d'échec : on retourne null — JAMAIS de vol d'oiseau ici.
async function callEdgeFunction(
  from: [number, number], // [lat, lng]
  to: [number, number], // [lat, lng]
  attempt = 1,
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
      console.warn(`[osrm] Edge Function error (attempt ${attempt}):`, error ?? data?.message);
      // Retry une fois en cas d'erreur réseau transitoire
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 800));
        return callEdgeFunction(from, to, 2);
      }
      return null;
    }

    const distanceKm = Number(data.distanceKm ?? 0);
    const durationSec = Number(data.durationSec ?? 0);

    if (distanceKm <= 0 || durationSec <= 0) {
      console.warn("[osrm] Edge Function renvoyé km=0 ou durée=0 — rejeté.");
      return null;
    }

    const rawCoords: [number, number][] = Array.isArray(data.coords)
      ? data.coords
          .map((p: any) => (Array.isArray(p) ? ([Number(p[0]), Number(p[1])] as [number, number]) : null))
          .filter(
            (p: [number, number] | null): p is [number, number] =>
              !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]),
          )
      : [];

    if (rawCoords.length < 2) {
      console.warn("[osrm] Coordonnées insuffisantes dans la réponse Edge Function.");
      return null;
    }

    return {
      distanceKm,
      durationSec,
      coords: densifyCoords(rawCoords, 25),
    };
  } catch (err) {
    console.error(`[osrm] callEdgeFunction exception (attempt ${attempt}):`, err);
    if (attempt === 1) {
      await new Promise((r) => setTimeout(r, 800));
      return callEdgeFunction(from, to, 2);
    }
    return null;
  }
}

// ─── Cœur : getLongestRoute ───────────────────────────────────────────────────
// Toujours via rocade (déléguée à l'Edge Function).
// Retourne distanceKm=0/durationSec=0/coords=[] si l'Edge Function est injoignable.
// Ne génère JAMAIS de distance à vol d'oiseau.
export async function getLongestRoute(
  from: [number, number], // [lat, lng]
  to: [number, number], // [lat, lng]
): Promise<LongestRoute> {
  const empty: LongestRoute = { distanceKm: 0, durationSec: 0, coords: [] };
  if (!from || !to) return empty;

  const key = cacheKey(from, to);
  const cached = readCache(key);
  if (cached) return cached;

  const route = await callEdgeFunction(from, to);
  if (!route) return empty;

  // Trajet connu Gare ↔ Aéroport : on force les km exacts rocade validés terrain
  if (isBordeauxAirportRoute(from, to)) {
    const exactKm = BORDEAUX_AIRPORT_EXACT_KM.rocade;
    const durationFactor = route.distanceKm > 0 ? exactKm / route.distanceKm : 1;
    const finalRoute: LongestRoute = {
      distanceKm: exactKm,
      durationSec: Math.max(60, Math.round(route.durationSec * durationFactor)),
      coords: route.coords,
    };
    writeCache(key, finalRoute);
    return finalRoute;
  }

  writeCache(key, route);
  return route;
}

// ─── Wrappers compatibles ─────────────────────────────────────────────────────

/** from/to en [lng, lat] — wrapper pour l'API existante.
 *  Retourne null si l'Edge Function est injoignable (ne jamais utiliser vol d'oiseau). */
export async function getDistanceAndDurationKm(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<{ distanceKm: number; dureeS: number } | null> {
  const r = await getLongestRoute([from[1], from[0]], [to[1], to[0]]);
  if (r.distanceKm === 0 || r.durationSec === 0) return null;
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
  if (r.distanceKm === 0 || !r.coords.length) return null;
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

// ─── getRouteAlternatives — conservé pour rétro-compat ───────────────────────
// Plus utilisé par suivi__id.tsx (supprimé). Conservé si d'autres fichiers l'importent.
// Retourne toujours [route_rocade] — une seule route, pas de synthétique à vol d'oiseau.
export async function getRouteAlternatives(
  from: [number, number], // [lat, lng]
  to: [number, number], // [lat, lng]
  _forceBordeauxAirportExact = false,
): Promise<RouteAlternative[]> {
  if (!from || !to) return [];
  const route = await getLongestRoute(from, to);
  if (!route || route.distanceKm === 0) return [];
  return [{ distanceKm: route.distanceKm, durationSec: route.durationSec, coords: route.coords }];
}
