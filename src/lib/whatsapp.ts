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

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function buildReservationMessage(r: ReservationLite): string {
  const lines: string[] = ["Bonjour, je souhaite réserver un taxi avec Taxi City Bordeaux."];
  if (r.nom) lines.push(`👤 Nom : ${r.nom}`);
  if (r.telephone) lines.push(`📞 Téléphone : ${r.telephone}`);
  if (r.pickup_datetime) lines.push(`📅 Prise en charge : ${fmtDate(r.pickup_datetime)}`);
  if (r.trip_type === "aller_retour" && r.return_datetime) {
    lines.push(`🔁 Retour : ${fmtDate(r.return_datetime)}`);
  }
  if (r.depart) lines.push(`📍 Départ : ${r.depart}`);
  if (r.arrivee) lines.push(`🏁 Arrivée : ${r.arrivee}`);
  const px = r.passagers ? `${r.passagers} passager(s)` : "";
  const bg = r.bagages ? `${r.bagages} bagage(s)` : "";
  if (px || bg) lines.push(`🎒 ${[px, bg].filter(Boolean).join(" • ")}`);
  if (r.service_type && r.service_type !== "standard") lines.push(`🚖 Type : ${r.service_type}`);
  const extras: string[] = [];
  if (r.needs_cpam) extras.push("Conventionné CPAM");
  if (r.needs_baggage_help) extras.push("Assistance bagages");
  if (r.needs_child_seat) extras.push("Siège enfant");
  if (extras.length) lines.push(`✨ Besoins : ${extras.join(", ")}`);
  if (r.message) lines.push(`📝 Message : ${r.message}`);
  if (r.reservation_id) lines.push(`\n#Réservation ${r.reservation_id.slice(0, 8).toUpperCase()}`);
  lines.push("\nMerci de me confirmer la disponibilité.");
  return lines.join("\n");
}

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
