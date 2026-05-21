import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/courses")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/dashboard" });
  },
  component: () => null,
});
