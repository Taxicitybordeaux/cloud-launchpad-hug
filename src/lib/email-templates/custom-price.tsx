import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Lang = "fr" | "en" | "es" | "it" | "ar";

interface Props {
  lang?: Lang;
  nom?: string;
  pickup_datetime?: string;
  depart?: string;
  arrivee?: string;
  prix?: string | number;
  reservation_id?: string;
  unsubscribe_token?: string;
}

const STR: Record<Lang, Record<string, string>> = {
  fr: {
    preview: "Mise à jour de votre réservation",
    hi: "Bonjour",
    intro:
      "Votre réservation a été mise à jour par notre équipe. Voici les nouvelles informations concernant votre course :",
    summary: "Récapitulatif mis à jour",
    when: "Date / heure",
    from: "Départ",
    to: "Arrivée",
    price: "Prix",
    ref: "N° de réservation",
    foot: "Pour toute question : 06 73 07 23 22 — Taxi City Bordeaux",
    unsub: "Vous recevez cet email car vous avez effectué une réservation. Ne plus recevoir ces emails",
    subj: "Mise à jour de votre réservation",
  },
  en: {
    preview: "Your booking has been updated",
    hi: "Hello",
    intro: "Your booking has been updated by our team. Here are the new details for your ride:",
    summary: "Updated summary",
    when: "Date / time",
    from: "From",
    to: "To",
    price: "Price",
    ref: "Booking number",
    foot: "Any question? +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "You're receiving this email because you made a booking. Unsubscribe",
    subj: "Your booking has been updated",
  },
  es: {
    preview: "Su reserva ha sido actualizada",
    hi: "Hola",
    intro: "Su reserva ha sido actualizada por nuestro equipo. Aquí están los nuevos detalles de su viaje:",
    summary: "Resumen actualizado",
    when: "Fecha / hora",
    from: "Origen",
    to: "Destino",
    price: "Precio",
    ref: "Nº de reserva",
    foot: "¿Alguna pregunta? +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "Recibe este correo porque realizó una reserva. Cancelar suscripción",
    subj: "Su reserva ha sido actualizada",
  },
  it: {
    preview: "La sua prenotazione è stata aggiornata",
    hi: "Salve",
    intro: "La sua prenotazione è stata aggiornata dal nostro team. Ecco i nuovi dettagli della sua corsa:",
    summary: "Riepilogo aggiornato",
    when: "Data / ora",
    from: "Partenza",
    to: "Arrivo",
    price: "Prezzo",
    ref: "N° di prenotazione",
    foot: "Domande? +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "Stai ricevendo questa email perché hai effettuato una prenotazione. Annulla iscrizione",
    subj: "La sua prenotazione è stata aggiornata",
  },
  ar: {
    preview: "تم تحديث حجزك",
    hi: "مرحبا",
    intro: "تم تحديث حجزك من قبل فريقنا. إليك التفاصيل الجديدة لرحلتك:",
    summary: "الملخص المحدّث",
    when: "التاريخ / الوقت",
    from: "من",
    to: "إلى",
    price: "السعر",
    ref: "رقم الحجز",
    foot: "لأي سؤال: +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "تلقيت هذا البريد الإلكتروني لأنك أجريت حجزاً. إلغاء الاشتراك",
    subj: "تم تحديث حجزك",
  },
};

function fmtDate(iso?: string, lang: Lang = "fr"): string {
  if (!iso) return "—";
  const LOCALE: Record<Lang, string> = {
    fr: "fr-FR",
    en: "en-GB",
    es: "es-ES",
    it: "it-IT",
    ar: "ar-SA",
  };
  try {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    if (dateOnly) {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(LOCALE[lang] ?? "fr-FR", {
        dateStyle: "full",
      });
    }
    return new Date(iso).toLocaleString(LOCALE[lang] ?? "fr-FR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

function fmtPrice(prix?: string | number): string {
  if (prix === undefined || prix === null || prix === "") return "—";
  const n = typeof prix === "string" ? parseFloat(prix) : prix;
  if (isNaN(n)) return String(prix);
  return `${n.toFixed(2)} €`;
}

const Email = (p: Props) => {
  const lang = p.lang && STR[p.lang] ? p.lang : "fr";
  const s = STR[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ref = p.reservation_id ? `TCB-${p.reservation_id.slice(0, 8).toUpperCase()}` : "";

  return (
    <Html lang={lang} dir={dir}>
      <Head />
      <Preview>{s.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Taxi City Bordeaux</Heading>
          <Text style={lead}>
            {s.hi} {p.nom ?? ""},
          </Text>
          <Text style={lead}>{s.intro}</Text>

          <Section style={card}>
            <Row label={s.when} value={fmtDate(p.pickup_datetime, lang)} />
            <Row label={s.from} value={p.depart} />
            <Row label={s.to} value={p.arrivee} />
            <Hr style={hr} />
            <Row label={s.price} value={fmtPrice(p.prix)} highlight />
            {ref ? <Row label={s.ref} value={ref} /> : null}
          </Section>

          <Text style={footer}>{s.foot}</Text>
          {p.unsubscribe_token ? (
            <Text style={unsubText}>
              <Link
                href={`https://taxicitybordeaux.fr/unsubscribe?token=${p.unsubscribe_token}`}
                style={unsubLink}
              >
                {s.unsub}
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
};

const Row = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) => (
  <Text style={row}>
    <span style={rowLabel}>{label} : </span>
    <span style={highlight ? rowValueHighlight : rowValue}>{value || "—"}</span>
  </Text>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const l = d?.lang && STR[d.lang as Lang] ? (d.lang as Lang) : "fr";
    return STR[l].subj;
  },
  displayName: "Modification prix / itinéraire — client",
  previewData: {
    lang: "fr",
    nom: "Jean Dupont",
    pickup_datetime: "2026-05-10T14:30:00+00:00",
    depart: "12 cours de l'Intendance, Bordeaux",
    arrivee: "Aéroport Mérignac",
    prix: 45,
    reservation_id: "abcdef12",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px", maxWidth: "560px" };
const h1 = { fontSize: "22px", fontWeight: "bold" as const, color: "#c9a34d", margin: "0 0 12px" };
const lead = { fontSize: "14px", color: "#444", lineHeight: "1.6", margin: "0 0 14px" };
const card = { background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "16px 18px" };
const row = { fontSize: "14px", color: "#222", margin: "6px 0", lineHeight: "1.5" };
const rowLabel = { color: "#666", fontWeight: 600 };
const rowValue = { color: "#111" };
const rowValueHighlight = { color: "#c9a34d", fontWeight: "bold" as const, fontSize: "15px" };
const hr = { borderColor: "#e5e5e5", margin: "12px 0" };
const footer = { fontSize: "12px", color: "#999", margin: "20px 0 0" };
const unsubText = { fontSize: "11px", color: "#bbb", margin: "8px 0 0", textAlign: "center" as const };
const unsubLink = { color: "#bbb", textDecoration: "underline" };
