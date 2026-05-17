import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
import { assertTrackingId, newTrackingId } from "@/lib/tracking-id";
import { CourseCardSkeleton, Skeleton, SkeletonStyles, StatCardSkeleton } from "@/components/admin/Skeleton";

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
  const initialLoad = useRef(true);

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

  const fetchAll = useCallback(() => {
    fetchStats();
    fetchCourses();
  }, [fetchStats, fetchCourses]);

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
      .subscribe();
    initialLoad.current = false;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAll, fetchStats]);

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
                      <span style={{ color: "#0ea5e9", fontWeight: 700 }}>💰 {Number(prix).toFixed(2)} €</span>
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
                      <span style={{ color: "#0ea5e9", fontWeight: 700 }}>💰 {Number(prix).toFixed(2)} €</span>
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
                </div>
              );
            })}
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
                            style={{ color: "#0ea5e9", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22 }}
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
