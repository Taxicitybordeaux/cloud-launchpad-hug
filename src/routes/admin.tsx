import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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

const NAV_LINKS = [
  { to: "/admin/dashboard", icon: "📊", label: "Dashboard" },
];


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

  const logout = () => {
    sessionStorage.removeItem("admin_pin_ok");
    navigate({ to: "/login" });
  };

  /* ── Sidebar desktop ── */
  const SidebarContent = () => (
    <aside
      style={{
        width: 240,
        background: "#0f172a",
        minHeight: "100vh",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans',sans-serif",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
        <span style={{ fontSize: 28 }}>🚕</span>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>Taxi City Bordeaux</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>Administration</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {NAV_LINKS.map((l) => {
          const active = path.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                color: active ? "#fff" : "#94a3b8",
                background: active ? "rgba(14,165,233,0.18)" : "transparent",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span>{l.icon}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.to === "/admin/courses" && pending > 0 && (
                <span
                  style={{ background: "#ef4444", color: "#fff", borderRadius: 99, padding: "2px 8px", fontSize: 11 }}
                >
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
        <button
          onClick={logout}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ↪ Déconnexion
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ display: "flex", background: "#0a0f1e", color: "#f1f5f9", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        /* Desktop: sidebar visible, bottom nav hidden */
        .admin-sidebar    { display: flex !important; }
        .admin-bottom-nav { display: none !important; }
        .admin-main       { padding-bottom: 0 !important; }

        @media (max-width: 768px) {
          .admin-sidebar    { display: none !important; }
          .admin-bottom-nav { display: flex !important; }
          /* leave room for fixed bottom nav */
          .admin-main       { padding-bottom: 72px !important; }
        }
      `}</style>

      {/* Desktop sidebar */}
      <div className="admin-sidebar">
        <SidebarContent />
      </div>

      {/* Main content */}
      <main className="admin-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
        <Outlet />
      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav
        className="admin-bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          background: "#0f172a",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "stretch",
          height: 64,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_LINKS.map((l) => {
          const active = path.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: active ? "#0ea5e9" : "#64748b",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif",
                position: "relative",
                borderTop: active ? "2px solid #0ea5e9" : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 20 }}>{l.icon}</span>
              <span>{l.label}</span>
              {l.to === "/admin/courses" && pending > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: "calc(50% - 18px)",
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 99,
                    padding: "1px 5px",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
