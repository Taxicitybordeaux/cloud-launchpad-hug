import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, calculerPrixMixte, PRISE_EN_CHARGE } from "@/lib/tarif";
import { geocodeAddress, reverseGeocode } from "@/lib/geocode";
import { getDistanceAndDurationKm, getRouteGeoCoords } from "@/lib/osrm";
import { EnablePushButton } from "@/components/EnablePushButton";

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
  const c = await geocodeAddress(address + ", Bordeaux, France");
  return c ? [c.lng, c.lat] : null;
}

async function getOsrmRoute(from: [number, number], to: [number, number]): Promise<OrsResult | null> {
  const result = await getDistanceAndDurationKm(from, to);
  return result
    ? { distanceKm: Math.round(result.distanceKm * 10) / 10, dureeS: Math.round(result.durationSec) }
    : null;
}

async function getOsrmPolyline(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  const result = await getRouteGeoCoords(from, to);
  return result?.coords ?? [];
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

  // Map setup
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

  // Map markers
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
      getOsrmPolyline(fromCoord, toCoord).then((coords) => {
        if (!mapInst.current || !L) return;
        if (routeLayer.current) {
          routeLayer.current.remove();
          routeLayer.current = null;
        }
        if (coords.length > 1) {
          routeLayer.current = L.polyline(
            coords.map((c) => [c[1], c[0]]),
            { color: "#22c55e", weight: 4, opacity: 0.95 },
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

  // OSRM
  useEffect(() => {
    if (!fromCoord || !toCoord) {
      setOrsResult(null);
      return;
    }
    setCalcLoading(true);
    getOsrmRoute(fromCoord, toCoord).then((r) => {
      setOrsResult(r);
      setCalcLoading(false);
    });
  }, [fromCoord, toCoord]);

  // Geolocation (départ uniquement)
  const handleGeolocate = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non disponible");
      return;
    }
    setGeolocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const adresse = await reverseGeocode(latitude, longitude);
        if (adresse) {
          set("depart", adresse);
          setFromCoord([longitude, latitude]);
          toast.success("Position détectée");
        } else {
          toast.error("Adresse introuvable");
        }
        setGeolocLoading(false);
      },
      () => {
        setGeolocLoading(false);
        toast.error("Impossible d'obtenir votre position");
      },
    );
  }, []);

  useEffect(() => {
    handleGeolocate();
  }, [handleGeolocate]);

  // Taxi availability
  const checkTaxiAvailability = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("id")
        .not("status", "in", "(cancelled,refused,completed)")
        .limit(1);
      if (error) throw error;
      setTaxiAvailable(!data || data.length === 0);
    } catch {
      setTaxiAvailable(null);
    }
  }, []);

  useEffect(() => {
    checkTaxiAvailability();
  }, [checkTaxiAvailability]);

  // Resolve destination on blur
  const resolveDestinationAddress = useCallback(async () => {
    const value = f.destination.trim();
    if (!value) return;
    setCalcLoading(true);
    const coord = await geocodeFullAddress(value);
    setCalcLoading(false);
    if (coord) {
      setToCoord(coord);
      setErrors((prev) => {
        const { destination, ...rest } = prev;
        return rest;
      });
    } else {
      setToCoord(null);
      setErrors((prev) => ({ ...prev, destination: "Adresse introuvable" }));
    }
  }, [f.destination]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!f.prenom.trim()) newErrors.prenom = "Requis";
    if (!f.nom.trim()) newErrors.nom = "Requis";
    if (!f.phone.trim()) newErrors.phone = "Requis";
    if (!f.email.trim()) newErrors.email = "Requis";
    if (!f.depart.trim()) newErrors.depart = "Requis";
    if (!f.destination.trim()) newErrors.destination = "Requis";
    if (!fromCoord) newErrors.depart = "Utilisez le bouton 📍 pour vous géolocaliser";
    if (!toCoord) newErrors.destination = "Adresse introuvable";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Veuillez compléter le formulaire");
      return;
    }

    setSending(true);

    try {
      const newTrackingId = crypto.randomUUID();

      const { data, error } = await supabase
        .from("reservations")
        .insert({
          tracking_id: newTrackingId,
          client_name: `${f.prenom} ${f.nom}`,
          client_phone: f.phone,
          client_email: f.email,
          depart: f.depart,
          destination: f.destination,
          arrivee: f.destination,
          nom: `${f.prenom} ${f.nom}`,
          telephone: f.phone,
          email: f.email,
          distance_km: orsResult?.distanceKm ?? 0,
          pickup_datetime: f.date && f.heure ? `${f.date}T${f.heure}:00` : new Date().toISOString(),
          nb_passagers: f.passagers,
          passagers: f.passagers,
          bagages: f.bagages,
          paiement: f.paiement,
          status: "nouvelle",
          tarif_jour: tarifJour,
          prix_estime: prixAller,
          source: "form",
        })
        .select("id")
        .single();

      if (error) throw error;

      // Notifie admin + chauffeur (push) + email (route serveur signature-safe)
      try {
        await fetch("/api/public/notify-reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: data.id }),
        });
      } catch (err) {
        console.error("[notify] failed", err);
      }

      toast.success(`Réservation confirmée pour ${f.prenom} !`);
      // Redirection — évite le bug de la carte (démontage/remontage du conteneur)
      navigate({ to: "/suivi/$id", params: { id: newTrackingId } });
    } catch (err: any) {
      setSending(false);
      toast.error("Erreur lors de la réservation", { description: err?.message });
    }
  };

  const inputStyle = (hasError?: boolean) => ({
    width: "100%",
    padding: "14px 14px",
    borderRadius: 12,
    border: `2px solid ${hasError ? "#ef4444" : "#cbd5e1"}`,
    fontSize: 16,
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
    minHeight: 48,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0f4bbf",
        fontFamily: "'DM Sans',sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        input[type=date], input[type=time] { color-scheme: dark; }
        input[type=text], input[type=tel], input[type=email] { font-size: 16px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .leaflet-container { width: 100% !important; height: 100% !important; }
      `}</style>

      {/* Map */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(10,10,20,0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: 99,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid rgba(245,200,66,0.2)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: taxiAvailable === false ? "#ef4444" : taxiAvailable === true ? "#22c55e" : "#94a3b8",
              animation: "pulse 1.8s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0" }}>
            {taxiAvailable === null ? "Vérification..." : taxiAvailable ? "Disponible" : "Indisponible"}
          </span>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg, #0f4bbf 0%, #0a3aa1 100%)",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
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
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Clash Display'" }}>
              Réserver votre taxi
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>En quelques étapes seulement</div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Coordonnées */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
                👤 Vos coordonnées
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "prenom" as const, label: "Prénom", ph: "Jean" },
                  { k: "nom" as const, label: "Nom", ph: "Dupont" },
                ].map(({ k, label, ph }) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
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
                      name={`tcb-${k}-${Math.random().toString(36).slice(2, 8)}`}
                      style={inputStyle(!!errors[k])}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {[
                  { k: "phone" as const, label: "Téléphone", ph: "06 12 34 56 78", type: "tel" },
                  { k: "email" as const, label: "Email", ph: "jean@exemple.fr", type: "email" },
                ].map(({ k, label, ph, type }) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
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
                      name={`tcb-${k}-${Math.random().toString(36).slice(2, 8)}`}
                      style={inputStyle(!!errors[k])}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Adresses */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
                📍 Où allons-nous ?
              </div>

              {/* Départ : géolocalisation uniquement */}
              <div>
                <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Départ (géolocalisé)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={f.depart}
                    readOnly
                    placeholder="Cliquez sur 📍 pour vous géolocaliser"
                    style={{ ...inputStyle(!!errors.depart), paddingRight: 52, cursor: "default" }}
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
                {errors.depart && (
                  <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors.depart}</div>
                )}
              </div>

              {/* Destination : saisie libre, géocodage au blur */}
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Destination
                </label>
                <input
                  type="text"
                  value={f.destination}
                  onChange={(e) => {
                    set("destination", e.target.value);
                    setToCoord(null);
                  }}
                  onBlur={resolveDestinationAddress}
                  placeholder="Ex: Aéroport Bordeaux-Mérignac"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name={`tcb-dest-${Math.random().toString(36).slice(2, 8)}`}
                  style={inputStyle(!!errors.destination)}
                />
                {errors.destination && (
                  <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors.destination}</div>
                )}
                {calcLoading && (
                  <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 4 }}>Calcul en cours…</div>
                )}
              </div>

              {orsResult && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "rgba(245,200,66,0.1)",
                    borderRadius: 10,
                    border: "1px solid rgba(245,200,66,0.2)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#f5c842", fontWeight: 600 }}>
                    {orsResult.distanceKm} km · {Math.round(orsResult.dureeS / 60)} min
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>~{prixAller.toFixed(2)} €</div>
                </div>
              )}
            </div>

            {/* Date/Time */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>🕐 Quand ?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Date
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
                    Heure
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

            {/* Passagers & Bagages */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>👥 Détails</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Passagers
                  </label>
                  <select
                    value={f.passagers}
                    onChange={(e) => set("passagers", parseInt(e.target.value))}
                    style={inputStyle()}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} passager{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Bagages
                  </label>
                  <select
                    value={f.bagages}
                    onChange={(e) => set("bagages", parseInt(e.target.value))}
                    style={inputStyle()}
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} bagage{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div>
              <label style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>
                Mode de paiement
              </label>
              <select value={f.paiement} onChange={(e) => set("paiement", e.target.value)} style={inputStyle()}>
                <option value="especes">💵 Espèces</option>
                <option value="cb">💳 Carte bancaire</option>
                <option value="virement">🏦 Virement</option>
              </select>
            </div>

            {/* Notifications */}
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(245,200,66,0.08)",
                borderRadius: 10,
                border: "1px solid rgba(245,200,66,0.2)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, color: "#f5f5f5", fontWeight: 600 }}>
                🔔 Notifications
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                Client : suivi de votre course. Chauffeur : alertes des nouvelles courses.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <EnablePushButton audience="client" variant="secondary" size="sm" label="Notifs client" />
                <EnablePushButton audience="chauffeur" variant="outline" size="sm" label="Notifs chauffeur" />
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || !orsResult}
              style={{
                padding: "14px 20px",
                background: sending ? "#64748b" : "#f5c842",
                color: sending ? "#cbd5e1" : "#0f172a",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 16,
                cursor: sending ? "wait" : "pointer",
                opacity: !orsResult && !sending ? 0.5 : 1,
              }}
            >
              {sending ? "⏳ Réservation..." : "✓ Réserver"}
            </button>
          </form>

          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
