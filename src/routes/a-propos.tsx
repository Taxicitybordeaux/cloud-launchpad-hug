import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, MapPin, Clock, Heart } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos – Taxi City Bordeaux" },
      { name: "description", content: "Taxi City Bordeaux : un service de taxi de proximité, professionnel et premium, basé à Cenon, au service des Bordelais et des Girondins." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("about.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("about.title")}</h1>
      </div>

      <div className="mt-12 space-y-6 text-lg text-muted-foreground">
        <p>
          <span className="text-foreground font-semibold">{t("about.p1.brand")}</span> {t("about.p1")}
        </p>
        <p>{t("about.p2")}</p>
        <p>{t("about.p3")}</p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {[
          { icon: Award, title: t("about.b1.t"), desc: t("about.b1.d") },
          { icon: Clock, title: t("about.b2.t"), desc: t("about.b2.d") },
          { icon: MapPin, title: t("about.b3.t"), desc: t("about.b3.d") },
          { icon: Heart, title: t("about.b4.t"), desc: t("about.b4.d") },
        ].map((b) => (
          <div key={b.title} className="rounded-xl border border-border bg-card p-6">
            <b.icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 font-display text-xl font-semibold">{b.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link to="/reservation" className="inline-flex rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">
          {t("about.cta")}
        </Link>
      </div>
    </div>
  );
}
