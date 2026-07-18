import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logoSrc from "@/assets/tcb-logo-badge.png";

const CARTE_URL = "https://taxicitybordeaux.fr/carte";
const CARTE_TITLE = "Taxi City Bordeaux — Contact rapide";
const CARTE_DESC =
  "Appeler, WhatsApp, SMS, email, réservation en ligne — tous les contacts Taxi City Bordeaux en un clic.";

export const Route = createFileRoute("/carte")({
  head: () => ({
    meta: [
      { title: CARTE_TITLE },
      { name: "description", content: CARTE_DESC },
      { property: "og:title", content: CARTE_TITLE },
      { property: "og:description", content: CARTE_DESC },
      { property: "og:url", content: CARTE_URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: CARTE_URL }],
  }),
  component: CartePage,
});

// Contact unique — modifie ici pour changer partout
const CONTACT = {
  name: "José — Taxi City Bordeaux",
  org: "Taxi City Bordeaux",
  tel: "+33673072322",
  telDisplay: "06\u00A073\u00A007\u00A023\u00A022",
  email: "taxi.city033@gmail.com",
  site: "https://taxicitybordeaux.fr",
  reserve: "/reserver",
};

type Lang = "fr" | "en" | "es" | "de" | "it" | "pt" | "nl" | "ar" | "zh" | "ja" | "ru";

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

type Dict = {
  tag: string;
  call: string;
  whatsapp: string;
  sms: string;
  email: string;
  reserve: string;
  website: string;
  addContact: string;
  waMessage: string;
  footer: string;
  languageLabel: string;
};

const T: Record<Lang, Dict> = {
  fr: {
    tag: "Taxi Bordeaux",
    call: "Appeler",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    reserve: "Réserver en ligne",
    website: "Site web",
    addContact: "Ajouter aux contacts",
    waMessage: "Bonjour José, je souhaite réserver un taxi.",
    footer: "Taxi conventionné · Bordeaux et Métropole · 7j/7",
    languageLabel: "Langue",
  },
  en: {
    tag: "Bordeaux Taxi",
    call: "Call",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    reserve: "Book online",
    website: "Website",
    addContact: "Add to contacts",
    waMessage: "Hello José, I would like to book a taxi.",
    footer: "Licensed taxi · Bordeaux & Metro area · 7 days a week",
    languageLabel: "Language",
  },
  es: {
    tag: "Taxi Burdeos",
    call: "Llamar",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Correo",
    reserve: "Reservar en línea",
    website: "Sitio web",
    addContact: "Añadir a contactos",
    waMessage: "Hola José, quisiera reservar un taxi.",
    footer: "Taxi autorizado · Burdeos y área metropolitana · 7 días",
    languageLabel: "Idioma",
  },
  de: {
    tag: "Taxi Bordeaux",
    call: "Anrufen",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "E-Mail",
    reserve: "Online buchen",
    website: "Webseite",
    addContact: "Zu Kontakten hinzufügen",
    waMessage: "Hallo José, ich möchte ein Taxi buchen.",
    footer: "Konzessioniertes Taxi · Bordeaux & Metropolregion · 7 Tage",
    languageLabel: "Sprache",
  },
  it: {
    tag: "Taxi Bordeaux",
    call: "Chiama",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    reserve: "Prenota online",
    website: "Sito web",
    addContact: "Aggiungi ai contatti",
    waMessage: "Salve José, vorrei prenotare un taxi.",
    footer: "Taxi autorizzato · Bordeaux e area metropolitana · 7 giorni",
    languageLabel: "Lingua",
  },
  pt: {
    tag: "Táxi Bordéus",
    call: "Ligar",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "Email",
    reserve: "Reservar online",
    website: "Site",
    addContact: "Adicionar aos contactos",
    waMessage: "Olá José, gostaria de reservar um táxi.",
    footer: "Táxi licenciado · Bordéus e área metropolitana · 7 dias",
    languageLabel: "Idioma",
  },
  nl: {
    tag: "Taxi Bordeaux",
    call: "Bellen",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "E-mail",
    reserve: "Online reserveren",
    website: "Website",
    addContact: "Toevoegen aan contacten",
    waMessage: "Hallo José, ik wil graag een taxi reserveren.",
    footer: "Erkende taxi · Bordeaux en omgeving · 7 dagen",
    languageLabel: "Taal",
  },
  ar: {
    tag: "سيارة أجرة بوردو",
    call: "اتصل",
    whatsapp: "واتساب",
    sms: "رسالة نصية",
    email: "البريد",
    reserve: "احجز عبر الإنترنت",
    website: "الموقع",
    addContact: "أضف إلى جهات الاتصال",
    waMessage: "مرحبًا خوسيه، أود حجز سيارة أجرة.",
    footer: "سيارة أجرة معتمدة · بوردو والضواحي · 7 أيام",
    languageLabel: "اللغة",
  },
  zh: {
    tag: "波尔多出租车",
    call: "呼叫",
    whatsapp: "WhatsApp",
    sms: "短信",
    email: "邮件",
    reserve: "在线预订",
    website: "网站",
    addContact: "添加到通讯录",
    waMessage: "您好 José，我想预订一辆出租车。",
    footer: "特许出租车 · 波尔多及大都会区 · 全年无休",
    languageLabel: "语言",
  },
  ja: {
    tag: "ボルドー・タクシー",
    call: "電話",
    whatsapp: "WhatsApp",
    sms: "SMS",
    email: "メール",
    reserve: "オンライン予約",
    website: "ウェブサイト",
    addContact: "連絡先に追加",
    waMessage: "こんにちは José、タクシーを予約したいです。",
    footer: "認可タクシー · ボルドー・メトロポール · 年中無休",
    languageLabel: "言語",
  },
  ru: {
    tag: "Такси Бордо",
    call: "Позвонить",
    whatsapp: "WhatsApp",
    sms: "СМС",
    email: "Эл. почта",
    reserve: "Заказать онлайн",
    website: "Сайт",
    addContact: "Добавить в контакты",
    waMessage: "Здравствуйте, José, я хотел бы заказать такси.",
    footer: "Лицензированное такси · Бордо и метрополия · 7 дней",
    languageLabel: "Язык",
  },
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

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "fr";
  const code = (navigator.language || "fr").slice(0, 2).toLowerCase();
  return (LANGS.find((l) => l.code === code)?.code ?? "fr") as Lang;
}

function CartePage() {
  const [lang, setLang] = useState<Lang>("fr");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("carte-lang")) as Lang | null;
    setLang(saved && LANGS.some((l) => l.code === saved) ? saved : detectLang());
  }, []);
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("carte-lang", lang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const t = T[lang];
  const rtl = lang === "ar";

  const waNumber = CONTACT.tel.replace(/[^\d]/g, "");
  const vcfUrl = "/api/public/contact/vcf";



  return (
    <main
      dir={rtl ? "rtl" : "ltr"}
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
        {/* Language switcher */}
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            🌐
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t.languageLabel}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "6px 8px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code} style={{ background: "#111827" }}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <img
          src={logoSrc}
          alt="Taxi City Bordeaux"
          style={{
            width: 240,
            maxWidth: "80%",
            height: "auto",
            borderRadius: 12,
            objectFit: "contain",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#E8C96D" }}>
            {t.tag}
          </div>
          <h1 style={{ fontFamily: "'Syne','Playfair Display',serif", fontSize: 26, margin: "6px 0 2px" }}>
            José
          </h1>
          <div style={{ fontSize: 16, marginTop: 8, fontWeight: 600, whiteSpace: "nowrap", direction: "ltr" }}>
            {CONTACT.telDisplay}
          </div>
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionButton href={`tel:${CONTACT.tel}`} icon="📞" label={t.call} primary />
          <ActionButton
            href={`whatsapp://send?phone=${waNumber}&text=${encodeURIComponent(t.waMessage)}`}
            icon="💬"
            label={t.whatsapp}
          />
          <ActionButton href={`sms:${CONTACT.tel}`} icon="✉️" label={t.sms} />
          <ActionButton href={`mailto:${CONTACT.email}`} icon="📧" label={t.email} />
          <ActionButton href={CONTACT.reserve} icon="🚕" label={t.reserve} primary />
          <ActionButton href={CONTACT.site} icon="🌐" label={t.website} />
          <ActionButton
            href={vcfUrl}
            icon="👤"
            label={t.addContact}
          />
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 8 }}>
          {t.footer}
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
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  primary?: boolean;
  download?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
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
    <a href={href} download={download} onClick={onClick} style={primary ? gold : base}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
      <span style={{ marginInlineStart: "auto", opacity: 0.5 }}>›</span>
    </a>
  );
}
