import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

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
    localStorage.removeItem("taxi_admin");
    navigate({ to: "/" });
  };

  const links = [
    { to: "/admin/dashboard", icon: "📊", label: "Dashboard" },
    { to: "/admin/courses", icon: "🚗", label: "Courses", badge: pending },
    { to: "/admin/clients", icon: "👥", label: "Clients" },
    { to: "/admin/gps", icon: "📍", label: "GPS" },
  ];

  const Sidebar = () => (
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
        {links.map((l) => {
          const active = router.location.pathname.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
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
              {l.badge && l.badge > 0 ? (
                <span
                  style={{ background: "#ef4444", color: "#fff", borderRadius: 99, padding: "2px 8px", fontSize: 11 }}
                >
                  {l.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, fontSize: 11, color: "#64748b" }}>
        <button
          onClick={logout}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#fff",
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');`}</style>

      <div className="admin-desktop-show" style={{ display: "block" }}>
        <Sidebar />
      </div>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      )}
      <main style={{ flex: 1, minHeight: "100vh" }}>
        <button
          onClick={() => setOpen(true)}
          className="admin-burger"
          style={{
            display: "none",
            margin: 14,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ☰
        </button>
        <Outlet />
      </main>
      <style>{`
        @media (max-width: 768px) {
          .admin-desktop-show { display: none !important; }
          .admin-burger { display: inline-block !important; }
        }
      `}</style>
    </div>
  );
}
