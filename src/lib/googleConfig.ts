// lib/googleConfig.ts
// Configuration centralisée de la clé Google Maps + vérification au démarrage.
// Importé par googleMaps.ts (chargement SDK) et par le root route (warning dev).

const cleanEnv = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

// Priorité au connecteur Google Maps Platform : en mode custom, c'est cette
// variable qui contient la clé autorisée pour taxicitybordeaux.fr. L'ancienne
// VITE_GOOGLE_MAPS_API_KEY reste en fallback pour éviter un écran noir si elle
// est la seule présente.
const CONNECTOR_BROWSER_KEY = cleanEnv(import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY);
const PROJECT_BROWSER_KEY = cleanEnv(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

export const GOOGLE_MAPS_API_KEYS: string[] = Array.from(
  new Set([CONNECTOR_BROWSER_KEY, PROJECT_BROWSER_KEY].filter(Boolean) as string[]),
);

export const GOOGLE_MAPS_API_KEY: string | undefined = GOOGLE_MAPS_API_KEYS[0];

export function getGoogleMapsApiKeysForCurrentHost(): string[] {
  // La clé .env du projet (VITE_GOOGLE_MAPS_API_KEY) est toujours prioritaire :
  // c'est elle qui porte les restrictions HTTP referrer pour taxicitybordeaux.fr.
  // La clé du connecteur Lovable (limitée à *.lovable.app / *.lovableproject.com)
  // ne sert que de filet de secours sur les domaines de preview.
  const ordered = [PROJECT_BROWSER_KEY, CONNECTOR_BROWSER_KEY];
  return Array.from(new Set(ordered.filter(Boolean) as string[]));
}

export const GOOGLE_MAPS_TRACKING_ID: string | undefined =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) || undefined;

export const GOOGLE_MAPS_LIBRARIES = "places,geometry" as const;
export const GOOGLE_MAPS_LANGUAGE = "fr" as const;
export const GOOGLE_MAPS_REGION = "FR" as const;

export type GoogleConfigStatus = { ok: true; key: string } | { ok: false; reason: string };

export function getGoogleConfigStatus(): GoogleConfigStatus {
  if (GOOGLE_MAPS_API_KEYS.length === 0) {
    return {
      ok: false,
      reason: "Clé Google Maps manquante — reconnecte Google Maps Platform en mode custom puis republie l'application.",
    };
  }
  return { ok: true, key: GOOGLE_MAPS_API_KEYS[0] };
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
