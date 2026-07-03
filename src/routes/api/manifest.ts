import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const role = url.searchParams.get("role");

        const isDriver = role === "driver";

        const manifest = {
          name: "Taxi City Bordeaux",
          short_name: isDriver ? "TCB Chauffeur" : "Taxi Bordeaux",
          description: "Réservez votre taxi à Bordeaux",
          start_url: isDriver ? "/driver?token=DSF234" : "/",
          display: "standalone",
          background_color: isDriver ? "#0f172a" : "#1a1a2e",
          theme_color: isDriver ? "#0f172a" : "#1a1a2e",
          orientation: "portrait",
          icons: [
            { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
