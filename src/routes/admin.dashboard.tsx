import { createFileRoute } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, calculerPrixMixte, estJourFerieFR } from "@/lib/tarif";
import { getDistanceAndDurationKm, fetchRouteCoordinates, OSRM_DISTANCE_FACTOR } from "@/lib/osrm";
import { geocodeAddress } from "@/lib/geocode";
import { assertSuiviId, newSuiviId } from "@/lib/suivi-id";
import { CourseCardSkeleton, GpsCardSkeleton, SkeletonStyles, StatCardSkeleton } from "@/components/admin/Skeleton";
import { PushDebug } from "@/components/PushDebug";
import logo from "@/assets/logo.jpeg";

import { notifyReservationStatus } from "@/lib/push.functions";
import { getFcmToken } from "@/lib/firebase";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_TILE_OPTIONS = { attribution: "© OpenStreetMap contributors", maxZoom: 19 };
const BORDEAUX_CENTER_GPS = { lat: 44.8378, lng: -0.5792 };
const MAX_DRIVER_GPS_ACCURACY_M = 1500;
const MAX_DRIVER_GPS_DISTANCE_FROM_BORDEAUX_M = 130000;
const MAX_DRIVER_GPS_JUMP_M = 5000;

// ─── Swipe-to-delete ─────────────────────────────────────────
function SwipeDeleteRow({
  onDelete,
  disabled,
  children,
  style,
}: {
  onDelete: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const THRESHOLD = 200;

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled || deleting) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dy > 10 && Math.abs(dx) < dy) return;
    if (dx >= 0) {
      setOffset(0);
      return;
    }
    e.preventDefault();
    setOffset(Math.max(dx, -window.innerWidth));
  };
  const onTouchEnd = () => {
    if (offset < -THRESHOLD) {
      setDeleting(true);
      setOffset(-window.innerWidth);
      setTimeout(() => onDelete(), 280);
    } else {
      setOffset(0);
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, ...style }}>
      <div style={{ position: "absolute", inset: 0, background: "#0f172a", borderRadius: 20 }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            background: "linear-gradient(90deg, transparent 0%, #7f1d1d 60%, #991b1b 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 32,
            opacity: Math.min(Math.abs(offset) / 150, 1),
          }}
        >
          <span style={{ fontSize: 28 }}>🗑️</span>
        </div>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: deleting
            ? "transform 0.28s ease-in"
            : offset === 0
              ? "transform 0.3s cubic-bezier(0.25,1,0.5,1)"
              : "none",
          willChange: "transform",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
  fontFamily: "'DM Sans',sans-serif",
  fontSize: 11,
  color: "#64748b",
  letterSpacing: "0.08em",
  marginTop: 6,
};
const valCss: React.CSSProperties = {
  fontFamily: "'DM Sans',sans-serif",
  fontWeight: 800,
  fontSize: 26,
  color: "#f8fafc",
  marginTop: 4,
  fontVariantNumeric: "tabular-nums",
};

const TARIF_JOUR_LABEL = "2,16 €/km";
const TARIF_NUIT_LABEL = "3,24 €/km";

const contactBtn = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "8px 12px",
  background: `${color}1a`,
  border: `1px solid ${color}55`,
  color,
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

// Inject global mobile responsive styles into the admin dashboard
const adminMobileCss = `
  * { -webkit-tap-highlight-color: transparent; }
  @media (max-width: 640px) {
    .admin-root { padding: 12px 10px !important; }
    .admin-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
    .admin-header-title { font-size: 20px !important; }
    .admin-header-actions { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; width: 100% !important; }
    .admin-header-actions > * { display: flex !important; align-items: center !important; justify-content: center !important; min-height: 44px !important; font-size: 13px !important; padding: 8px 10px !important; }
    .admin-kpi-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .admin-stat-val { font-size: 22px !important; }
    .admin-card { padding: 12px 14px !important; border-radius: 16px !important; }
    .course-card-head { flex-direction: column !important; gap: 4px !important; align-items: flex-start !important; }
    .course-card-head-right { font-size: 12px !important; }
    .accept-refuse-btns { flex-direction: column !important; gap: 10px !important; }
    .accept-refuse-btns button { width: 100% !important; padding: 16px !important; font-size: 16px !important; justify-content: center !important; border-radius: 14px !important; }
    .status-action-btns { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .status-action-btns button { width: 100% !important; min-height: 44px !important; justify-content: center !important; }
    .gps-row { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
    .gps-btn-row { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; width: 100% !important; margin-left: 0 !important; }
    .gps-btn-row button { width: 100% !important; min-height: 44px !important; justify-content: center !important; }
    .send-prix-row { flex-direction: column !important; gap: 8px !important; }
    .send-prix-row input { width: 100% !important; font-size: 16px !important; }
    .send-prix-row button { width: 100% !important; min-height: 44px !important; justify-content: center !important; }
    .contact-btns { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .contact-btns a { justify-content: center !important; min-height: 44px !important; padding: 10px 8px !important; font-size: 12px !important; }
    .avis-actions { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .avis-actions button { width: 100% !important; min-height: 44px !important; justify-content: center !important; }
    .admin-hide-mobile { display: none !important; }
    .admin-h-title { font-size: 18px !important; }
  }
`;

const STATUS: Record<string, { bg: string; c: string; label: string }> = {
  pending: { bg: "rgba(245,158,11,0.15)", c: "#f59e0b", label: "En attente" },
  accepted: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Acceptée" },
  refused: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Refusée" },
  en_route: { bg: "rgba(245,200,66,0.15)", c: "#f5c842", label: "En route" },
  arrived: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Arrivé" },
  completed: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Terminé" },
  cancelled: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Annulée" },
};

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

function formatParis(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...opts });
}

function isNuit(iso: string): boolean {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  const h = parseInt(get("hour"), 10) % 24;
  const wd = get("weekday");
  // Dimanche ou jour férié = nuit toute la journée
  if (wd === "Sun") return true;
  if (estJourFerieFR(y, m, d)) return true;
  // Sinon : 19h–7h = nuit
  return h >= 19 || h < 7;
}

const normalizeStatus = (s: unknown): "pending" | "accepted" | "refused" => {
  if (s === "accepted") return "accepted";
  if (s === "refused") return "refused";
  return "pending";
};

type ItineraryAlt = { label: string; km: number; prix: number; coords: [number, number][] };

const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocodeForRoute(address: string) {
  const trimmed = address.trim();
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const short = parts.slice(0, 2).join(", ");
  const attempts = [trimmed, short, `${short}, France`, `${parts[0]}, Bordeaux, France`, `${parts[0]}, France`].filter(
    (v, i, arr) => v.length > 3 && arr.indexOf(v) === i,
  );
  for (const query of attempts) {
    const coord = await geocodeAddress(query);
    if (coord) return coord;
  }
  return null;
}

function detourPoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }, strengthKm: number) {
  const midLat = (a.lat + b.lat) / 2;
  const midLng = (a.lng + b.lng) / 2;
  const dx = (b.lng - a.lng) * Math.cos(toRad(midLat));
  const dy = b.lat - a.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const side = a.lng <= b.lng ? 1 : -1;
  const normalX = (-dy / len) * side;
  const normalY = (dx / len) * side;
  return {
    lat: midLat + (normalY * strengthKm) / 111,
    lng: midLng + (normalX * strengthKm) / (111 * Math.cos(toRad(midLat)) || 1),
  };
}

function routeToAlt(route: any, label: string, pickupIso: string): ItineraryAlt | null {
  const points = route?.geometry?.coordinates;
  if (!Array.isArray(points) || points.length < 2 || !route?.distance) return null;
  // Distance brute OSRM en km — le facteur correctif est appliqué après tri (court/long)
  const km = parseFloat((route.distance / 1000).toFixed(2));
  const prix = calculerPrixMixte(km, pickupIso);
  return {
    label,
    km,
    prix: parseFloat(prix.toFixed(2)),
    coords: points.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
  };
}

function fallbackItineraries(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  pickupIso: string,
  baseCoords: [number, number][] = [],
  baseKm?: number,
): ItineraryAlt[] {
  const courtKm = baseKm ?? Math.round(haversineKm(a, b) * 1.3);
  const longKm = Math.round((courtKm * 16) / 14); // ratio 14/16 entre court et long

  // Pour le tracé long : on décale légèrement les points intermédiaires
  // pour simuler visuellement un itinéraire différent (+0.001° lat sur les points du milieu)
  const longCoords: [number, number][] = baseCoords.map((pt, i) => {
    if (i === 0 || i === baseCoords.length - 1) return pt;
    const ratio = i / (baseCoords.length - 1);
    const bump = Math.sin(ratio * Math.PI) * 0.003; // arc léger
    return [pt[0] + bump, pt[1]] as [number, number];
  });

  return [
    {
      label: "🟢 Court",
      km: courtKm,
      prix: parseFloat(calculerPrixMixte(courtKm, pickupIso).toFixed(2)),
      coords: baseCoords,
    },
    {
      label: "🔴 Long",
      km: longKm,
      prix: parseFloat(calculerPrixMixte(longKm, pickupIso).toFixed(2)),
      coords: longCoords.length ? longCoords : baseCoords,
    },
  ];
}

// ─── Section header ───
function SectionHeader({
  color,
  label,
  count,
  borderColor,
}: {
  color: string;
  label: string;
  count: number;
  borderColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          boxShadow: `0 0 8px ${color}99`,
        }}
      />
      <h3
        style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 15,
          fontWeight: 800,
          color,
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </h3>
      <span
        style={{
          background: `${color}26`,
          color,
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function Dashboard() {
  // ── KPI stats ──
  const [caJ, setCaJ] = useState(0);
  const [caM, setCaM] = useState(0);
  const [coursesJ, setCoursesJ] = useState(0);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [visitors, setVisitors] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Courses ──
  const [items, setItems] = useState<any[]>([]);
  // itemsRef — toujours synchronisé avec items via l'effet ci-dessous.
  // Permet une lecture synchrone dans les callbacks GPS sans passer par
  // le pattern dangereux `new Promise(res => setItems(prev => { res(...); return prev }))`.
  const itemsRef = useRef<any[]>([]);
  // Synchronise itemsRef à chaque mise à jour de items — remplace le pattern
  // dangereux `new Promise(res => setItems(prev => { res(...); return prev }))`.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, refused: 0 });

  // ── Actions ──
  const [cardKm, setCardKm] = useState<Record<string, number>>({});
  const [cardKmLoading, setCardKmLoading] = useState<Record<string, boolean>>({});
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customPrix, setCustomPrix] = useState<Record<string, string>>({});
  const [customPrixSending, setCustomPrixSending] = useState<Record<string, boolean>>({});
  const [itinOpen, setItinOpen] = useState<Record<string, boolean>>({});
  const [itinLoading, setItinLoading] = useState<Record<string, boolean>>({});
  const [itinAlts, setItinAlts] = useState<Record<string, ItineraryAlt[]>>({});
  const [itinSaving, setItinSaving] = useState<Record<string, boolean>>({});
  const [mapModal, setMapModal] = useState<{ alt: ItineraryAlt; r: any } | null>(null);
  const [changeHeureOpen, setChangeHeureOpen] = useState<Record<string, boolean>>({});
  const [showPushDebug, setShowPushDebug] = useState(false);
  const [changeHeureValue, setChangeHeureValue] = useState<Record<string, string>>({});
  const [changeHeureSending, setChangeHeureSending] = useState<Record<string, boolean>>({});

  // ── Avis ──
  const [avis, setAvis] = useState<any[]>([]);
  const [avisLoading, setAvisLoading] = useState(true);
  const initialLoad = useRef(true);
  const fetchAllRef = useRef<() => Promise<void>>(null!);
  const fetchStatsRef = useRef<() => Promise<void>>(null!);

  // ── GPS ──
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsUpdateCount, setGpsUpdateCount] = useState(0);
  const [activeResaId, setActiveResaId] = useState<string | null>(null);
  const [autoTransition, setAutoTransition] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const activeResaIdRef = useRef<string | null>(null);
  const gpsMapRef = useRef<HTMLDivElement>(null);
  const gpsMapInst = useRef<any>(null);
  const gpsMarkerRef = useRef<any>(null);
  // ── Auto-status refs ──
  const pickupGeoRef = useRef<{ lat: number; lng: number } | null>(null); // coordonnées de la prise en charge active
  const destinationGeoRef = useRef<{ lat: number; lng: number } | null>(null); // coordonnées de la destination active
  const autoStatusFiredRef = useRef<Record<string, boolean>>({}); // évite les doubles déclenchements
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownPosRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const gpsLastSignalAtRef = useRef<number>(0);
  // FIX 🟠 : verrou pour éviter la race condition watchdog 45s / retry 8s
  const gpsRestartingRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  // Fix #2 (admin) : jeton d'annulation pour les fire-and-forget de startGPS.
  // Quand on toggle stop/start ou que le composant démonte, l'ancien jeton est invalidé
  // pour ne pas écrire dans des refs mortes après un await (geocodeForRoute).
  const startGpsTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // ── Notifications push ──
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );

  // Distance en mètres entre deux coords (Haversine simplifié)
  const distMetersGps = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x = (toRad(b.lng) - toRad(a.lng)) * Math.cos(toRad((a.lat + b.lat) / 2));
    const y = toRad(b.lat) - toRad(a.lat);
    return Math.sqrt(x * x + y * y) * R;
  };

  const getDriverGpsRejection = (
    pos: GeolocationPosition,
    lastPos: { lat: number; lng: number } | null,
  ): string | null => {
    const { latitude, longitude, accuracy: acc } = pos.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(acc)) {
      return "Position GPS invalide ignorée.";
    }
    if (acc > MAX_DRIVER_GPS_ACCURACY_M) {
      return `Signal GPS trop imprécis (±${Math.round(acc)} m). Position non envoyée.`;
    }
    if (
      distMetersGps({ lat: latitude, lng: longitude }, BORDEAUX_CENTER_GPS) > MAX_DRIVER_GPS_DISTANCE_FROM_BORDEAUX_M
    ) {
      return "Position GPS incohérente avec Bordeaux ignorée.";
    }
    if (lastPos && distMetersGps(lastPos, { lat: latitude, lng: longitude }) > MAX_DRIVER_GPS_JUMP_M) {
      return "Saut GPS anormal ignoré, attente du prochain signal fiable.";
    }
    return null;
  };

  const requestGpsWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator) || document.visibilityState !== "visible")
      return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      // FIX 🔴 : Le système peut libérer le WakeLock (appel entrant, alarme…).
      // On réacquiert automatiquement dès que la page redevient visible, tant que le GPS est actif.
      wakeLockRef.current?.addEventListener?.("release", () => {
        wakeLockRef.current = null;
        const reacquire = () => {
          if (document.visibilityState === "visible" && gpsActiveRef.current) {
            requestGpsWakeLock();
          }
          document.removeEventListener("visibilitychange", reacquire);
        };
        if (document.visibilityState === "visible" && gpsActiveRef.current) {
          requestGpsWakeLock();
        } else {
          document.addEventListener("visibilitychange", reacquire);
        }
      });
    } catch {
      wakeLockRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const releaseGpsWakeLock = useCallback(() => {
    wakeLockRef.current?.release?.()?.catch?.(() => {});
    wakeLockRef.current = null;
  }, []);

  // =========================
  // AUTO-SUBSCRIBE FCM (admin + chauffeur)
  // Ne tente l'abonnement automatique QUE si la permission est déjà accordée.
  // La première demande se fait via le bouton 🔔 dans le header (geste utilisateur requis).
  // =========================
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;

    const doSubscribe = async (fcm: string) => {
      const ua = navigator.userAgent.slice(0, 500);
      const now = new Date().toISOString();
      await Promise.all([
        supabase.from("push_subscriptions").upsert(
          {
            audience: "admin",
            endpoint: `fcm://${fcm}`,
            fcm_token: fcm,
            reservation_id: null,
            user_agent: ua,
            last_seen_at: now,
          },
          { onConflict: "endpoint" },
        ),
        supabase.from("push_subscriptions").upsert(
          {
            audience: "chauffeur",
            endpoint: `fcm://${fcm}-chauffeur`,
            fcm_token: fcm,
            reservation_id: null,
            user_agent: ua,
            last_seen_at: now,
          },
          { onConflict: "endpoint" },
        ),
      ]);
      localStorage.setItem("fcm_token", fcm);
      console.info("[push] dashboard registered — admin + chauffeur");
    };

    // Retry avec backoff exponentiel jusqu'à ce que getFcmToken réussisse
    const tryRegister = async (attempt = 0): Promise<void> => {
      if (cancelled) return;
      try {
        const fcm = await getFcmToken();
        if (!fcm) throw new Error("no_token");
        if (cancelled) return;

        const previous = localStorage.getItem("fcm_token");
        if (fcm !== previous) {
          // Token nouveau ou changé → toujours re-subscribe
          await doSubscribe(fcm);
        } else {
          // Même token : re-subscribe quand même pour rafraîchir last_seen_at
          // (évite que le token soit supprimé par une purge des tokens inactifs)
          await doSubscribe(fcm);
        }
      } catch (e) {
        console.warn("[push] auto-subscribe attempt", attempt + 1, "failed", e);
        if (attempt < 5 && !cancelled) {
          const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s, 32s
          setTimeout(() => tryRegister(attempt + 1), delay);
        }
      }
    };

    // Premier essai après 1.5s (SW Firebase a besoin d'un peu de temps au 1er load)
    const timer = setTimeout(() => tryRegister(0), 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // =========================
  // FETCH STATS
  // =========================
  const fetchStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const monthIso = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const nowIso = new Date().toISOString();
    const tomorrowIso = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const [caJR, caMR, cJR, cliR, visR] = await Promise.all([
      supabase.from("courses").select("prix_final").gte("created_at", todayIso),
      supabase.from("courses").select("prix_final").gte("created_at", monthIso),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .gte("pickup_datetime", todayIso)
        .lt("pickup_datetime", tomorrowIso)
        .neq("status", "refused"),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("site_analytics").select("session_id").eq("event", "visit").gte("created_at", todayIso),
    ]);
    setCaJ((caJR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCaM((caMR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCoursesJ(cJR.count ?? 0);
    setClientsTotal(cliR.count ?? 0);
    setVisitors(new Set((visR.data ?? []).map((v: any) => v.session_id)).size);
    setStatsLoading(false);
  }, []);

  // =========================
  // FETCH COURSES
  // =========================
  const fetchCourses = useCallback(async () => {
    const { data, error } = await supabase.from("reservations").select("*").order("created_at", { ascending: false });
    if (error) {
      setCoursesLoading(false);
      return;
    }
    const rows = data ?? [];
    setItems(rows);
    const nextCounts = { pending: 0, accepted: 0, refused: 0 };
    rows.forEach((r: any) => {
      nextCounts[normalizeStatus(r.status)]++;
    });
    setCounts(nextCounts);
    setCoursesLoading(false);
    repairMissingPrices(rows);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // FETCH AVIS
  // =========================
  const fetchAvis = useCallback(async () => {
    const { data, error } = await (supabase as any).from("avis").select("*").order("created_at", { ascending: false });
    if (!error) setAvis(data ?? []);
    setAvisLoading(false);
  }, []);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    setStatsLoading(true);
    setCoursesLoading(true);
    setAvisLoading(true);
    await Promise.all([fetchStats(), fetchCourses(), fetchAvis()]);
    setRefreshing(false);
  }, [fetchStats, fetchCourses, fetchAvis]);
  fetchAllRef.current = fetchAll;
  fetchStatsRef.current = fetchStats;

  // ── Counts dérivés des items (source unique de vérité) ──
  useEffect(() => {
    const nextCounts = { pending: 0, accepted: 0, refused: 0 };
    items.forEach((r: any) => {
      nextCounts[normalizeStatus(r.status)]++;
    });
    setCounts(nextCounts);
  }, [items]);

  // =========================
  // REALTIME
  // =========================
  useEffect(() => {
    fetchAllRef.current?.().finally(() => {
      initialLoad.current = false;
    });
    const ch = supabase
      .channel("dash-courses")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
        const n = payload.new as any;
        if (!initialLoad.current) {
          const clientName = n.client_name || n.nom || "Client";

          // 1. Son
          try {
            new Audio("/notification.mp3").play().catch(() => {});
          } catch {}

          // Le push FCM serveur prévient déjà le chauffeur/admin.
          // Ne pas créer ici de notification native locale : avec plusieurs onglets
          // ou la PWA ouverte, elle s'empile avec le push et crée des doublons.
        }
        // Insert local uniquement — pas de re-fetch global qui écrase les statuts
        if (n?.id) {
          setItems((prev) => (prev.some((item) => item.id === n.id) ? prev : [n, ...prev]));
        }
        fetchStats();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, (payload) => {
        const updated = payload.new as any;
        console.log("[RT UPDATE]", updated?.id?.slice(0, 8), "db:", updated?.status);
        if (updated?.id) {
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== updated.id) return item;
              console.log("[RT UPDATE] local:", item.status, "-> db:", updated.status);
              // Ne pas écraser un statut local plus avancé avec un statut DB plus ancien
              const rank: Record<string, number> = {
                pending: 0,
                accepted: 1,
                refused: 1,
                en_route: 2,
                arrived: 3,
                completed: 4,
                cancelled: 4,
              };
              if ((rank[item.status] ?? 0) > (rank[updated.status] ?? 0)) {
                return { ...item, ...updated, status: item.status };
              }
              return { ...item, ...updated };
            }),
          );
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_analytics" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "avis" }, () => fetchAvis())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // GPS INIT
  // =========================
  useEffect(() => {
    const initGPS = async () => {
      const { data, error } = await (supabase as any).from("driver_gps").select("*").eq("id", "driver").single();
      if (error || !data) {
        // Fix #3 : ne PAS insérer 0,0 — ces coordonnées passent les checks `!= null`
        // côté suivi et font apparaître le taxi au large de l'Afrique ou au centre de Bordeaux.
        // On laisse latitude/longitude NULL jusqu'au 1er vrai signal GPS.
        await (supabase as any)
          .from("driver_gps")
          .insert({ id: "driver", is_active: false, latitude: null, longitude: null });
      }
      setGpsLoading(false);
    };
    initGPS();
    return () => {
      // Nettoyage complet à la destruction du composant
      startGpsTokenRef.current.cancelled = true;
      if (watchIdRef.current !== null && typeof navigator !== "undefined")
        navigator.geolocation.clearWatch(watchIdRef.current);
      if (gpsHeartbeatRef.current) clearInterval(gpsHeartbeatRef.current);
      if (gpsRetryTimerRef.current) clearTimeout(gpsRetryTimerRef.current);
      releaseGpsWakeLock();
    };
  }, []);

  // GPS mini-map
  useEffect(() => {
    if (!gpsActive || !gpsMapRef.current) return;
    // Flag pour détecter si le cleanup a tourné avant la fin de l'init async
    let cancelled = false;
    const initMap = async () => {
      // Fix #1 (admin) : guard AVANT tout await — sinon deux toggles rapides
      // de gpsActive peuvent créer deux maps sur le même div.
      if (cancelled || !gpsMapRef.current || gpsMapInst.current) return;
      const L = (window as any).L;
      if (!L) {
        await new Promise<void>((resolve) => {
          if (!document.getElementById("leaflet-css-admin")) {
            const link = document.createElement("link");
            link.id = "leaflet-css-admin";
            link.rel = "stylesheet";
            link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
            document.head.appendChild(link);
          }
          if (!document.getElementById("leaflet-js-admin")) {
            const s = document.createElement("script");
            s.id = "leaflet-js-admin";
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
            s.onload = () => resolve();
            document.head.appendChild(s);
          } else {
            // Script déjà présent mais window.L peut ne pas être encore dispo.
            // Fix : poll + timeout doivent se nettoyer mutuellement (sinon double resolve / fuite).
            if ((window as any).L) {
              resolve();
            } else {
              let settled = false;
              let pollId: ReturnType<typeof setInterval> | null = null;
              let timeoutId: ReturnType<typeof setTimeout> | null = null;
              const cleanup = () => {
                if (pollId) clearInterval(pollId);
                if (timeoutId) clearTimeout(timeoutId);
                pollId = null;
                timeoutId = null;
              };
              pollId = setInterval(() => {
                if (settled) return;
                if ((window as any).L) {
                  settled = true;
                  cleanup();
                  resolve();
                }
              }, 50);
              timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
              }, 8000);
            }
          }
        });
      }
      // Re-check après l'await : cancelled, div démonté ou map déjà créée.
      if (cancelled || !gpsMapRef.current || gpsMapInst.current) return;
      const Lx = (window as any).L;
      if (!Lx) return;
      const center: [number, number] = gpsPosition ? [gpsPosition.lat, gpsPosition.lng] : [44.8378, -0.5792];
      const map = Lx.map(gpsMapRef.current, {
        center,
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      });
      Lx.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
      const icon = Lx.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 6px rgba(34,197,94,0.3),0 2px 12px rgba(34,197,94,0.6)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      gpsMarkerRef.current = Lx.marker(center, { icon }).addTo(map);
      gpsMapInst.current = map;
      setTimeout(() => map.invalidateSize(), 150);
    };
    initMap();
    return () => {
      cancelled = true;
      if (gpsMapInst.current) {
        gpsMapInst.current.remove();
        gpsMapInst.current = null;
        gpsMarkerRef.current = null;
      }
    };
  }, [gpsActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!gpsMapInst.current || !gpsPosition) return;
    const Lx = (window as any).L;
    if (!Lx) return;
    const latlng: [number, number] = [gpsPosition.lat, gpsPosition.lng];
    if (gpsMarkerRef.current) gpsMarkerRef.current.setLatLng(latlng);
    gpsMapInst.current.setView(latlng, gpsMapInst.current.getZoom());
  }, [gpsPosition]);

  // GPS auto-start
  const gpsStartedRef = useRef(false);
  useEffect(() => {
    if (coursesLoading || gpsLoading || gpsStartedRef.current) return;
    gpsStartedRef.current = true;
    const now = new Date().toISOString();
    const inProgress = items.find((r) => r.status === "en_route" || r.status === "arrived") ?? null;
    const nextAccepted =
      items
        .filter((r) => r.status === "accepted" && (!r.pickup_datetime || r.pickup_datetime >= now))
        .sort((a, b) => {
          if (!a.pickup_datetime) return 1;
          if (!b.pickup_datetime) return -1;
          return new Date(a.pickup_datetime).getTime() - new Date(b.pickup_datetime).getTime();
        })[0] ?? null;
    startGPS((inProgress ?? nextAccepted)?.id ?? undefined);
    // FIX 🟠 : reset au démontage pour que le GPS se relance correctement
    // si TanStack Router remonte le composant depuis son cache (mode keepalive).
    return () => {
      gpsStartedRef.current = false;
    };
  }, [coursesLoading, gpsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // GPS REPRISE ARRIÈRE-PLAN
  // Quand le chauffeur revient sur l'app (visibilitychange)
  // ou retrouve le réseau (online), on vérifie si le GPS
  // est toujours actif ; sinon on le relance automatiquement.
  // =========================
  const startGPSRef = useRef<((resaId?: string) => void) | null>(null);
  const gpsActiveRef = useRef(false);
  // FIX 🔴 : activeResaIdRef2 supprimée — on utilise uniquement activeResaIdRef (ligne 492)
  // pour éviter la désynchronisation entre les deux refs lors de la reprise arrière-plan.
  useEffect(() => {
    // FIX: dépendance sur items en plus de gpsActive pour que startGPS capture
    // toujours la liste de courses la plus récente (géocodage auto-status).
    // L'ancienne dépendance [gpsActive] seule laissait une closure périmée sur items.
    startGPSRef.current = startGPS;
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    gpsActiveRef.current = gpsActive;
  }, [gpsActive]);
  useEffect(() => {
    activeResaIdRef.current = activeResaId;
  }, [activeResaId]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!gpsActiveRef.current) return;
      requestGpsWakeLock();
      // GPS was active → check if watchPosition is still alive
      if (watchIdRef.current === null) {
        // watchPosition mort (suspendu en arrière-plan) → relancer
        console.info("[GPS] Reprise au premier plan — redémarrage watchPosition");
        startGPSRef.current?.(activeResaIdRef.current ?? undefined);
        return;
      }
      // watchPosition encore là → envoyer juste un getCurrentPosition
      // pour récupérer la position immédiatement sans attendre le prochain signal
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            lastKnownPosRef.current = { lat: latitude, lng: longitude, accuracy };
            gpsLastSignalAtRef.current = Date.now();
            pushPosition(latitude, longitude, accuracy, pos.coords.heading ?? null, pos.coords.speed ?? 0).catch(
              () => {},
            );
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      }
    };
    const handleOnline = () => {
      if (!gpsActiveRef.current) return;
      if (watchIdRef.current === null) {
        console.info("[GPS] Réseau rétabli — redémarrage watchPosition");
        startGPSRef.current?.(activeResaIdRef.current ?? undefined);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // GPS auto-transition
  useEffect(() => {
    if (!gpsActive || !activeResaId) return;
    const activeCourse = items.find((r) => r.id === activeResaId);
    if (!activeCourse) return;
    if (activeCourse.status !== "completed" && activeCourse.status !== "cancelled") return;
    const now = new Date().toISOString();
    const inProgress =
      items.find((r) => r.id !== activeResaId && (r.status === "en_route" || r.status === "arrived")) ?? null;
    const nextAccepted =
      items
        .filter(
          (r) => r.id !== activeResaId && r.status === "accepted" && (!r.pickup_datetime || r.pickup_datetime >= now),
        )
        .sort((a, b) => {
          if (!a.pickup_datetime) return 1;
          if (!b.pickup_datetime) return -1;
          return new Date(a.pickup_datetime).getTime() - new Date(b.pickup_datetime).getTime();
        })[0] ?? null;
    const next = inProgress ?? nextAccepted;
    if (next) {
      setAutoTransition(true);
      setActiveResaId(next.id);
      activeResaIdRef.current = next.id;
      // Reset des déclenchements auto pour la nouvelle course
      delete autoStatusFiredRef.current[next.id + "_en_route"];
      delete autoStatusFiredRef.current[next.id + "_arrived"];
      delete autoStatusFiredRef.current[next.id + "_completed"];
      // Re-géocoder le départ de la nouvelle course avec multi-tentatives
      pickupGeoRef.current = null;
      destinationGeoRef.current = null;
      if (next.depart) {
        geocodeForRoute(next.depart)
          .then((c) => {
            if (c) pickupGeoRef.current = { lat: c.lat, lng: c.lng };
          })
          .catch(() => {});
      }
      if (next.arrivee || next.destination) {
        geocodeForRoute(next.arrivee || next.destination)
          .then((c) => {
            if (c) destinationGeoRef.current = { lat: c.lat, lng: c.lng };
          })
          .catch(() => {});
      }
      toast.success("🔄 Nouvelle course détectée", {
        description:
          (next.client_name || next.nom || "prochain client") +
          (next.arrivee || next.destination ? " → " + (next.arrivee || next.destination) : ""),
        duration: 6000,
      });
      setTimeout(() => setAutoTransition(false), 3000);
    } else {
      setActiveResaId(null);
      activeResaIdRef.current = null;
      toast("🏁 Course terminée", {
        description: "GPS toujours actif — aucune prochaine course.",
        duration: 5000,
      });
    }
  }, [items, gpsActive, activeResaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // CALCUL DISTANCE
  // =========================
  const fetchDistanceKm = async (depart: string, arrivee: string): Promise<number> => {
    // On utilise geocodeForRoute qui tente plusieurs variantes d'adresse (plus robuste)
    const [a, b] = await Promise.all([geocodeForRoute(depart), geocodeForRoute(arrivee)]);
    if (a && b) {
      try {
        const dd = await getDistanceAndDurationKm([a.lng, a.lat], [b.lng, b.lat]);
        if (dd && dd.distanceKm && dd.distanceKm > 0) return Math.round(dd.distanceKm * 10) / 10;
      } catch {}
      // Fallback haversine × 1.3 si OSRM échoue
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const sin2 =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return Math.round((6371 * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2)) * 1.3) / 0.5) * 0.5;
    }
    return 5;
  };

  const repairMissingPrices = useCallback(async (rows: any[]) => {
    const toRepair = rows.filter(
      (r) =>
        normalizeStatus(r.status) === "accepted" && r.prix_estime == null && r.depart && (r.arrivee || r.destination),
    );
    for (const r of toRepair) {
      setCardKmLoading((prev) => ({ ...prev, [r.id]: true }));
      try {
        const km = await fetchDistanceKm(r.depart, r.arrivee || r.destination);
        const prix = r.pickup_datetime ? calculerPrixMixte(km, r.pickup_datetime) : calculerPrix(km, true);
        await supabase.from("reservations").update({ distance_km: km, prix_estime: prix }).eq("id", r.id);
        setCardKm((prev) => ({ ...prev, [r.id]: km }));
      } catch {}
      setCardKmLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // ACCEPT — seule action manuelle
  // =========================
  const handleAccept = async (r: any) => {
    let suiviId: string;
    try {
      suiviId = r.suivi_id ? assertSuiviId(r.suivi_id) : newSuiviId();
      assertSuiviId(suiviId);
    } catch (e) {
      toast.error("Impossible d'accepter la course", {
        description: e instanceof Error ? e.message : "suivi_id invalide",
      });
      return;
    }

    // ⚡ URL construite ICI — avant tout await — pour iOS Safari qui invalide
    // le contexte de geste utilisateur dès le premier await asynchrone.
    const driverUrl =
      typeof window !== "undefined" ? `${window.location.origin}/suivi/${suiviId}?gps=1&rid=${r.id}` : null;
    const tarifNuitCourse = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
    const km = r.distance_km ? Number(r.distance_km) : 5;
    const prixCalcule = r.pickup_datetime
      ? calculerPrixMixte(km, r.pickup_datetime)
      : calculerPrix(km, !tarifNuitCourse);

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "accepted",
        suivi_id: suiviId,
        tarif_jour: !tarifNuitCourse,
        distance_km: km,
        prix_estime: prixCalcule,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      toast.error("Échec de l'acceptation", { description: error.message });
      return;
    }

    const phone = r.client_phone || r.telephone;
    const name = r.client_name || r.nom;
    const email = r.client_email || r.email;

    // Enregistrer dans clients
    if (phone) {
      try {
        const { data: existing } = await (supabase as any)
          .from("clients")
          .select("id,total_courses")
          .eq("phone", phone)
          .maybeSingle();
        if (existing) {
          await (supabase as any)
            .from("clients")
            .update({ total_courses: (existing.total_courses ?? 0) + 1 })
            .eq("id", existing.id);
        } else {
          await (supabase as any).from("clients").insert({ name, phone, email, total_courses: 1 });
        }
      } catch (clientErr) {
        console.error("[handleAccept] clients insert/update failed", clientErr);
      }
    }

    try {
      new Audio("/notification.mp3").play().catch(() => {});
    } catch {}

    const url = typeof window !== "undefined" ? `${window.location.origin}/suivi/${suiviId}` : "";
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }

    const notifParts: string[] = [];

    // 🔔 Push automatique (toujours) — timeout 5s pour ne pas bloquer
    let pushSent = 0;
    try {
      const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000));
      const pushResult = await Promise.race([
        notifyReservationStatus({ data: { reservation_id: r.id, status: "accepted" } }),
        timeout,
      ]);
      pushSent = (pushResult as any)?.client?.sent ?? 0;
    } catch {}
    notifParts.push(pushSent > 0 ? `🔔 Push envoyée` : `🔕 Pas d'abonné push`);

    // ✉️ Email désactivé — à envoyer manuellement via "Modifier le prix"

    toast.success(`✅ Course acceptée — ${name || "client"}`, {
      description: notifParts.join(" · "),
      duration: 8000,
    });

    // 📡 Redirige vers la page chauffeur GPS — URL construite avant les awaits (iOS Safari)
    if (driverUrl) {
      window.location.href = driverUrl;
    }

    // Mise à jour optimiste immédiate
    setItems((prev) =>
      prev.map((item) =>
        item.id === r.id
          ? {
              ...item,
              status: "accepted",
              suivi_id: suiviId,
              distance_km: km,
              prix_estime: prixCalcule,
            }
          : item,
      ),
    );
    setCounts((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      accepted: prev.accepted + 1,
    }));
    // Refresh stats en arrière-plan (CA, clients…)
    fetchStats();
  };

  // =========================
  // REFUSE — direct, sans motif
  // =========================
  const handleRefuse = async (r: any): Promise<boolean> => {
    // Mise à jour optimiste IMMÉDIATE — avant tout appel réseau
    setItems((prev) => prev.map((item) => (item.id === r.id ? { ...item, status: "refused" } : item)));
    setCounts((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      refused: prev.refused + 1,
    }));

    const { error } = await supabase
      .from("reservations")
      .update({ status: "refused", updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      // Rollback en cas d'erreur
      setItems((prev) => prev.map((item) => (item.id === r.id ? { ...item, status: r.status } : item)));
      setCounts((prev) => ({
        ...prev,
        pending: prev.pending + 1,
        refused: Math.max(0, prev.refused - 1),
      }));
      toast.error("Échec du refus", { description: error.message });
      return false;
    }
    let pushSent = 0;
    try {
      const res = await notifyReservationStatus({
        data: { reservation_id: r.id, status: "refused" },
      });
      pushSent = (res as any)?.client?.sent ?? 0;
    } catch {}
    toast.success(`❌ Course refusée — ${r.client_name || r.nom || "client"}`, {
      description: pushSent > 0 ? "🔔 Push envoyée au client" : undefined,
      duration: 5000,
    });
    // Pas de fetchAll() ici — la mise à jour optimiste suffit
    // Le realtime UPDATE va refetch mais items est déjà correct
    return true;
  };

  // =========================
  // UPDATE STATUS (automatique)
  // =========================
  const handleUpdateReservationStatus = async (r: any, status: string) => {
    const valid = ["accepted", "en_route", "arrived", "completed", "cancelled"];
    if (!valid.includes(status)) return;
    const { error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast.error("Impossible de mettre à jour le statut", { description: error.message });
      return;
    }
    const statusLabels: Record<string, string> = {
      en_route: "🚗 En route",
      arrived: "📍 Arrivé",
      completed: "🏁 Terminé",
      cancelled: "✖ Annulée",
    };
    try {
      const result = await notifyReservationStatus({
        data: { reservation_id: r.id, status: status as any },
      });
      if (typeof window !== "undefined" && (result as any)?.smsPhone && (result as any)?.smsBody) {
        window.open(`sms:${(result as any).smsPhone}?body=${(result as any).smsBody}`, "_blank");
      }
      if (typeof window !== "undefined" && (result as any)?.chauffeurSmsPhone && (result as any)?.chauffeurSmsBody) {
        setTimeout(() => {
          window.open(`sms:${(result as any).chauffeurSmsPhone}?body=${(result as any).chauffeurSmsBody}`, "_blank");
        }, 500);
      }
      const notifLabel =
        status === "en_route"
          ? " · 🔔 Push + SMS envoyés"
          : status === "arrived"
            ? " · 🔔 Push + SMS 'à proximité' envoyés"
            : " · 🔔 Push client envoyée";
      toast.success(`${statusLabels[status] ?? status}`, {
        description: `Course mise à jour${notifLabel}`,
        duration: 6000,
      });
    } catch {
      toast.success(`Statut mis à jour : ${statusLabels[status] ?? status}`);
    }
    setItems((prev) => prev.map((item) => (item.id === r.id ? { ...item, status } : item)));
  };

  // =========================
  // DELETE
  // =========================
  const handleDeleteReservation = async (id: string) => {
    setDeleteBusy(true);
    // Supprimer en BDD
    const { error, count } = await (supabase as any).from("reservations").delete({ count: "exact" }).eq("id", id);

    if (error) {
      console.error("[DELETE] Supabase error:", error);
      toast.error("Suppression impossible", { description: error.message });
      setDeleteBusy(false);
      return;
    }

    // Si count === 0 : RLS a bloqué silencieusement ou l'id n'existe pas
    if (count === 0) {
      console.warn("[DELETE] count=0 — RLS ou ligne absente, on filtre quand même localement");
    }

    // Mettre à jour l'état local dans tous les cas
    // Fix stale closure : on lit l'item depuis le prev de setItems (état frais)
    // avant de le retirer, puis on ajuste setCounts en conséquence.
    setItems((prev) => {
      const item = prev.find((r) => r.id === id);
      if (item) {
        setCounts((c) => {
          const k = normalizeStatus(item.status);
          return { ...c, [k]: Math.max(0, c[k] - 1) };
        });
      }
      return prev.filter((r) => r.id !== id);
    });
    toast.success("Réservation supprimée");
    setDeleteBusy(false);
  };

  // =========================
  // AVIS
  // =========================
  const handleAvisAction = async (id: string, action: "approved" | "refused") => {
    const { error } = await (supabase as any)
      .from("avis")
      .update({ status: action, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }
    toast.success(action === "approved" ? "Avis publié ✓" : "Avis refusé");
    setAvis((prev) => prev.map((a) => (a.id === id ? { ...a, status: action } : a)));
  };
  const handleDeleteAvis = async (id: string) => {
    const { error } = await (supabase as any).from("avis").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      return;
    }
    toast.success("Avis supprimé");
    setAvis((prev) => prev.filter((a) => a.id !== id));
  };

  // =========================
  // GPS CONTROLS
  // =========================
  // ── Push position to Supabase ──────────────────────────────────────────────
  // ── Source GPS unique : driver_gps ──────────────────────────────────────────
  // L'admin écrit ICI. Le suivi client lit DEPUIS ICI via Realtime + polling.
  // taxi_positions n'est plus utilisée (supprimée de la boucle GPS).
  const pushPosition = async (
    latitude: number,
    longitude: number,
    acc: number,
    computedHeading: number | null,
    speed: number,
  ) => {
    const now = new Date().toISOString();
    try {
      await (supabase as any).from("driver_gps").upsert(
        {
          id: "driver",
          latitude,
          longitude,
          accuracy: acc,
          heading: computedHeading,
          speed,
          is_active: true,
          heartbeat_at: now,
          updated_at: now,
        },
        { onConflict: "id" },
      );
      // ── Validation GPS : marque la réservation comme "GPS activé" au 1er signal réussi ──
      const resaId = activeResaIdRef.current;
      if (resaId) {
        (supabase as any).rpc("mark_gps_validated", { p_reservation_id: resaId }).then(
          () => {},
          () => {},
        );
      }
    } catch (e) {
      console.warn("[GPS] pushPosition failed", e);
    }
  };

  const startGPS = (resaId?: string) => {
    if (!navigator.geolocation) {
      setGpsError("GPS non disponible sur cet appareil.");
      return;
    }
    // Guard : si un watchPosition est déjà actif, on le stoppe proprement avant de redémarrer
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsHeartbeatRef.current) {
      clearInterval(gpsHeartbeatRef.current);
      gpsHeartbeatRef.current = null;
    }
    if (gpsRetryTimerRef.current) {
      clearTimeout(gpsRetryTimerRef.current);
      gpsRetryTimerRef.current = null;
    }
    setGpsError(null);
    lastPosRef.current = null;
    lastKnownPosRef.current = null;
    gpsLastSignalAtRef.current = 0;
    requestGpsWakeLock();
    // IMPORTANT : vider les flags auto-status pour que arrived/completed
    // puissent se déclencher à nouveau après un redémarrage GPS (retour arrière-plan).
    if (resaId) {
      delete autoStatusFiredRef.current[resaId + "_en_route"];
      delete autoStatusFiredRef.current[resaId + "_arrived"];
      delete autoStatusFiredRef.current[resaId + "_completed"];
    }

    const linkedId = resaId ?? null;
    setActiveResaId(linkedId);
    activeResaIdRef.current = linkedId;
    // Reset géocodage immédiat pour éviter de tester pickupGeoRef null
    // pendant que le géocodage async tourne
    pickupGeoRef.current = null;
    destinationGeoRef.current = null;
    setGpsActive(true);

    // Fix #2 (admin) : invalider l'ancien jeton et créer un nouveau
    // pour cette session startGPS. Les awaits ci-dessous vérifient ce flag.
    startGpsTokenRef.current.cancelled = true;
    const token = { cancelled: false };
    startGpsTokenRef.current = token;

    // ── Géocodage départ + destination EN PARALLÈLE, puis démarrage du watch
    // Stratégie : on lance watchPosition tout de suite (exigence iOS Safari pour
    // le tap synchrone), mais on PRÉ-CHARGE les coords avant d'arriver sur place.
    // Si le géocodage n'est pas terminé quand le 1er signal arrive, handlePosition
    // va re-tester à chaque update suivant (les refs sont remplies en live).
    Promise.resolve().then(async () => {
      if (token.cancelled) return;
      // Marquer actif en DB
      (supabase as any)
        .from("driver_gps")
        .upsert({ id: "driver", is_active: true, updated_at: new Date().toISOString() }, { onConflict: "id" })
        .catch(() => {});

      if (linkedId) {
        const course = items.find((r) => r.id === linkedId);
        // Géocodage parallèle départ + destination
        await Promise.allSettled([
          course?.depart
            ? geocodeForRoute(course.depart).then((c) => {
                if (token.cancelled) return;
                if (c) pickupGeoRef.current = { lat: c.lat, lng: c.lng };
              })
            : Promise.resolve(),
          course?.arrivee || course?.destination
            ? geocodeForRoute(course.arrivee || course.destination).then((c) => {
                if (token.cancelled) return;
                if (c) destinationGeoRef.current = { lat: c.lat, lng: c.lng };
              })
            : Promise.resolve(),
        ]);
      }
    });

    // ── Handlers définis avant watchPosition pour éviter les refs circulaires ──
    // handleErrorRef permet à handlePosition d'être déclaré avant handleError
    // tout en permettant à handleError de rappeler watchPosition avec handlePosition
    // (évite le ReferenceError sur les const non hoistées).
    const handleErrorRef: { current: ((err: GeolocationPositionError) => void) | null } = {
      current: null,
    };

    // FIX 🔴 : handlePosition doit être une fonction SYNCHRONE.
    // iOS Safari tue watchPosition si le callback GPS est async/await (trop lent).
    // Toute la logique async (auto-status) est déportée dans un IIFE fire-and-forget.
    const handlePosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy: acc, heading: rawHeading } = pos.coords;
      const rejection = getDriverGpsRejection(pos, lastKnownPosRef.current);
      if (rejection) {
        setGpsError(rejection);
        setGpsAccuracy(Number.isFinite(acc) ? Math.round(acc) : null);
        return;
      }
      setGpsError(null);
      let computedHeading = rawHeading ?? null;
      if ((computedHeading === null || computedHeading === 0) && lastPosRef.current) {
        const dLat = latitude - lastPosRef.current.lat;
        const dLng = longitude - lastPosRef.current.lng;
        if (Math.abs(dLat) > 0.00001 || Math.abs(dLng) > 0.00001) {
          computedHeading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
          if (computedHeading < 0) computedHeading += 360;
        }
      }
      lastPosRef.current = { lat: latitude, lng: longitude };
      lastKnownPosRef.current = { lat: latitude, lng: longitude, accuracy: acc };
      gpsLastSignalAtRef.current = Date.now();
      setGpsPosition({ lat: latitude, lng: longitude });
      setGpsAccuracy(Math.round(acc));
      setGpsUpdateCount((n) => n + 1);

      // Fire-and-forget : ne jamais bloquer le callback GPS sur un appel réseau
      // iOS/Android peuvent tuer watchPosition si le callback est trop lent
      pushPosition(latitude, longitude, acc, computedHeading, pos.coords.speed ?? 0).catch(() => {});

      // ── AUTO-STATUS (fire-and-forget async) ─────────────────────────────
      // Déporté dans un IIFE async pour ne pas bloquer le callback synchrone GPS.
      const _lat = latitude;
      const _lng = longitude;
      (async () => {
        const resaId = activeResaIdRef.current;
        if (!resaId) return;
        const fired = autoStatusFiredRef.current;

        const enRouteKey = resaId + "_en_route";
        if (!fired[enRouteKey]) {
          // Lecture synchrone via itemsRef — pas de Promise sur setItems.
          const course = itemsRef.current.find((r) => r.id === resaId) ?? null;
          if (course && course.status === "accepted") {
            const pickupMs = course.pickup_datetime ? new Date(course.pickup_datetime).getTime() : null;
            const nowMs = Date.now();
            // FIX 🔴 : on n'auto-déclenche que si l'heure est connue ET dans ≤ 30 min.
            // L'ancien `!pickupMs` déclenchait en_route immédiatement pour toute
            // course sans pickup_datetime, même réservée bien à l'avance.
            const shouldGo = pickupMs != null && pickupMs - nowMs <= 30 * 60 * 1000;
            if (shouldGo && !fired[enRouteKey]) {
              fired[enRouteKey] = true;
              const clientLabel2 = course.client_name || course.nom || "Client";
              handleUpdateReservationStatus(course, "en_route").then(() => {
                toast.success("🚗 En route automatique", {
                  description: clientLabel2 + " — départ dans ≤ 30 min",
                  duration: 5000,
                });
              });
            }
          }
        }

        const arrivedKey = resaId + "_arrived";
        if (!fired[arrivedKey]) {
          // Lecture synchrone via itemsRef — plus de Promise sur setItems.
          if (!pickupGeoRef.current) {
            const course = itemsRef.current.find((r) => r.id === resaId);
            if (course?.depart) {
              geocodeForRoute(course.depart)
                .then((c) => {
                  if (c) pickupGeoRef.current = { lat: c.lat, lng: c.lng };
                })
                .catch(() => {});
            }
          }
          if (pickupGeoRef.current) {
            const dist = distMetersGps({ lat: _lat, lng: _lng }, pickupGeoRef.current);
            if (dist < 250) {
              const course = itemsRef.current.find((r) => r.id === resaId) ?? null;
              if (course && (course.status === "en_route" || course.status === "accepted") && !fired[arrivedKey]) {
                fired[arrivedKey] = true;
                handleUpdateReservationStatus(course, "arrived").then(() => {
                  toast.success("📍 Arrivée détectée automatiquement", {
                    description: "À " + Math.round(dist) + " m de la prise en charge",
                    duration: 5000,
                  });
                });
              }
            }
          }
        }

        const completedKey = resaId + "_completed";
        if (!fired[completedKey]) {
          // Lecture synchrone via itemsRef — plus de Promise sur setItems.
          if (!destinationGeoRef.current) {
            const course = itemsRef.current.find((r) => r.id === resaId);
            const dest = course?.arrivee || course?.destination;
            if (dest) {
              geocodeForRoute(dest)
                .then((c) => {
                  if (c) destinationGeoRef.current = { lat: c.lat, lng: c.lng };
                })
                .catch(() => {});
            }
          }
          if (destinationGeoRef.current) {
            const distDest = distMetersGps({ lat: _lat, lng: _lng }, destinationGeoRef.current);
            if (distDest < 250) {
              const course = itemsRef.current.find((r) => r.id === resaId) ?? null;
              if (course && course.status === "arrived" && !fired[completedKey]) {
                fired[completedKey] = true;
                const clientLabel = course.client_name || course.nom || "Client";
                handleUpdateReservationStatus(course, "completed").then(() => {
                  toast.success("🏁 Course terminée automatiquement", {
                    description: "À " + Math.round(distDest) + " m de la destination — " + clientLabel,
                    duration: 6000,
                  });
                });
              }
            }
          }
        }
      })().catch(() => {});
    };

    // handleError est déclaré APRÈS handlePosition pour éviter le ReferenceError
    const handleError = (err: GeolocationPositionError) => {
      console.error("GPS error", err.code, err.message);

      if (err.code === 1) {
        // Vraie permission refusée
        setGpsError("Permission GPS refusée. Autorisez la localisation dans les réglages.");
        return;
      }

      const msgs: Record<number, string> = {
        2: "Position GPS indisponible (intérieur ?). Retry dans 8s…",
        3: "GPS timeout. Retry dans 8s…",
      };
      setGpsError(msgs[err.code] ?? "Erreur GPS inconnue.");
      if (gpsRetryTimerRef.current) clearTimeout(gpsRetryTimerRef.current);
      gpsRetryTimerRef.current = setTimeout(() => {
        // FIX 🟠 : verrou anti race-condition — si le watchdog 45s a déjà relancé
        // watchPosition entre le moment où handleError s'est déclenché et la fin
        // du délai 8s, on ne lance pas un second watch.
        if (gpsRestartingRef.current) return;
        gpsRestartingRef.current = true;
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        gpsLastSignalAtRef.current = Date.now();
        watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
          enableHighAccuracy: true,
          // FIX 🟡 : maximumAge 5s (au lieu de 30s) — pour un taxi, une position
          // vieille de 30s est inutile et masque les vrais silences GPS.
          maximumAge: 5000,
          timeout: 60000,
        });
        gpsRestartingRef.current = false;
      }, 8000);
    };
    handleErrorRef.current = handleError;

    // ── Démarrage précision maximale compatible Android + iOS ───────────────
    // watchPosition haute précision dès le départ — iOS et Android acceptent
    // ce pattern tant qu'on reste dans la pile synchrone du geste utilisateur.
    // En cas de PERMISSION_DENIED (faux positif Android), on chaîne un
    // getCurrentPosition direct sans setTimeout (respecte la pile iOS Safari).
    const startWatch = () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 5000, // FIX 🟡 : 5s pour taxi (30s masquait les silences GPS)
        timeout: 60000,
      });
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        startWatch();
      },
      (err) => {
        if (err.code === 1) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              handlePosition(pos);
              startWatch();
            },
            () => {
              startWatch();
            },
            { enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 },
          );
        } else {
          startWatch();
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );

    // ── Heartbeat toutes les 5s : maintenir is_active = true dans driver_gps ──
    // Seule table GPS. Le suivi client la lit en Realtime et en polling.
    if (gpsHeartbeatRef.current) clearInterval(gpsHeartbeatRef.current);
    gpsHeartbeatRef.current = setInterval(async () => {
      try {
        // Heartbeat indépendant du mouvement GPS : écrit heartbeat_at même en statique.
        // NE met PAS à jour updated_at (réservé aux vrais signaux GPS via pushPosition).
        const { error } = await (supabase as any)
          .from("driver_gps")
          .update({ is_active: true, heartbeat_at: new Date().toISOString() })
          .eq("id", "driver");
        if (error) console.warn("[GPS] heartbeat update failed", error);
      } catch (e) {
        console.warn("[GPS] heartbeat exception", e);
      }

      const silentMs = gpsLastSignalAtRef.current ? Date.now() - gpsLastSignalAtRef.current : 0;
      if (silentMs > 45_000 && document.visibilityState === "visible") {
        // FIX 🟠 : verrou anti race-condition watchdog 45s / retry 8s.
        // Sans ce verrou, handleError (8s) et le heartbeat (45s) peuvent tous les
        // deux appeler watchPosition simultanément et créer deux watches actifs.
        if (gpsRestartingRef.current) return;
        gpsRestartingRef.current = true;
        gpsLastSignalAtRef.current = Date.now();
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
          enableHighAccuracy: true,
          // FIX 🟡 : maximumAge 5s — cohérent avec le reste, évite les positions
          // périmées qui masqueraient un silence GPS réel.
          maximumAge: 5000,
          timeout: 45000,
        });
        gpsRestartingRef.current = false;
      }
    }, 5000);
  };

  const stopGPS = async () => {
    // Fix #2 (admin) : annuler tout fire-and-forget en cours de startGPS
    startGpsTokenRef.current.cancelled = true;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (gpsHeartbeatRef.current) clearInterval(gpsHeartbeatRef.current);
    gpsHeartbeatRef.current = null;
    if (gpsRetryTimerRef.current) clearTimeout(gpsRetryTimerRef.current);
    gpsRetryTimerRef.current = null;
    releaseGpsWakeLock();
    gpsRestartingRef.current = false; // reset verrou race-condition
    lastKnownPosRef.current = null;
    lastPosRef.current = null;
    try {
      await (supabase as any)
        .from("driver_gps")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", "driver");
    } catch (e) {
      console.warn("[GPS] stopGPS DB update failed", e);
    }
    setGpsActive(false);
    setGpsPosition(null);
    setGpsAccuracy(null);
    setGpsUpdateCount(0);
    setGpsError(null);
    setActiveResaId(null);
    activeResaIdRef.current = null;
    setAutoTransition(false);
  };

  const getPrix = (r: any): number | null => {
    if (r.prix_final) return Number(r.prix_final);
    if (r.prix_estime) return Number(r.prix_estime);
    if (r.distance_km) {
      const nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
      return r.pickup_datetime
        ? calculerPrixMixte(Number(r.distance_km), r.pickup_datetime)
        : calculerPrix(Number(r.distance_km), !nuit);
    }
    return null;
  };

  const pending = items.filter((r) => normalizeStatus(r.status) === "pending");
  const accepted = items.filter((r) => normalizeStatus(r.status) === "accepted");
  const refused = items.filter((r) => normalizeStatus(r.status) === "refused");
  // Courses "en cours" = accepted + en_route + arrived (pour la section séparée)
  const inProgress = items.filter((r) => r.status === "en_route" || r.status === "arrived");
  const completed = items.filter((r) => r.status === "completed");

  // =========================
  // ENVOYER NOUVEAU PRIX
  // =========================
  const handleSendCustomPrix = async (r: any, canal: "sms" | "whatsapp" | "email", prixOverride?: number) => {
    const rawStr = prixOverride != null ? String(prixOverride) : (customPrix[r.id] ?? "");
    const valStr = rawStr.trim().replace(",", ".");
    const val = parseFloat(valStr);
    if (!valStr || isNaN(val) || val <= 0) {
      toast.error("Prix invalide", { description: "Entrez un montant valide (ex: 18.50)" });
      return;
    }
    const name = r.client_name || r.nom || "Client";
    const phone = (r.client_phone || r.telephone || "").replace(/\s/g, "");
    const email = r.client_email || r.email || "";
    const trajet = `${r.depart} → ${r.destination || r.arrivee || "—"}`;
    const trackUrl = r.suivi_id && typeof window !== "undefined" ? `${window.location.origin}/suivi/${r.suivi_id}` : "";
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
      const wa = phone.replace(/^0/, "33");
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
    } else if (canal === "email") {
      if (!email) {
        toast.error("Pas d'email");
        return;
      }
      setCustomPrixSending((p) => ({ ...p, [r.id]: true }));
      try {
        const km = r.distance_km ? Number(r.distance_km) : null;
        const res = await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
          body: JSON.stringify({
            templateName: "custom-price",
            recipientEmail: email,
            idempotencyKey: `custom-price-${r.id}-${Date.now()}`,
            templateData: {
              nom: name,
              depart: r.depart,
              arrivee: r.destination || r.arrivee || "—",
              prix: `${val.toFixed(2)} €`,
              distance_km: km ? `${km} km` : undefined,
              pickup_datetime: r.pickup_datetime
                ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
                : undefined,
            },
          }),
        });
        if (!res.ok) {
          let errMsg = "Échec envoi email";
          try {
            const errBody = await res.json();
            errMsg = errBody?.error || errBody?.message || `Erreur ${res.status}`;
          } catch {}
          toast.error(errMsg);
        } else {
          toast.success(`✉️ Email envoyé à ${email}`);
        }
      } catch (err: any) {
        toast.error("Erreur réseau", { description: err?.message ?? "" });
      } finally {
        setCustomPrixSending((p) => ({ ...p, [r.id]: false }));
      }
    }

    // Mettre à jour prix_estime en base
    await supabase.from("reservations").update({ prix_estime: val }).eq("id", r.id);
    setItems((prev) => prev.map((item) => (item.id === r.id ? { ...item, prix_estime: val } : item)));
  };

  // =========================
  // ITINÉRAIRES ALTERNATIFS (court / inter / long)
  // =========================
  const loadItineraires = async (r: any) => {
    const dep = r.depart;
    const dest = r.destination || r.arrivee;
    if (!dep || !dest) {
      toast.error("Adresses manquantes");
      return;
    }
    setItinLoading((p) => ({ ...p, [r.id]: true }));
    setItinOpen((p) => ({ ...p, [r.id]: true }));
    try {
      const [a, b] = await Promise.all([geocodeForRoute(dep), geocodeForRoute(dest)]);
      if (!a || !b) {
        toast.error("Géocodage impossible");
        const pickupIso = r.pickup_datetime || new Date().toISOString();
        const km = Number(r.distance_km) || 5;
        setItinAlts((p) => ({
          ...p,
          [r.id]: [1, 1.18].map((factor, i) => {
            const labels = ["🟢 Court", "🔴 Long"];
            const finalKm = parseFloat((km * factor).toFixed(2));
            return {
              label: labels[i],
              km: finalKm,
              prix: parseFloat(calculerPrixMixte(finalKm, pickupIso).toFixed(2)),
              coords: [],
            };
          }),
        }));
        setItinLoading((p) => ({ ...p, [r.id]: false }));
        return;
      }
      const pickupIso = r.pickup_datetime || new Date().toISOString();
      const labels = ["🟢 Court", "🔴 Long"];

      // Appel OSRM avec alternatives=2 → on prend le plus court et le plus long.
      const osrmData = await fetchRouteCoordinates(
        [
          [a.lng, a.lat],
          [b.lng, b.lat],
        ],
        {
          overview: "full",
          alternatives: 2,
          geometries: "geojson",
        },
      ).catch(() => null);

      const routes = osrmData?.routes ?? [];
      const allAlts = routes
        .map((route: any) => routeToAlt(route, "", pickupIso))
        .filter(Boolean)
        .sort((x: ItineraryAlt, y: ItineraryAlt) => x.km - y.km);

      // Distance réelle ORS — pas de facteur correctif
      let alts: ItineraryAlt[] = [];
      if (allAlts.length >= 2) {
        alts = [
          { ...allAlts[0], label: labels[0] },
          { ...allAlts[allAlts.length - 1], label: labels[1] },
        ];
      } else if (allAlts.length === 1) {
        alts = [{ ...allAlts[0], label: labels[0] }];
      }

      // Fallback si OSRM renvoie moins de 2 routes
      if (alts.length < 2) {
        const baseCoords = alts[0]?.coords ?? [];
        const baseKm = alts[0]?.km; // km déjà corrigé par TARGET_FACTORS[0] = 14
        const fallback = fallbackItineraries(a, b, pickupIso, baseCoords, baseKm);
        for (const alt of fallback) {
          if (alts.length >= 2) break;
          if (!alts.some((existing) => Math.abs(existing.km - alt.km) < 0.5)) alts.push(alt);
        }
        alts = alts
          .sort((x, y) => x.km - y.km)
          .slice(0, 2)
          .map((alt, i) => ({ ...alt, label: labels[i] }));
      }

      setItinAlts((p) => ({ ...p, [r.id]: alts }));
    } catch (e: any) {
      const pickupIso = r.pickup_datetime || new Date().toISOString();
      const km = Number(r.distance_km) || 5;
      const labels = ["🟢 Court", "🔴 Long"];
      setItinAlts((p) => ({
        ...p,
        [r.id]: [1, 1.18].map((factor, i) => {
          const finalKm = parseFloat((km * factor).toFixed(2));
          return {
            label: labels[i],
            km: finalKm,
            prix: parseFloat(calculerPrixMixte(finalKm, pickupIso).toFixed(2)),
            coords: [],
          };
        }),
      }));
      toast.warning("Itinéraires calculés avec la distance existante", {
        description: e?.message ?? "",
      });
    } finally {
      setItinLoading((p) => ({ ...p, [r.id]: false }));
    }
  };

  const handleSelectItineraire = async (r: any, alt: ItineraryAlt) => {
    setItinSaving((p) => ({ ...p, [r.id]: true }));
    try {
      const { error } = await supabase
        .from("reservations")
        .update({
          prix_estime: alt.prix,
          distance_km: alt.km,
          route_coords: alt.coords as any,
          route_label: alt.label,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", r.id);
      if (error) throw error;
      setItems((prev) =>
        prev.map((item) =>
          item.id === r.id
            ? {
                ...item,
                prix_estime: alt.prix,
                distance_km: alt.km,
                route_coords: alt.coords,
                route_label: alt.label,
              }
            : item,
        ),
      );
      // Pré-remplir le champ prix pour les boutons SMS / WhatsApp / Email
      // Note: on passe aussi prixOverride directement aux handlers pour éviter le problème de closure async
      setCustomPrix((p) => ({ ...p, [r.id]: alt.prix.toFixed(2), [r.id + "_open"]: "1" }));
      toast.success(`${alt.label} sélectionné`, {
        description: `${alt.km} km · ${alt.prix.toFixed(2)} € — utilisez SMS / WhatsApp / Email pour envoyer le prix au client`,
      });
    } catch (e: any) {
      toast.error("Échec enregistrement", { description: e?.message ?? "" });
    } finally {
      setItinSaving((p) => ({ ...p, [r.id]: false }));
    }
  };

  // =========================
  // CHANGER L'HEURE D'UNE RÉSA
  // =========================
  const handleChangeHeure = async (r: any, newDatetime: string) => {
    if (!newDatetime) return;
    setChangeHeureSending((p) => ({ ...p, [r.id]: true }));
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ pickup_datetime: newDatetime, updated_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;

      // Mise à jour optimiste locale
      setItems((prev) => prev.map((item) => (item.id === r.id ? { ...item, pickup_datetime: newDatetime } : item)));

      // ── Email automatique au client ──
      const email = r.client_email || r.email;
      const name = r.client_name || r.nom || "Client";
      const newFormatted = formatParis(newDatetime, { dateStyle: "full", timeStyle: "short" });
      const oldFormatted = r.pickup_datetime
        ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
        : "—";

      if (email) {
        try {
          await fetch("/api/admin/send-course-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
            body: JSON.stringify({
              templateName: "reschedule",
              recipientEmail: email,
              idempotencyKey: `reschedule-${r.id}-${Date.now()}`,
              templateData: {
                nom: name,
                depart: r.depart,
                arrivee: r.destination || r.arrivee || "—",
                old_datetime: oldFormatted,
                new_datetime: newFormatted,
              },
            }),
          });
          toast.success("🕐 Heure modifiée", {
            description: `${name} · Nouveau créneau : ${newFormatted} · ✉️ Email envoyé`,
            duration: 7000,
          });
        } catch {
          toast.success("🕐 Heure modifiée", {
            description: `${name} · Nouveau créneau : ${newFormatted} · ⚠️ Email non envoyé`,
            duration: 7000,
          });
        }
      } else {
        toast.success("🕐 Heure modifiée", {
          description: `${name} · Nouveau créneau : ${newFormatted}`,
          duration: 6000,
        });
      }

      // Fermer le panneau
      setChangeHeureOpen((p) => ({ ...p, [r.id]: false }));
      setChangeHeureValue((p) => ({ ...p, [r.id]: "" }));
    } catch (err: any) {
      toast.error("Impossible de modifier l'heure", { description: err?.message });
    } finally {
      setChangeHeureSending((p) => ({ ...p, [r.id]: false }));
    }
  };

  // ─── Course card ───
  function CourseCard({ r, showAcceptRefuse }: { r: any; showAcceptRefuse?: boolean }) {
    const name = r.client_name || r.nom;
    const dest = r.destination || r.arrivee;
    const tarif_nuit_card = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
    const km_card = r.distance_km ? Number(r.distance_km) : (cardKm[r.id] ?? null);
    const prix =
      r.prix_estime != null
        ? Number(r.prix_estime)
        : km_card != null
          ? r.pickup_datetime
            ? calculerPrixMixte(km_card, r.pickup_datetime)
            : calculerPrix(km_card, !tarif_nuit_card)
          : null;
    const isPrixLoading = cardKmLoading[r.id] ?? false;
    const pickupFormatted = r.pickup_datetime
      ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
      : null;

    // Détection conflit horaire (±1h avec une résa acceptée/en_route/arrivée)
    const hasConflict = (() => {
      if (!r.pickup_datetime || normalizeStatus(r.status) !== "pending") return false;
      const pickupMs = new Date(r.pickup_datetime).getTime();
      return items.some(
        (item) =>
          item.id !== r.id &&
          item.pickup_datetime &&
          (item.status === "accepted" || item.status === "en_route" || item.status === "arrived") &&
          Math.abs(new Date(item.pickup_datetime).getTime() - pickupMs) < 60 * 60 * 1000,
      );
    })();

    return (
      <SwipeDeleteRow onDelete={() => handleDeleteReservation(r.id)} disabled={deleteBusy} style={{ marginBottom: 14 }}>
        <div style={{ ...card }}>
          {/* En-tête */}
          <div
            className="course-card-head"
            style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{name}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {pickupFormatted ? (
                  <span>
                    🕐 <b style={{ color: "#94a3b8" }}>{pickupFormatted}</b>
                  </span>
                ) : (
                  new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
                )}
              </div>
              <div style={{ color: "#cbd5e1", marginTop: 6 }}>
                <div>🟢 {r.depart}</div>
                <div style={{ marginTop: 2 }}>📍 {dest}</div>
              </div>
            </div>
            <div className="course-card-head-right" style={{ color: "#64748b", fontSize: 13 }}></div>
          </div>

          {/* Infos */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            {r.distance_km && <span>🚕 {r.distance_km} km</span>}
            {isPrixLoading ? (
              <span style={{ color: "#64748b", fontStyle: "italic" }}>📡 calcul…</span>
            ) : prix !== null ? (
              <span style={{ color: "#ef4444", fontWeight: 700 }}>💰 {Number(prix).toFixed(2)} €</span>
            ) : null}
            <span>👥 {r.nb_passagers || r.passagers || 1} passager(s)</span>
            {r.bagages > 0 && <span>🧳 {r.bagages}</span>}
            <span
              style={{
                background: tarif_nuit_card ? "rgba(99,102,241,0.15)" : "rgba(250,204,21,0.12)",
                color: tarif_nuit_card ? "#818cf8" : "#fbbf24",
                padding: "2px 8px",
                borderRadius: 99,
                fontWeight: 700,
              }}
            >
              {tarif_nuit_card ? `🌙 Nuit` : `☀️ Jour`}
            </span>
            <StatusBadge s={r.status} />
          </div>

          {r.message && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(14,165,233,0.06)",
                border: "1px solid rgba(14,165,233,0.15)",
                borderRadius: 10,
                color: "#94a3b8",
                fontSize: 13,
                whiteSpace: "pre-line",
              }}
            >
              💬 {r.message}
            </div>
          )}

          {normalizeStatus(r.status) === "refused" && r.refus_motif && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10,
                color: "#fecaca",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 700, color: "#fca5a5" }}>Motif du refus :</span> {r.refus_motif}
            </div>
          )}

          {/* ── Alerte conflit + bouton Changer l'heure ── */}
          {hasConflict && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: changeHeureOpen[r.id] ? 12 : 0,
                }}
              >
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, flex: 1 }}>
                  Conflit de créneau — une course est déjà planifiée à cette heure
                </span>
                <button
                  onClick={() => setChangeHeureOpen((p) => ({ ...p, [r.id]: !p[r.id] }))}
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    border: "1px solid rgba(245,158,11,0.4)",
                    color: "#f59e0b",
                    padding: "6px 12px",
                    borderRadius: 9,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  🕐 Changer l'heure
                </button>
              </div>
              {changeHeureOpen[r.id] && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="datetime-local"
                    value={
                      changeHeureValue[r.id] ??
                      (r.pickup_datetime ? new Date(r.pickup_datetime).toISOString().slice(0, 16) : "")
                    }
                    onChange={(e) => setChangeHeureValue((p) => ({ ...p, [r.id]: e.target.value }))}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(245,158,11,0.4)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#f8fafc",
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                      colorScheme: "dark",
                    }}
                  />
                  <button
                    onClick={() =>
                      handleChangeHeure(
                        r,
                        changeHeureValue[r.id] ? new Date(changeHeureValue[r.id]).toISOString() : r.pickup_datetime,
                      )
                    }
                    disabled={changeHeureSending[r.id]}
                    style={{
                      background: changeHeureSending[r.id] ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.2)",
                      border: "1px solid rgba(245,158,11,0.5)",
                      color: "#f59e0b",
                      padding: "9px 16px",
                      borderRadius: 10,
                      cursor: changeHeureSending[r.id] ? "wait" : "pointer",
                      fontWeight: 700,
                      fontSize: 13,
                      opacity: changeHeureSending[r.id] ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {changeHeureSending[r.id] ? "⏳ Envoi…" : "✓ Confirmer"}
                  </button>
                  <button
                    onClick={() => setChangeHeureOpen((p) => ({ ...p, [r.id]: false }))}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                      padding: "4px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Boutons PENDING : Accepter / Refuser uniquement ── */}
          {showAcceptRefuse && normalizeStatus(r.status) === "pending" && (
            <div className="accept-refuse-btns" style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={async () => {
                  handleAccept(r);
                  if (!r.distance_km && r.depart && (r.arrivee || r.destination)) {
                    setCardKmLoading((prev) => ({ ...prev, [r.id]: true }));
                    try {
                      const km = await fetchDistanceKm(r.depart, r.arrivee || r.destination);
                      setCardKm((prev) => ({ ...prev, [r.id]: km }));
                    } finally {
                      setCardKmLoading((prev) => ({ ...prev, [r.id]: false }));
                    }
                  }
                }}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: 0,
                  padding: "14px 24px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 15,
                }}
              >
                ✓ Accepter
              </button>
              <button
                onClick={() => handleRefuse(r)}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: 0,
                  padding: "14px 24px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 15,
                }}
              >
                ✗ Refuser
              </button>
            </div>
          )}

          {/* ── Modifier le prix ── */}
          {(normalizeStatus(r.status) === "accepted" || r.status === "en_route" || r.status === "arrived") && (
            <div style={{ marginTop: 14 }}>
              {!customPrix[r.id + "_open"] ? (
                <button
                  onClick={() => setCustomPrix((p) => ({ ...p, [r.id + "_open"]: "1" }))}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(245,200,66,0.3)",
                    color: "#f5c842",
                    padding: "8px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  💶 Modifier le prix
                </button>
              ) : (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(245,200,66,0.07)",
                    border: "1px solid rgba(245,200,66,0.25)",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#f5c842", fontWeight: 700 }}>💶 Nouveau prix à envoyer</span>
                    <button
                      onClick={() =>
                        setCustomPrix((p) => {
                          const n = { ...p };
                          delete n[r.id + "_open"];
                          delete n[r.id];
                          return n;
                        })
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    className="send-prix-row"
                    style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                  >
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      placeholder="Ex : 18.50"
                      value={customPrix[r.id] ?? ""}
                      onChange={(e) => setCustomPrix((p) => ({ ...p, [r.id]: e.target.value }))}
                      autoFocus
                      style={{
                        width: 110,
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(245,200,66,0.35)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#f8fafc",
                        fontSize: 15,
                        fontWeight: 700,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <span style={{ color: "#f5c842", fontWeight: 700, fontSize: 15 }}>€</span>
                    {(r.client_phone || r.telephone) && (
                      <>
                        <button
                          onClick={() => {
                            const v = parseFloat((customPrix[r.id] ?? "").replace(",", "."));
                            handleSendCustomPrix(r, "sms", isNaN(v) ? undefined : v);
                          }}
                          style={{
                            background: "rgba(168,85,247,0.15)",
                            border: "1px solid rgba(168,85,247,0.4)",
                            color: "#c084fc",
                            padding: "9px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          💬 SMS
                        </button>
                        <button
                          onClick={() => {
                            const v = parseFloat((customPrix[r.id] ?? "").replace(",", "."));
                            handleSendCustomPrix(r, "whatsapp", isNaN(v) ? undefined : v);
                          }}
                          style={{
                            background: "rgba(34,197,94,0.12)",
                            border: "1px solid rgba(34,197,94,0.35)",
                            color: "#22c55e",
                            padding: "9px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          🟢 WhatsApp
                        </button>
                      </>
                    )}
                    {(r.client_email || r.email) && (
                      <button
                        onClick={() => {
                          const v = parseFloat((customPrix[r.id] ?? "").replace(",", "."));
                          handleSendCustomPrix(r, "email", isNaN(v) ? undefined : v);
                        }}
                        disabled={customPrixSending[r.id]}
                        style={{
                          background: "rgba(245,200,66,0.12)",
                          border: "1px solid rgba(245,200,66,0.35)",
                          color: "#f5c842",
                          padding: "9px 12px",
                          borderRadius: 10,
                          cursor: customPrixSending[r.id] ? "wait" : "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                          opacity: customPrixSending[r.id] ? 0.6 : 1,
                        }}
                      >
                        {customPrixSending[r.id] ? "⏳…" : "✉️ Email"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Itinéraires alternatifs supprimés : la logique « trajet le plus long (rocade) » est appliquée automatiquement côté OSRM. */}


          {/* ── Bouton annuler uniquement ── */}
          {(normalizeStatus(r.status) === "accepted" || r.status === "en_route" || r.status === "arrived") && (
            <div
              className="status-action-btns"
              style={{
                marginTop: 18,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => handleUpdateReservationStatus(r, "cancelled")}
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                  padding: "10px 14px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                ✖ Annuler
              </button>
            </div>
          )}

          {/* ── Boutons contact : SMS / WhatsApp / Email — uniquement courses acceptées/en cours ── */}
          {(normalizeStatus(r.status) === "accepted" || r.status === "en_route" || r.status === "arrived") &&
            (() => {
              const phone = r.client_phone || r.telephone;
              const mail = r.client_email || r.email;
              const trackUrl =
                r.suivi_id && typeof window !== "undefined" ? `${window.location.origin}/suivi/${r.suivi_id}` : "";
              const greet = `Bonjour ${r.client_name || r.nom || ""}, votre taxi Taxi City Bordeaux.`;
              const body = trackUrl ? `${greet}\nRetrouvez votre course ici : ${trackUrl}` : greet;
              const mailBody = trackUrl
                ? `Bonjour ${r.client_name || r.nom || ""},\n\nVoici le lien pour retrouver et suivre votre course en temps réel :\n${trackUrl}\n\nTaxi City Bordeaux`
                : `Bonjour ${r.client_name || r.nom || ""},\n\nTaxi City Bordeaux`;
              if (!phone && !mail) return null;
              return (
                <div className="contact-btns" style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {phone && (
                    <>
                      <a href={`tel:${phone}`} style={contactBtn("#0ea5e9")}>
                        📞 Appeler
                      </a>
                      <a href={`sms:${phone}?body=${encodeURIComponent(body)}`} style={contactBtn("#a855f7")}>
                        💬 SMS
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={contactBtn("#22c55e")}
                      >
                        🟢 WhatsApp
                      </a>
                    </>
                  )}
                  {mail && (
                    <a
                      href={`mailto:${mail}?subject=${encodeURIComponent("Votre course Taxi City Bordeaux")}&body=${encodeURIComponent(mailBody)}`}
                      style={contactBtn("#f5c842")}
                    >
                      ✉️ Email
                    </a>
                  )}
                </div>
              );
            })()}

          {/* ── Bouton WhatsApp chauffeur — lien GPS ── */}
          {(normalizeStatus(r.status) === "accepted" || r.status === "en_route" || r.status === "arrived") &&
            r.suivi_id &&
            (() => {
              const DRIVER_TOKEN = import.meta.env.VITE_DRIVER_TOKEN ?? "";
              const DRIVER_PHONE = "33673072322";
              const driverLink = `${typeof window !== "undefined" ? window.location.origin : "https://taxicitybordeaux.fr"}/suivi/${r.suivi_id}?driver=${DRIVER_TOKEN}`;
              const depart = r.depart || "—";
              const arrivee = r.arrivee || r.destination || "—";
              const heure = r.pickup_datetime
                ? new Date(r.pickup_datetime).toLocaleString("fr-FR", {
                    timeZone: "Europe/Paris",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : r.heure_course || "—";
              const client = r.client_name || r.nom || "Client";
              const msg = `🚖 Nouvelle course acceptée\n\n📍 Départ : ${depart}\n🏁 Destination : ${arrivee}\n🕐 Heure : ${heure}\n👤 Client : ${client}\n\n👉 Ouvre ce lien pour activer ton GPS :\n${driverLink}`;
              return (
                <div style={{ marginTop: 10 }}>
                  <a
                    href={`https://wa.me/${DRIVER_PHONE}?text=${encodeURIComponent(msg)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "11px 16px",
                      borderRadius: 14,
                      background: "rgba(37,211,102,0.12)",
                      border: "1px solid rgba(37,211,102,0.35)",
                      color: "#25D366",
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      textDecoration: "none",
                      width: "100%",
                      boxSizing: "border-box" as const,
                    }}
                  >
                    📲 Envoyer GPS au chauffeur
                  </a>
                </div>
              );
            })()}
        </div>
      </SwipeDeleteRow>
    );
  }

  // =========================
  // RENDER
  // =========================
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("admin_pin_ok") !== "1") {
    window.location.href = "/login";
    return <div style={{ minHeight: "100vh", background: "#020817" }} />;
  }

  return (
    <div
      className="admin-root"
      style={{
        padding: "20px clamp(10px, 4vw, 24px)",
        fontFamily: "'DM Sans',sans-serif",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <SkeletonStyles />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulseDot{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 0 14px rgba(34,197,94,0.2)}}`}</style>

      {/* ── Header ── */}
      <div
        className="admin-header"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={logo}
            alt="Taxi City Bordeaux"
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              objectFit: "contain",
              background: "#fff",
              padding: 3,
            }}
          />
          <h1
            className="admin-header-title"
            style={{
              fontFamily: "'Syne',sans-serif",
              fontSize: 26,
              fontWeight: 800,
              color: "#f8fafc",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
        </div>
        <div
          className="admin-header-actions"
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          {/* Bouton activation notifications push (admin + chauffeur) — toujours visible, 3 états */}
          {typeof window !== "undefined" && "Notification" in window && (
            <button
              onClick={async () => {
                if (notifPermission === "denied") return;
                // Si déjà granted : on re-enregistre le token (peut avoir changé ou expiré)
                const perm = notifPermission === "granted" ? "granted" : await Notification.requestPermission();
                if (perm !== "granted") {
                  setNotifPermission(perm);
                  return;
                }
                setNotifPermission("granted");
                // Retry jusqu'à 3 fois si getFcmToken échoue (SW peut ne pas être prêt)
                let fcm: string | null = null;
                for (let i = 0; i < 3; i++) {
                  try {
                    fcm = await getFcmToken();
                    if (fcm) break;
                  } catch {}
                  if (i < 2) await new Promise((r) => setTimeout(r, 2000));
                }
                if (!fcm) {
                  toast.error("Impossible d'obtenir le token FCM — réessayez dans quelques secondes");
                  return;
                }
                try {
                  const ua = navigator.userAgent.slice(0, 500);
                  const now = new Date().toISOString();
                  await Promise.all([
                    supabase.from("push_subscriptions").upsert(
                      {
                        audience: "admin",
                        endpoint: `fcm://${fcm}`,
                        fcm_token: fcm,
                        reservation_id: null,
                        user_agent: ua,
                        last_seen_at: now,
                      },
                      { onConflict: "endpoint" },
                    ),
                    supabase.from("push_subscriptions").upsert(
                      {
                        audience: "chauffeur",
                        endpoint: `fcm://${fcm}-chauffeur`,
                        fcm_token: fcm,
                        reservation_id: null,
                        user_agent: ua,
                        last_seen_at: now,
                      },
                      { onConflict: "endpoint" },
                    ),
                  ]);
                  localStorage.setItem("fcm_token", fcm);
                  toast.success("🔔 Token FCM enregistré — notifications actives");
                } catch (e) {
                  console.warn("[push] activation manuelle échouée", e);
                  toast.error("Impossible d'activer les notifications");
                }
              }}
              style={{
                padding: "8px 14px",
                background:
                  notifPermission === "denied"
                    ? "rgba(239,68,68,0.1)"
                    : notifPermission === "granted"
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(245,200,66,0.15)",
                border: `1px solid ${
                  notifPermission === "denied"
                    ? "rgba(239,68,68,0.3)"
                    : notifPermission === "granted"
                      ? "rgba(34,197,94,0.3)"
                      : "rgba(245,200,66,0.4)"
                }`,
                color: notifPermission === "denied" ? "#f87171" : notifPermission === "granted" ? "#86efac" : "#f5c842",
                borderRadius: 10,
                cursor: notifPermission === "default" ? "pointer" : "default",
                fontWeight: 600,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              disabled={notifPermission === "denied"}
              title={
                notifPermission === "denied"
                  ? "Notifications bloquées — autorisez-les dans les réglages du navigateur"
                  : notifPermission === "granted"
                    ? "Notifications activées ✓"
                    : "Activer les notifications push"
              }
            >
              {notifPermission === "denied"
                ? "🔕 Bloqué"
                : notifPermission === "granted"
                  ? "🔔 Notifs actives"
                  : "🔔 Activer notifs"}
            </button>
          )}
          <button
            onClick={() => setShowPushDebug((v) => !v)}
            title="Diagnostic push notifications"
            style={{
              padding: "8px 10px",
              background: showPushDebug ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showPushDebug ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.12)"}`,
              color: showPushDebug ? "#818cf8" : "#94a3b8",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            🔍
          </button>
          {showPushDebug && <PushDebug />}
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
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Site
          </a>
          <button
            onClick={async () => {
              if (refreshing) return;
              await fetchAll();
            }}
            disabled={refreshing}
            style={{
              padding: "8px 14px",
              background: "rgba(14,165,233,0.15)",
              border: "1px solid rgba(14,165,233,0.3)",
              color: refreshing ? "#64748b" : "#0ea5e9",
              borderRadius: 10,
              cursor: refreshing ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation: refreshing ? "spin 1s linear infinite" : "none",
              }}
            >
              ↻
            </span>
            {refreshing ? "…" : "Actualiser"}
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{
              padding: "8px 14px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🔓 Déco
          </button>
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{adminMobileCss}</style>

      {/* ── GPS — EN HAUT pour accès rapide ── */}
      <div style={{ marginBottom: 24 }}>
        <style>{`.gps-pulse{animation:pulseDot 2s infinite}`}</style>
        {gpsLoading ? (
          <GpsCardSkeleton />
        ) : (
          <div
            style={{
              ...card,
              border: gpsActive ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)",
              background: gpsActive ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.04)",
              borderRadius: 20,
              padding: "16px 20px",
            }}
          >
            <div className="gps-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Indicateur GPS */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                {gpsActive ? (
                  <>
                    <div
                      className="gps-pulse"
                      style={{
                        width: 14,
                        height: 14,
                        background: gpsError ? "#f59e0b" : "#22c55e",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 800,
                          fontSize: 15,
                          color: gpsError ? "#f59e0b" : "#22c55e",
                        }}
                      >
                        {gpsError ? "⚠️ GPS — signal faible" : "📡 GPS actif"}
                      </div>
                      {gpsError ? (
                        <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>{gpsError}</div>
                      ) : gpsPosition ? (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {gpsPosition.lat.toFixed(4)}, {gpsPosition.lng.toFixed(4)}{" "}
                          {gpsAccuracy !== null && `· ±${gpsAccuracy}m`} · {gpsUpdateCount} màj
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Acquisition du signal…</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        background: "#475569",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "'Syne',sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#64748b",
                      }}
                    >
                      📡 GPS inactif
                    </div>
                  </>
                )}
              </div>
              {/* Course liée */}
              {gpsActive &&
                activeResaId &&
                (() => {
                  const linked = items.find((x) => x.id === activeResaId);
                  if (!linked) return null;
                  return (
                    <div
                      style={{
                        background: "rgba(34,197,94,0.1)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 10,
                        padding: "6px 12px",
                        fontSize: 13,
                        color: "#22c55e",
                        fontWeight: 700,
                      }}
                    >
                      → {linked.client_name || linked.nom || "Client"}
                    </div>
                  );
                })()}
              {/* Boutons GPS groupés pour mobile */}
              <div
                className="gps-btn-row"
                style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}
              >
                {/* Bouton toggle GPS unique */}
                <button
                  onClick={() => (gpsActive ? stopGPS() : startGPS())}
                  style={{
                    background: gpsActive ? "transparent" : "linear-gradient(135deg, #22c55e, #16a34a)",
                    color: gpsActive ? "#475569" : "#fff",
                    border: gpsActive ? "1px solid rgba(255,255,255,0.08)" : "none",
                    padding: "10px 16px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    boxShadow: gpsActive ? "none" : "0 4px 12px rgba(34,197,94,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {gpsActive ? "⏹ Couper" : "▶ Activer"}
                </button>
              </div>
            </div>
            {/* Mini-map */}
            {gpsActive && (
              <div
                ref={gpsMapRef}
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 14,
                  overflow: "hidden",
                  marginTop: 14,
                  border: "1px solid rgba(34,197,94,0.2)",
                  position: "relative",
                }}
              />
            )}
            {autoTransition && (
              <div
                style={{
                  background: "rgba(245,200,66,0.12)",
                  border: "1px solid rgba(245,200,66,0.3)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  marginTop: 10,
                  fontSize: 13,
                  color: "#f5c842",
                  fontWeight: 700,
                }}
              >
                🔄 Transition vers la prochaine course…
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div
        className="admin-kpi-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 14 }}
      >
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { i: "💶", v: `${caJ.toFixed(2)} €`, l: "CA aujourd'hui" },
              { i: "📈", v: `${caM.toFixed(2)} €`, l: "CA ce mois" },
              { i: "🚗", v: String(coursesJ), l: "Courses auj." },
              { i: "👥", v: String(clientsTotal), l: "Clients total" },
            ].map((c, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 22 }}>{c.i}</div>
                <div className="admin-stat-val" style={valCss}>
                  {c.v}
                </div>
                <div style={labelCss}>{c.l}</div>
              </div>
            ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {statsLoading ? (
          <StatCardSkeleton />
        ) : (
          <div style={card}>
            <div style={{ fontSize: 22 }}>👁️</div>
            <div style={valCss}>{visitors}</div>
            <div style={labelCss}>Visiteurs auj.</div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════
          SECTION COURSES
      ══════════════════════════════ */}
      <div>
        <h2
          style={{
            fontFamily: "'Syne',sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: "#f8fafc",
            margin: "0 0 24px",
          }}
        >
          Courses
        </h2>

        {coursesLoading && (
          <>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </>
        )}

        {/* ── En attente ── */}
        {!coursesLoading && (
          <div style={{ marginBottom: 36 }}>
            <SectionHeader
              color="#f59e0b"
              label="En attente"
              count={counts.pending}
              borderColor="rgba(245,158,11,0.25)"
            />
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
              ← Swipez pour supprimer · Acceptez ou refusez chaque course
            </div>
            {pending.length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "20px 0" }}>
                Aucune réservation en attente ✓
              </div>
            )}
            {pending.map((r) => (
              <CourseCard key={r.id} r={r} showAcceptRefuse />
            ))}
          </div>
        )}

        {/* ── En cours (en_route + arrived) ── */}
        {!coursesLoading && inProgress.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionHeader
              color="#f5c842"
              label="En cours"
              count={inProgress.length}
              borderColor="rgba(245,200,66,0.25)"
            />
            {inProgress.map((r) => (
              <CourseCard key={r.id} r={r} />
            ))}
          </div>
        )}

        {/* ── Acceptées (planifiées) ── */}
        {!coursesLoading && (
          <div style={{ marginBottom: 36 }}>
            <SectionHeader
              color="#22c55e"
              label="Acceptées"
              count={counts.accepted}
              borderColor="rgba(34,197,94,0.25)"
            />
            {accepted.length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "20px 0" }}>Aucune course acceptée</div>
            )}
            {accepted.map((r) => (
              <CourseCard key={r.id} r={r} />
            ))}
          </div>
        )}

        {/* ── Terminées ── */}
        {!coursesLoading && completed.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <SectionHeader
              color="#22c55e"
              label="Terminées"
              count={completed.length}
              borderColor="rgba(34,197,94,0.25)"
            />
            {completed.map((r) => (
              <SwipeDeleteRow
                key={r.id}
                onDelete={() => handleDeleteReservation(r.id)}
                disabled={deleteBusy}
                style={{ marginBottom: 14 }}
              >
                <div style={{ ...card, opacity: 0.7 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{r.client_name || r.nom}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                        {r.pickup_datetime
                          ? formatParis(r.pickup_datetime, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : new Date(r.created_at).toLocaleString("fr-FR", {
                              timeZone: "Europe/Paris",
                            })}
                      </div>
                      <div style={{ color: "#94a3b8", marginTop: 6, fontSize: 13 }}>
                        <div>🟢 {r.depart}</div>
                        <div style={{ marginTop: 2 }}>📍 {r.destination || r.arrivee}</div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 6,
                      }}
                    >
                      <StatusBadge s={r.status} />
                    </div>
                  </div>
                  {(() => {
                    const p = getPrix(r);
                    return p ? (
                      <div style={{ marginTop: 8, color: "#0ea5e9", fontWeight: 700, fontSize: 15 }}>
                        💰 {p.toFixed(2)} €
                      </div>
                    ) : null;
                  })()}
                </div>
              </SwipeDeleteRow>
            ))}
          </div>
        )}

        {/* ── Refusées ── */}
        {!coursesLoading && (
          <div style={{ marginBottom: 36 }}>
            <SectionHeader color="#ef4444" label="Refusées" count={counts.refused} borderColor="rgba(239,68,68,0.25)" />
            {refused.length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "20px 0" }}>Aucune course refusée</div>
            )}
            {refused.map((r) => (
              <SwipeDeleteRow
                key={r.id}
                onDelete={() => handleDeleteReservation(r.id)}
                disabled={deleteBusy}
                style={{ marginBottom: 14 }}
              >
                <div style={{ ...card }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{r.client_name || r.nom}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                        {r.pickup_datetime
                          ? formatParis(r.pickup_datetime, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : new Date(r.created_at).toLocaleString("fr-FR", {
                              timeZone: "Europe/Paris",
                            })}
                      </div>
                      <div style={{ color: "#cbd5e1", marginTop: 6, fontSize: 13 }}>
                        <div>🟢 {r.depart}</div>
                        <div style={{ marginTop: 2 }}>📍 {r.destination || r.arrivee}</div>
                      </div>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}></div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      fontSize: 13,
                      color: "#94a3b8",
                    }}
                  >
                    <span>👥 {r.nb_passagers || r.passagers || 1} pax</span>
                    <StatusBadge s={r.status} />
                  </div>
                  {r.refus_motif && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "8px 12px",
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: 10,
                        color: "#fecaca",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#fca5a5" }}>Motif :</span> {r.refus_motif}
                    </div>
                  )}
                  <div className="contact-btns" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(() => {
                      const trackUrl =
                        r.suivi_id && typeof window !== "undefined"
                          ? `${window.location.origin}/suivi/${r.suivi_id}`
                          : "";
                      const greet = `Bonjour ${r.client_name || r.nom || ""}, votre taxi Taxi City Bordeaux.`;
                      const body = trackUrl ? `${greet}\nSuivre votre chauffeur : ${trackUrl}` : greet;
                      const phone = r.client_phone || r.telephone;
                      const mail = r.client_email || r.email;
                      const mailBody = trackUrl
                        ? `Bonjour ${r.client_name || r.nom || ""},\n\nVoici le lien pour suivre votre chauffeur en temps réel :\n${trackUrl}\n\nTaxi City Bordeaux`
                        : `Bonjour ${r.client_name || r.nom || ""},\n\nTaxi City Bordeaux`;
                      return (
                        <>
                          {phone && (
                            <>
                              <a href={`tel:${phone}`} style={contactBtn("#0ea5e9")}>
                                📞 Appeler
                              </a>
                              <a href={`sms:${phone}?body=${encodeURIComponent(body)}`} style={contactBtn("#a855f7")}>
                                💬 SMS
                              </a>
                              <a
                                href={`https://wa.me/${phone.replace(/[^0-9]/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(body)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={contactBtn("#22c55e")}
                              >
                                🟢 WhatsApp
                              </a>
                            </>
                          )}
                          {mail && (
                            <a
                              href={`mailto:${mail}?subject=${encodeURIComponent("Votre course Taxi City Bordeaux")}&body=${encodeURIComponent(mailBody)}`}
                              style={contactBtn("#f5c842")}
                            >
                              ✉️ Email
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </SwipeDeleteRow>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════
          SECTION AVIS
      ══════════════════════════════ */}
      <div style={{ marginTop: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <h2
            style={{
              fontFamily: "'Syne',sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: "#f8fafc",
              margin: 0,
            }}
          >
            ⭐ Avis clients
          </h2>
          {avis.filter((a) => a.status === "pending" || !a.status).length > 0 && (
            <span
              style={{
                background: "rgba(251,191,36,0.15)",
                color: "#fbbf24",
                padding: "2px 10px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {avis.filter((a) => a.status === "pending" || !a.status).length} en attente
            </span>
          )}
        </div>

        {avisLoading && <div style={{ textAlign: "center", color: "#475569", padding: 40 }}>Chargement des avis…</div>}

        {/* En attente de modération */}
        {!avisLoading && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(251,191,36,0.2)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#fbbf24",
                  boxShadow: "0 0 6px rgba(251,191,36,0.6)",
                }}
              />
              <span
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fbbf24",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                En attente
              </span>
            </div>
            {avis.filter((a) => !a.status || a.status === "pending").length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "16px 0", fontSize: 14 }}>
                Aucun avis en attente
              </div>
            )}
            {avis
              .filter((a) => !a.status || a.status === "pending")
              .map((a) => (
                <SwipeDeleteRow key={a.id} onDelete={() => handleDeleteAvis(a.id)} style={{ marginBottom: 12 }}>
                  <div style={{ ...card, border: "1px solid rgba(251,191,36,0.2)" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15 }}>
                          {a.author_name || a.nom || "Anonyme"}
                        </span>
                        {a.note && (
                          <span style={{ marginLeft: 10, color: "#fbbf24", fontSize: 14 }}>
                            {"★".repeat(Math.min(5, Math.max(1, Number(a.note))))}
                          </span>
                        )}
                      </div>
                      <span style={{ color: "#64748b", fontSize: 12 }}>
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p
                      style={{
                        color: "#cbd5e1",
                        fontSize: 14,
                        margin: "0 0 14px",
                        lineHeight: 1.6,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {a.message || a.content || a.texte}
                    </p>
                    <div className="avis-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleAvisAction(a.id, "approved")}
                        style={{
                          background: "#22c55e",
                          color: "#fff",
                          border: 0,
                          padding: "9px 16px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        ✓ Publier
                      </button>
                      <button
                        onClick={() => handleAvisAction(a.id, "refused")}
                        style={{
                          background: "rgba(239,68,68,0.15)",
                          border: "1px solid rgba(239,68,68,0.3)",
                          color: "#f87171",
                          padding: "9px 16px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        ✗ Refuser
                      </button>
                      <button
                        onClick={() => handleDeleteAvis(a.id)}
                        style={{
                          marginLeft: "auto",
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.15)",
                          color: "#f87171",
                          padding: "9px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </SwipeDeleteRow>
              ))}
          </div>
        )}

        {/* Publiés */}
        {!avisLoading && avis.filter((a) => a.status === "approved").length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 6px rgba(34,197,94,0.6)",
                }}
              />
              <span
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#22c55e",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Publiés
              </span>
              <span
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#22c55e",
                  padding: "1px 8px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {avis.filter((a) => a.status === "approved").length}
              </span>
            </div>
            {avis
              .filter((a) => a.status === "approved")
              .map((a) => (
                <SwipeDeleteRow key={a.id} onDelete={() => handleDeleteAvis(a.id)} style={{ marginBottom: 10 }}>
                  <div style={{ ...card, border: "1px solid rgba(34,197,94,0.15)" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <div>
                        <span style={{ color: "#f8fafc", fontWeight: 700 }}>{a.author_name || a.nom || "Anonyme"}</span>
                        {a.note && (
                          <span style={{ marginLeft: 10, color: "#fbbf24", fontSize: 13 }}>
                            {"★".repeat(Math.min(5, Math.max(1, Number(a.note))))}
                          </span>
                        )}
                        <span
                          style={{
                            marginLeft: 8,
                            background: "rgba(34,197,94,0.15)",
                            color: "#22c55e",
                            padding: "1px 7px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Publié
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: "#64748b", fontSize: 12 }}>
                          {new Date(a.created_at).toLocaleDateString("fr-FR")}
                        </span>
                        <button
                          onClick={() => handleDeleteAvis(a.id)}
                          style={{
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            color: "#f87171",
                            padding: "5px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: 13,
                        margin: 0,
                        lineHeight: 1.5,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {a.message || a.content || a.texte}
                    </p>
                  </div>
                </SwipeDeleteRow>
              ))}
          </div>
        )}

        {/* Refusés */}
        {!avisLoading && avis.filter((a) => a.status === "refused").length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />
              <span
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ef4444",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Refusés
              </span>
              <span
                style={{
                  background: "rgba(239,68,68,0.15)",
                  color: "#ef4444",
                  padding: "1px 8px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {avis.filter((a) => a.status === "refused").length}
              </span>
            </div>
            {avis
              .filter((a) => a.status === "refused")
              .map((a) => (
                <SwipeDeleteRow key={a.id} onDelete={() => handleDeleteAvis(a.id)} style={{ marginBottom: 10 }}>
                  <div style={{ ...card, border: "1px solid rgba(239,68,68,0.12)", opacity: 0.7 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div>
                        <span style={{ color: "#f8fafc", fontWeight: 700 }}>{a.author_name || a.nom || "Anonyme"}</span>
                        {a.note && (
                          <span style={{ marginLeft: 10, color: "#fbbf24", fontSize: 13 }}>
                            {"★".repeat(Math.min(5, Math.max(1, Number(a.note))))}
                          </span>
                        )}
                        <span
                          style={{
                            marginLeft: 8,
                            background: "rgba(239,68,68,0.15)",
                            color: "#ef4444",
                            padding: "1px 7px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Refusé
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleAvisAction(a.id, "approved")}
                          style={{
                            background: "rgba(34,197,94,0.12)",
                            border: "1px solid rgba(34,197,94,0.3)",
                            color: "#4ade80",
                            padding: "5px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          Republier
                        </button>
                        <button
                          onClick={() => handleDeleteAvis(a.id)}
                          style={{
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            color: "#f87171",
                            padding: "5px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: 13,
                        margin: 0,
                        lineHeight: 1.5,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {a.message || a.content || a.texte}
                    </p>
                  </div>
                </SwipeDeleteRow>
              ))}
          </div>
        )}
      </div>

      {/* ── Modale Accepter ── */}

      {/* ── Modale carte tracé ── */}
      {mapModal && (
        <MapTraceModal
          alt={mapModal.alt}
          r={mapModal.r}
          onClose={() => setMapModal(null)}
          onChoose={() => {
            handleSelectItineraire(mapModal.r, mapModal.alt);
            setMapModal(null);
          }}
        />
      )}
    </div>
  );
}

function MapTraceModal({
  alt,
  r,
  onClose,
  onChoose,
}: {
  alt: ItineraryAlt;
  r: any;
  onClose: () => void;
  onChoose: () => void;
}) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !alt.coords.length) return;

    // Fix 1 — ensure Leaflet CSS/JS are loaded with the same IDs used by the GPS mini-map
    // so the script is never injected twice across the two components.
    const ensureLeaflet = (): Promise<void> =>
      new Promise((resolve) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        if (!document.getElementById("leaflet-css-admin")) {
          const link = document.createElement("link");
          link.id = "leaflet-css-admin";
          link.rel = "stylesheet";
          link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
          document.head.appendChild(link);
        }
        if (!document.getElementById("leaflet-js-admin")) {
          const s = document.createElement("script");
          s.id = "leaflet-js-admin";
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
          s.onload = () => resolve();
          document.head.appendChild(s);
        } else {
          // Script tag already present — poll until window.L is populated
          const poll = setInterval(() => {
            if ((window as any).L) {
              clearInterval(poll);
              resolve();
            }
          }, 50);
        }
      });

    let cancelled = false;
    (async () => {
      await ensureLeaflet();
      if (cancelled || !mapContainerRef.current) return;

      const L = (window as any).L;

      // Fix 2 — destroy any stale map instance before creating a new one so that
      // reopening the modal never triggers "Map container is already initialized".
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Initialiser la carte
      const map = L.map(mapContainerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // Tracé de la route (style Uber noir, fin)
      const poly = L.polyline(alt.coords, { color: "#000000", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);

      // Marqueurs départ / arrivée
      const iconDepart = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7],
      });
      const iconArrivee = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7],
      });
      L.marker(alt.coords[0], { icon: iconDepart })
        .addTo(map)
        .bindPopup(r.depart || "Départ");
      L.marker(alt.coords[alt.coords.length - 1], { icon: iconArrivee })
        .addTo(map)
        .bindPopup(r.destination || r.arrivee || "Arrivée");

      map.fitBounds(poly.getBounds(), { padding: [60, 60], maxZoom: 16, animate: true });
    })(); // end async IIFE

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [alt, r]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e293b",
          borderRadius: 16,
          width: "100%",
          maxWidth: 540,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 15 }}>
            {alt.label} — {alt.km} km · <span style={{ color: "#f5c842" }}>{alt.prix.toFixed(2)} €</span>
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <div ref={mapContainerRef} style={{ height: 360, width: "100%" }} />
        <div style={{ padding: 14 }}>
          <button
            onClick={onChoose}
            style={{
              width: "100%",
              padding: 12,
              background: "#f5c842",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              color: "#0f172a",
            }}
          >
            ✓ Choisir ce trajet
          </button>
        </div>
      </div>
    </div>
  );
}
