import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde" },
      { name: "description", content: "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Disponible 7j/7 24h/24." },
      { property: "og:title", content: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde" },
      { property: "og:description", content: "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Disponible 7j/7 24h/24." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://taxicitybordeaux.fr" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde" },
      { name: "twitter:description", content: "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Disponible 7j/7 24h/24." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://taxicitybordeaux.fr" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TaxiService",
          name: "Taxi City Bordeaux",
          telephone: "+33673072322",
          url: "https://taxicitybordeaux.fr",
          areaServed: "Bordeaux, Gironde",
          priceRange: "€€",
          openingHours: "Mo-Su 00:00-23:59",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sid = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sid);
    supabase.from("site_analytics").insert({ event: "visit", session_id: sid });
  }, []);
  return (
    <I18nProvider>
      <SiteHeader />
      <Outlet />
      {/* WhatsAppFloat renders its own auto-sized mobile spacer. */}
      <WhatsAppFloat />
    </I18nProvider>
  );
}
