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

  return (
    <>
      {/* Mobile: full-width sticky bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:hidden"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="flex w-full items-center justify-center gap-3 rounded-full bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-2xl shadow-black/40 ring-2 ring-[#25D366]/30 transition active:scale-95"
        >
          <span className="relative flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
            <MessageCircle className="relative h-7 w-7" />
          </span>
          <span>{label}</span>
        </a>
      </div>

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
