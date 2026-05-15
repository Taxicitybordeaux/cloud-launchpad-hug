import React, { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, TouchEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---
interface Reservation {
  id: string;
  status: string;
  client_name?: string | null;
  nom?: string | null;
  depart?: string | null;
  destination?: string | null;
  arrivee?: string | null;
  pickup_datetime?: string | null;
  prix_final?: number | string | null;
  prix_estime?: number | string | null;
  distance_km?: number | string | null;
  created_at?: string;
}

// --- Styles ---
const card: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 20,
};

const labelCss: CSSProperties = { fontSize: 11, color: "#64748b", marginTop: 6 };
const valCss: CSSProperties = { fontWeight: 800, fontSize: 26, color: "#f8fafc", marginTop: 4 };

const STATUS: Record<string, { bg: string; c: string; label: string }> = {
  pending: { bg: "rgba(245,158,11,0.15)", c: "#f59e0b", label: "En attente" },
  accepted: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Acceptée" },
  refused: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Refusée" },
};

// --- Helpers ---
function StatusBadge({ s }: { s: string }) {
  const v = STATUS[s] || { bg: "rgba(148,163,184,0.15)", c: "#94a3b8", label: s };
  return (
    <span
      style={{ background: v.bg, color: v.c, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}
    >
      {v.label}
    </span>
  );
}

const formatParis = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
};

const isNuit = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const h = d.getHours(); // Plus simple et robuste pour le build
  return h >= 20 || h < 6;
};

const getPrix = (r: Reservation) => {
  if (r.prix_final) return Number(r.prix_final);
  if (r.prix_estime) return Number(r.prix_estime);
  if (r.distance_km) {
    const nuit = isNuit(r.pickup_datetime);
    return Number(r.distance_km) * (nuit ? 3.26 : 2.16);
  }
  return null;
};

// --- Composants ---
function SwipeableCard({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSettling, setIsSettling] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const offsetRef = useRef(0);

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
    setIsSettling(false);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const clamped = Math.max(-90, Math.min(0, dx));
    offsetRef.current = clamped;
    setOffsetX(clamped);
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    setIsSettling(true);
    if (offsetRef.current < -80) {
      setOffsetX(-90);
      offsetRef.current = -90;
    } else {
      setOffsetX(0);
      offsetRef.current = 0;
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div
        onClick={onDelete}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 90,
          background: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        🗑
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSettling ? "transform 0.25s ease" : "none",
          background: "#0f172a",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ padding: "14px 16px" }}>{children}</div>
      </div>
    </div>
  );
}

function DashboardComponent() {
  const [loading, setLoading] = useState(true);
  const [reservs, setReservs] = useState<Reservation[]>([]);
  const [stats, setStats] = useState({ caJ: 0, caM: 0, coursesJ: 0, clientsTotal: 0, visitorsJ: 0 });
  const [tab, setTab] = useState("reservations");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const month = new Date(today.getFullYear(), today.getMonth(), 1);

      const [caJR, caMR, cJR, cliR, visJR, resR] = await Promise.all([
        supabase.from("courses").select("prix_final").gte("created_at", today.toISOString()),
        supabase.from("courses").select("prix_final").gte("created_at", month.toISOString()),
        supabase
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase
          .from("site_analytics")
          .select("session_id")
          .eq("event", "visit")
          .gte("created_at", today.toISOString()),
        supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      setStats({
        caJ: (caJR.data || []).reduce((s, c) => s + (Number(c.prix_final) || 0), 0),
        caM: (caMR.data || []).reduce((s, c) => s + (Number(c.prix_final) || 0), 0),
        coursesJ: cJR.count || 0,
        clientsTotal: cliR.count || 0,
        visitorsJ: new Set((visJR.data || []).map((v: any) => v.session_id)).size,
      });

      setReservs((resR.data as Reservation[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 30000);
    return () => clearInterval(poll);
  }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservations").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  const deleteReservation = async (id: string) => {
    if (window.confirm("Supprimer ?")) {
      await supabase.from("reservations").delete().eq("id", id);
      fetchAll();
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", background: "#0f172a", minHeight: "100vh", color: "#f8fafc" }}>
      <h1 style={{ marginBottom: 20 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={card}>
          <div style={valCss}>{stats.caJ.toFixed(2)}€</div>
          <div style={labelCss}>Aujourd'hui</div>
        </div>
        <div style={card}>
          <div style={valCss}>{stats.caM.toFixed(2)}€</div>
          <div style={labelCss}>Ce mois</div>
        </div>
        <div style={card}>
          <div style={valCss}>{stats.coursesJ}</div>
          <div style={labelCss}>Réservations J</div>
        </div>
        <div style={card}>
          <div style={valCss}>{stats.clientsTotal}</div>
          <div style={labelCss}>Clients</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setTab("reservations")}
          style={{
            background: tab === "reservations" ? "#0ea5e9" : "#1e293b",
            color: "white",
            border: 0,
            padding: "8px 15px",
            borderRadius: 8,
          }}
        >
          Réservations
        </button>
        <button
          onClick={() => setTab("visiteurs")}
          style={{
            background: tab === "visiteurs" ? "#0ea5e9" : "#1e293b",
            color: "white",
            border: 0,
            padding: "8px 15px",
            borderRadius: 8,
          }}
        >
          Visiteurs
        </button>
      </div>

      {tab === "reservations" ? (
        <div style={{ ...card, padding: 0 }}>
          {loading ? (
            <p style={{ padding: 20 }}>Chargement...</p>
          ) : (
            reservs.map((r) => (
              <SwipeableCard key={r.id} onDelete={() => deleteReservation(r.id)}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{r.client_name || r.nom || "Client"}</strong>
                  <StatusBadge s={r.status} />
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", margin: "5px 0" }}>
                  {r.depart} → {r.destination || r.arrivee}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{formatParis(r.pickup_datetime)}</div>
                {getPrix(r) && (
                  <div style={{ color: "#0ea5e9", fontWeight: "bold", marginTop: 5 }}>{getPrix(r)?.toFixed(2)} €</div>
                )}
                {r.status === "pending" && (
                  <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                    <button
                      onClick={() => updateStatus(r.id, "accepted")}
                      style={{ background: "#22c55e", color: "white", border: 0, padding: "4px 8px", borderRadius: 4 }}
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "refused")}
                      style={{ background: "#ef4444", color: "white", border: 0, padding: "4px 8px", borderRadius: 4 }}
                    >
                      Refuser
                    </button>
                  </div>
                )}
              </SwipeableCard>
            ))
          )}
        </div>
      ) : (
        <div style={card}>
          <div style={valCss}>👁️ {stats.visitorsJ}</div>
          <div style={labelCss}>Visiteurs aujourd'hui</div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardComponent,
});
