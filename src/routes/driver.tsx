import { createFileRoute } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMapsWhenVisible } from "@/lib/googleMaps";
import { geocodeAddress } from "@/lib/googleGeocode";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useServerFn } from "@tanstack/react-start";
import { listPushFailures } from "@/lib/push.functions";

// ── Token guard ────────────────────────────────────────────────────────────
const DRIVER_TOKEN = "DSF234";

// ── Types ─────────────────────────────────────────────────────────────────
type Tab = "courses" | "planning" | "avis" | "clients" | "stats";

interface Resa {
  id: string;
  depart: string;
  destination: string;
  date_heure: string;
  status: string;
  prix_estime?: number | null;
  distance_km?: number | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  email?: string | null;
  suivi_id?: string | null;
}

interface Avis {
  id: string;
  author_name: string;
  note: number;
  commentaire: string;
  created_at: string;
  status: string;
}

interface ClientAgg {
  id?: string;
  phone: string;
  name: string;
  nbCourses: number;
  totalDepense: number;
  derniereCourse: string;
  derniereDestination: string;
}

interface RouteOption {
  index: number;
  summary: string;
  distanceKm: number;
  dureeMin: number;
  prix_estime: number;
  tarifLabel: string;
  legs: any[];
  overview_polyline: string;
  dirResult: any;
}

// ── Route definition ───────────────────────────────────────────────────────
export const Route = createFileRoute("/driver")({
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s.token ?? "") }),
  head: () => ({
    meta: [
      { title: "Espace chauffeur" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f172a" },
    ],
    links: [{ rel: "manifest", href: "/api/manifest?role=driver" }],
  }),
  component: DriverPage,
});

// ── Styles globaux ─────────────────────────────────────────────────────────
const css = `
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  html, body {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
    overscroll-behavior-y: contain; background: #f8fafc;
    font-family: 'DM Sans', sans-serif;
  }
  input, textarea, select { font-size: 16px; }
  .drv-root {
    position: fixed; inset: 0;
    max-width: 480px; margin: 0 auto;
    display: flex; flex-direction: column;
    background: #fff;
  }
  .drv-header {
    background: #0f172a; color: #fff; display: flex; align-items: center; gap: 10px;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) calc(env(safe-area-inset-right, 0px) + 16px) 10px calc(env(safe-area-inset-left, 0px) + 16px);
    flex-shrink: 0;
  }
  .drv-header h1 { margin: 0; font-size: 17px; font-weight: 700; flex: 1; }
  .drv-tabs {
    display: flex; border-bottom: 1px solid #e2e8f0; background: #fff;
    padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px);
    flex-shrink: 0;
  }
  .drv-tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 12px 4px 10px; min-height: 48px; border: none; background: none; color: #94a3b8;
    font-size: 10px; font-family: 'DM Sans', sans-serif; cursor: pointer; border-bottom: 2px solid transparent;
    transition: color 0.15s; -webkit-user-select: none; user-select: none;
  }
  .drv-tab:active { background: #f8fafc; }
  .drv-tab.active { color: #0f172a; border-bottom-color: #0f172a; }
  .drv-tab svg { width: 22px; height: 22px; }
  .drv-badge { background: #ef4444; color: #fff; border-radius: 99px; font-size: 10px; font-weight: 700; padding: 1px 5px; position: absolute; top: -3px; right: -5px; }
  .drv-body {
    flex: 1; padding: 16px;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
    overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain;
  }
  .drv-section { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 10px; }
  .drv-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; margin-bottom: 10px; }
  .drv-card.pending { border-color: #f59e0b; }
  .drv-card.new { border-color: #3b82f6; box-shadow: 0 0 0 3px #3b82f620; }
  .drv-card.done { opacity: 0.5; }
  .drv-card.accepted { border-color: #22c55e; }
  .drv-card.refused { border-color: #ef4444; opacity: 0.6; }
  .drv-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .drv-time { font-size: 22px; font-weight: 800; color: #0f172a; }
  .drv-name { font-size: 14px; font-weight: 600; color: #0f172a; }
  .drv-sub { font-size: 12px; color: #64748b; }
  .drv-route { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
  .drv-route span { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; color: #334155; line-height: 1.4; }
  .drv-meta { display: flex; gap: 12px; font-size: 12px; color: #64748b; margin: 8px 0 12px; flex-wrap: wrap; }
  .drv-meta span { display: flex; align-items: center; gap: 4px; }
  .drv-btns { display: flex; gap: 8px; }
  .drv-btn-primary { flex: 1; min-height: 46px; background: #0f172a; color: #fff; border: none; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .drv-btn-primary:active { background: #1e293b; }
  .drv-btn-secondary { flex: 1; min-height: 46px; background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .drv-btn-secondary:active { background: #e2e8f0; }
  .drv-btn-danger { flex: 1; min-height: 46px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .drv-btn-danger:active { background: #fee2e2; }
  .drv-badge-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 99px; }
  .drv-badge-blue { background: #eff6ff; color: #1d4ed8; }
  .drv-badge-green { background: #f0fdf4; color: #15803d; }
  .drv-badge-amber { background: #fffbeb; color: #92400e; }
  .drv-badge-red { background: #fef2f2; color: #b91c1c; }
  .drv-badge-gray { background: #f1f5f9; color: #475569; }
  .drv-stars { color: #f59e0b; font-size: 15px; letter-spacing: 1px; }
  .drv-stars-empty { color: #cbd5e1; font-size: 15px; }
  .drv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .drv-stat { background: #f8fafc; border-radius: 14px; padding: 14px; }
  .drv-stat-lbl { font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .drv-stat-val { font-size: 24px; font-weight: 800; color: #0f172a; }
  .drv-stat-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .drv-empty { text-align: center; padding: 50px 20px; color: #94a3b8; }
  .drv-empty svg { width: 40px; height: 40px; margin-bottom: 10px; opacity: 0.4; }
  .drv-route-opt { border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.15s; min-height: 44px; }
  .drv-route-opt:active { background: #f8fafc; }
  .drv-route-opt.selected { border-color: #0f172a; background: #f8fafc; }
  .drv-route-opt-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .drv-route-label { font-size: 13px; font-weight: 700; color: #0f172a; }
  .drv-route-price { font-size: 16px; font-weight: 800; color: #0f172a; }
  .drv-route-meta { display: flex; gap: 10px; font-size: 12px; color: #64748b; }
  .drv-map { width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 14px; border: 1px solid #e2e8f0; touch-action: pan-x pan-y; }
  .drv-divider { border: none; border-top: 1px solid #f1f5f9; margin: 16px 0; }
  .drv-planning-slot { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
  .drv-planning-time { font-size: 12px; color: #64748b; min-width: 40px; padding-top: 3px; }
  .drv-planning-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
  .drv-planning-card { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
  @media (max-width: 380px) {
    .drv-time { font-size: 18px; }
    .drv-stat-val { font-size: 20px; }
  }

`;

// ── Icons ──────────────────────────────────────────────────────────────────
const IconBell = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IconCalendar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconStar = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconChart = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconUsers = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
function Stars({ n }: { n: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "drv-stars" : "drv-stars-empty"}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

// ── Main component ─────────────────────────────────────────────────────────
function DriverPage() {
  const { token } = Route.useSearch();

  useEffect(() => {
    if (token === DRIVER_TOKEN) {
      localStorage.setItem("driver_token", token);
    }
  }, [token]);

  const savedToken = typeof window !== "undefined" ? localStorage.getItem("driver_token") : null;
  const validToken = token === DRIVER_TOKEN || savedToken === DRIVER_TOKEN;

  if (!validToken) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          fontFamily: "DM Sans,sans-serif",
          color: "#64748b",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Accès non autorisé</div>
        </div>
      </div>
    );
  }

  return <DriverApp />;
}

function DriverApp() {
  const [tab, setTab] = useState<Tab>("courses");
  const [newCount, setNewCount] = useState(0);
  const [pendingAvis, setPendingAvis] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const { status: pushStatus, subscribe: subscribePush } = usePushNotifications({ autoAudience: "chauffeur" });

  // Capture le prompt d'installation PWA
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Force le manifest driver au runtime (remplace le manifest global)
  useEffect(() => {
    const existing = document.querySelector('link[rel="manifest"]');
    if (existing) existing.setAttribute("href", "/api/manifest?role=driver");
    else {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/api/manifest?role=driver";
      document.head.appendChild(link);
    }
    return () => {
      const el = document.querySelector('link[rel="manifest"]');
      if (el) el.setAttribute("href", "/manifest.json");
    };
  }, []);

  // Rafraîchit le token FCM à chaque reprise de la page (iOS révoque souvent le token)
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") subscribePush("chauffeur");
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [subscribePush]);

  // Rafraîchissement badge courses
  useEffect(() => {
    const load = async () => {
      const { count } = await (supabase as any)
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setNewCount(count ?? 0);
    };
    load();
    const ch = (supabase as any)
      .channel("drv-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Badge avis en attente
  useEffect(() => {
    const load = async () => {
      const { count } = await (supabase as any)
        .from("avis")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingAvis(count ?? 0);
    };
    load();
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="drv-root">
        <div className="drv-header">
          <span style={{ fontSize: 26 }}>🚕</span>
          <h1>Espace José</h1>
          {installPrompt && (
            <button
              onClick={async () => {
                installPrompt.prompt();
                const r = await installPrompt.userChoice;
                if (r.outcome === "accepted") setInstallPrompt(null);
              }}
              style={{
                flexShrink: 0,
                background: "#0ea5e9",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📲 Installer
            </button>
          )}
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#cbd5e1",
              fontSize: 11,
              textDecoration: "none",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "8px 10px",
              flexShrink: 0,
              minHeight: 30,
            }}
          >
            ↩ Site
          </a>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>

        {/* Bandeau activation notifications */}
        {(pushStatus === "idle" || pushStatus === "denied" || pushStatus === "granted") && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              background: pushStatus === "denied" ? "#fef2f2" : pushStatus === "granted" ? "#f0fdf4" : "#eff6ff",
              borderBottom: "1px solid #e2e8f0",
              padding: "10px 16px",
              fontSize: 12.5,
              color: pushStatus === "denied" ? "#b91c1c" : pushStatus === "granted" ? "#15803d" : "#1d4ed8",
            }}
          >
            <span>
              {pushStatus === "denied"
                ? "🔕 Notifications bloquées — active-les dans les réglages."
                : pushStatus === "granted"
                  ? "🔔 Notifications actives"
                  : "🔔 Active les notifications pour ne rater aucune nouvelle course."}
            </span>
            {pushStatus !== "denied" && (
              <button
                onClick={() => subscribePush("chauffeur")}
                style={{
                  flexShrink: 0,
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {pushStatus === "granted" ? "🔄 Ré-activer" : "Activer"}
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="drv-tabs">
          {(["courses", "planning", "avis", "clients", "stats"] as Tab[]).map((t) => (
            <button key={t} className={`drv-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              <div style={{ position: "relative", display: "inline-block" }}>
                {t === "courses" && (
                  <>
                    <IconBell />
                    {newCount > 0 && <span className="drv-badge">{newCount}</span>}
                  </>
                )}
                {t === "planning" && <IconCalendar />}
                {t === "avis" && (
                  <>
                    <IconStar />
                    {pendingAvis > 0 && <span className="drv-badge">{pendingAvis}</span>}
                  </>
                )}
                {t === "clients" && <IconUsers />}
                {t === "stats" && <IconChart />}
              </div>
              <span>
                {{ courses: "Courses", planning: "Planning", avis: "Avis", clients: "Clients", stats: "Stats" }[t]}
              </span>
            </button>
          ))}
        </div>

        <div className="drv-body">
          {tab === "courses" && <CoursesTab onBadgeChange={setNewCount} />}
          {tab === "planning" && <PlanningTab />}
          {tab === "avis" && <AvisTab onBadgeChange={setPendingAvis} />}
          {tab === "clients" && <ClientsTab />}
          {tab === "stats" && <StatsTab />}
        </div>
      </div>
    </>
  );
}

// ── Onglet Courses ─────────────────────────────────────────────────────────
function CoursesTab({ onBadgeChange }: { onBadgeChange: (n: number) => void }) {
  const [courses, setCourses] = useState<Resa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("reservations")
      .select(
        "id,depart,destination,date_heure,status,prix_estime,distance_km,client_name,client_phone,client_email,suivi_id",
      )
      .in("status", ["pending", "accepted"])
      .order("date_heure", { ascending: true });
    const list: Resa[] = data ?? [];
    setCourses(list);
    setLoading(false);
    onBadgeChange(list.filter((r) => r.status === "pending").length);
  }, [onBadgeChange]);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-courses")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const nouvelles = courses.filter((r) => r.status === "pending");
  const encours = courses.filter((r) => r.status === "accepted");

  if (courses.length === 0)
    return (
      <div className="drv-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune course en attente</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Tout est à jour ✓</div>
      </div>
    );

  return (
    <>
      {nouvelles.length > 0 && (
        <>
          <p className="drv-section">Nouvelles demandes</p>
          {nouvelles.map((r) => (
            <CourseCard
              key={r.id}
              resa={r}
              onRefresh={load}
              expanded={selected === r.id}
              onToggle={() => setSelected((s) => (s === r.id ? null : r.id))}
            />
          ))}
          <hr className="drv-divider" />
        </>
      )}
      {encours.length > 0 && (
        <>
          <p className="drv-section">En cours</p>
          {encours.map((r) => (
            <CourseCard
              key={r.id}
              resa={r}
              onRefresh={load}
              expanded={selected === r.id}
              onToggle={() => setSelected((s) => (s === r.id ? null : r.id))}
            />
          ))}
        </>
      )}
    </>
  );
}

// ── Course Card avec itinéraires Google Maps ───────────────────────────────
function CourseCard({
  resa,
  onRefresh,
  expanded,
  onToggle,
}: {
  resa: Resa;
  onRefresh: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const rendererRef = useRef<any>(null);

  // Charger les itinéraires quand on ouvre la carte
  useEffect(() => {
    if (!expanded || routes.length > 0) return;
    setLoadingRoutes(true);

    (async () => {
      try {
        const mapsApi = await loadGoogleMapsWhenVisible(mapRef.current!);
        const [geoA, geoB] = await Promise.all([geocodeAddress(resa.depart), geocodeAddress(resa.destination)]);
        if (!geoA || !geoB) {
          setLoadingRoutes(false);
          return;
        }

        const svc = new mapsApi.maps.DirectionsService();
        const result: any = await new Promise((res, rej) =>
          svc.route(
            {
              origin: { lat: geoA.lat, lng: geoA.lng },
              destination: { lat: geoB.lat, lng: geoB.lng },
              travelMode: mapsApi.maps.TravelMode.DRIVING,
              provideRouteAlternatives: true,
            },
            (r: any, s: any) => (s === "OK" && r ? res(r) : rej(s)),
          ),
        );

        const opts: RouteOption[] = result.routes.slice(0, 3).map((route: google.maps.DirectionsRoute, i: number) => {
          const leg = route.legs[0];
          const distKm = (leg.distance?.value ?? 0) / 1000;
          const dureeMin = Math.round((leg.duration?.value ?? 0) / 60);
          // Tarifs Bordeaux : prise en charge + €/km selon heure
          const PRISE_EN_CHARGE = 2.83;
          const TARIF_JOUR = 2.16; // 7h–19h
          const TARIF_NUIT = 3.24; // 19h–7h
          const heure = new Date(resa.date_heure).getHours();
          const estJour = heure >= 7 && heure < 19;
          const tarifKm = estJour ? TARIF_JOUR : TARIF_NUIT;
          const prix_estime = parseFloat((distKm * tarifKm + PRISE_EN_CHARGE).toFixed(2));
          const tarifLabel = estJour ? "Tarif jour ☀️" : "Tarif nuit 🌙";

          return {
            index: i,
            summary: route.summary || `Itinéraire ${i + 1}`,
            distanceKm: parseFloat(distKm.toFixed(1)),
            dureeMin,
            prix_estime,
            tarifLabel,
            legs: route.legs,
            overview_polyline:
              (route.overview_polyline as unknown as { points?: string })?.points ??
              (route.overview_polyline as unknown as string) ??
              "",
            dirResult: { ...result, routes: [route] },
          };
        });
        setRoutes(opts);
        setLoadingRoutes(false);
      } catch (e) {
        console.error("[CourseCard] routes:", e);
        setLoadingRoutes(false);
      }
    })();
  }, [expanded, resa]);

  // Afficher la route sélectionnée sur la carte
  useEffect(() => {
    if (!expanded || routes.length === 0) return;
    (async () => {
      try {
        const mapsApi = await loadGoogleMapsWhenVisible(mapRef.current!);
        if (!mapInst.current) {
          mapInst.current = new mapsApi.maps.Map(mapRef.current!, {
            zoom: 13,
            disableDefaultUI: true,
            gestureHandling: "cooperative",
            styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
          });
        }
        if (!rendererRef.current) {
          rendererRef.current = new mapsApi.maps.DirectionsRenderer({
            suppressMarkers: false,
            polylineOptions: { strokeColor: "#0f172a", strokeWeight: 5 },
          });
          rendererRef.current.setMap(mapInst.current);
        }
        const chosen = routes[selectedRoute];
        if (chosen) rendererRef.current.setDirections(chosen.dirResult);
      } catch {}
    })();
  }, [expanded, routes, selectedRoute]);

  const statusLabel: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "drv-badge-blue" },
    accepted: { label: "Acceptée", cls: "drv-badge-green" },
    en_route: { label: "En route", cls: "drv-badge-amber" },
    arrived: { label: "Arrivé", cls: "drv-badge-amber" },
  };
  const st = statusLabel[resa.status] ?? { label: resa.status, cls: "drv-badge-gray" };

  const handleAccept = async () => {
    setBusy(true);
    try {
      const chosen = routes[selectedRoute];
      const updates: any = { status: "accepted" };
      if (chosen) {
        updates.distance_km = chosen.distanceKm;
        updates.prix_estime = chosen.prix_estime;
      }
      const { error } = await (supabase as any).from("reservations").update(updates).eq("id", resa.id);
      if (error) throw error;
      toast.success("Course acceptée ✓");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleRefuse = async () => {
    if (!confirm("Refuser cette course ?")) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("reservations").update({ status: "cancelled" }).eq("id", resa.id);
      if (error) throw error;
      toast("Course refusée");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // ── Mettre à jour l'itinéraire d'une course déjà acceptée ──
  const [itinSaving, setItinSaving] = useState(false);
  const handleUpdateItineraire = async () => {
    const chosen = routes[selectedRoute];
    if (!chosen) {
      toast.error("Sélectionne d'abord un itinéraire ci-dessus");
      return;
    }
    setItinSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("reservations")
        .update({ distance_km: chosen.distanceKm, prix_estime: chosen.prix_estime })
        .eq("id", resa.id);
      if (error) throw error;
      toast.success(`Itinéraire mis à jour — ${chosen.distanceKm} km · ${chosen.prix_estime.toFixed(2)} €`);
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setItinSaving(false);
    }
  };

  // ── Prix custom — SMS / WhatsApp / Email ──
  const [customPrix, setCustomPrix] = useState("");
  const [customPrixOpen, setCustomPrixOpen] = useState(false);
  const [customPrixSending, setCustomPrixSending] = useState(false);
  const handleSendCustomPrix = async (canal: "sms" | "whatsapp" | "email") => {
    const val = parseFloat((customPrix || "").trim().replace(",", "."));
    if (!customPrix || isNaN(val) || val <= 0) {
      toast.error("Prix invalide", { description: "Entrez un montant valide (ex: 18.50)" });
      return;
    }
    const name = resa.client_name || "Client";
    const phone = (resa.client_phone || "").replace(/\s/g, "");
    const email = resa.client_email || resa.email || "";
    const trajet = `${resa.depart} → ${resa.destination || "—"}`;
    const trackUrl =
      resa.suivi_id && typeof window !== "undefined" ? `${window.location.origin}/suivi/${resa.suivi_id}` : "";
    const trackingLine = trackUrl ? `\nRetrouvez votre course ici : ${trackUrl}` : "";
    const msg = `Bonjour ${name}, le prix de votre course Taxi City Bordeaux (${trajet}) est de ${val.toFixed(2)} €. Merci.${trackingLine}`;

    if (canal === "sms") {
      if (!phone) {
        toast.error("Pas de téléphone");
        return;
      }
      window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, "_blank");
    } else if (canal === "whatsapp") {
      if (!phone) {
        toast.error("Pas de téléphone");
        return;
      }
      window.open(`https://wa.me/${phone.replace(/^0/, "33")}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      if (!email) {
        toast.error("Pas d'email");
        return;
      }
      setCustomPrixSending(true);
      try {
        const res = await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
          body: JSON.stringify({
            templateName: "custom-price",
            recipientEmail: email,
            idempotencyKey: `custom-price-${resa.id}-${Date.now()}`,
            templateData: {
              nom: name,
              depart: resa.depart,
              arrivee: resa.destination || "—",
              prix: `${val.toFixed(2)} €`,
              distance_km: resa.distance_km ? `${resa.distance_km} km` : undefined,
            },
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          toast.error(errBody?.error || "Échec envoi email");
        } else {
          toast.success(`✉️ Email envoyé à ${email}`);
        }
      } catch (e: any) {
        toast.error("Erreur réseau", { description: e?.message ?? "" });
      } finally {
        setCustomPrixSending(false);
      }
    }
    await (supabase as any).from("reservations").update({ prix_estime: val }).eq("id", resa.id);
    onRefresh();
  };

  // ── Reprogrammer l'heure ──
  const [newDatetime, setNewDatetime] = useState("");
  const [changeHeureOpen, setChangeHeureOpen] = useState(false);
  const [changeHeureSending, setChangeHeureSending] = useState(false);
  const handleChangeHeure = async () => {
    if (!newDatetime) return;
    setChangeHeureSending(true);
    try {
      const { error } = await (supabase as any)
        .from("reservations")
        .update({ date_heure: newDatetime })
        .eq("id", resa.id);
      if (error) throw error;
      const email = resa.client_email || resa.email;
      const name = resa.client_name || "Client";
      if (email) {
        try {
          await fetch("/api/admin/send-course-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
            body: JSON.stringify({
              templateName: "reschedule",
              recipientEmail: email,
              idempotencyKey: `reschedule-${resa.id}-${Date.now()}`,
              templateData: {
                nom: name,
                depart: resa.depart,
                arrivee: resa.destination || "—",
                old_datetime: formatDate(resa.date_heure) + " " + formatHeure(resa.date_heure),
                new_datetime: formatDate(newDatetime) + " " + formatHeure(newDatetime),
              },
            }),
          });
          toast.success("🕐 Heure modifiée · ✉️ Email envoyé");
        } catch {
          toast.success("🕐 Heure modifiée · ⚠️ Email non envoyé");
        }
      } else {
        toast.success("🕐 Heure modifiée");
      }
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setChangeHeureSending(false);
    }
  };

  // ── Terminer la course ──
  const [completing, setCompleting] = useState(false);
  const handleComplete = async () => {
    if (!confirm("Marquer cette course comme terminée ?")) return;
    setCompleting(true);
    try {
      const { error } = await (supabase as any).from("reservations").update({ status: "completed" }).eq("id", resa.id);
      if (error) throw error;
      toast.success("🏁 Course terminée");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setCompleting(false);
    }
  };

  // ── Progression de statut ──
  const [progressing, setProgressing] = useState(false);
  const handleProgressStatus = async (nextStatus: string, label: string) => {
    setProgressing(true);
    try {
      const { error } = await (supabase as any).from("reservations").update({ status: nextStatus }).eq("id", resa.id);
      if (error) throw error;
      toast.success(label);
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setProgressing(false);
    }
  };

  // ── Supprimer la course ──
  const [deleting, setDeleting] = useState(false);
  const handleDeleteResa = async () => {
    if (!confirm("Supprimer définitivement cette course ? Action irréversible.")) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from("reservations").delete().eq("id", resa.id);
      if (error) throw error;
      toast.success("Course supprimée");
      onRefresh();
    } catch (e: any) {
      toast.error("Suppression impossible : " + (e.message ?? e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`drv-card${resa.status === "pending" ? " new" : ""}`}>
      {/* En-tête */}
      <div className="drv-row" style={{ cursor: "pointer" }} onClick={onToggle}>
        <span className="drv-time">{formatHeure(resa.date_heure)}</span>
        <span className={`drv-badge-pill ${st.cls}`}>{st.label}</span>
      </div>
      {resa.client_name && <div className="drv-name">{resa.client_name}</div>}
      <div className="drv-route">
        <span>📍 {resa.depart}</span>
        <span>🏁 {resa.destination}</span>
      </div>

      {/* Résumé km/prix si déjà calculé */}
      {(resa.distance_km || resa.prix_estime) && (
        <div className="drv-meta">
          {resa.distance_km && <span>🛣 {resa.distance_km} km</span>}
          {resa.prix_estime && <span>💶 {resa.prix_estime.toFixed(2)} €</span>}
        </div>
      )}

      {/* Détail expandable */}
      {expanded && (
        <>
          <hr className="drv-divider" />

          {/* Carte Google Maps */}
          <div className="drv-map" ref={mapRef} />

          {/* Itinéraires */}
          {loadingRoutes && (
            <div style={{ textAlign: "center", fontSize: 13, color: "#64748b", padding: "10px 0" }}>
              Calcul des itinéraires…
            </div>
          )}

          {routes.length > 0 && (
            <>
              <p className="drv-section">Choisir un itinéraire</p>
              {routes.map((r, i) => (
                <div
                  key={i}
                  className={`drv-route-opt${selectedRoute === i ? " selected" : ""}`}
                  onClick={() => {
                    setSelectedRoute(i);
                    // Mise à jour automatique en base dès la sélection
                    (supabase as any)
                      .from("reservations")
                      .update({ distance_km: r.distanceKm, prix_estime: r.prix_estime })
                      .eq("id", resa.id)
                      .then(({ error }: any) => {
                        if (error) toast.error("Erreur mise à jour itinéraire");
                        else {
                          toast.success(`Itinéraire sélectionné — ${r.distanceKm} km · ${r.prix_estime.toFixed(2)} €`);
                          onRefresh();
                        }
                      });
                  }}
                >
                  <div className="drv-route-opt-head">
                    <span className="drv-route-label">
                      {i === 0 ? "🏆 Recommandé" : i === 1 ? "🔀 Alternatif" : "⏱ Rapide"} — {r.summary}
                    </span>
                    <span className="drv-route-price">{r.prix_estime.toFixed(2)} €</span>
                  </div>
                  <div className="drv-route-meta">
                    <span>🛣 {r.distanceKm} km</span>
                    <span>⏱ {r.dureeMin} min</span>
                    <span style={{ color: r.tarifLabel === "Tarif jour" ? "#15803d" : "#1d4ed8" }}>{r.tarifLabel}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Contact — tel / SMS / WhatsApp / Email, identique à l'admin */}
          {(resa.status === "accepted" || resa.status === "en_route" || resa.status === "arrived") &&
            (() => {
              const phone = resa.client_phone;
              const mail = resa.client_email || resa.email;
              const trackUrl =
                resa.suivi_id && typeof window !== "undefined"
                  ? `${window.location.origin}/suivi/${resa.suivi_id}`
                  : "";
              const greet = `Bonjour ${resa.client_name || ""}, votre taxi Taxi City Bordeaux.`;
              const body = trackUrl ? `${greet}\nRetrouvez votre course ici : ${trackUrl}` : greet;
              const mailBody = trackUrl
                ? `Bonjour ${resa.client_name || ""},\n\nVoici le lien pour retrouver et suivre votre course en temps réel :\n${trackUrl}\n\nTaxi City Bordeaux`
                : `Bonjour ${resa.client_name || ""},\n\nTaxi City Bordeaux`;
              if (!phone && !mail) return null;
              const contactBtn: React.CSSProperties = {
                flex: "1 1 auto",
                minWidth: 78,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px",
                fontWeight: 700,
                fontSize: 12.5,
                textDecoration: "none",
                color: "#0f172a",
              };
              return (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {phone && (
                    <>
                      <a
                        href={`tel:${phone}`}
                        style={{ ...contactBtn, background: "#eff6ff", borderColor: "#bfdbfe", color: "#0369a1" }}
                      >
                        📞 Appeler
                      </a>
                      <a
                        href={`sms:${phone}?body=${encodeURIComponent(body)}`}
                        style={{ ...contactBtn, background: "#faf5ff", borderColor: "#e9d5ff", color: "#7e22ce" }}
                      >
                        💬 SMS
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...contactBtn, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }}
                      >
                        🟢 WhatsApp
                      </a>
                    </>
                  )}
                  {mail && (
                    <a
                      href={`mailto:${mail}?subject=${encodeURIComponent("Votre course Taxi City Bordeaux")}&body=${encodeURIComponent(mailBody)}`}
                      style={{ ...contactBtn, background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
                    >
                      ✉️ Email
                    </a>
                  )}
                </div>
              );
            })()}

          {/* Gestion avancée — visible une fois la course acceptée */}
          {(resa.status === "accepted" || resa.status === "en_route" || resa.status === "arrived") && (
            <>
              {/* Prix custom */}
              <button
                onClick={() => setCustomPrixOpen((o) => !o)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                  marginBottom: customPrixOpen ? 8 : 10,
                }}
              >
                💶 {customPrixOpen ? "▲" : "▼"} Envoyer un prix personnalisé
              </button>
              {customPrixOpen && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 18.50"
                    value={customPrix}
                    onChange={(e) => setCustomPrix(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 16,
                      marginBottom: 8,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleSendCustomPrix("sms")}
                      disabled={customPrixSending}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: "#faf5ff",
                        border: "1px solid #e9d5ff",
                        color: "#7e22ce",
                        borderRadius: 10,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      💬 SMS
                    </button>
                    <button
                      onClick={() => handleSendCustomPrix("whatsapp")}
                      disabled={customPrixSending}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#15803d",
                        borderRadius: 10,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🟢 WhatsApp
                    </button>
                    <button
                      onClick={() => handleSendCustomPrix("email")}
                      disabled={customPrixSending}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        borderRadius: 10,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {customPrixSending ? "…" : "✉️ Email"}
                    </button>
                  </div>
                </div>
              )}

              {/* Reprogrammer l'heure */}
              <button
                onClick={() => setChangeHeureOpen((o) => !o)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                  marginBottom: changeHeureOpen ? 8 : 10,
                }}
              >
                🕐 {changeHeureOpen ? "▲" : "▼"} Reprogrammer l'heure
              </button>
              {changeHeureOpen && (
                <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
                  <input
                    type="datetime-local"
                    value={newDatetime}
                    onChange={(e) => setNewDatetime(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      fontSize: 16,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <button
                    onClick={handleChangeHeure}
                    disabled={changeHeureSending || !newDatetime}
                    className="drv-btn-primary"
                    style={{ flex: "0 0 auto", padding: "10px 16px" }}
                  >
                    {changeHeureSending ? "…" : "OK"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          {resa.status === "pending" && (
            <div className="drv-btns">
              <button className="drv-btn-danger" onClick={handleRefuse} disabled={busy}>
                Refuser
              </button>
              <button className="drv-btn-primary" onClick={handleAccept} disabled={busy}>
                {busy ? "…" : "Accepter"}
              </button>
            </div>
          )}
          {resa.status === "accepted" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(resa.depart)}&destination=${encodeURIComponent(resa.destination)}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: "block",
                    textAlign: "center",
                    background: "#f1f5f9",
                    color: "#0f172a",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "12px 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  🗺 Itinéraires
                </a>
                <button
                  onClick={() => {
                    const dest = encodeURIComponent(resa.destination);
                    const orig = encodeURIComponent(resa.depart);
                    const ua = navigator.userAgent;
                    const isIOS = /iPad|iPhone|iPod/.test(ua);
                    const isAndroid = /Android/.test(ua);
                    if (isIOS) {
                      const gmaps = `comgooglemaps://?saddr=${orig}&daddr=${dest}&directionsmode=driving`;
                      const apple = `maps://maps.apple.com/?saddr=${orig}&daddr=${dest}&dirflg=d`;
                      window.location.href = gmaps;
                      setTimeout(() => {
                        window.location.href = apple;
                      }, 1500);
                    } else if (isAndroid) {
                      window.location.href = `google.navigation:q=${dest}`;
                    } else {
                      // PC — lien web Google Maps avec navigation
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=driving&dir_action=navigate`,
                        "_blank",
                      );
                    }
                  }}
                  style={{
                    flex: 2,
                    display: "block",
                    textAlign: "center",
                    background: "#0f172a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  🚗 Démarrer GPS
                </button>
              </div>
              <button
                onClick={() => handleProgressStatus("en_route", "🚕 En route !")}
                disabled={progressing}
                style={{
                  width: "100%",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  borderRadius: 12,
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                {progressing ? "…" : "🚕 Passer en route"}
              </button>
            </>
          )}

          {resa.status === "en_route" && (
            <button
              onClick={() => handleProgressStatus("arrived", "📍 Arrivé !")}
              disabled={progressing}
              style={{
                width: "100%",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
                borderRadius: 12,
                padding: "11px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {progressing ? "…" : "📍 Marquer arrivé"}
            </button>
          )}

          {(resa.status === "en_route" || resa.status === "arrived") && (
            <button
              onClick={handleComplete}
              disabled={completing}
              style={{
                width: "100%",
                background: "#f0fdf4",
                border: "2px solid #16a34a",
                color: "#15803d",
                borderRadius: 12,
                padding: "12px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {completing ? "…" : "🏁 Course terminée"}
            </button>
          )}

          {/* Supprimer définitivement */}
          <button
            onClick={handleDeleteResa}
            disabled={deleting}
            style={{
              width: "100%",
              marginTop: 4,
              background: "none",
              border: "none",
              color: "#b91c1c",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              padding: "6px 0",
            }}
          >
            {deleting ? "Suppression…" : "🗑 Supprimer cette course"}
          </button>
        </>
      )}

      {/* Toggle */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          marginTop: 8,
          background: "none",
          border: "none",
          color: "#94a3b8",
          fontSize: 12,
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        {expanded ? "▲ Réduire" : "▼ Voir détails & itinéraires"}
      </button>
    </div>
  );
}

// ── Onglet Planning ────────────────────────────────────────────────────────
function PlanningTab() {
  const [courses, setCourses] = useState<Resa[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data } = await (supabase as any)
      .from("reservations")
      .select("id,depart,destination,date_heure,status,prix_estime,distance_km")
      .gte("date_heure", today.toISOString())
      .lt("date_heure", tomorrow.toISOString())
      .not("status", "eq", "cancelled")
      .order("date_heure", { ascending: true });
    setCourses(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-planning")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const dotColor: Record<string, string> = {
    terminee: "#94a3b8",
    completed: "#94a3b8",
    pending: "#f59e0b",
    accepted: "#22c55e",
    en_route: "#3b82f6",
    arrived: "#3b82f6",
  };

  return (
    <>
      <p className="drv-section">
        Aujourd'hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      {courses.length === 0 ? (
        <div className="drv-empty">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune course aujourd'hui</div>
        </div>
      ) : (
        courses.map((r) => (
          <div key={r.id} className="drv-planning-slot">
            <span className="drv-planning-time">{formatHeure(r.date_heure)}</span>
            <div className="drv-planning-dot" style={{ background: dotColor[r.status] ?? "#94a3b8" }} />
            <div
              className={`drv-planning-card${["terminee", "completed"].includes(r.status) ? " done" : ""}`}
              style={{ opacity: ["terminee", "completed"].includes(r.status) ? 0.5 : 1 }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                {r.depart} → {r.destination}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {r.distance_km ? `${r.distance_km} km · ` : ""}
                {r.prix_estime ? `${r.prix_estime.toFixed(2)} €` : ""}
                {["terminee", "completed"].includes(r.status) ? " · Terminée" : ""}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ── Onglet Avis ────────────────────────────────────────────────────────────
function AvisTab({ onBadgeChange }: { onBadgeChange: (n: number) => void }) {
  const [pending, setPending] = useState<Avis[]>([]);
  const [published, setPublished] = useState<Avis[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: p }, { data: pub }] = await Promise.all([
      (supabase as any).from("avis").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      (supabase as any)
        .from("avis")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setPending(p ?? []);
    setPublished(pub ?? []);
    onBadgeChange((p ?? []).length);
  }, [onBadgeChange]);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-avis")
      .on("postgres_changes", { event: "*", schema: "public", table: "avis" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const moderate = async (id: string, action: "approved" | "refused") => {
    setBusy(id);
    try {
      const { error } = await (supabase as any).from("avis").update({ status: action }).eq("id", id);
      if (error) throw error;
      toast.success(action === "approved" ? "Avis publié ✓" : "Avis refusé");
      load();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const removeAvis = async (id: string) => {
    if (!confirm("Supprimer définitivement cet avis ?")) return;
    setBusy(id);
    try {
      const { error } = await (supabase as any).from("avis").delete().eq("id", id);
      if (error) throw error;
      toast.success("Avis supprimé");
      load();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const avgNote =
    published.length > 0 ? (published.reduce((s, a) => s + a.note, 0) / published.length).toFixed(1) : null;

  return (
    <>
      {pending.length > 0 && (
        <>
          <p className="drv-section">À modérer ({pending.length})</p>
          {pending.map((a) => (
            <div key={a.id} className="drv-card pending">
              <div className="drv-row">
                <span className="drv-name">{a.author_name || "Anonyme"}</span>
                <span className="drv-badge-pill drv-badge-amber">En attente</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <Stars n={a.note} />
              </div>
              <p style={{ fontSize: 13, color: "#334155", margin: "0 0 12px", lineHeight: 1.5 }}>"{a.commentaire}"</p>
              <div className="drv-btns">
                <button className="drv-btn-danger" disabled={!!busy} onClick={() => moderate(a.id, "refused")}>
                  {busy === a.id ? "…" : "Refuser"}
                </button>
                <button className="drv-btn-primary" disabled={!!busy} onClick={() => moderate(a.id, "approved")}>
                  {busy === a.id ? "…" : "Publier sur le site"}
                </button>
              </div>
            </div>
          ))}
          <hr className="drv-divider" />
        </>
      )}

      <p className="drv-section">Avis publiés</p>
      {published.length === 0 ? (
        <div className="drv-empty">
          <div style={{ fontSize: 13 }}>Aucun avis publié</div>
        </div>
      ) : (
        <>
          {published.map((a) => (
            <div key={a.id} className="drv-card" style={{ opacity: 0.75 }}>
              <div className="drv-row">
                <span className="drv-name">{a.author_name || "Anonyme"}</span>
                <span className="drv-badge-pill drv-badge-green">Publié</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <Stars n={a.note} />
              </div>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 8px", lineHeight: 1.5 }}>"{a.commentaire}"</p>
              <button
                onClick={() => removeAvis(a.id)}
                disabled={busy === a.id}
                style={{
                  background: "none",
                  border: "none",
                  color: "#b91c1c",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {busy === a.id ? "…" : "🗑 Supprimer"}
              </button>
            </div>
          ))}
          {avgNote && (
            <div style={{ textAlign: "center", marginTop: 20, padding: "16px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Note moyenne publiée</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#0f172a" }}>{avgNote}</div>
              <div style={{ fontSize: 22, color: "#f59e0b" }}>★★★★★</div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Onglet Clients ──────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<ClientAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [{ data }, { data: clientsRows }] = await Promise.all([
      (supabase as any)
        .from("reservations")
        .select("client_name,client_phone,destination,prix_estime,date_heure,status")
        .not("client_phone", "is", null)
        .order("date_heure", { ascending: false }),
      (supabase as any).from("clients").select("id,phone"),
    ]);

    const normalize = (p: string) => p.replace(/[^0-9]/g, "").replace(/^0/, "33");
    const idByPhone = new Map<string, string>();
    for (const c of (clientsRows ?? []) as any[]) {
      if (c.phone) idByPhone.set(normalize(c.phone), c.id);
    }

    const rows: any[] = data ?? [];
    const byPhone = new Map<string, ClientAgg>();
    for (const r of rows) {
      const phone = r.client_phone;
      if (!phone) continue;
      const existing = byPhone.get(phone);
      const isCompleted = ["terminee", "completed"].includes(r.status);
      if (!existing) {
        byPhone.set(phone, {
          id: idByPhone.get(normalize(phone)),
          phone,
          name: r.client_name || "Client",
          nbCourses: isCompleted ? 1 : 0,
          totalDepense: isCompleted ? (r.prix_estime ?? 0) : 0,
          derniereCourse: r.date_heure,
          derniereDestination: r.destination,
        });
      } else {
        if (isCompleted) {
          existing.nbCourses += 1;
          existing.totalDepense += r.prix_estime ?? 0;
        }
        if (r.date_heure > existing.derniereCourse) {
          existing.derniereCourse = r.date_heure;
          existing.derniereDestination = r.destination;
        }
        if (!existing.name || existing.name === "Client") existing.name = r.client_name || existing.name;
      }
    }

    setClients(Array.from(byPhone.values()).sort((a, b) => b.derniereCourse.localeCompare(a.derniereCourse)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);
  const removeClient = async (c: ClientAgg) => {
    if (!confirm(`Supprimer ${c.name} et toutes ses courses ? Action irréversible.`)) return;
    setDeletingPhone(c.phone);
    try {
      const normalize = (p: string) => p.replace(/[^0-9]/g, "").replace(/^0/, "33");
      const target = normalize(c.phone);
      const { data: allResas } = await (supabase as any).from("reservations").select("id,client_phone,telephone");
      const idsToDelete = (allResas ?? [])
        .filter((r: any) => {
          const p1 = r.client_phone ? normalize(r.client_phone) : "";
          const p2 = r.telephone ? normalize(r.telephone) : "";
          return p1 === target || p2 === target;
        })
        .map((r: any) => r.id);
      if (idsToDelete.length > 0) {
        await (supabase as any).from("avis").update({ reservation_id: null }).in("reservation_id", idsToDelete);
        const { error: delErr } = await (supabase as any).from("reservations").delete().in("id", idsToDelete);
        if (delErr) throw delErr;
      }
      if (c.id) {
        const { error } = await (supabase as any).from("clients").delete().eq("id", c.id);
        if (error) throw error;
      }
      toast.success("Client supprimé");
      load();
    } catch (e: any) {
      toast.error("Suppression impossible : " + (e.message ?? e));
    } finally {
      setDeletingPhone(null);
    }
  };

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const filtered = query.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query))
    : clients;

  return (
    <>
      <input
        type="text"
        placeholder="Rechercher un client…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          fontSize: 16,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 14,
          outline: "none",
        }}
      />

      {filtered.length === 0 ? (
        <div className="drv-empty">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun client trouvé</div>
        </div>
      ) : (
        filtered.map((c) => (
          <div key={c.phone} className="drv-card">
            <div className="drv-row">
              <span className="drv-name">{c.name}</span>
              <span className="drv-badge-pill drv-badge-gray">
                {c.nbCourses} course{c.nbCourses > 1 ? "s" : ""}
              </span>
            </div>
            <div className="drv-sub" style={{ marginBottom: 6 }}>
              Dernière course : {formatDate(c.derniereCourse)} → {c.derniereDestination}
            </div>
            <div className="drv-meta" style={{ margin: "8px 0 12px" }}>
              <span>💶 {c.totalDepense.toFixed(2)} € au total</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`tel:${c.phone}`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 12,
                  padding: "10px",
                  color: "#15803d",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                📞 Appeler
              </a>
              <a
                href={`sms:${c.phone}`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 12,
                  padding: "10px",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                💬 SMS
              </a>
              <a
                href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "").replace(/^0/, "33")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 12,
                  padding: "10px",
                  color: "#15803d",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                🟢 WhatsApp
              </a>
            </div>
            <button
              onClick={() => removeClient(c)}
              disabled={deletingPhone === c.phone}
              style={{
                width: "100%",
                marginTop: 8,
                background: "none",
                border: "none",
                color: "#b91c1c",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              {deletingPhone === c.phone ? "Suppression…" : "🗑 Supprimer ce client"}
            </button>
          </div>
        ))
      )}
    </>
  );
}

// ── Onglet Stats ────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState({ revenus: 0, courses: 0, km: 0, note: 0, semCourses: 0, semRevenus: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);
      monday.setHours(0, 0, 0, 0);

      const [{ data: semData }, { data: avisData }] = await Promise.all([
        (supabase as any)
          .from("reservations")
          .select("prix_estime,distance_km,date_heure")
          .gte("date_heure", monday.toISOString())
          .in("status", ["terminee", "completed"]),
        (supabase as any).from("avis").select("note").eq("status", "approved"),
      ]);

      const sem: any[] = semData ?? [];
      const revenus = sem.reduce((s: number, r: any) => s + (r.prix_estime ?? 0), 0);
      const km = sem.reduce((s: number, r: any) => s + (r.distance_km ?? 0), 0);
      const note = avisData?.length ? avisData.reduce((s: number, a: any) => s + a.note, 0) / avisData.length : 0;

      setStats({
        revenus: Math.round(revenus),
        courses: sem.length,
        km: Math.round(km),
        note: Math.round(note * 10) / 10,
        semCourses: sem.length,
        semRevenus: Math.round(revenus),
      });
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <>
      <p className="drv-section">Cette semaine</p>
      <div className="drv-stat-grid">
        <div className="drv-stat">
          <div className="drv-stat-lbl">Revenus</div>
          <div className="drv-stat-val">{stats.revenus} €</div>
          <div className="drv-stat-sub">semaine en cours</div>
        </div>
        <div className="drv-stat">
          <div className="drv-stat-lbl">Courses</div>
          <div className="drv-stat-val">{stats.courses}</div>
          <div className="drv-stat-sub">cette semaine</div>
        </div>
        <div className="drv-stat">
          <div className="drv-stat-lbl">Km parcourus</div>
          <div className="drv-stat-val">{stats.km}</div>
          <div className="drv-stat-sub">km cette semaine</div>
        </div>
        <div className="drv-stat">
          <div className="drv-stat-lbl">Note moyenne</div>
          <div className="drv-stat-val">{stats.note > 0 ? stats.note : "—"}</div>
          <div className="drv-stat-sub" style={{ color: "#f59e0b" }}>
            {stats.note > 0 ? "★ sur 5" : "Pas encore d'avis"}
          </div>
        </div>
      </div>

      {/* Barre jours de la semaine */}
      <p className="drv-section">Jours de la semaine</p>
      <div className="drv-card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, marginBottom: 6 }}>
          {days.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  flex: 1,
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  background: i === todayIdx ? "#0f172a" : "#e2e8f0",
                  minHeight: i === todayIdx ? 40 : 20,
                  alignSelf: "flex-end",
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {days.map((d, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 11,
                color: i === todayIdx ? "#0f172a" : "#94a3b8",
                fontWeight: i === todayIdx ? 700 : 400,
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Diagnostic push */}
      <PushDiagnostic />
    </>
  );
}

// ── Mini diagnostic des échecs push (remplace l'ancien lien /admin/dashboard) ──
function PushDiagnostic() {
  const fetchFailures = useServerFn(listPushFailures);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFailures({ data: { pin: DRIVER_TOKEN, only_price_update: false, limit: 30 } });
      setRows((res as any)?.failures ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && rows.length === 0) load();
        }}
        style={{
          width: "100%",
          textAlign: "center",
          background: "none",
          border: "none",
          color: "#94a3b8",
          fontSize: 12,
          cursor: "pointer",
          padding: "8px 0",
        }}
      >
        {open ? "▲ Masquer le diagnostic push" : "▼ Diagnostic notifications push"}
      </button>
      {open && (
        <div className="drv-card">
          {loading ? (
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>Chargement…</div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>Aucun échec récent ✨</div>
          ) : (
            rows.map((r: any) => (
              <div key={r.id} style={{ fontSize: 11.5, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: 600 }}>
                  <span>
                    {r.audience} · {r.http_status ?? "—"} {r.error_code ?? ""}
                  </span>
                  <span style={{ color: "#94a3b8" }}>
                    {new Date(r.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div style={{ color: "#64748b" }}>{r.title ?? ""}</div>
              </div>
            ))
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              marginTop: 10,
              width: "100%",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "8px",
              fontSize: 12,
              fontWeight: 700,
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            🔄 Rafraîchir
          </button>
        </div>
      )}
    </div>
  );
}
