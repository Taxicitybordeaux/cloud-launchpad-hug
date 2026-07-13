// Pure, testable builders for client-facing push notification copy.
// Single source of truth shared between server functions and tests.

import type { Lang } from "@/i18n/dict";

export type PriceUpdatePush = {
  title: string;
  body: string;
};

const TITLES: Record<Lang, string> = {
  fr: "💶 Prix mis à jour",
  en: "💶 Price updated",
  es: "💶 Precio actualizado",
  pt: "💶 Preço atualizado",
  it: "💶 Prezzo aggiornato",
  ar: "💶 تم تحديث السعر",
};

// Body explicitly mentions that the change comes from the route chosen by the driver
// in Apple Plans / Google Maps (so the client understands the source of the change).
function bodyFor(lang: Lang, clientName: string, priceEur: number, distanceKm: number): string {
  const p = priceEur.toFixed(2);
  const k = distanceKm.toFixed(1);
  switch (lang) {
    case "en":
      return `Hello ${clientName}, your driver selected a route of ${k} km. New estimated fare: €${p}.`;
    case "es":
      return `Hola ${clientName}, su conductor eligió un itinerario de ${k} km. Nueva tarifa estimada: ${p} €.`;
    case "pt":
      return `Olá ${clientName}, o seu motorista escolheu um itinerário de ${k} km. Nova tarifa estimada: ${p} €.`;
    case "it":
      return `Salve ${clientName}, il suo autista ha scelto un itinerario di ${k} km. Nuova tariffa stimata: ${p} €.`;
    case "ar":
      return `مرحباً ${clientName}، اختار سائقك مساراً بطول ${k} كم. السعر التقديري الجديد: ${p} €.`;
    case "fr":
    default:
      return `Bonjour ${clientName}, votre taxi a choisi un itinéraire de ${k} km. Nouveau tarif estimé : ${p} €.`;
  }
}

export function buildPriceUpdatePush(
  lang: Lang | string | null | undefined,
  clientName: string,
  priceEur: number,
  distanceKm: number,
): PriceUpdatePush {
  const safeLang = (["fr", "en", "es", "pt", "it", "ar"].includes(lang as string) ? lang : "fr") as Lang;
  return {
    title: TITLES[safeLang],
    body: bodyFor(safeLang, clientName || "Client", priceEur, distanceKm),
  };
}
