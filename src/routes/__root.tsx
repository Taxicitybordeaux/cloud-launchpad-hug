import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { PushDebug } from "@/components/PushDebug";
import appCss from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Taxi City Bordeaux" },
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
      { rel: "manifest", href: "/manifest.json" },
      // Icône iOS (remplacer par un PNG 180×180 pour un meilleur rendu)
      { rel: "apple-touch-icon", href: "/favicon.ico" },
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
          <PushDebug />
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
