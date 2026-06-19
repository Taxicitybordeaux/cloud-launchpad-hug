// PWA registration wrapper — registers /sw.js only in production,
// outside Lovable preview/iframe, and respects ?sw=off kill-switch.
const APP_SW_PATH = "/sw.js";

function isLovablePreviewHost(hostname: string): boolean {
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const url = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || "";
      if (url.endsWith(APP_SW_PATH) || url.endsWith("/service-worker.js")) {
        await reg.unregister();
      }
    }
  } catch {
    /* noop */
  }
}

export async function registerPWA(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const off = new URL(window.location.href).searchParams.get("sw") === "off";
  const isDev = !import.meta.env.PROD;
  const previewHost = isLovablePreviewHost(window.location.hostname);

  if (isDev || inIframe || previewHost || off) {
    await unregisterAppSW();
    return;
  }

  try {
    await navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" });
  } catch {
    /* noop */
  }
}
