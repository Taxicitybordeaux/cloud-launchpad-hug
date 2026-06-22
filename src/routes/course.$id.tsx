import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/course/$id")({
  head: () => ({ meta: [{ title: "Redirection course — Taxi City Bordeaux" }] }),
  component: CoursePage,
});

function CoursePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/reservation/$id", params: { id } });
  }, [id, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0a0a14",
        color: "#f8fafc",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ maxWidth: 540, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Redirection...</div>
        <div style={{ color: "#94a3b8" }}>
          La page /course/{id} n’est plus utilisée. Vous êtes redirigé vers la page de réservation.
        </div>
      </div>
    </div>
  );
}
