// lib/googleGeocode.ts
// Remplace lib/geocode.ts — mêmes signatures (drop-in), implémenté avec
// Google Geocoding API au lieu de Nominatim.

import { loadGoogleMaps } from "./googleMaps";

export type GeoCoord = { lat: number; lng: number };
export type SearchResult = { coord: [number, number]; label: string };

type GoogleGeocoder = any;
type GoogleGeocoderResult = any;
type GoogleAutocompleteService = any;
type GooglePlacesService = any;
type GoogleAutocompletePrediction = any;
type GooglePlaceResult = any;

let geocoder: GoogleGeocoder | null = null;
async function getGeocoder() {
  if (geocoder) return geocoder;
  const g = await loadGoogleMaps();
  const nextGeocoder = new g.maps.Geocoder();
  geocoder = nextGeocoder;
  return nextGeocoder;
}

// Bordeaux — biais de zone pour préférer les résultats locaux (comme l'ancien
// rayon de validation 80km Nominatim), sans bloquer les résultats hors zone.
const BORDEAUX_BOUNDS = {
  north: 45.2,
  south: 44.5,
  west: -1.0,
  east: 0.1,
};

/**
 * Géocode une adresse texte → coordonnées. Retourne null si rien trouvé.
 * Même signature que l'ancien geocodeAddress (Nominatim).
 */
export async function geocodeAddress(query: string): Promise<GeoCoord | null> {
  try {
    const api = await loadGoogleMaps();
    const g = await getGeocoder();
    const result = await new Promise<GoogleGeocoderResult[] | null>((resolve) => {
      g.geocode(
        {
          address: query,
          region: "fr",
          bounds: new api.maps.LatLngBounds(
            { lat: BORDEAUX_BOUNDS.south, lng: BORDEAUX_BOUNDS.west },
            { lat: BORDEAUX_BOUNDS.north, lng: BORDEAUX_BOUNDS.east },
          ),
        },
        (results: GoogleGeocoderResult[] | null, status: string) => {
          if (status !== api.maps.GeocoderStatus.OK || !results?.length) {
            resolve(null);
            return;
          }
          resolve(results);
        },
      );
    });
    if (!result?.[0]) return null;
    const loc = result[0].geometry.location;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}

/**
 * Recherche d'adresses avec plusieurs résultats (autocomplete-like).
 * Même signature que l'ancien searchAddress(query, limit).
 */
export async function searchAddress(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const api = await loadGoogleMaps();
    const g = await getGeocoder();
    const results = await new Promise<GoogleGeocoderResult[] | null>((resolve) => {
      g.geocode(
        {
          address: query,
          region: "fr",
          bounds: new api.maps.LatLngBounds(
            { lat: BORDEAUX_BOUNDS.south, lng: BORDEAUX_BOUNDS.west },
            { lat: BORDEAUX_BOUNDS.north, lng: BORDEAUX_BOUNDS.east },
          ),
        },
        (res: GoogleGeocoderResult[] | null, status: string) => {
          if (status !== api.maps.GeocoderStatus.OK || !res?.length) {
            resolve(null);
            return;
          }
          resolve(res);
        },
      );
    });
    if (!results) return [];
    return results.slice(0, limit).map((r) => ({
      coord: [r.geometry.location.lat(), r.geometry.location.lng()] as [number, number],
      label: r.formatted_address,
    }));
  } catch {
    return [];
  }
}

/**
 * Reverse geocoding : coordonnées → adresse formatée la plus proche.
 * Retourne null si rien trouvé.
 * Utilisé pour : pré-remplir l'adresse de départ après géolocalisation
 * navigateur, et enrichir le label des POIs sans rue connue (supermarchés…).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const api = await loadGoogleMaps();
    const g = await getGeocoder();
    const results = await new Promise<GoogleGeocoderResult[] | null>((resolve) => {
      g.geocode({ location: { lat, lng } }, (res: GoogleGeocoderResult[] | null, status: string) => {
        if (status !== api.maps.GeocoderStatus.OK || !res?.length) {
          resolve(null);
          return;
        }
        resolve(res);
      });
    });
    if (!results?.[0]) return null;
    return results[0].formatted_address;
  } catch {
    return null;
  }
}

// ── Autocomplete temps réel (saisie utilisateur) ────────────────────────────

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;

async function getAutocompleteService() {
  if (autocompleteService) return autocompleteService;
  const g = await loadGoogleMaps();
  autocompleteService = new g.maps.places.AutocompleteService();
  return autocompleteService;
}

async function getPlacesService() {
  if (placesService) return placesService;
  await loadGoogleMaps();
  const div = document.createElement("div");
  placesService = new google.maps.places.PlacesService(div);
  return placesService;
}

export type PlaceSuggestion = { placeId: string; description: string };

/**
 * Suggestions d'adresses en temps réel pendant la saisie (debounce à gérer
 * côté composant). Biaisé sur Bordeaux/Gironde.
 */
export async function getAddressSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.trim().length < 3) return [];
  try {
    const service = await getAutocompleteService();
    const predictions = await new Promise<google.maps.places.AutocompletePrediction[] | null>((resolve) => {
      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "fr" },
          location: new google.maps.LatLng(44.8378, -0.5792),
          radius: 80_000,
        },
        (preds, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !preds) {
            resolve(null);
            return;
          }
          resolve(preds);
        },
      );
    });
    if (!predictions) return [];
    return predictions.map((p) => ({ placeId: p.place_id, description: p.description }));
  } catch {
    return [];
  }
}

/**
 * Résout un placeId (choisi dans les suggestions) en coordonnées précises.
 */
export async function resolvePlaceId(placeId: string): Promise<GeoCoord | null> {
  try {
    const service = await getPlacesService();
    const place = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
      service.getDetails({ placeId, fields: ["geometry"] }, (result, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !result?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve(result);
      });
    });
    const loc = place?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat(), lng: loc.lng() };
  } catch {
    return null;
  }
}
