import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BRAND, brandBar, brandTag, button, container, divider, footer, h1, main, text } from "./_brand";

interface Props {
  nom?: string;
  depart?: string;
  arrivee?: string;
  pickup_datetime?: string;
  tracking_url?: string;
  prix?: string;
  tarif?: string;
  passagers?: string | number;
  bagages?: string | number;
}

const Email = (p: Props) => {
  const url = p.tracking_url || "https://taxicitybordeaux.fr";
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>
        Course confirmée{p.prix ? ` — Prix estimé : ${p.prix}` : " — suivez votre chauffeur en temps réel"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brandBar}>Taxi City Bordeaux</Text>
          <Text style={brandTag}>Course confirmée</Text>

          <Heading style={h1}>Bonjour {p.nom || ""}, votre course est confirmée ✅</Heading>

          <Text style={text}>
            Votre chauffeur est prévenu et arrive vers vous. Retrouvez ci-dessous le récapitulatif de votre course et
            votre lien de suivi en temps réel.
          </Text>

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
            {(p.passagers != null || p.bagages != null) && (
              <Text style={row}>
                <span style={rowLabel}>Passagers / bagages : </span>
                {p.passagers != null ? `${p.passagers} passager(s)` : ""}
                {p.passagers != null && p.bagages != null ? " · " : ""}
                {p.bagages != null ? `${p.bagages} bagage(s)` : ""}
              </Text>
            )}
            {p.prix && (
              <Text style={{ ...row, marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <span style={rowLabel}>Prix estimé : </span>
                <span style={{ color: BRAND.primary, fontWeight: 700, fontSize: "16px" }}>{p.prix}</span>
                {p.tarif && <span style={{ color: "#999", fontSize: "12px" }}> ({p.tarif})</span>}
              </Text>
            )}
          </Section>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={url} style={button}>
              📍 Suivre mon chauffeur en direct
            </Button>
          </Section>

          <Text style={{ ...text, fontSize: "13px", color: BRAND.textMuted, wordBreak: "break-all" }}>
            Lien de suivi : {url}
          </Text>

          <Text style={text}>
            Vous pouvez également appeler votre chauffeur directement au <strong>06 73 07 23 22</strong> (7j/7 ·
            24h/24).
          </Text>

          <Hr style={divider} />
          <Text style={footer}>Taxi City Bordeaux · Conventionné CPAM · 7j/7 · 24h/24</Text>
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
const row = { fontSize: "14px", color: "#222", margin: "5px 0", lineHeight: "1.6" };
const rowLabel = { color: "#666", fontWeight: 600 as const };

export const template = {
  component: Email,
  subject: "✅ Votre course est confirmée — Taxi City Bordeaux",
  displayName: "Course acceptée — confirmation complète",
  previewData: {
    nom: "Jean Dupont",
    depart: "20 Av. Jean Monnet, Bordeaux",
    arrivee: "Aéroport de Bordeaux-Mérignac",
    pickup_datetime: "jeudi 14 mai 2026 à 20:22",
    tracking_url: "https://taxicitybordeaux.fr/scan/abcd-1234",
    prix: "13.50 €",
    tarif: "Nuit (3,24 €/km)",
    passagers: 1,
    bagages: 0,
  },
} satisfies TemplateEntry;
