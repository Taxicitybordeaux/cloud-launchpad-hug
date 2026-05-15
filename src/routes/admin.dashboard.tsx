import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
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

// Tarifs officiels Bordeaux
const TARIF_JOUR_LABEL = "2,16 €/km";
const TARIF_NUIT_LABEL = "3,26 €/km";

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
      style={{
        background: v.bg,
        color: v.c,
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {v.label}
    </span>
  );
}

/** Formate une date ISO en heure de Paris */
function formatParis(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    ...opts,
  });
}

/** Détecte si une heure ISO tombe en tarif nuit (20h-6h, heure de Paris) */
function isNuit(iso: string): boolean {
  const h = parseInt(
    new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }),
    10,
  );
  return h >= 20 || h < 6;
}

/** Card mobile avec swipe-to-delete (glisser à gauche) */
function SwipeableCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [offsetX, setOffsetX] = useState(0);
  const isDragging = useRef(false); // ← ref pour éviter les valeurs stale dans les event handlers
  const startX = useRef(0);
  const offsetRef = useRef(0); // ← mirror de offsetX pour onTouchEnd
  const THRESHOLD = 80; // px pour déclencher la suppression
  const MAX_SLIDE = 90; // largeur du bouton révélé

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    // Seulement vers la gauche (dx négatif)
    const clamped = Math.max(-MAX_SLIDE, Math.min(0, dx));
    offsetRef.current = clamped;
    setOffsetX(clamped);
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    if (offsetRef.current < -THRESHOLD) {
      // Révéler complètement le bouton
      offsetRef.current = -MAX_SLIDE;
      setOffsetX(-MAX_SLIDE);
    } else {
      // Revenir à la position initiale
      offsetRef.current = 0;
      setOffsetX(0);
    }
  };

  const reset = () => setOffsetX(0);

  return (
    <div style={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Fond rouge avec icône poubelle */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: MAX_SLIDE,
          background: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
          cursor: "pointer",
        }}
        onClick={onDelete}
      >
        <span style={{ fontSize: 20 }}>🗑</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>SUPPR.</span>
      </div>

      {/* Contenu glissable */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: "transform 0.25s cubic-bezier(0.25,1,0.5,1)",
          background: "var(--card-bg, #0f172a)",
          position: "relative",
          zIndex: 1,
          willChange: "transform",
        }}
      >
        {/* Indicateur de swipe (flèche) visible seulement si pas encore glissé */}
        {offsetX === 0 && (
          <div
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(239,68,68,0.35)",
              fontSize: 16,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            ‹‹
          </div>
        )}
        {/* Overlay pour fermer le slide en cliquant sur le contenu */}
        {offsetX !== 0 && (
          <div onClick={reset} style={{ position: "absolute", inset: 0, zIndex: 2, cursor: "pointer" }} />
        )}
        <div style={{ padding: "14px 16px" }}>{children}</div>
      </div>
    </div>
  );
}

/** Calcule le prix estimé d'une réservation selon distance + tarif heure Paris */
function getPrix(r: any): number | null {
  if (r.prix_final) return Number(r.prix_final);
  if (r.prix_estime) return Number(r.prix_estime);
  if (r.distance_km) {
    const nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
    return calculerPrix(Number(r.distance_km), !nuit);
  }
  return null;
}

function Dashboard() {
  const [tab, setTab] = useState<"reservations" | "visiteurs">("reservations");
  const [caJ, setCaJ] = useState(0);
  const [caM, setCaM] = useState(0);
  const [coursesJ, setCoursesJ] = useState(0);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [visitorsJ, setVisitorsJ] = useState(0);
  const [visitorsSem, setVisitorsSem] = useState(0);
  const [visitorsM, setVisitorsM] = useState(0);
  const [visitorsAn, setVisitorsAn] = useState(0);
  const [reservs, setReservs] = useState<any[]>([]);
  const [nextCourse, setNextCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const monthIso = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const yearIso = new Date(today.getFullYear(), 0, 1).toISOString();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekIso = weekAgo.toISOString();
    const nowIso = new Date().toISOString();

    const [caJR, caMR, cJR, cliR, visJR, visSemR, visMR, visAnR, resR, nextR] = await Promise.all([
      supabase.from("courses").select("prix_final").gte("created_at", todayIso),
      supabase.from("courses").select("prix_final").gte("created_at", monthIso),
      supabase.from("reservations").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", todayIso),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", weekIso),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", monthIso),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", yearIso),
      supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(10),
      supabase
        .from("reservations")
        .select("*")
        .eq("status", "accepted")
        .gte("pickup_datetime", nowIso)
        .order("pickup_datetime", { ascending: true })
        .limit(1),
    ]);

    const uniq = (data: any[]) => new Set((data ?? []).map((v) => v.session_id)).size;

    setCaJ((caJR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCaM((caMR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCoursesJ(cJR.count ?? 0);
    setClientsTotal(cliR.count ?? 0);
    setVisitorsJ(uniq(visJR.data ?? []));
    setVisitorsSem(uniq(visSemR.data ?? []));
    setVisitorsM(uniq(visMR.data ?? []));
    setVisitorsAn(uniq(visAnR.data ?? []));
    setReservs(resR.data ?? []);
    setNextCourse((nextR.data ?? [])[0] ?? null);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    // Realtime Supabase
    const ch = supabase
      .channel(`dash-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_analytics" }, fetchAll)
      .subscribe();
    // Polling toutes les 30s (fallback si realtime non activé)
    const poll = setInterval(fetchAll, 30_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservations").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  const deleteReservation = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette réservation ?")) return;
    await supabase.from("reservations").delete().eq("id", id);
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Indicateur dernière MAJ */}
          <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>
            ↻ {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <a
            href="/"
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#94a3b8",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: "nowrap",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Retour au site
          </a>
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
      </div>

      {/* ── PROCHAINE COURSE ACCEPTÉE ── */}
      {!loading &&
        nextCourse &&
        (() => {
          const nuit = isNuit(nextCourse.pickup_datetime);
          const prix = getPrix(nextCourse);
          const phone = nextCourse.telephone || nextCourse.client_phone;
          const email = nextCourse.email || nextCourse.client_email;
          const name = nextCourse.nom || nextCourse.client_name;
          const arrivee = nextCourse.arrivee || nextCourse.destination;
          const trackingUrl =
            nextCourse.tracking_id && typeof window !== "undefined"
              ? `${window.location.origin}/scan/${nextCourse.tracking_id}`
              : null;

          return (
            <div
              style={{
                ...card,
                marginBottom: 20,
                border: "1px solid rgba(34,197,94,0.35)",
                background: "rgba(34,197,94,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>🚖</span>
                <h2
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#22c55e",
                    margin: 0,
                  }}
                >
                  Prochaine course
                </h2>
                <span
                  style={{
                    marginLeft: "auto",
                    background: nuit ? "rgba(99,102,241,0.2)" : "rgba(250,204,21,0.15)",
                    color: nuit ? "#818cf8" : "#fbbf24",
                    padding: "3px 10px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {nuit ? `🌙 Nuit ${TARIF_NUIT_LABEL}` : `☀️ Jour ${TARIF_JOUR_LABEL}`}
                </span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    background: "rgba(14,165,233,0.08)",
                    border: "1px solid rgba(14,165,233,0.2)",
                    borderRadius: 12,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    🕐 Prise en charge
                  </div>
                  <div style={{ color: "#f8fafc", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17 }}>
                    {formatParis(nextCourse.pickup_datetime, { dateStyle: "full", timeStyle: "short" })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      🟢 Départ
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>
                      {nextCourse.depart}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      📍 Arrivée
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>
                      {arrivee || "—"}
                    </div>
                  </div>
                </div>
                {prix !== null && (
                  <div
                    style={{
                      background: "rgba(14,165,233,0.1)",
                      border: "1px solid rgba(14,165,233,0.25)",
                      borderRadius: 12,
                      padding: "10px 16px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      💰 Prix estimé
                    </div>
                    <div style={{ color: "#0ea5e9", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>
                      {prix.toFixed(2)} €
                    </div>
                  </div>
                )}
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    👤 Client
                  </div>
                  <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{name || "—"}</div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 700, fontSize: 14 }}
                      >
                        📞 {phone}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>
                        ✉️ {email}
                      </a>
                    )}
                  </div>
                </div>
                {nextCourse.message && (
                  <div
                    style={{
                      background: "rgba(14,165,233,0.06)",
                      border: "1px solid rgba(14,165,233,0.15)",
                      borderRadius: 12,
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      💬 Message client
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                      {nextCourse.message}
                    </div>
                  </div>
                )}
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(139,92,246,0.15)",
                      border: "1px solid rgba(139,92,246,0.3)",
                      color: "#a78bfa",
                      padding: "10px 16px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      textDecoration: "none",
                    }}
                  >
                    📲 Lien de suivi client
                  </a>
                )}
              </div>
            </div>
          );
        })()}

      {/* KPI stat cards — 2 colonnes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
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

      {/* ── ONGLETS ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["reservations", "visiteurs"] as const).map((t) => {
          const labels = { reservations: "📋 Réservations", visiteurs: "👁️ Visiteurs" };
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                border: active ? "1px solid rgba(14,165,233,0.5)" : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.03)",
                color: active ? "#0ea5e9" : "#64748b",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ── ONGLET RÉSERVATIONS ── */}
      {tab === "reservations" && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <h2
            style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, color: "#f8fafc", padding: "16px 18px", margin: 0 }}
          >
            Dernières réservations
          </h2>

          {/* Mobile : cards swipeables */}
          <div className="reserv-cards" style={{ display: "none" }}>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
                </div>
              ))}
            {!loading &&
              reservs.map((r) => {
                const prix = getPrix(r);
                return (
                  <SwipeableCard key={r.id} onDelete={() => deleteReservation(r.id)}>
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
                    {r.pickup_datetime && (
                      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>
                        🕐 {formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })}
                        {" · "}
                        <span style={{ color: isNuit(r.pickup_datetime) ? "#818cf8" : "#fbbf24", fontWeight: 600 }}>
                          {isNuit(r.pickup_datetime) ? `🌙 ${TARIF_NUIT_LABEL}` : `☀️ ${TARIF_JOUR_LABEL}`}
                        </span>
                      </div>
                    )}
                    {r.message && (
                      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4, fontStyle: "italic" }}>
                        💬 {r.message.slice(0, 60)}
                        {r.message.length > 60 ? "…" : ""}
                      </div>
                    )}
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
                        {new Date(r.created_at).toLocaleString("fr-FR", {
                          timeZone: "Europe/Paris",
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {prix !== null && (
                        <span style={{ color: "#0ea5e9", fontWeight: 700, fontSize: 13 }}>{prix.toFixed(2)} €</span>
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
                  </SwipeableCard>
                );
              })}
            {!loading && reservs.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "#475569" }}>Aucune réservation</div>
            )}
          </div>

          {/* Desktop : table */}
          <div className="reserv-table" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", color: "#64748b", textAlign: "left" }}>
                  {["Prise en charge", "Client", "Trajet", "Prix", "Tarif", "Message", "Statut", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  reservs.map((r) => {
                    const prix = getPrix(r);
                    const nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {r.pickup_datetime
                            ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                            : new Date(r.created_at).toLocaleString("fr-FR", {
                                timeZone: "Europe/Paris",
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div>{r.client_name || r.nom}</div>
                          {(r.telephone || r.client_phone) && (
                            <div style={{ fontSize: 11, color: "#64748b" }}>{r.telephone || r.client_phone}</div>
                          )}
                          {(r.email || r.client_email) && (
                            <div style={{ fontSize: 11, color: "#475569" }}>{r.email || r.client_email}</div>
                          )}
                        </td>
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
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#0ea5e9", fontWeight: 700 }}>
                          {prix !== null ? `${prix.toFixed(2)} €` : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ color: nuit ? "#818cf8" : "#fbbf24", fontWeight: 600, fontSize: 11 }}>
                            {nuit ? `🌙 ${TARIF_NUIT_LABEL}` : `☀️ ${TARIF_JOUR_LABEL}`}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#64748b",
                            fontSize: 12,
                            fontStyle: "italic",
                          }}
                        >
                          {r.message || "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <StatusBadge s={r.status} />
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {r.status === "pending" && (
                              <>
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
                              </>
                            )}
                            <button
                              onClick={() => deleteReservation(r.id)}
                              title="Supprimer"
                              style={{
                                background: "rgba(239,68,68,0.12)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.3)",
                                padding: "5px 8px",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontSize: 13,
                                lineHeight: 1,
                              }}
                            >
                              🗑
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {!loading && reservs.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#475569" }}>
                      Aucune réservation
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONGLET VISITEURS ── */}
      {tab === "visiteurs" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* 4 compteurs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
              : [
                  { v: visitorsJ, l: "Aujourd'hui", c: "#0ea5e9", i: "☀️" },
                  { v: visitorsSem, l: "7 derniers jours", c: "#8b5cf6", i: "📅" },
                  { v: visitorsM, l: "Ce mois", c: "#22c55e", i: "🗓️" },
                  { v: visitorsAn, l: "Cette année", c: "#f59e0b", i: "📆" },
                ].map((s, i) => (
                  <div key={i} style={{ ...card, textAlign: "center" }}>
                    <div style={{ fontSize: 24 }}>{s.i}</div>
                    <div
                      style={{
                        fontFamily: "'Syne',sans-serif",
                        fontWeight: 800,
                        fontSize: 36,
                        color: s.c,
                        marginTop: 6,
                      }}
                    >
                      {s.v}
                    </div>
                    <div style={labelCss}>{s.l}</div>
                  </div>
                ))}
          </div>
          {/* Info */}
          <div style={{ ...card, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)" }}>
            <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.7 }}>
              <span style={{ color: "#0ea5e9", fontWeight: 700 }}>Sessions uniques</span> — chaque visiteur est compté
              une seule fois par navigateur, même s'il visite plusieurs pages.
              <br />
              Mise à jour automatique toutes les <span style={{ color: "#f8fafc", fontWeight: 600 }}>30 secondes</span>.
            </div>
          </div>
        </div>
      )}

      {/* Responsive switch */}
      <style>{`
        @media (max-width: 640px) {
          .reserv-cards { display: block !important; }
          .reserv-table { display: none !important; }
        }
      `}</style>
    </div>
  );
}
