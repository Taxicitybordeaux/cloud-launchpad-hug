import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  nom?: string;
  phone?: string;
  email?: string;
  depart?: string;
  arrivee?: string;
  pickup_datetime?: string;
  passagers?: number | string;
  bagages?: number | string;
  admin_url?: string;
}

function fmt(iso?: string): string {
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

const Email = (p: Props) => {
  const url = p.admin_url || "https://taxicitybordeaux.fr/admin/dashboard";
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>🆕 Nouvelle réservation — {p.nom ?? "Client"}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🆕 Nouvelle réservation</Heading>
          <Text style={lead}>
            Une nouvelle course vient d'être réservée sur Taxi City Bordeaux. Voici les détails :
          </Text>

          <Section style={card}>
            <Row label="Client" value={p.nom} />
            <Row label="Téléphone" value={p.phone} />
            <Row label="Email" value={p.email || "—"} />
            <Hr style={hr} />
            <Row label="Date / heure" value={fmt(p.pickup_datetime)} />
            <Row label="Départ" value={p.depart} />
            <Row label="Arrivée" value={p.arrivee} />
            <Hr style={hr} />
            <Row label="Passagers" value={String(p.passagers ?? "1")} />
            <Row label="Bagages" value={String(p.bagages ?? "0")} />
          </Section>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={url} style={button}>
              🚕 Voir dans l'admin
            </Button>
          </Section>

          <Text style={footer}>
            Pensez à confirmer ou refuser la course rapidement depuis le dashboard.
          </Text>
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
  subject: (d: Record<string, any>) => `🆕 Nouvelle réservation — ${d?.nom ?? "Client"}`,
  displayName: "Nouvelle réservation — admin",
  to: "taxi.city033@gmail.com",
  previewData: {
    nom: "Jean Dupont",
    phone: "06 12 34 56 78",
    email: "jean@example.com",
    depart: "12 cours de l'Intendance, Bordeaux",
    arrivee: "Aéroport Mérignac",
    pickup_datetime: "2026-05-10T14:30:00+00:00",
    passagers: 2,
    bagages: 2,
    admin_url: "https://taxicitybordeaux.fr/admin/dashboard",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px", maxWidth: "560px" };
const h1 = { fontSize: "22px", fontWeight: "bold" as const, color: "#0a0a0a", margin: "0 0 12px" };
const lead = { fontSize: "14px", color: "#55575d", lineHeight: "1.5", margin: "0 0 20px" };
const card = { background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "16px 18px" };
const row = { fontSize: "14px", color: "#222", margin: "6px 0", lineHeight: "1.5" };
const rowLabel = { color: "#666", fontWeight: 600 as const };
const rowValue = { color: "#111" };
const hr = { borderColor: "#e5e5e5", margin: "12px 0" };
const footer = { fontSize: "12px", color: "#999", margin: "20px 0 0" };
const button = {
  background: "#f5c842",
  color: "#0a0a0a",
  padding: "12px 28px",
  borderRadius: "8px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  display: "inline-block",
  fontSize: "14px",
};
