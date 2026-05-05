import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Plane, Train, Briefcase, Heart, ShieldCheck, MapPin, Clock, Star, Wallet, Car, ArrowRight, Quote, HelpCircle } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import heroCar from "@/assets/hero-car.jpg";
import destGare from "@/assets/dest-gare.jpg";
import destAeroport from "@/assets/dest-aeroport.jpg";
import destVignobles from "@/assets/dest-vignobles.jpg";

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
  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroCar}
          alt="Taxi premium à Bordeaux la nuit"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/90 to-background/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/40 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-primary backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Disponible 7j/7 — 24h/24
            </span>

            <h1 className="mt-7 font-display text-5xl font-bold leading-[1.05] md:text-6xl lg:text-7xl">
              Votre taxi à <span className="italic text-primary">Bordeaux</span>,
              <br className="hidden md:block" /> ponctuel et confortable.
            </h1>

            <p className="mt-6 max-w-xl text-base text-foreground/80 md:text-lg">
              Trajets professionnels ou personnels, courses immédiates ou réservées : nous vous emmenons partout en Gironde et en France, de jour comme de nuit, dans un véhicule soigné.
            </p>

            {/* Action bar */}
            <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:p-2">
              <div className="flex flex-1 items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                <Car className="h-5 w-5 text-primary" />
                <span>J'ai besoin d'un taxi…</span>
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
                Réserver une course <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-foreground/70">
              <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Réservation rapide</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Conventionné CPAM</span>
              <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Tarifs transparents</span>
            </div>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Destinations</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">Là où l'on vous emmène</h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Quelques itinéraires que nos clients réservent au quotidien — l'arrivée en douceur, c'est notre métier.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { img: destGare, title: "Gare Bordeaux Saint-Jean", sub: "Accueil quai d'arrivée, aide aux bagages." },
            { img: destAeroport, title: "Aéroport Mérignac", sub: "Suivi des vols, attente offerte 15 min." },
            { img: destVignobles, title: "Châteaux & vignobles", sub: "Médoc, Saint-Émilion, Sauternes — à la journée." },
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
                  Réserver <ArrowRight className="h-3 w-3" />
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
              <p className="text-xs uppercase tracking-widest text-muted-foreground">années d'expérience</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Pourquoi nous</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">Un service simple, humain, fiable.</h2>
            <p className="mt-5 text-muted-foreground">
              Taxi City Bordeaux, c'est un chauffeur de proximité, un véhicule entretenu et l'envie de bien faire. Pas de surprise sur la facture, pas d'attente interminable — on confirme, on arrive, on vous dépose.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                { icon: Clock, t: "Ponctualité garantie", d: "Suivi de vol et de train, marge anti-retard." },
                { icon: Wallet, t: "Tarifs clairs", d: "Devis sur demande, paiement CB & espèces." },
                { icon: ShieldCheck, t: "Conventionné CPAM", d: "Transports de santé pris en charge." },
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Nos prestations</p>
          <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">Pour tous vos déplacements</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Plane, title: "Aéroport Mérignac", desc: "Transferts depuis et vers l'aéroport, jour et nuit." },
            { icon: Train, title: "Gare Saint-Jean", desc: "Prise en charge à l'arrivée, accueil personnalisé." },
            { icon: Briefcase, title: "Déplacements business", desc: "Discrétion et ponctualité pour vos rendez-vous." },
            { icon: Heart, title: "Mariages & événements", desc: "Véhicule soigné pour vos plus beaux moments." },
            { icon: ShieldCheck, title: "Conventionné CPAM", desc: "Transports de santé pris en charge." },
            { icon: MapPin, title: "Longues distances", desc: "Trajets toutes distances en France sur devis." },
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
            Voir tous les services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Ils nous ont fait confiance</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">Ce qu'en disent nos clients</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: "Camille B.", text: "Chauffeur très ponctuel, voiture impeccable. J'ai été déposée à Mérignac en toute tranquillité, je recommande." },
              { name: "Julien R.", text: "Réservation simple, prix annoncé respecté. Parfait pour mes déplacements professionnels à la semaine." },
              { name: "Sophie L.", text: "Pris en charge à la gare avec mes enfants, le chauffeur a été d'une grande gentillesse. On rappellera." },
            ].map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border bg-background p-6">
                <Quote className="h-6 w-6 text-primary" />
                <blockquote className="mt-4 text-sm leading-relaxed text-foreground/85">"{t.text}"</blockquote>
                <figcaption className="mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-primary" /> {t.name}
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Vos questions</p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">On vous répond franchement</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Quelques réponses aux questions qu'on nous pose le plus souvent. Si vous ne trouvez pas, un coup de fil suffit.
            </p>
          </div>

          <div className="mt-12 space-y-3">
            {[
              {
                q: "Êtes-vous conventionné CPAM ?",
                a: "Oui, nous sommes conventionnés avec la CPAM pour les transports de santé (consultations, dialyses, hospitalisations…). Pensez à demander à votre médecin la prescription médicale de transport, et nous nous occupons du reste — vous n'avancez pas les frais dans la plupart des cas.",
              },
                {
                q: "Que se passe-t-il si mon vol a du retard à Mérignac ?",
                a: "On suit votre vol en temps réel. Si l'avion arrive en avance ou en retard, on ajuste l'heure de prise en charge. La première demi-heure d'attente après l'atterrissage est offerte — on ne facture jamais un retard qui n'est pas le vôtre.",
              },
              {
                q: "Comment annuler ou modifier ma réservation ?",
                a: "Un simple appel ou message WhatsApp suffit. L'annulation est gratuite jusqu'à 2 heures avant la course. Pour une modification (horaire, adresse, nombre de passagers), prévenez-nous dès que possible — on s'arrange.",
              },
              {
                q: "Quels moyens de paiement acceptez-vous ?",
                a: "Carte bancaire (sans contact, Apple Pay, Google Pay), espèces, et virement pour les comptes professionnels. Une facture est remise systématiquement à la fin de la course, sur demande pour vos notes de frais.",
              },
              {
                q: "Faut-il réserver à l'avance ?",
                a: "Pas obligatoire — on prend aussi les courses immédiates si on est disponible. Pour un train tôt le matin, un vol ou un rendez-vous important, mieux vaut réserver la veille pour être tranquille.",
              },
              {
                q: "Combien de bagages puis-je emporter ?",
                a: "Une berline confortable accepte facilement 3 à 4 valises et 4 passagers. Pour un groupe, du matériel encombrant ou un vélo, prévenez-nous à la réservation, on adapte le véhicule.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-card/50 p-5 transition hover:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 font-semibold">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1">{item.q}</span>
                  <span className="ml-2 text-primary transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-8 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
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
            <h2 className="font-display text-3xl font-bold md:text-5xl">Prêt à réserver votre course ?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Confirmation rapide, chauffeur professionnel et prix transparent — appelez-nous ou réservez en ligne.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/reservation" className="rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[var(--shadow-gold)]">
                Réserver en ligne
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
