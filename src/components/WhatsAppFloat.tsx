import { MessageCircle } from "lucide-react";
import { useReservationDraft } from "@/lib/reservation-draft";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";
import { useI18n } from "@/i18n/I18nProvider";

export function WhatsAppFloat() {
  const { t, lang } = useI18n();
  const draft = useReservationDraft();
  const message = draft ? buildReservationMessage(draft, lang) : t("wa.default");
  const href = whatsappLink(message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="group fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-full bg-[#25D366] px-7 py-5 text-base font-bold text-white shadow-2xl shadow-black/40 ring-4 ring-[#25D366]/30 transition hover:scale-105 hover:bg-[#20bd5a] hover:ring-[#25D366]/50 sm:text-lg"
    >
      <span className="relative flex h-8 w-8 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
        <MessageCircle className="relative h-8 w-8" />
      </span>
      <span className="hidden sm:inline">
        {draft ? t("wa.float.send") : t("wa.float.label")}
      </span>
    </a>
  );
}
