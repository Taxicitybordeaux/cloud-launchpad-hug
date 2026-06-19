// Runtime permission helpers (mic + geolocation).
// All functions are SAFE to call from client code; they degrade gracefully on
// browsers that don't expose the Permissions API (older Safari, in-app webviews).

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

async function queryPermission(name: PermissionName): Promise<PermissionState> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name });
    return status.state as PermissionState;
  } catch {
    return "unsupported";
  }
}

// ─────────────────────────── Microphone ───────────────────────────

export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true || window.location.hostname === "localhost";
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export async function getMicPermission(): Promise<PermissionState> {
  return queryPermission("microphone" as PermissionName);
}

/**
 * Ensure mic access. Returns:
 *  - { ok: true }                              → caller may start recognition
 *  - { ok: false, reason: <french message> }   → caller MUST show the message
 */
export async function ensureMicAccess(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isSecureContext()) {
    return {
      ok: false,
      reason: "Le micro nécessite une connexion sécurisée (HTTPS). Ouvrez le site en HTTPS pour utiliser la dictée vocale.",
    };
  }
  if (!isSpeechRecognitionSupported()) {
    return {
      ok: false,
      reason:
        "La dictée vocale n'est pas supportée par ce navigateur. Utilisez Chrome (Android) ou Safari récent (iOS), ou saisissez votre adresse.",
    };
  }
  // Pre-check: if Permissions API says denied, no need to even try.
  const perm = await getMicPermission();
  if (perm === "denied") {
    return {
      ok: false,
      reason:
        "L'accès au micro est bloqué. Ouvrez les réglages du navigateur (cadenas dans la barre d'adresse) et autorisez le micro pour ce site.",
    };
  }
  // Try a real getUserMedia request — this is what actually triggers the prompt.
  // We release the track immediately; SpeechRecognition gets its own stream.
  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      const name = err?.name as string | undefined;
      if (name === "NotAllowedError" || name === "SecurityError") {
        return {
          ok: false,
          reason:
            "Vous avez refusé l'accès au micro. Touchez le cadenas dans la barre d'adresse, autorisez le micro, puis réessayez.",
        };
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        return { ok: false, reason: "Aucun micro détecté sur cet appareil." };
      }
      if (name === "NotReadableError") {
        return {
          ok: false,
          reason: "Le micro est utilisé par une autre application. Fermez-la puis réessayez.",
        };
      }
      // Otherwise let recognition try anyway; SpeechRecognition can sometimes work
      // even when getUserMedia fails (in-app webviews).
    }
  }
  return { ok: true };
}

// ─────────────────────────── Geolocation ──────────────────────────

export async function getGeoPermission(): Promise<PermissionState> {
  return queryPermission("geolocation" as PermissionName);
}

/**
 * Translate a GeolocationPositionError into a clear French message
 * with platform-specific hints.
 */
export function describeGeoError(err: GeolocationPositionError, online = navigator?.onLine ?? true): string {
  if (!online) {
    return "Hors-ligne : impossible de géolocaliser. Reconnectez-vous au réseau ou saisissez l'adresse exacte.";
  }
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Localisation refusée. Activez la localisation pour ce site dans les réglages du navigateur (cadenas dans la barre d'adresse).";
    case err.POSITION_UNAVAILABLE:
      return "Position GPS indisponible (signal trop faible ou GPS désactivé). Sortez à l'extérieur ou saisissez l'adresse exacte.";
    case err.TIMEOUT:
      return "Le GPS met trop de temps à répondre (réseau lent ?). Réessayez ou saisissez l'adresse exacte.";
    default:
      return "Impossible de récupérer votre position. Saisissez l'adresse exacte de départ.";
  }
}
