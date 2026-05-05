import { MessageCircle } from "lucide-react";
import { useReservationDraft } from "@/lib/reservation-draft";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";

const DEFAULT_MESSAGE =
  "Bonjour, je souhaite réserver un taxi avec Taxi City Bordeaux. Pouvez-vous me confirmer la disponibilité ? Merci.";

export function WhatsAppFloat() {
  const draft = useReservationDraft();
  const message = draft ? buildReservationMessage(draft) : DEFAULT_MESSAGE;
  const href = whatsappLink(message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Discuter sur WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#20bd5a]"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">
        {draft ? "Envoyer ma demande" : "WhatsApp"}
      </span>
    </a>
  );
}
