import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
import { assertTrackingId, newTrackingId, trackingIdSchema } from "@/lib/tracking-id";
import {
  CourseCardSkeleton,
  GpsCardSkeleton,
  Skeleton,
  SkeletonStyles,
  StatCardSkeleton,
  CardSkeleton,
  LineSkeleton,
  ReservationRowSkeleton,
} from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

// ─── Styles communs ───
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

const tabKeys = ["pending", "accepted", "refused"] as const;
type TabKey = (typeof tabKeys)[number];

const normalizeStatus = (s: unknown): TabKey => {
  if (s === "accepted") return "accepted";
  if (s === "refused") return "refused";
  return "pending";
};

const tabLabels: Record<TabKey, string> = {
  pending: "En attente",
  accepted: "Acceptées",
  refused: "Refusées",
};

const STATUS: Record<string, { bg: string; c: string; label: string }> = {
  pending: { bg: "rgba(245,158,11,0.15)", c: "#f59e0b", label: "En attente" },
  accepted: { bg: "rgba(34,197,94,0.15)", c: "#22c55e", label: "Acceptée" },
  refused: { bg: "rgba(239,68,68,0.15)", c: "#ef4444", label: "Refusée" },
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

// ─── Modal QR Code ───
function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
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
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          padding: 28,
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
          fontFamily: "'DM Sans',sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📲</div>
        <h2
          style={{
            fontFamily: "'Syne',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#f8fafc",
            margin: "0 0 4px",
          }}
        >
          QR Code de suivi
        </h2>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 18px" }}>Scannez ou partagez ce lien avec le client</p>
        <div style={{ background: "#fff", borderRadius: 16, padding: 12, display: "inline-block", marginBottom: 16 }}>
          <img src={qrSrc} alt="QR Code suivi" width={220} height={220} style={{ display: "block" }} />
        </div>
        <p
          style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10,
            color: "#475569",
            wordBreak: "break-all",
            marginBottom: 18,
          }}
        >
          {url}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(url).catch(() => {});
              toast.success("Lien copié !");
            }}
            style={{
              background: "rgba(14,165,233,0.15)",
              border: "1px solid rgba(14,165,233,0.3)",
              color: "#0ea5e9",
              padding: "10px 18px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            📋 Copier le lien
          </button>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              padding: "10px 18px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Fermer
          </button>
        </div>
      </div>
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

  // ── Courses list ──
  const [items, setItems] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, refused: 0 });

  // ── Modales & actions ──
  const [confirmAction, setConfirmAction] = useState<{ type: "accept" | "refuse"; r: any } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [autoKm, setAutoKm] = useState<number | null>(null);
  const [kmLoading, setKmLoading] = useState(false);
  const [cardKm, setCardKm] = useState<Record<string, number>>({});
  const [cardKmLoading, setCardKmLoading] = useState<Record<string, boolean>>({});
  const [qrModal, setQrModal] = useState<{ url: string } | null>(null);
  const [deleteSlide, setDeleteSlide] = useState<string | null>(null); // id en cours de slide
  const [deleteBusy, setDeleteBusy] = useState(false);
  // ── Avis ──
  const [avis, setAvis] = useState<any[]>([]);
  const [avisLoading, setAvisLoading] = useState(true);
  const initialLoad = useRef(true);

  // ── GPS ──
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsDestination, setGpsDestination] = useState("");
  const [gpsPrixEstime, setGpsPrixEstime] = useState("");
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsCalcKm, setGpsCalcKm] = useState(5);
  const [gpsCalcJour, setGpsCalcJour] = useState(true);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsUpdateCount, setGpsUpdateCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  // ── Flow Check ──
  const [flowChecks, setFlowChecks] = useState<
    { id: string; label: string; status: "ok" | "warn" | "fail" | "pending"; detail?: string }[]
  >([]);
  const [flowResas, setFlowResas] = useState<any[]>([]);
  const [flowRunning, setFlowRunning] = useState(false);
  const [flowResasLoading, setFlowResasLoading] = useState(false);
  const [trackingMode, setTrackingMode] = useState<"single" | "multi" | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [simResults, setSimResults] = useState<
    { id: string; tracking_id: string; ms: number; ok: boolean; detail: string }[]
  >([]);
  const [simRunning, setSimRunning] = useState(false);

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
        .gte("pickup_datetime", nowIso)
        .order("pickup_datetime", { ascending: true })
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
      console.error(error);
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

  const fetchAll = useCallback(() => {
    fetchStats();
    fetchCourses();
    fetchAvis();
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
          try {
            new Audio("/notification.mp3").play().catch(() => {});
          } catch {}
          if (typeof window !== "undefined") {
            const t = document.createElement("div");
            t.textContent = `🔔 Nouvelle réservation de ${n.client_name || n.nom || "Client"}`;
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
    const initGPS = async () => {
      const { data, error } = await supabase.from("driver_gps").select("*").eq("id", "driver").single();
      if (error || !data) {
        await supabase.from("driver_gps").insert({ id: "driver", is_active: false, latitude: 0, longitude: 0 });
        setGpsLoading(false);
        return;
      }
      setGpsActive(!!data.is_active);
      setGpsDestination(data.destination ?? "");
      setGpsPrixEstime(data.prix_estime ?? "");
      setGpsLoading(false);
    };
    initGPS();
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined")
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const startGPS = async () => {
    if (!navigator.geolocation) return;
    await supabase
      .from("driver_gps")
      .update({
        is_active: true,
        destination: gpsDestination || null,
        prix_estime: gpsPrixEstime || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "driver");
    setGpsActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setGpsPosition({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(acc));
        setGpsUpdateCount((n) => n + 1);
        await supabase
          .from("driver_gps")
          .update({
            latitude,
            longitude,
            accuracy: acc,
            updated_at: new Date().toISOString(),
          })
          .eq("id", "driver");
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  };

  const stopGPS = async () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    await supabase
      .from("driver_gps")
      .update({
        is_active: false,
        destination: null,
        prix_estime: null,
      })
      .eq("id", "driver");
    setGpsActive(false);
    setGpsPosition(null);
    setGpsAccuracy(null);
    setGpsUpdateCount(0);
  };

  // =========================
  // FLOW CHECK
  // =========================
  const runFlowChecks = async () => {
    setFlowRunning(true);
    setFlowResasLoading(true);
    const results: typeof flowChecks = [];

    const { data: gpsData, error: gpsErr } = await supabase
      .from("driver_gps")
      .select("*")
      .eq("id", "driver")
      .maybeSingle();
    if (gpsErr) {
      results.push({ id: "gps", label: "Driver GPS — lecture publique", status: "fail", detail: gpsErr.message });
    } else if (!gpsData) {
      results.push({
        id: "gps",
        label: "Driver GPS — ligne 'driver' absente",
        status: "warn",
        detail: "La ligne driver_gps id='driver' n'existe pas.",
      });
    } else {
      const hasPos = gpsData.latitude != null && gpsData.longitude != null;
      const fresh = gpsData.updated_at ? Date.now() - new Date(gpsData.updated_at).getTime() < 5 * 60 * 1000 : false;
      results.push({
        id: "gps",
        label: `Driver GPS — ${gpsData.is_active ? "actif" : "inactif"}${hasPos ? " · position OK" : " · sans position"}${fresh ? " · récent" : " · ancien"}`,
        status: gpsData.is_active && hasPos && fresh ? "ok" : "warn",
        detail: `lat=${gpsData.latitude ?? "—"} lng=${gpsData.longitude ?? "—"} · maj ${gpsData.updated_at ?? "—"}`,
      });
    }

    const { data: resas, error: resasErr } = await supabase
      .from("reservations")
      .select("id, tracking_id, status, client_name, nom, destination, arrivee, prix_estime, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (resasErr) {
      results.push({ id: "resas", label: "Réservations — lecture", status: "fail", detail: resasErr.message });
    } else {
      const list = resas ?? [];
      setFlowResas(list);
      setFlowResasLoading(false);
      const accepted = list.filter((r: any) =>
        ["acceptee", "acceptée", "accepted"].includes((r.status || "").toLowerCase()),
      );
      const withTid = list.filter((r: any) => r.tracking_id);
      const validTid = withTid.filter((r: any) => trackingIdSchema.safeParse(r.tracking_id).success);
      const invalidTid = withTid.length - validTid.length;
      results.push({
        id: "resas",
        label: `Réservations — ${list.length} récentes · ${accepted.length} acceptées · ${withTid.length} avec tracking_id`,
        status: list.length === 0 ? "warn" : "ok",
      });
      results.push({
        id: "tid",
        label: `Tracking IDs — ${validTid.length}/${withTid.length} au format UUID v4`,
        status: invalidTid === 0 ? "ok" : "fail",
        detail: invalidTid > 0 ? `${invalidTid} tracking_id invalides.` : undefined,
      });
    }

    try {
      const { error } = await supabase.from("reservations").select("id").limit(1);
      results.push({
        id: "rls-resa-read",
        label: "RLS · reservations — lecture publique",
        status: error ? "fail" : "ok",
        detail: error?.message,
      });
    } catch (e: any) {
      results.push({ id: "rls-resa-read", label: "RLS · reservations — lecture", status: "fail", detail: e.message });
    }
    try {
      const { error } = await supabase.from("driver_gps").select("id").limit(1);
      results.push({
        id: "rls-gps-read",
        label: "RLS · driver_gps — lecture publique",
        status: error ? "fail" : "ok",
        detail: error?.message,
      });
    } catch (e: any) {
      results.push({ id: "rls-gps-read", label: "RLS · driver_gps — lecture", status: "fail", detail: e.message });
    }
    const { error: rolesErr } = await supabase.from("user_roles").select("id").limit(1);
    results.push({
      id: "rls-roles",
      label: "RLS · user_roles",
      status: "ok",
      detail: rolesErr ? "Lecture refusée hors admin (attendu)." : "Vous êtes admin, lecture autorisée.",
    });

    try {
      const { error } = await supabase
        .from("site_analytics")
        .insert({ event: "flow_check_ping", session_id: "flow-check" });
      results.push({
        id: "rls-analytics",
        label: "RLS · site_analytics — écriture publique",
        status: error ? "fail" : "ok",
        detail: error?.message,
      });
    } catch (e: any) {
      results.push({
        id: "rls-analytics",
        label: "RLS · site_analytics — écriture",
        status: "fail",
        detail: e.message,
      });
    }

    const channel = supabase.channel("flow-check-rt");
    const rtOk = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      channel
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_gps" }, () => {})
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            resolve(true);
          }
        });
    });
    supabase.removeChannel(channel);
    results.push({
      id: "realtime",
      label: "Realtime — abonnement driver_gps",
      status: rtOk ? "ok" : "warn",
      detail: rtOk ? undefined : "Canal realtime non confirmé en 3s.",
    });

    setFlowChecks(results);
    setFlowRunning(false);
  };

  const loadTrackingMode = async () => {
    const { data } = await supabase.from("app_settings").select("tracking_mode").eq("id", 1).maybeSingle();
    setTrackingMode(data?.tracking_mode === "multi" ? "multi" : "single");
  };

  const updateTrackingMode = async (next: "single" | "multi") => {
    setSavingMode(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ tracking_mode: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSavingMode(false);
    if (error) {
      alert("Échec mise à jour mode: " + error.message);
      return;
    }
    setTrackingMode(next);
  };

  const runSimulatedScans = async () => {
    setSimRunning(true);
    setSimResults([]);
    const targets = flowResas
      .filter((r: any) => r.tracking_id && trackingIdSchema.safeParse(r.tracking_id).success)
      .slice(0, 5);
    if (targets.length === 0) {
      setSimResults([
        { id: "none", tracking_id: "—", ms: 0, ok: false, detail: "Aucune réservation avec tracking_id UUID valide." },
      ]);
      setSimRunning(false);
      return;
    }
    const settings = await supabase.from("app_settings").select("tracking_mode").eq("id", 1).maybeSingle();
    const m = settings.data?.tracking_mode === "multi" ? "multi" : "single";
    const runOne = async (r: any) => {
      const start = performance.now();
      const tid = r.tracking_id!;
      const [resa, gps] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, status, destination, arrivee, prix_estime")
          .eq("tracking_id", tid)
          .maybeSingle(),
        supabase
          .from("driver_gps")
          .select("id, latitude, longitude, is_active, updated_at")
          .eq("id", m === "multi" ? tid : "driver")
          .maybeSingle(),
      ]);
      const ms = Math.round(performance.now() - start);
      const okResa = !resa.error && !!resa.data;
      const okGps = !gps.error;
      return {
        id: r.id,
        tracking_id: tid,
        ms,
        ok: okResa && okGps,
        detail: `${okResa ? "✓ resa" : "✗ resa"} · ${okGps ? (gps.data ? "✓ gps " + (gps.data.is_active ? "actif" : "inactif") : "gps absent") : "✗ gps " + gps.error?.message}`,
      };
    };
    const results = await Promise.all(targets.map(runOne));
    setSimResults(results);
    setSimRunning(false);
  };

  // =========================
  // CALCUL DISTANCE
  // =========================
  const fetchDistanceKm = async (depart: string, arrivee: string): Promise<number> => {
    const apiKey =
      (import.meta.env.VITE_ORS_API_KEY as string | undefined) ||
      "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImNhMGVmYTZiNGQ2MzQ3ZGJhZDJmMmY0ZDc2YjYyYTIwIiwiaCI6Im11cm11cjY0In0=";

    const geocode = async (address: string) => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Bordeaux, France")}&format=json&limit=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "fr" } });
        const data = await res.json();
        if (data?.[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      } catch {}
      return null;
    };

    const [a, b] = await Promise.all([geocode(depart), geocode(arrivee)]);
    if (a && b && apiKey) {
      try {
        const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: apiKey },
          body: JSON.stringify({
            coordinates: [
              [a.lng, a.lat],
              [b.lng, b.lat],
            ],
          }),
        });
        const data = await res.json();
        const meters = data?.routes?.[0]?.summary?.distance;
        if (meters && meters > 0) return Math.round((meters / 1000) * 10) / 10;
      } catch {}
    }
    if (a && b) {
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
        const tarif_nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : false;
        const prix = calculerPrix(km, !tarif_nuit);
        await supabase.from("reservations").update({ distance_km: km, prix_estime: prix }).eq("id", r.id);
        setCardKm((prev) => ({ ...prev, [r.id]: km }));
      } catch {}
      setCardKmLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // ACCEPT
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

    const tarif_nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : false;
    const km = r.distance_km ? Number(r.distance_km) : (autoKm ?? 5);
    const prixCalcule = calculerPrix(km, !tarif_nuit);

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "accepted",
        tracking_id: trackingId,
        tarif_jour: !tarif_nuit,
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
    if (typeof window !== "undefined" && url) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }

    const pickupFormatted = r.pickup_datetime
      ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
      : undefined;
    const prixStr = `${Number(prixCalcule).toFixed(2)} €`;
    const tarifLabel = tarif_nuit ? `Nuit (${TARIF_NUIT_LABEL})` : `Jour (${TARIF_JOUR_LABEL})`;
    const adminSecret = import.meta.env.VITE_LOVABLE_API_KEY ?? "";

    let emailDetail = "Aucun email client renseigné";
    if (email && url) {
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
        emailDetail = res.ok
          ? `✉️ Email envoyé à ${email}`
          : `⚠️ Échec email (${res.status}) — vérifiez le template "course-accepted"`;
      } catch {
        emailDetail = "⚠️ Échec email (réseau)";
      }
    }

    const TAXI_WA = "33673072322";
    let waPhone = (phone || "").replace(/[^\d]/g, "");
    if (waPhone.startsWith("0")) waPhone = "33" + waPhone.slice(1);
    if (waPhone.startsWith("330")) waPhone = "33" + waPhone.slice(3);
    const refId = `TCB-${r.id.slice(0, 8).toUpperCase()}`;
    const paxLine = `${r.nb_passagers || r.passagers || 1} passager(s)${(r.bagages ?? 0) > 0 ? ` · ${r.bagages} bagage(s)` : ""}`;
    const waMsg = encodeURIComponent(
      `Bonjour ${name || ""},\n\n✅ Votre course *${refId}* est confirmée !\n\n` +
        `🕐 Prise en charge : ${pickupFormatted ?? "—"}\n📍 Départ : ${r.depart}\n` +
        `🏁 Arrivée : ${r.arrivee || r.destination || "—"}\n👥 ${paxLine}\n` +
        `💰 Prix estimé : *${prixStr}* (tarif ${tarif_nuit ? "nuit" : "jour"})\n\n` +
        `📲 Suivez votre chauffeur en temps réel :\n${url}\n\n📞 06 73 07 23 22 (7j/7 · 24h/24)`,
    );

    if (typeof window !== "undefined") {
      if (waPhone.length >= 10 && waPhone !== TAXI_WA) {
        window.open(`https://wa.me/${waPhone}?text=${waMsg}`, "_blank", "noopener,noreferrer");
      } else {
        toast.warning("WhatsApp non envoyé", { description: "Aucun numéro client valide pour cette réservation." });
      }
    }

    toast.success(`Course acceptée — ${name || "client"}`, {
      description: `${emailDetail} · 💬 WhatsApp ouvert`,
      duration: 8000,
      action: { label: "📲 QR Code", onClick: () => setQrModal({ url }) },
    });

    fetchAll();
  };

  // =========================
  // REFUSE
  // =========================
  const handleRefuse = async (r: any, motif: string) => {
    const cleaned = motif.trim();
    if (cleaned.length < 3) {
      toast.error("Motif requis", { description: "Indiquez la raison du refus (3 caractères minimum)." });
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
    toast.success(`Course refusée — ${r.client_name || r.nom || "client"}`, {
      description: `Motif : « ${cleaned.slice(0, 80)}${cleaned.length > 80 ? "…" : ""} »`,
    });
    fetchAll();
    return true;
  };

  // =========================
  // RENVOYER EMAIL
  // =========================
  const handleSendEmail = async (r: any) => {
    const email = r.client_email || r.email;
    const name = r.client_name || r.nom;
    if (!email) {
      toast.error("Pas d'email", { description: "Aucune adresse email pour ce client." });
      return;
    }
    const tarif_nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
    const km = r.distance_km ? Number(r.distance_km) : null;
    const prixCalcule = km ? calculerPrix(km, !tarif_nuit) : null;
    const prixStr = r.prix_estime
      ? `${Number(r.prix_estime).toFixed(2)} €`
      : prixCalcule
        ? `${Number(prixCalcule).toFixed(2)} €`
        : "à confirmer";
    const pickupFormatted = r.pickup_datetime
      ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
      : undefined;
    const trackingUrl =
      r.tracking_id && typeof window !== "undefined" ? `${window.location.origin}/scan/${r.tracking_id}` : null;
    const adminSecret = import.meta.env.VITE_LOVABLE_API_KEY ?? "";
    try {
      const res = await fetch("/api/admin/send-course-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Secret": adminSecret },
        body: JSON.stringify({
          templateName: "course-accepted",
          recipientEmail: email,
          idempotencyKey: `course-accepted-resend-${r.id}-${Date.now()}`,
          templateData: {
            nom: name,
            depart: r.depart,
            arrivee: r.arrivee || r.destination,
            pickup_datetime: pickupFormatted,
            prix: prixStr,
            tarif: tarif_nuit ? `Nuit (${TARIF_NUIT_LABEL})` : `Jour (${TARIF_JOUR_LABEL})`,
            tracking_url: trackingUrl ?? "",
          },
        }),
      });
      if (res.ok) {
        toast.success(`Email envoyé à ${email}`);
      } else {
        toast.error(`Échec envoi email (${res.status})`, { description: 'Vérifiez le template "course-accepted".' });
      }
    } catch {
      toast.error("Erreur réseau", { description: "Impossible d'envoyer l'email." });
    }
  };

  // =========================
  // DELETE RESERVATION (sans RLS)
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
    setDeleteSlide(null);
    setDeleteBusy(false);
  };

  // =========================
  // VALIDER / REFUSER AVIS
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

  const getPrix = (r: any): number | null => {
    if (r.prix_final) return Number(r.prix_final);
    if (r.prix_estime) return Number(r.prix_estime);
    if (r.distance_km) {
      const nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
      return calculerPrix(Number(r.distance_km), !nuit);
    }
    return null;
  };

  const pending = items.filter((r) => normalizeStatus(r.status) === "pending");
  const accepted = items.filter((r) => normalizeStatus(r.status) === "accepted");
  const refused = items.filter((r) => normalizeStatus(r.status) === "refused");

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
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
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

      {/* ── Prochaine course acceptée ── */}
      {!statsLoading &&
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
                  {[
                    { label: "🟢 Départ", val: nextCourse.depart },
                    { label: "📍 Arrivée", val: arrivee || "—" },
                  ].map(({ label, val }) => (
                    <div
                      key={label}
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
                        {label}
                      </div>
                      <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600, wordBreak: "break-word" }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
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
                </div>
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

      {/* ── Section Courses ── */}
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#f59e0b",
                  flexShrink: 0,
                  boxShadow: "0 0 8px rgba(245,158,11,0.6)",
                }}
              />
              <h3
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#f59e0b",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                En attente
              </h3>
              <span
                style={{
                  background: "rgba(245,158,11,0.15)",
                  color: "#f59e0b",
                  padding: "2px 10px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {counts.pending}
              </span>
            </div>
            {pending.length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "20px 0" }}>
                Aucune réservation en attente
              </div>
            )}
            {pending.map((r) => {
              const phone = r.client_phone || r.telephone;
              const email = r.client_email || r.email;
              const name = r.client_name || r.nom;
              const dest = r.destination || r.arrivee;
              const tarif_nuit_card = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
              const km_card = r.distance_km ? Number(r.distance_km) : (cardKm[r.id] ?? null);
              const prix =
                r.prix_estime != null
                  ? Number(r.prix_estime)
                  : km_card != null
                    ? calculerPrix(km_card, !tarif_nuit_card)
                    : null;
              const isPrixLoading = cardKmLoading[r.id] ?? false;
              const pickupFormatted = r.pickup_datetime
                ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                : null;
              const trackingUrl =
                r.tracking_id && typeof window !== "undefined"
                  ? `${window.location.origin}/scan/${r.tracking_id}`
                  : null;

              return (
                <div key={r.id} style={{ ...card, marginBottom: 14 }}>
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
                      <span style={{ color: "#64748b", fontStyle: "italic" }}>📡 calcul prix…</span>
                    ) : prix !== null ? (
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>💰 {Number(prix).toFixed(2)} €</span>
                    ) : null}
                    <span>👥 {r.nb_passagers || r.passagers || 1} passager(s)</span>
                    {r.bagages > 0 && <span>🧳 {r.bagages} bagage(s)</span>}
                    {r.service_type && r.service_type !== "standard" && (
                      <span
                        style={{
                          background: "rgba(14,165,233,0.1)",
                          color: "#38bdf8",
                          padding: "2px 8px",
                          borderRadius: 99,
                          fontWeight: 600,
                        }}
                      >
                        🚖 {r.service_type}
                      </span>
                    )}
                    <span
                      style={{
                        background: tarif_nuit_card ? "rgba(99,102,241,0.15)" : "rgba(250,204,21,0.12)",
                        color: tarif_nuit_card ? "#818cf8" : "#fbbf24",
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontWeight: 700,
                      }}
                    >
                      {tarif_nuit_card ? `🌙 Nuit ${TARIF_NUIT_LABEL}` : `☀️ Jour ${TARIF_JOUR_LABEL}`}
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

                  <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {phone && (
                      <a href={`tel:${phone}`} style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>
                        📞 {phone}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} style={{ color: "#94a3b8", textDecoration: "none" }}>
                        ✉️ {email}
                      </a>
                    )}
                  </div>

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

                  {/* Boutons d'action */}
                  <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {normalizeStatus(r.status) === "pending" && (
                      <>
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
                            padding: "12px 18px",
                            borderRadius: 12,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 13,
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
                            padding: "12px 18px",
                            borderRadius: 12,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          ✗ Refuser
                        </button>
                      </>
                    )}

                    {normalizeStatus(r.status) === "accepted" &&
                      phone &&
                      (() => {
                        const TAXI_WA = "33673072322";
                        return (
                          <button
                            onClick={() => {
                              let waPhone = (phone || "").replace(/[^\d]/g, "");
                              if (waPhone.startsWith("0")) waPhone = "33" + waPhone.slice(1);
                              if (waPhone.startsWith("330")) waPhone = "33" + waPhone.slice(3);
                              if (waPhone.length < 10 || waPhone === TAXI_WA) {
                                toast.warning("WhatsApp non envoyé", { description: "Aucun numéro client valide." });
                                return;
                              }
                              const pickupStr = r.pickup_datetime
                                ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
                                : "—";
                              const tarif_nuit_wa = r.pickup_datetime
                                ? isNuit(r.pickup_datetime)
                                : r.tarif_jour === false;
                              const km_wa = r.distance_km ? Number(r.distance_km) : null;
                              const prixNum = r.prix_estime
                                ? Number(r.prix_estime)
                                : km_wa
                                  ? calculerPrix(km_wa, !tarif_nuit_wa)
                                  : null;
                              const prixStr = prixNum ? `${prixNum.toFixed(2)} €` : "à confirmer";
                              const refId = `TCB-${r.id.slice(0, 8).toUpperCase()}`;
                              const paxLine = `${r.nb_passagers || r.passagers || 1} passager(s)${(r.bagages ?? 0) > 0 ? ` · ${r.bagages} bagage(s)` : ""}`;
                              const waMsg = encodeURIComponent(
                                `Bonjour ${name || ""},\n\n✅ Votre course *${refId}* est confirmée !\n\n🕐 Prise en charge : ${pickupStr}\n📍 Départ : ${r.depart}\n🏁 Arrivée : ${dest || "—"}\n👥 ${paxLine}\n💰 Prix estimé : *${prixStr}* (tarif ${tarif_nuit_wa ? "nuit" : "jour"})\n\n` +
                                  (trackingUrl ? `📲 Suivez votre chauffeur :\n${trackingUrl}\n\n` : "") +
                                  `📞 06 73 07 23 22 (7j/7 · 24h/24)`,
                              );
                              window.open(`https://wa.me/${waPhone}?text=${waMsg}`, "_blank", "noopener,noreferrer");
                            }}
                            style={{
                              background: "rgba(37,211,102,0.12)",
                              border: "1px solid rgba(37,211,102,0.3)",
                              color: "#4ade80",
                              padding: "12px 18px",
                              borderRadius: 12,
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            💬 WhatsApp
                          </button>
                        );
                      })()}

                    {phone &&
                      (() => {
                        const smsPhone = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "+33");
                        const pickupStr = r.pickup_datetime
                          ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                          : "—";
                        const tarif_nuit_sms = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
                        const km_sms = r.distance_km ? Number(r.distance_km) : null;
                        const prixNum = r.prix_estime
                          ? Number(r.prix_estime)
                          : km_sms
                            ? calculerPrix(km_sms, !tarif_nuit_sms)
                            : null;
                        const prixStr = prixNum ? `${prixNum.toFixed(2)} €` : "à confirmer";
                        const refId = `TCB-${r.id.slice(0, 8).toUpperCase()}`;
                        return (
                          <a
                            href={`sms:${smsPhone}?body=${encodeURIComponent(`Bonjour ${name || ""},\nCourse ${refId} confirmee !\n${pickupStr} | ${r.depart} -> ${dest || "—"}\nPrix: ${prixStr}\n${trackingUrl ? `Suivi: ${trackingUrl}\n` : ""}Tel: 06 73 07 23 22`)}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              background: "rgba(168,85,247,0.12)",
                              border: "1px solid rgba(168,85,247,0.3)",
                              color: "#c084fc",
                              padding: "12px 18px",
                              borderRadius: 12,
                              fontWeight: 700,
                              fontSize: 13,
                              textDecoration: "none",
                            }}
                          >
                            💬 SMS
                          </a>
                        );
                      })()}

                    {email && (
                      <button
                        onClick={() => handleSendEmail(r)}
                        style={{
                          background: "rgba(14,165,233,0.12)",
                          border: "1px solid rgba(14,165,233,0.3)",
                          color: "#38bdf8",
                          padding: "12px 18px",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        ✉️ Email client
                      </button>
                    )}

                    {trackingUrl && (
                      <button
                        onClick={() => setQrModal({ url: trackingUrl })}
                        style={{
                          background: "rgba(139,92,246,0.12)",
                          border: "1px solid rgba(139,92,246,0.3)",
                          color: "#a78bfa",
                          padding: "12px 18px",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        📲 QR Code
                      </button>
                    )}

                    {/* ── Supprimer (slide) ── */}
                    {deleteSlide === r.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>Confirmer ?</span>
                        <button
                          disabled={deleteBusy}
                          onClick={() => handleDeleteReservation(r.id)}
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            border: 0,
                            padding: "8px 14px",
                            borderRadius: 10,
                            cursor: deleteBusy ? "wait" : "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {deleteBusy ? "…" : "Oui, supprimer"}
                        </button>
                        <button
                          onClick={() => setDeleteSlide(null)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            color: "#94a3b8",
                            border: "1px solid rgba(255,255,255,0.1)",
                            padding: "8px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteSlide(r.id)}
                        style={{
                          marginLeft: "auto",
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                          padding: "8px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        🗑 Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Acceptées ── */}
        {!coursesLoading && (
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22c55e",
                  flexShrink: 0,
                  boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                }}
              />
              <h3
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#22c55e",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Acceptées
              </h3>
              <span
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#22c55e",
                  padding: "2px 10px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {counts.accepted}
              </span>
            </div>
            {accepted.length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "20px 0" }}>Aucune course acceptée</div>
            )}
            {accepted.map((r) => {
              const phone = r.client_phone || r.telephone;
              const email = r.client_email || r.email;
              const name = r.client_name || r.nom;
              const dest = r.destination || r.arrivee;
              const tarif_nuit_card = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
              const km_card = r.distance_km ? Number(r.distance_km) : (cardKm[r.id] ?? null);
              const prix =
                r.prix_estime != null
                  ? Number(r.prix_estime)
                  : km_card != null
                    ? calculerPrix(km_card, !tarif_nuit_card)
                    : null;
              const isPrixLoading = cardKmLoading[r.id] ?? false;
              const pickupFormatted = r.pickup_datetime
                ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                : null;
              const trackingUrl =
                r.tracking_id && typeof window !== "undefined"
                  ? `${window.location.origin}/scan/${r.tracking_id}`
                  : null;
              return (
                <div key={r.id} style={{ ...card, marginBottom: 14 }}>
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
                      <span style={{ color: "#64748b", fontStyle: "italic" }}>📡 calcul prix…</span>
                    ) : prix !== null ? (
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>💰 {Number(prix).toFixed(2)} €</span>
                    ) : null}
                    <span>👥 {r.nb_passagers || r.passagers || 1} passager(s)</span>
                    {r.bagages > 0 && <span>🧳 {r.bagages} bagage(s)</span>}
                    <span
                      style={{
                        background: tarif_nuit_card ? "rgba(99,102,241,0.15)" : "rgba(250,204,21,0.12)",
                        color: tarif_nuit_card ? "#818cf8" : "#fbbf24",
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontWeight: 700,
                      }}
                    >
                      {tarif_nuit_card ? `🌙 Nuit ${TARIF_NUIT_LABEL}` : `☀️ Jour ${TARIF_JOUR_LABEL}`}
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
                  <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {phone && (
                      <a href={`tel:${phone}`} style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>
                        📞 {phone}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} style={{ color: "#94a3b8", textDecoration: "none" }}>
                        ✉️ {email}
                      </a>
                    )}
                  </div>
                  <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {phone &&
                      (() => {
                        const TAXI_WA = "33673072322";
                        return (
                          <button
                            onClick={() => {
                              let waPhone = (phone || "").replace(/[^\d]/g, "");
                              if (waPhone.startsWith("0")) waPhone = "33" + waPhone.slice(1);
                              if (waPhone.startsWith("330")) waPhone = "33" + waPhone.slice(3);
                              if (waPhone.length < 10 || waPhone === TAXI_WA) {
                                toast.warning("WhatsApp non envoyé", { description: "Aucun numéro client valide." });
                                return;
                              }
                              const pickupStr = r.pickup_datetime
                                ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
                                : "—";
                              const tarif_nuit_wa = r.pickup_datetime
                                ? isNuit(r.pickup_datetime)
                                : r.tarif_jour === false;
                              const km_wa = r.distance_km ? Number(r.distance_km) : null;
                              const prixNum = r.prix_estime
                                ? Number(r.prix_estime)
                                : km_wa
                                  ? calculerPrix(km_wa, !tarif_nuit_wa)
                                  : null;
                              const prixStr = prixNum ? `${prixNum.toFixed(2)} €` : "à confirmer";
                              const refId = `TCB-${r.id.slice(0, 8).toUpperCase()}`;
                              const paxLine = `${r.nb_passagers || r.passagers || 1} passager(s)${(r.bagages ?? 0) > 0 ? ` · ${r.bagages} bagage(s)` : ""}`;
                              const waMsg = encodeURIComponent(
                                `Bonjour ${name || ""},\n\n✅ Votre course *${refId}* est confirmée !\n\n🕐 Prise en charge : ${pickupStr}\n📍 Départ : ${r.depart}\n🏁 Arrivée : ${dest || "—"}\n👥 ${paxLine}\n💰 Prix estimé : *${prixStr}* (tarif ${tarif_nuit_wa ? "nuit" : "jour"})\n\n` +
                                  (trackingUrl ? `📲 Suivez votre chauffeur :\n${trackingUrl}\n\n` : "") +
                                  `📞 06 73 07 23 22 (7j/7 · 24h/24)`,
                              );
                              window.open(`https://wa.me/${waPhone}?text=${waMsg}`, "_blank", "noopener,noreferrer");
                            }}
                            style={{
                              background: "rgba(37,211,102,0.12)",
                              border: "1px solid rgba(37,211,102,0.3)",
                              color: "#4ade80",
                              padding: "12px 18px",
                              borderRadius: 12,
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            💬 WhatsApp
                          </button>
                        );
                      })()}
                    {phone &&
                      (() => {
                        const smsPhone = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "+33");
                        const pickupStr = r.pickup_datetime
                          ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                          : "—";
                        const tarif_nuit_sms = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
                        const km_sms = r.distance_km ? Number(r.distance_km) : null;
                        const prixNum = r.prix_estime
                          ? Number(r.prix_estime)
                          : km_sms
                            ? calculerPrix(km_sms, !tarif_nuit_sms)
                            : null;
                        const prixStr = prixNum ? `${prixNum.toFixed(2)} €` : "à confirmer";
                        const refId = `TCB-${r.id.slice(0, 8).toUpperCase()}`;
                        return (
                          <a
                            href={`sms:${smsPhone}?body=${encodeURIComponent(`Bonjour ${name || ""},\nCourse ${refId} confirmee !\n${pickupStr} | ${r.depart} -> ${dest || "—"}\nPrix: ${prixStr}\n${trackingUrl ? `Suivi: ${trackingUrl}\n` : ""}Tel: 06 73 07 23 22`)}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              background: "rgba(168,85,247,0.12)",
                              border: "1px solid rgba(168,85,247,0.3)",
                              color: "#c084fc",
                              padding: "12px 18px",
                              borderRadius: 12,
                              fontWeight: 700,
                              fontSize: 13,
                              textDecoration: "none",
                            }}
                          >
                            💬 SMS
                          </a>
                        );
                      })()}
                    {email && (
                      <button
                        onClick={() => handleSendEmail(r)}
                        style={{
                          background: "rgba(14,165,233,0.12)",
                          border: "1px solid rgba(14,165,233,0.3)",
                          color: "#38bdf8",
                          padding: "12px 18px",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        ✉️ Email client
                      </button>
                    )}
                    {trackingUrl && (
                      <button
                        onClick={() => setQrModal({ url: trackingUrl })}
                        style={{
                          background: "rgba(139,92,246,0.12)",
                          border: "1px solid rgba(139,92,246,0.3)",
                          color: "#a78bfa",
                          padding: "12px 18px",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        📲 QR Code
                      </button>
                    )}
                    {/* ── Supprimer (slide) ── */}
                    {deleteSlide === r.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>Confirmer ?</span>
                        <button
                          disabled={deleteBusy}
                          onClick={() => handleDeleteReservation(r.id)}
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            border: 0,
                            padding: "8px 14px",
                            borderRadius: 10,
                            cursor: deleteBusy ? "wait" : "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {deleteBusy ? "…" : "Oui, supprimer"}
                        </button>
                        <button
                          onClick={() => setDeleteSlide(null)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            color: "#94a3b8",
                            border: "1px solid rgba(255,255,255,0.1)",
                            padding: "8px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteSlide(r.id)}
                        style={{
                          marginLeft: "auto",
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                          padding: "8px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        🗑 Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Refusées ── */}
        {!coursesLoading && (
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ef4444",
                  flexShrink: 0,
                  boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                }}
              />
              <h3
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#ef4444",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Refusées
              </h3>
              <span
                style={{
                  background: "rgba(239,68,68,0.15)",
                  color: "#ef4444",
                  padding: "2px 10px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {counts.refused}
              </span>
            </div>
            {refused.length === 0 && (
              <div style={{ textAlign: "center", color: "#475569", padding: "20px 0" }}>Aucune course refusée</div>
            )}
            {refused.map((r) => {
              const phone = r.client_phone || r.telephone;
              const email = r.client_email || r.email;
              const name = r.client_name || r.nom;
              const dest = r.destination || r.arrivee;
              const tarif_nuit_card = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
              const pickupFormatted = r.pickup_datetime
                ? formatParis(r.pickup_datetime, { dateStyle: "short", timeStyle: "short" })
                : null;
              return (
                <div key={r.id} style={{ ...card, marginBottom: 14 }}>
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
                    <span>👥 {r.nb_passagers || r.passagers || 1} passager(s)</span>
                    {r.bagages > 0 && <span>🧳 {r.bagages} bagage(s)</span>}
                    <span
                      style={{
                        background: tarif_nuit_card ? "rgba(99,102,241,0.15)" : "rgba(250,204,21,0.12)",
                        color: tarif_nuit_card ? "#818cf8" : "#fbbf24",
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontWeight: 700,
                      }}
                    >
                      {tarif_nuit_card ? `🌙 Nuit ${TARIF_NUIT_LABEL}` : `☀️ Jour ${TARIF_JOUR_LABEL}`}
                    </span>
                    <StatusBadge s={r.status} />
                  </div>
                  {r.refus_motif && (
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
                  <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {phone && (
                      <a href={`tel:${phone}`} style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>
                        📞 {phone}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} style={{ color: "#94a3b8", textDecoration: "none" }}>
                        ✉️ {email}
                      </a>
                    )}
                  </div>
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                    {deleteSlide === r.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>Confirmer ?</span>
                        <button
                          disabled={deleteBusy}
                          onClick={() => handleDeleteReservation(r.id)}
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            border: 0,
                            padding: "8px 14px",
                            borderRadius: 10,
                            cursor: deleteBusy ? "wait" : "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {deleteBusy ? "…" : "Oui, supprimer"}
                        </button>
                        <button
                          onClick={() => setDeleteSlide(null)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            color: "#94a3b8",
                            border: "1px solid rgba(255,255,255,0.1)",
                            padding: "8px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteSlide(r.id)}
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                          padding: "8px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        🗑 Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
                Aucun avis en attente de modération
              </div>
            )}
            {avis
              .filter((a) => !a.status || a.status === "pending")
              .map((a) => (
                <div key={a.id} style={{ ...card, marginBottom: 12, border: "1px solid rgba(251,191,36,0.2)" }}>
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
                      ✓ Valider & publier
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
                <div key={a.id} style={{ ...card, marginBottom: 10, border: "1px solid rgba(34,197,94,0.15)" }}>
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
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 6px rgba(239,68,68,0.6)",
                }}
              />
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
                <div
                  key={a.id}
                  style={{ ...card, marginBottom: 10, border: "1px solid rgba(239,68,68,0.12)", opacity: 0.7 }}
                >
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
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
              ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════
          SECTION GPS CHAUFFEUR
      ══════════════════════════════ */}
      <div style={{ marginTop: 48 }}>
        <style>{`
          @keyframes pulseDot {
            0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,0); }
            50%      { box-shadow:0 0 0 14px rgba(34,197,94,0.2); }
          }
          .gps-input {
            width: 100%; box-sizing: border-box; padding: 12px;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px; color: #fff; font-size: 14px; outline: none;
          }
          .gps-input:focus { border-color: rgba(14,165,233,0.5); }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
            📡 GPS Chauffeur
          </h2>
          {gpsActive && (
            <span
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                padding: "2px 10px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Actif
            </span>
          )}
        </div>

        {gpsLoading ? (
          <GpsCardSkeleton />
        ) : (
          <div
            style={{
              maxWidth: 540,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: "24px 20px",
              textAlign: "center",
            }}
          >
            {!gpsActive ? (
              <>
                <div style={{ fontSize: 52 }}>📡</div>
                <h3
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    color: "#f8fafc",
                    marginTop: 10,
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  Votre position est inactive
                </h3>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Les clients ne peuvent pas vous suivre</p>
                <div style={{ marginTop: 20, textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    className="gps-input"
                    value={gpsDestination}
                    onChange={(e) => setGpsDestination(e.target.value)}
                    placeholder="Destination du prochain client"
                  />
                  <input
                    className="gps-input"
                    value={gpsPrixEstime}
                    onChange={(e) => setGpsPrixEstime(e.target.value)}
                    placeholder='Prix estimé ex: "12.50 €"'
                  />
                  <div
                    style={{
                      background: "rgba(14,165,233,0.07)",
                      border: "1px solid rgba(14,165,233,0.15)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Calcul rapide</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="number"
                        value={gpsCalcKm}
                        onChange={(e) => setGpsCalcKm(Number(e.target.value))}
                        step="0.1"
                        style={{
                          width: 80,
                          padding: "6px 8px",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                          borderRadius: 8,
                          fontSize: 14,
                          boxSizing: "border-box",
                        }}
                      />
                      <span style={{ color: "#cbd5e1", fontSize: 13 }}>km</span>
                      <label style={{ color: "#cbd5e1", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={gpsCalcJour}
                          onChange={(e) => setGpsCalcJour(e.target.checked)}
                        />{" "}
                        Jour
                      </label>
                      <button
                        type="button"
                        onClick={() => setGpsPrixEstime(`${calculerPrix(gpsCalcKm, gpsCalcJour)} €`)}
                        style={{
                          marginLeft: "auto",
                          background: "#0ea5e9",
                          color: "#fff",
                          border: 0,
                          padding: "7px 14px",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        = {calculerPrix(gpsCalcKm, gpsCalcJour)} €
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={startGPS}
                  style={{
                    marginTop: 20,
                    width: "100%",
                    height: 56,
                    background: "#22c55e",
                    color: "#fff",
                    border: 0,
                    borderRadius: 14,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
                  }}
                >
                  📡 Activer mon GPS
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background: "#22c55e",
                    borderRadius: "50%",
                    margin: "0 auto",
                    animation: "pulseDot 2s infinite",
                  }}
                />
                <h3
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    color: "#f8fafc",
                    marginTop: 16,
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  Position active
                </h3>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Vos clients vous voient</p>
                {gpsPosition && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 12,
                      color: "#cbd5e1",
                      marginTop: 14,
                      wordBreak: "break-all",
                    }}
                  >
                    {gpsPosition.lat.toFixed(5)}, {gpsPosition.lng.toFixed(5)}
                  </div>
                )}
                {gpsAccuracy !== null && (
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                    Précision : ±{gpsAccuracy} m · {gpsUpdateCount} mises à jour
                  </div>
                )}
                {gpsDestination && (
                  <div style={{ marginTop: 14, color: "#cbd5e1", fontSize: 14 }}>📍 {gpsDestination}</div>
                )}
                {gpsPrixEstime && (
                  <div
                    style={{
                      color: "#0ea5e9",
                      fontFamily: "'Syne',sans-serif",
                      fontSize: 22,
                      fontWeight: 800,
                      marginTop: 4,
                    }}
                  >
                    {gpsPrixEstime}
                  </div>
                )}
                <button
                  onClick={stopGPS}
                  style={{
                    marginTop: 24,
                    width: "100%",
                    height: 52,
                    background: "#ef4444",
                    color: "#fff",
                    border: 0,
                    borderRadius: 14,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  ⏹ Terminer la course
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════
          SECTION FLOW CHECK
      ══════════════════════════════ */}
      <div style={{ marginTop: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
              🩺 Vérification du flow
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              Audit en direct : tracking IDs, GPS, RLS, realtime.
            </p>
          </div>
          <button
            onClick={() => {
              runFlowChecks();
              loadTrackingMode();
            }}
            disabled={flowRunning}
            style={{
              padding: "10px 18px",
              background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              cursor: flowRunning ? "wait" : "pointer",
              opacity: flowRunning ? 0.6 : 1,
              fontSize: 13,
            }}
          >
            {flowChecks.length === 0 && !flowRunning
              ? "▶ Lancer l'audit"
              : flowRunning
                ? "Analyse en cours…"
                : "🔄 Relancer"}
          </button>
        </div>

        {/* Summary counters */}
        {(flowRunning || flowChecks.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
            {(["ok", "warn", "fail"] as const).map((s) => (
              <div
                key={s}
                style={{
                  background: "#0f172a",
                  border: `1px solid ${s === "ok" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444"}33`,
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em" }}>{s.toUpperCase()}</div>
                {flowRunning ? (
                  <div style={{ marginTop: 8 }}>
                    <CardSkeleton withTitle={false} lines={1} />
                  </div>
                ) : (
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontSize: 28,
                      fontWeight: 900,
                      color: s === "ok" ? "#22c55e" : s === "warn" ? "#f59e0b" : "#ef4444",
                    }}
                  >
                    {flowChecks.filter((c) => c.status === s).length || 0}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Checks list */}
        {(flowRunning || flowChecks.length > 0) && (
          <div
            style={{
              background: "#0f172a",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 15,
                fontWeight: 800,
                marginTop: 0,
                marginBottom: 12,
                color: "#f8fafc",
              }}
            >
              Checks
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {flowRunning && flowChecks.length === 0 && (
                <div style={{ display: "grid", gap: 8 }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: 10,
                        borderLeft: "3px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <LineSkeleton width={20} height={20} />
                      <div style={{ flex: 1 }}>
                        <LineSkeleton width={`${60 + ((i * 7) % 30)}%`} height={12} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {flowChecks.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 10,
                    borderLeft: `3px solid ${c.status === "ok" ? "#22c55e" : c.status === "warn" ? "#f59e0b" : c.status === "fail" ? "#ef4444" : "#64748b"}`,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: "20px" }}>
                    {c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️" : c.status === "fail" ? "❌" : "⏳"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{c.label}</div>
                    {c.detail && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#94a3b8",
                          marginTop: 2,
                          fontFamily: "'JetBrains Mono',monospace",
                          wordBreak: "break-word",
                        }}
                      >
                        {c.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode tracking */}
        {trackingMode !== null && (
          <div
            style={{
              background: "#0f172a",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 15,
                fontWeight: 800,
                marginTop: 0,
                marginBottom: 6,
                color: "#f8fafc",
              }}
            >
              Mode de tracking
            </h3>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0, marginBottom: 14 }}>
              <strong>Chauffeur unique</strong> : tous les clients voient la même position GPS (
              <code>driver_gps id='driver'</code>).
              <br />
              <strong>Multi-courses</strong> : chaque course a sa propre ligne GPS (<code>id = tracking_id</code>).
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(["single", "multi"] as const).map((opt) => {
                const active = trackingMode === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => updateTrackingMode(opt)}
                    disabled={savingMode || active}
                    style={{
                      padding: "12px 18px",
                      background: active ? "linear-gradient(135deg,#0ea5e9,#0369a1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.1)"}`,
                      color: "#fff",
                      borderRadius: 10,
                      fontWeight: 700,
                      cursor: active || savingMode ? "default" : "pointer",
                      opacity: savingMode ? 0.6 : 1,
                      fontFamily: "'Syne',sans-serif",
                      fontSize: 13,
                    }}
                  >
                    {opt === "single" ? "🧑‍✈️ Chauffeur unique" : "🚕🚕 Multi-courses"}
                    {active ? " · actif" : ""}
                  </button>
                );
              })}
              {savingMode && <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>Sauvegarde…</span>}
            </div>
          </div>
        )}

        {/* Simulated scans */}
        {flowResas.length > 0 && (
          <div
            style={{
              background: "#0f172a",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <h3
                style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, margin: 0, color: "#f8fafc" }}
              >
                Test scans simultanés
              </h3>
              <button
                onClick={runSimulatedScans}
                disabled={simRunning || flowResas.length === 0}
                style={{
                  padding: "8px 14px",
                  background: "rgba(14,165,233,0.15)",
                  color: "#7dd3fc",
                  border: "1px solid rgba(14,165,233,0.3)",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: simRunning ? "wait" : "pointer",
                  fontSize: 12,
                }}
              >
                {simRunning ? "Simulation…" : "▶ Lancer 5 scans en parallèle"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0, marginBottom: 12 }}>
              Requêtes <code>reservations</code> + <code>driver_gps</code> en parallèle pour les 5 dernières courses.
            </p>
            {simResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {simResults.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: 8,
                      borderLeft: `3px solid ${r.ok ? "#22c55e" : "#ef4444"}`,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{r.ok ? "✅" : "❌"}</span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#cbd5e1" }}>
                        {r.tracking_id.slice(0, 8)}… <span style={{ color: "#64748b" }}>· {r.ms} ms</span>
                      </div>
                      <div style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Réservations récentes */}
        {(flowResasLoading || flowResas.length > 0) && (
          <div
            style={{ background: "#0f172a", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 15,
                fontWeight: 800,
                marginTop: 0,
                marginBottom: 12,
                color: "#f8fafc",
              }}
            >
              Réservations récentes ({flowResasLoading ? "…" : flowResas.length})
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Client", "Statut", "Tracking ID", "UUID ?", "Destination", "Prix", "Lien"].map((h) => (
                      <th key={h} style={{ padding: 8 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flowResasLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <ReservationRowSkeleton key={i} cols={7} />)
                  ) : flowResas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                        Aucune réservation récente.
                      </td>
                    </tr>
                  ) : (
                    flowResas.map((r: any) => {
                      const valid = r.tracking_id ? trackingIdSchema.safeParse(r.tracking_id).success : false;
                      const url = r.tracking_id ? `/scan/${r.tracking_id}` : null;
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: 8, color: "#cbd5e1" }}>{r.client_name || r.nom || "—"}</td>
                          <td style={{ padding: 8 }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 99,
                                background: "rgba(14,165,233,0.15)",
                                color: "#0ea5e9",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: 8,
                              fontFamily: "'JetBrains Mono',monospace",
                              color: "#94a3b8",
                              fontSize: 11,
                            }}
                          >
                            {r.tracking_id || "—"}
                          </td>
                          <td style={{ padding: 8 }}>{r.tracking_id ? (valid ? "✅" : "❌") : "—"}</td>
                          <td style={{ padding: 8, color: "#cbd5e1" }}>{r.destination || r.arrivee || "—"}</td>
                          <td style={{ padding: 8, color: "#cbd5e1" }}>
                            {r.prix_estime != null ? `${r.prix_estime} €` : "—"}
                          </td>
                          <td style={{ padding: 8 }}>
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>
                                ouvrir
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modale confirmation ── */}
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
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 12 }}>{confirmAction.type === "accept" ? "✅" : "❌"}</div>
            <h2
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 22,
                fontWeight: 800,
                color: "#f8fafc",
                margin: "0 0 8px",
              }}
            >
              {confirmAction.type === "accept" ? "Accepter cette course ?" : "Refuser cette course ?"}
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.5, margin: "0 0 8px" }}>
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
                    ? `🌙 Tarif nuit ${TARIF_NUIT_LABEL}`
                    : `☀️ Tarif jour ${TARIF_JOUR_LABEL}`}
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
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {kmLoading ? (
                  <>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>📡 Calcul de la distance…</span>
                    <span style={{ color: "#475569", fontSize: 12, fontStyle: "italic" }}>via OpenRouteService</span>
                  </>
                ) : (
                  (() => {
                    const rv = confirmAction.r;
                    const tarif_nuit = rv.pickup_datetime ? isNuit(rv.pickup_datetime) : false;
                    const km = rv.distance_km ? Number(rv.distance_km) : (autoKm ?? 5);
                    const px = calculerPrix(km, !tarif_nuit);
                    return (
                      <>
                        <div>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>Distance estimée</div>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 15 }}>{km} km</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>Prix calculé</div>
                          <div
                            style={{ color: "#ef4444", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22 }}
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

            {(() => {
              const ph = confirmAction.r.client_phone || confirmAction.r.telephone;
              const em = confirmAction.r.client_email || confirmAction.r.email;
              if (!ph && !em) return null;
              return (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "0 0 14px", fontSize: 14 }}>
                  {ph && (
                    <a href={`tel:${ph}`} style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>
                      📞 {ph}
                    </a>
                  )}
                  {em && (
                    <a href={`mailto:${em}`} style={{ color: "#94a3b8", textDecoration: "none" }}>
                      ✉️ {em}
                    </a>
                  )}
                </div>
              );
            })()}

            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 22px" }}>
              {confirmAction.type === "accept"
                ? "Le client recevra un WhatsApp + email avec le lien de suivi en temps réel."
                : "Le motif sera enregistré. Visible dans l'onglet Refusées."}
            </p>

            {confirmAction.type === "refuse" && (
              <div style={{ marginBottom: 18 }}>
                <label
                  htmlFor="refusal-reason"
                  style={{ display: "block", color: "#cbd5e1", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
                >
                  Motif du refus <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  id="refusal-reason"
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value.slice(0, 500))}
                  disabled={confirmBusy}
                  autoFocus
                  rows={3}
                  maxLength={500}
                  placeholder="Ex. : créneau indisponible, zone non desservie, doublon…"
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
                  if (confirmAction.type === "refuse" && refusalReason.trim().length < 3) {
                    toast.error("Motif requis", { description: "3 caractères minimum." });
                    return;
                  }
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
                {confirmBusy ? "..." : confirmAction.type === "accept" ? "✓ Accepter & notifier" : "✗ Refuser"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale QR Code ── */}
      {qrModal && <QrModal url={qrModal.url} onClose={() => setQrModal(null)} />}
    </div>
  );
}
