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

// Lieux clés de Bordeaux dont la Geocoding API se trompe régulièrement
// (elle est conçue pour des adresses, pas des POI/lieux-dits — un aéroport,
// une gare ou une place peuvent être résolus sur une rue homonyme proche du
// centre-ville plutôt que le vrai lieu, faussant les distances calculées).
// Même correctif que celui déjà appliqué côté ATB : on court-circuite
// Google pour ces requêtes avec des coordonnées vérifiées.
const CANONICAL_PLACES: Array<{ match: RegExp; label: string; coord: GeoCoord }> = [
  {
    match: /a[eé]roport|merignac|m[ée]rignac/i,
    label: "Aéroport de Bordeaux-Mérignac",
    coord: { lat: 44.8283, lng: -0.7156 },
  },
  {
    match: /gare\s*saint[\s-]?jean|st[\s-]?jean.*gare|gare.*st[\s-]?jean/i,
    label: "Gare de Bordeaux-Saint-Jean",
    coord: { lat: 44.8256, lng: -0.5563 },
  },
  { match: /place\s*de\s*la\s*bourse/i, label: "Place de la Bourse", coord: { lat: 44.8412, lng: -0.5697 } },
  { match: /place\s*(des\s*)?quinconces/i, label: "Esplanade des Quinconces", coord: { lat: 44.8459, lng: -0.5733 } },
];

function matchCanonicalPlace(query: string): GeoCoord | null {
  const found = CANONICAL_PLACES.find((p) => p.match.test(query));
  return found ? found.coord : null;
}

/**
 * Géocode une adresse texte → coordonnées. Retourne null si rien trouvé.
 * Même signature que l'ancien geocodeAddress (Nominatim).
 */
export async function geocodeAddress(query: string): Promise<GeoCoord | null> {
  const canonical = matchCanonicalPlace(query);
  if (canonical) return canonical;
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
  const canonical = CANONICAL_PLACES.find((p) => p.match.test(query));
  if (canonical) return [{ coord: [canonical.coord.lat, canonical.coord.lng], label: canonical.label }];
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

let autocompleteService: GoogleAutocompleteService | null = null;
let placesService: GooglePlacesService | null = null;

async function getAutocompleteService() {
  if (autocompleteService) return autocompleteService;
  const g = await loadGoogleMaps();
  const nextAutocompleteService = new g.maps.places.AutocompleteService();
  autocompleteService = nextAutocompleteService;
  return nextAutocompleteService;
}

async function getPlacesService() {
  if (placesService) return placesService;
  const api = await loadGoogleMaps();
  const div = document.createElement("div");
  const nextPlacesService = new api.maps.places.PlacesService(div);
  placesService = nextPlacesService;
  return nextPlacesService;
}

export type PlaceSuggestion = { placeId: string; description: string };

/**
 * Suggestions d'adresses en temps réel pendant la saisie (debounce à gérer
 * côté composant). Biaisé sur Bordeaux/Gironde.
 */
export async function getAddressSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.trim().length < 3) return [];
  try {
    const api = await loadGoogleMaps();
    const service = await getAutocompleteService();
    const predictions = await new Promise<GoogleAutocompletePrediction[] | null>((resolve) => {
      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "fr" },
          location: new api.maps.LatLng(44.8378, -0.5792),
          radius: 80_000,
        },
        (preds: GoogleAutocompletePrediction[] | null, status: string) => {
          if (status !== api.maps.places.PlacesServiceStatus.OK || !preds) {
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
    const api = await loadGoogleMaps();
    const service = await getPlacesService();
    const place = await new Promise<GooglePlaceResult | null>((resolve) => {
      service.getDetails({ placeId, fields: ["geometry"] }, (result: GooglePlaceResult | null, status: string) => {
        if (status !== api.maps.places.PlacesServiceStatus.OK || !result?.geometry?.location) {
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
