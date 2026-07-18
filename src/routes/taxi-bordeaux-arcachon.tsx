import { createFileRoute } from "@tanstack/react-router";
import { LocalSeoPage } from "@/components/LocalSeoPage";
import { getLanding } from "@/lib/seo-landing";
import { hreflangLinks } from "@/lib/seo-hreflang";

const URL = "https://taxicitybordeaux.fr/taxi-bordeaux-arcachon";
const c = getLanding("fr", "arcachon");

export const Route = createFileRoute("/taxi-bordeaux-arcachon")({
  head: () => ({
    meta: [
      { title: c.title },
      { name: "description", content: c.description },
      { property: "og:title", content: c.title },
      { property: "og:description", content: c.description },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }, ...hreflangLinks(URL)],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TaxiService",
          name: "Taxi City Bordeaux — Transfert Arcachon",
          description: c.description,
          provider: {
            "@type": "TaxiStand",
            name: "Taxi City Bordeaux",
            telephone: "+33673072322",
            email: "taxi.city033@gmail.com",
            url: "https://taxicitybordeaux.fr",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Bordeaux",
              addressRegion: "Nouvelle-Aquitaine",
              postalCode: "33000",
              addressCountry: "FR",
            },
            openingHours: "Mo-Su 00:00-23:59",
            priceRange: "€€",
          },
          areaServed: [
            { "@type": "City", name: "Arcachon" },
            { "@type": "City", name: "La Teste-de-Buch" },
            { "@type": "City", name: "Lège-Cap-Ferret" },
            { "@type": "Place", name: "Dune du Pilat" },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: c.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: "https://taxicitybordeaux.fr/" },
            { "@type": "ListItem", position: 2, name: "Taxi Bordeaux → Arcachon", item: URL },
          ],
        }),
      },
    ],
  }),
  component: () => <LocalSeoPage landingKey="arcachon" />,
});
