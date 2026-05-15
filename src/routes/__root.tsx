import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { I18nProvider } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>

        <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas ou a été déplacée.</p>

        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
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

      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },

      {
        title: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde",
      },

      {
        name: "description",
        content:
          "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Disponible 7j/7 24h/24.",
      },

      {
        property: "og:title",
        content: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde",
      },

      {
        property: "og:description",
        content:
          "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Disponible 7j/7 24h/24.",
      },

      {
        property: "og:type",
        content: "website",
      },

      {
        property: "og:url",
        content: "https://taxicitybordeaux.fr",
      },

      {
        name: "twitter:card",
        content: "summary_large_image",
      },

      {
        name: "twitter:title",
        content: "Taxi City Bordeaux – Taxi 7j/7 à Bordeaux & en Gironde",
      },

      {
        name: "twitter:description",
        content:
          "Réservez votre taxi à Bordeaux : aéroport Mérignac, gare Saint-Jean, vignobles, longues distances. Conventionné CPAM. Disponible 7j/7 24h/24.",
      },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },

      {
        rel: "canonical",
        href: "https://taxicitybordeaux.fr",
      },
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
    <html lang="fr">
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

/**
 * Pages sans header/footer public
 */
const SHELL_FREE_PREFIXES = ["/admin", "/login"];

function RootComponent() {
  const location = useLocation();
  const path = location.pathname;

  /**
   * Analytics visites
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Ignore admin/login
    if (SHELL_FREE_PREFIXES.some((p) => path.startsWith(p))) {
      return;
    }

    const sid = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);

    sessionStorage.setItem("sid", sid);

    supabase
      .from("site_analytics")
      .insert({
        session_id: sid,
        event: "visit",
        page: path,
        referrer: document.referrer || null,
      })
      .then(({ error }) => {
        if (error) console.error("❌ site_analytics insert error:", error.message, error.code);
      });
  }, [path]);

  const isShellFree = SHELL_FREE_PREFIXES.some((p) => path.startsWith(p));

  return (
    <I18nProvider>
      {!isShellFree && <SiteHeader />}

      <Outlet />

      {!isShellFree && <SiteFooter />}

      {!isShellFree && <WhatsAppFloat />}

      <Toaster position="top-right" theme="dark" richColors closeButton />
    </I18nProvider>
  );
}
