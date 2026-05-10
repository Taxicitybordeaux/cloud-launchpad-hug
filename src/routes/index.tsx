import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, Plane, Train, Briefcase, Wrench, ShieldCheck, MapPin, Clock, Star, Wallet, Car, ArrowRight, Quote, HelpCircle } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import heroCar from "@/assets/hero-bordeaux.jpg";
import destGare from "@/assets/dest-gare.jpg";
import destAeroport from "@/assets/dest-aeroport.jpg";
import destVignobles from "@/assets/dest-vignobles.jpg";
import bestCiteVin from "@/assets/best-cite-vin.jpg";
import bestDunePilat from "@/assets/best-dune-pilat.jpg";
import bestSaintEmilion from "@/assets/best-saint-emilion.jpg";
import bestMiroirEau from "@/assets/best-miroir-eau.jpg";
import { useT } from "@/i18n/I18nProvider";
import { FareSimulator } from "@/components/FareSimulator";
import { ReviewForm } from "@/components/ReviewForm";
import KipfulSection from "@/components/KipfulSection";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde" },
      { name: "description", content: "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Service ponctuel et confortable, jour & nuit." },
    ],
  }),
  component: Home,
});

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

function Home() {
  const t = useT();
  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroCar}
          alt="Bordeaux la nuit – Pont Chaban-Delmas illuminé sur la Garonne"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        {/* Strong overlays so the headline & body copy stay readable in BOTH light/dark themes,
            with an extra bottom-up gradient on mobile where the text sits over the image. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/50 to-black/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/10 sm:hidden" />

        <div className="mx-auto max-w-7xl px-4 pt-16 pb-24 md:pt-24 md:pb-32 text-white">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/40 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-primary backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {t("home.hero.badge")}
            </span>

            <h1 className="mt-7 font-display text-5xl font-bold leading-[1.05] text-white md:text-6xl lg:text-7xl">
              {t("home.hero.title.before")} <span className="italic text-primary">{t("home.hero.title.city")}</span>
              <br className="hidden md:block" />{t("home.hero.title.after")}
            </h1>

            <p className="mt-6 max-w-xl text-base text-white/85 md:text-lg">
              {t("home.hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/40 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:p-2">
              <div className="flex flex-1 items-center gap-3 px-3 py-2 text-sm text-white/80">
                <Car className="h-5 w-5 text-primary" />
                <span>{t("home.hero.need_taxi")}</span>
              </div>
              <a
                href={`tel:${PHONE}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-primary"
              >
                <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
              </a>
              <Link
                to="/reservation"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90"
              >
                {t("home.hero.book_now")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-white/80">
              <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {t("home.hero.tag1")}</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {t("home.hero.tag2")}</span>
              <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> {t("home.hero.tag3")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.dest.eyebrow")}</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.dest.title")}</h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{t("home.dest.intro")}</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { img: destGare, title: t("home.dest.gare.title"), sub: t("home.dest.gare.sub") },
            { img: destAeroport, title: t("home.dest.airport.title"), sub: t("home.dest.airport.sub") },
            { img: destVignobles, title: t("home.dest.vine.title"), sub: t("home.dest.vine.sub") },
          ].map((d) => (
            <Link
              key={d.title}
              to="/reservation"
              className="group relative block aspect-[4/5] overflow-hidden rounded-3xl border border-border"
            >
              <img
                src={d.img}
                alt={d.title}
                loading="lazy"
                width={1024}
                height={1280}
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h3 className="font-display text-2xl font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-foreground/75">{d.sub}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {t("home.dest.cta")} <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BEST SELLERS BORDEAUX */}
      <section className="border-t border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.best.eyebrow")}</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.best.title")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("home.best.intro")}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { img: bestMiroirEau, title: t("home.best.miroir.title"), sub: t("home.best.miroir.sub") },
              { img: bestCiteVin, title: t("home.best.cite.title"), sub: t("home.best.cite.sub") },
              { img: bestSaintEmilion, title: t("home.best.emilion.title"), sub: t("home.best.emilion.sub") },
              { img: bestDunePilat, title: t("home.best.pilat.title"), sub: t("home.best.pilat.sub") },
            ].map((b) => (
              <Link
                key={b.title}
                to="/reservation"
                className="group relative block aspect-[4/5] overflow-hidden rounded-3xl border border-border"
              >
                <img
                  src={b.img}
                  alt={b.title}
                  loading="lazy"
                  width={1024}
                  height={1280}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="font-display text-xl font-semibold">{b.title}</h3>
                  <p className="mt-1 text-sm text-white/80">{b.sub}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
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
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center">
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-primary/20 bg-card p-10">
              <img src={logo} alt="Taxi City Bordeaux" className="mx-auto h-auto w-full max-w-sm" />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-primary/30 bg-background px-6 py-4 shadow-[var(--shadow-gold)] md:block">
              <p className="text-3xl font-bold text-primary">10+</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("home.why.years")}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.why.eyebrow")}</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.why.title")}</h2>
            <p className="mt-5 text-muted-foreground">{t("home.why.desc")}</p>

            <ul className="mt-8 space-y-4">
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
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.how.eyebrow")}</p>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.how.title")}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("home.how.intro")}</p>
        </div>

        {(() => {
          // Each step routes to the most useful next action.
          // Smooth-scroll handlers progressively enhance the anchor links so
          // browsers without :target / scroll-behavior still navigate correctly.
          const scrollTo = (id: string) => (e: React.MouseEvent) => {
            const el = typeof document !== "undefined" ? document.getElementById(id) : null;
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            history.replaceState(null, "", `#${id}`);
          };

          const steps = [
            {
              i: 1,
              kind: "tel" as const,
              href: `tel:${PHONE}`,
              cta: PHONE_DISPLAY,
            },
            {
              i: 2,
              kind: "route" as const,
              to: "/reservation" as const,
              cta: t("home.hero.book_now"),
            },
            {
              i: 3,
              kind: "anchor" as const,
              href: "#faq",
              onClick: scrollTo("faq"),
              cta: t("home.faq.title"),
            },
            {
              i: 4,
              kind: "anchor" as const,
              href: "#simulateur-tarif",
              onClick: scrollTo("simulateur-tarif"),
              cta: t("sim.eyebrow"),
            },
          ];

          const cardClass =
            "group relative flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[var(--shadow-elegant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

          const inner = (s: (typeof steps)[number]) => (
            <>
              <span className="absolute -top-4 left-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground shadow-[var(--shadow-gold)]">
                {s.i}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold">{t(`home.how.s${s.i}.t`)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t(`home.how.s${s.i}.d`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {s.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </>
          );

          return (
            <ol className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`tel:${PHONE}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold transition hover:border-primary"
          >
            <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
          </a>
          <Link
            to="/reservation"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)]"
          >
            {t("home.hero.book_now")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FARE SIMULATOR */}
      <div id="simulateur-tarif" className="scroll-mt-24">
        <FareSimulator />
      </div>

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.services.eyebrow")}</p>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.services.title")}</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Plane, title: t("svc.airport.title"), desc: t("svc.airport.desc") },
            { icon: Train, title: t("svc.train.title"), desc: t("svc.train.desc") },
            { icon: Briefcase, title: t("svc.business.title"), desc: t("svc.business.desc") },
            { icon: Wrench, title: t("svc.wedding.title"), desc: t("svc.wedding.desc") },
            { icon: ShieldCheck, title: t("svc.cpam.title"), desc: t("svc.cpam.desc") },
            { icon: MapPin, title: t("svc.long.title"), desc: t("svc.long.desc") },
          ].map((s) => (
            <div key={s.title} className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            {t("home.services.see_all")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* TARIFS INFO */}
        <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 md:p-8">
          <p className="text-center text-sm text-muted-foreground">{t("tarifs.note")}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 md:items-stretch">
            <div className="flex h-full flex-col rounded-xl border border-border bg-background/40 p-5">
              <h3 className="font-display text-lg font-semibold text-primary">{t("tarifs.cpam.title")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.cpam.desc")}</p>
            </div>
            <div className="flex h-full flex-col rounded-xl border border-border bg-background/40 p-5">
              <h3 className="font-display text-lg font-semibold text-primary">{t("tarifs.event.title")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.event.desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <Testimonials />


      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.faq.eyebrow")}</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.faq.title")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("home.faq.intro")}</p>
          </div>

          <div className="mt-12 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <details
                key={i}
                className="group rounded-xl border border-border bg-card/50 p-5 transition hover:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 font-semibold">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1">{t(`faq.q${i}`)}</span>
                  <span className="ml-2 text-primary transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-8 text-sm leading-relaxed text-muted-foreground">{t(`faq.a${i}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-10 text-center md:p-16">
          <div className="absolute inset-0 bg-[var(--gradient-gold)] opacity-10" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold md:text-5xl">{t("home.cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("home.cta.desc")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/reservation" className="rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">
                {t("home.cta.online")}
              </Link>
              <a href={`tel:${PHONE}`} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-8 py-3 font-semibold">
                <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </section>
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
      const { data } = await supabase
        .from("reviews")
        .select("id,name,rating,text,created_at")
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(9);
      if (!cancelled && data) setReviews(data as Review[]);
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
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.test.eyebrow")}</p>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.test.title")}</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((r) => (
            <figure key={r.id} className="flex h-full flex-col rounded-2xl border border-border bg-background p-6">
              <Quote className="h-6 w-6 text-primary" />
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
