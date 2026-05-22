import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, calculerPrixMixte } from "@/lib/tarif";
import { getDistanceAndDurationKm } from "@/lib/osrm";
import { geocodeAddress } from "@/lib/geocode";
import { assertTrackingId, newTrackingId } from "@/lib/tracking-id";
import { CourseCardSkeleton, GpsCardSkeleton, SkeletonStyles, StatCardSkeleton } from "@/components/admin/Skeleton";
import logo from "@/assets/logo.jpeg";
import { EnablePushButton } from "@/components/EnablePushButton";
import { notifyReservationStatus, notifyNewReservation } from "@/lib/push.functions";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_TILE_OPTIONS = { attribution: "© OpenStreetMap contributors", maxZoom: 19 };

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
      style={{ background: v.bg, color: v.c, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}
    >
      {v.label}
    </span>
  );
}

function formatParis(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...opts });
}

function isNuit(iso: string): boolean {
  const h = parseInt(
    new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }),
    10,
  );
  return h >= 20 || h < 6;
}

const normalizeStatus = (s: unknown): "pending" | "accepted" | "refused" => {
  if (s === "accepted") return "accepted";
  if (s === "refused") return "refused";
  return "pending";
};

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
  const [nextCourse, setNextCourse] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Courses ──
  const [items, setItems] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, refused: 0 });

  // ── Actions ──
  const [confirmAction, setConfirmAction] = useState<{ type: "accept" | "refuse"; r: any } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [autoKm, setAutoKm] = useState<number | null>(null);
  const [kmLoading, setKmLoading] = useState(false);
  const [cardKm, setCardKm] = useState<Record<string, number>>({});
  const [cardKmLoading, setCardKmLoading] = useState<Record<string, boolean>>({});
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Avis ──
  const [avis, setAvis] = useState<any[]>([]);
  const [avisLoading, setAvisLoading] = useState(true);
  const initialLoad = useRef(true);

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
    const [caJR, caMR, cJR, cliR, visR, nextR] = await Promise.all([
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
      supabase
        .from("reservations")
        .select("*")
        .eq("status", "accepted")
        .or(`pickup_datetime.gte.${nowIso},pickup_datetime.is.null`)
        .order("pickup_datetime", { ascending: true, nullsFirst: false })
        .limit(1),
    ]);
    setCaJ((caJR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCaM((caMR.data ?? []).reduce((s: number, c: any) => s + (Number(c.prix_final) || 0), 0));
    setCoursesJ(cJR.count ?? 0);
    setClientsTotal(cliR.count ?? 0);
    setVisitors(new Set((visR.data ?? []).map((v: any) => v.session_id)).size);
    setNextCourse((nextR.data ?? [])[0] ?? null);
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

  // =========================
  // REALTIME
  // =========================
  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("dash-courses")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
        if (!initialLoad.current) {
          const n = payload.new as any;
          const clientName = n.client_name || n.nom || "Client";
          try {
            new Audio("/notification.mp3").play().catch(() => {});
          } catch {}
          if (n.id) {
            notifyNewReservation({ data: { reservation_id: n.id } }).catch(() => {});
          }
          if (typeof window !== "undefined" && "Notification" in window) {
            const fire = () => {
              try {
                new Notification("🔔 Nouvelle réservation", {
                  body: `${clientName} — ${n.depart || ""} → ${n.arrivee || n.destination || ""}`,
                  icon: "/favicon.ico",
                  tag: `reservation-${n.id}`,
                  requireInteraction: true,
                });
              } catch {}
            };
            if (Notification.permission === "granted") fire();
            else if (Notification.permission === "default")
              Notification.requestPermission().then((p) => {
                if (p === "granted") fire();
              });
          }
          if (typeof window !== "undefined") {
            const t = document.createElement("div");
            t.textContent = `🔔 Nouvelle réservation de ${clientName}`;
            t.style.cssText = `position:fixed;top:20px;right:20px;background:#0ea5e9;color:white;padding:14px 20px;border-radius:12px;font-family:DM Sans,sans-serif;font-weight:700;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.3);`;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 5000);
          }
        }
        fetchAll();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "site_analytics" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "avis" }, () => fetchAvis())
      .subscribe();
    initialLoad.current = false;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAll, fetchStats]);

  // =========================
  // GPS INIT
  // =========================
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const initGPS = async () => {
      const { data, error } = await (supabase as any).from("driver_gps").select("*").eq("id", "driver").single();
      if (error || !data) {
        await (supabase as any)
          .from("driver_gps")
          .insert({ id: "driver", is_active: false, latitude: 0, longitude: 0 });
      }
      setGpsLoading(false);
    };
    initGPS();
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined")
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // GPS mini-map
  useEffect(() => {
    if (!gpsActive || !gpsMapRef.current) return;
    const L = (window as any).L;
    const initMap = async () => {
      if (!L) {
        await new Promise<void>((resolve) => {
          if (!document.getElementById("leaflet-css-admin")) {
            const link = document.createElement("link");
            link.id = "leaflet-css-admin";
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(link);
          }
          if (!document.getElementById("leaflet-js-admin")) {
            const s = document.createElement("script");
            s.id = "leaflet-js-admin";
            s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            s.onload = () => resolve();
            document.head.appendChild(s);
          } else {
            const poll = setInterval(() => {
              if ((window as any).L) {
                clearInterval(poll);
                resolve();
              }
            }, 50);
          }
        });
      }
      const Lx = (window as any).L;
      if (!gpsMapRef.current || gpsMapInst.current) return;
      const center: [number, number] = gpsPosition ? [gpsPosition.lat, gpsPosition.lng] : [44.8378, -0.5792];
      const map = Lx.map(gpsMapRef.current, { center, zoom: 15, zoomControl: true, attributionControl: false });
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
  }, [coursesLoading, gpsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
      toast.success("🔄 Nouvelle course détectée", {
        description: `${next.client_name || next.nom || "prochain client"}${next.arrivee || next.destination ? ` → ${next.arrivee || next.destination}` : ""}`,
        duration: 6000,
      });
      setTimeout(() => setAutoTransition(false), 3000);
    } else {
      setActiveResaId(null);
      activeResaIdRef.current = null;
      toast("🏁 Course terminée", { description: "GPS toujours actif — aucune prochaine course.", duration: 5000 });
    }
  }, [items, gpsActive, activeResaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // CALCUL DISTANCE
  // =========================
  const fetchDistanceKm = async (depart: string, arrivee: string): Promise<number> => {
    const geocode = async (address: string) => {
      try {
        return await geocodeAddress(address + ", Bordeaux, France");
      } catch {}
      return null;
    };
    const [a, b] = await Promise.all([geocode(depart), geocode(arrivee)]);
    if (a && b) {
      try {
        const dd = await getDistanceAndDurationKm([a.lng, a.lat], [b.lng, b.lat]);
        if (dd && dd.distanceKm && dd.distanceKm > 0) return Math.round(dd.distanceKm * 10) / 10;
      } catch {}
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
    let trackingId: string;
    try {
      trackingId = r.tracking_id ? assertTrackingId(r.tracking_id) : newTrackingId();
      assertTrackingId(trackingId);
    } catch (e) {
      toast.error("Impossible d'accepter la course", {
        description: e instanceof Error ? e.message : "tracking_id invalide",
      });
      return;
    }
    const tarifNuitCourse = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
    const km = r.distance_km ? Number(r.distance_km) : (autoKm ?? 5);
    const prixCalcule = r.pickup_datetime
      ? calculerPrixMixte(km, r.pickup_datetime)
      : calculerPrix(km, !tarifNuitCourse);

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "accepted",
        tracking_id: trackingId,
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
      const { data: existing } = await supabase
        .from("clients")
        .select("id,total_courses")
        .eq("phone", phone)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("clients")
          .update({ total_courses: (existing.total_courses ?? 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabase.from("clients").insert({ name, phone, email, total_courses: 1 });
      }
    }

    try {
      new Audio("/notification.mp3").play().catch(() => {});
    } catch {}

    const url = typeof window !== "undefined" ? `${window.location.origin}/scan/${trackingId}` : "";
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }

    const notifParts: string[] = [];

    // 🔔 Push automatique (toujours)
    let pushSent = 0;
    try {
      const pushResult = await notifyReservationStatus({ data: { reservation_id: r.id, status: "accepted" } });
      pushSent = (pushResult as any)?.client?.sent ?? 0;
    } catch {}
    notifParts.push(pushSent > 0 ? `🔔 Push envoyée` : `🔕 Pas d'abonné push`);

    // ✉️ Email automatique (si email disponible)
    if (email && url) {
      const adminSecret = "admin-pin-call";
      const pickupFormatted = r.pickup_datetime
        ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
        : undefined;
      const prixStr = `${Number(prixCalcule).toFixed(2)} €`;
      const tarifLabel = tarifNuitCourse ? `Nuit (${TARIF_NUIT_LABEL})` : `Jour (${TARIF_JOUR_LABEL})`;
      try {
        const res = await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
          body: JSON.stringify({
            templateName: "course-accepted",
            recipientEmail: email,
            idempotencyKey: `course-accepted-${r.id}`,
            templateData: {
              nom: name,
              depart: r.depart,
              arrivee: r.arrivee || r.destination,
              pickup_datetime: pickupFormatted,
              prix: prixStr,
              tarif: tarifLabel,
              tracking_url: url,
              passagers: r.nb_passagers || r.passagers || 1,
              bagages: r.bagages ?? 0,
            },
          }),
        });
        notifParts.push(res.ok ? `✉️ Email envoyé` : `⚠️ Échec email`);
      } catch {
        notifParts.push("⚠️ Échec email");
      }
    }

    toast.success(`✅ Course acceptée — ${name || "client"}`, { description: notifParts.join(" · "), duration: 8000 });
    fetchAll();
  };

  // =========================
  // REFUSE
  // =========================
  const handleRefuse = async (r: any, motif: string) => {
    const cleaned = motif.trim();
    if (cleaned.length < 3) {
      toast.error("Motif requis", { description: "3 caractères minimum." });
      return false;
    }
    const { error } = await supabase
      .from("reservations")
      .update({ status: "refused", refus_motif: cleaned, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast.error("Échec du refus", { description: error.message });
      return false;
    }
    let pushSent = 0;
    try {
      const res = await notifyReservationStatus({ data: { reservation_id: r.id, status: "refused" } });
      pushSent = (res as any)?.client?.sent ?? 0;
    } catch {}
    toast.success(`❌ Course refusée — ${r.client_name || r.nom || "client"}`, {
      description: `${pushSent > 0 ? "🔔 Push envoyée · " : ""}Motif : « ${cleaned.slice(0, 60)}${cleaned.length > 60 ? "…" : ""} »`,
      duration: 7000,
    });
    fetchAll();
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
      const result = await notifyReservationStatus({ data: { reservation_id: r.id, status: status as any } });
      if (typeof window !== "undefined" && (result as any)?.smsPhone && (result as any)?.smsBody) {
        window.open(`sms:${(result as any).smsPhone}?body=${(result as any).smsBody}`, "_blank");
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
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
    } else {
      toast.success("Réservation supprimée");
      setItems((prev) => prev.filter((r) => r.id !== id));
      setCounts((prev) => {
        const item = items.find((r) => r.id === id);
        if (!item) return prev;
        const k = normalizeStatus(item.status);
        return { ...prev, [k]: Math.max(0, prev[k] - 1) };
      });
    }
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
  const startGPS = async (resaId?: string) => {
    if (!navigator.geolocation) return;
    await (supabase as any)
      .from("driver_gps")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", "driver");
    const linkedId = resaId ?? null;
    setActiveResaId(linkedId);
    activeResaIdRef.current = linkedId;
    setGpsActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy: acc, heading: rawHeading } = pos.coords;
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
        setGpsPosition({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(acc));
        setGpsUpdateCount((n) => n + 1);
        await (supabase as any)
          .from("driver_gps")
          .update({
            latitude,
            longitude,
            accuracy: acc,
            heading: computedHeading,
            updated_at: new Date().toISOString(),
          })
          .eq("id", "driver");
        await (supabase as any)
          .from("taxi_positions")
          .upsert({
            id: "00000000-0000-0000-0000-000000000001",
            lat: latitude,
            lng: longitude,
            heading: computedHeading ?? 0,
            speed: pos.coords.speed ?? 0,
            updated_at: new Date().toISOString(),
          });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
  };

  const stopGPS = async () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    await (supabase as any)
      .from("driver_gps")
      .update({ is_active: false, destination: null, prix_estime: null })
      .eq("id", "driver");
    setGpsActive(false);
    setGpsPosition(null);
    setGpsAccuracy(null);
    setGpsUpdateCount(0);
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

    return (
      <SwipeDeleteRow onDelete={() => handleDeleteReservation(r.id)} disabled={deleteBusy} style={{ marginBottom: 14 }}>
        <div style={{ ...card }}>
          {/* En-tête */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{name}</div>
              <div style={{ color: "#cbd5e1", marginTop: 8 }}>
                🟢 {r.depart} → 📍 {dest}
              </div>
            </div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              {pickupFormatted ? (
                <span>
                  🕐 <b style={{ color: "#f8fafc" }}>{pickupFormatted}</b>
                </span>
              ) : (
                new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
              )}
            </div>
          </div>

          {/* Infos */}
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", color: "#94a3b8", fontSize: 13 }}>
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

          {/* ── Boutons PENDING : Accepter / Refuser uniquement ── */}
          {showAcceptRefuse && normalizeStatus(r.status) === "pending" && (
            <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={async () => {
                  setAutoKm(r.distance_km ? Number(r.distance_km) : null);
                  setConfirmAction({ type: "accept", r });
                  if (!r.distance_km && r.depart && (r.arrivee || r.destination)) {
                    setKmLoading(true);
                    try {
                      const km = await fetchDistanceKm(r.depart, r.arrivee || r.destination);
                      setAutoKm(km);
                    } finally {
                      setKmLoading(false);
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
                onClick={() => setConfirmAction({ type: "refuse", r })}
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

          {/* ── Boutons statut (automatique — push envoyée à chaque étape) ── */}
          {(normalizeStatus(r.status) === "accepted" || r.status === "en_route" || r.status === "arrived") && (
            <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {r.status !== "en_route" && (
                <button
                  onClick={() => handleUpdateReservationStatus(r, "en_route")}
                  style={{
                    background: "#f59e0b",
                    color: "#0a0a14",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  🚗 En route
                </button>
              )}
              {r.status !== "arrived" && (
                <button
                  onClick={() => handleUpdateReservationStatus(r, "arrived")}
                  style={{
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  📍 Arrivé
                </button>
              )}
              {r.status !== "completed" && (
                <button
                  onClick={() => handleUpdateReservationStatus(r, "completed")}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  🏁 Terminé
                </button>
              )}
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
        </div>
      </SwipeDeleteRow>
    );
  }

  // =========================
  // RENDER
  // =========================
  return (
    <div
      style={{
        padding: "20px clamp(12px, 4vw, 24px)",
        fontFamily: "'DM Sans',sans-serif",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <SkeletonStyles />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulseDot{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 0 14px rgba(34,197,94,0.2)}}`}</style>

      {/* ── Header ── */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={logo}
            alt="Taxi City Bordeaux"
            style={{ width: 48, height: 48, borderRadius: 12, objectFit: "contain", background: "#fff", padding: 3 }}
          />
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
            Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Un seul bouton notifications unifié */}
          <EnablePushButton audience="admin" size="sm" label="🔔 Notifs" />
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
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>
              ↻
            </span>
            {refreshing ? "…" : "Actualiser"}
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/admin/login";
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
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Indicateur GPS */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                {gpsActive ? (
                  <>
                    <div
                      className="gps-pulse"
                      style={{ width: 14, height: 14, background: "#22c55e", borderRadius: "50%", flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#22c55e" }}>
                        📡 GPS actif
                      </div>
                      {gpsPosition && (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {gpsPosition.lat.toFixed(4)}, {gpsPosition.lng.toFixed(4)}{" "}
                          {gpsAccuracy !== null && `· ±${gpsAccuracy}m`} · {gpsUpdateCount} màj
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: 14, height: 14, background: "#475569", borderRadius: "50%", flexShrink: 0 }} />
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: "#64748b" }}>
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
              {/* Bouton terminer course active */}
              {gpsActive &&
                activeResaId &&
                (() => {
                  const linked = items.find((x) => x.id === activeResaId);
                  const canComplete = linked && linked.status !== "completed" && linked.status !== "cancelled";
                  if (!canComplete) return null;
                  return (
                    <button
                      onClick={() => handleUpdateReservationStatus(linked, "completed")}
                      style={{
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "#fff",
                        border: 0,
                        padding: "10px 18px",
                        borderRadius: 12,
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 14,
                        boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                      }}
                    >
                      🏁 Terminer
                    </button>
                  );
                })()}
              {/* Stop GPS */}
              {gpsActive && (
                <button
                  onClick={stopGPS}
                  style={{
                    background: "transparent",
                    color: "#475569",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "10px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  ⏹ Couper
                </button>
              )}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 14 }}>
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
                <div style={valCss}>{c.v}</div>
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

      {/* ── Prochaine course ── */}
      {!statsLoading &&
        nextCourse &&
        (() => {
          const nuit = isNuit(nextCourse.pickup_datetime);
          const prix = getPrix(nextCourse);
          const arrivee = nextCourse.arrivee || nextCourse.destination;
          return (
            <div
              style={{
                ...card,
                marginBottom: 24,
                border: "1px solid rgba(34,197,94,0.35)",
                background: "rgba(34,197,94,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>🚖</span>
                <h2
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontSize: 15,
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
                  {nuit ? `🌙 Nuit` : `☀️ Jour`}
                </span>
              </div>
              <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                {formatParis(nextCourse.pickup_datetime, { dateStyle: "full", timeStyle: "short" })}
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 14, marginBottom: 10 }}>
                🟢 {nextCourse.depart} → 📍 {arrivee || "—"}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "#94a3b8" }}>
                <span>👤 {nextCourse.nom || nextCourse.client_name}</span>
                <span>👥 {nextCourse.passagers || nextCourse.nb_passagers || 1} pax</span>
                {prix !== null && <span style={{ color: "#0ea5e9", fontWeight: 700 }}>💰 {prix.toFixed(2)} €</span>}
                {nextCourse.paiement && <span style={{ color: "#22c55e" }}>{paiementLabel(nextCourse.paiement)}</span>}
              </div>
            </div>
          );
        })()}

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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{r.client_name || r.nom}</div>
                      <div style={{ color: "#94a3b8", marginTop: 6, fontSize: 13 }}>
                        🟢 {r.depart} → 📍 {r.destination || r.arrivee}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <StatusBadge s={r.status} />
                      <span style={{ color: "#64748b", fontSize: 12 }}>
                        {r.pickup_datetime
                          ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                          : new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                      </span>
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{r.client_name || r.nom}</div>
                      <div style={{ color: "#cbd5e1", marginTop: 6, fontSize: 13 }}>
                        🟢 {r.depart} → 📍 {r.destination || r.arrivee}
                      </div>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {r.pickup_datetime
                        ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                        : new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                    </div>
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
                  <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {(r.client_phone || r.telephone) && (
                      <a
                        href={`tel:${r.client_phone || r.telephone}`}
                        style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600, fontSize: 13 }}
                      >
                        📞 {r.client_phone || r.telephone}
                      </a>
                    )}
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
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
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
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                    <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" }}>
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
                    <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                      {a.message || a.content || a.texte}
                    </p>
                  </div>
                </SwipeDeleteRow>
              ))}
          </div>
        )}
      </div>

      {/* ── Modale Accepter / Refuser ── */}
      {confirmAction && (
        <div
          onClick={() => {
            if (confirmBusy) return;
            setConfirmAction(null);
            setRefusalReason("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>{confirmAction.type === "accept" ? "✅" : "❌"}</div>
            <h2
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: "#f8fafc",
                margin: "0 0 8px",
              }}
            >
              {confirmAction.type === "accept" ? "Accepter cette course ?" : "Refuser cette course ?"}
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.5, margin: "0 0 12px" }}>
              <b style={{ color: "#cbd5e1" }}>{confirmAction.r.client_name || confirmAction.r.nom}</b>
              {" — "}
              {confirmAction.r.depart} → {confirmAction.r.destination || confirmAction.r.arrivee}
            </p>

            {confirmAction.r.pickup_datetime && (
              <div
                style={{
                  background: "rgba(14,165,233,0.08)",
                  border: "1px solid rgba(14,165,233,0.2)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#cbd5e1",
                  marginBottom: 10,
                }}
              >
                🕐 {formatParis(confirmAction.r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })}
                {" · "}
                <span
                  style={{ color: isNuit(confirmAction.r.pickup_datetime) ? "#818cf8" : "#fbbf24", fontWeight: 700 }}
                >
                  {isNuit(confirmAction.r.pickup_datetime)
                    ? `🌙 Nuit ${TARIF_NUIT_LABEL}`
                    : `☀️ Jour ${TARIF_JOUR_LABEL}`}
                </span>
              </div>
            )}

            {confirmAction.type === "accept" && (
              <div
                style={{
                  background: "rgba(14,165,233,0.08)",
                  border: "1px solid rgba(14,165,233,0.2)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {kmLoading ? (
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>📡 Calcul de la distance…</span>
                ) : (
                  (() => {
                    const rv = confirmAction.r;
                    const km = rv.distance_km ? Number(rv.distance_km) : (autoKm ?? 5);
                    const px = rv.pickup_datetime ? calculerPrixMixte(km, rv.pickup_datetime) : calculerPrix(km, true);
                    return (
                      <>
                        <div>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>Distance</div>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 15 }}>{km} km</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>Prix calculé</div>
                          <div
                            style={{
                              color: "#ef4444",
                              fontFamily: "'DM Sans',sans-serif",
                              fontWeight: 800,
                              fontSize: 22,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {px.toFixed(2)} €
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {/* Automatique — info push */}
            <div
              style={{
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 10,
                padding: "8px 12px",
                marginBottom: 14,
                fontSize: 13,
                color: "#22c55e",
              }}
            >
              {confirmAction.type === "accept"
                ? "🔔 Push + Email envoyés automatiquement au client"
                : "🔔 Push envoyée automatiquement au client"}
            </div>

            {/* Motif refus */}
            {confirmAction.type === "refuse" && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Motif du refus <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value.slice(0, 500))}
                  disabled={confirmBusy}
                  autoFocus
                  rows={3}
                  maxLength={500}
                  placeholder="Ex. : créneau indisponible, zone non desservie…"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#f8fafc",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 14,
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  <span>{refusalReason.trim().length < 3 ? "3 caractères minimum" : "✓"}</span>
                  <span>{refusalReason.length}/500</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setConfirmAction(null);
                  setRefusalReason("");
                }}
                disabled={confirmBusy}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(255,255,255,0.1)",
                  padding: "12px 20px",
                  borderRadius: 12,
                  cursor: confirmBusy ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  opacity: confirmBusy ? 0.5 : 1,
                }}
              >
                Annuler
              </button>
              <button
                disabled={confirmBusy || (confirmAction.type === "refuse" && refusalReason.trim().length < 3)}
                onClick={async () => {
                  if (confirmBusy) return;
                  setConfirmBusy(true);
                  try {
                    if (confirmAction.type === "accept") {
                      await handleAccept(confirmAction.r);
                      setConfirmAction(null);
                    } else {
                      const ok = await handleRefuse(confirmAction.r, refusalReason);
                      if (ok) {
                        setConfirmAction(null);
                        setRefusalReason("");
                      }
                    }
                  } finally {
                    setConfirmBusy(false);
                  }
                }}
                style={{
                  background: confirmAction.type === "accept" ? "#22c55e" : "#ef4444",
                  color: "#fff",
                  border: 0,
                  padding: "12px 22px",
                  borderRadius: 12,
                  cursor: confirmBusy ? "wait" : "pointer",
                  fontWeight: 700,
                  opacity:
                    confirmBusy || (confirmAction.type === "refuse" && refusalReason.trim().length < 3) ? 0.5 : 1,
                }}
              >
                {confirmBusy ? "…" : confirmAction.type === "accept" ? "✓ Accepter" : "✗ Refuser"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
