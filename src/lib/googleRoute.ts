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

let directionsService: GoogleDirectionsService | null = null;
async function getDirectionsService() {
  if (directionsService) return directionsService;
  const g = await loadGoogleMaps();
  const nextDirectionsService = new g.maps.DirectionsService();
  directionsService = nextDirectionsService;
  return nextDirectionsService;
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
          travelMode: api.maps.TravelMode.DRIVING,
        region: "fr",
      },
      (result: GoogleDirectionsResult | null, status: string) => {
        if (status !== api.maps.DirectionsStatus.OK || !result?.routes?.[0]) {
          reject(new Error(`Directions API: ${status}`));
          return;
        }
        const route = result.routes[0];
        const leg = route.legs[0];
        const distanceKm = (leg?.distance?.value ?? 0) / 1000;
        const coords = route.overview_polyline
          ? decodePolyline(route.overview_polyline as unknown as string)
          : [];
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
          travelMode: api.maps.TravelMode.DRIVING,
          region: "fr",
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: api.maps.TrafficModel.BEST_GUESS,
          },
        },
        (res: GoogleDirectionsResult | null, status: string) => {
          if (status !== api.maps.DirectionsStatus.OK || !res) {
            reject(new Error(`Directions API: ${status}`));
            return;
          }
          resolve(res);
        },
      );
    });
    const leg = result.routes[0]?.legs[0];
    if (!leg) return null;
    const dureeS = leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
    const distanceKm = (leg.distance?.value ?? 0) / 1000;
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
