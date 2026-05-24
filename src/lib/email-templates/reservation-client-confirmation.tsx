import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Lang = "fr" | "en" | "es" | "it" | "ar";

interface Props {
  lang?: Lang;
  nom?: string;
  pickup_datetime?: string;
  depart?: string;
  arrivee?: string;
  passagers?: number | string;
  bagages?: number | string;
  reservation_id?: string;
  unsubscribe_token?: string;
}

const STR: Record<Lang, Record<string, string>> = {
  fr: {
    preview: "Confirmation de votre réservation",
    hi: "Bonjour",
    thanks:
      "Nous avons bien reçu votre demande de réservation. Nous vous rappellerons rapidement pour confirmer votre course.",
    summary: "Récapitulatif",
    when: "Date / heure",
    from: "Départ",
    to: "Arrivée",
    pax: "Passagers",
    lug: "Bagages",
    ref: "N° de réservation",
    foot: "Pour toute question : 06 73 07 23 22 — Taxi City Bordeaux",
    unsub: "Vous recevez cet email car vous avez effectué une réservation. Ne plus recevoir ces emails",
    subj: "Confirmation de votre réservation",
  },
  en: {
    preview: "Booking confirmation",
    hi: "Hello",
    thanks: "We've received your booking request. We'll call you shortly to confirm your ride.",
    summary: "Summary",
    when: "Date / time",
    from: "From",
    to: "To",
    pax: "Passengers",
    lug: "Luggage",
    ref: "Booking number",
    foot: "Any question? +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "You're receiving this email because you made a booking. Unsubscribe",
    subj: "Your booking confirmation",
  },
  es: {
    preview: "Confirmación de su reserva",
    hi: "Hola",
    thanks: "Hemos recibido su solicitud de reserva. Le llamaremos en breve para confirmar el viaje.",
    summary: "Resumen",
    when: "Fecha / hora",
    from: "Origen",
    to: "Destino",
    pax: "Pasajeros",
    lug: "Equipaje",
    ref: "Nº de reserva",
    foot: "¿Alguna pregunta? +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "Recibe este correo porque realizó una reserva. Cancelar suscripción",
    subj: "Confirmación de su reserva",
  },
  it: {
    preview: "Conferma della prenotazione",
    hi: "Salve",
    thanks: "Abbiamo ricevuto la sua richiesta di prenotazione. La richiameremo a breve per confermare la corsa.",
    summary: "Riepilogo",
    when: "Data / ora",
    from: "Partenza",
    to: "Arrivo",
    pax: "Passeggeri",
    lug: "Bagagli",
    ref: "N° di prenotazione",
    foot: "Domande? +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "Stai ricevendo questa email perché hai effettuato una prenotazione. Annulla iscrizione",
    subj: "Conferma della sua prenotazione",
  },
  ar: {
    preview: "تأكيد الحجز",
    hi: "مرحبا",
    thanks: "لقد استلمنا طلب الحجز الخاص بك. سنتصل بك قريبا لتأكيد الرحلة.",
    summary: "ملخص",
    when: "التاريخ / الوقت",
    from: "من",
    to: "إلى",
    pax: "الركاب",
    lug: "الأمتعة",
    ref: "رقم الحجز",
    foot: "لأي سؤال: +33 6 73 07 23 22 — Taxi City Bordeaux",
    unsub: "تلقيت هذا البريد الإلكتروني لأنك أجريت حجزاً. إلغاء الاشتراك",
    subj: "تأكيد حجزك",
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
          <Text style={lead}>{s.thanks}</Text>
          <Section style={card}>
            <Row label={s.when} value={fmtDate(p.pickup_datetime, lang)} />
            <Row label={s.from} value={p.depart} />
            <Row label={s.to} value={p.arrivee} />
            <Hr style={hr} />
            <Row label={s.pax} value={String(p.passagers ?? "")} />
            <Row label={s.lug} value={String(p.bagages ?? "")} />
            {ref ? <Row label={s.ref} value={ref} /> : null}
          </Section>
          <Text style={footer}>{s.foot}</Text>
          {p.unsubscribe_token ? (
            <Text style={unsubText}>
              <Link href={`https://taxicitybordeaux.fr/unsubscribe?token=${p.unsubscribe_token}`} style={unsubLink}>
                {s.unsub}
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
};

const Row = ({ label, value }: { label: string; value?: string }) => (
  <Text style={row}>
    <span style={rowLabel}>{label} : </span>
    <span style={rowValue}>{value || "—"}</span>
  </Text>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const l = d?.lang && STR[d.lang as Lang] ? (d.lang as Lang) : "fr";
    return STR[l].subj;
  },
  displayName: "Confirmation client réservation",
  previewData: {
    lang: "fr",
    nom: "Jean Dupont",
    pickup_datetime: "05-10-2026 14:30",
    depart: "Bordeaux",
    arrivee: "Aéroport Mérignac",
    passagers: 2,
    bagages: 2,
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
const hr = { borderColor: "#e5e5e5", margin: "12px 0" };
const footer = { fontSize: "12px", color: "#999", margin: "20px 0 0" };
const unsubText = { fontSize: "11px", color: "#bbb", margin: "8px 0 0", textAlign: "center" as const };
const unsubLink = { color: "#bbb", textDecoration: "underline" };
