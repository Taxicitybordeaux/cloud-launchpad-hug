const DEFAULT_OSRM =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_OSRM_URL
    ? (import.meta.env?.VITE_OSRM_URL as string)
    : "https://router.project-osrm.org";
const DEFAULT_OSRM_KEY =
  typeof import.meta !== "undefined" &&
  ((import.meta.env?.VITE_OSRM_API_KEY as string) || (import.meta.env?.VITE_ORS_API_KEY as string))
    ? (import.meta.env?.VITE_OSRM_API_KEY as string) || (import.meta.env?.VITE_ORS_API_KEY as string)
    : "";
const DEFAULT_OSRM_KEY_PARAM =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_OSRM_KEY_PARAM
    ? (import.meta.env.VITE_OSRM_KEY_PARAM as string)
    : "api_key";
const DEFAULT_OSRM_AUTH_HEADER =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_OSRM_AUTH_HEADER
    ? (import.meta.env.VITE_OSRM_AUTH_HEADER as string)
    : "";

export const OSRM_BASE = DEFAULT_OSRM.replace(/\/+$|\s+/g, "");
export const OSRM_API_KEY = DEFAULT_OSRM_KEY.trim();
export const OSRM_KEY_PARAM = DEFAULT_OSRM_KEY_PARAM.trim() || "api_key";
export const OSRM_AUTH_HEADER = DEFAULT_OSRM_AUTH_HEADER.trim();

/**
 * Coefficient de correction distance OSRM → réalité terrain (référence Google Maps).
 * OSRM sous-estime légèrement les distances par rapport à Google Maps.
 * Calibrer sur vos trajets réels : ratio = distance_gmaps / distance_osrm_brute.
 * Configurable via VITE_OSRM_DISTANCE_FACTOR dans le .env (défaut : 1.15).
 */
const DEFAULT_OSRM_DISTANCE_FACTOR =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_OSRM_DISTANCE_FACTOR
    ? parseFloat(import.meta.env.VITE_OSRM_DISTANCE_FACTOR as string)
    : 1.15;
export const OSRM_DISTANCE_FACTOR =
  isNaN(DEFAULT_OSRM_DISTANCE_FACTOR) || DEFAULT_OSRM_DISTANCE_FACTOR <= 0 ? 1.15 : DEFAULT_OSRM_DISTANCE_FACTOR;

type RouteOptions = {
  overview?: "full" | "simplified" | "false";
  alternatives?: boolean | number;
  steps?: boolean;
  geometries?: "geojson" | "polyline" | "polyline6";
};

function appendOsrmApiKey(url: URL, headers: Record<string, string>) {
  if (!OSRM_API_KEY) return;
  if (OSRM_AUTH_HEADER) {
    headers[OSRM_AUTH_HEADER] = OSRM_API_KEY;
  } else {
    url.searchParams.set(OSRM_KEY_PARAM || "api_key", OSRM_API_KEY);
  }
}

export async function fetchRoute(
  from: [number, number],
  to: [number, number],
  opts: RouteOptions = { overview: "false", alternatives: false, steps: false, geometries: "polyline" },
) {
  return fetchRouteCoordinates([from, to], opts);
}

export async function fetchRouteCoordinates(
  coordinates: [number, number][],
  opts: RouteOptions = { overview: "false", alternatives: false, steps: false, geometries: "polyline" },
) {
  const path = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = new URL(`${OSRM_BASE}/route/v1/driving/${path}`);
  url.searchParams.set("overview", opts.overview ?? "false");
  const altVal = opts.alternatives;
  url.searchParams.set("alternatives", typeof altVal === "number" ? String(altVal) : altVal ? "true" : "false");
  url.searchParams.set("steps", opts.steps ? "true" : "false");
  url.searchParams.set("geometries", opts.geometries ?? "polyline");

  const headers: Record<string, string> = {};
  appendOsrmApiKey(url, headers);

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error("OSRM fetch failed");
  return res.json();
}

export async function getDistanceAndDurationKm(from: [number, number], to: [number, number]) {
  try {
    const data = await fetchRoute(from, to, { overview: "false", alternatives: false, steps: false });
    const route = data?.routes?.[0];
    if (!route) return null;
    return { distanceKm: (route.distance / 1000) * OSRM_DISTANCE_FACTOR, durationSec: route.duration };
  } catch (err) {
    return null;
  }
}

export async function getRouteGeoCoords(from: [number, number], to: [number, number]) {
  try {
    const data = await fetchRoute(from, to, { overview: "full", geometries: "geojson" });
    const route = data?.routes?.[0];
    if (!route) return null;
    const coords = (route.geometry?.coordinates as [number, number][]).map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    return { coords, distanceKm: (route.distance / 1000) * OSRM_DISTANCE_FACTOR, durationSec: route.duration };
  } catch {
    return null;
  }
}

export default {
  OSRM_BASE,
  fetchRoute,
  fetchRouteCoordinates,
  getDistanceAndDurationKm,
  getRouteGeoCoords,
};
