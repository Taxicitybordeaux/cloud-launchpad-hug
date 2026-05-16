import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  nom?: string;
  telephone?: string;
  email?: string;
  pickup_datetime?: string;
  depart?: string;
  arrivee?: string;
  passagers?: number | string;
  bagages?: number | string;
  service_type?: string;
  message?: string;
}

// ✅ Formate la date en français, heure de Paris
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

const ReservationNotificationEmail = (p: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle réservation — {p.nom ?? "Client"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nouvelle demande de réservation</Heading>
        <Text style={lead}>Une nouvelle demande de course vient d'être enregistrée sur Taxi City Bordeaux.</Text>

        <Section style={card}>
          <Row label="Nom" value={p.nom} />
          <Row label="Téléphone" value={p.telephone} />
          <Row label="Email" value={p.email || "—"} />
          <Hr style={hr} />
          <Row label="Date / heure" value={fmtDate(p.pickup_datetime)} />
          <Row label="Départ" value={p.depart} />
          <Row label="Arrivée" value={p.arrivee} />
          <Hr style={hr} />
          <Row label="Passagers" value={String(p.passagers ?? "")} />
          <Row label="Bagages" value={String(p.bagages ?? "")} />
          <Row label="Type de course" value={p.service_type} />
          {p.message ? <Row label="Message" value={p.message} /> : null}
        </Section>

        <Text style={footer}>Pensez à rappeler le client rapidement pour confirmer la course.</Text>
      </Container>
    </Body>
  </Html>
);

const Row = ({ label, value }: { label: string; value?: string }) => (
  <Text style={row}>
    <span style={rowLabel}>{label} : </span>
    <span style={rowValue}>{value || "—"}</span>
  </Text>
);

export const template = {
  component: ReservationNotificationEmail,
  // ✅ Objet du mail aussi avec date formatée
  subject: (d: Record<string, any>) => `Nouvelle réservation — ${d?.nom ?? "Client"} (${fmtDate(d?.pickup_datetime)})`,
  displayName: "Notification de réservation",
  to: "taxi.city033@gmail.com",
  previewData: {
    nom: "Jean Dupont",
    telephone: "06 12 34 56 78",
    email: "jean@example.com",
    pickup_datetime: "2026-05-10T14:30:00+00:00",
    depart: "12 cours de l'Intendance, Bordeaux",
    arrivee: "Aéroport Mérignac",
    passagers: 2,
    bagages: 2,
    service_type: "aeroport",
    message: "Vol AF1234",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px", maxWidth: "560px" };
const h1 = { fontSize: "22px", fontWeight: "bold" as const, color: "#0a0a0a", margin: "0 0 12px" };
const lead = { fontSize: "14px", color: "#55575d", lineHeight: "1.5", margin: "0 0 20px" };
const card = { background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "16px 18px" };
const row = { fontSize: "14px", color: "#222", margin: "6px 0", lineHeight: "1.5" };
const rowLabel = { color: "#666", fontWeight: 600 };
const rowValue = { color: "#111" };
const hr = { borderColor: "#e5e5e5", margin: "12px 0" };
const footer = { fontSize: "12px", color: "#999", margin: "20px 0 0" };
