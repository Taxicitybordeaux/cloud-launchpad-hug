// Full client reset:
//  - Unregister ANY service worker still installed on this origin (legacy
//    Workbox / vite-plugin-pwa / hand-rolled SWs from older builds).
//  - Wipe Cache Storage so no stale HTML/JS chunks can be served.
//  - On a new APP_VERSION, force a single hard reload so users always land
//    on the latest deploy on mobile and desktop.
import { APP_VERSION } from "@/lib/version";

const VERSION_KEY = "app:version";
const RELOADED_FLAG = "app:version-reloaded";

function isLovablePreviewHost(hostname: string): boolean {
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  return false;
}

async function unregisterAllServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  let didUnregister = false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      // Keep Firebase Cloud Messaging worker — required for push notifications.
      const url =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      if (url.includes("firebase-messaging-sw")) continue;
      const ok = await reg.unregister();
      didUnregister = didUnregister || ok;
    }
  } catch {
    /* noop */
  }
  return didUnregister;
}

async function clearAppCaches(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  let didClear = false;
  try {
    const names = await caches.keys();
    for (const name of names) {
      // Preserve FCM caches (separate scope), wipe everything else.
      if (name.includes("firebase")) continue;
      const ok = await caches.delete(name);
      didClear = didClear || ok;
    }
  } catch {
    /* noop */
  }
  return didClear;
}

export async function registerPWA(): Promise<void> {
  if (typeof window === "undefined") return;

  const inIframe = window.self !== window.top;
  const previewHost = isLovablePreviewHost(window.location.hostname);

  // Always purge stale SWs and caches — both in preview and in production.
  const unregistered = await unregisterAllServiceWorkers();
  const cleared = await clearAppCaches();

  // Skip the version check / hard reload inside the Lovable editor iframe
  // (would create a reload loop in preview).
  if (inIframe || previewHost) return;

  try {
    const stored = window.localStorage.getItem(VERSION_KEY);
    const alreadyReloaded = window.sessionStorage.getItem(RELOADED_FLAG) === APP_VERSION;

    if (stored !== APP_VERSION) {
      window.localStorage.setItem(VERSION_KEY, APP_VERSION);
      if (!alreadyReloaded && (stored !== null || unregistered || cleared)) {
        window.sessionStorage.setItem(RELOADED_FLAG, APP_VERSION);
        // Hard reload with cache-busting query so the document, manifest and
        // icons are all re-fetched from the network.
        const u = new URL(window.location.href);
        u.searchParams.set("_v", APP_VERSION);
        window.location.replace(u.toString());
      }
    }
  } catch {
    /* noop */
  }
}
