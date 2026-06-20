// Polls the deployed HTML for a newer APP_VERSION and reloads once so users
// always run the latest deployed build.
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/version";

const POLL_MS = 60_000; // 1 min
const META_RE = /<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i;
const AUTO_RELOAD_KEY = "app:auto-reloaded-version";

let started = false;
let notified = false;

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "text/html" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(META_RE);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function promptUpdate(remote: string) {
  if (notified) return;
  notified = true;
  toast("Nouvelle version disponible", {
    description: `Version ${remote} — rechargez pour mettre à jour.`,
    duration: Infinity,
    action: {
      label: "Mettre à jour maintenant",
      onClick: () => {
        try {
          window.sessionStorage.removeItem("app:version-reloaded");
        } catch {
          /* noop */
        }
        const u = new URL(window.location.href);
        u.searchParams.set("_v", remote);
        window.location.replace(u.toString());
      },
    },
  });
}

function reloadToVersion(remote: string) {
  try {
    if (window.sessionStorage.getItem(AUTO_RELOAD_KEY) === remote) {
      promptUpdate(remote);
      return;
    }
    window.sessionStorage.setItem(AUTO_RELOAD_KEY, remote);
    window.sessionStorage.removeItem("app:version-reloaded");
  } catch {
    /* noop */
  }
  const u = new URL(window.location.href);
  u.searchParams.set("_v", remote);
  window.location.replace(u.toString());
}

async function check() {
  if (document.visibilityState !== "visible") return;
  const remote = await fetchRemoteVersion();
  if (remote && remote !== APP_VERSION) reloadToVersion(remote);
}

export function startVersionWatcher(): void {
  if (typeof window === "undefined" || started) return;
  started = true;

  // Don't run inside the Lovable editor iframe.
  if (window.self !== window.top) return;

  const tick = () => void check();
  window.setTimeout(tick, 10_000); // first check after 10s
  window.setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("focus", tick);
}
