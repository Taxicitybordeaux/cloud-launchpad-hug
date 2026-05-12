import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton, SkeletonStyles, StatCardSkeleton, ReservationRowSkeleton } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const card: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24 };
const labelCss: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#64748b", letterSpacing: "0.08em", marginTop: 8 };
const valCss: React.CSSProperties = { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#f8fafc" };

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

  const ensureRow = async () => {
    const { data } = await supabase.from("driver_gps").select("is_active,latitude,longitude").eq("id", "driver").maybeSingle();
    if (!data) {
      await supabase.from("driver_gps").insert({ id: "driver", is_active: false, latitude: 0, longitude: 0 });
      return { is_active: false, latitude: 0, longitude: 0 };
    }
    return data;
  };

  const startGps = async () => {
    if (!navigator.geolocation) { alert("Géolocalisation indisponible sur cet appareil."); return; }
    setGpsBusy(true);
    await ensureRow();
    await supabase.from("driver_gps").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", "driver");
    setGpsActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsPos({ lat: latitude, lng: longitude });
        await supabase.from("driver_gps").update({ latitude, longitude, accuracy, updated_at: new Date().toISOString() }).eq("id", "driver");
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
    ensureRow().then((r) => { setGpsActive(!!r.is_active); setGpsLoading(false); });
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const fetchAll = useCallback(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [caJR, caMR, cJR, cliR, visR, impR, clkR, resR] = await Promise.all([
      supabase.from("courses").select("prix_final").gte("created_at", todayIso),
      supabase.from("courses").select("prix_final").gte("created_at", monthStart),
      supabase.from("courses").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", todayIso),
      supabase.from("site_analytics").select("id", { count: "exact", head: true }).eq("event", "qr_impression").gte("created_at", todayIso),
      supabase.from("site_analytics").select("id", { count: "exact", head: true }).eq("event", "qr_click").gte("created_at", todayIso),
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
    const ch = supabase.channel("dash").on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchAll).on("postgres_changes", { event: "*", schema: "public", table: "site_analytics" }, fetchAll).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservations").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  const StatusBadge = ({ s }: { s: string }) => {
    const map: Record<string, { bg: string; c: string; label: string }> = {
      pending: { bg: "rgba(245,158,11,0.15)", c: "#f59e0b", label: "En attente" },
      accepted: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Acceptée" },
      refused: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Refusée" },
    };
    const v = map[s] ?? { bg: "rgba(148,163,184,0.15)", c: "#94a3b8", label: s };
    return <span style={{ background: v.bg, color: v.c, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{v.label}</span>;
  };

  return (
    <div style={{ padding: "32px 24px", fontFamily: "'DM Sans',sans-serif" }}>
      <SkeletonStyles />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 30, fontWeight: 800, color: "#f8fafc", margin: 0 }}>Dashboard</h1>
        <button onClick={fetchAll} style={{ padding: "8px 16px", background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", color: "#0ea5e9", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>↻ Actualiser</button>
      </div>

      <div style={{ ...card, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: gpsActive ? "#22c55e" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: gpsActive ? "0 0 0 6px rgba(34,197,94,0.18)" : "none", transition: "all 0.2s" }}>📡</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#f8fafc", fontSize: 16 }}>{gpsActive ? "GPS actif" : "GPS inactif"}</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{gpsActive ? (gpsPos ? `${gpsPos.lat.toFixed(5)}, ${gpsPos.lng.toFixed(5)}` : "Acquisition de la position…") : "Vos clients ne peuvent pas vous suivre"}</div>
          </div>
        </div>
        <button onClick={gpsActive ? stopGps : startGps} disabled={gpsBusy} style={{ padding: "12px 22px", background: gpsActive ? "#ef4444" : "#22c55e", color: "#fff", border: 0, borderRadius: 12, cursor: gpsBusy ? "wait" : "pointer", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, boxShadow: gpsActive ? "0 6px 18px rgba(239,68,68,0.3)" : "0 6px 18px rgba(34,197,94,0.3)", opacity: gpsBusy ? 0.7 : 1 }}>{gpsActive ? "⏹ Désactiver" : "📡 Activer mon GPS"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { i: "💶", v: `${caJ.toFixed(2)} €`, l: "CA aujourd'hui" },
          { i: "📈", v: `${caM.toFixed(2)} €`, l: "CA ce mois" },
          { i: "🚗", v: coursesJ, l: "Courses aujourd'hui" },
          { i: "👥", v: clientsTotal, l: "Clients total" },
        ].map((c, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 26 }}>{c.i}</div>
            <div style={valCss}>{c.v}</div>
            <div style={labelCss}>{c.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { i: "👁️", v: visitors, l: "Visiteurs aujourd'hui" },
          { i: "📱", v: qrImp, l: "Scans QR aujourd'hui" },
          { i: "🔗", v: qrClick, l: "Clics QR aujourd'hui" },
        ].map((c, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 26 }}>{c.i}</div>
            <div style={valCss}>{c.v}</div>
            <div style={labelCss}>{c.l}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, color: "#f8fafc", padding: 20, margin: 0 }}>Dernières réservations</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", color: "#64748b", textAlign: "left" }}>
                {["Date", "Client", "Trajet", "Prix", "Statut", ""].map(h => <th key={h} style={{ padding: "10px 14px", fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {reservs.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td style={{ padding: "10px 14px" }}>{r.client_name || r.nom}</td>
                  <td style={{ padding: "10px 14px" }}>{r.depart} → {r.destination || r.arrivee}</td>
                  <td style={{ padding: "10px 14px" }}>{r.prix_estime ? `${r.prix_estime} €` : "—"}</td>
                  <td style={{ padding: "10px 14px" }}><StatusBadge s={r.status} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    {r.status === "pending" && (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => updateStatus(r.id, "accepted")} style={{ background: "#22c55e", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓</button>
                        <button onClick={() => updateStatus(r.id, "refused")} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✗</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {reservs.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#475569" }}>Aucune réservation</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
