import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import appCss from "@/styles.css?url";
import logoUrl from "@/assets/logo.jpeg?url";
import { APP_VERSION } from "@/lib/version";

const v = `?v=${encodeURIComponent(APP_VERSION)}`;


export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover",
      },
      { title: "Taxi City Bordeaux" },
      { name: "app-version", content: APP_VERSION },
      // PWA — iOS Safari (obligatoire pour activer les push notifications sur iPhone)
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Taxi Bordeaux" },
      // PWA — Android / générique
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#1a1a2e" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Manifest PWA — requis pour push iOS + "Ajouter à l'écran d'accueil"
      // Cache-busting versionné sur les fichiers statiques non hashés.
      { rel: "manifest", href: `/manifest.json${v}` },
      { rel: "apple-touch-icon", href: `/apple-touch-icon.png${v}` },
      { rel: "apple-touch-icon", sizes: "180x180", href: `/apple-touch-icon.png${v}` },
      { rel: "icon", type: "image/png", sizes: "192x192", href: `/icon-192.png${v}` },
      { rel: "icon", type: "image/png", sizes: "512x512", href: `/icon-512.png${v}` },
      // Perf mobile : preconnect aux origines critiques (Supabase, tuiles carte, géocoder)
      { rel: "preconnect", href: "https://yxbbkzugsreztiacnswf.supabase.co", crossOrigin: "" },
      { rel: "dns-prefetch", href: "https://yxbbkzugsreztiacnswf.supabase.co" },
      { rel: "preconnect", href: "https://a.tile.openstreetmap.org", crossOrigin: "" },
      { rel: "preconnect", href: "https://nominatim.openstreetmap.org", crossOrigin: "" },
      { rel: "dns-prefetch", href: "https://router.project-osrm.org" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Page introuvable</h1>
        <a href="/" className="text-primary underline">
          Retour à l'accueil
        </a>
      </div>
    </div>
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@/lib/firebase").then(({ setupForegroundNotifications }) => {
      cleanup = setupForegroundNotifications();
    });
    // Nettoie l'ancien cache PWA en production sans casser la preview.
    import("@/lib/pwa").then(({ registerPWA }) => registerPWA());
    // Surveille les nouvelles versions et propose un rechargement.
    import("@/lib/versionWatcher").then(({ startVersionWatcher }) =>
      startVersionWatcher(),
    );
    // Vérification au démarrage de la clé Google Maps (warning dev si absente).
    import("@/lib/googleConfig").then(({ assertGoogleConfigOnStartup }) =>
      assertGoogleConfigOnStartup(),
    );
    return () => cleanup?.();
  }, []);


  const showHeader =
    !pathname.startsWith("/reserver") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/suivi") &&
    !pathname.startsWith("/login");

  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <I18nProvider>
          {showHeader && <SiteHeader />}
          {children}
          <Toaster />
          <WhatsAppFloat />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
