import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BRAND, brandBar, brandTag, button, container, divider, footer, h1, main, text } from "./_brand";

type Lang = "fr" | "en" | "es" | "it" | "ar" | "pt";

interface Props {
  lang?: Lang;
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

const STR: Record<Lang, Record<string, string>> = {
  fr: {
    tag: "Course confirmée",
    preview: "Course confirmée",
    previewPrice: "Prix estimé",
    previewTrack: "suivez votre chauffeur en temps réel",
    hi: "Bonjour",
    confirmed: ", votre course est confirmée ✅",
    intro: "Votre chauffeur est prévenu et arrive vers vous. Retrouvez ci-dessous le récapitulatif de votre course et votre lien de suivi en temps réel.",
    when: "Date / heure",
    from: "Départ",
    to: "Arrivée",
    paxLug: "Passagers / bagages",
    pax: (n: any) => `${n} passager(s)`,
    lug: (n: any) => `${n} bagage(s)`,
    price: "Prix estimé",
    trackBtn: "📍 Suivre mon chauffeur en direct",
    trackLink: "Lien de suivi",
    call: (p: string) => `Vous pouvez également appeler votre chauffeur directement au ${p} (7j/7 · 24h/24).`,
    footer: "Taxi City Bordeaux · Conventionné CPAM · 7j/7 · 24h/24",
    subject: "✅ Votre course est confirmée — Taxi City Bordeaux",
  },
  en: {
    tag: "Ride confirmed",
    preview: "Ride confirmed",
    previewPrice: "Estimated price",
    previewTrack: "track your driver in real time",
    hi: "Hello",
    confirmed: ", your ride is confirmed ✅",
    intro: "Your driver has been notified and is on the way. Below is your ride summary and your live tracking link.",
    when: "Date / time",
    from: "Pickup",
    to: "Drop-off",
    paxLug: "Passengers / luggage",
    pax: (n: any) => `${n} passenger(s)`,
    lug: (n: any) => `${n} bag(s)`,
    price: "Estimated price",
    trackBtn: "📍 Track my driver live",
    trackLink: "Tracking link",
    call: (p: string) => `You can also call your driver directly at ${p} (24/7).`,
    footer: "Taxi City Bordeaux · CPAM-approved · 24/7",
    subject: "✅ Your ride is confirmed — Taxi City Bordeaux",
  },
  es: {
    tag: "Carrera confirmada",
    preview: "Carrera confirmada",
    previewPrice: "Precio estimado",
    previewTrack: "siga a su conductor en tiempo real",
    hi: "Hola",
    confirmed: ", su carrera está confirmada ✅",
    intro: "Su conductor ha sido avisado y está en camino. A continuación encontrará el resumen de su carrera y el enlace de seguimiento en tiempo real.",
    when: "Fecha / hora",
    from: "Recogida",
    to: "Destino",
    paxLug: "Pasajeros / equipaje",
    pax: (n: any) => `${n} pasajero(s)`,
    lug: (n: any) => `${n} maleta(s)`,
    price: "Precio estimado",
    trackBtn: "📍 Seguir a mi conductor en directo",
    trackLink: "Enlace de seguimiento",
    call: (p: string) => `También puede llamar a su conductor directamente al ${p} (24/7).`,
    footer: "Taxi City Bordeaux · Convenido CPAM · 24/7",
    subject: "✅ Su carrera está confirmada — Taxi City Bordeaux",
  },
  it: {
    tag: "Corsa confermata",
    preview: "Corsa confermata",
    previewPrice: "Prezzo stimato",
    previewTrack: "segui il tuo autista in tempo reale",
    hi: "Salve",
    confirmed: ", la sua corsa è confermata ✅",
    intro: "Il suo autista è stato avvisato e sta arrivando. Di seguito il riepilogo della corsa e il link per il tracciamento in tempo reale.",
    when: "Data / ora",
    from: "Partenza",
    to: "Arrivo",
    paxLug: "Passeggeri / bagagli",
    pax: (n: any) => `${n} passeggero(i)`,
    lug: (n: any) => `${n} bagaglio(i)`,
    price: "Prezzo stimato",
    trackBtn: "📍 Segui il mio autista in diretta",
    trackLink: "Link di tracciamento",
    call: (p: string) => `Può anche chiamare direttamente il suo autista al ${p} (24/7).`,
    footer: "Taxi City Bordeaux · Convenzionato CPAM · 24/7",
    subject: "✅ La sua corsa è confermata — Taxi City Bordeaux",
  },
  pt: {
    tag: "Corrida confirmada",
    preview: "Corrida confirmada",
    previewPrice: "Preço estimado",
    previewTrack: "siga o seu motorista em tempo real",
    hi: "Olá",
    confirmed: ", a sua corrida está confirmada ✅",
    intro: "O seu motorista foi avisado e está a caminho. Abaixo encontra o resumo da corrida e o link de seguimento em tempo real.",
    when: "Data / hora",
    from: "Partida",
    to: "Chegada",
    paxLug: "Passageiros / bagagem",
    pax: (n: any) => `${n} passageiro(s)`,
    lug: (n: any) => `${n} mala(s)`,
    price: "Preço estimado",
    trackBtn: "📍 Seguir o meu motorista ao vivo",
    trackLink: "Link de seguimento",
    call: (p: string) => `Pode também ligar diretamente ao seu motorista para ${p} (24/7).`,
    footer: "Taxi City Bordeaux · Convencionado CPAM · 24/7",
    subject: "✅ A sua corrida está confirmada — Taxi City Bordeaux",
  },
  ar: {
    tag: "تم تأكيد الرحلة",
    preview: "تم تأكيد الرحلة",
    previewPrice: "السعر التقديري",
    previewTrack: "تابع سائقك مباشرة",
    hi: "مرحباً",
    confirmed: "، تم تأكيد رحلتك ✅",
    intro: "تم إبلاغ سائقك وهو في الطريق إليك. يمكنك أدناه الاطلاع على ملخص رحلتك ورابط التتبع المباشر.",
    when: "التاريخ / الوقت",
    from: "نقطة الانطلاق",
    to: "الوجهة",
    paxLug: "الركاب / الأمتعة",
    pax: (n: any) => `${n} راكب`,
    lug: (n: any) => `${n} حقيبة`,
    price: "السعر التقديري",
    trackBtn: "📍 تتبع سائقي مباشرة",
    trackLink: "رابط التتبع",
    call: (p: string) => `يمكنك أيضاً الاتصال بسائقك مباشرة على ${p} (24/7).`,
    footer: "تاكسي سيتي بوردو · معتمد CPAM · 24/7",
    subject: "✅ تم تأكيد رحلتك — Taxi City Bordeaux",
  },
};

const PHONE = "06 73 07 23 22";

const Email = (p: Props) => {
  const lang: Lang = (p.lang && STR[p.lang]) ? p.lang : "fr";
  const s = STR[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const url = p.tracking_url || "https://taxicitybordeaux.fr";
  return (
    <Html lang={lang} dir={dir}>
      <Head />
      <Preview>
        {s.preview}{p.prix ? ` — ${s.previewPrice} : ${p.prix}` : ` — ${s.previewTrack}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brandBar}>Taxi City Bordeaux</Text>
          <Text style={brandTag}>{s.tag}</Text>

          <Heading style={h1}>{s.hi} {p.nom || ""}{s.confirmed}</Heading>

          <Text style={text}>{s.intro}</Text>

          <Section style={card}>
            {p.pickup_datetime && (
              <Text style={row}>
                <span style={rowLabel}>{s.when} : </span>
                {p.pickup_datetime}
              </Text>
            )}
            {p.depart && (
              <Text style={row}>
                <span style={rowLabel}>{s.from} : </span>
                {p.depart}
              </Text>
            )}
            {p.arrivee && (
              <Text style={row}>
                <span style={rowLabel}>{s.to} : </span>
                {p.arrivee}
              </Text>
            )}
            {(p.passagers != null || p.bagages != null) && (
              <Text style={row}>
                <span style={rowLabel}>{s.paxLug} : </span>
                {p.passagers != null ? s.pax(p.passagers) : ""}
                {p.passagers != null && p.bagages != null ? " · " : ""}
                {p.bagages != null ? s.lug(p.bagages) : ""}
              </Text>
            )}
            {p.prix && (
              <Text style={{ ...row, marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                <span style={rowLabel}>{s.price} : </span>
                <span style={{ color: BRAND.primary, fontWeight: 700, fontSize: "16px" }}>{p.prix}</span>
                {p.tarif && <span style={{ color: "#999", fontSize: "12px" }}> ({p.tarif})</span>}
              </Text>
            )}
          </Section>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={url} style={button}>{s.trackBtn}</Button>
          </Section>

          <Text style={{ ...text, fontSize: "13px", color: BRAND.textMuted, wordBreak: "break-all" }}>
            {s.trackLink} : {url}
          </Text>

          <Text style={text}>{s.call(PHONE)}</Text>

          <Hr style={divider} />
          <Text style={footer}>{s.footer}</Text>
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
  subject: (data: Record<string, any>) => {
    const lang: Lang = (data?.lang && STR[data.lang as Lang]) ? (data.lang as Lang) : "fr";
    return STR[lang].subject;
  },
  displayName: "Course acceptée — confirmation complète",
  previewData: {
    lang: "fr" as Lang,
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
