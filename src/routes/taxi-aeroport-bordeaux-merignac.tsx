import { createFileRoute } from "@tanstack/react-router";
import { LocalSeoPage } from "@/components/LocalSeoPage";
import { getLanding } from "@/lib/seo-landing";

const URL = "https://taxicitybordeaux.fr/taxi-aeroport-bordeaux-merignac";
const c = getLanding("fr", "airport");

export const Route = createFileRoute("/taxi-aeroport-bordeaux-merignac")({
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
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TaxiService",
          name: "Taxi City Bordeaux — Transfert Aéroport Mérignac",
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
            areaServed: [
              { "@type": "City", name: "Bordeaux" },
              { "@type": "City", name: "Mérignac" },
              { "@type": "Airport", name: "Aéroport de Bordeaux-Mérignac", iataCode: "BOD" },
            ],
            openingHours: "Mo-Su 00:00-23:59",
            priceRange: "€€",
          },
          areaServed: { "@type": "Airport", name: "Aéroport de Bordeaux-Mérignac", iataCode: "BOD" },
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
    ],
  }),
  component: () => <LocalSeoPage landingKey="airport" />,
});
