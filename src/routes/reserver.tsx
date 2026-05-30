import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, calculerPrixMixte, PRISE_EN_CHARGE } from "@/lib/tarif";
import { reverseGeocode, searchAddress } from "@/lib/geocode";
import { getDistanceAndDurationKm } from "@/lib/osrm";
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
const DESTINATION_SEARCH_RADIUS_KM = 80;
const MAX_AUTO_GEO_ACCURACY_M = 1500;
const MAX_AUTO_GEO_DISTANCE_FROM_BORDEAUX_KM = 130;

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

type AddressChoice = {
  label: string;
  coord: [number, number];
  distanceKm: number;
};

function shortLabel(label: string): string {
  const parts = label
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return label;

  // Mots-clés indiquant un nom de lieu (aéroport, gare, hôpital, centre...)
  const isNamedPlace =
    /aéroport|airport|gare|station|hôpital|hopital|clinique|université|universite|centre|stade|mairie|église|eglise|château|chateau|lycée|lycee|école|ecole/i.test(
      parts[0],
    );

  if (isNamedPlace) {
    // Cherche la ville : première partie qui ne contient pas de chiffre et n'est pas un code postal ni une région connue
    const skipWords =
      /gironde|nouvelle-aquitaine|aquitaine|france|métropolitaine|metropolitaine|département|region|^\d{5}$/i;
    const ville = parts.slice(1).find((p) => !skipWords.test(p) && !/^\d/.test(p));
    return ville ? `${parts[0]}, ${ville}` : parts[0];
  }

  // Adresse classique : rue + ville (ignore code postal, département, région, France)
  const skipWords =
    /gironde|nouvelle-aquitaine|aquitaine|france|métropolitaine|metropolitaine|^\d{5}$/i;
  const kept = parts.filter((p) => !skipWords.test(p));
  return kept.slice(0, 2).join(", ");
}

async function geocodeFullAddress(
  address: string,
): Promise<{ coord: [number, number]; label: string } | null> {
  const trimmed = address.trim();
  const normalized = normalizeAddressText(trimmed);
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const short = parts.slice(0, 2).join(", ");

  // Variantes spécifiques pour les lieux nommés courants
  const namedPlaceVariants: string[] = [];
  if (/aeroport|airport/.test(normalized)) {
    if (/bordeaux|merignac|bod/.test(normalized)) {
      namedPlaceVariants.push(
        "Aéroport de Bordeaux-Mérignac",
        "Bordeaux-Mérignac Airport",
        "aéroport Bordeaux Mérignac",
      );
    } else {
      // aéroport d'une autre ville : extraire la ville probable
      const cityToken = normalized
        .replace(/aeroport|airport|de|du|d/g, " ")
        .trim()
        .split(/\s+/)[0];
      if (cityToken && cityToken.length > 2) {
        namedPlaceVariants.push(`aéroport ${cityToken}, France`, `${cityToken} airport, France`);
      }
    }
  }
  if (/gare/.test(normalized)) {
    if (/bordeaux|saint.jean/.test(normalized)) {
      namedPlaceVariants.push("Gare de Bordeaux-Saint-Jean");
    } else {
      const cityToken = normalized
        .replace(/gare|de|du|d/g, " ")
        .trim()
        .split(/\s+/)[0];
      if (cityToken && cityToken.length > 2) {
        namedPlaceVariants.push(`gare ${cityToken}, France`);
      }
    }
  }

  // Plusieurs variantes pour maximiser les chances de trouver lieux nommés et adresses
  const attempts = [
    ...namedPlaceVariants, // lieux nommés en priorité
    trimmed,
    trimmed + ", France",
    short,
    short + ", France",
    parts[0] + ", France",
    parts[0] + ", Bordeaux, France",
    parts[0] + ", Gironde, France",
  ].filter((v, i, arr) => v.length > 2 && arr.indexOf(v) === i);

  for (const query of attempts) {
    const results = await searchAddress(query, 1);
    if (results.length) {
      const r = results[0];
      return { coord: [r.coord[0], r.coord[1]], label: shortLabel(r.label) };
    }
  }
  return null;
}

function distanceKmBetween(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeAddressText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function usefulSearchTokens(query: string): string[] {
  const skip = new Set([
    "rue",
    "avenue",
    "av",
    "boulevard",
    "bd",
    "route",
    "chemin",
    "place",
    "allee",
    "impasse",
    "cours",
    "de",
    "du",
    "des",
    "la",
    "le",
    "les",
    "d",
    "l",
    "a",
    "au",
    "aux",
    "france",
    "gironde",
  ]);
  return normalizeAddressText(query)
    .split(" ")
    .filter((token) => token.length >= 3 && !skip.has(token))
    .slice(0, 4);
}

function isPlausibleAddressMatch(query: string, label: string): boolean {
  const tokens = usefulSearchTokens(query);
  if (tokens.length === 0) return true;
  const normalizedLabel = normalizeAddressText(label);
  const normalizedQuery = normalizeAddressText(query);
  // Lieux nommés : accepter dès qu'un seul token matche
  const isNamedPlaceQuery =
    /aeroport|airport|gare|station|hopital|clinique|universite|centre|stade|mairie|eglise|chateau|lycee|ecole/.test(
      normalizedQuery,
    );
  const hits = tokens.filter((token) => normalizedLabel.includes(token)).length;
  if (isNamedPlaceQuery) return hits >= 1;
  return hits >= Math.min(2, tokens.length) || normalizedLabel.includes(tokens[0]);
}

function dedupeAddressChoices(choices: AddressChoice[]): AddressChoice[] {
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = `${choice.label.toLowerCase()}-${choice.coord[0].toFixed(4)}-${choice.coord[1].toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchPhotonAddress(
  query: string,
  origin: [number, number],
): Promise<AddressChoice[]> {
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");
    url.searchParams.set("lang", "fr");
    url.searchParams.set("lat", String(origin[0]));
    url.searchParams.set("lon", String(origin[1]));
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.features)) return [];
    return data.features
      .map((feature: any) => {
        const coords = feature?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const props = feature.properties ?? {};
        const label = [props.name, props.street, props.postcode, props.city || props.county]
          .filter(Boolean)
          .join(", ");
        const coord: [number, number] = [Number(coords[1]), Number(coords[0])];
        if (!label || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return null;
        return { label: shortLabel(label), coord, distanceKm: distanceKmBetween(origin, coord) };
      })
      .filter(Boolean) as AddressChoice[];
  } catch {
    return [];
  }
}

async function searchOverpassPois(
  query: string,
  origin: [number, number],
  radiusKm: number,
): Promise<AddressChoice[]> {
  const token = usefulSearchTokens(query)[0];
  if (!token) return [];
  const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const radiusM = Math.round(radiusKm * 1000);
  const body = `[out:json][timeout:8];(
node(around:${radiusM},${origin[0]},${origin[1]})["name"~"${safeToken}",i];
way(around:${radiusM},${origin[0]},${origin[1]})["name"~"${safeToken}",i];
relation(around:${radiusM},${origin[0]},${origin[1]})["name"~"${safeToken}",i];
);out center tags 20;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.elements)) return [];
    return data.elements
      .map((item: any) => {
        const lat = Number(item.lat ?? item.center?.lat);
        const lng = Number(item.lon ?? item.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const tags = item.tags ?? {};
        const label = [
          tags.name,
          tags["addr:housenumber"] && tags["addr:street"]
            ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
            : tags["addr:street"],
          tags["addr:postcode"],
          tags["addr:city"],
        ]
          .filter(Boolean)
          .join(", ");
        if (!label) return null;
        const coord: [number, number] = [lat, lng];
        return { label: shortLabel(label), coord, distanceKm: distanceKmBetween(origin, coord) };
      })
      .filter(Boolean) as AddressChoice[];
  } catch {
    return [];
  }
}

async function searchNearbyAddressChoices(
  query: string,
  origin: [number, number],
  radiusKm = 20,
): Promise<AddressChoice[]> {
  // Variantes spécifiques pour lieux connus mal reconnus
  const normalizedQ = normalizeAddressText(query);
  const extraVariants: string[] = [];
  if (/aeroport|airport/.test(normalizedQ) && /bordeaux|merignac|bod/.test(normalizedQ)) {
    extraVariants.push(
      "Aéroport de Bordeaux-Mérignac",
      "Bordeaux-Mérignac Airport",
      "BOD Bordeaux",
    );
  }
  if (/gare|saint.jean/.test(normalizedQ) && /bordeaux/.test(normalizedQ)) {
    extraVariants.push("Gare de Bordeaux-Saint-Jean");
  }
  const variants = [
    ...new Set([
      query,
      `${query}, Gironde`,
      `${query}, Bordeaux`,
      `${query}, France`,
      ...extraVariants,
    ]),
  ];
  const nominatimGroups = await Promise.all(
    variants.map((variant) => searchAddress(variant, 8).catch(() => [])),
  );
  const nominatimChoices = nominatimGroups.flat().map((item) => ({
    label: shortLabel(item.label),
    coord: item.coord,
    distanceKm: distanceKmBetween(origin, item.coord),
  }));
  const [photonChoices, overpassChoices] = await Promise.all([
    searchPhotonAddress(query, origin),
    searchOverpassPois(query, origin, radiusKm),
  ]);
  const tokens = usefulSearchTokens(query);
  return dedupeAddressChoices([...nominatimChoices, ...photonChoices, ...overpassChoices])
    .filter((choice) => isPlausibleAddressMatch(query, choice.label))
    .sort((a, b) => {
      const aLabel = normalizeAddressText(a.label);
      const bLabel = normalizeAddressText(b.label);
      const aHits = tokens.filter((token) => aLabel.includes(token)).length;
      const bHits = tokens.filter((token) => bLabel.includes(token)).length;
      return bHits - aHits || a.distanceKm - b.distanceKm;
    })
    .slice(0, 4);
}

function requestBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function getAutoGeoRejectionReason(pos: GeolocationPosition): string | null {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracy = pos.coords.accuracy;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy)) {
    return "Position invalide. Saisissez l’adresse de départ manuellement.";
  }
  if (accuracy > MAX_AUTO_GEO_ACCURACY_M) {
    return `Signal GPS trop imprécis (${Math.round(accuracy)} m). Saisissez l’adresse exacte pour éviter une mauvaise prise en charge.`;
  }
  const distanceFromBordeaux = distanceKmBetween(BORDEAUX_CENTER, [lat, lng]);
  if (distanceFromBordeaux > MAX_AUTO_GEO_DISTANCE_FROM_BORDEAUX_KM) {
    return "Position incohérente avec la zone de Bordeaux. Saisissez l’adresse exacte de départ.";
  }
  return null;
}

// ─── OSRM : passe par l'Edge Function Supabase (évite les blocages CORS) ─────
const SUPABASE_URL = "https://auiagkpdpnfqxfngisfc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWFna3BkcG5mcXhmbmdpc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzU2NzUsImV4cCI6MjA5NDAxMTY3NX0.MkW2KzCYHvQ0GEjjP3_puf3PkCHWaYcvW2bI1ctTuJU";

// ─── ORS polyline : via Edge Function Supabase ──────────────────────────────
async function getOsrmPolylineLongest(
  from: [number, number],
  to: [number, number],
): Promise<[number, number][]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/osrm-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        from_lng: from[1], // from = [lat, lng] → ORS attend lng en premier
        from_lat: from[0],
        to_lng: to[1],
        to_lat: to[0],
        overview: "full",
        geometries: "geojson",
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (json?.error) return [];
    // ORS retourne geometry en GeoJSON : { type: "LineString", coordinates: [[lng,lat],...] }
    const coords: [number, number][] = json?.geometry?.coordinates ?? [];
    if (!coords.length) return [];
    // Inverser [lng, lat] → [lat, lng] pour Leaflet
    return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
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

/**
 * Construit un ISO string avec l'offset réel Europe/Paris
 * à partir d'une date "YYYY-MM-DD" et d'une heure "HH:MM".
 * Évite la confusion UTC / local qui fausse les calculs nuit et mixte.
 */
function toParisIso(date: string, heure: string): string {
  // On forge directement un ISO en heure locale Paris en cherchant le bon offset UTC.
  // Principe : on cherche l'offset réel de Europe/Paris pour ce moment précis,
  // sans passer par le fuseau du navigateur qui peut être différent.
  const [h, m] = heure.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  // Estimation initiale : UTC = heure Paris - 2h (été) ou -1h (hiver)
  // On itère pour trouver l'offset exact
  for (const guessOffset of [120, 60, 0]) {
    const utcMs = Date.UTC(y, mo - 1, d, h - Math.floor(guessOffset / 60), m - (guessOffset % 60));
    const check = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const hPart = check.find((p) => p.type === "hour");
    const mPart = check.find((p) => p.type === "minute");
    const hVal = hPart ? parseInt(hPart.value, 10) : -1;
    const mVal = mPart ? parseInt(mPart.value, 10) : -1;
    if (hVal === h && mVal === m) {
      const sign = guessOffset >= 0 ? "+" : "-";
      const absMin = Math.abs(guessOffset);
      const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
      const mm = String(absMin % 60).padStart(2, "0");
      return `${date}T${heure}:00${sign}${hh}:${mm}`;
    }
  }
  // Fallback ultime : ISO sans offset (heure locale navigateur)
  return `${date}T${heure}:00`;
}

function ReservationPage() {
  const navigate = useNavigate();
  const [today, setToday] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );

  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [orsResult, setOrsResult] = useState<OrsResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [geolocLoading, setGeolocLoading] = useState(false);
  const [taxiAvailable, setTaxiAvailable] = useState<boolean | null>(null);
  const [destinationChoices, setDestinationChoices] = useState<AddressChoice[]>([]);

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

  const pickupIso = f.date && f.heure ? toParisIso(f.date, f.heure) : null;

  // ── Tarification Paris : 7h-19h = Jour, 19h-7h = Nuit
  //    Dimanche et jours fériés → Nuit toute la journée
  //    Si le trajet chevauche la frontière 7h ou 19h → calcul mixte proportionnel ──
  const JOURS_FERIES_RES = new Set([
    "2025-01-01",
    "2025-04-21",
    "2025-05-01",
    "2025-05-08",
    "2025-05-29",
    "2025-06-09",
    "2025-07-14",
    "2025-08-15",
    "2025-11-01",
    "2025-11-11",
    "2025-12-25",
    "2026-01-01",
    "2026-04-06",
    "2026-05-01",
    "2026-05-08",
    "2026-05-14",
    "2026-05-25",
    "2026-06-04",
    "2026-07-14",
    "2026-08-15",
    "2026-11-01",
    "2026-11-11",
    "2026-12-25",
    "2027-01-01",
    "2027-03-29",
    "2027-05-01",
    "2027-05-08",
    "2027-05-13",
    "2027-05-24",
    "2027-07-14",
    "2027-08-15",
    "2027-11-01",
    "2027-11-11",
    "2027-12-25",
  ]);

  function isJourFerieRes(date: Date): boolean {
    const yyyy = date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", year: "numeric" });
    const mm = date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", month: "2-digit" });
    const dd = date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit" });
    return JOURS_FERIES_RES.has(`${yyyy}-${mm}-${dd}`);
  }

  // Retourne l'heure Paris (0-23) d'un timestamp ms — fiable sur tous navigateurs
  function heureParis(ms: number): number {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const h = parts.find((p) => p.type === "hour");
    return h ? parseInt(h.value, 10) : 0;
  }

  // Vrai si ce moment est tarifé "nuit" (dimanche, férié, ou 19h-7h Paris)
  function isMomentNuit(ms: number): boolean {
    const date = new Date(ms);
    const h = heureParis(ms);
    const dimanche =
      date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }) === "dim.";
    return h >= 19 || h < 7 || dimanche || isJourFerieRes(date);
  }

  // Calcule le prix mixte proportionnel pour un trajet de distKm démarrant à pickupMs
  // en découpant le trajet en tranches de 1 minute et pondérant jour/nuit
  function calculerPrixMixteLocal(distKm: number, pickupMs: number, dureeS: number): number {
    const TARIF_JOUR_KM = 2.16;
    const TARIF_NUIT_KM = 3.24;
    const PRISE = 2.83;
    if (distKm <= 0) return PRISE;
    const steps = Math.max(Math.round(dureeS / 60), 1);
    const stepMs = (dureeS * 1000) / steps;
    let jourKm = 0;
    let nuitKm = 0;
    for (let i = 0; i < steps; i++) {
      const tMs = pickupMs + i * stepMs;
      const frac = distKm / steps;
      if (isMomentNuit(tMs)) nuitKm += frac;
      else jourKm += frac;
    }
    return parseFloat((PRISE + jourKm * TARIF_JOUR_KM + nuitKm * TARIF_NUIT_KM).toFixed(2));
  }

  // tarifJour : utilisé uniquement pour le badge affiché, basé sur l'heure de départ
  const tarifJour = pickupIso ? !isMomentNuit(new Date(pickupIso).getTime()) : true;

  const prixAller: number = (() => {
    if (!orsResult) return PRISE_EN_CHARGE;
    const raw = pickupIso
      ? calculerPrixMixteLocal(
          orsResult.distanceKm,
          new Date(pickupIso).getTime(),
          orsResult.dureeS,
        )
      : calculerPrix(orsResult.distanceKm, true);
    // Garde-fou : prix > 2000 EUR = bug de données, on n affiche pas
    const MAX_PRIX = 2000;
    return raw > MAX_PRIX ? PRISE_EN_CHARGE : raw;
  })();

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
      fromMarker.current = L.marker([fromCoord[0], fromCoord[1]], { icon }).addTo(map);
    }

    if (toCoord) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#f5c842;border-radius:50%;border:3px solid #1a1a2e;box-shadow:0 0 0 4px rgba(245,200,66,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (toMarker.current) toMarker.current.remove();
      toMarker.current = L.marker([toCoord[0], toCoord[1]], { icon }).addTo(map);
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
              [fromCoord[0], fromCoord[1]],
              [toCoord[0], toCoord[1]],
              ...coords.map((c) => [c[1], c[0]]),
            ]).pad(0.25),
          );
        }
      });
    } else if (fromCoord) {
      map.setView([fromCoord[0], fromCoord[1]], 14);
    }
  }, [fromCoord, toCoord]);

  // ── OSRM : recalcul distance/prix ────────────────────────────────────────
  useEffect(() => {
    if (!fromCoord || !toCoord) {
      setOrsResult(null);
      return;
    }
    setCalcLoading(true);

    const fetchOsrm = async () => {
      try {
        // Appel direct OSRM public avec timeout de 6 s
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${fromCoord[1]},${fromCoord[0]};${toCoord[1]},${toCoord[0]}` +
          `?overview=false`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const json = await res.json();
          const route = json?.routes?.[0];
          if (route) {
            setOrsResult({
              distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
              dureeS: Math.round(route.duration),
            });
            setCalcLoading(false);
            return;
          }
        }
      } catch {
        // timeout ou erreur réseau → fallback
      }

      // Fallback : essai via Edge Function Supabase
      try {
        const controller2 = new AbortController();
        const timer2 = setTimeout(() => controller2.abort(), 8000);
        const res2 = await fetch(`${SUPABASE_URL}/functions/v1/osrm-route`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            from_lng: fromCoord[1],
            from_lat: fromCoord[0],
            to_lng: toCoord[1],
            to_lat: toCoord[0],
            overview: "false",
          }),
          signal: controller2.signal,
        });
        clearTimeout(timer2);
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2?.distance && json2?.duration) {
            setOrsResult({
              distanceKm: parseFloat((json2.distance / 1000).toFixed(2)),
              dureeS: Math.round(json2.duration),
            });
            setCalcLoading(false);
            return;
          }
        }
      } catch {
        // fallback vol d'oiseau
      }

      // Fallback final : OSRM demo server (autre instance publique)
      try {
        const controller3 = new AbortController();
        const timer3 = setTimeout(() => controller3.abort(), 8000);
        const url3 =
          `https://routing.openstreetmap.de/routed-car/route/v1/driving/` +
          `${fromCoord[1]},${fromCoord[0]};${toCoord[1]},${toCoord[0]}` +
          `?overview=false`;
        const res3 = await fetch(url3, { signal: controller3.signal });
        clearTimeout(timer3);
        if (res3.ok) {
          const json3 = await res3.json();
          const route3 = json3?.routes?.[0];
          if (route3) {
            setOrsResult({
              distanceKm: parseFloat((route3.distance / 1000).toFixed(2)),
              dureeS: Math.round(route3.duration),
            });
            setCalcLoading(false);
            return;
          }
        }
      } catch {
        // dernier fallback
      }

      // Dernier recours : GraphHopper public (clé gratuite non requise pour petits volumes)
      try {
        const controller4 = new AbortController();
        const timer4 = setTimeout(() => controller4.abort(), 8000);
        const url4 = `https://graphhopper.com/api/1/route?point=${fromCoord[0]},${fromCoord[1]}&point=${toCoord[0]},${toCoord[1]}&vehicle=car&locale=fr&calc_points=false&key=LijBPDQGfu7Iiq80ebFCtWMuznIlArMPjQALgdAb83w`;
        const res4 = await fetch(url4, { signal: controller4.signal });
        clearTimeout(timer4);
        if (res4.ok) {
          const json4 = await res4.json();
          const path = json4?.paths?.[0];
          if (path) {
            setOrsResult({
              distanceKm: parseFloat((path.distance / 1000).toFixed(2)),
              dureeS: Math.round(path.time / 1000),
            });
            setCalcLoading(false);
            return;
          }
        }
      } catch {
        // abandon
      }

      setCalcLoading(false);
    };

    fetchOsrm();
  }, [fromCoord, toCoord]);

  // ── Géolocalisation départ (navigateur client) ───────────────────────────
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non disponible");
      return;
    }
    setGeolocLoading(true);

    const applyPosition = async (lat: number, lng: number) => {
      let adresse = await reverseGeocode(lat, lng).catch(() => null);
      if (!adresse) {
        const fallback = await searchAddress(`${lat}, ${lng}`, 1).catch(() => []);
        adresse = fallback[0]?.label ?? null;
      }
      set("depart", adresse ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setFromCoord([lat, lng]);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.depart;
        return next;
      });
      toast.success(t("res.geo.btn") + " ✓");
      setGeolocLoading(false);
    };

    const rejectAutoPosition = (message: string) => {
      setGeolocLoading(false);
      setFromCoord(null);
      setErrors((prev) => ({ ...prev, depart: message }));
      toast.error(message);
    };

    const geoErrorMessage = (err?: GeolocationPositionError) =>
      err?.code === 1
        ? "Autorisation GPS refusée par le téléphone ou le navigateur. Activez la localisation pour ce site, ou saisissez l’adresse exacte."
        : err?.code === 2
          ? "Signal GPS indisponible. Saisissez l’adresse exacte de départ."
          : "GPS trop long à répondre. Saisissez l’adresse exacte de départ.";

    (async () => {
      try {
        const precise = await requestBrowserPosition({
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 18000,
        });
        const reason = getAutoGeoRejectionReason(precise);
        if (reason) {
          rejectAutoPosition(reason);
          return;
        }
        await applyPosition(precise.coords.latitude, precise.coords.longitude);
      } catch (firstErr) {
        try {
          const cached = await requestBrowserPosition({
            enableHighAccuracy: false,
            maximumAge: 120000,
            timeout: 8000,
          });
          const reason = getAutoGeoRejectionReason(cached);
          if (reason) {
            rejectAutoPosition(reason);
            return;
          }
          await applyPosition(cached.coords.latitude, cached.coords.longitude);
        } catch (secondErr) {
          const err = (secondErr || firstErr) as GeolocationPositionError;
          rejectAutoPosition(geoErrorMessage(err));
        }
      }
    })();
  }, []);

  // ── Résoudre adresse départ (saisie manuelle) ────────────────────────────
  const resolveDepartAddress = useCallback(async () => {
    const value = f.depart.trim();
    if (!value) return;
    setCalcLoading(true);
    const result = await geocodeFullAddress(value);
    setCalcLoading(false);
    if (result) {
      setFromCoord(result.coord);
      set("depart", result.label);
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

    // Si le départ est saisi mais fromCoord pas encore résolu (l'utilisateur
    // a sauté directement au champ destination avant que resolveDepartAddress finisse),
    // on le résout maintenant nous-mêmes pour avoir un fromCoord à jour.
    let resolvedFromCoord = fromCoord;
    if (f.depart.trim() && !fromCoord) {
      const departResult = await geocodeFullAddress(f.depart.trim());
      if (departResult) {
        resolvedFromCoord = departResult.coord;
        setFromCoord(departResult.coord);
        set("depart", departResult.label);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.depart;
          return next;
        });
      }
    }

    const origin = resolvedFromCoord ?? BORDEAUX_CENTER;

    // 1) On tente geocodeFullAddress en priorité (rapide, Nominatim)
    const result = await geocodeFullAddress(value);
    if (result) {
      setCalcLoading(false);
      setDestinationChoices([]);
      setToCoord(result.coord);
      set("destination", result.label);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.destination;
        return next;
      });
      return; // trouvé → pas besoin de chercher plus loin
    }

    // 2) Fallback : recherche élargie (Photon + Overpass + variantes Nominatim)
    const nearbyChoices = await searchNearbyAddressChoices(
      value,
      origin,
      DESTINATION_SEARCH_RADIUS_KM,
    );
    setCalcLoading(false);

    if (nearbyChoices.length) {
      setDestinationChoices(nearbyChoices);
      setToCoord(null);
      setErrors((prev) => ({
        ...prev,
        destination: "Sélectionnez une adresse dans la liste",
      }));
    } else {
      setDestinationChoices([]);
      setToCoord(null);
      setErrors((prev) => ({
        ...prev,
        destination: "Adresse introuvable — précisez la ville ou le lieu",
      }));
    }
  }, [f.destination, f.depart, fromCoord]);

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
    // Ne tente l'abonnement automatique QUE si la permission est déjà accordée.
    // La première demande passe par le bouton 🔔 (geste utilisateur requis par Chrome/Safari).
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;
    if (Notification.permission !== "granted") return;

    const registerPush = async () => {
      try {
        const token = await getFcmToken();
        if (!token) return;
        await Promise.all([
          subscribePush({
            data: { audience: "client", fcm_token: token, user_agent: navigator.userAgent },
          }),
          subscribePush({
            data: {
              audience: "chauffeur",
              fcm_token: token,
              reservation_id: null,
              user_agent: navigator.userAgent,
            },
          }),
        ]);
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
    if (!f.date.trim()) newErrors.date = t("res.err.required");
    if (!f.heure.trim()) newErrors.heure = t("res.err.required");
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(t("res.err.required"));
      return;
    }

    // Fallback distance si OSRM indisponible : haversine × 1.3 (évite de bloquer la résa)
    let distanceKm = orsResult?.distanceKm ?? 0;
    let dureeS = orsResult?.dureeS ?? 0;
    if (!orsResult && fromCoord && toCoord) {
      const R = 6371;
      const dLat = ((toCoord[0] - fromCoord[0]) * Math.PI) / 180;
      const dLng = ((toCoord[1] - fromCoord[1]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((fromCoord[0] * Math.PI) / 180) *
          Math.cos((toCoord[0] * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      distanceKm = parseFloat(
        (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3).toFixed(2),
      );
      dureeS = Math.round((distanceKm / 30) * 3600); // ~30 km/h en ville
      toast.warning(
        "Distance estimée (GPS indisponible) — le prix peut être ajusté par le chauffeur.",
      );
    }

    setSending(true);

    try {
      const suiviId = newSuiviId();

      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickupIsoFinal =
        f.date && f.heure ? toParisIso(f.date, f.heure) : new Date().toISOString();

      const { data: inserted, error } = await supabase
        .from("reservations")
        .insert({
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
          distance_km: distanceKm,
          nb_passagers: f.passagers,
          bagages: f.bagages,
          paiement: f.paiement,
          tarif_jour: tarifJour,
          prix_estime: pickupIso
            ? calculerPrixMixteLocal(distanceKm, new Date(pickupIso).getTime(), dureeS)
            : prixAller,
          source: "form",
          lang: lang as any,
        })
        .select("id")
        .single();

      if (error) throw error;

      // ── Abonnement push client avec le vrai reservation_id ─────────────────
      // Sans ça, notifyReservationStatus ne trouve aucun abonné "client" pour cette résa.
      try {
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          "serviceWorker" in navigator &&
          "PushManager" in window
        ) {
          const perm =
            Notification.permission === "granted"
              ? "granted"
              : await Notification.requestPermission();
          if (perm === "granted") {
            const token = await getFcmToken();
            if (token) {
              await subscribePush({
                data: {
                  audience: "client",
                  fcm_token: token,
                  reservation_id: inserted.id,
                  user_agent: navigator.userAgent.slice(0, 500),
                },
              });
            }
          }
        }
      } catch (pushErr) {
        console.warn("[push] client subscribe failed", pushErr);
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
                background:
                  taxiAvailable === false
                    ? "#ef4444"
                    : taxiAvailable === true
                      ? "#22c55e"
                      : "#94a3b8",
                animation: taxiAvailable !== null ? "pulse 1.8s ease-in-out infinite" : "none",
              }}
            />
            {taxiAvailable !== null && (
              <div
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  background:
                    taxiAvailable === false ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)",
                  animation: "pulse 1.8s ease-in-out infinite",
                }}
              />
            )}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color:
                taxiAvailable === false
                  ? "#fca5a5"
                  : taxiAvailable === true
                    ? "#86efac"
                    : "#94a3b8",
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
            <span style={{ fontSize: 12, fontWeight: 600, color: "#f5c842" }}>
              {t("rsim.loading")}
            </span>
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
        <div
          style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}
        >
          <div
            style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9 }}
          />
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
          {/* ── En-tête : retour + titre + langue + notifs ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Ligne 1 : bouton retour ← et bouton notifs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <button
                onClick={() => navigate({ to: "/" })}
                aria-label="Retour au site"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#f8fafc",
                  borderRadius: 99,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ← Retour
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Bouton notifications push — toujours visible, 3 états */}
                {typeof window !== "undefined" && "Notification" in window && (
                  <button
                    onClick={async () => {
                      if (notifPermission === "denied" || notifPermission === "granted") return;
                      const perm = await Notification.requestPermission();
                      setNotifPermission(perm);
                      if (perm === "granted") {
                        try {
                          const token = await getFcmToken();
                          if (token) {
                            await Promise.all([
                              subscribePush({
                                data: {
                                  audience: "client",
                                  fcm_token: token,
                                  user_agent: navigator.userAgent,
                                },
                              }),
                              subscribePush({
                                data: {
                                  audience: "chauffeur",
                                  fcm_token: token,
                                  reservation_id: null,
                                  user_agent: navigator.userAgent,
                                },
                              }),
                            ]);
                            localStorage.setItem("fcm_token", token);
                          }
                        } catch {
                          // silencieux
                        }
                      }
                    }}
                    disabled={notifPermission === "denied"}
                    title={
                      notifPermission === "denied"
                        ? "Notifications bloquées — autorisez dans les réglages du navigateur"
                        : notifPermission === "granted"
                          ? "Notifications activées ✓"
                          : "Recevoir une confirmation et un suivi par notification"
                    }
                    style={{
                      background:
                        notifPermission === "denied"
                          ? "rgba(239,68,68,0.15)"
                          : notifPermission === "granted"
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(245,200,66,0.15)",
                      border: `1px solid ${
                        notifPermission === "denied"
                          ? "rgba(239,68,68,0.4)"
                          : notifPermission === "granted"
                            ? "rgba(34,197,94,0.4)"
                            : "rgba(245,200,66,0.4)"
                      }`,
                      color:
                        notifPermission === "denied"
                          ? "#f87171"
                          : notifPermission === "granted"
                            ? "#86efac"
                            : "#f5c842",
                      borderRadius: 99,
                      padding: "7px 13px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: notifPermission === "default" ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {notifPermission === "denied"
                      ? "🔕 Bloquées"
                      : notifPermission === "granted"
                        ? "🔔 Activées"
                        : "🔔 Notifs"}
                  </button>
                )}

                {/* Sélecteur de langue */}
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
                    <option
                      key={l.code}
                      value={l.code}
                      style={{ background: "#1e3a8a", color: "#f5f5f5" }}
                    >
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ligne 2 : titre + sous-titre */}
            <div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#f5f5f5",
                  fontFamily: "'Clash Display'",
                }}
              >
                {t("res.title")}
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>{t("res.intro")}</div>
            </div>
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
                <div style={{ fontSize: 12, color: "#fecaca", lineHeight: 1.4 }}>
                  {t("taxi.banner.busy.desc")}
                </div>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: "#86efac" }}>
                {t("taxi.banner.available.msg")}
              </div>
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
                      style={{
                        fontSize: 11,
                        color: "#cbd5e1",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: 6,
                      }}
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
                    {errors[k] && (
                      <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>
                        {errors[k]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {[
                  {
                    k: "phone" as const,
                    label: t("res.loc.phone"),
                    ph: "06 12 34 56 78",
                    type: "tel",
                  },
                  {
                    k: "email" as const,
                    label: t("res.loc.email"),
                    ph: "jean@exemple.fr",
                    type: "email",
                  },
                ].map(({ k, label, ph, type }) => (
                  <div key={k}>
                    <label
                      style={{
                        fontSize: 11,
                        color: "#cbd5e1",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: 6,
                      }}
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
                    {errors[k] && (
                      <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>
                        {errors[k]}
                      </div>
                    )}
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
                <label
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
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
                {errors.depart && (
                  <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>
                    {errors.depart}
                  </div>
                )}
                {fromCoord && !errors.depart && (
                  <div style={{ color: "#86efac", fontSize: 11, marginTop: 4 }}>
                    ✓ {t("res.geo.btn")}
                  </div>
                )}
              </div>

              {/* Destination */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    color: "#cbd5e1",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  {t("res.loc.to")}
                </label>
                <input
                  type="text"
                  value={f.destination}
                  onChange={(e) => {
                    set("destination", e.target.value);
                    setToCoord(null);
                    setDestinationChoices([]);
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
                  <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>
                    {errors.destination}
                  </div>
                )}
                {destinationChoices.length > 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {destinationChoices.map((choice) => (
                      <button
                        key={`${choice.label}-${choice.coord[0]}-${choice.coord[1]}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          set("destination", choice.label);
                          setToCoord(choice.coord);
                          setDestinationChoices([]);
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.destination;
                            return next;
                          });
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(245,200,66,0.35)",
                          background: "rgba(245,200,66,0.1)",
                          color: "#f8fafc",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>
                          {choice.label}
                        </span>
                        <span
                          style={{ display: "block", fontSize: 11, color: "#fde68a", marginTop: 2 }}
                        >
                          à {choice.distanceKm.toFixed(1)} km du départ
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {toCoord && !errors.destination && (
                  <div style={{ color: "#86efac", fontSize: 11, marginTop: 4 }}>
                    ✓ {t("res.loc.to")}
                  </div>
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
                    <div
                      style={{
                        fontSize: 11,
                        color: tarifJour ? "#fbbf24" : "#818cf8",
                        marginTop: 2,
                        fontWeight: 600,
                      }}
                    >
                      {tarifJour
                        ? "☀️ Tarif jour (7h-19h)"
                        : "🌙 Tarif nuit (19h-7h / dim. / férié)"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 2 }}>
                      {t("rsim.estimate")}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "#f5c842",
                        fontFamily: "'Clash Display'",
                      }}
                    >
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
                  <label
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    {t("res.loc.date_label")}
                  </label>
                  <input
                    type="date"
                    value={f.date}
                    onChange={(e) => set("date", e.target.value)}
                    min={today}
                    style={inputStyle(!!errors.date)}
                  />
                  {errors.date && (
                    <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>
                      {errors.date}
                    </div>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    {t("res.loc.time_label")}
                  </label>
                  <input
                    type="time"
                    value={f.heure}
                    onChange={(e) => set("heure", e.target.value)}
                    style={inputStyle(!!errors.heure)}
                  />
                  {errors.heure && (
                    <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>
                      {errors.heure}
                    </div>
                  )}
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
                  <label
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
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
                  <label
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
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
              <label
                style={{
                  fontSize: 11,
                  color: "#cbd5e1",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {t("res.loc.payment_section")}
              </label>
              <select
                value={f.paiement}
                onChange={(e) => set("paiement", e.target.value)}
                style={inputStyle()}
              >
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
