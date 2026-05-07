import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Plane, Train, Briefcase, Heart, ShieldCheck, MapPin, Clock, Star, Wallet, Car, ArrowRight, Quote, HelpCircle } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import heroCar from "@/assets/hero-car.jpg";
import destGare from "@/assets/dest-gare.jpg";
import destAeroport from "@/assets/dest-aeroport.jpg";
import destVignobles from "@/assets/dest-vignobles.jpg";
import { useT } from "@/i18n/I18nProvider";

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
          alt="Taxi City Bordeaux – Mercedes break noir"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/40 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-primary backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {t("home.hero.badge")}
            </span>

            <h1 className="mt-7 font-display text-5xl font-bold leading-[1.05] md:text-6xl lg:text-7xl">
              {t("home.hero.title.before")} <span className="italic text-primary">{t("home.hero.title.city")}</span>
              <br className="hidden md:block" />{t("home.hero.title.after")}
            </h1>

            <p className="mt-6 max-w-xl text-base text-foreground/80 md:text-lg">
              {t("home.hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:p-2">
              <div className="flex flex-1 items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                <Car className="h-5 w-5 text-primary" />
                <span>{t("home.hero.need_taxi")}</span>
              </div>
              <a
                href={`tel:${PHONE}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold transition hover:border-primary"
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

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-foreground/70">
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
            { icon: Heart, title: t("svc.wedding.title"), desc: t("svc.wedding.desc") },
            { icon: ShieldCheck, title: t("svc.cpam.title"), desc: t("svc.cpam.desc") },
            { icon: MapPin, title: t("svc.long.title"), desc: t("svc.long.desc") },
          ].map((s) => (
            <div key={s.title} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50">
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
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/40 p-5">
              <h3 className="font-display text-lg font-semibold text-primary">{t("tarifs.cpam.title")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.cpam.desc")}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-5">
              <h3 className="font-display text-lg font-semibold text-primary">{t("tarifs.event.title")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.event.desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("home.test.eyebrow")}</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("home.test.title")}</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: "Camille B.", text: t("home.test.t1") },
              { name: "Julien R.", text: t("home.test.t2") },
              { name: "Sophie L.", text: t("home.test.t3") },
            ].map((tt) => (
              <figure key={tt.name} className="rounded-2xl border border-border bg-background p-6">
                <Quote className="h-6 w-6 text-primary" />
                <blockquote className="mt-4 text-sm leading-relaxed text-foreground/85">"{tt.text}"</blockquote>
                <figcaption className="mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-primary" /> {tt.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border">
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
