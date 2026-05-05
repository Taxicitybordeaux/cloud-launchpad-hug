import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Phone, MessageCircle } from "lucide-react";
import appCss from "../styles.css?url";

const PHONE = "0673072322";
const WHATSAPP = "33673072322";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Retour à l'accueil</Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & Gironde" },
      { name: "description", content: "Taxi City Bordeaux : transferts aéroport Mérignac, gare Saint-Jean, longues distances, événements, mariages. Conventionné CPAM. Disponible 7j/7." },
      { name: "author", content: "Taxi City Bordeaux" },
      { property: "og:title", content: "Taxi City Bordeaux – Taxi premium 7j/7" },
      { property: "og:description", content: "Service de taxi fiable et premium à Bordeaux et en Gironde." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const links = [
    { to: "/", label: "Accueil" },
    { to: "/services", label: "Services" },
    { to: "/tarifs", label: "Tarifs" },
    { to: "/reservation", label: "Réservation" },
    { to: "/a-propos", label: "À propos" },
    { to: "/contact", label: "Contact" },
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-primary">TAXI CITY</span>
          <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:inline">Bordeaux</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-foreground/80 transition-colors hover:text-primary" activeProps={{ className: "text-primary font-medium" }} activeOptions={{ exact: l.to === "/" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <a href={`tel:${PHONE}`} className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90 md:inline-flex">
          <Phone className="h-4 w-4" /> {PHONE}
        </a>
      </div>
      {/* Mobile bottom nav */}
      <nav className="flex overflow-x-auto border-t border-border md:hidden">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="whitespace-nowrap px-3 py-2 text-xs text-foreground/70" activeProps={{ className: "text-primary font-semibold" }} activeOptions={{ exact: l.to === "/" }}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-display text-lg font-bold text-primary">Taxi City Bordeaux</h3>
          <p className="mt-2 text-sm text-muted-foreground">Votre taxi premium à Bordeaux & en Gironde, 7j/7.</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href={`tel:${PHONE}`} className="hover:text-primary">📞 {PHONE}</a></li>
            <li><a href="mailto:taxi.city0033@gmail.com" className="hover:text-primary">✉️ taxi.city0033@gmail.com</a></li>
            <li>📍 163 cours Victor Hugo, 33150 Cenon</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">Zone desservie</h4>
          <p className="mt-3 text-sm text-muted-foreground">Bordeaux centre, Gironde, aéroport de Mérignac, gare Saint-Jean, et toute la France sur réservation.</p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Taxi City Bordeaux — Tous droits réservés.
      </div>
    </footer>
  );
}

function FloatingActions() {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
         className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition hover:scale-110">
        <MessageCircle className="h-6 w-6" />
      </a>
      <a href={`tel:${PHONE}`} aria-label="Appeler"
         className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-gold)] transition hover:scale-110">
        <Phone className="h-6 w-6" />
      </a>
    </div>
  );
}

function RootComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <FloatingActions />
    </div>
  );
}
