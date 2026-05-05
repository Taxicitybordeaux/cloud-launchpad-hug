import { createFileRoute, Link } from "@tanstack/react-router";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs – Taxi City Bordeaux | Forfaits aéroport & gare" },
      { name: "description", content: "Tarifs indicatifs taxi Bordeaux : forfaits aéroport Mérignac, gare Saint-Jean, longues distances. Devis gratuit sur demande." },
    ],
  }),
  component: TarifsPage,
});

function TarifsPage() {
  const t = useT();
  const forfaits = [
    { from: t("city.bdx_centre"), to: t("city.airport"), jour: "≈ 35 €", nuit: "≈ 50 €" },
    { from: t("city.bdx_centre"), to: t("city.gare"), jour: "≈ 15 €", nuit: "≈ 22 €" },
    { from: t("city.cenon"), to: t("city.airport"), jour: "≈ 45 €", nuit: "≈ 60 €" },
    { from: t("city.merignac"), to: t("city.gare"), jour: "≈ 30 €", nuit: "≈ 42 €" },
    { from: t("city.bdx"), to: t("city.arcachon"), jour: "≈ 110 €", nuit: "≈ 145 €" },
    { from: t("city.bdx"), to: t("city.stemilion"), jour: "≈ 95 €", nuit: "≈ 130 €" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("tarifs.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("tarifs.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("tarifs.intro")}</p>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left">
          <thead className="bg-secondary text-sm uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4">{t("tarifs.col.from")}</th>
              <th className="px-4 py-4">{t("tarifs.col.to")}</th>
              <th className="px-4 py-4 text-right">{t("tarifs.col.day")}</th>
              <th className="px-4 py-4 text-right">{t("tarifs.col.night")}</th>
            </tr>
          </thead>
          <tbody>
            {forfaits.map((f, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-4 font-medium">{f.from}</td>
                <td className="px-4 py-4 text-muted-foreground">{f.to}</td>
                <td className="px-4 py-4 text-right text-primary font-semibold">{f.jour}</td>
                <td className="px-4 py-4 text-right text-primary font-semibold">{f.nuit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{t("tarifs.note")}</p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display text-xl font-semibold text-primary">{t("tarifs.cpam.title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.cpam.desc")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display text-xl font-semibold text-primary">{t("tarifs.event.title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("tarifs.event.desc")}</p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link to="/reservation" className="inline-flex rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">
          {t("tarifs.cta")}
        </Link>
      </div>
    </div>
  );
}
