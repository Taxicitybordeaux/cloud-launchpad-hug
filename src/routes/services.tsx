import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, Train, Briefcase, Heart, ShieldCheck, MapPin, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services – Taxi City Bordeaux | Aéroport, Gare, CPAM, Mariages" },
      { name: "description", content: "Découvrez tous nos services taxi à Bordeaux : transferts aéroport Mérignac, gare Saint-Jean, transport conventionné CPAM, mariages, business, longues distances." },
    ],
  }),
  component: ServicesPage,
});

const services = [
  { icon: Plane, title: "Transferts Aéroport Mérignac", desc: "Prise en charge ponctuelle pour vos vols, suivi en temps réel des horaires, accueil avec pancarte sur demande.", points: ["Suivi des vols", "Accueil personnalisé", "Aller-retour possible"] },
  { icon: Train, title: "Gare Saint-Jean & gares TGV", desc: "Transferts depuis ou vers la gare de Bordeaux Saint-Jean et toutes les gares de la région.", points: ["Accueil en gare", "Aide aux bagages", "Disponible 24h/24"] },
  { icon: Briefcase, title: "Déplacements professionnels", desc: "Service discret et premium pour vos rendez-vous, séminaires et déplacements d'affaires.", points: ["Facturation entreprise", "Wifi à bord", "Discrétion garantie"] },
  { icon: Heart, title: "Mariages & événements", desc: "Véhicule soigné pour accompagner vos plus beaux moments avec élégance.", points: ["Véhicule décoré sur demande", "Tarif forfait", "Chauffeur en costume"] },
  { icon: ShieldCheck, title: "Transport conventionné CPAM", desc: "Transport assis professionnalisé pris en charge par l'Assurance Maladie.", points: ["Tiers payant", "Bon de transport accepté", "Hôpitaux & cliniques"] },
  { icon: MapPin, title: "Longues distances", desc: "Trajets toutes distances en France et en Europe, sur devis personnalisé.", points: ["Devis gratuit", "Tarif au kilomètre", "Confort longue durée"] },
];

function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Nos prestations</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Un service taxi pour chaque besoin</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">À Bordeaux, en Gironde et partout en France — un seul interlocuteur, un service haut de gamme.</p>
      </div>

      <div className="mt-14 grid gap-8 md:grid-cols-2">
        {services.map((s) => (
          <article key={s.title} className="rounded-2xl border border-border bg-card p-8 transition hover:border-primary/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="h-7 w-7" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-muted-foreground">{s.desc}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {s.points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          { icon: Clock, label: "7j/7 – 24h/24" },
          { icon: Users, label: "Jusqu'à 4 passagers" },
          { icon: ShieldCheck, label: "Chauffeur professionnel" },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <b.icon className="h-6 w-6 text-primary" />
            <span className="font-medium">{b.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link to="/reservation" className="inline-flex rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">
          Demander un devis / Réserver
        </Link>
      </div>
    </div>
  );
}
