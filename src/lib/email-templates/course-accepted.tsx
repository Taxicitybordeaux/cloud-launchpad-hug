import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BRAND, brandBar, brandTag, button, container, divider, footer, h1, main, text } from "./_brand";

interface Props {
  nom?: string;
  depart?: string;
  arrivee?: string;
  pickup_datetime?: string;
  prix?: string;
  tarif?: string;
  tracking_url?: string;
}

const Email = (p: Props) => {
  const url = p.tracking_url || "https://taxicitybordeaux.fr";
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre course est confirmée — suivez votre chauffeur en temps réel</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brandBar}>Taxi City Bordeaux</Text>
          <Text style={brandTag}>Course confirmée</Text>

          <Heading style={h1}>Bonjour {p.nom || ""}, votre course est acceptée ✅</Heading>

          <Text style={text}>
            Votre chauffeur est prévenu et arrive vers vous. Cliquez sur le bouton ci-dessous pour suivre sa position en
            temps réel et voir le temps d'arrivée.
          </Text>

          {/* Lien de suivi — un seul lien permanent par client (tracking_id stable) */}
          <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
            <Button href={url} style={button}>
              📍 Suivre mon chauffeur
            </Button>
          </Section>

          {/* Lien texte cliquable — le client clique directement, pas besoin de scanner */}
          <Text style={{ ...text, fontSize: "13px", color: BRAND.textMuted, wordBreak: "break-all" }}>
            Lien de suivi :{" "}
            <Link href={url} style={{ color: BRAND.primary, textDecoration: "underline", wordBreak: "break-all" }}>
              {url}
            </Link>
          </Text>

          {/* Récapitulatif de la course */}
          {(p.depart || p.arrivee || p.pickup_datetime || p.prix) && (
            <Section style={card}>
              {p.pickup_datetime && (
                <Text style={row}>
                  <span style={rowLabel}>Date / heure : </span>
                  {p.pickup_datetime}
                </Text>
              )}
              {p.depart && (
                <Text style={row}>
                  <span style={rowLabel}>Départ : </span>
                  {p.depart}
                </Text>
              )}
              {p.arrivee && (
                <Text style={row}>
                  <span style={rowLabel}>Arrivée : </span>
                  {p.arrivee}
                </Text>
              )}
              {p.prix && (
                <Text style={{ ...row, color: BRAND.primary, fontWeight: 700 }}>
                  <span style={rowLabel}>Prix estimé : </span>
                  {p.prix}
                  {p.tarif ? <span style={{ color: "#999", fontWeight: 400 }}> ({p.tarif})</span> : null}
                </Text>
              )}
            </Section>
          )}

          <Text style={text}>
            Vous pouvez aussi appeler directement votre chauffeur au <strong>06 73 07 23 22</strong> (7j/7 · 24h/24).
          </Text>

          <Hr style={divider} />
          <Text style={footer}>Taxi City Bordeaux · Conventionné · 7j/7 · 24h/24</Text>
        </Container>
      </Body>
    </Html>
  );
};

const card = {
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: "8px",
  padding: "14px 18px",
  margin: "8px 0 22px",
};
const row = { fontSize: "14px", color: "#222", margin: "4px 0", lineHeight: "1.5" as const };
const rowLabel = { color: "#666", fontWeight: 600 as const };

export const template = {
  component: Email,
  subject: "✅ Votre course est confirmée — suivez votre chauffeur",
  displayName: "Course acceptée — invitation au suivi",
  previewData: {
    nom: "Jean Dupont",
    depart: "Bordeaux Centre",
    arrivee: "Aéroport Mérignac",
    pickup_datetime: "2026-05-12 14:30",
    prix: "18.50 €",
    tarif: "Jour (2,16 €/km)",
    // Chemin correct : /scan/{tracking_id} — lecture infinie, pas d'expiration
    tracking_url: "https://taxicitybordeaux.fr/scan/client-1778782821645-g3g6k",
  },
} satisfies TemplateEntry;
