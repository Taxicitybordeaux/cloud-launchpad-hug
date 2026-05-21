import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, calculerPrixMixte, PRISE_EN_CHARGE } from "@/lib/tarif";
import { geocodeAddress, reverseGeocode, searchAddress } from "@/lib/geocode";
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

// Helpers
async function searchAddressList(query: string): Promise<{ label: string; coord: [number, number] }[]> {
  if (query.length < 2) return [];
  try {
    const results = await searchAddress(query, 5);
    return results.map((item) => ({ label: item.label, coord: [item.coord[0], item.coord[1]] }));
  } catch {
    return [];
  }
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

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Address input component
function AddressInput({
  value,
  placeholder,
  onChange,
  onSelect,
  onGeolocate,
  geolocLoading,
  error,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSelect: (label: string, coord: [number, number]) => void;
  onGeolocate?: () => void;
  geolocLoading?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ label: string; coord: [number, number] }[]>([]);

  const debouncedSearch = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      const results = await searchAddressList(q);
      setSuggestions(results);
    }, 300),
    [],
  );

  useEffect(() => {
    debouncedSearch(value);
  }, [value, debouncedSearch]);

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "14px 14px",
          borderRadius: 12,
          border: `2px solid ${error ? "#ef4444" : "#cbd5e1"}`,
          fontSize: 16,
          background: "#ffffff",
          color: "#0f172a",
          fontFamily: "'DM Sans',sans-serif",
          outline: "none",
          boxSizing: "border-box",
          minHeight: 48,
        }}
      />
      {onGeolocate && (
        <button
          type="button"
          onClick={onGeolocate}
          disabled={geolocLoading}
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: geolocLoading ? "wait" : "pointer",
            color: "#f5c842",
            padding: 4,
            fontSize: 18,
          }}
        >
          {geolocLoading ? "⏳" : "📍"}
        </button>
      )}
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            zIndex: 9999,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => {
                onSelect(s.label, s.coord);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                background: "none",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 14,
                color: "#0f172a",
                fontFamily: "'DM Sans',sans-serif",
                borderBottom: i < suggestions.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              📍 {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReservationPage() {
  // State
  const [phase, setPhase] = useState<"form" | "tracking">("form");
  const [trackingId, setTrackingId] = useState("");
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

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);

  // Pricing
  const pickupIso = f.date && f.heure ? `${f.date}T${f.heure}:00` : null;
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : 12;
  const tarifJour = heureNum >= 7 && heureNum < 19;
  const prixAller =
    orsResult && pickupIso
      ? calculerPrixMixte(orsResult.distanceKm, pickupIso)
      : orsResult
        ? calculerPrix(orsResult.distanceKm, tarifJour)
        : PRISE_EN_CHARGE;

  // Initialize
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
            {
              color: "#22c55e",
              weight: 4,
              opacity: 0.95,
            },
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

  // Geolocation
  const handleGeolocate = useCallback(async () => {
    if (!navigator.geolocation) return;
    setGeolocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const adresse = await reverseGeocode(latitude, longitude);
        if (adresse) {
          set("depart", adresse);
          setFromCoord([longitude, latitude]);
        }
        setGeolocLoading(false);
      },
      () => setGeolocLoading(false),
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

  // Resolve destination
  const resolveDestinationAddress = useCallback(async () => {
    const value = f.destination.trim();
    if (!value || toCoord) return;
    setCalcLoading(true);
    const coord = await geocodeFullAddress(value);
    setCalcLoading(false);
    if (coord) {
      setToCoord(coord);
    } else {
      setErrors((prev) => ({ ...prev, destination: "Adresse introuvable" }));
    }
  }, [f.destination, toCoord]);

  // Request push permission
  const requestPushPermission = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        toast.success("Notifications activées 🔔");
      }
    } catch {
      // silent fail
    }
  }, []);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};
    if (!f.prenom.trim()) newErrors.prenom = "Requis";
    if (!f.nom.trim()) newErrors.nom = "Requis";
    if (!f.phone.trim()) newErrors.phone = "Requis";
    if (!f.email.trim()) newErrors.email = "Requis";
    if (!f.depart.trim()) newErrors.depart = "Requis";
    if (!f.destination.trim()) newErrors.destination = "Requis";
    if (!fromCoord) newErrors.depart = "Adresse invalide";
    if (!toCoord) newErrors.destination = "Adresse invalide";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Veuillez compléter le formulaire");
      return;
    }

    setSending(true);

    try {
      // Generate tracking ID
      const newTrackingId = crypto.randomUUID();

      // Insert reservation
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
          nom: f.nom,
          telephone: f.phone,
          distance_km: orsResult?.distanceKm ?? 0,
          pickup_datetime: f.date && f.heure ? `${f.date}T${f.heure}:00` : new Date().toISOString(),
          nb_passagers: f.passagers,
          bagages: f.bagages,
          paiement: f.paiement,
          status: "pending",
          tarif_jour: tarifJour,
          prix_estime: prixAller,
        })
        .select("id")
        .single();

      if (error) throw error;

      setTrackingId(newTrackingId);

      // Send driver confirmation email
      try {
        await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Secret": "admin-pin-call",
          },
          body: JSON.stringify({
            templateName: "new-reservation-driver",
            recipientEmail: "driver@taxicitybordeaux.fr",
            idempotencyKey: `new-res-${data.id}`,
            templateData: {
              client_name: f.prenom,
              depart: f.depart,
              destination: f.destination,
              phone: f.phone,
              passagers: f.passagers,
              bagages: f.bagages,
              prix_estime: prixAller.toFixed(2),
            },
          }),
        });
      } catch {
        // non-blocking
      }

      // Send client confirmation email
      try {
        const { data: authData } = await supabase.auth.getSession();
        const token = authData?.session?.access_token;
        if (token) {
          await fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              templateName: "reservation-confirmation",
              recipientEmail: f.email,
              idempotencyKey: `res-confirm-${data.id}`,
              templateData: {
                prenom: f.prenom,
                nom: f.nom,
                depart: f.depart,
                destination: f.destination,
                passagers: f.passagers,
                bagages: f.bagages,
                prix_estime: prixAller.toFixed(2),
              },
            }),
          });
        }
      } catch {
        // non-blocking
      }

      // Request push permission
      await requestPushPermission();

      // Switch to tracking
      setPhase("tracking");

      toast.success(`Réservation confirmée pour ${f.prenom} !`);
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

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

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
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .sheet-inner { animation: slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
        .leaflet-container { width: 100% !important; height: 100% !important; }
      `}</style>

      {phase === "form" ? (
        <>
          {/* Map */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

            {/* Availability pill */}
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

          {/* Form sheet */}
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
            {/* Handle */}
            <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9 }} />
            </div>

            {/* Scrollable form */}
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
              {/* Header */}
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5", fontFamily: "'Clash Display'" }}>
                  Réserver votre taxi
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>En quelques étapes seulement</div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                          style={inputStyle(!!errors[k])}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    {[
                      { k: "phone" as const, label: "Téléphone", ph: "06 12 34 56 78" },
                      { k: "email" as const, label: "Email", ph: "jean@exemple.fr" },
                    ].map(({ k, label, ph }) => (
                      <div key={k}>
                        <label
                          style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                        >
                          {label}
                        </label>
                        <input
                          type={k === "email" ? "email" : "tel"}
                          value={f[k]}
                          onChange={(e) => set(k, e.target.value)}
                          placeholder={ph}
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
                  <AddressInput
                    value={f.depart}
                    placeholder="Adresse de départ"
                    onChange={(v) => {
                      set("depart", v);
                      setFromCoord(null);
                    }}
                    onSelect={(label, coord) => {
                      set("depart", label);
                      setFromCoord(coord);
                    }}
                    onGeolocate={handleGeolocate}
                    geolocLoading={geolocLoading}
                    error={errors.depart}
                  />
                  <div style={{ marginTop: 10 }}>
                    <AddressInput
                      value={f.destination}
                      placeholder="Destination"
                      onChange={(v) => {
                        set("destination", v);
                        setToCoord(null);
                      }}
                      onSelect={(label, coord) => {
                        set("destination", label);
                        setToCoord(coord);
                      }}
                      error={errors.destination}
                    />
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
                      <label
                        style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                      >
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
                      <label
                        style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                      >
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
                      <label
                        style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                      >
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
                      <label
                        style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}
                      >
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

                {/* Push permission */}
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(245,200,66,0.08)",
                    borderRadius: 10,
                    border: "1px solid rgba(245,200,66,0.2)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#f5f5f5", fontWeight: 600, marginBottom: 8 }}>
                    🔔 Notifications en temps réel
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 8 }}>
                    Recevez les mises à jour lorsque votre chauffeur accepte.
                  </div>
                  <EnablePushButton audience="client" variant="secondary" size="sm" label="Activer les notifications" />
                </div>

                {/* Submit */}
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
        </>
      ) : (
        // Tracking phase
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
          <div ref={mapRef} style={{ flex: 1, position: "relative" }} />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(180deg, rgba(10,10,20,0) 0%, rgba(10,10,20,0.95) 50%, #0a0a14 100%)",
              padding: "24px",
              borderRadius: "24px 24px 0 0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f5", marginBottom: 8 }}>
              En attente d'acceptation
            </div>
            <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 16 }}>
              Tracking ID: {trackingId.split("-")[0]}...
            </div>
            <a
              href="/"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                background: "#f5c842",
                color: "#0f172a",
                textDecoration: "none",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              Retour au site
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
