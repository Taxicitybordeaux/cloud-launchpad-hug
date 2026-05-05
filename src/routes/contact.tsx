import { createFileRoute } from "@tanstack/react-router";
import { Phone, Mail, MapPin, MessageCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact – Taxi City Bordeaux" },
      { name: "description", content: "Contactez Taxi City Bordeaux : 06 73 07 23 22, taxi.city0033@gmail.com, 163 cours Victor Hugo 33150 Cenon." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Contact</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Nous contacter</h1>
        <p className="mt-4 text-muted-foreground">Disponible 7j/7 — n'hésitez pas à appeler à tout moment.</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <a href="tel:0673072322" className="group rounded-2xl border border-border bg-card p-8 transition hover:border-primary">
          <Phone className="h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Téléphone</h2>
          <p className="mt-2 text-3xl font-bold text-primary">06 73 07 23 22</p>
          <p className="mt-1 text-sm text-muted-foreground">Appel direct — réponse immédiate</p>
        </a>

        <a href="https://wa.me/33673072322" target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-border bg-card p-8 transition hover:border-primary">
          <MessageCircle className="h-10 w-10 text-green-500" />
          <h2 className="mt-4 font-display text-2xl font-semibold">WhatsApp</h2>
          <p className="mt-2 text-xl font-semibold">Discutons sur WhatsApp</p>
          <p className="mt-1 text-sm text-muted-foreground">Idéal pour envoyer une adresse</p>
        </a>

        <a href="mailto:taxi.city0033@gmail.com" className="group rounded-2xl border border-border bg-card p-8 transition hover:border-primary">
          <Mail className="h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Email</h2>
          <p className="mt-2 text-lg font-semibold break-all">taxi.city0033@gmail.com</p>
          <p className="mt-1 text-sm text-muted-foreground">Pour devis & demandes spéciales</p>
        </a>

        <div className="rounded-2xl border border-border bg-card p-8">
          <MapPin className="h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Adresse</h2>
          <p className="mt-2 font-semibold">163 cours Victor Hugo</p>
          <p className="text-muted-foreground">33150 Cenon</p>
          <p className="mt-3 text-sm text-muted-foreground">Station de taxis officielle à Bordeaux + interventions toute la Gironde.</p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <Clock className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 font-display text-xl font-semibold">Disponible 7j/7 — 24h/24</p>
        <p className="mt-1 text-sm text-muted-foreground">Y compris week-ends et jours fériés.</p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-border">
        <iframe
          src="https://www.google.com/maps?q=163+cours+Victor+Hugo,+33150+Cenon&output=embed"
          width="100%" height="400" loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Localisation Taxi City Bordeaux"
        />
      </div>
    </div>
  );
}
