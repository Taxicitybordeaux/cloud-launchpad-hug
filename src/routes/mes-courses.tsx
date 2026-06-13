// src/routes/mes-courses.tsx
// Page historique des courses — filtré par session_id ou email
// Fonctionnalités : liste, replay itinéraire, "Même trajet en 1 tap"

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";

export const Route = createFileRoute("/mes-courses")({
  head: () => ({ meta: [{ title: "Mes courses — Taxi City Bordeaux" }] }),
  component: MesCourses,
});

// ── Leaflet loader ────────────────────────────────────────────
function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve();
      return;
    }
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link");
      l.id = "leaflet-css";
      l.rel = "stylesheet";
      l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    const existing = document.getElementById("leaflet-js");
    if (existing) {
      const poll = setInterval(() => {
        if ((window as any).L) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        (window as any).L ? resolve() : reject();
      }, 8000);
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

import { geocodeAddress } from "@/lib/geocode";
import { fetchRouteCoordinates } from "@/lib/osrm";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_TILE_OPTIONS = { attribution: "© OpenStreetMap contributors", maxZoom: 19 };

async function geocode(adresse: string): Promise<[number, number] | null> {
  try {
    const c = await geocodeAddress(adresse);
    if (!c) return null;
    return [c.lat, c.lng];
  } catch {
    return null;
  }
}

async function getPolyline(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    // from/to sont en [lat, lng], OSRM attend [lng, lat]
    const result = await fetchRouteCoordinates(
      [
        [from[1], from[0]],
        [to[1], to[0]],
      ],
      { overview: "full", geometries: "geojson" },
    );
    const coords: [number, number][] = result?.routes?.[0]?.geometry?.coordinates ?? [];
    // OSRM renvoie [lng, lat], Leaflet attend [lat, lng]
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    return [];
  }
}

interface Course {
  id: string;
  depart: string;
  destination: string;
  date_course: string;
  heure_course: string;
  status: string;
  prix_final: number | null;
  prix_estime?: number | null;
  distance_reelle_km: number | null;
  distance_km?: number | null;
  duree_reelle_min: number | null;
  paiement: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  session_id: string | null;
  created_at: string;
}

// STATUT_LABELS est maintenant dynamique via getStatutLabels(t) dans les composants
function getStatutLabels(t: (k: string) => string): Record<string, { label: string; color: string; bg: string }> {
  return {
    completed: { label: t("mc.status.completed"), color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    accepted: { label: t("mc.status.accepted"), color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    pending: { label: t("mc.status.pending"), color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    refused: { label: t("mc.status.refused"), color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    en_route: { label: t("mc.status.en_route"), color: "#f5c842", bg: "rgba(245,200,66,0.12)" },
    arrived: { label: t("mc.status.arrived"), color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    cancelled: { label: t("mc.status.cancelled"), color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
}

function formatDate(dateStr: string, heureStr?: string): string {
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    return heureStr ? `${date} · ${heureStr}` : date;
  } catch {
    return dateStr;
  }
}

function formatDuree(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, "0")}`;
}

function MapReplay({ depart, destination }: { depart: string; destination: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useLang();

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        await loadLeaflet();
        if (!mounted || !mapRef.current) return;
        const L = (window as any).L;
        if (mapInst.current) {
          mapInst.current.remove();
          mapInst.current = null;
        }

        const map = L.map(mapRef.current, { center: [44.8378, -0.5792], zoom: 12, zoomControl: false });
        L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
        mapInst.current = map;

        const [fromCoords, toCoords] = await Promise.all([geocode(depart), geocode(destination)]);
        if (!mounted) return;
        if (!fromCoords || !toCoords) {
          setError(true);
          setLoading(false);
          return;
        }

        const greenIcon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const goldIcon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#f5c842;border:2px solid #fff;box-shadow:0 0 8px rgba(245,200,66,0.6)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker(fromCoords, { icon: greenIcon }).addTo(map);
        L.marker(toCoords, { icon: goldIcon }).addTo(map);

        const poly = await getPolyline(fromCoords, toCoords);
        if (poly.length > 0) {
          L.polyline(poly, { color: "#000000", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);
          map.fitBounds(poly, { padding: [60, 60], maxZoom: 16, animate: true });
        } else {
          map.fitBounds([fromCoords, toCoords], { padding: [60, 60], maxZoom: 16 });
        }
        setTimeout(() => map.invalidateSize(), 100);

        const onResize = () => map.invalidateSize();
        window.addEventListener("resize", onResize);
        window.addEventListener("orientationchange", onResize);
        (map as any)._mcResizeHandler = onResize;
      } catch {
        setError(true);
      }
      if (mounted) setLoading(false);
    };
    init();
    return () => {
      mounted = false;
      if (mapInst.current?._mcResizeHandler) {
        window.removeEventListener("resize", mapInst.current._mcResizeHandler);
        window.removeEventListener("orientationchange", mapInst.current._mcResizeHandler);
      }
      mapInst.current?.remove();
      mapInst.current = null;
    };
  }, [depart, destination]);

  if (error)
    return (
      <div
        style={{
          height: 180,
          background: "#1a1a2e",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 13,
        }}
      >
        {t("mc.map.unavailable")}
      </div>
    );

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 180 }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#1a1a2e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            color: "#64748b",
            fontSize: 13,
          }}
        >
          {t("mc.map.loading")}
        </div>
      )}
      <div ref={mapRef} style={{ height: 180 }} />
    </div>
  );
}

function CourseCard({ course, onRebook }: { course: Course; onRebook: (c: Course) => void }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { t } = useLang();
  const STATUT_LABELS = getStatutLabels(t);
  const statut = STATUT_LABELS[course.status] ?? {
    label: course.status,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
  };

  const isTerminee = course.status === "completed";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      {/* En-tête cliquable */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "18px 18px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        {/* Statut + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: statut.color,
              background: statut.bg,
              padding: "3px 10px",
              borderRadius: 99,
            }}
          >
            {statut.label}
          </span>
          <span style={{ fontSize: 12, color: "#475569" }}>{formatDate(course.date_course, course.heure_course)}</span>
        </div>

        {/* Trajet */}
        <div className="mc-route-row" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <div style={{ width: 1.5, height: 20, background: "rgba(255,255,255,0.08)", margin: "3px 0" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f5c842" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 1 }}>{t("mc.from")}</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#e2e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 8,
              }}
            >
              {course.depart}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 1 }}>{t("mc.to")}</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#e2e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {course.destination}
            </div>
          </div>
          {isTerminee && (course.prix_final != null || course.prix_estime != null) && (
            <div className="mc-route-price" style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#f5c842",
                  fontFamily: "'DM Sans',sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {(course.prix_final != null ? course.prix_final : (course.prix_estime ?? 0)).toFixed(2)} €
              </div>
              {(course.distance_reelle_km ?? course.distance_km) != null && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {course.distance_reelle_km ?? course.distance_km} km
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats rapides si terminée */}
        {isTerminee && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {course.distance_reelle_km && (
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  background: "rgba(255,255,255,0.04)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                📍 {course.distance_reelle_km} km
              </span>
            )}
            {course.duree_reelle_min && (
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  background: "rgba(255,255,255,0.04)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                ⏱ {formatDuree(course.duree_reelle_min)}
              </span>
            )}
            {course.paiement && (
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  background: "rgba(255,255,255,0.04)",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                {course.paiement === "cb" ? "💳 CB" : course.paiement === "especes" ? "💵 Espèces" : course.paiement}
              </span>
            )}
          </div>
        )}

        {/* Chevron */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10, padding: "6px 0", minHeight: 24 }}>
          <span
            style={{
              color: "#334155",
              fontSize: 14,
              transition: "transform 0.2s",
              display: "inline-block",
              transform: expanded ? "rotate(180deg)" : "rotate(0)",
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* Détail étendu */}
      {expanded && (
        <div
          style={{
            padding: "0 18px 18px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Replay carte */}
          {isTerminee && <MapReplay depart={course.depart} destination={course.destination} />}

          {/* Boutons action */}
          <div className="mc-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={() => onRebook(course)}
              style={{
                padding: "14px 10px",
                background: "linear-gradient(135deg,#f5c842,#e6a800)",
                border: "none",
                borderRadius: 14,
                color: "#0a0a14",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ fontSize: 20 }}>🔁</span>
              {t("mc.action.same")}
            </button>
            {isTerminee ? (
              <button
                onClick={() => navigate({ to: `/fin/${course.id}` })}
                style={{
                  padding: "14px 10px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  color: "#cbd5e1",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 20 }}>📄</span>
                {t("mc.action.receipt")}
              </button>
            ) : (
              <button
                onClick={() => navigate({ to: `/suivi/${course.id}` })}
                style={{
                  padding: "14px 10px",
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  borderRadius: 14,
                  color: "#3b82f6",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 20 }}>📍</span>
                {t("mc.action.track")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RebookModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { t } = useLang();

  const today = new Date().toISOString().split("T")[0];

  const handleRebook = async () => {
    if (!date || !heure) return;
    setLoading(true);
    try {
      const sid = sessionStorage.getItem("sid");
      const { data, error } = await (supabase as any)
        .from("reservations")
        .insert({
          depart: course.depart,
          destination: course.destination,
          date_course: date,
          heure_course: heure,
          prenom: course.prenom,
          nom: course.nom,
          email: course.email,
          paiement: course.paiement,
          status: "pending",
          pickup_datetime: new Date(`${date}T${heure}`).toISOString(),
          session_id: sid,
        })
        .select("id")
        .single();

      if (error) throw error;
      setDone(true);
      setTimeout(() => {
        onClose();
        navigate({ to: `/suivi/${data.id}` });
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
        padding: "0",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          background: "#111120",
          borderRadius: "24px 24px 0 0",
          padding: "24px 20px calc(32px + env(safe-area-inset-bottom,0px))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
          animation: "slideUp 0.3s ease",
        }}
      >
        <div
          style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9, margin: "0 auto 20px" }}
        />

        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>{t("mc.rebook.success")}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{t("mc.rebook.redirect")}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>
              {t("mc.rebook.title")}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{t("mc.rebook.subtitle")}</div>

            {/* Trajet résumé */}
            <div
              style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 16px", marginBottom: 20 }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{t("mc.rebook.from")}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 10,
                }}
              >
                {course.depart}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{t("mc.rebook.to")}</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {course.destination}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                  {t("mc.rebook.date")}
                </label>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#f5f5f5",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                    colorScheme: "dark",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                  {t("mc.rebook.time")}
                </label>
                <input
                  type="time"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#f5f5f5",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                    colorScheme: "dark",
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleRebook}
              disabled={!date || !heure || loading}
              style={{
                width: "100%",
                height: 54,
                background: date && heure ? "linear-gradient(135deg,#f5c842,#e6a800)" : "rgba(245,200,66,0.2)",
                color: date && heure ? "#0a0a14" : "rgba(245,200,66,0.4)",
                border: "none",
                borderRadius: 14,
                fontWeight: 700,
                fontSize: 16,
                cursor: date && heure ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {loading ? t("mc.rebook.loading") : t("mc.rebook.btn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Filtre email (si pas de session) ─────────────────────────
function EmailGate({ onFound }: { onFound: (courses: Course[]) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useLang();

  const search = async () => {
    if (!email.includes("@")) {
      setErr(t("mc.gate.err.invalid"));
      return;
    }
    setLoading(true);
    setErr("");
    const { data } = await (supabase as any)
      .from("reservations")
      .select("*")
      .eq("email", email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (!data || data.length === 0) {
      setErr(t("mc.gate.err.notfound"));
      return;
    }
    onFound(data as Course[]);
  };

  return (
    <div style={{ padding: "60px 24px", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#f5f5f5",
          textAlign: "center",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {t("mc.gate.title")}
      </div>
      <div style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>{t("mc.gate.subtitle")}</div>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder={t("mc.gate.placeholder")}
          style={{
            width: "100%",
            padding: "14px 16px",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            color: "#f5f5f5",
            fontSize: 15,
            outline: "none",
          }}
        />
        {err && <div style={{ marginTop: 8, color: "#ef4444", fontSize: 13 }}>{err}</div>}
        <button
          onClick={search}
          disabled={loading}
          style={{
            marginTop: 12,
            width: "100%",
            height: 52,
            background: "linear-gradient(135deg,#f5c842,#e6a800)",
            border: "none",
            borderRadius: 14,
            color: "#0a0a14",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {loading ? t("mc.gate.loading") : t("mc.gate.btn")}
        </button>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
function MesCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const [rebookTarget, setRebookTarget] = useState<Course | null>(null);
  const { t } = useLang();

  useEffect(() => {
    const load = async () => {
      const sid = sessionStorage.getItem("sid");
      if (!sid) {
        setShowGate(true);
        setLoading(false);
        return;
      }

      const { data } = await (supabase as any)
        .from("reservations")
        .select("*")
        .eq("session_id", sid)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) {
        setShowGate(true);
        setLoading(false);
        return;
      }
      setCourses(data as Course[]);
      setLoading(false);
    };
    load();
  }, []);

  const stats = {
    total: courses.length,
    terminees: courses.filter((c) => c.status === "completed").length,
    depenses: courses
      .filter((c) => (c.prix_final ?? c.prix_estime) != null)
      .reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0),
    km: courses
      .filter((c) => (c.distance_reelle_km ?? c.distance_km) != null)
      .reduce((s, c) => s + (c.distance_reelle_km ?? c.distance_km ?? 0), 0),
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0a14",
        fontFamily: "'DM Sans',sans-serif",
        paddingBottom: "env(safe-area-inset-bottom,24px)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        @keyframes slideUp { from { transform: translateY(40px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4); }

        /* Petits écrans (≤360px) : compacter stats et trajet */
        @media (max-width: 360px) {
          .mc-stats-grid { gap: 6px !important; }
          .mc-stats-grid > div { padding: 10px 6px !important; }
          .mc-stats-grid .mc-stat-val { font-size: 14px !important; }
          .mc-route-price { font-size: 17px !important; }
          .mc-action-grid { gap: 8px !important; }
          .mc-action-grid button { padding: 12px 6px !important; font-size: 13px !important; }
        }

        /* Très petits écrans : la valeur prix passe sous le trajet plutôt que de l'écraser */
        @media (max-width: 320px) {
          .mc-route-row { flex-wrap: wrap; }
          .mc-route-price { width: 100%; text-align: left !important; margin-top: 8px; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(10,10,20,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate({ to: "/" })}
          style={{
            background: "none",
            border: "none",
            color: "#f5c842",
            fontSize: 20,
            cursor: "pointer",
            padding: 8,
            margin: -8,
            lineHeight: 1,
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f5" }}>{t("mc.title")}</div>
          {!showGate && courses.length > 0 && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {courses.length} {courses.length > 1 ? t("mc.count_pl") : t("mc.count_sg")}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 140,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 20,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : showGate ? (
        <EmailGate
          onFound={(data) => {
            setCourses(data);
            setShowGate(false);
          }}
        />
      ) : (
        <div
          style={{
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            animation: "fadeIn 0.4s ease",
          }}
        >
          {/* Stats */}
          {stats.terminees > 0 && (
            <div
              className="mc-stats-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 4,
              }}
            >
              {[
                { icon: "🚕", val: stats.terminees, label: t("mc.stat.rides") },
                { icon: "💶", val: `${stats.depenses.toFixed(0)} €`, label: t("mc.stat.spent") },
                { icon: "📍", val: `${stats.km.toFixed(0)} km`, label: t("mc.stat.km") },
              ].map(({ icon, val, label }) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(245,200,66,0.05)",
                    border: "1px solid rgba(245,200,66,0.12)",
                    borderRadius: 16,
                    padding: "14px 10px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                  <div
                    className="mc-stat-val"
                    style={{ fontSize: 16, fontWeight: 800, color: "#f5c842", fontVariantNumeric: "tabular-nums" }}
                  >
                    {val}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Liste */}
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} onRebook={setRebookTarget} />
          ))}

          {/* CTA nouvelle résa */}
          <button
            onClick={() => navigate({ to: "/" })}
            style={{
              marginTop: 8,
              width: "100%",
              height: 54,
              background: "linear-gradient(135deg,#f5c842,#e6a800)",
              border: "none",
              borderRadius: 16,
              color: "#0a0a14",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {t("mc.action.new")}
          </button>
        </div>
      )}

      {/* Modale rebook */}
      {rebookTarget && <RebookModal course={rebookTarget} onClose={() => setRebookTarget(null)} />}
    </div>
  );
}
