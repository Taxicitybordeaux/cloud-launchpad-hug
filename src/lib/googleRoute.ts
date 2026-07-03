// lib/googleRoute.ts
// Remplace lib/osrm.ts — mêmes signatures (drop-in), implémenté avec
// Google Directions API au lieu d'OSRM, pour pouvoir juste changer l'import.

import { loadGoogleMaps } from "./googleMaps";

type LngLat = [number, number]; // [lng, lat] — même convention que l'ancien OSRM
type GoogleDirectionsService = any;
type GoogleDirectionsResult = any;

export type RouteResult = {
  distanceKm: number;
  coords: [number, number][]; // [lat, lng][]
};

export type DurationResult = {
  dureeS: number;
  distanceKm: number;
};

// Point de passage forcé sur la rocade bordelaise (A630, échangeur 12 — Pessac/Sud).
// Sert de waypoint pour forcer Google Directions à router via la rocade plutôt
// que par le centre-ville, et donne en général le trajet le plus long en km.
const ROCADE_WAYPOINT: { lat: number; lng: number } = { lat: 44.8052, lng: -0.6128 };

/**
 * Choisit, parmi les routes retournées par Google Directions, celle dont la
 * distance totale (somme des legs) est la plus grande — cohérent avec
 * l'ancien comportement OSRM (alternatives=3 + sélection du trajet le plus long).
 */
function pickLongestRoute(routes: GoogleDirectionsResult[]): GoogleDirectionsResult {
  let best = routes[0];
  let bestKm = -Infinity;
  for (const route of routes) {
    const km = (route.legs ?? []).reduce((sum: number, leg: any) => sum + (leg?.distance?.value ?? 0), 0);
    if (km > bestKm) {
      bestKm = km;
      best = route;
    }
  }
  return best;
}
let directionsService: GoogleDirectionsService | null = null;
async function getDirectionsService() {
  if (directionsService) return directionsService;
  const g = await loadGoogleMaps();
  directionsService = new g.maps.DirectionsService();
  return directionsService;
}

function decodePolyline(encoded: string): [number, number][] {
  let index = 0,
    lat = 0,
    lng = 0;
  const coordinates: [number, number][] = [];
  while (index < encoded.length) {
    let b: number,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

/**
 * Calcule l'itinéraire routier complet (distance + tracé) entre deux points.
 * Entrée/sortie au même format que l'ancien getRouteGeoCoords d'OSRM :
 * origin/dest en [lng, lat], retour coords en [lat, lng][].
 */
export async function getRouteGeoCoords(origin: LngLat, dest: LngLat): Promise<RouteResult> {
  const api = await loadGoogleMaps();
  const service = await getDirectionsService();
  const [oLng, oLat] = origin;
  const [dLng, dLat] = dest;

  return new Promise((resolve, reject) => {
    service.route(
      {
        origin: { lat: oLat, lng: oLng },
        destination: { lat: dLat, lng: dLng },
        waypoints: [{ location: ROCADE_WAYPOINT, stopover: false }],
        provideRouteAlternatives: true,
        travelMode: api.maps.TravelMode.DRIVING,
        region: "fr",
      },
      (result: GoogleDirectionsResult | null, status: string) => {
        if (status !== api.maps.DirectionsStatus.OK || !result?.routes?.length) {
          reject(new Error(`Directions API: ${status}`));
          return;
        }
        const route = pickLongestRoute(result.routes);
        const distanceKm =
          (route.legs ?? []).reduce((sum: number, l: any) => sum + (l?.distance?.value ?? 0), 0) / 1000;
        const coords = route.overview_polyline ? decodePolyline(route.overview_polyline as unknown as string) : [];
        resolve({ distanceKm, coords });
      },
    );
  });
}

/**
 * Calcule durée (secondes) + distance (km) — tient compte du trafic temps réel
 * si disponible, contrairement à l'ancien calcul OSRM statique.
 */
export async function getDistanceAndDurationKm(origin: LngLat, dest: LngLat): Promise<DurationResult | null> {
  try {
    const api = await loadGoogleMaps();
    const service = await getDirectionsService();
    const [oLng, oLat] = origin;
    const [dLng, dLat] = dest;
    const result = await new Promise<GoogleDirectionsResult>((resolve, reject) => {
      service.route(
        {
          origin: { lat: oLat, lng: oLng },
          destination: { lat: dLat, lng: dLng },
          waypoints: [{ location: ROCADE_WAYPOINT, stopover: false }],
          provideRouteAlternatives: true,
          travelMode: api.maps.TravelMode.DRIVING,
          region: "fr",
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: api.maps.TrafficModel.BEST_GUESS,
          },
        },
        (res: GoogleDirectionsResult | null, status: string) => {
          if (status !== api.maps.DirectionsStatus.OK || !res?.routes?.length) {
            reject(new Error(`Directions API: ${status}`));
            return;
          }
          resolve(res);
        },
      );
    });
    const route = pickLongestRoute(result.routes);
    const legs = route.legs ?? [];
    if (!legs.length) return null;
    const dureeS = legs.reduce(
      (sum: number, l: any) => sum + (l.duration_in_traffic?.value ?? l.duration?.value ?? 0),
      0,
    );
    const distanceKm = legs.reduce((sum: number, l: any) => sum + (l?.distance?.value ?? 0), 0) / 1000;
    return { dureeS, distanceKm };
  } catch {
    return null;
  }
}

/**
 * Conservé pour compat : avec Google Directions, la distance retournée est
 * déjà réelle (routière), donc pas de calibration nécessaire — on renvoie
 * la valeur telle quelle.
 */
export function calibrateKm(rawKm: number): number {
  return rawKm;
}
