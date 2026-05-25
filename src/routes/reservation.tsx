import { createFileRoute } from "@tanstack/react-router";
import { FareSimulator } from "@/components/FareSimulator";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/reservation")({
  head: () => ({
    meta: [
      { title: "Réservation — Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi à Bordeaux en quelques secondes. Estimation tarifaire et réservation en ligne." },
      { property: "og:title", content: "Réservation — Taxi City Bordeaux" },
      { property: "og:description", content: "Réservez votre taxi à Bordeaux en quelques secondes." },
    ],
  }),
  component: ReservationPage,
});

function ReservationPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-20">
        <FareSimulator />
      </main>
    </div>
  );
}
