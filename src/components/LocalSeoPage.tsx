// Layout partagé pour les 4 pages SEO locales
import { Link } from "@tanstack/react-router";
import { Phone, HelpCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getLanding,
  getFaqTitle,
  RELATED_LABEL,
  LANDING_LABEL,
  LANDING_PATH,
  type LandingKey,
} from "@/lib/seo-landing";

const ALL_KEYS: LandingKey[] = ["airport", "station", "arcachon", "cpam"];

const BACK_LABEL: Record<string, string> = {
  fr: "Retour à l'accueil",
  en: "Back to home",
  es: "Volver al inicio",
  it: "Torna alla home",
  pt: "Voltar à página inicial",
  ar: "العودة إلى الصفحة الرئيسية",
};

const FEE_NOTE: Record<string, string> = {
  fr: "* Des frais de réservation peuvent être appliqués.",
  en: "* Booking fees may apply.",
  es: "* Se pueden aplicar tarifas de reserva.",
  it: "* Potrebbero essere applicati costi di prenotazione.",
  pt: "* Podem ser aplicadas taxas de reserva.",
  ar: "* قد يتم تطبيق رسوم حجز.",
};

export function LocalSeoPage({ landingKey }: { landingKey: LandingKey }) {
  const { lang } = useI18n();
  const c = getLanding(lang, landingKey);
  const others = ALL_KEYS.filter((k) => k !== landingKey);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <Link
        to="/"
        className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm font-semibold transition hover:border-primary/60 hover:bg-card"
      >
        <ArrowLeft className="h-4 w-4 text-primary transition-transform group-hover:-translate-x-1" />
        {BACK_LABEL[lang] ?? BACK_LABEL.fr}
      </Link>

      <header className="mt-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Taxi City Bordeaux</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{c.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-sm text-muted-foreground sm:text-base">
          {c.intro}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/reserver"
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] sm:w-auto"
          >
            {c.ctaBook}
          </Link>
          <a
            href="tel:+33673072322"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 font-semibold sm:w-auto"
          >
            <Phone className="h-4 w-4" />
            {c.ctaCall}
          </a>
        </div>
        <p className="mt-3 text-xs font-semibold text-red-600">{FEE_NOTE[lang] ?? FEE_NOTE.fr}</p>
      </header>

      <section className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-3">
        {c.sections.map((s) => (
          <article key={s.h} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold sm:text-xl">{s.h}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.p}</p>
          </article>
        ))}
      </section>

      <section className="mt-14 sm:mt-20">
        <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">{getFaqTitle(lang)}</h2>
        <div className="mx-auto mt-6 max-w-3xl space-y-3">
          {c.faq.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-card/50 p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-start gap-3 font-semibold [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 text-sm sm:text-base">{f.q}</span>
                <span className="ml-2 text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pl-8 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-12 text-center">
        <Link
          to="/reserver"
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] sm:w-auto"
        >
          {c.ctaBook}
        </Link>
        <p className="mt-3 text-xs font-semibold text-red-600">{FEE_NOTE[lang] ?? FEE_NOTE.fr}</p>
      </div>

      {/* Cross-links vers les autres pages SEO : améliore l'exploration Google et l'UX */}
      <section className="mt-14 border-t border-border pt-10 sm:mt-20">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          {RELATED_LABEL[lang] ?? RELATED_LABEL.fr}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {others.map((k) => (
            <Link
              key={k}
              to={LANDING_PATH[k]}
              className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card/50 px-4 py-3 text-sm font-semibold transition hover:border-primary/60 hover:bg-card"
            >
              <span>{LANDING_LABEL[k][lang] ?? LANDING_LABEL[k].fr}</span>
              <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
