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
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#20bd5a]"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">
        {draft ? t("wa.float.send") : t("wa.float.label")}
      </span>
    </a>
  );
}
