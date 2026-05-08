import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useReservationDraft } from "@/lib/reservation-draft";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";
import { useI18n } from "@/i18n/I18nProvider";

export function WhatsAppFloat() {
  const { t, lang } = useI18n();
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

  return (
    <>
      {/* Mobile: full-width sticky bar */}
      <div
        ref={mobileBarRef}
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:hidden"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-2xl shadow-black/40 ring-2 ring-[#25D366]/30 transition active:scale-95"
        >
          <span aria-hidden="true" className="relative flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
            <MessageCircle className="relative h-7 w-7" />
          </span>
          <span>{label}</span>
        </a>
      </div>

      {/* Mobile spacer — height tracks the sticky bar exactly so page
          content never sits under it, regardless of screen size. */}
      <div
        aria-hidden="true"
        className="sm:hidden"
        style={{ height: mobileBarHeight }}
      />

      {/* Desktop: floating bubble bottom-right */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        className="group fixed bottom-6 right-6 z-50 hidden items-center gap-3 rounded-full bg-[#25D366] px-7 py-5 text-lg font-bold text-white shadow-2xl shadow-black/40 ring-4 ring-[#25D366]/30 transition hover:scale-105 hover:bg-[#20bd5a] hover:ring-[#25D366]/50 sm:inline-flex"
      >
        <span className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
          <MessageCircle className="relative h-8 w-8" />
        </span>
        <span>{label}</span>
      </a>
    </>
  );
}
