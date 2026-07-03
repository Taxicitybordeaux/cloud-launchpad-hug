// Traductions serveur pour les notifications push CLIENT.
// Indépendant de src/i18n/dict.ts (qui est côté front) pour éviter les
// imports cross-bundle ; garder les clés synchronisées si le wording change.

export type PushLang = "fr" | "en" | "es" | "pt" | "it" | "ar";

export const SUPPORTED_PUSH_LANGS: readonly PushLang[] = ["fr", "en", "es", "pt", "it", "ar"];

export function normalizePushLang(lang: unknown): PushLang {
  return (SUPPORTED_PUSH_LANGS as readonly string[]).includes(lang as string) ? (lang as PushLang) : "fr";
}

type PushClientStrings = {
  pending_title: string;
  pending_body: (trajet: string) => string;
};

const PUSH_CLIENT_I18N: Record<PushLang, PushClientStrings> = {
  fr: {
    pending_title: "⏳ Réservation reçue",
    pending_body: (trajet) => `En attente de validation par le taxi : ${trajet}.`,
  },
  en: {
    pending_title: "⏳ Booking received",
    pending_body: (trajet) => `Waiting for driver confirmation: ${trajet}.`,
  },
  es: {
    pending_title: "⏳ Reserva recibida",
    pending_body: (trajet) => `Esperando la validación del taxi: ${trajet}.`,
  },
  pt: {
    pending_title: "⏳ Reserva recebida",
    pending_body: (trajet) => `A aguardar a validação do táxi: ${trajet}.`,
  },
  it: {
    pending_title: "⏳ Prenotazione ricevuta",
    pending_body: (trajet) => `In attesa di conferma da parte del taxi: ${trajet}.`,
  },
  ar: {
    pending_title: "⏳ تم استلام الحجز",
    pending_body: (trajet) => `في انتظار موافقة سائق التاكسي: ${trajet}.`,
  },
};

export function getPushClientStrings(lang: unknown): PushClientStrings {
  return PUSH_CLIENT_I18N[normalizePushLang(lang)];
}
