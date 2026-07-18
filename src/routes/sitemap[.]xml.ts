import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://taxicitybordeaux.fr";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/services", changefreq: "monthly", priority: "0.9" },
          { path: "/reserver", changefreq: "monthly", priority: "0.9" },
          // Pages SEO locales (mots-clés à fort volume)
          { path: "/taxi-aeroport-bordeaux-merignac", changefreq: "monthly", priority: "0.9" },
          { path: "/taxi-gare-saint-jean-bordeaux", changefreq: "monthly", priority: "0.9" },
          { path: "/taxi-bordeaux-arcachon", changefreq: "monthly", priority: "0.8" },
          { path: "/taxi-conventionne-bordeaux", changefreq: "monthly", priority: "0.8" },
          { path: "/a-propos", changefreq: "monthly", priority: "0.7" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/carte", changefreq: "monthly", priority: "0.5" },
          { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
          { path: "/confidentialite", changefreq: "yearly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
