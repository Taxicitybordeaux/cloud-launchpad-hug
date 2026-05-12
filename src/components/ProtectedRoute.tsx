import { Navigate } from "@tanstack/react-router";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("taxi_admin") === "true";

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
