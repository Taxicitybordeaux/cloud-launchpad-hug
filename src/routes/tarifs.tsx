import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs – Taxi City Bordeaux | Forfaits aéroport & gare" },
      { name: "description", content: "Tarifs indicatifs taxi Bordeaux : forfaits aéroport Mérignac, gare Saint-Jean, longues distances. Devis gratuit sur demande." },
    ],
  }),
  component: TarifsPage,
});

const forfaits = [
  { from: "Bordeaux centre", to: "Aéroport Mérignac", jour: "≈ 35 €", nuit: "≈ 50 €" },
  { from: "Bordeaux centre", to: "Gare Saint-Jean", jour: "≈ 15 €", nuit: "≈ 22 €" },
  { from: "Cenon / Floirac", to: "Aéroport Mérignac", jour: "≈ 45 €", nuit: "≈ 60 €" },
  { from: "Mérignac", to: "Gare Saint-Jean", jour: "≈ 30 €", nuit: "≈ 42 €" },
  { from: "Bordeaux", to: "Arcachon", jour: "≈ 110 €", nuit: "≈ 145 €" },
  { from: "Bordeaux", to: "Saint-Émilion", jour: "≈ 95 €", nuit: "≈ 130 €" },
];

function TarifsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tarifs</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Des prix transparents</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Tarifs indicatifs basés sur la réglementation préfectorale. Un devis précis vous est confirmé à la réservation.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left">
          <thead className="bg-secondary text-sm uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4">Départ</th>
              <th className="px-4 py-4">Arrivée</th>
              <th className="px-4 py-4 text-right">Tarif jour</th>
              <th className="px-4 py-4 text-right">Tarif nuit / dim</th>
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Tarifs nuit appliqués de 19h à 7h, dimanches et jours fériés. Forfaits aéroport / gare possibles selon les zones.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display text-xl font-semibold text-primary">🏥 Conventionné CPAM</h3>
          <p className="mt-2 text-sm text-muted-foreground">Sur présentation d'un bon de transport, prise en charge directe par l'Assurance Maladie. Pas d'avance de frais (tiers payant).</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display text-xl font-semibold text-primary">📅 Forfaits événements</h3>
          <p className="mt-2 text-sm text-muted-foreground">Mariages, séminaires, soirées : tarifs forfaitaires sur devis personnalisé. Contactez-nous.</p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link to="/reservation" className="inline-flex rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">
          Demander un devis exact
        </Link>
      </div>
    </div>
  );
}
