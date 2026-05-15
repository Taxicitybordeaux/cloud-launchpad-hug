import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useReservationDraft } from "@/lib/reservation-draft";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";
import { useI18n } from "@/i18n/I18nProvider";
import { trackCtaClick } from "@/lib/analytics";

export function WhatsAppFloat() {
  const { t, lang } = useI18n();
  const location = useLocation();
  const isTrackingPage =
    location.pathname.startsWith("/tracking/") ||
    location.pathname.startsWith("/suivi/") ||
    location.pathname.startsWith("/reservation/") ||
    location.pathname.startsWith("/scan/");
  const draft = useReservationDraft();
  const message = draft ? buildReservationMessage(draft, lang) : t("wa.default");
  const href = whatsappLink(message);
  const label = draft ? t("wa.float.send") : t("wa.float.label");
  const hint = t("wa.aria.hint");
  // Combined accessible name read by screen readers (visible text + extra context).
  const ariaLabel = `${label}. ${hint}`;
  // Announced politely when the draft becomes available, so SR users know
  // the CTA now sends their filled-in reservation rather than a generic message.
  const liveMessage = draft ? t("wa.aria.draftReady") : "";

  const handleClick = (variant: "mobile_sticky" | "desktop_float") => () => {
    trackCtaClick({
      event_type: "whatsapp_click",
      variant,
      has_draft: Boolean(draft),
      lang,
    });
  };

  // Measure the mobile sticky bar so the page-content spacer below
  // always matches its real height (label length, line wraps, safe-area
  // inset, dynamic font sizes…) on every screen size.
  const mobileBarRef = useRef<HTMLDivElement | null>(null);
  const [mobileBarHeight, setMobileBarHeight] = useState<number>(0);

  useEffect(() => {
    const el = mobileBarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setMobileBarHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Also re-measure on viewport changes (orientation, dynamic toolbar, font scale).
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [label]);

  if (isTrackingPage) return null;

  return (
    <>
      {/* Mobile: small floating icon button (bottom-right) */}
      <div
        ref={mobileBarRef}
        className="fixed bottom-3 right-3 z-50 pb-[max(env(safe-area-inset-bottom),0px)] sm:hidden"
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          title={label}
          onClick={handleClick("mobile_sticky")}
          onAuxClick={handleClick("mobile_sticky")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/40 ring-2 ring-[#25D366]/30 transition active:scale-95"
        >
          <span aria-hidden="true" className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
            <MessageCircle className="relative h-6 w-6" />
          </span>
        </a>
      </div>

      {/* Desktop: floating bubble bottom-right */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        onClick={handleClick("desktop_float")}
        onAuxClick={handleClick("desktop_float")}
        className="group fixed bottom-6 right-6 z-50 hidden items-center gap-3 rounded-full bg-[#25D366] px-7 py-5 text-lg font-bold text-white shadow-2xl shadow-black/40 ring-4 ring-[#25D366]/30 transition hover:scale-105 hover:bg-[#20bd5a] hover:ring-[#25D366]/50 sm:inline-flex"
      >
        <span aria-hidden="true" className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
          <MessageCircle className="relative h-8 w-8" />
        </span>
        <span>{label}</span>
      </a>

      {/* Polite live region: announces when the CTA switches from
          "send a generic message" to "send the user's filled draft". */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </>
  );
}
