import type { Lang } from "@/i18n/dict";

export const WHATSAPP_NUMBER = "33673072322"; // international format, no +

export type ReservationLite = {
  nom?: string;
  telephone?: string;
  pickup_datetime?: string;
  return_datetime?: string;
  trip_type?: string;
  depart?: string;
  arrivee?: string;
  passagers?: string | number;
  bagages?: string | number;
  service_type?: string;
  needs_cpam?: boolean;
  needs_baggage_help?: boolean;
  needs_child_seat?: boolean;
  message?: string;
  reservation_id?: string;
};

const LOCALE_MAP: Record<Lang, string> = {
  fr: "fr-FR", en: "en-GB", es: "es-ES", pt: "pt-PT", it: "it-IT", ar: "ar-SA",
};

const STRINGS = {
  fr: {
    intro: "Bonjour, je souhaite réserver un taxi.",
    name: "Nom", phone: "Téléphone", pickup: "Prise en charge",
    ret: "Retour", from: "Départ", to: "Arrivée",
    pax: (n: string | number) => `${n} passager(s)`,
    bag: (n: string | number) => `${n} bagage(s)`,
    type: "Type", needs: "Besoins",
    cpam: "Conventionné CPAM", bagHelp: "Assistance bagages", child: "Siège enfant",
    msg: "Message", ref: "Réservation",
    outro: "Merci de me confirmer la disponibilité.",
  },
  en: {
    intro: "Hello, I would like to book a taxi.",
    name: "Name", phone: "Phone", pickup: "Pickup",
    ret: "Return", from: "From", to: "To",
    pax: (n: string | number) => `${n} passenger(s)`,
    bag: (n: string | number) => `${n} bag(s)`,
    type: "Type", needs: "Needs",
    cpam: "CPAM medical transport", bagHelp: "Luggage assistance", child: "Child seat",
    msg: "Message", ref: "Booking",
    outro: "Please confirm availability.",
  },
  es: {
    intro: "Hola, quisiera reservar un taxi.",
    name: "Nombre", phone: "Teléfono", pickup: "Recogida",
    ret: "Regreso", from: "Origen", to: "Destino",
    pax: (n: string | number) => `${n} pasajero(s)`,
    bag: (n: string | number) => `${n} maleta(s)`,
    type: "Tipo", needs: "Necesidades",
    cpam: "Transporte médico CPAM", bagHelp: "Asistencia equipaje", child: "Silla infantil",
    msg: "Mensaje", ref: "Reserva",
    outro: "Por favor confirme la disponibilidad.",
  },
  it: {
    intro: "Salve, vorrei prenotare un taxi.",
    name: "Nome", phone: "Telefono", pickup: "Prelievo",
    ret: "Ritorno", from: "Partenza", to: "Arrivo",
    pax: (n: string | number) => `${n} passeggero(i)`,
    bag: (n: string | number) => `${n} bagaglio(i)`,
    type: "Tipo", needs: "Esigenze",
    cpam: "Trasporto medico CPAM", bagHelp: "Aiuto bagagli", child: "Seggiolino bambino",
    msg: "Messaggio", ref: "Prenotazione",
    outro: "Vi prego di confermare la disponibilità.",
  },
  pt: {
    intro: "Olá, gostaria de reservar um táxi.",
    name: "Nome", phone: "Telefone", pickup: "Recolha",
    ret: "Regresso", from: "Partida", to: "Chegada",
    pax: (n: string | number) => `${n} passageiro(s)`,
    bag: (n: string | number) => `${n} mala(s)`,
    type: "Tipo", needs: "Necessidades",
    cpam: "Transporte médico CPAM", bagHelp: "Ajuda com bagagem", child: "Cadeira para criança",
    msg: "Mensagem", ref: "Reserva",
    outro: "Por favor, confirme a disponibilidade.",
  },
  ar: {
    intro: "مرحباً، أود حجز سيارة أجرة.",
    name: "الاسم", phone: "الهاتف", pickup: "الانطلاق",
    ret: "العودة", from: "من", to: "إلى",
    pax: (n: string | number) => `${n} راكب`,
    bag: (n: string | number) => `${n} حقيبة`,
    type: "النوع", needs: "احتياجات",
    cpam: "نقل طبي CPAM", bagHelp: "مساعدة في الأمتعة", child: "مقعد طفل",
    msg: "رسالة", ref: "حجز",
    outro: "يرجى تأكيد التوفر.",
  },
} as const;

function fmtDate(iso: string | undefined, lang: Lang): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(LOCALE_MAP[lang], { dateStyle: "full", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function buildReservationMessage(r: ReservationLite, lang: Lang = "fr"): string {
  const s = STRINGS[lang] ?? STRINGS.fr;
  const lines: string[] = [s.intro];
  if (r.nom) lines.push(`👤 ${s.name} : ${r.nom}`);
  if (r.telephone) lines.push(`📞 ${s.phone} : ${r.telephone}`);
  if (r.pickup_datetime) lines.push(`📅 ${s.pickup} : ${fmtDate(r.pickup_datetime, lang)}`);
  if (r.trip_type === "aller_retour" && r.return_datetime) {
    lines.push(`🔁 ${s.ret} : ${fmtDate(r.return_datetime, lang)}`);
  }
  if (r.depart) lines.push(`📍 ${s.from} : ${r.depart}`);
  if (r.arrivee) lines.push(`🏁 ${s.to} : ${r.arrivee}`);
  const px = r.passagers ? s.pax(r.passagers) : "";
  const bg = r.bagages ? s.bag(r.bagages) : "";
  if (px || bg) lines.push(`🎒 ${[px, bg].filter(Boolean).join(" • ")}`);
  if (r.service_type && r.service_type !== "standard") lines.push(`🚖 ${s.type} : ${r.service_type}`);
  const extras: string[] = [];
  if (r.needs_cpam) extras.push(s.cpam);
  if (r.needs_baggage_help) extras.push(s.bagHelp);
  if (r.needs_child_seat) extras.push(s.child);
  if (extras.length) lines.push(`✨ ${s.needs} : ${extras.join(", ")}`);
  if (r.message) lines.push(`📝 ${s.msg} : ${r.message}`);
  if (r.reservation_id) lines.push(`\n#${s.ref} ${r.reservation_id.slice(0, 8).toUpperCase()}`);
  lines.push(`\n${s.outro}`);
  return lines.join("\n");
}

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
