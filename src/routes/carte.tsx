import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import logoSrc from "@/assets/tcb-logo.jpeg";

export const Route = createFileRoute("/carte")({
  head: () => ({
    meta: [
      { title: "Taxi City Bordeaux — Contact rapide" },
      {
        name: "description",
        content:
          "Appeler, WhatsApp, SMS, email, réservation en ligne — tous les contacts Taxi City Bordeaux en un clic.",
      },
      { property: "og:title", content: "Taxi City Bordeaux — Contact rapide" },
      {
        property: "og:description",
        content: "Tous les contacts Taxi City Bordeaux en un clic.",
      },
    ],
  }),
  component: CartePage,
});

// Contact unique — modifie ici pour changer partout
const CONTACT = {
  name: "José — Taxi City Bordeaux",
  org: "Taxi City Bordeaux",
  tel: "+33673072322", // format international, sans espaces (pour tel:/sms:/wa.me)
  telDisplay: "06\u00A073\u00A007\u00A023\u00A022",
  email: "taxi.city033@gmail.com",
  site: "https://taxicitybordeaux.fr",
  reserve: "https://taxicitybordeaux.fr/reserver",
};

function buildVCard() {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${CONTACT.name}`,
    `N:;${CONTACT.name.split(" ")[0]};;;`,
    `ORG:${CONTACT.org}`,
    `TEL;TYPE=CELL,VOICE,PREF:${CONTACT.tel}`,
    `EMAIL;TYPE=INTERNET,PREF:${CONTACT.email}`,
    `URL:${CONTACT.site}`,
    "END:VCARD",
  ].join("\n");
}

function CartePage() {
  const vcardHref = useMemo(() => {
    const blob = new Blob([buildVCard()], { type: "text/vcard;charset=utf-8" });
    return typeof window !== "undefined" ? URL.createObjectURL(blob) : "#";
  }, []);

  const waNumber = CONTACT.tel.replace(/[^\d]/g, "");

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg,#0a0a0a 0%,#111827 100%)",
        color: "#fff",
        padding: "32px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <img
          src={logoSrc}
          alt="Taxi City Bordeaux"
          style={{ width: 120, height: 120, borderRadius: 20, objectFit: "cover", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#E8C96D" }}>
            Taxi Bordeaux
          </div>
          <h1 style={{ fontFamily: "'Syne','Playfair Display',serif", fontSize: 26, margin: "6px 0 2px" }}>
            José
          </h1>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Chauffeur Taxi City Bordeaux</div>
          <div style={{ fontSize: 16, marginTop: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
            {CONTACT.telDisplay}
          </div>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionButton href={`tel:${CONTACT.tel}`} icon="📞" label="Appeler" primary />
          <ActionButton
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent("Bonjour José, je souhaite réserver un taxi.")}`}
            icon="💬"
            label="WhatsApp"
          />
          <ActionButton href={`sms:${CONTACT.tel}`} icon="✉️" label="SMS" />
          <ActionButton href={`mailto:${CONTACT.email}`} icon="📧" label="Email" />
          <ActionButton href={CONTACT.reserve} icon="🚕" label="Réserver en ligne" primary />
          <ActionButton href={CONTACT.site} icon="🌐" label="Site web" />
          <ActionButton
            href={vcardHref}
            download="taxi-city-bordeaux.vcf"
            icon="👤"
            label="Ajouter aux contacts"
          />
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 8 }}>
          Taxi conventionné · Bordeaux et Métropole · 7j/7
        </div>
      </div>
    </main>
  );
}

function ActionButton({
  href,
  icon,
  label,
  primary,
  download,
}: {
  href: string;
  icon: string;
  label: string;
  primary?: boolean;
  download?: string;
}) {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 16,
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    transition: "transform 0.1s",
  };
  const gold: React.CSSProperties = {
    ...base,
    background: "linear-gradient(135deg,#C9A84C,#E8C96D)",
    color: "#000",
    border: "none",
  };
  return (
    <a href={href} download={download} style={primary ? gold : base}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
      <span style={{ marginLeft: "auto", opacity: 0.5 }}>›</span>
    </a>
  );
}
