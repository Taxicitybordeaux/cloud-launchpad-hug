import { createFileRoute, redirect } from "@tanstack/react-router";

// Le formulaire de réservation unique est désormais sur /reserver.
// Cette ancienne route redirige automatiquement pour éviter d'avoir deux formulaires.
export const Route = createFileRoute("/reservation")({
  beforeLoad: () => {
    throw redirect({ to: "/reserver" });
  },
  component: () => null,
});
