import { supabase } from "@/integrations/supabase/client";

export type CtaEvent = {
  /** Logical event name, e.g. "whatsapp_click", "phone_click". */
  event_type: string;
  /** Variant of the CTA, e.g. "mobile_sticky" / "desktop_float". */
  variant?: string;
  /** Whether a prefilled reservation draft was attached. */
  has_draft?: boolean;
  /** Current UI language. */
  lang?: string;
};

/**
 * Fire-and-forget CTA tracker.
 *
 * - Never blocks navigation (the WhatsApp link opens immediately even if
 *   the network call is slow or fails).
 * - Silently swallows errors so analytics never breaks the UX.
 * - Safe in SSR: no-ops when `window` is unavailable.
 */
export function trackCtaClick(event: CtaEvent): void {
  if (typeof window === "undefined") return;

  const payload = {
    event_type: event.event_type,
    variant: event.variant ?? null,
    has_draft: event.has_draft ?? null,
    lang: event.lang ?? null,
    page: window.location.pathname + window.location.search,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent || null,
  };

  // Don't await — let the click navigate to WhatsApp without delay.
  void supabase
    .from("site_analytics")
    .insert({
      event: event.event_type,
      session_id: `cta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[analytics] site_analytics insert failed:", error.message);
      }
    });
}
