// lib/googleMaps.ts
// Loader unique du SDK Google Maps JavaScript (Maps + Places + Geometry),
// + helper de géolocalisation directe navigateur.
// Remplace le loadLeaflet() + tuiles OSM utilisés jusqu'ici.

import {
  GOOGLE_MAPS_LANGUAGE,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_REGION,
  GOOGLE_MAPS_TRACKING_ID,
  getGoogleConfigStatus,
} from "./googleConfig";

export type GoogleMapsApi = any;

let mapsLoadPromise: Promise<GoogleMapsApi> | null = null;

/**
 * Charge le SDK Google Maps une seule fois (Maps JS + Places + Geometry).
 * Retourne l'objet global `google` une fois prêt.
 */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadGoogleMaps: appelé côté serveur"));
  }
  const win = window as Window & { google?: GoogleMapsApi };
  if (win.google?.maps) {
    return Promise.resolve(win.google);
  }
  if (!mapsLoadPromise) {
    const status = getGoogleConfigStatus();
    if (!status.ok) {
      mapsLoadPromise = null;
      return Promise.reject(new Error(status.reason));
    }
    const apiKey = status.key;
    mapsLoadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
      const existing = document.getElementById("google-maps-sdk");
      if (existing) {
        existing.addEventListener("load", () => resolve(win.google));
        existing.addEventListener("error", () => reject(new Error("Échec chargement Google Maps SDK")));
        return;
      }
      const script = document.createElement("script");
      script.id = "google-maps-sdk";
      const channel = GOOGLE_MAPS_TRACKING_ID ? `&channel=${encodeURIComponent(GOOGLE_MAPS_TRACKING_ID)}` : "";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${GOOGLE_MAPS_LIBRARIES}&loading=async&language=${GOOGLE_MAPS_LANGUAGE}&region=${GOOGLE_MAPS_REGION}${channel}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(win.google);
      script.onerror = () => {
        mapsLoadPromise = null;
        reject(new Error("Échec chargement Google Maps SDK"));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      mapsLoadPromise = null;
      throw err;
    });
  }
  return mapsLoadPromise;
}


// ── Géolocalisation directe (navigateur → centre la carte) ─────────────────

export type GeoPosition = { lat: number; lng: number; accuracy?: number };

/**
 * Demande la position GPS réelle de l'appareil immédiatement (une seule fois).
 * Utilisé pour centrer la carte Google Maps dès l'ouverture de la page,
 * sans attendre une adresse saisie ou une position chauffeur.
 */
export function getCurrentPositionDirect(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null), // refus / erreur → on retombe sur le centre par défaut (Bordeaux)
      options,
    );
  });
}

/**
 * Variante "watch" si on veut suivre la position en continu (ex: chauffeur).
 * Retourne une fonction de désinscription.
 */
export function watchPositionDirect(
  onUpdate: (pos: GeoPosition) => void,
  onError?: (err: GeolocationPositionError) => void,
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    (err) => onError?.(err),
    options,
  );
  return () => navigator.geolocation.clearWatch(id);
}
