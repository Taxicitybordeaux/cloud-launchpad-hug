import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ProtectedRoute>
      <AdminLayout />
    </ProtectedRoute>
  ),
});

function AdminLayout() {
  const navigate = useNavigate();
  const router = useRouterState();
  const [pending, setPending] = useState(0);
  const path = router.location.pathname;

  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPending(count ?? 0);
    };
    fetchPending();
    const ch = supabase
      .channel("admin-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchPending)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (path === "/admin") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [path, navigate]);

  const logout = () => {
    sessionStorage.removeItem("admin_pin_ok");
    navigate({ to: "/login" });
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0f1e", color: "#f1f5f9" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>

      <style>{`
        @media (max-width: 640px) {
          .admin-layout-header { flex-direction: column !important; align-items: stretch !important; padding: 12px 14px !important; gap: 10px !important; }
          .admin-layout-btns { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .admin-layout-btns button { width: 100% !important; padding: 10px 8px !important; font-size: 13px !important; justify-content: center !important; }
          .admin-layout-subtitle { display: none !important; }
        }
      `}</style>
      <header
        className="admin-layout-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "18px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(15,23,42,0.95)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 26 }}>🚕</span>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>Espace chauffeur</div>
            <div className="admin-layout-subtitle" style={{ fontSize: 12, color: "#94a3b8" }}>
              Page unique, toutes les actions sur une seule vue
            </div>
          </div>
        </div>
        <div className="admin-layout-btns" style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate({ to: "/" })}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "#f8fafc",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ← Site
          </button>
          <button
            onClick={logout}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "#111827",
              color: "#f8fafc",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main style={{ flex: 1, minWidth: 0, overflowX: "hidden", padding: "20px 24px" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: 6,
              }}
            >
              Dashboard chauffeur
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Toutes les courses</div>
          </div>
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(34,197,94,0.1)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.2)",
              fontWeight: 700,
            }}
          >
            {pending} course{pending > 1 ? "s" : ""} en attente
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
