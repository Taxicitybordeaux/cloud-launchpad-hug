import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, calculerPrixMixte, PRISE_EN_CHARGE } from "@/lib/tarif";
import { geocodeAddress, reverseGeocode } from "@/lib/geocode";
import { newSuiviId } from "@/lib/suivi-id";
import { subscribePush } from "@/lib/push.functions";
import { getFcmToken } from "@/lib/firebase";
import { DICTS, LANGUAGES, type Lang } from "@/i18n/dict";

export const Route = createFileRoute("/reserver")({
  head: () => ({
    meta: [
      { title: "Réserver — Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi en ligne." },
    ],
  }),
  component: ReservationPage,
});

const BORDEAUX_CENTER: [number, number] = [44.8378, -0.5792];

interface FormState {
  depart: string;
  destination: string;
  date: string;
  heure: string;
  passagers: number;
  bagages: number;
  paiement: string;
  prenom: string;
  nom: string;
  phone: string;
  email: string;
}

interface OrsResult {
  distanceKm: number;
  dureeS: number;
}

async function geocodeFullAddress(address: string): Promise<[number, number] | null> {
  // Essai avec Bordeaux, puis sans
  let c = await geocodeAddress(address + ", Bordeaux, France");
  if (!c) c = await geocodeAddress(address);
  return c ? [c.lng, c.lat] : null;
}

// ─── OSRM : prend le chemin le plus LONG parmi les alternatives ───────────────
async function getOsrmRouteLongest(from: [number, number], to: [number, number]): Promise<OrsResult | null> {
  // On demande jusqu'à 3 alternatives à OSRM
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=false&alternatives=3&steps=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.routes || json.routes.length === 0) return null;
    // Prendre le chemin avec la DISTANCE la plus longue
    const longest = json.routes.reduce((best: any, r: any) => (r.distance > best.distance ? r : best));
    return {
      distanceKm: Math.round((longest.distance / 1000) * 10) / 10,
      dureeS: Math.round(longest.duration),
    };
  } catch {
    return null;
  }
}

// ─── OSRM polyline : chemin le plus long ─────────────────────────────────────
async function getOsrmPolylineLongest(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=full&geometries=geojson&alternatives=3&steps=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.routes || json.routes.length === 0) return [];
    const longest = json.routes.reduce((best: any, r: any) => (r.distance > best.distance ? r : best));
    return (longest.geometry?.coordinates ?? []) as [number, number][];
  } catch {
    return [];
  }
}

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
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "14px 14px",
  borderRadius: 12,
  border: `2px solid ${hasError ? "#ef4444" : "rgba(203,213,225,0.4)"}`,
  fontSize: 16,
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: "'DM Sans',sans-serif",
  outline: "none",
  boxSizing: "border-box",
  minHeight: 48,
});

function ReservationPage() {
  const navigate = useNavigate();
  const [today, setToday] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [orsResult, setOrsResult] = useState<OrsResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [geolocLoading, setGeolocLoading] = useState(false);
  const [taxiAvailable, setTaxiAvailable] = useState<boolean | null>(null);

  const [f, setF] = useState<FormState>({
    depart: "",
    destination: "",
    date: "",
    heure: "",
    passagers: 1,
    bagages: 0,
    paiement: "especes",
    prenom: "",
    nom: "",
    phone: "",
    email: "",
  });

  const set = (k: keyof FormState, v: any) => setF((p) => ({ ...p, [k]: v }));

  const [lang, setLang] = useState<Lang>("fr");
  const d = DICTS[lang];
  const t = (k: string) => d[k] ?? DICTS["fr"][k] ?? k;
  const dir = lang === "ar" ? "rtl" : "ltr";

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);

  const pickupIso = f.date && f.heure ? `${f.date}T${f.heure}:00` : null;
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : 12;
  const tarifJour = heureNum >= 7 && heureNum < 19;
  const prixAller =
    orsResult && pickupIso
      ? calculerPrixMixte(orsResult.distanceKm, pickupIso)
      : orsResult
        ? calculerPrix(orsResult.distanceKm, tarifJour)
        : PRISE_EN_CHARGE;

  useEffect(() => {
    const d = new Date().toISOString().split("T")[0];
    setToday(d);
    setF((p) => ({ ...p, date: p.date || d }));
  }, []);

  // ── Init carte ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const initMap = async () => {
      try {
        await loadLeaflet();
      } catch {
        return;
      }
      if (!mounted || !mapRef.current) return;
      const L = (window as any).L;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
      const map = L.map(mapRef.current, { center: BORDEAUX_CENTER, zoom: 12, zoomControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 400);
    };
    initMap();
    return () => {
      mounted = false;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, []);

  // ── Marqueurs + tracé (chemin le plus long) ───────────────────────────────
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (fromCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(34,197,94,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (fromMarker.current) fromMarker.current.remove();
      fromMarker.current = L.marker([fromCoord[1], fromCoord[0]], { icon }).addTo(map);
    }

    if (toCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#f5c842;border-radius:50%;border:3px solid #1a1a2e;box-shadow:0 0 0 4px rgba(245,200,66,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (toMarker.current) toMarker.current.remove();
      toMarker.current = L.marker([toCoord[1], toCoord[0]], { icon }).addTo(map);
    }

    if (fromCoord && toCoord) {
      // Toujours le chemin le plus long
      getOsrmPolylineLongest(fromCoord, toCoord).then((coords) => {
        if (!mapInst.current || !L) return;
        if (routeLayer.current) {
          routeLayer.current.remove();
          routeLayer.current = null;
        }
        if (coords.length > 1) {
          routeLayer.current = L.polyline(
            coords.map((c) => [c[1], c[0]]),
            { color: "#f5c842", weight: 5, opacity: 0.95 },
          ).addTo(mapInst.current);
          mapInst.current.fitBounds(
            L.latLngBounds([
              [fromCoord[1], fromCoord[0]],
              [toCoord[1], toCoord[0]],
              ...coords.map((c) => [c[1], c[0]]),
            ]).pad(0.25),
          );
        }
      });
    } else if (fromCoord) {
      map.setView([fromCoord[1], fromCoord[0]], 14);
    }
  }, [fromCoord, toCoord]);

  // ── OSRM : recalcul distance/prix (chemin le plus long) ───────────────────
  useEffect(() => {
    if (!fromCoord || !toCoord) {
      setOrsResult(null);
      return;
    }
    setCalcLoading(true);
    getOsrmRouteLongest(fromCoord, toCoord).then((r) => {
      setOrsResult(r);
      setCalcLoading(false);
    });
  }, [fromCoord, toCoord]);

  // ── Géolocalisation départ (navigateur client) ───────────────────────────
  const handleGeolocate = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non disponible");
      return;
    }
    setGeolocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // reverseGeocode(lat, lng) — même signature que l'original
        const adresse = await reverseGeocode(lat, lng).catch(() => null);

        set("depart", adresse ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        // fromCoord en [lng, lat] pour OSRM (format GeoJSON)
        setFromCoord([lng, lat]);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.depart;
          return next;
        });
        toast.success(t("res.geo.btn") + " ✓");
        setGeolocLoading(false);
      },
      (err) => {
        setGeolocLoading(false);
        const msg =
          err.code === 1
            ? t("res.geo.err.denied")
            : err.code === 2
              ? t("res.geo.err.unavailable")
              : t("res.geo.err.timeout");
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  // Tentative auto au chargement (sans bloquer)
  useEffect(() => {
    handleGeolocate();
  }, [handleGeolocate]);

  // ── Résoudre adresse départ (saisie manuelle) ────────────────────────────
  const resolveDepartAddress = useCallback(async () => {
    const value = f.depart.trim();
    if (!value) return;
    setCalcLoading(true);
    const coord = await geocodeFullAddress(value);
    setCalcLoading(false);
    if (coord) {
      setFromCoord(coord);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.depart;
        return next;
      });
    } else {
      setFromCoord(null);
      setErrors((prev) => ({ ...prev, depart: "Adresse introuvable" }));
    }
  }, [f.depart]);

  // ── Résoudre adresse destination ─────────────────────────────────────────
  const resolveDestinationAddress = useCallback(async () => {
    const value = f.destination.trim();
    if (!value) return;
    setCalcLoading(true);
    const coord = await geocodeFullAddress(value);
    setCalcLoading(false);
    if (coord) {
      setToCoord(coord);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.destination;
        return next;
      });
    } else {
      setToCoord(null);
      setErrors((prev) => ({ ...prev, destination: "Adresse introuvable" }));
    }
  }, [f.destination]);

  // ── Disponibilité taxi ────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase
          .from("reservations")
          .select("id", { count: "exact", head: false })
          .not("status", "in", '("cancelled","refused","completed")')
          .limit(1);
        if (error) throw error;
        setTaxiAvailable(!data || data.length === 0);
      } catch {
        setTaxiAvailable(null);
      }
    };
    check();
  }, []);

  // ── Auto-push client au chargement ──────────────────────────────────────
  useEffect(() => {
    const registerPush = async () => {
      try {
        const token = await getFcmToken();
        if (!token) return;
        await subscribePush({ data: { audience: "client", fcm_token: token, user_agent: navigator.userAgent } });
      } catch {
        // silencieux — pas bloquant
      }
    };
    registerPush();
  }, []);

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!f.prenom.trim()) newErrors.prenom = t("res.err.required");
    if (!f.nom.trim()) newErrors.nom = t("res.err.required");
    if (!f.phone.trim()) newErrors.phone = t("res.err.required");
    if (!f.email.trim()) newErrors.email = t("res.err.required");
    if (!f.depart.trim()) newErrors.depart = t("res.err.required");
    if (!f.destination.trim()) newErrors.destination = t("res.err.required");
    if (!fromCoord) newErrors.depart = t("res.geo.err.unavailable");
    if (!toCoord) newErrors.destination = t("res.geo.err.unavailable");
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(t("res.err.required"));
      return;
    }

    if (!orsResult) {
      setErrors(newErrors);
      toast.error(t("rsim.loading"));
      return;
    }

    setSending(true);

    try {
      const suiviId = newSuiviId();

      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickupIsoFinal = f.date && f.heure ? `${f.date}T${f.heure}:00+00:00` : new Date().toISOString();

      const { error } = await supabase.from("reservations").insert({
        // NOT NULL columns
        nom: fullName,
        telephone: f.phone,
        email: f.email,
        depart: f.depart,
        arrivee: f.destination,
        pickup_datetime: pickupIsoFinal,
        passagers: f.passagers,
        service_type: "standard",
        status: "pending",
        // Optional / mirror columns
        suivi_id: suiviId,
        client_name: fullName,
        client_phone: f.phone,
        client_email: f.email,
        destination: f.destination,
        distance_km: orsResult?.distanceKm ?? 0,
        nb_passagers: f.passagers,
        bagages: f.bagages,
        paiement: f.paiement,
        tarif_jour: tarifJour,
        prix_estime: prixAller,
        source: "form",
        lang: lang as any,
      });

      if (error) throw error;

      // ── Notif push + email chauffeur ──────────────────────────────────────
      try {
        await fetch("/api/public/notify-reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suivi_id: suiviId }),
        });
      } catch (fetchErr) {
        console.error("[notify] push failed", fetchErr);
      }

      toast.success(`${t("conf.ok.title")} ${f.prenom}`);
      setSending(false);
      navigate({ to: "/suivi/$id", params: { id: suiviId } });
    } catch (err: any) {
      setSending(false);
      toast.error(t("res.err.global"), { description: err?.message });
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0f4bbf",
        fontFamily: "'DM Sans',sans-serif",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        input[type=date], input[type=time] { color-scheme: light; }
        input[type=text], input[type=tel], input[type=email] { font-size: 16px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .leaflet-container { width: 100% !important; height: 100% !important; }
      `}</style>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Badge disponibilité */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background:
              taxiAvailable === false
                ? "rgba(239,68,68,0.15)"
                : taxiAvailable === true
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(10,10,20,0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: 99,
            padding: "7px 14px",
            display: "flex",
            alignItems: "center",
            gap: 7,
            border:
              taxiAvailable === false
                ? "1px solid rgba(239,68,68,0.5)"
                : taxiAvailable === true
                  ? "1px solid rgba(34,197,94,0.5)"
                  : "1px solid rgba(245,200,66,0.2)",
            zIndex: 100,
            boxShadow:
              taxiAvailable === false
                ? "0 0 12px rgba(239,68,68,0.25)"
                : taxiAvailable === true
                  ? "0 0 12px rgba(34,197,94,0.2)"
                  : "none",
          }}
        >
          {/* Point clignotant */}
          <div style={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: taxiAvailable === false ? "#ef4444" : taxiAvailable === true ? "#22c55e" : "#94a3b8",
                animation: taxiAvailable !== null ? "pulse 1.8s ease-in-out infinite" : "none",
              }}
            />
            {taxiAvailable !== null && (
              <div
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  background: taxiAvailable === false ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)",
                  animation: "pulse 1.8s ease-in-out infinite",
                }}
              />
            )}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: taxiAvailable === false ? "#fca5a5" : taxiAvailable === true ? "#86efac" : "#94a3b8",
              letterSpacing: 0.2,
            }}
          >
            {taxiAvailable === null
              ? t("res.geo.loading")
              : taxiAvailable
                ? t("taxi.badge.available")
                : t("taxi.badge.busy")}
          </span>
        </div>

        {/* Badge calcul */}
        {calcLoading && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(10,10,20,0.85)",
              backdropFilter: "blur(12px)",
              borderRadius: 99,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid rgba(245,200,66,0.15)",
              zIndex: 100,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                border: "2px solid #f5c842",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#f5c842" }}>{t("rsim.loading")}</span>
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      <div
        dir={dir}
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg, #0f4bbf 0%, #0a3aa1 100%)",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
        }}
      >
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9 }} />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Clash Display'" }}>
                {t("res.title")}
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>{t("res.intro")}</div>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#f5f5f5",
                borderRadius: 8,
                padding: "6px 8px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} style={{ background: "#1e3a8a", color: "#f5f5f5" }}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Bannière disponibilité taxi ── */}
          {taxiAvailable === false && (
            <div
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🚕</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5", marginBottom: 2 }}>
                  {t("taxi.banner.busy.title")}
                </div>
                <div style={{ fontSize: 12, color: "#fecaca", lineHeight: 1.4 }}>{t("taxi.banner.busy.desc")}</div>
              </div>
            </div>
          )}
          {taxiAvailable === true && (
            <div
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#86efac" }}>{t("taxi.banner.available.msg")}</div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            {/* ── Coordonnées ── */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
                {t("res.loc.contact_section")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "prenom" as const, label: t("res.loc.firstname"), ph: "Jean" },
                  { k: "nom" as const, label: t("res.loc.lastname"), ph: "Dupont" },
                ].map(({ k, label, ph }) => (
                  <div key={k}>
                    <label
                      style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                    >
                      {label}
                    </label>
                    <input
                      type="text"
                      value={f[k]}
                      onChange={(e) => set(k, e.target.value)}
                      placeholder={ph}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      name={`tcb-${k}-x`}
                      style={inputStyle(!!errors[k])}
                    />
                    {errors[k] && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {[
                  { k: "phone" as const, label: t("res.loc.phone"), ph: "06 12 34 56 78", type: "tel" },
                  { k: "email" as const, label: t("res.loc.email"), ph: "jean@exemple.fr", type: "email" },
                ].map(({ k, label, ph, type }) => (
                  <div key={k}>
                    <label
                      style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                    >
                      {label}
                    </label>
                    <input
                      type={type}
                      value={f[k]}
                      onChange={(e) => set(k, e.target.value)}
                      placeholder={ph}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      name={`tcb-${k}-x`}
                      style={inputStyle(!!errors[k])}
                    />
                    {errors[k] && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Adresses ── */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
                {t("res.loc.ride_section")}
              </div>

              {/* Départ : saisie libre + bouton géoloc */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  {t("res.loc.from")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={f.depart}
                    onChange={(e) => {
                      set("depart", e.target.value);
                      setFromCoord(null);
                    }}
                    onBlur={resolveDepartAddress}
                    placeholder="Adresse ou cliquez 📍"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    name="tcb-depart-x"
                    style={{ ...inputStyle(!!errors.depart), paddingRight: 52 }}
                  />
                  <button
                    type="button"
                    onClick={handleGeolocate}
                    disabled={geolocLoading}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#f5c842",
                      border: "none",
                      borderRadius: 8,
                      cursor: geolocLoading ? "wait" : "pointer",
                      color: "#0f172a",
                      padding: "8px 10px",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                    aria-label="Me géolocaliser"
                  >
                    {geolocLoading ? "⏳" : "📍"}
                  </button>
                </div>
                {errors.depart && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors.depart}</div>}
                {fromCoord && !errors.depart && (
                  <div style={{ color: "#86efac", fontSize: 11, marginTop: 4 }}>✓ {t("res.geo.btn")}</div>
                )}
              </div>

              {/* Destination */}
              <div>
                <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  {t("res.loc.to")}
                </label>
                <input
                  type="text"
                  value={f.destination}
                  onChange={(e) => {
                    set("destination", e.target.value);
                    setToCoord(null);
                  }}
                  onBlur={resolveDestinationAddress}
                  placeholder={t("res.f.to.ph")}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="tcb-dest-x"
                  style={inputStyle(!!errors.destination)}
                />
                {errors.destination && (
                  <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors.destination}</div>
                )}
                {toCoord && !errors.destination && (
                  <div style={{ color: "#86efac", fontSize: 11, marginTop: 4 }}>✓ {t("res.loc.to")}</div>
                )}
              </div>

              {/* Récap distance + prix */}
              {orsResult && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 16px",
                    background: "rgba(245,200,66,0.12)",
                    borderRadius: 12,
                    border: "1px solid rgba(245,200,66,0.3)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, color: "#f5c842", fontWeight: 700 }}>
                      {orsResult.distanceKm} km · {Math.round(orsResult.dureeS / 60)} min
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 2 }}>{t("rsim.estimate")}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#f5c842", fontFamily: "'Clash Display'" }}>
                      {prixAller.toFixed(2)} €
                    </div>
                  </div>
                </div>
              )}
              {calcLoading && !orsResult && (
                <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 8, textAlign: "center" }}>
                  ⏳ Calcul de l'itinéraire…
                </div>
              )}
            </div>

            {/* ── Date/heure ── */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
                🕐 {t("res.loc.date_label")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {t("res.loc.date_label")}
                  </label>
                  <input
                    type="date"
                    value={f.date}
                    onChange={(e) => set("date", e.target.value)}
                    min={today}
                    style={inputStyle()}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {t("res.loc.time_label")}
                  </label>
                  <input
                    type="time"
                    value={f.heure}
                    onChange={(e) => set("heure", e.target.value)}
                    style={inputStyle()}
                  />
                </div>
              </div>
            </div>

            {/* ── Passagers / Bagages ── */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
                👥 {t("res.f.passengers")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {t("res.f.passengers")}
                  </label>
                  <select
                    value={f.passagers}
                    onChange={(e) => set("passagers", parseInt(e.target.value))}
                    style={inputStyle()}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n > 1 ? t("res.loc.passengers_pl") : t("res.loc.passenger_sg")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {t("res.f.luggage")}
                  </label>
                  <select
                    value={f.bagages}
                    onChange={(e) => set("bagages", parseInt(e.target.value))}
                    style={inputStyle()}
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} {n > 1 ? t("res.loc.luggage_pl") : t("res.loc.luggage_sg")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Paiement ── */}
            <div>
              <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                {t("res.loc.payment_section")}
              </label>
              <select value={f.paiement} onChange={(e) => set("paiement", e.target.value)} style={inputStyle()}>
                <option value="especes">{t("res.loc.cash")}</option>
                <option value="cb">{t("res.loc.card")}</option>
              </select>
            </div>

            {/* ── Bouton réserver ── */}
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: "14px 20px",
                background: sending ? "#64748b" : "#f5c842",
                color: sending ? "#cbd5e1" : "#0f172a",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                cursor: sending ? "wait" : "pointer",
              }}
            >
              {sending ? t("res.sending") : t("res.send")}
            </button>

            {!orsResult && !calcLoading && fromCoord && toCoord && (
              <div style={{ color: "#fecaca", fontSize: 12, textAlign: "center", marginTop: -8 }}>
                {t("res.geo.err.unavailable")}
              </div>
            )}
          </form>

          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
