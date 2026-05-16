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
const TARIF_NUIT_LABEL = "3,24 €/km";

/* Status badge */
const STATUS: Record<string, { bg: string; c: string; label: string }> = {
  pending: { bg: "rgba(245,158,11,0.15)", c: "#f59e0b", label: "En attente" },
  accepted: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Acceptée" },
  refused: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Refusée" },
};
/** Formate le moyen de paiement stocké en BDD */
function paiementLabel(p: string | null | undefined): string {
  if (!p) return "";
  const map: Record<string, string> = {
    especes: "💵 Espèces",
    cb: "💳 Carte bancaire",
    virement: "🏦 Virement",
    cheque: "📝 Chèque",
  };
  return map[p.toLowerCase()] ?? p;
}

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

/** Carte avec swipe-to-delete (glisser vers la gauche pour révéler le bouton supprimer) */
function SwipeRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const REVEAL = 88;
  const open = dx <= -REVEAL / 2;
  return (
    <div style={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <button
        onClick={onDelete}
        aria-label="Supprimer"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: REVEAL,
          background: "#ef4444",
          color: "#fff",
          border: 0,
          fontSize: 22,
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        🗑
      </button>
      <div
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX - dx;
        }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          const next = e.touches[0].clientX - startX.current;
          if (next <= 0 && next >= -REVEAL) setDx(next);
        }}
        onTouchEnd={() => {
          setDx(dx < -REVEAL / 2 ? -REVEAL : 0);
          startX.current = null;
        }}
        onClick={() => {
          if (open) setDx(0);
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: startX.current === null ? "transform 0.2s ease" : "none",
          background: "#0a0f1e",
        }}
      >
        {children}
      </div>
    </div>
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
  const [caJ, setCaJ] = useState(0);
  const [caM, setCaM] = useState(0);
  const [coursesJ, setCoursesJ] = useState(0);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [visitors, setVisitors] = useState(0);
  const [reservs, setReservs] = useState<any[]>([]);
  const [nextCourse, setNextCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Data fetch ── */
  const fetchAll = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const monthIso = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const nowIso = new Date().toISOString();
    const tomorrowIso = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const [caJR, caMR, cJR, cliR, visR, resR, nextR] = await Promise.all([
      supabase.from("courses").select("prix_final").gte("created_at", todayIso),
      supabase.from("courses").select("prix_final").gte("created_at", monthIso),
      // Compte les réservations dont la prise en charge est aujourd'hui (hors refusées)
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .gte("pickup_datetime", todayIso)
        .lt("pickup_datetime", tomorrowIso)
        .neq("status", "refused"),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", todayIso),
      supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(10),
      // Prochaine course acceptée : dans le futur, pickup_datetime null, ou dans les 2h passées
      supabase
        .from("reservations")
        .select("*")
        .eq("status", "accepted")
        .or(`pickup_datetime.is.null,pickup_datetime.gte.${new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}`)
        .order("pickup_datetime", { ascending: true, nullsFirst: true })
        .limit(1),
    ]);

    setCaJ((caJR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCaM((caMR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCoursesJ(cJR.count ?? 0);
    setClientsTotal(cliR.count ?? 0);
    setVisitors(new Set((visR.data ?? []).map((v: any) => v.session_id)).size);
    setReservs(resR.data ?? []);
    setNextCourse((nextR.data ?? [])[0] ?? null);
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

  const deleteReservation = async (id: string) => {
    if (!confirm("Supprimer définitivement cette réservation ?")) return;
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
        <div style={{ display: "flex", gap: 8 }}>
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
              ? `${window.location.origin}/tracking/${nextCourse.tracking_id}`
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
              {/* Titre + badge tarif */}
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
                {/* Heure de prise en charge */}
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

                {/* Trajet */}
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

                {/* Prix + Passagers + Service */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {prix !== null && (
                    <div
                      style={{
                        background: "rgba(14,165,233,0.1)",
                        border: "1px solid rgba(14,165,233,0.25)",
                        borderRadius: 12,
                        padding: "10px 16px",
                        flex: 1,
                        minWidth: 100,
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
                      <div
                        style={{
                          color: "#0ea5e9",
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 800,
                          fontSize: 20,
                        }}
                      >
                        {prix.toFixed(2)} €
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: "10px 16px",
                      flex: 1,
                      minWidth: 80,
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
                      👥 Passagers
                    </div>
                    <div style={{ color: "#f8fafc", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>
                      {nextCourse.passagers || nextCourse.nb_passagers || 1}
                    </div>
                  </div>
                  {nextCourse.bagages > 0 && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: "10px 16px",
                        flex: 1,
                        minWidth: 80,
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
                        🧳 Bagages
                      </div>
                      <div style={{ color: "#f8fafc", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>
                        {nextCourse.bagages}
                      </div>
                    </div>
                  )}
                </div>

                {/* Moyen de paiement */}
                {nextCourse.paiement && (
                  <div
                    style={{
                      background: "rgba(34,197,94,0.06)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: 12,
                      padding: "8px 14px",
                      color: "#22c55e",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {paiementLabel(nextCourse.paiement)}
                  </div>
                )}

                {/* Type de service */}
                {nextCourse.service_type && nextCourse.service_type !== "standard" && (
                  <div
                    style={{
                      background: "rgba(14,165,233,0.06)",
                      border: "1px solid rgba(14,165,233,0.15)",
                      borderRadius: 12,
                      padding: "8px 14px",
                      color: "#38bdf8",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    🚖 Service : {nextCourse.service_type}
                  </div>
                )}

                {/* Contact client */}
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
                        style={{
                          color: "#0ea5e9",
                          textDecoration: "none",
                          fontWeight: 700,
                          fontSize: 14,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        📞 {phone}
                      </a>
                    )}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        style={{
                          color: "#94a3b8",
                          textDecoration: "none",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        ✉️ {email}
                      </a>
                    )}
                  </div>
                </div>

                {/* Message / description client */}
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

                {/* Bouton suivi QR si tracking_id existe */}
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

      {/* Analytics cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {loading
          ? Array.from({ length: 1 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [{ i: "👁️", v: String(visitors), l: "Visiteurs auj." }].map((c, i) => (
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
            reservs.map((r) => {
              const prix = getPrix(r);
              return (
                <SwipeRow key={r.id} onDelete={() => deleteReservation(r.id)}>
                  <div style={{ padding: "14px 16px" }}>
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
                    {r.paiement && (
                      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>{paiementLabel(r.paiement)}</div>
                    )}
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
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: "1px dashed rgba(255,255,255,0.06)",
                      }}
                    >
                      <span style={{ color: "#64748b", fontSize: 11 }}>
                        Reçu&nbsp;:{" "}
                        {new Date(r.created_at).toLocaleString("fr-FR", {
                          timeZone: "Europe/Paris",
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <span
                        role="status"
                        aria-label={prix !== null ? `Prix estimé : ${prix.toFixed(2)} euros` : "Prix non disponible"}
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: 8,
                          background: "#0ea5e9",
                          border: "1px solid #38bdf8",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: "clamp(15px, 4.2vw, 18px)",
                          lineHeight: 1.2,
                          padding: "6px 12px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 8px rgba(14,165,233,0.35)",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: "clamp(10px, 2.8vw, 12px)",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#ffffff",
                            opacity: 0.95,
                          }}
                        >
                          Prix
                        </span>
                        <span aria-hidden="true">{prix !== null ? `${prix.toFixed(2)} €` : "—"}</span>
                      </span>
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
                </SwipeRow>
              );
            })}
          {!loading && reservs.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#475569" }}>Aucune réservation</div>
          )}
        </div>

        {/* ── Desktop : table ── */}
        <div className="reserv-table" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", color: "#64748b", textAlign: "left" }}>
                {["Prise en charge", "Client", "Trajet", "Prix", "Paiement", "Tarif", "Message", "Statut", ""].map(
                  (h) => (
                    <th key={h} style={{ padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ),
                )}
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
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#cbd5e1", fontSize: 12 }}>
                        {paiementLabel(r.paiement) || <span style={{ color: "#475569" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            color: nuit ? "#818cf8" : "#fbbf24",
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
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
                        <span style={{ display: "flex", gap: 6 }}>
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
                              background: "rgba(239,68,68,0.15)",
                              color: "#ef4444",
                              border: "1px solid rgba(239,68,68,0.3)",
                              padding: "5px 10px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
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
                  <td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#475569" }}>
                    Aucune réservation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
