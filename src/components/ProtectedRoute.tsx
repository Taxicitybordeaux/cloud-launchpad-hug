import { Navigate } from "@tanstack/react-router";

/**
 * Gate admin routes.
 * Auth = PIN saisi sur /login → sessionStorage "admin_pin_ok" = "1"
 * (pas de dépendance Supabase auth / Google)
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAdmin = typeof window !== "undefined" && sessionStorage.getItem("admin_pin_ok") === "1";

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
