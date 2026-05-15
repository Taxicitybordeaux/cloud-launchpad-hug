import { createFileRoute } from "@tanstack/react-router";
import { CSSProperties, ReactNode, TouchEvent, useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
import { Skeleton, SkeletonStyles, StatCardSkeleton } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

type Reservation = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  pickup_datetime?: string;
  prix_final?: number | string;
  prix_estime?: number | string;
  distance_km?: number | string;
  tarif_jour?: boolean;
  depart?: string;
  destination?: string;
  arrivee?: string;
  client_name?: string;
  nom?: string;
  telephone?: string;
  client_phone?: string;
  email?: string;
  client_email?: string;
  message?: string;
  tracking_id?: string;
};

const card: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 20,
};

const labelCss: CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 11,
  color: "#64748b",
  letterSpacing: "0.08em",
  marginTop: 6,
};

const valCss: CSSProperties = {
  fontFamily: "Syne, sans-serif",
  fontWeight: 800,
  fontSize: 26,
  color: "#f8fafc",
  marginTop: 4,
};

const TARIF_JOUR_LABEL = "2,16 €/km";
const TARIF_NUIT_LABEL = "3,26 €/km";

const STATUS: Record<string, { bg: string; c: string; label: string }> = {
  pending: {
    bg: "rgba(245,158,11,0.15)",
    c: "#f59e0b",
    label: "En attente",
  },
  accepted: {
    bg: "rgba(34,197,94,0.15)",
    c: "#22c55e",
    label: "Acceptée",
  },
  refused: {
    bg: "rgba(239,68,68,0.15)",
    c: "#ef4444",
    label: "Refusée",
  },
};

function StatusBadge({ s }: { s: string }) {
  const v = STATUS[s] || {
    bg: "rgba(148,163,184,0.15)",
    c: "#94a3b8",
    label: s,
  };

  return (
    <span
      style={{
        background: v.bg,
        color: v.c,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {v.label}
    </span>
  );
}

function formatParis(date?: string) {
  if (!date) return "—";

  return new Date(date).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isNuit(date?: string) {
  if (!date) return false;

  const h = Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false,
    }).format(new Date(date)),
  );

  const hour = h === 24 ? 0 : h;

  return hour >= 20 || hour < 6;
}

function getPrix(r: Reservation) {
  if (r.prix_final !== undefined && r.prix_final !== null && r.prix_final !== "") {
    return Number(r.prix_final);
  }

  if (r.prix_estime !== undefined && r.prix_estime !== null && r.prix_estime !== "") {
    return Number(r.prix_estime);
  }

  if (r.distance_km) {
    const nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;

    return calculerPrix(Number(r.distance_km), !nuit);
  }

  return null;
}

function SwipeableCard({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [offsetX, setOffsetX] = useState(0);
  const [settling, setSettling] = useState(false);

  const startX = useRef(0);
  const dragging = useRef(false);

  const THRESHOLD = 80;
  const MAX = 90;

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    dragging.current = true;
    startX.current = e.touches[0].clientX;
    setSettling(false);
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    const dx = e.touches[0].clientX - startX.current;
    const clamped = Math.max(-MAX, Math.min(0, dx));

    setOffsetX(clamped);
  };

  const onTouchEnd = () => {
    dragging.current = false;
    setSettling(true);

    if (offsetX < -THRESHOLD) {
      setOffsetX(-MAX);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        onClick={onDelete}
        style={{
          position: "absolute",
          inset: 0,
          left: "auto",
          width: MAX,
          background: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
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
          transition: settling ? "transform .25s ease" : "none",
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

function Dashboard() {
  const [tab, setTab] = useState<"reservations" | "visiteurs">("reservations");

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [caJ, setCaJ] = useState(0);
  const [caM, setCaM] = useState(0);
  const [coursesJ, setCoursesJ] = useState(0);
  const [clientsTotal, setClientsTotal] = useState(0);

  const [visitorsJ, setVisitorsJ] = useState(0);
  const [visitorsSem, setVisitorsSem] = useState(0);
  const [visitorsM, setVisitorsM] = useState(0);
  const [visitorsAn, setVisitorsAn] = useState(0);

  const [reservs, setReservs] = useState<Reservation[]>([]);
  const [nextCourse, setNextCourse] = useState<Reservation | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const month = new Date(today.getFullYear(), today.getMonth(), 1);
      const year = new Date(today.getFullYear(), 0, 1);
      const week = new Date(today);
      week.setDate(week.getDate() - 7);

      const [caJR, caMR, cJR, cliR, visJR, visSemR, visMR, visAnR, resR, nextR] = await Promise.all([
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

        supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", week.toISOString()),

        supabase
          .from("site_analytics")
          .select("session_id")
          .eq("event", "visit")
          .gte("created_at", month.toISOString()),

        supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", year.toISOString()),

        supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(10),

        supabase
          .from("reservations")
          .select("*")
          .eq("status", "accepted")
          .order("pickup_datetime", { ascending: true })
          .limit(1),
      ]);

      const uniq = (arr: any[]) => new Set(arr?.map((v) => v.session_id)).size;

      setCaJ((caJR.data || []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));

      setCaM((caMR.data || []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));

      setCoursesJ(cJR.count || 0);
      setClientsTotal(cliR.count || 0);

      setVisitorsJ(uniq(visJR.data || []));
      setVisitorsSem(uniq(visSemR.data || []));
      setVisitorsM(uniq(visMR.data || []));
      setVisitorsAn(uniq(visAnR.data || []));

      setReservs((resR.data || []) as Reservation[]);
      setNextCourse(((nextR.data || [])[0] || null) as Reservation | null);

      setLastUpdate(new Date());
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
    await supabase
      .from("reservations")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    fetchAll();
  };

  const deleteReservation = async (id: string) => {
    if (!window.confirm("Supprimer cette réservation ?")) return;

    await supabase.from("reservations").delete().eq("id", id);

    fetchAll();
  };

  return (
    <div
      style={{
        padding: "20px 16px",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      <SkeletonStyles />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          Dashboard
        </h1>

        <button
          onClick={fetchAll}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(14,165,233,0.3)",
            background: "rgba(14,165,233,0.15)",
            color: "#0ea5e9",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          ↻ Actualiser
        </button>
      </div>

      <div
        style={{
          marginBottom: 16,
          color: "#64748b",
          fontSize: 12,
        }}
      >
        Dernière mise à jour : {lastUpdate.toLocaleTimeString("fr-FR")}
      </div>

      {!loading && nextCourse && (
        <div
          style={{
            ...card,
            marginBottom: 20,
            border: "1px solid rgba(34,197,94,0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <strong style={{ color: "#22c55e" }}>🚖 Prochaine course</strong>

            <StatusBadge s={nextCourse.status} />
          </div>

          <div style={{ color: "#f8fafc", marginBottom: 8 }}>
            {nextCourse.depart} → {nextCourse.destination || nextCourse.arrivee}
          </div>

          <div style={{ color: "#94a3b8", fontSize: 13 }}>{formatParis(nextCourse.pickup_datetime)}</div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              {
                icon: "💶",
                value: `${caJ.toFixed(2)} €`,
                label: "CA aujourd'hui",
              },
              {
                icon: "📈",
                value: `${caM.toFixed(2)} €`,
                label: "CA ce mois",
              },
              {
                icon: "🚗",
                value: String(coursesJ),
                label: "Courses auj.",
              },
              {
                icon: "👥",
                value: String(clientsTotal),
                label: "Clients total",
              },
            ].map((c, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 22 }}>{c.icon}</div>
                <div style={valCss}>{c.value}</div>
                <div style={labelCss}>{c.label}</div>
              </div>
            ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setTab("reservations")}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: tab === "reservations" ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)",
            color: tab === "reservations" ? "#0ea5e9" : "#94a3b8",
          }}
        >
          📋 Réservations
        </button>

        <button
          onClick={() => setTab("visiteurs")}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: tab === "visiteurs" ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.05)",
            color: tab === "visiteurs" ? "#0ea5e9" : "#94a3b8",
          }}
        >
          👁️ Visiteurs
        </button>
      </div>

      {tab === "reservations" && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {loading && (
            <div style={{ padding: 20 }}>
              <Skeleton height={40} />
            </div>
          )}

          {!loading && reservs.length === 0 && <div style={{ padding: 30, color: "#64748b" }}>Aucune réservation</div>}

          {!loading &&
            reservs.map((r) => {
              const prix = getPrix(r);

              return (
                <SwipeableCard key={r.id} onDelete={() => deleteReservation(r.id)}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ color: "#f8fafc" }}>{r.client_name || r.nom || "Client"}</strong>

                    <StatusBadge s={r.status} />
                  </div>

                  <div style={{ color: "#cbd5e1", marginBottom: 6 }}>
                    {r.depart} → {r.destination || r.arrivee}
                  </div>

                  <div style={{ color: "#64748b", fontSize: 12 }}>{formatParis(r.pickup_datetime || r.created_at)}</div>

                  {prix !== null && (
                    <div
                      style={{
                        marginTop: 8,
                        color: "#0ea5e9",
                        fontWeight: 700,
                      }}
                    >
                      {prix.toFixed(2)} €
                    </div>
                  )}

                  {r.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <button
                        onClick={() => updateStatus(r.id, "accepted")}
                        style={{
                          flex: 1,
                          background: "#22c55e",
                          border: "none",
                          padding: "10px",
                          borderRadius: 10,
                          color: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ✓ Accepter
                      </button>

                      <button
                        onClick={() => updateStatus(r.id, "refused")}
                        style={{
                          flex: 1,
                          background: "#ef4444",
                          border: "none",
                          padding: "10px",
                          borderRadius: 10,
                          color: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ✗ Refuser
                      </button>
                    </div>
                  )}
                </SwipeableCard>
              );
            })}
        </div>
      )}

      {tab === "visiteurs" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 12,
          }}
        >
          {[
            {
              icon: "☀️",
              value: visitorsJ,
              label: "Aujourd'hui",
            },
            {
              icon: "📅",
              value: visitorsSem,
              label: "7 derniers jours",
            },
            {
              icon: "🗓️",
              value: visitorsM,
              label: "Ce mois",
            },
            {
              icon: "📆",
              value: visitorsAn,
              label: "Cette année",
            },
          ].map((s, i) => (
            <div key={i} style={{ ...card, textAlign: "center" }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: "#f8fafc",
                }}
              >
                {s.value}
              </div>
              <div style={labelCss}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
