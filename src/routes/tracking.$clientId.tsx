import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tracking/$clientId")({
  head: () => ({
    meta: [
      { title: "Suivi de votre course – Taxi City Bordeaux" },
      { name: "description", content: "Suivez votre taxi en temps réel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackingPage,
});

function TrackingPage() {
  const { clientId } = Route.useParams();
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Page de suivi</h1>
        <p className="text-sm text-muted-foreground">
          ID client : <code className="font-mono">{clientId}</code>
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Placeholder — la carte temps réel sera ajoutée à l'étape suivante.
        </p>
      </div>
    </main>
  );
}
