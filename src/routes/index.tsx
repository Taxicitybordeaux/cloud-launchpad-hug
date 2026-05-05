import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageCircle, Plane, Train, Briefcase, Heart, Clock, ShieldCheck, Star, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taxi City Bordeaux – Taxi premium 7j/7 à Bordeaux & Gironde" },
      { name: "description", content: "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, longues distances, mariages, business. Conventionné CPAM. 7j/7." },
    ],
  }),
  component: Home,
});

const PHONE = "0673072322";
const WHATSAPP = "33673072322";

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-dark)]" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.78 0.13 85 / 0.4), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.78 0.13 85 / 0.2), transparent 50%)"
        }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-2 md:py-32">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Disponible 7j/7 — 24h/24
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-tight md:text-6xl">
              Votre taxi <span className="text-primary">premium</span> à Bordeaux
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Confort, ponctualité et discrétion. Transferts aéroport, gare, longues distances, événements et déplacements professionnels en Gironde et partout en France.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`tel:${PHONE}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90">
                <Phone className="h-5 w-5" /> Appeler maintenant
              </a>
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-base font-semibold transition hover:border-primary">
                <MessageCircle className="h-5 w-5 text-green-500" /> WhatsApp
              </a>
              <Link to="/reservation" className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-6 py-3 text-base font-semibold text-primary transition hover:bg-primary/10">
                Réserver en ligne
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Conventionné CPAM</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Ponctualité garantie</div>
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Service haut de gamme</div>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-md rounded-3xl border border-primary/20 bg-card p-10 shadow-[var(--shadow-elegant)]">
              <div className="absolute inset-0 rounded-3xl bg-[var(--gradient-gold)] opacity-10" />
              <div className="relative flex h-full flex-col items-center justify-center text-center">
                <div className="text-7xl">🚖</div>
                <h2 className="mt-6 font-display text-3xl font-bold text-primary">Taxi City</h2>
                <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Privé & Business</p>
                <div className="mt-8 h-px w-24 bg-primary/40" />
                <p className="mt-6 text-sm text-muted-foreground">Bordeaux · Gironde · France</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Nos services</p>
          <h2 className="mt-3 font-display text-4xl font-bold">Pour tous vos déplacements</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Plane, title: "Aéroport Mérignac", desc: "Transferts depuis et vers l'aéroport de Bordeaux-Mérignac, jour et nuit." },
            { icon: Train, title: "Gare Saint-Jean", desc: "Prise en charge à l'arrivée du train, accueil personnalisé en gare." },
            { icon: Briefcase, title: "Déplacements business", desc: "Service discret et ponctuel pour vos rendez-vous professionnels." },
            { icon: Heart, title: "Mariages & événements", desc: "Véhicule soigné pour vos plus beaux moments." },
            { icon: ShieldCheck, title: "Conventionné CPAM", desc: "Transports de santé pris en charge par l'Assurance Maladie." },
            { icon: MapPin, title: "Longues distances", desc: "Trajets toutes distances en France sur simple devis." },
          ].map((s) => (
            <div key={s.title} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-[var(--shadow-gold)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Voir tous les services →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-10 text-center md:p-16">
          <div className="absolute inset-0 bg-[var(--gradient-gold)] opacity-10" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Réservez votre course en quelques clics</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Confirmation rapide, prix transparent, chauffeur professionnel.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/reservation" className="rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">Réserver en ligne</Link>
              <a href={`tel:${PHONE}`} className="rounded-md border border-border bg-background px-8 py-3 font-semibold">📞 {PHONE}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
