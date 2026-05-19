import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reserver")({
  head: () => ({
    meta: [
      { title: "Réserver — Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi en ligne, par email ou WhatsApp." },
    ],
  }),
  component: ReservationPage,
});

// ─── Tarifs officiels ───────────────────────────────────────────────────────
const PRISE_EN_CHARGE = 2.83;
const TARIF_JOUR = 2.16;
const TARIF_NUIT = 3.24;
const BORDEAUX_CENTER: [number, number] = [44.8378, -0.5792];

// ─── Calcul mixte jour/nuit ─────────────────────────────────────────────────
function calculerPrixMixte(departMs: number, dureeS: number, distanceKm: number): number {
  if (dureeS <= 0 || distanceKm <= 0) return PRISE_EN_CHARGE;
  const arriveeMs = departMs + dureeS * 1000;
  const STEP = 60_000;
  let prixKm = 0;
  let t = departMs;
  while (t < arriveeMs) {
    const fin = Math.min(t + STEP, arriveeMs);
    const fraction = (fin - t) / (arriveeMs - departMs);
    const kmTranche = distanceKm * fraction;
    const h = new Date(t).getHours();
    prixKm += kmTranche * (h >= 7 && h < 19 ? TARIF_JOUR : TARIF_NUIT);
    t = fin;
  }
  return Math.round((PRISE_EN_CHARGE + prixKm) * 100) / 100;
}

// ─── Géocodage Photon ──────────────────────────────────────────────────────
// ─── Autocomplete Photon ───────────────────────────────────────────────────
interface PhotonFeature {
  label: string;
  coord: [number, number];
}
async function autocomplete(query: string): Promise<PhotonFeature[]> {
  if (query.length < 2) return [];
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lang", "fr");
    url.searchParams.set("lat", "44.8378");
    url.searchParams.set("lon", "-0.5792");
    const res = await fetch(url.toString());
    const data = await res.json();
    return (data.features ?? []).map((f: any) => {
      const p = f.properties ?? {};
      const parts = [p.name, p.street, p.housenumber, p.city ?? p.town ?? p.village].filter(Boolean);
      return {
        label: parts.join(", "),
        coord: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as [number, number],
      };
    });
  } catch {
    return [];
  }
}

// ─── Reverse geocoding Nominatim ───────────────────────────────────────────
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=fr`,
      { headers: { "Accept-Language": "fr" } },
    );
    const data = await res.json();
    if (!data || data.error) return null;
    const a = data.address ?? {};
    const parts = [
      a.house_number,
      a.road ?? a.pedestrian ?? a.footway,
      a.city ?? a.town ?? a.village ?? a.municipality,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : (data.display_name ?? null);
  } catch {
    return null;
  }
}

// ─── OSRM route ───────────────────────────────────────────────────────────
interface OrsResult {
  distanceKm: number;
  dureeS: number;
}
async function getOsrmRoute(from: [number, number], to: [number, number]): Promise<OrsResult | null> {
  try {
    // from/to sont [lng, lat] (format Photon/GeoJSON)
    // OSRM attend {lng},{lat}
    const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false&alternatives=false&steps=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    return { distanceKm: Math.round((route.distance / 1000) * 10) / 10, dureeS: Math.round(route.duration) };
  } catch {
    return null;
  }
}

// ─── OSRM route avec géométrie (pour la polyline) ─────────────────────────
async function getOsrmPolyline(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  } catch {
    return [];
  }
}

// ─── Leaflet loader ────────────────────────────────────────────────────────
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
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
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

// ─── Types ─────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;
interface FormState {
  depart: string;
  destination: string;
  date: string;
  heure: string;
  dateRetour: string;
  heureRetour: string;
  trajet: "aller" | "aller-retour";
  passagers: number;
  bagages: number;
  paiement: "especes" | "cb";
  prenom: string;
  nom: string;
  phone: string;
  email: string;
}

// ─── Autocomplete input ────────────────────────────────────────────────────
function AddressInput({
  value,
  onChange,
  onSelect,
  placeholder,
  icon,
  error,
  onGeolocate,
  geolocLoading,
  dark,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (label: string, coord: [number, number]) => void;
  placeholder: string;
  icon: string;
  error?: string;
  onGeolocate?: () => void;
  geolocLoading?: boolean;
  dark?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (v: string) => {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const s = await autocomplete(v);
      setSuggestions(s);
      setOpen(s.length > 0);
    }, 350);
  };

  const handlePick = (s: PhotonFeature) => {
    onChange(s.label);
    onSelect(s.label, s.coord);
    setSuggestions([]);
    setOpen(false);
  };

  const bg = dark ? "#1a1a2e" : "#fff";
  const border = dark ? "#2a2a4a" : "#e2e8f0";
  const textColor = dark ? "#f0f0f0" : "#0f172a";

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 16, fontSize: 18, zIndex: 1, pointerEvents: "none" }}>{icon}</span>
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "16px 48px 16px 46px",
            borderRadius: 16,
            border: `2px solid ${error ? "#ef4444" : border}`,
            fontSize: 15,
            fontFamily: "'DM Sans',sans-serif",
            boxSizing: "border-box",
            background: bg,
            color: textColor,
            outline: "none",
            boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)",
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
              background: "none",
              border: "none",
              cursor: geolocLoading ? "wait" : "pointer",
              color: "#f5c842",
              padding: 4,
            }}
          >
            {geolocLoading ? (
              "⏳"
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            )}
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: dark ? "#16213e" : "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            zIndex: 9999,
            overflow: "hidden",
            border: `1px solid ${dark ? "#2a2a4a" : "#e2e8f0"}`,
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handlePick(s)}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                background: "none",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 14,
                color: dark ? "#e0e0e0" : "#0f172a",
                fontFamily: "'DM Sans',sans-serif",
                borderBottom: i < suggestions.length - 1 ? `1px solid ${dark ? "#2a2a4a" : "#f1f5f9"}` : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = dark ? "#1e2a4a" : "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              📍 {s.label}
            </button>
          ))}
        </div>
      )}
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4, paddingLeft: 4 }}>{error}</div>}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────
function ReservationPage() {
  const [step, setStep] = useState<Step>(1);
  const [today, setToday] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [geolocLoading, setGeolocLoading] = useState(false);

  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [orsResult, setOrsResult] = useState<OrsResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const [f, setF] = useState<FormState>({
    depart: "",
    destination: "",
    date: "",
    heure: "",
    dateRetour: "",
    heureRetour: "",
    trajet: "aller",
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
  const taxiMarker = useRef<any>(null);

  // Prix
  const departMs = f.date && f.heure ? new Date(`${f.date}T${f.heure}:00`).getTime() : null;
  const retourMs =
    f.trajet === "aller-retour" && f.dateRetour && f.heureRetour
      ? new Date(`${f.dateRetour}T${f.heureRetour}:00`).getTime()
      : null;
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : 12;
  const tarifJour = heureNum >= 7 && heureNum < 19;
  const prixAllerBase =
    orsResult && departMs
      ? calculerPrixMixte(departMs, orsResult.dureeS, orsResult.distanceKm)
      : orsResult
        ? Math.round((PRISE_EN_CHARGE + orsResult.distanceKm * (tarifJour ? TARIF_JOUR : TARIF_NUIT)) * 100) / 100
        : PRISE_EN_CHARGE;
  const prixAller = prixAllerBase;

  const prixRetourBase =
    f.trajet === "aller-retour" && orsResult
      ? retourMs
        ? calculerPrixMixte(retourMs, orsResult.dureeS, orsResult.distanceKm)
        : prixAllerBase
      : 0;
  const prixRetour = prixRetourBase;
  const prixTotal = f.trajet === "aller-retour" ? Math.round((prixAller + prixRetour) * 100) / 100 : prixAller;

  useEffect(() => {
    const d = new Date().toISOString().split("T")[0];
    setToday(d);
    setF((p) => ({ ...p, date: p.date || d }));
  }, []);

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
      // Carte sombre style premium
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
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

  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (fromCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(34,197,94,0.3),0 2px 8px rgba(34,197,94,0.6)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (fromMarker.current) fromMarker.current.remove();
      fromMarker.current = L.marker([fromCoord[1], fromCoord[0]], { icon }).addTo(map);
    }

    if (toCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#f5c842;border-radius:50%;border:3px solid #1a1a2e;box-shadow:0 0 0 4px rgba(245,200,66,0.3),0 2px 8px rgba(245,200,66,0.6)"></div>`,
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
          routeLayer.current = L.polyline(coords, {
            color: "#f5c842",
            weight: 4,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(mapInst.current);
          const allPoints = [[fromCoord[1], fromCoord[0]], [toCoord[1], toCoord[0]], ...coords];
          mapInst.current.fitBounds(L.latLngBounds(allPoints).pad(0.25));
        }
      });
    } else if (fromCoord) {
      map.setView([fromCoord[1], fromCoord[0]], 14);
    }
  }, [fromCoord, toCoord]);

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

  // Resize carte quand le sheet monte/descend
  useEffect(() => {
    if (mapInst.current) {
      // On invalide à 0ms (début), 200ms (milieu) et 450ms (fin de transition)
      const timers = [
        setTimeout(() => mapInst.current?.invalidateSize(), 0),
        setTimeout(() => mapInst.current?.invalidateSize(), 200),
        setTimeout(() => mapInst.current?.invalidateSize(), 450),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [step]);

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  // Géolocalisation automatique au chargement
  useEffect(() => {
    handleGeolocate();
  }, [handleGeolocate]);

  // ── Tracking GPS temps réel du taxi via Supabase Realtime ─────────────────
  useEffect(() => {
    const L = (window as any).L;

    const getTaxiIcon = (heading: number) => {
      if (!L) return null;
      return L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:48px;height:48px;">
            <div style="
              position:absolute;inset:0;border-radius:50%;
              background:rgba(245,200,66,0.2);
              animation:pulse 2s ease-in-out infinite;
            "></div>
            <div style="
              position:absolute;inset:8px;border-radius:50%;
              background:rgba(245,200,66,0.35);
              animation:pulse 2s ease-in-out infinite 0.4s;
            "></div>
            <div style="
              position:absolute;inset:0;display:flex;align-items:center;
              justify-content:center;font-size:26px;line-height:1;
              transform:rotate(${heading}deg);transition:transform 0.6s ease;
            ">🚕</div>
          </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
    };

    const updateTaxiMarker = (lat: number, lng: number, heading: number) => {
      const map = mapInst.current;
      if (!map || !L) return;
      if (taxiMarker.current) {
        taxiMarker.current.setLatLng([lat, lng]);
        taxiMarker.current.setIcon(getTaxiIcon(heading));
      } else {
        taxiMarker.current = L.marker([lat, lng], { icon: getTaxiIcon(heading), zIndexOffset: 1000 })
          .addTo(map)
          .bindTooltip("🚕 Votre taxi", { permanent: false, direction: "top", offset: [0, -28] });
      }
    };

    // Chargement initial de la position
    const loadInitial = async () => {
      const { data } = await (supabase as any)
        .from("taxi_positions")
        .select("lat,lng,heading")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .single();
      if (data && (data.lat !== 0 || data.lng !== 0)) {
        const waitAndUpdate = () => {
          if ((window as any).L && mapInst.current) {
            updateTaxiMarker(data.lat, data.lng, data.heading ?? 0);
          } else {
            setTimeout(waitAndUpdate, 300);
          }
        };
        waitAndUpdate();
      }
    };
    loadInitial();

    // Écoute Realtime des mises à jour
    const channel = (supabase as any)
      .channel("taxi-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "taxi_positions" }, (payload: any) => {
        const d = payload.new as any;
        if (d.lat && d.lng) {
          updateTaxiMarker(d.lat, d.lng, d.heading ?? 0);
        }
      })
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
      if (taxiMarker.current) {
        taxiMarker.current.remove();
        taxiMarker.current = null;
      }
    };
  }, []);

  const validateStep = (s: Step): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!f.depart) e.depart = "Adresse requise";
      if (!f.destination) e.destination = "Destination requise";
    }
    if (s === 2) {
      if (!f.date) e.date = "Date requise";
      if (!f.heure) e.heure = "Heure requise";
      if (f.trajet === "aller-retour") {
        if (!f.dateRetour) e.dateRetour = "Date retour requise";
        if (!f.heureRetour) e.heureRetour = "Heure retour requise";
        if (f.dateRetour && f.heureRetour && departMs) {
          const rms = new Date(`${f.dateRetour}T${f.heureRetour}:00`).getTime();
          if (rms <= departMs) e.dateRetour = "Le retour doit être après l'aller";
        }
      }
    }
    if (s === 4) {
      if (!f.prenom) e.prenom = "Prénom requis";
      if (!f.nom) e.nom = "Nom requis";
      if (!f.phone) e.phone = "Téléphone requis";
      if (!f.email) e.email = "Email requis";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(5, s + 1) as Step);
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const submitForm = async () => {
    if (!validateStep(4)) return;
    setSending(true);
    setSubmitError("");
    try {
      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickup = new Date(`${f.date}T${f.heure || "12:00"}:00`).toISOString();
      const pickupMs = new Date(pickup).getTime();

      const { data: conflicts } = await supabase
        .from("reservations")
        .select("id")
        .gte("pickup_datetime", new Date(pickupMs - 30 * 60_000).toISOString())
        .lte("pickup_datetime", new Date(pickupMs + 30 * 60_000).toISOString())
        .not("status", "in", "(annulee,refusee,terminee)")
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        setErrors((p) => ({ ...p, heure: "Ce créneau est déjà réservé" }));
        setStep(2);
        setSending(false);
        return;
      }

      const { error: insertError } = await supabase.from("reservations").insert({
        nom: fullName,
        telephone: f.phone,
        email: f.email,
        depart: f.depart,
        arrivee: f.destination,
        destination: f.destination,
        pickup_datetime: pickup,
        passagers: f.passagers,
        bagages: f.bagages,
        client_name: fullName,
        client_phone: f.phone,
        client_email: f.email,
        distance_km: orsResult?.distanceKm ?? null,
        date_course: f.date,
        heure_course: f.heure,
        nb_passagers: f.passagers,
        tarif_jour: tarifJour,
        prix_estime: orsResult ? prixTotal : null,
        status: "pending",
        source: "form",
        paiement: f.paiement,
        message: `Trajet: ${f.trajet === "aller-retour" ? "Aller-retour" : "Aller simple"}${orsResult ? ` | Distance: ${orsResult.distanceKm} km | Durée: ${Math.round(orsResult.dureeS / 60)} min` : ""}`,
      });

      if (insertError) throw new Error(insertError.message);

      try {
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess?.session?.access_token;
        if (accessToken && f.email) {
          await fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              templateName: "reservation-confirmation",
              recipientEmail: f.email,
              idempotencyKey: `reservation-confirm-${f.email}-${pickup}`,
              templateData: {
                prenom: f.prenom,
                nom: fullName,
                depart: f.depart,
                destination: f.destination,
                date: f.date,
                heure: f.heure,
                passagers: f.passagers,
                bagages: f.bagages,
                vehicule: "Berline",
                prix_estime: orsResult ? prixTotal : null,
                tarif: tarifJour ? "Tarif jour" : "Tarif nuit",
              },
            }),
          });
        }
      } catch {
        /* non-bloquant */
      }

      const sid = typeof window !== "undefined" ? sessionStorage.getItem("sid") : null;
      await supabase.from("site_analytics").insert({ event: "reservation_attempt", session_id: sid });
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err?.message || "Erreur lors de la réservation");
    } finally {
      setSending(false);
    }
  };

  const buildWhatsApp = () =>
    encodeURIComponent(
      `Bonjour, je souhaite réserver un taxi.\n\n` +
        `🟢 Départ : ${f.depart || "—"}\n` +
        `🏁 Destination : ${f.destination || "—"}\n` +
        `📅 Date : ${f.date} à ${f.heure}\n` +
        `${f.trajet === "aller-retour" ? `🔁 Retour : ${f.dateRetour} à ${f.heureRetour}\n` : ""}` +
        `👥 Passagers : ${f.passagers} | 🧳 Bagages : ${f.bagages}\n` +
        `💶 Prix estimé : ${prixTotal.toFixed(2)} €\n\n` +
        `Nom : ${f.prenom} ${f.nom}\nTél : ${f.phone}`,
    );

  const sheetHeights: Record<Step, string> = {
    1: "54vh",
    2: "60vh",
    3: "65vh",
    4: "60vh",
    5: "68vh",
  };

  const stepLabels = ["Trajet", "Horaires", "Tarif", "Vous", "Récap"];
  const stepIcons = ["📍", "🕐", "💶", "👤", "✅"];

  const inputStyle = (hasError?: boolean) => ({
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: `2px solid ${hasError ? "#ef4444" : "#2a2a4a"}`,
    fontSize: 15,
    background: "#1a1a2e",
    color: "#f0f0f0",
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a14",
        fontFamily: "'DM Sans',sans-serif",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        * { box-sizing: border-box; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        input[type=date], input[type=time] { color-scheme: dark; }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes glow { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes dot { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
        .sheet-inner { animation: slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
        .leaflet-container { width: 100% !important; height: 100% !important; position: absolute !important; inset: 0 !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 4px; }
        input:focus { outline: none !important; border-color: #f5c842 !important; box-shadow: 0 0 0 3px rgba(245,200,66,0.15) !important; }
        .veh-card:hover { transform: translateY(-1px); }
        .cta-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .cta-btn:active { transform: translateY(0); }
        .pay-btn:hover { border-color: #f5c842 !important; }
      `}</style>

      {/* ── Carte + UI superposée ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          minHeight: 0,
        }}
      >
        {/* Carte Leaflet */}
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* ── Pill disponibilité ── */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 16,
            zIndex: 200,
            background: "rgba(10,10,20,0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: 99,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid rgba(245,200,66,0.2)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              animation: "glow 1.8s ease-in-out infinite",
              boxShadow: "0 0 6px #22c55e",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0" }}>Disponible maintenant</span>
        </div>

        {/* ── Barre d'étapes (top) ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: "14px 20px 10px",
            background: "linear-gradient(to bottom, rgba(5,5,15,0.9) 0%, transparent 100%)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {step > 1 && (
            <button
              onClick={goBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(245,200,66,0.12)",
                border: "1px solid rgba(245,200,66,0.3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: "#f5c842",
                flexShrink: 0,
              }}
            >
              ←
            </button>
          )}
          {/* Step dots */}
          <div style={{ flex: 1, display: "flex", gap: 5, alignItems: "center" }}>
            {stepLabels.map((label, i) => {
              const n = (i + 1) as Step;
              const active = n === step;
              const done = n < step;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flex: active ? 2.5 : 1,
                    transition: "flex 0.3s ease",
                  }}
                >
                  <div
                    style={{
                      height: 4,
                      flex: 1,
                      borderRadius: 9,
                      background: done ? "#f5c842" : active ? "#f5c842" : "rgba(255,255,255,0.15)",
                      opacity: done ? 1 : active ? 1 : 0.5,
                      transition: "background 0.3s",
                      boxShadow: active ? "0 0 8px rgba(245,200,66,0.6)" : "none",
                    }}
                  />
                  {active && (
                    <span
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontWeight: 700,
                        fontSize: 11,
                        color: "#f5c842",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {stepIcons[i]} {label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom sheet sombre ── */}
      <div
        style={{
          flexShrink: 0,
          height: sheetHeights[step],
          background: "linear-gradient(180deg, #111120 0%, #0d0d1a 100%)",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 -1px 0 rgba(245,200,66,0.1)",
          display: "flex",
          flexDirection: "column",
          transition: "height 0.4s cubic-bezier(0.4,0,0.2,1)",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9 }} />
        </div>

        {/* Content scrollable */}
        <div key={step} className="sheet-inner" style={{ flex: 1, overflowY: "auto", padding: "8px 20px 0" }}>
          {/* ── ÉTAPE 1 : Adresses ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2
                  style={{
                    fontFamily: "'Clash Display',sans-serif",
                    fontWeight: 700,
                    fontSize: 22,
                    color: "#f5f5f5",
                    margin: 0,
                  }}
                >
                  Où allons-nous ?
                </h2>
                {orsResult && (
                  <div
                    style={{
                      background: "rgba(245,200,66,0.12)",
                      border: "1px solid rgba(245,200,66,0.3)",
                      borderRadius: 99,
                      padding: "4px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#f5c842", fontWeight: 700 }}>
                      ⏱ ~{Math.round(orsResult.dureeS / 60)} min
                    </span>
                  </div>
                )}
              </div>

              {/* Route line visuelle */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 18 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#22c55e",
                      border: "2px solid #111120",
                      boxShadow: "0 0 0 3px rgba(34,197,94,0.3)",
                    }}
                  />
                  <div style={{ width: 2, flex: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#f5c842",
                      border: "2px solid #111120",
                      boxShadow: "0 0 0 3px rgba(245,200,66,0.3)",
                    }}
                  />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  <AddressInput
                    dark
                    value={f.depart}
                    placeholder="Adresse de départ"
                    icon=""
                    error={errors.depart}
                    onChange={(v) => {
                      set("depart", v);
                      setFromCoord(null);
                      setOrsResult(null);
                    }}
                    onSelect={(label, coord) => {
                      set("depart", label);
                      setFromCoord(coord);
                    }}
                    onGeolocate={handleGeolocate}
                    geolocLoading={geolocLoading}
                  />
                  <AddressInput
                    dark
                    value={f.destination}
                    placeholder="Destination"
                    icon=""
                    error={errors.destination}
                    onChange={(v) => {
                      set("destination", v);
                      setToCoord(null);
                      setOrsResult(null);
                    }}
                    onSelect={(label, coord) => {
                      set("destination", label);
                      setToCoord(coord);
                    }}
                  />
                </div>
              </div>

              {/* Bande info trajet */}
              {(calcLoading || orsResult) && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "12px 14px",
                    background: "rgba(245,200,66,0.06)",
                    borderRadius: 14,
                    border: "1px solid rgba(245,200,66,0.15)",
                    alignItems: "center",
                  }}
                >
                  {calcLoading ? (
                    <>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          border: "2px solid rgba(245,200,66,0.2)",
                          borderTopColor: "#f5c842",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />
                      <span style={{ color: "#94a3b8", fontSize: 14 }}>Calcul de l'itinéraire…</span>
                    </>
                  ) : (
                    orsResult && (
                      <>
                        <span style={{ fontSize: 18 }}>🗺️</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: "#f5c842", fontSize: 14, fontWeight: 700 }}>
                            {orsResult.distanceKm} km
                          </span>
                          <span style={{ color: "#64748b", fontSize: 14 }}>
                            {" "}
                            · {Math.round(orsResult.dureeS / 60)} min
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "'Clash Display',sans-serif",
                            fontWeight: 700,
                            fontSize: 16,
                            color: "#f5c842",
                          }}
                        >
                          ~{prixAller.toFixed(2)} €
                        </span>
                      </>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ÉTAPE 2 : Date & Heure ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2
                style={{
                  fontFamily: "'Clash Display',sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#f5f5f5",
                  margin: "0 0 4px",
                }}
              >
                Quand partez-vous ?
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(
                  [
                    ["aller", "➡️ Aller simple"],
                    ["aller-retour", "🔁 Aller-retour"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => set("trajet", v)}
                    style={{
                      padding: "14px 10px",
                      border: `2px solid ${f.trajet === v ? "#f5c842" : "#2a2a4a"}`,
                      background: f.trajet === v ? "rgba(245,200,66,0.1)" : "#1a1a2e",
                      borderRadius: 14,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      color: f.trajet === v ? "#f5c842" : "#64748b",
                      transition: "all 0.2s",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ background: "#1a1a2e", borderRadius: 16, padding: 16, border: "1px solid #2a2a4a" }}>
                <div
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#f5c842",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12,
                  }}
                >
                  ➡️ Aller
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>DATE</div>
                    <input
                      type="date"
                      value={f.date}
                      min={today}
                      onChange={(e) => set("date", e.target.value)}
                      style={inputStyle(!!errors.date)}
                    />
                    {errors.date && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.date}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>HEURE</div>
                    <input
                      type="time"
                      value={f.heure}
                      onChange={(e) => set("heure", e.target.value)}
                      style={inputStyle(!!errors.heure)}
                    />
                    {errors.heure && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.heure}</div>}
                  </div>
                </div>
              </div>

              {f.trajet === "aller-retour" && (
                <div
                  style={{
                    background: "#1a1a2e",
                    borderRadius: 16,
                    padding: 16,
                    border: "1px solid rgba(168,85,247,0.3)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#a855f7",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 12,
                    }}
                  >
                    🔁 Retour
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>DATE</div>
                      <input
                        type="date"
                        value={f.dateRetour}
                        min={f.date || today}
                        onChange={(e) => set("dateRetour", e.target.value)}
                        style={inputStyle(!!errors.dateRetour)}
                      />
                      {errors.dateRetour && (
                        <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.dateRetour}</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>HEURE</div>
                      <input
                        type="time"
                        value={f.heureRetour}
                        onChange={(e) => set("heureRetour", e.target.value)}
                        style={inputStyle(!!errors.heureRetour)}
                      />
                      {errors.heureRetour && (
                        <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.heureRetour}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "👥 Passagers", k: "passagers" as const, min: 1, max: 8 },
                  { label: "🧳 Bagages", k: "bagages" as const, min: 0, max: 10 },
                ].map(({ label, k, min, max }) => (
                  <div
                    key={k}
                    style={{
                      background: "#1a1a2e",
                      borderRadius: 14,
                      padding: "12px 14px",
                      border: "1px solid #2a2a4a",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                      <button
                        onClick={() => set(k, Math.max(min, (f[k] as number) - 1))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "1px solid #2a2a4a",
                          background: "#111120",
                          cursor: "pointer",
                          fontSize: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontFamily: "'Clash Display',sans-serif",
                          fontWeight: 700,
                          fontSize: 20,
                          color: "#f5f5f5",
                          minWidth: 24,
                          textAlign: "center",
                        }}
                      >
                        {f[k]}
                      </span>
                      <button
                        onClick={() => set(k, Math.min(max, (f[k] as number) + 1))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "2px solid #f5c842",
                          background: "rgba(245,200,66,0.15)",
                          cursor: "pointer",
                          fontSize: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "#f5c842",
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : Tarif ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h2
                style={{
                  fontFamily: "'Clash Display',sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#f5f5f5",
                  margin: "0 0 4px",
                }}
              >
                Votre tarif
              </h2>

              {/* Carte tarif */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "18px 18px",
                  border: "2px solid #f5c842",
                  background: "rgba(245,200,66,0.07)",
                  borderRadius: 18,
                  boxShadow: "0 0 0 1px rgba(245,200,66,0.2), 0 4px 20px rgba(245,200,66,0.1)",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    flexShrink: 0,
                    background: "rgba(245,200,66,0.15)",
                    border: "1px solid rgba(245,200,66,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  🚕
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span
                      style={{
                        fontFamily: "'Clash Display',sans-serif",
                        fontWeight: 700,
                        fontSize: 16,
                        color: "#f5c842",
                      }}
                    >
                      Taxi Conventionné
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: tarifJour ? "#f59e0b" : "#a78bfa",
                        background: tarifJour ? "rgba(245,158,11,0.15)" : "rgba(167,139,250,0.15)",
                        borderRadius: 99,
                        padding: "2px 8px",
                        border: `1px solid ${tarifJour ? "rgba(245,158,11,0.3)" : "rgba(167,139,250,0.3)"}`,
                      }}
                    >
                      {tarifJour ? "☀️ Tarif jour" : "🌙 Tarif nuit"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {f.passagers} passager{f.passagers > 1 ? "s" : ""} · {f.bagages} bagage
                    {f.bagages > 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    {orsResult
                      ? `${orsResult.distanceKm} km · ~${Math.round(orsResult.dureeS / 60)} min`
                      : "Calculé selon compteur"}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Clash Display',sans-serif",
                      fontWeight: 700,
                      fontSize: 22,
                      color: "#f5c842",
                    }}
                  >
                    {prixAller.toFixed(2)} €
                  </div>
                  <div style={{ fontSize: 11, color: "#475569" }}>estimé</div>
                </div>
              </div>

              {/* Aller-retour */}
              {f.trajet === "aller-retour" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 18px",
                    border: "1px solid rgba(167,139,250,0.3)",
                    background: "rgba(167,139,250,0.05)",
                    borderRadius: 18,
                  }}
                >
                  <div style={{ fontSize: 28, flexShrink: 0 }}>🔁</div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontFamily: "'Clash Display',sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#e0e0e0",
                      }}
                    >
                      Aller-retour
                    </span>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      Aller : {prixAller.toFixed(2)} € · Retour : {prixRetour.toFixed(2)} €
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Clash Display',sans-serif",
                      fontWeight: 700,
                      fontSize: 22,
                      color: "#e0e0e0",
                    }}
                  >
                    {prixTotal.toFixed(2)} €
                  </div>
                </div>
              )}

              {/* Mode paiement */}
              <div>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginBottom: 10 }}>
                  Mode de paiement
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(
                    [
                      ["especes", "💵 Espèces"],
                      ["cb", "💳 Carte bancaire"],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      className="pay-btn"
                      onClick={() => set("paiement", v)}
                      style={{
                        padding: "14px 12px",
                        border: `2px solid ${f.paiement === v ? "#f5c842" : "#2a2a4a"}`,
                        background: f.paiement === v ? "rgba(245,200,66,0.1)" : "#1a1a2e",
                        borderRadius: 14,
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 14,
                        color: f.paiement === v ? "#f5c842" : "#64748b",
                        transition: "all 0.2s",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  background: "rgba(245,200,66,0.06)",
                  borderRadius: 12,
                  border: "1px solid rgba(245,200,66,0.15)",
                }}
              >
                <span style={{ fontSize: 13, color: "#a16207" }}>
                  ⚠️ Prix estimé — le compteur homologué fait foi à l'arrivée.
                </span>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 4 : Infos client ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h2
                style={{
                  fontFamily: "'Clash Display',sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#f5f5f5",
                  margin: "0 0 4px",
                }}
              >
                Vos coordonnées
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { k: "prenom" as const, label: "Prénom", type: "text", ph: "Jean" },
                  { k: "nom" as const, label: "Nom", type: "text", ph: "Dupont" },
                ].map(({ k, label, type, ph }) => (
                  <div key={k}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        fontWeight: 600,
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {label} *
                    </div>
                    <input
                      type={type}
                      value={f[k]}
                      onChange={(e) => set(k, e.target.value)}
                      placeholder={ph}
                      style={inputStyle(!!errors[k])}
                    />
                    {errors[k] && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
                  </div>
                ))}
              </div>
              {[
                { k: "phone" as const, label: "Téléphone", type: "tel", ph: "06 12 34 56 78" },
                { k: "email" as const, label: "Email", type: "email", ph: "jean@exemple.fr" },
              ].map(({ k, label, type, ph }) => (
                <div key={k}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 600,
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label} *
                  </div>
                  <input
                    type={type}
                    value={f[k]}
                    onChange={(e) => set(k, e.target.value)}
                    placeholder={ph}
                    style={inputStyle(!!errors[k])}
                  />
                  {errors[k] && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── ÉTAPE 5 : Récap ── */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h2
                style={{
                  fontFamily: "'Clash Display',sans-serif",
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#f5f5f5",
                  margin: "0 0 4px",
                }}
              >
                Récapitulatif
              </h2>

              <div style={{ background: "#1a1a2e", borderRadius: 18, overflow: "hidden", border: "1px solid #2a2a4a" }}>
                {[
                  { icon: "🟢", label: "Départ", value: f.depart },
                  { icon: "🟡", label: "Destination", value: f.destination },
                  { icon: "📅", label: "Date & heure", value: `${f.date} à ${f.heure}` },
                  ...(f.trajet === "aller-retour"
                    ? [{ icon: "🔁", label: "Retour", value: `${f.dateRetour} à ${f.heureRetour}` }]
                    : []),
                  {
                    icon: "👥",
                    label: "Passagers",
                    value: `${f.passagers} · 🧳 ${f.bagages} bagage${f.bagages > 1 ? "s" : ""}`,
                  },
                  { icon: "💳", label: "Paiement", value: f.paiement === "especes" ? "Espèces" : "Carte bancaire" },
                  { icon: "👤", label: "Client", value: `${f.prenom} ${f.nom}` },
                  { icon: "📞", label: "Téléphone", value: f.phone },
                ].map((row, i, arr) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "11px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid #1e1e30" : "none",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#475569",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {row.label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#e0e0e0",
                          fontWeight: 600,
                          marginTop: 1,
                          wordBreak: "break-word",
                        }}
                      >
                        {row.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Prix final */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1a1408, #2a2010)",
                  border: "1px solid rgba(245,200,66,0.3)",
                  borderRadius: 18,
                  padding: "20px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 0 30px rgba(245,200,66,0.08)",
                }}
              >
                <div>
                  <div style={{ color: "rgba(245,200,66,0.6)", fontSize: 13 }}>Prix estimé total</div>
                  <div
                    style={{
                      fontFamily: "'Clash Display',sans-serif",
                      fontWeight: 700,
                      fontSize: 36,
                      color: "#f5c842",
                    }}
                  >
                    {prixTotal.toFixed(2)} €
                  </div>
                  <div style={{ color: "rgba(245,200,66,0.5)", fontSize: 12, marginTop: 2 }}>
                    {tarifJour ? "☀️ Tarif jour" : "🌙 Tarif nuit"} · Berline · Compteur fait foi
                  </div>
                </div>
                <div style={{ fontSize: 48 }}>🚕</div>
              </div>

              {submitError && (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#1f0a0a",
                    border: "1px solid #7f1d1d",
                    borderRadius: 12,
                    color: "#fca5a5",
                    fontSize: 14,
                  }}
                >
                  ❌ {submitError}
                </div>
              )}

              {/* Bouton WhatsApp */}
              <a
                href={`https://wa.me/33673072322?text=${buildWhatsApp()}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px",
                  background: "#25D366",
                  color: "#fff",
                  borderRadius: 14,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                💬 Réserver via WhatsApp à la place
              </a>
            </div>
          )}
        </div>

        {/* ── CTA sticky ── */}
        <div style={{ padding: "12px 20px 24px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {step < 5 ? (
            <button
              className="cta-btn"
              onClick={goNext}
              style={{
                width: "100%",
                height: 56,
                background:
                  step === 1 && (!f.depart || !f.destination)
                    ? "rgba(245,200,66,0.3)"
                    : "linear-gradient(135deg, #f5c842, #e6a800)",
                color: step === 1 && (!f.depart || !f.destination) ? "rgba(245,200,66,0.6)" : "#0a0a14",
                border: "none",
                borderRadius: 16,
                fontFamily: "'Clash Display',sans-serif",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 24px rgba(245,200,66,0.25)",
                transition: "all 0.2s",
              }}
            >
              {step === 1
                ? fromCoord && toCoord
                  ? `Continuer · ~${prixAller.toFixed(2)} €`
                  : "Continuer"
                : step === 2
                  ? "Choisir le véhicule →"
                  : step === 3
                    ? "Mes coordonnées →"
                    : "Vérifier ma réservation →"}
            </button>
          ) : (
            <button
              onClick={submitForm}
              disabled={sending}
              style={{
                width: "100%",
                height: 56,
                background: sending ? "rgba(245,200,66,0.3)" : "linear-gradient(135deg, #f5c842, #e6a800)",
                color: sending ? "rgba(245,200,66,0.6)" : "#0a0a14",
                border: "none",
                borderRadius: 16,
                fontFamily: "'Clash Display',sans-serif",
                fontWeight: 700,
                fontSize: 16,
                cursor: sending ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: "0 4px 24px rgba(245,200,66,0.25)",
                transition: "all 0.2s",
              }}
            >
              {sending ? (
                <>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      border: "2px solid rgba(10,10,20,0.3)",
                      borderTopColor: "#0a0a14",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Envoi en cours…
                </>
              ) : (
                "📨 Confirmer ma réservation"
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Overlay succès ── */}
      {success && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(12px)",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#111120",
              borderRadius: 28,
              padding: "40px 32px",
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,200,66,0.15)",
              animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16, animation: "pulse 1s ease-in-out 2" }}>✅</div>
            <div
              style={{
                fontFamily: "'Clash Display',sans-serif",
                fontWeight: 700,
                fontSize: 24,
                color: "#f5f5f5",
                marginBottom: 8,
              }}
            >
              Réservation confirmée !
            </div>
            <div style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
              Votre demande a été enregistrée. Confirmation à <strong style={{ color: "#f5c842" }}>{f.email}</strong>.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href={`https://wa.me/33673072322?text=${buildWhatsApp()}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px 20px",
                  background: "#25D366",
                  color: "#fff",
                  borderRadius: 14,
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                💬 Confirmer via WhatsApp
              </a>
              <button
                onClick={() => {
                  setSuccess(false);
                  setStep(1);
                  setF((p) => ({ ...p, depart: "", destination: "", prenom: "", nom: "", phone: "", email: "" }));
                }}
                style={{
                  padding: "14px 20px",
                  background: "#1a1a2e",
                  color: "#94a3b8",
                  border: "1px solid #2a2a4a",
                  borderRadius: 14,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Nouvelle réservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
