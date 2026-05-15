import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, Train, Briefcase, Wrench, ShieldCheck, MapPin, Users, Clock, HelpCircle } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { BulletedList } from "@/components/BulletedList";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services – Taxi City Bordeaux | Aéroport, Gare, CPAM, Mariages" },
      {
        name: "description",
        content:
          "Découvrez tous nos services taxi à Bordeaux : transferts aéroport de Bordeaux, gare Saint-Jean, transport conventionné CPAM, mariages, business, longues distances.",
      },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const t = useT();
  const services = [
    {
      icon: Plane,
      title: t("svcp.airport.title"),
      desc: t("svcp.airport.desc"),
      points: [t("svcp.airport.p1"), t("svcp.airport.p2"), t("svcp.airport.p3")],
    },
    {
      icon: Train,
      title: t("svcp.train.title"),
      desc: t("svcp.train.desc"),
      points: [t("svcp.train.p1"), t("svcp.train.p2"), t("svcp.train.p3")],
    },
    {
      icon: Briefcase,
      title: t("svcp.business.title"),
      desc: t("svcp.business.desc"),
      points: [t("svcp.business.p1"), t("svcp.business.p2"), t("svcp.business.p3")],
    },
    {
      icon: Wrench,
      title: t("svcp.wedding.title"),
      desc: t("svcp.wedding.desc"),
      points: [t("svcp.wedding.p1"), t("svcp.wedding.p2"), t("svcp.wedding.p3")],
    },
    {
      icon: ShieldCheck,
      title: t("svcp.cpam.title"),
      desc: t("svcp.cpam.desc"),
      points: [t("svcp.cpam.p1"), t("svcp.cpam.p2"), t("svcp.cpam.p3")],
    },
    {
      icon: MapPin,
      title: t("svcp.long.title"),
      desc: t("svcp.long.desc"),
      points: [t("svcp.long.p1"), t("svcp.long.p2"), t("svcp.long.p3")],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:py-14 md:py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("services.eyebrow")}</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("services.title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:mt-4 sm:text-base">
          {t("services.intro")}
        </p>
      </div>

      {/* 1-col on mobile, 2-col on md */}
      <div className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-2">
        {services.map((s, i) => {
          const headingId = `svc-${i}-title`;
          return (
            <article
              key={s.title}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 sm:p-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-14 sm:w-14">
                <s.icon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h2 id={headingId} className="mt-4 font-display text-lg font-semibold sm:mt-5 sm:text-2xl">
                {s.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{s.desc}</p>
              <BulletedList items={s.points} className="mt-4" ariaLabelledBy={headingId} />
            </article>
          );
        })}
      </div>

      {/* Badges: 1-col on mobile, 3-col on md */}
      <div className="mt-10 grid gap-3 sm:mt-16 sm:grid-cols-3 sm:gap-4">
        {[
          { icon: Clock, label: t("services.b1") },
          { icon: Users, label: t("services.b2") },
          { icon: ShieldCheck, label: t("services.b3") },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <b.icon className="h-6 w-6 shrink-0 text-primary" />
            <span className="text-sm font-medium sm:text-base">{b.label}</span>
          </div>
        ))}
      </div>

      <section className="mt-14 sm:mt-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">FAQ</p>
          <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl md:text-4xl">{t("faqx.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">{t("faqx.intro")}</p>
        </div>
        <div className="mx-auto mt-8 max-w-3xl space-y-3 sm:mt-10">
          {(["tracking", "wait", "cpam"] as const).map((k) => (
            <details
              key={k}
              className="group rounded-xl border border-border bg-card/50 p-4 transition hover:border-primary/40 sm:p-5"
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 font-semibold">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 text-sm sm:text-base">{t(`faqx.${k}.q`)}</span>
                <span className="ml-2 text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pl-8 text-sm leading-relaxed text-muted-foreground">{t(`faqx.${k}.a`)}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-12 text-center sm:mt-16">
        <Link
          to="/reservation"
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] active:scale-95 sm:w-auto sm:rounded-md sm:py-3"
        >
          {t("services.cta")}
        </Link>
      </div>
    </div>
  );
}
