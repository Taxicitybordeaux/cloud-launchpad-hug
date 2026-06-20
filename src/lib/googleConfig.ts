// lib/googleConfig.ts
// Configuration centralisée de la clé Google Maps + vérification au démarrage.
// Importé par googleMaps.ts (chargement SDK) et par le root route (warning dev).

// Priorité : clé custom du projet (autorisée sur le domaine personnalisé taxicitybordeaux.fr),
// sinon clé browser du connecteur Lovable Google Maps Platform (*.lovable.app uniquement).
export const GOOGLE_MAPS_API_KEY: string | undefined =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ||
  undefined;

export const GOOGLE_MAPS_TRACKING_ID: string | undefined =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ||
  undefined;

export const GOOGLE_MAPS_LIBRARIES = "places,geometry" as const;
export const GOOGLE_MAPS_LANGUAGE = "fr" as const;
export const GOOGLE_MAPS_REGION = "FR" as const;

export type GoogleConfigStatus =
  | { ok: true; key: string }
  | { ok: false; reason: string };

export function getGoogleConfigStatus(): GoogleConfigStatus {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.trim().length === 0) {
    return {
      ok: false,
      reason:
        "VITE_GOOGLE_MAPS_API_KEY manquant — ajoute la clé dans le fichier .env puis redémarre le serveur.",
    };
  }
  return { ok: true, key: GOOGLE_MAPS_API_KEY };
}

let warned = false;
/**
 * Vérification au démarrage. À appeler une fois côté client (root route).
 * En dev : log un warning visible si la clé est absente.
 * En prod : silencieux (le rejet de loadGoogleMaps remontera l'erreur UI).
 */
export function assertGoogleConfigOnStartup(): void {
  if (warned || typeof window === "undefined") return;
  warned = true;
  const status = getGoogleConfigStatus();
  if (!status.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[google-config] ${status.reason}`);
  }
}
