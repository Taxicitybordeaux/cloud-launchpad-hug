import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Phone,
  Plane,
  Train,
  Briefcase,
  Wrench,
  ShieldCheck,
  MapPin,
  Clock,
  Star,
  Wallet,
  ArrowRight,
  Quote,
  HelpCircle,
  MessageCircle,
  Heart,
} from "lucide-react";
import logo from "@/assets/tcb-logo-badge.png";
import heroCar from "@/assets/hero-bordeaux.jpg";
import destGare from "@/assets/dest-gare.jpg";
import destAeroport from "@/assets/dest-aeroport.jpg";
import destVignobles from "@/assets/dest-vignobles.jpg";
import bestCiteVin from "@/assets/best-cite-vin.jpg";
import bestDunePilat from "@/assets/best-dune-pilat.jpg";
import bestSaintEmilion from "@/assets/best-saint-emilion.jpg";
import bestMiroirEau from "@/assets/best-miroir-eau.jpg";
import { useT, useI18n } from "@/i18n/I18nProvider";
import installIosGuide from "@/assets/install-ios-guide.jpg";
import installAndroidGuide from "@/assets/install-android-guide.jpg";
import { ReviewForm } from "@/components/ReviewForm";
import { supabase } from "@/integrations/supabase/client";
import { hreflangLinks } from "@/lib/seo-hreflang";

const HOME_TITLE = "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde";
const HOME_DESC =
  "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Service ponctuel et confortable, jour & nuit.";
const HOME_URL = "https://taxicitybordeaux.fr/";

const HOME_FAQ = [
  {
    q: "Êtes-vous conventionné CPAM ?",
    a: "Oui, nous sommes conventionnés avec la CPAM pour les transports de santé (consultations, dialyses, hospitalisations…). Sur présentation d'un bon de transport, prise en charge directe par l'Assurance Maladie. Tiers payant ou ALD — bon de transport toutes distances.",
  },
  {
    q: "Que se passe-t-il si mon vol a du retard à Mérignac ?",
    a: "On suit votre vol en temps réel. Si l'avion arrive en avance ou en retard, on ajuste l'heure de prise en charge.",
  },
  {
    q: "Comment annuler ou modifier ma réservation ?",
    a: "Un simple appel ou message WhatsApp suffit. L'annulation est gratuite jusqu'à 2 heures avant la course. Pour une modification, prévenez-nous dès que possible — on s'arrange.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Carte bancaire (sans contact, Apple Pay, Google Pay), espèces, et virement pour les comptes professionnels. Une facture est remise à la fin de la course, sur demande pour vos notes de frais.",
  },
  {
    q: "Faut-il réserver à l'avance ?",
    a: "Pas obligatoire — on prend aussi les courses immédiates si on est disponible. Pour un train tôt le matin, un vol ou un rendez-vous important, mieux vaut réserver la veille.",
  },
  {
    q: "Combien de bagages puis-je emporter ?",
    a: "Une berline confortable accepte facilement 3 à 4 valises et 4 passagers. Pour un groupe ou du matériel encombrant, prévenez-nous à la réservation, on adapte le véhicule.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:url", content: HOME_URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: HOME_URL }, ...hreflangLinks(HOME_URL)],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: HOME_FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: Home,
});

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";
const WHATSAPP = `https://wa.me/33${PHONE.replace(/^0/, "")}`;

function Home() {
  const t = useT();

  // Sync <title> and meta description with the active language (head() runs at SSR with the default FR).
  useEffect(() => {
    const title = t("home.meta.title");
    const desc = t("home.meta.description");
    if (typeof document !== "undefined") {
      document.title = title;
      const setMeta = (selector: string, content: string) => {
        const el = document.head.querySelector(selector) as HTMLMetaElement | null;
        if (el) el.content = content;
      };
      setMeta('meta[name="description"]', desc);
      setMeta('meta[property="og:title"]', title);
      setMeta('meta[property="og:description"]', desc);
    }
  }, [t]);

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroCar}
          alt={t("home.hero.alt")}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10 sm:hidden" />

        <div className="mx-auto max-w-7xl px-4 pt-10 pb-16 text-white sm:pt-14 sm:pb-20 md:pt-24 md:pb-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/40 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary backdrop-blur sm:px-4 sm:py-1.5 sm:text-[11px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {t("home.hero.badge")}
            </span>

            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {t("home.hero.title.before")} <span className="italic text-primary">{t("home.hero.title.city")}</span>
              <br className="hidden md:block" />
              {t("home.hero.title.after")}
            </h1>

            <p className="mt-4 max-w-xl text-sm text-white/85 sm:mt-6 sm:text-base md:text-lg">
              {t("home.hero.subtitle")}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/80 sm:mt-8 sm:gap-x-7 sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> {t("home.hero.tag1")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> {t("home.hero.tag2")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-primary" /> {t("home.hero.tag3")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.dest.eyebrow")}</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.dest.title")}</h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{t("home.dest.intro")}</p>
        </div>

        <div className="mt-8 grid auto-cols-[80vw] grid-flow-col gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain] sm:auto-cols-[60vw] md:grid-flow-row md:grid-cols-3 md:overflow-visible md:pb-0 md:gap-5">
          {[
            { img: destGare, title: t("home.dest.gare.title"), sub: t("home.dest.gare.sub") },
            { img: destAeroport, title: t("home.dest.airport.title"), sub: t("home.dest.airport.sub") },
            { img: destVignobles, title: t("home.dest.vine.title"), sub: t("home.dest.vine.sub") },
          ].map((d) => (
            <Link
              key={d.title}
              to="/reservation"
              className="group relative block aspect-[4/5] snap-start touch-manipulation overflow-hidden rounded-3xl border border-border [-webkit-tap-highlight-color:transparent]"
            >
              <img
                src={d.img}
                alt={d.title}
                loading="lazy"
                decoding="async"
                width={1024}
                height={1280}
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-display text-xl font-semibold sm:text-2xl">{d.title}</h3>
                <p className="mt-1 text-sm text-foreground/75">{d.sub}</p>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {t("home.dest.cta")} <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BEST SELLERS BORDEAUX */}
      <section className="border-t border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.best.eyebrow")}</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.best.title")}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("home.best.intro")}</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {[
              { img: bestMiroirEau, title: t("home.best.miroir.title"), sub: t("home.best.miroir.sub") },
              { img: bestCiteVin, title: t("home.best.cite.title"), sub: t("home.best.cite.sub") },
              { img: bestSaintEmilion, title: t("home.best.emilion.title"), sub: t("home.best.emilion.sub") },
              { img: bestDunePilat, title: t("home.best.pilat.title"), sub: t("home.best.pilat.sub") },
            ].map((b) => (
              <Link
                key={b.title}
                to="/reservation"
                className="group relative block aspect-[4/5] touch-manipulation overflow-hidden rounded-2xl border border-border [-webkit-tap-highlight-color:transparent] sm:rounded-3xl"
              >
                <img
                  src={b.img}
                  alt={b.title}
                  loading="lazy"
                  decoding="async"
                  width={1024}
                  height={1280}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-5">
                  <h3 className="font-display text-base font-semibold leading-tight sm:text-xl">{b.title}</h3>
                  <p className="mt-0.5 hidden text-sm text-white/80 sm:block">{b.sub}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary sm:mt-3 sm:gap-2 sm:text-xs">
                    {t("home.dest.cta")} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="border-y border-border bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:py-16 md:grid-cols-2 md:items-center md:py-20">
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 sm:p-10">
              <Link to="/login" className="block touch-manipulation [-webkit-tap-highlight-color:transparent]">
                <img
                  src={logo}
                  alt="Taxi City Bordeaux"
                  width={1200}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-auto w-full max-w-xs select-none sm:max-w-sm"
                />
              </Link>
            </div>
          </div>

          <div className="mt-4 md:mt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.why.eyebrow")}</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.why.title")}</h2>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">{t("home.why.desc")}</p>

            <ul className="mt-7 space-y-4 sm:mt-8">
              {[
                { icon: Clock, t: t("home.why.f1.t"), d: t("home.why.f1.d") },
                { icon: Wallet, t: t("home.why.f2.t"), d: t("home.why.f2.d") },
                { icon: ShieldCheck, t: t("home.why.f3.t"), d: t("home.why.f3.d") },
              ].map((f) => (
                <li key={f.t} className="flex gap-4">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{f.t}</p>
                    <p className="text-sm text-muted-foreground">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW TO BOOK */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.how.eyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.how.title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("home.how.intro")}</p>
        </div>

        {(() => {
          const scrollTo = (id: string) => (e: { preventDefault(): void }) => {
            const el = typeof document !== "undefined" ? document.getElementById(id) : null;
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            history.replaceState(null, "", `#${id}`);
          };

          const steps = [
            { i: 1, kind: "route" as const, to: "/reserver" as const, cta: t("home.hero.book_now") },
            { i: 2, kind: "anchor" as const, href: "#faq", onClick: scrollTo("faq"), cta: t("home.faq.eyebrow") },
            { i: 3, kind: "anchor" as const, href: "#faq", onClick: scrollTo("faq"), cta: t("home.faq.eyebrow") },
            { i: 4, kind: "anchor" as const, href: "#faq", onClick: scrollTo("faq"), cta: t("home.faq.eyebrow") },
            { i: 5, kind: "tel" as const, href: `tel:${PHONE}`, cta: PHONE_DISPLAY },
            { i: 6, kind: "anchor" as const, href: "#faq", onClick: scrollTo("faq"), cta: t("home.faq.eyebrow") },
          ];

          const cardClass =
            "group relative flex h-full flex-col touch-manipulation rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [-webkit-tap-highlight-color:transparent] sm:p-6";

          const inner = (s: (typeof steps)[number]) => (
            <>
              <span className="absolute -top-4 left-5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-[var(--shadow-gold)] sm:-top-4 sm:left-6 sm:h-9 sm:w-9 sm:text-base">
                {s.i}
              </span>
              <h3 className="mt-3 font-display text-base font-semibold sm:text-lg">{t(`home.how.s${s.i}.t`)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{t(`home.how.s${s.i}.d`)}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                <span className="whitespace-nowrap">{s.cta}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </>
          );

          return (
            <ol className="relative mt-10 grid grid-cols-1 gap-6 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((s) => (
                <li key={s.i} className="contents">
                  {s.kind === "route" ? (
                    <Link to={s.to} className={cardClass}>
                      {inner(s)}
                    </Link>
                  ) : (
                    <a href={s.href} onClick={s.kind === "anchor" ? s.onClick : undefined} className={cardClass}>
                      {inner(s)}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          );
        })()}

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <Link
            to="/reservation"
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] [-webkit-tap-highlight-color:transparent] active:scale-95"
          >
            {t("home.hero.book_now")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.services.eyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.services.title")}</h2>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-3">
          {[
            { icon: Plane, title: t("svc.airport.title"), desc: t("svc.airport.desc") },
            { icon: Train, title: t("svc.train.title"), desc: t("svc.train.desc") },
            { icon: Briefcase, title: t("svc.business.title"), desc: t("svc.business.desc") },
            { icon: Wrench, title: t("svc.wedding.title"), desc: t("svc.wedding.desc") },
            { icon: ShieldCheck, title: t("svc.cpam.title"), desc: t("svc.cpam.desc") },
            { icon: MapPin, title: t("svc.long.title"), desc: t("svc.long.desc") },
          ].map((s) => (
            <div
              key={s.title}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:h-11 sm:w-11">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-display text-base font-semibold sm:mt-4 sm:text-xl">{s.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center sm:mt-10">
          <Link
            to="/services"
            className="inline-flex touch-manipulation items-center gap-2 text-sm font-semibold text-primary [-webkit-tap-highlight-color:transparent] hover:underline"
          >
            {t("home.services.see_all")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* TARIFS INFO */}
        <div className="mt-10 rounded-2xl border border-border bg-card/50 p-5 sm:mt-12 md:p-8">
          <p className="text-center text-sm text-muted-foreground">{t("tarifs.note.day")}</p>
          <p className="mt-1 text-center text-sm text-muted-foreground">{t("tarifs.note.night")}</p>
          <p className="mt-2 text-center text-sm font-semibold text-red-600">{t("tarifs.note.fee")}</p>
          <div className="mt-5 grid gap-4 sm:mt-6 md:grid-cols-2 md:items-stretch">
            <div className="flex h-full flex-col rounded-xl border border-border bg-background/40 p-4 sm:p-5">
              <h3 className="font-display text-base font-semibold text-primary sm:text-lg">{t("tarifs.cpam.title")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.cpam.desc")}</p>
            </div>
            <div className="flex h-full flex-col rounded-xl border border-border bg-background/40 p-4 sm:p-5">
              <h3 className="font-display text-base font-semibold text-primary sm:text-lg">
                {t("tarifs.event.title")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.event.desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ESPACE CLIENT */}
      <section className="border-t border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 sm:p-10 md:p-14">
            <div className="absolute inset-0 bg-[var(--gradient-gold)] opacity-5" />
            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:gap-14">
              {/* Texte */}
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                  {t("home.client.eyebrow")}
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                  {t("home.client.title.before")}
                  <span className="italic text-primary">{t("home.client.title.italic")}</span>
                  {t("home.client.title.after")}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t("home.client.desc")}
                </p>
                <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">🚕</span> {t("home.client.li.rides")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">📋</span> {t("home.client.li.history")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">💬</span> {t("home.client.li.chat")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">👤</span> {t("home.client.li.profile")}
                  </li>
                </ul>
              </div>
              {/* CTA */}
              <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row md:flex-col">
                <Link
                  to="/client/login"
                  className="touch-manipulation rounded-xl bg-primary px-7 py-3.5 text-center font-semibold text-primary-foreground shadow-[var(--shadow-gold)] [-webkit-tap-highlight-color:transparent] active:scale-95"
                >
                  {t("home.client.cta_login")}
                </Link>
                <Link
                  to="/reservation"
                  className="touch-manipulation rounded-xl border border-border bg-background px-7 py-3.5 text-center font-semibold [-webkit-tap-highlight-color:transparent] active:scale-95"
                >
                  {t("home.client.cta_book")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <Testimonials />

      {/* INSTALL APP */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16 md:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.install.eyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.install.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:mt-4 sm:text-base">
            {t("home.install.desc")}
          </p>
        </div>

        <div className="mt-6 rounded-xl border-2 border-red-400 bg-red-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔔</span>
            <div className="text-sm text-red-700">
              <p className="font-semibold">{t("home.install.push_title")}</p>
              <p className="mt-1" dangerouslySetInnerHTML={{ __html: t("home.install.push_how") }} />
              <p className="mt-1" dangerouslySetInnerHTML={{ __html: t("home.install.push_why") }} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {/* iPhone / iOS */}
          <div className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <span className="text-lg">🍎</span>
              </div>
              <h3 className="font-display text-xl font-semibold">{t("home.install.ios.title")}</h3>
            </div>

            <img
              src={installIosGuide}
              alt={t("home.install.ios.img_alt")}
              className="mb-4 w-full rounded-xl border border-border"
              loading="lazy"
              decoding="async"
              width={1024}
              height={512}
            />

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  1
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.ios.step1") }} />
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  2
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.ios.step2") }} />
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  3
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.ios.step3") }} />
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  4
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.ios.step4") }} />
              </li>
            </ol>

            <p className="mt-5 text-xs text-muted-foreground border-t border-border pt-4">
              <span dangerouslySetInnerHTML={{ __html: t("home.install.ios.tip") }} />
            </p>
          </div>

          {/* Android */}
          <div className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <span className="text-lg">🤖</span>
              </div>
              <h3 className="font-display text-xl font-semibold">{t("home.install.android.title")}</h3>
            </div>

            <img
              src={installAndroidGuide}
              alt={t("home.install.android.img_alt")}
              className="mb-4 w-full rounded-xl border border-border"
              loading="lazy"
              decoding="async"
              width={1024}
              height={1024}
            />

            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  1
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.android.step1") }} />
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  2
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.android.step2") }} />
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  3
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.android.step3") }} />
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  4
                </span>
                <span dangerouslySetInnerHTML={{ __html: t("home.install.android.step4") }} />
              </li>
            </ol>

            <p className="mt-5 text-xs text-muted-foreground border-t border-border pt-4">
              <span dangerouslySetInnerHTML={{ __html: t("home.install.android.tip") }} />
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <p className="text-sm">
            <strong>✨ {t("home.help.title")}</strong> {t("home.help.call_prefix")}{" "}
            <a
              href="tel:+33673072322"
              className="touch-manipulation whitespace-nowrap font-semibold text-primary [-webkit-tap-highlight-color:transparent] hover:underline"
            >
              {PHONE_DISPLAY}
            </a>{" "}
            {t("home.help.or_write")}{" "}
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-manipulation font-semibold text-primary [-webkit-tap-highlight-color:transparent] hover:underline"
            >
              WhatsApp
            </a>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16 md:py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.faq.eyebrow")}</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.faq.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:mt-4 sm:text-base">
              {t("home.faq.intro")}
            </p>
          </div>

          <div className="mt-8 space-y-3 sm:mt-12">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <details
                key={i}
                className="group rounded-xl border border-border bg-card/50 p-4 transition hover:border-primary/40 sm:p-5"
              >
                <summary className="flex cursor-pointer touch-manipulation list-none items-start gap-3 font-semibold [-webkit-tap-highlight-color:transparent] [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1 text-sm sm:text-base">{t(`faq.q${i}`)}</span>
                  <span className="ml-2 text-primary transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-8 text-sm leading-relaxed text-muted-foreground">{t(`faq.a${i}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:py-16 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] md:py-20 md:pb-[calc(10rem+env(safe-area-inset-bottom))]">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-8 text-center sm:p-10 md:p-16">
          <div className="absolute inset-0 bg-[var(--gradient-gold)] opacity-10" />
          <div className="relative">
            <h2 className="font-display text-2xl font-bold sm:text-3xl md:text-5xl">{t("home.cta.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:mt-4 sm:text-base">
              {t("home.cta.desc")}
            </p>
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:items-center">
              <Link
                to="/reservation"
                className="touch-manipulation rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] [-webkit-tap-highlight-color:transparent] active:scale-95"
              >
                {t("home.cta.online")}
              </Link>
              <a
                href={`tel:${PHONE}`}
                className="inline-flex touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-8 py-3.5 font-semibold [-webkit-tap-highlight-color:transparent] active:scale-95"
              >
                <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* BARRE FLOTTANTE BAS — rendu par WhatsAppFloat dans __root.tsx */}
    </>
  );
}

type Review = { id: string; name: string; rating: number; text: string; created_at: string };

function Testimonials() {
  const t = useT();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("avis")
        .select("id,author_name,note,commentaire,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(9);
      if (!cancelled && data) {
        setReviews(
          (data as any[]).map((a) => ({
            id: a.id,
            name: a.author_name || "Anonyme",
            rating: a.note ?? 5,
            text: a.commentaire || "",
            created_at: a.created_at,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const fallback = [
    { id: "f1", name: "Camille B.", rating: 5, text: t("home.test.t1"), created_at: "" },
    { id: "f2", name: "Julien R.", rating: 5, text: t("home.test.t2"), created_at: "" },
    { id: "f3", name: "Sophie L.", rating: 5, text: t("home.test.t3"), created_at: "" },
  ];
  const items = reviews.length > 0 ? reviews : fallback;

  return (
    <section className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.test.eyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("home.test.title")}</h2>
        </div>
        <div className="mt-8 grid auto-cols-[85vw] grid-flow-col gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain] sm:auto-cols-[60vw] md:grid-flow-row md:grid-cols-3 md:overflow-visible md:pb-0 md:gap-6 md:mt-12">
          {items.map((r) => (
            <figure
              key={r.id}
              className="flex h-full flex-col snap-start rounded-2xl border border-border bg-background p-5 sm:p-6"
            >
              <Quote className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <div className="mt-3 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/85">"{r.text}"</blockquote>
              <figcaption className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {r.name}
              </figcaption>
            </figure>
          ))}
        </div>

        <ReviewForm onSubmitted={() => setRefreshKey((k) => k + 1)} />
      </div>
    </section>
  );
}
