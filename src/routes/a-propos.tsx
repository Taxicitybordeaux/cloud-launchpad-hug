import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, MapPin, Clock, Heart } from "lucide-react";

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
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Notre histoire</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">À propos de Taxi City Bordeaux</h1>
      </div>

      <div className="mt-12 space-y-6 text-lg text-muted-foreground">
        <p>
          <span className="text-foreground font-semibold">Taxi City Bordeaux</span> est une entreprise de taxi indépendante basée à Cenon, à proximité immédiate de Bordeaux. Nous avons à cœur de proposer un service à la hauteur de l'élégance bordelaise : ponctualité, confort et discrétion.
        </p>
        <p>
          Que vous soyez un particulier qui rejoint l'aéroport, un professionnel en déplacement, ou un patient nécessitant un transport médical conventionné, nous adaptons notre prestation à votre besoin.
        </p>
        <p>
          Notre véhicule récent, climatisé et soigneusement entretenu, vous garantit un trajet agréable, en toutes circonstances.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {[
          { icon: Award, title: "Chauffeur professionnel", desc: "Carte professionnelle de taxi, formation continue, parfaite connaissance de Bordeaux et de la Gironde." },
          { icon: Clock, title: "Disponible 7j/7", desc: "De jour comme de nuit, week-ends et jours fériés inclus." },
          { icon: MapPin, title: "Bordeaux & Gironde", desc: "Station officielle à Bordeaux. Toute la métropole, l'aéroport, les gares et toute la France sur réservation." },
          { icon: Heart, title: "Conventionné CPAM", desc: "Transport assis professionnalisé pris en charge par l'Assurance Maladie." },
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
          Réserver une course
        </Link>
      </div>
    </div>
  );
}
