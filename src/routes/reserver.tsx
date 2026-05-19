import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";

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
const TARIF_JOUR = 2.16; // 7h–19h
const TARIF_NUIT = 3.24; // 19h–7h
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
async function geocodeAdresse(query: string): Promise<[number, number] | null> {
  if (query.length < 3) return null;
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lang", "fr");
    url.searchParams.set("lat", "44.8378");
    url.searchParams.set("lon", "-0.5792");
    const res = await fetch(url.toString());
    const data = await res.json();
    const features = data.features ?? [];
    if (!features.length) return null;
    const PRIORITY = ["house", "street", "locality", "district", "city", "county", "state"];
    const sorted = [...features].sort((a, b) => {
      const ia = PRIORITY.indexOf(a.properties?.osm_value ?? "");
      const ib = PRIORITY.indexOf(b.properties?.osm_value ?? "");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const feat = sorted[0];
    return [feat.geometry.coordinates[0], feat.geometry.coordinates[1]]; // [lng, lat]
  } catch {
    return null;
  }
}

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
    const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false`;
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (label: string, coord: [number, number]) => void;
  placeholder: string;
  icon: string;
  error?: string;
  onGeolocate?: () => void;
  geolocLoading?: boolean;
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
            border: `2px solid ${error ? "#ef4444" : "#e2e8f0"}`,
            fontSize: 15,
            fontFamily: "'DM Sans',sans-serif",
            boxSizing: "border-box",
            background: "#fff",
            color: "#0f172a",
            outline: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
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
              color: "#0ea5e9",
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
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
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
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4, paddingLeft: 4 }}>{error}</div>}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────
function ReservationPage() {
  const { t } = useI18n();
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

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);

  // Prix
  const departMs = f.date && f.heure ? new Date(`${f.date}T${f.heure}:00`).getTime() : null;
  const retourMs =
    f.trajet === "aller-retour" && f.dateRetour && f.heureRetour
      ? new Date(`${f.dateRetour}T${f.heureRetour}:00`).getTime()
      : null;
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : 12;
  const tarifJour = heureNum >= 7 && heureNum < 19;

  const prixAller =
    orsResult && departMs
      ? calculerPrixMixte(departMs, orsResult.dureeS, orsResult.distanceKm)
      : orsResult
        ? Math.round((PRISE_EN_CHARGE + orsResult.distanceKm * (tarifJour ? TARIF_JOUR : TARIF_NUIT)) * 100) / 100
        : PRISE_EN_CHARGE;

  const prixRetour =
    f.trajet === "aller-retour" && orsResult
      ? retourMs
        ? calculerPrixMixte(retourMs, orsResult.dureeS, orsResult.distanceKm)
        : prixAller
      : 0;

  const prixTotal = f.trajet === "aller-retour" ? Math.round((prixAller + prixRetour) * 100) / 100 : prixAller;

  // Init today
  useEffect(() => {
    const d = new Date().toISOString().split("T")[0];
    setToday(d);
    setF((p) => ({ ...p, date: p.date || d }));
  }, []);

  // Init map
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
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;
      setTimeout(() => map.invalidateSize(), 300);
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

  // Mise à jour carte quand coords changent
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L) return;

    // Marqueur départ
    if (fromCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(34,197,94,0.6)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      if (fromMarker.current) fromMarker.current.remove();
      fromMarker.current = L.marker([fromCoord[1], fromCoord[0]], { icon }).addTo(map);
    }

    // Marqueur destination
    if (toCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(239,68,68,0.6)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      if (toMarker.current) toMarker.current.remove();
      toMarker.current = L.marker([toCoord[1], toCoord[0]], { icon }).addTo(map);
    }

    // Polyline route
    if (fromCoord && toCoord) {
      getOsrmPolyline(fromCoord, toCoord).then((coords) => {
        if (!mapInst.current || !L) return;
        if (routeLayer.current) {
          routeLayer.current.remove();
          routeLayer.current = null;
        }
        if (coords.length > 1) {
          routeLayer.current = L.polyline(coords, {
            color: "#0ea5e9",
            weight: 5,
            opacity: 0.9,
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

  // OSRM quand les deux coords sont prêtes
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

  // Géolocalisation
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

  // Validation par étape
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

  // Submit
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

      // Email de confirmation (non-bloquant)
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

  // WhatsApp text
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

  // Bottom sheet heights per step (vh)
  const sheetHeights: Record<Step, string> = {
    1: "52vh",
    2: "58vh",
    3: "52vh",
    4: "60vh",
    5: "65vh",
  };

  const stepLabels = ["Trajet", "Horaires", "Tarif", "Vous", "Récap"];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0f1117",
        fontFamily: "'DM Sans',sans-serif",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        * { box-sizing: border-box; }
        input, select, button { font-family: 'DM Sans', sans-serif; }
        input[type=date], input[type=time] { color-scheme: light; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        .sheet-inner { animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
        .leaflet-container { width: 100% !important; height: 100% !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        input:focus { outline: none; border-color: #0ea5e9 !important; box-shadow: 0 0 0 3px rgba(14,165,233,0.15) !important; }
      `}</style>

      {/* ── Carte plein écran ── */}
      <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

      {/* ── Overlay gradient bas pour lisibilité ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `calc(${sheetHeights[step]} + 40px)`,
          background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {success ? (
        /* ── Succès ── */
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,15,30,0.88)",
            backdropFilter: "blur(8px)",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 28,
              padding: "40px 32px",
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
              animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16, animation: "pulse 1s ease-in-out 2" }}>✅</div>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontWeight: 900,
                fontSize: 24,
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Réservation confirmée !
            </div>
            <div style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
              Votre demande a été enregistrée. Vous recevrez une confirmation à <strong>{f.email}</strong>.
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
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
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
      ) : (
        <>
          {/* ── Barre d'étapes (top) ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "14px 20px 10px",
              background: "linear-gradient(to bottom, rgba(10,15,30,0.85) 0%, transparent 100%)",
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
                  background: "rgba(255,255,255,0.95)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  flexShrink: 0,
                }}
              >
                ←
              </button>
            )}
            <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
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
                      flex: active ? 2 : 1,
                      transition: "flex 0.3s ease",
                    }}
                  >
                    <div
                      style={{
                        height: 4,
                        flex: 1,
                        borderRadius: 9,
                        background: done ? "#22c55e" : active ? "#0ea5e9" : "rgba(255,255,255,0.25)",
                        transition: "background 0.3s",
                      }}
                    />
                    {active && (
                      <span
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "#fff",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom sheet ── */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: sheetHeights[step],
              background: "#fff",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              transition: "height 0.4s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {/* Handle */}
            <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 9 }} />
            </div>

            {/* Content scrollable */}
            <div key={step} className="sheet-inner" style={{ flex: 1, overflowY: "auto", padding: "8px 20px 0" }}>
              {/* ── ÉTAPE 1 : Adresses ── */}
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <h2
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 900,
                      fontSize: 22,
                      color: "#0f172a",
                      margin: "0 0 4px",
                    }}
                  >
                    Où allons-nous ?
                  </h2>
                  {/* Route line visuelle */}
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 18 }}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: "#22c55e",
                          border: "2px solid #fff",
                          boxShadow: "0 0 0 2px #22c55e",
                        }}
                      />
                      <div style={{ width: 2, flex: 1, background: "#e2e8f0", margin: "4px 0" }} />
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: "#ef4444",
                          border: "2px solid #fff",
                          boxShadow: "0 0 0 2px #ef4444",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                      <AddressInput
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

                  {/* Résumé itinéraire */}
                  {(calcLoading || orsResult) && (
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "12px 14px",
                        background: "#f0f9ff",
                        borderRadius: 14,
                        alignItems: "center",
                      }}
                    >
                      {calcLoading ? (
                        <>
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              border: "2px solid #bae6fd",
                              borderTopColor: "#0ea5e9",
                              borderRadius: "50%",
                              animation: "spin 0.7s linear infinite",
                            }}
                          />
                          <span style={{ color: "#0369a1", fontSize: 14 }}>Calcul de l'itinéraire…</span>
                        </>
                      ) : (
                        orsResult && (
                          <>
                            <span style={{ fontSize: 18 }}>🗺️</span>
                            <div style={{ flex: 1 }}>
                              <span style={{ color: "#0369a1", fontSize: 14, fontWeight: 600 }}>
                                {orsResult.distanceKm} km
                              </span>
                              <span style={{ color: "#94a3b8", fontSize: 14 }}>
                                {" "}
                                · {Math.round(orsResult.dureeS / 60)} min
                              </span>
                            </div>
                            <span
                              style={{
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 800,
                                fontSize: 16,
                                color: "#0ea5e9",
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
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 900,
                      fontSize: 22,
                      color: "#0f172a",
                      margin: "0 0 4px",
                    }}
                  >
                    Quand partez-vous ?
                  </h2>

                  {/* Type trajet */}
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
                          border: `2px solid ${f.trajet === v ? "#0ea5e9" : "#e2e8f0"}`,
                          background: f.trajet === v ? "#f0f9ff" : "#fff",
                          borderRadius: 14,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 14,
                          color: f.trajet === v ? "#0369a1" : "#475569",
                          transition: "all 0.2s",
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Aller */}
                  <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>
                    <div
                      style={{
                        fontFamily: "'Syne',sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "#0369a1",
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
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: `2px solid ${errors.date ? "#ef4444" : "#e2e8f0"}`,
                            fontSize: 15,
                            background: "#fff",
                            color: "#0f172a",
                          }}
                        />
                        {errors.date && (
                          <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.date}</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>HEURE</div>
                        <input
                          type="time"
                          value={f.heure}
                          onChange={(e) => set("heure", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: 12,
                            border: `2px solid ${errors.heure ? "#ef4444" : "#e2e8f0"}`,
                            fontSize: 15,
                            background: "#fff",
                            color: "#0f172a",
                          }}
                        />
                        {errors.heure && (
                          <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.heure}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Retour */}
                  {f.trajet === "aller-retour" && (
                    <div style={{ background: "#fdf4ff", borderRadius: 16, padding: 16 }}>
                      <div
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 700,
                          fontSize: 12,
                          color: "#7e22ce",
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
                            style={{
                              width: "100%",
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: `2px solid ${errors.dateRetour ? "#ef4444" : "#e2e8f0"}`,
                              fontSize: 15,
                              background: "#fff",
                              color: "#0f172a",
                            }}
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
                            style={{
                              width: "100%",
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: `2px solid ${errors.heureRetour ? "#ef4444" : "#e2e8f0"}`,
                              fontSize: 15,
                              background: "#fff",
                              color: "#0f172a",
                            }}
                          />
                          {errors.heureRetour && (
                            <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.heureRetour}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Passagers & bagages */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { label: "👥 Passagers", k: "passagers" as const, min: 1, max: 8 },
                      { label: "🧳 Bagages", k: "bagages" as const, min: 0, max: 10 },
                    ].map(({ label, k, min, max }) => (
                      <div key={k} style={{ background: "#f8fafc", borderRadius: 14, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>{label}</div>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}
                        >
                          <button
                            onClick={() => set(k, Math.max(min, (f[k] as number) - 1))}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              border: "2px solid #e2e8f0",
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: 18,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "#475569",
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 800,
                              fontSize: 20,
                              color: "#0f172a",
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
                              border: "2px solid #0ea5e9",
                              background: "#0ea5e9",
                              cursor: "pointer",
                              fontSize: 18,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "#fff",
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
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 900,
                      fontSize: 22,
                      color: "#0f172a",
                      margin: "0 0 4px",
                    }}
                  >
                    Choisissez votre tarif
                  </h2>

                  {/* Carte tarif principal (style Uber) */}
                  {[
                    {
                      id: "standard",
                      icon: "🚕",
                      label: "Taxi Conventionné",
                      badge: tarifJour ? "☀️ Tarif jour" : "🌙 Tarif nuit",
                      badgeColor: tarifJour ? "#f59e0b" : "#6366f1",
                      prix: prixAller,
                      desc: `${f.passagers} passager${f.passagers > 1 ? "s" : ""} · ${f.bagages} bagage${f.bagages > 1 ? "s" : ""}`,
                      subDesc: orsResult
                        ? `${orsResult.distanceKm} km · ~${Math.round(orsResult.dureeS / 60)} min`
                        : "Calculé selon compteur",
                    },
                    ...(f.trajet === "aller-retour"
                      ? [
                          {
                            id: "retour",
                            icon: "🔁",
                            label: "Aller-retour",
                            badge: "Économique",
                            badgeColor: "#22c55e",
                            prix: prixTotal,
                            desc: "Aller + retour inclus",
                            subDesc: `Aller : ${prixAller.toFixed(2)} € · Retour : ${prixRetour.toFixed(2)} €`,
                          },
                        ]
                      : []),
                  ].map((opt, i) => (
                    <div
                      key={opt.id}
                      style={{
                        border: `2px solid ${i === 0 ? "#0ea5e9" : "#e2e8f0"}`,
                        borderRadius: 18,
                        padding: "18px 18px",
                        background: i === 0 ? "#f0f9ff" : "#fff",
                        boxShadow: i === 0 ? "0 4px 20px rgba(14,165,233,0.12)" : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div style={{ fontSize: 36, flexShrink: 0 }}>{opt.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span
                            style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#0f172a" }}
                          >
                            {opt.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: opt.badgeColor,
                              background: `${opt.badgeColor}18`,
                              borderRadius: 99,
                              padding: "2px 8px",
                            }}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "#475569" }}>{opt.desc}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{opt.subDesc}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          style={{
                            fontFamily: "'Syne',sans-serif",
                            fontWeight: 900,
                            fontSize: 22,
                            color: i === 0 ? "#0ea5e9" : "#0f172a",
                          }}
                        >
                          {opt.prix.toFixed(2)} €
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>estimé</div>
                      </div>
                    </div>
                  ))}

                  {/* Paiement */}
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
                          onClick={() => set("paiement", v)}
                          style={{
                            padding: "14px 12px",
                            border: `2px solid ${f.paiement === v ? "#0ea5e9" : "#e2e8f0"}`,
                            background: f.paiement === v ? "#f0f9ff" : "#fff",
                            borderRadius: 14,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 14,
                            color: f.paiement === v ? "#0369a1" : "#475569",
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
                      background: "#fffbeb",
                      borderRadius: 12,
                      border: "1px solid #fde68a",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#92400e" }}>
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
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 900,
                      fontSize: 22,
                      color: "#0f172a",
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
                          style={{
                            width: "100%",
                            padding: "13px 14px",
                            borderRadius: 12,
                            border: `2px solid ${errors[k] ? "#ef4444" : "#e2e8f0"}`,
                            fontSize: 15,
                            background: "#fff",
                            color: "#0f172a",
                          }}
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
                        style={{
                          width: "100%",
                          padding: "13px 14px",
                          borderRadius: 12,
                          border: `2px solid ${errors[k] ? "#ef4444" : "#e2e8f0"}`,
                          fontSize: 15,
                          background: "#fff",
                          color: "#0f172a",
                        }}
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
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 900,
                      fontSize: 22,
                      color: "#0f172a",
                      margin: "0 0 4px",
                    }}
                  >
                    Récapitulatif
                  </h2>

                  <div style={{ background: "#f8fafc", borderRadius: 18, overflow: "hidden" }}>
                    {[
                      { icon: "🟢", label: "Départ", value: f.depart },
                      { icon: "🏁", label: "Destination", value: f.destination },
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
                          padding: "12px 16px",
                          borderBottom: i < arr.length - 1 ? "1px solid #e2e8f0" : "none",
                          alignItems: "flex-start",
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#94a3b8",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {row.label}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: "#0f172a",
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
                      background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
                      borderRadius: 18,
                      padding: "20px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Prix estimé total</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 32, color: "#fff" }}>
                        {prixTotal.toFixed(2)} €
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>
                        {tarifJour ? "☀️ Tarif jour" : "🌙 Tarif nuit"} · Compteur homologué fait foi
                      </div>
                    </div>
                    <div style={{ fontSize: 48 }}>🚕</div>
                  </div>

                  {submitError && (
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 12,
                        color: "#991b1b",
                        fontSize: 14,
                      }}
                    >
                      ❌ {submitError}
                    </div>
                  )}

                  {/* Bouton WhatsApp alternatif */}
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
            <div style={{ padding: "12px 20px 24px", flexShrink: 0, borderTop: "1px solid #f1f5f9" }}>
              {step < 5 ? (
                <button
                  onClick={goNext}
                  style={{
                    width: "100%",
                    height: 56,
                    background:
                      step === 1 && (!f.depart || !f.destination)
                        ? "linear-gradient(135deg,#7dd3fc,#38bdf8)"
                        : "linear-gradient(135deg,#0ea5e9,#0369a1)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 16,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 20px rgba(14,165,233,0.35)",
                    transition: "all 0.2s",
                  }}
                >
                  {step === 1
                    ? fromCoord && toCoord
                      ? `Continuer · ~${prixAller.toFixed(2)} €`
                      : "Continuer"
                    : step === 2
                      ? "Voir les tarifs →"
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
                    background: sending
                      ? "linear-gradient(135deg,#7dd3fc,#38bdf8)"
                      : "linear-gradient(135deg,#0ea5e9,#0369a1)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 16,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: sending ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: "0 4px 20px rgba(14,165,233,0.35)",
                  }}
                >
                  {sending ? (
                    <>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: "2px solid rgba(255,255,255,0.4)",
                          borderTopColor: "#fff",
                          borderRadius: "50%",
                          animation: "spin 0.7s linear infinite",
                        }}
                      />{" "}
                      Envoi en cours…
                    </>
                  ) : (
                    "📨 Confirmer ma réservation"
                  )}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
