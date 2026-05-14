import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, MapPin, Clock, Heart } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos – Taxi City Bordeaux" },
      {
        name: "description",
        content:
          "Taxi City Bordeaux : un service de taxi de proximité, professionnel et premium, basé à Cenon, au service des Bordelais et des Girondins.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-14 md:py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("about.eyebrow")}</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("about.title")}</h1>
      </div>

      <div className="mt-10 space-y-5 text-base text-muted-foreground sm:mt-12 sm:space-y-6 sm:text-lg">
        <p>
          <span className="font-semibold text-foreground">{t("about.p1.brand")}</span> {t("about.p1")}
        </p>
        <p>{t("about.p2")}</p>
        <p>{t("about.p3")}</p>
      </div>

      {/* 1-col on mobile, 2-col on md */}
      <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6">
        {[
          { icon: Award, title: t("about.b1.t"), desc: t("about.b1.d") },
          { icon: Clock, title: t("about.b2.t"), desc: t("about.b2.d") },
          { icon: MapPin, title: t("about.b3.t"), desc: t("about.b3.d") },
          { icon: Heart, title: t("about.b4.t"), desc: t("about.b4.d") },
        ].map((b) => (
          <div key={b.title} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <b.icon className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
            <h3 className="mt-3 font-display text-lg font-semibold sm:mt-4 sm:text-xl">{b.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center sm:mt-14">
        <Link
          to="/reservation"
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] active:scale-95 sm:w-auto sm:rounded-md sm:py-3"
        >
          {t("about.cta")}
        </Link>
      </div>
    </div>
  );
}
