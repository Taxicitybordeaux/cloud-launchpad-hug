import { toast } from "sonner";

/**
 * Build the public real-time tracking URL for a reservation.
 * Prefers suivi_id (short opaque key), falls back to id.
 */
export function buildSuiviUrl(opts: { suivi_id?: string | null; tracking_id?: string | null; id: string }): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://taxicitybordeaux.fr";
  const key = opts.suivi_id || opts.tracking_id || opts.id;
  return `${origin}/suivi/${key}`;
}

/**
 * Share a live ride tracking link with a loved one.
 * Uses the native Web Share API when available, otherwise copies to clipboard.
 */
export async function shareRideTracking(opts: {
  suivi_id?: string | null;
  tracking_id?: string | null;
  id: string;
  depart?: string | null;
  destination?: string | null;
}): Promise<void> {
  const url = buildSuiviUrl(opts);
  const dest = opts.destination || "votre destination";
  const text = `Je suis en route avec Taxi City Bordeaux vers ${dest}. Suivez ma course en direct ici 👉 ${url}`;
  const title = "Suivi de ma course en direct";

  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title, text, url });
      return;
    }
  } catch (err: any) {
    // User cancelled or share failed — fall back to clipboard.
    if (err?.name === "AbortError") return;
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success("Lien de suivi copié — partagez-le avec un proche");
  } catch {
    toast.error("Impossible de copier le lien");
  }
}
