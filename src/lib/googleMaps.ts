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
  getGoogleMapsApiKeysForCurrentHost,
} from "./googleConfig";

export type GoogleMapsApi = any;

let mapsLoadPromise: Promise<GoogleMapsApi> | null = null;
let mapsScriptAttempt = 0;

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
    const apiKeys = getGoogleMapsApiKeysForCurrentHost();
    mapsLoadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
      const cleanupFailedScript = () => {
        document.getElementById("google-maps-sdk")?.remove();
        try {
          delete (win as any).googleMapsInit;
          delete (win as any).gm_authFailure;
        } catch {
          (win as any).googleMapsInit = undefined;
          (win as any).gm_authFailure = undefined;
        }
      };

      const tryKey = (index: number) => {
        const apiKey = apiKeys[index];
        if (!apiKey) {
          cleanupFailedScript();
          reject(new Error("Impossible de charger Google Maps avec les clés configurées."));
          return;
        }
        const existing = document.getElementById("google-maps-sdk");
        if (existing) existing.remove();
        const callbackName = `googleMapsInit_${Date.now()}_${mapsScriptAttempt++}`;
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          document.getElementById("google-maps-sdk")?.remove();
          try {
            delete (win as any)[callbackName];
            delete (win as any).gm_authFailure;
          } catch {
            (win as any)[callbackName] = undefined;
            (win as any).gm_authFailure = undefined;
          }
          if (index + 1 < apiKeys.length) {
            tryKey(index + 1);
          } else {
            reject(new Error(message));
          }
        };

        (win as any)[callbackName] = () => {
          if (settled) return;
          setTimeout(() => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            try {
              delete (win as any)[callbackName];
              delete (win as any).gm_authFailure;
            } catch {
              (win as any)[callbackName] = undefined;
              (win as any).gm_authFailure = undefined;
            }
            resolve(win.google);
          }, 500);
        };
        (win as any).gm_authFailure = () => {
          fail(
            "Google Maps refuse la clé sur ce domaine. Vérifie les restrictions HTTP taxicitybordeaux.fr/* et *.taxicitybordeaux.fr/*.",
          );
        };

      const script = document.createElement("script");
      script.id = "google-maps-sdk";
      const channel = GOOGLE_MAPS_TRACKING_ID ? `&channel=${encodeURIComponent(GOOGLE_MAPS_TRACKING_ID)}` : "";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${GOOGLE_MAPS_LIBRARIES}&loading=async&callback=${encodeURIComponent(callbackName)}&language=${GOOGLE_MAPS_LANGUAGE}&region=${GOOGLE_MAPS_REGION}${channel}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => fail("Échec chargement Google Maps SDK");
      document.head.appendChild(script);
        timeoutId = setTimeout(() => fail("Google Maps met trop longtemps à répondre."), 15000);
      };

      tryKey(0);
    }).catch((err) => {
      mapsLoadPromise = null;
      throw err;
    });
  }
  return mapsLoadPromise;
}

/**
 * Attend qu'un élément DOM devienne visible dans le viewport, puis charge le SDK Google Maps.
 * Lazy-loading : aucune requête vers maps.googleapis.com tant que la carte n'est pas visible,
 * ce qui réduit l'impact sur le rendu initial et le CLS.
 */
export function loadGoogleMapsWhenVisible(
  element: Element | null | undefined,
  options: { rootMargin?: string; threshold?: number } = {},
): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadGoogleMapsWhenVisible: appelé côté serveur"));
  }
  if (!element || typeof IntersectionObserver === "undefined") {
    return loadGoogleMaps();
  }
  return new Promise<GoogleMapsApi>((resolve, reject) => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            loadGoogleMaps().then(resolve, reject);
            return;
          }
        }
      },
      { rootMargin: options.rootMargin ?? "200px", threshold: options.threshold ?? 0 },
    );
    observer.observe(element);
  });
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
