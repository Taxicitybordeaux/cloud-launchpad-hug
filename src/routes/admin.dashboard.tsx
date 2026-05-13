import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton, SkeletonStyles, StatCardSkeleton } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 20,
};
const labelCss: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: 11,
  color: "#64748b",
  letterSpacing: "0.08em",
  marginTop: 6,
};
const valCss: React.CSSProperties = {
  fontFamily: "'Syne',sans-serif",
  fontWeight: 800,
  fontSize: 26,
  color: "#f8fafc",
  marginTop: 4,
};

/* Status badge */
const STATUS: Record<string, { bg: string; c: string; label: string }> = {
  pending: { bg: "rgba(245,158,11,0.15)", c: "#f59e0b", label: "En attente" },
  accepted: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Acceptée" },
  refused: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Refusée" },
};
function StatusBadge({ s }: { s: string }) {
  const v = STATUS[s] ?? { bg: "rgba(148,163,184,0.15)", c: "#94a3b8", label: s };
  return (
    <span
      style={{ background: v.bg, color: v.c, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}
    >
      {v.label}
    </span>
  );
}

function Dashboard() {
  const [caJ, setCaJ] = useState(0);
  const [caM, setCaM] = useState(0);
  const [coursesJ, setCoursesJ] = useState(0);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [visitors, setVisitors] = useState(0);
  const [qrImp, setQrImp] = useState(0);
  const [qrClick, setQrClick] = useState(0);
  const [reservs, setReservs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  /* ── GPS helpers ── */
  const ensureRow = async () => {
    const { data } = await supabase
      .from("driver_gps")
      .select("is_active,latitude,longitude")
      .eq("id", "driver")
      .maybeSingle();
    if (!data) {
      await supabase.from("driver_gps").insert({ id: "driver", is_active: false, latitude: 0, longitude: 0 });
      return { is_active: false };
    }
    return data;
  };

  const startGps = async () => {
    if (!navigator.geolocation) {
      alert("Géolocalisation indisponible sur cet appareil.");
      return;
    }
    setGpsBusy(true);
    await ensureRow();
    await supabase
      .from("driver_gps")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", "driver");
    setGpsActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsPos({ lat: latitude, lng: longitude });
        await supabase
          .from("driver_gps")
          .update({ latitude, longitude, accuracy, updated_at: new Date().toISOString() })
          .eq("id", "driver");
      },
      (e) => console.error(e),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    setGpsBusy(false);
  };

  const stopGps = async () => {
    setGpsBusy(true);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    await supabase.from("driver_gps").update({ is_active: false }).eq("id", "driver");
    setGpsActive(false);
    setGpsPos(null);
    setGpsBusy(false);
  };

  useEffect(() => {
    ensureRow().then((r) => {
      setGpsActive(!!r.is_active);
      setGpsLoading(false);
    });
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined")
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  /* ── Data fetch ── */
  const fetchAll = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const monthIso = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [caJR, caMR, cJR, cliR, visR, impR, clkR, resR] = await Promise.all([
      supabase.from("courses").select("prix_final").gte("created_at", todayIso),
      supabase.from("courses").select("prix_final").gte("created_at", monthIso),
      supabase.from("courses").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", todayIso),
      supabase
        .from("site_analytics")
        .select("id", { count: "exact", head: true })
        .eq("event", "qr_impression")
        .gte("created_at", todayIso),
      supabase
        .from("site_analytics")
        .select("id", { count: "exact", head: true })
        .eq("event", "qr_click")
        .gte("created_at", todayIso),
      supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    setCaJ((caJR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCaM((caMR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCoursesJ(cJR.count ?? 0);
    setClientsTotal(cliR.count ?? 0);
    setVisitors(new Set((visR.data ?? []).map((v: any) => v.session_id)).size);
    setQrImp(impR.count ?? 0);
    setQrClick(clkR.count ?? 0);
    setReservs(resR.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_analytics" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservations").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  /* ── Render ── */
  return (
    <div
      style={{ padding: "20px 16px", fontFamily: "'DM Sans',sans-serif", maxWidth: "100%", boxSizing: "border-box" }}
    >
      <SkeletonStyles />

      {/* Header row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
          Dashboard
        </h1>
        <button
          onClick={fetchAll}
          style={{
            padding: "8px 14px",
            background: "rgba(14,165,233,0.15)",
            border: "1px solid rgba(14,165,233,0.3)",
            color: "#0ea5e9",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          ↻ Actualiser
        </button>
      </div>

      {/* GPS card */}
      <div style={{ ...card, marginBottom: 20 }}>
        {gpsLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Skeleton width={48} height={48} radius="50%" />
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="80%" height={12} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: gpsActive ? "#22c55e" : "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  boxShadow: gpsActive ? "0 0 0 6px rgba(34,197,94,0.18)" : "none",
                  transition: "all 0.2s",
                }}
              >
                📡
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#f8fafc", fontSize: 15 }}>
                  {gpsActive ? "GPS actif" : "GPS inactif"}
                </div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {gpsActive
                    ? gpsPos
                      ? `${gpsPos.lat.toFixed(5)}, ${gpsPos.lng.toFixed(5)}`
                      : "Acquisition…"
                    : "Vos clients ne peuvent pas vous suivre"}
                </div>
              </div>
            </div>
            <button
              onClick={gpsActive ? stopGps : startGps}
              disabled={gpsBusy}
              style={{
                padding: "11px 20px",
                width: "100%",
                background: gpsActive ? "#ef4444" : "#22c55e",
                color: "#fff",
                border: 0,
                borderRadius: 12,
                cursor: gpsBusy ? "wait" : "pointer",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 800,
                fontSize: 14,
                opacity: gpsBusy ? 0.7 : 1,
                boxShadow: gpsActive ? "0 6px 18px rgba(239,68,68,0.3)" : "0 6px 18px rgba(34,197,94,0.3)",
              }}
            >
              {gpsActive ? "⏹ Désactiver le GPS" : "📡 Activer mon GPS"}
            </button>
          </div>
        )}
      </div>

      {/* KPI stat cards — 2 colonnes sur mobile, 4 sur desktop */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 14 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { i: "💶", v: `${caJ.toFixed(2)} €`, l: "CA aujourd'hui" },
              { i: "📈", v: `${caM.toFixed(2)} €`, l: "CA ce mois" },
              { i: "🚗", v: String(coursesJ), l: "Courses auj." },
              { i: "👥", v: String(clientsTotal), l: "Clients total" },
            ].map((c, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 22 }}>{c.i}</div>
                <div style={valCss}>{c.v}</div>
                <div style={labelCss}>{c.l}</div>
              </div>
            ))}
      </div>

      {/* Analytics cards — 3 colonnes sur desktop, 1 sur mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { i: "👁️", v: String(visitors), l: "Visiteurs auj." },
              { i: "📱", v: String(qrImp), l: "Scans QR auj." },
              { i: "🔗", v: String(qrClick), l: "Clics QR auj." },
            ].map((c, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 22 }}>{c.i}</div>
                <div style={valCss}>{c.v}</div>
                <div style={labelCss}>{c.l}</div>
              </div>
            ))}
      </div>

      {/* Réservations — cards sur mobile, table sur desktop */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <h2
          style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, color: "#f8fafc", padding: "16px 18px", margin: 0 }}
        >
          Dernières réservations
        </h2>

        {/* ── Mobile : cards ── */}
        <div className="reserv-cards" style={{ display: "none" }}>
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
              </div>
            ))}
          {!loading &&
            reservs.map((r) => (
              <div key={r.id} style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>
                    {r.client_name || r.nom || "—"}
                  </span>
                  <StatusBadge s={r.status} />
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
                  {r.depart} → {r.destination || r.arrivee || "—"}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: 11 }}>
                    {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  {r.prix_estime && (
                    <span style={{ color: "#0ea5e9", fontWeight: 700, fontSize: 13 }}>{r.prix_estime} €</span>
                  )}
                </div>
                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => updateStatus(r.id, "accepted")}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        background: "#22c55e",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      ✓ Accepter
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "refused")}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        background: "#ef4444",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      ✗ Refuser
                    </button>
                  </div>
                )}
              </div>
            ))}
          {!loading && reservs.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#475569" }}>Aucune réservation</div>
          )}
        </div>

        {/* ── Desktop : table ── */}
        <div className="reserv-table" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", color: "#64748b", textAlign: "left" }}>
                {["Date", "Client", "Trajet", "Prix", "Statut", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                reservs.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{r.client_name || r.nom}</td>
                    <td
                      style={{
                        padding: "10px 14px",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.depart} → {r.destination || r.arrivee}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {r.prix_estime ? `${r.prix_estime} €` : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge s={r.status} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {r.status === "pending" && (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => updateStatus(r.id, "accepted")}
                            style={{
                              background: "#22c55e",
                              color: "#fff",
                              border: 0,
                              padding: "5px 10px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => updateStatus(r.id, "refused")}
                            style={{
                              background: "#ef4444",
                              color: "#fff",
                              border: 0,
                              padding: "5px 10px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            ✗
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              {!loading && reservs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#475569" }}>
                    Aucune réservation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Responsive switch: cards on mobile, table on desktop */}
      <style>{`
        @media (max-width: 640px) {
          .reserv-cards { display: block !important; }
          .reserv-table { display: none !important; }
        }
      `}</style>
    </div>
  );
}
