import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import appCss from "@/styles.css?url";
import logoUrl from "@/assets/tcb-logo-badge.png?url";
import { APP_VERSION } from "@/lib/version";
import { supabase } from "@/integrations/supabase/client";

const v = `?v=${encodeURIComponent(APP_VERSION)}`;

// ── Heartbeat visiteur actif + pageview tracker ─────────────────────────
function useVisitorHeartbeat(pathname: string) {
  React.useEffect(() => {
    // Exclure les pages internes (José ne compte pas comme visiteur client)
    if (pathname.startsWith("/reservation") || pathname.startsWith("/admin") || pathname.startsWith("/driver")) return;

    const sid =
      sessionStorage.getItem("visitor_sid") ??
      (() => {
        const id = crypto.randomUUID();
        sessionStorage.setItem("visitor_sid", id);
        return id;
      })();

    // 1) Pageview tracker → site_analytics (compteur global "Site")
    void (supabase as any)
      .from("site_analytics")
      .insert({
        event: "pageview",
        session_id: sid,
        page: pathname,
        referrer: document.referrer || null,
      })
      .then(({ error }: any) => {
        if (error && import.meta.env.DEV) console.warn("[analytics] pageview failed:", error.message);
      });

    // 2) Heartbeat active_visitors → compteur temps réel
    //    Delete-then-insert : la policy UPDATE a été supprimée pour empêcher
    //    qu'une session anonyme n'écrase la ligne d'une autre. On garde
    //    l'INSERT anonyme (validé par la policy) et on nettoie l'ancienne
    //    ligne du même session_id juste avant.
    const heartbeat = async () => {
      try {
        await (supabase as any).from("active_visitors").delete().eq("session_id", sid);
        await (supabase as any)
          .from("active_visitors")
          .insert({ session_id: sid, page: pathname, last_seen: new Date().toISOString() });
      } catch {
        /* non-fatal : compteur best-effort */
      }
    };

    heartbeat();
    const iv = setInterval(heartbeat, 30_000);

    const remove = () => (supabase as any).from("active_visitors").delete().eq("session_id", sid);

    window.addEventListener("beforeunload", remove);
    return () => {
      clearInterval(iv);
      window.removeEventListener("beforeunload", remove);
      remove();
    };
  }, [pathname]);
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover",
      },
      { title: "Taxi Bordeaux 24h/24 — Taxi City Bordeaux, conventionné CPAM" },
      { name: "google-site-verification", content: "8Nns29k1UiDQUEiVe6o2ATMYw2gr4uc1dWQMgdJGYwc" },
      { name: "app-version", content: APP_VERSION },
      // PWA — iOS Safari (obligatoire pour activer les push notifications sur iPhone)
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Taxi Bordeaux" },
      // PWA — Android / générique
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#151515" },
      { property: "og:site_name", content: "Taxi City Bordeaux" },
      { property: "og:title", content: "Taxi Bordeaux 24h/24 — Taxi City Bordeaux" },
      { name: "twitter:title", content: "Taxi Bordeaux 24h/24 — Taxi City Bordeaux" },
      {
        name: "description",
        content:
          "Taxi à Bordeaux 7j/7 24h/24 : aéroport Mérignac, gare Saint-Jean, Arcachon, transport conventionné CPAM. Réservation en ligne, tarif clair.",
      },
      {
        property: "og:description",
        content:
          "Taxi à Bordeaux 7j/7 24h/24 : aéroport Mérignac, gare Saint-Jean, Arcachon, transport conventionné CPAM. Réservation en ligne.",
      },
      {
        name: "twitter:description",
        content: "Taxi à Bordeaux 7j/7 24h/24 : aéroport, gare, Arcachon, CPAM. Réservation en ligne.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Preload du logo header pour éviter le CLS au premier rendu
      { rel: "preload", as: "image", href: logoUrl, fetchPriority: "high" },
      // Manifest PWA — requis pour push iOS + "Ajouter à l'écran d'accueil"

      // Cache-busting versionné sur les fichiers statiques non hashés.
      { rel: "manifest", href: `/manifest.json${v}` },
      { rel: "apple-touch-icon", href: `/apple-touch-icon.png${v}` },
      { rel: "apple-touch-icon", sizes: "180x180", href: `/apple-touch-icon.png${v}` },
      // Splash screens iOS PWA — écran de démarrage avec le nouveau logo
      {
        rel: "apple-touch-startup-image",
        href: `/splash-640x1136.png${v}`,
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-750x1334.png${v}`,
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-828x1792.png${v}`,
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1125x2436.png${v}`,
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1242x2208.png${v}`,
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1242x2688.png${v}`,
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1170x2532.png${v}`,
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1179x2556.png${v}`,
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1290x2796.png${v}`,
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1536x2048.png${v}`,
        media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1668x2224.png${v}`,
        media: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-1668x2388.png${v}`,
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        href: `/splash-2048x2732.png${v}`,
        media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
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
  useVisitorHeartbeat(pathname);
  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    // setupForegroundNotifications appelle requestPermission via getFcmToken.
    // On ne l'active qu'en contexte chauffeur (routes /reservation, /suivi, /admin)
    // pour ne pas déclencher la popup navigateur côté client sans son consentement.
    const isDriverContext =
      pathname.startsWith("/reservation") || pathname.startsWith("/suivi") || pathname.startsWith("/admin");
    if (isDriverContext) {
      import("@/lib/firebase").then(({ setupForegroundNotifications }) => {
        cleanup = setupForegroundNotifications();
      });
    }
    // Nettoie l'ancien cache PWA en production sans casser la preview.
    import("@/lib/pwa").then(({ registerPWA }) => registerPWA());
    // Surveille les nouvelles versions et propose un rechargement.
    import("@/lib/versionWatcher").then(({ startVersionWatcher }) => startVersionWatcher());
    // Vérification au démarrage de la clé Google Maps (warning dev si absente).
    import("@/lib/googleConfig").then(({ assertGoogleConfigOnStartup }) => assertGoogleConfigOnStartup());
    return () => cleanup?.();
  }, []);

  // Pages "app" (plein écran, coquille fixe) : pas de header/footer site.
  // Sur mobile ils étaient masqués par l'overlay ; sur tablette/PC la coquille
  // est centrée et laissait apparaître le header/footer derrière.
  const showHeader =
    !pathname.startsWith("/reserver") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/reservation") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/client") &&
    !pathname.startsWith("/suivi") &&
    !pathname.startsWith("/driver") &&
    !pathname.startsWith("/carte");

  const showWhatsAppFloat = !pathname.startsWith("/carte");

  return (
    <html lang="fr">
      <head>
        <HeadContent />
        {/* Anti rebond (rubber-band) iOS, surtout visible en PWA standalone.
            IMPORTANT : "contain" (pas "none") et uniquement sur html — appliquer
            "overscroll-behavior: none" à la fois sur html ET body casse le chaînage
            du scroll molette sur certains navigateurs (scrollbar OK mais wheel mort). */}
        <style>{`html { overscroll-behavior-y: contain; overscroll-behavior-x: contain; }`}</style>
      </head>
      <body>
        <I18nProvider>
          {showHeader && <SiteHeader />}
          {children}
          {showHeader && <Footer />}
          <Toaster />
          {showWhatsAppFloat && <WhatsAppFloat />}
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
