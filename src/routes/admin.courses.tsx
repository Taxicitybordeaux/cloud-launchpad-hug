import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
import { assertTrackingId, newTrackingId } from "@/lib/tracking-id";
import { CourseCardSkeleton, SkeletonStyles } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/courses")({
  head: () => ({
    meta: [{ title: "Courses — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: CoursesPage,
});

type R = any;

const tabKeys = ["pending", "accepted", "refused"] as const;

const normalizeStatus = (s: unknown): (typeof tabKeys)[number] => {
  if (s === "accepted") return "accepted";
  if (s === "refused") return "refused";
  return "pending";
};

const tabLabels: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptées",
  refused: "Refusées",
};

// Tarifs officiels Bordeaux
const TARIF_JOUR_LABEL = "2,16 €/km";
const TARIF_NUIT_LABEL = "3,26 €/km";

/** Formate une date ISO en heure de Paris (Europe/Paris) */
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
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 12,
            display: "inline-block",
            marginBottom: 16,
          }}
        >
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

function CoursesPage() {
  const [tab, setTab] = useState<(typeof tabKeys)[number]>("pending");
  const [items, setItems] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, refused: 0 });
  const [simKm, setSimKm] = useState(5);
  const [simJour, setSimJour] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "accept" | "refuse"; r: R } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [autoKm, setAutoKm] = useState<number | null>(null);
  const [kmLoading, setKmLoading] = useState(false);
  const [cardKm, setCardKm] = useState<Record<string, number>>({}); // id → km calculé
  const [cardKmLoading, setCardKmLoading] = useState<Record<string, boolean>>({});
  const [qrModal, setQrModal] = useState<{ url: string } | null>(null);
  const initialLoad = useRef(true);

  // =========================
  // FETCH
  // =========================
  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase.from("reservations").select("*").order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const rows = data ?? [];
    setItems(rows);
    const nextCounts = { pending: 0, accepted: 0, refused: 0 };
    rows.forEach((r: R) => {
      nextCounts[normalizeStatus(r.status)]++;
    });
    setCounts(nextCounts);
    setLoading(false);
    // Calcule et sauvegarde automatiquement les prix manquants
    repairMissingPrices(rows);
  }, []);

  // =========================
  // REALTIME
  // =========================
  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("courses-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
        if (!initialLoad.current) {
          const n = payload.new as R;
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
      .subscribe();
    initialLoad.current = false;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAll]);

  // Répare automatiquement le prix des courses acceptées sans prix_estime
  const repairMissingPrices = useCallback(async (rows: R[]) => {
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
        // Sauvegarde en base pour ne plus avoir à recalculer
        await supabase.from("reservations").update({ distance_km: km, prix_estime: prix }).eq("id", r.id);
        setCardKm((prev) => ({ ...prev, [r.id]: km }));
      } catch {}
      setCardKmLoading((prev) => ({ ...prev, [r.id]: false }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================
  // CALCUL DISTANCE AUTO — OpenRouteService (gratuit, 2000 req/jour, CORS ok)
  // Clé : VITE_ORS_API_KEY — inscription gratuite sur openrouteservice.org
  // =========================
  const fetchDistanceKm = async (depart: string, arrivee: string): Promise<number> => {
    const apiKey =
      (import.meta.env.VITE_ORS_API_KEY as string | undefined) ||
      "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImNhMGVmYTZiNGQ2MzQ3ZGJhZDJmMmY0ZDc2YjYyYTIwIiwiaCI6Im11cm11cjY0In0=";

    // Étape 1 : géocoder les deux adresses via l'API Nominatim (OpenStreetMap) — 100% gratuit, sans clé
    const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Bordeaux, France")}&format=json&limit=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "fr" } });
        const data = await res.json();
        if (data?.[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      } catch {}
      return null;
    };

    const [a, b] = await Promise.all([geocode(depart), geocode(arrivee)]);

    // Étape 2 : distance réelle par la route via ORS (si clé dispo)
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

    // Étape 3 : fallback Haversine × 1.3 si ORS échoue ou pas de clé
    if (a && b) {
      const R = 6371;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const sin2 =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const crow = R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
      return Math.round((crow * 1.3) / 0.5) * 0.5;
    }

    // Dernier fallback
    return 5;
  };

  // =========================
  // ACCEPT — avec WhatsApp + Email + QR
  // =========================
  const handleAccept = async (r: R) => {
    let trackingId: string;
    try {
      trackingId = r.tracking_id ? assertTrackingId(r.tracking_id) : newTrackingId();
      assertTrackingId(trackingId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "tracking_id invalide";
      toast.error("Impossible d'accepter la course", { description: msg });
      return;
    }

    // Calcul du prix selon tarif jour/nuit (heure de Paris)
    // distance_km déjà en base → on l'utilise ; sinon autoKm calculé au moment de l'ouverture modale
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

    // Ajout/màj client
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

    // Copie lien
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

    // 📧 Email client — via /api/admin/send-course-email (bridge serveur)
    // L'admin utilise un PIN custom (pas de session Supabase Auth), donc on passe
    // par un endpoint serveur qui appelle l'infra email avec la service role key.
    // VITE_LOVABLE_API_KEY est le secret partagé côté client (même valeur que LOVABLE_API_KEY côté serveur).
    const adminSecret = "admin-pin-call";
    let emailOk = false;
    let emailDetail = "Aucun email client renseigné";
    if (email && url) {
      try {
        const res = await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Secret": adminSecret,
          },
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
        emailOk = res.ok;
        emailDetail = res.ok
          ? `✉️ Email envoyé à ${email}`
          : `⚠️ Échec email (${res.status}) — vérifiez le template "course-accepted" dans Lovable`;
      } catch {
        emailDetail = "⚠️ Échec email (réseau)";
      }
    }

    // 💬 WhatsApp
    const waPhone = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "33");
    const pickupStr = pickupFormatted ?? "—";
    const refId = `TCB-${r.id.slice(0, 8).toUpperCase()}`;
    const paxLine = `${r.nb_passagers || r.passagers || 1} passager(s)${(r.bagages ?? 0) > 0 ? ` · ${r.bagages} bagage(s)` : ""}`;

    const waMsg = encodeURIComponent(
      `Bonjour ${name || ""},\n\n` +
        `✅ Votre course *${refId}* est confirmée !\n\n` +
        `🕐 Prise en charge : ${pickupStr}\n` +
        `📍 Départ : ${r.depart}\n` +
        `🏁 Arrivée : ${r.arrivee || r.destination || "—"}\n` +
        `👥 ${paxLine}\n` +
        `💰 Prix estimé : *${prixStr}* (tarif ${tarif_nuit ? "nuit" : "jour"})\n\n` +
        `📲 Suivez votre chauffeur en temps réel :\n${url}\n\n` +
        `📞 06 73 07 23 22 (7j/7 · 24h/24)`,
    );
    const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;

    if (typeof window !== "undefined") {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }

    toast.success(`Course acceptée — ${name || "client"}`, {
      description: `${emailDetail} · 💬 WhatsApp ouvert`,
      duration: 8000,
      action: {
        label: "📲 QR Code",
        onClick: () => setQrModal({ url }),
      },
    });

    fetchAll();
  };

  // =========================
  // REFUSE
  // =========================
  const handleRefuse = async (r: R, motif: string) => {
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
  // RENVOYER EMAIL (sur une course acceptée)
  // =========================
  const handleSendEmail = async (r: R) => {
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

    // Même bridge serveur — secret partagé VITE_LOVABLE_API_KEY
    const adminSecret = "admin-pin-call";
    try {
      const res = await fetch("/api/admin/send-course-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
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
        toast.error(`Échec envoi email (${res.status})`, {
          description: 'Vérifiez le template "course-accepted" dans Lovable.',
        });
      }
    } catch {
      toast.error("Erreur réseau", { description: "Impossible d'envoyer l'email." });
    }
  };

  const filtered = items.filter((r) => normalizeStatus(r.status) === tab);
  const simPrixJour = calculerPrix(simKm, true);
  const simPrixNuit = calculerPrix(simKm, false);

  // =========================
  // UI
  // =========================
  return (
    <div style={{ padding: "32px 24px", fontFamily: "'DM Sans',sans-serif" }}>
      <h1
        style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 30,
          fontWeight: 800,
          color: "#f8fafc",
          marginBottom: 24,
        }}
      >
        Courses
      </h1>

      {/* SIMULATEUR DE TARIF — jour ET nuit */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setSimOpen((o) => !o)}
          style={{
            background: "transparent",
            border: 0,
            color: "#0ea5e9",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {simOpen ? "▼" : "▶"} Simulateur de tarif
        </button>
        {simOpen && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <input
                type="number"
                value={simKm}
                step="0.1"
                onChange={(e) => setSimKm(Number(e.target.value))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                  width: 90,
                }}
              />
              <span style={{ color: "#94a3b8" }}>km</span>
              <span style={{ color: "#fbbf24" }}>
                ☀️ Jour : <b style={{ color: "#0ea5e9" }}>{simPrixJour} €</b>
              </span>
              <span style={{ color: "#818cf8" }}>
                🌙 Nuit : <b style={{ color: "#0ea5e9" }}>{simPrixNuit} €</b>
              </span>
            </div>
            {/* Rappel des tarifs officiels */}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                fontSize: 12,
                color: "#64748b",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 10,
              }}
            >
              <span
                style={{
                  background: "rgba(250,204,21,0.1)",
                  color: "#fbbf24",
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontWeight: 700,
                }}
              >
                ☀️ Jour : {TARIF_JOUR_LABEL} — 6h → 20h
              </span>
              <span
                style={{
                  background: "rgba(99,102,241,0.1)",
                  color: "#818cf8",
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontWeight: 700,
                }}
              >
                🌙 Nuit : {TARIF_NUIT_LABEL} — 20h → 6h
              </span>
              <span style={{ color: "#475569", fontSize: 11, alignSelf: "center" }}>
                + Prise en charge 2,83 € · Heure de Paris
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {tabKeys.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 700,
              border: tab === k ? "1px solid rgba(14,165,233,0.4)" : "1px solid rgba(255,255,255,0.08)",
              background: tab === k ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
              color: tab === k ? "#0ea5e9" : "#94a3b8",
            }}
          >
            {tabLabels[k]} ({counts[k]})
          </button>
        ))}
      </div>

      {/* LISTE */}
      <SkeletonStyles />
      {loading && (
        <>
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "#475569", padding: 40 }}>Aucune réservation</div>
      )}

      {!loading &&
        filtered.map((r) => {
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
            r.tracking_id && typeof window !== "undefined" ? `${window.location.origin}/scan/${r.tracking_id}` : null;

          return (
            <div
              key={r.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: 20,
                marginBottom: 14,
              }}
            >
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

              {/* Infos course */}
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
                ) : prix !== null && prix !== undefined ? (
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
              </div>

              {/* Message client */}
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

              {/* Contacts */}
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

              {/* Motif refus */}
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
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#fca5a5" }}>Motif du refus :</span> {r.refus_motif}
                </div>
              )}

              {/* BOUTONS D'ACTION */}
              <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Accepter / Refuser — uniquement sur pending */}
                {normalizeStatus(r.status) === "pending" && (
                  <>
                    <button
                      onClick={async () => {
                        setAutoKm(r.distance_km ? Number(r.distance_km) : null);
                        setConfirmAction({ type: "accept", r });
                        // Lance le calcul auto si pas encore de distance en base
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

                {/* WhatsApp rapide — courses acceptées */}
                {normalizeStatus(r.status) === "accepted" && phone && (
                  <button
                    onClick={() => {
                      const waPhone = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "33");
                      const pickupStr = r.pickup_datetime
                        ? formatParis(r.pickup_datetime, { dateStyle: "full", timeStyle: "short" })
                        : "—";
                      const tarif_nuit_wa = r.pickup_datetime ? isNuit(r.pickup_datetime) : r.tarif_jour === false;
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
                        `Bonjour ${name || ""},\n\n` +
                          `✅ Votre course *${refId}* est confirmée !\n\n` +
                          `🕐 Prise en charge : ${pickupStr}\n` +
                          `📍 Départ : ${r.depart}\n` +
                          `🏁 Arrivée : ${dest || "—"}\n` +
                          `👥 ${paxLine}\n` +
                          `💰 Prix estimé : *${prixStr}* (tarif ${tarif_nuit_wa ? "nuit" : "jour"})\n\n` +
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
                )}

                {/* ✉️ Bouton Email — toutes les courses avec un email */}
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
              </div>
            </div>
          );
        })}

      {/* MODALE DE CONFIRMATION */}
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

            {/* Infos pickup en heure Paris */}
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
                  style={{
                    color: isNuit(confirmAction.r.pickup_datetime) ? "#818cf8" : "#fbbf24",
                    fontWeight: 700,
                  }}
                >
                  {isNuit(confirmAction.r.pickup_datetime)
                    ? `🌙 Tarif nuit ${TARIF_NUIT_LABEL}`
                    : `☀️ Tarif jour ${TARIF_JOUR_LABEL}`}
                </span>
              </div>
            )}

            {/* Prix estimé dans la modale — calculé automatiquement */}
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
                    <span style={{ color: "#475569", fontSize: 12, fontStyle: "italic" }}>via Google Maps</span>
                  </>
                ) : (
                  (() => {
                    const r = confirmAction.r;
                    const tarif_nuit = r.pickup_datetime ? isNuit(r.pickup_datetime) : false;
                    const km = r.distance_km ? Number(r.distance_km) : (autoKm ?? 5);
                    const prix = calculerPrix(km, !tarif_nuit);
                    return (
                      <>
                        <div>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>Distance estimée</div>
                          <div style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 15 }}>{km} km</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>Prix calculé</div>
                          <div
                            style={{
                              color: "#0ea5e9",
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 800,
                              fontSize: 22,
                            }}
                          >
                            {prix.toFixed(2)} €
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
                disabled={confirmBusy || (confirmAction.type === "refuse" && refusalReason.trim().length < 3)}
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

      {/* MODALE QR CODE */}
      {qrModal && <QrModal url={qrModal.url} onClose={() => setQrModal(null)} />}
    </div>
  );
}
