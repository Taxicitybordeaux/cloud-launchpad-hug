import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
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
  const { pathname: path } = useLocation();
  const [pending, setPending] = useState(0);

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
    if (path === "/admin" || path === "/admin/") {
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
        @media (max-width: 640px) {
          .al-header { flex-wrap: wrap !important; padding: 10px 12px !important; }
          .al-btns button { padding: 8px 10px !important; font-size: 12px !important; }
          .al-subtitle { display: none !important; }
        }
      `}</style>

      <header
        className="al-header"
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
            <div className="al-subtitle" style={{ fontSize: 12, color: "#94a3b8" }}>
              Page unique, toutes les actions sur une seule vue
            </div>
          </div>
        </div>
        <div className="al-btns" style={{ display: "flex", gap: 12 }}>
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
            }}
          >
            Retour au site
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
