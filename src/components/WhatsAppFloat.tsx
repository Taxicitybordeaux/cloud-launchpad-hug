import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "33673072322"; // Format international, sans +
const DEFAULT_MESSAGE =
  "Bonjour, je souhaite réserver un taxi avec Taxi City Bordeaux. Pouvez-vous me confirmer la disponibilité ? Merci.";

export function WhatsAppFloat({ message = DEFAULT_MESSAGE }: { message?: string }) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Discuter sur WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#20bd5a]"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
