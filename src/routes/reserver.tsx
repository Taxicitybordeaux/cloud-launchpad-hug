import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  calculerPrix,
  calculerPrixMixte,
  PRISE_EN_CHARGE,
  estTarifJourParis,
  estJourFerieFR,
  partsParis,
} from "@/lib/tarif";
import { reverseGeocode, searchAddress } from "@/lib/geocode";
import { getDistanceAndDurationKm, getLongestRoute } from "@/lib/osrm";
import { newSuiviId } from "@/lib/suivi-id";
import { subscribePush, notifyNewReservation } from "@/lib/push.functions";
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
const DESTINATION_SEARCH_RADIUS_KM = 50;
const NAMED_PLACE_REGEX =
  /aeroport|airport|gare|station|hopital|clinique|universite|fac|campus|centre commercial|centre|stade|mairie|hotel de ville|prefecture|sous prefecture|eglise|cathedrale|basilique|chateau|lycee|college|ecole|musee|theatre|opera|cinema|parc|jardin|plage|port|marina|zoo|monument|lieu dit|lieu-dit|supermarche|hypermarche|supermarket|magasin|commerce|marche|carrefour|leclerc|lidl|aldi|auchan|intermarche|super u|hyper u|casino|monoprix|franprix|biocoop|grand frais|picard|decathlon|ikea|fnac|darty|leroy merlin|castorama|brico|mcdo|mcdonald|kfc|burger king|quick|subway|starbucks|pizza/i;
function isNamedPlaceQuery(value: string): boolean {
  return NAMED_PLACE_REGEX.test(normalizeAddressText(value));
}
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
  const skipWords = /gironde|nouvelle-aquitaine|aquitaine|france|métropolitaine|metropolitaine|^\d{5}$/i;
  const kept = parts.filter((p) => !skipWords.test(p));
  return kept.slice(0, 2).join(", ");
}

function expandAbbreviations(value: string): string {
  return value
    .replace(/\bst\b/gi, "Saint")
    .replace(/\bste\b/gi, "Sainte")
    .replace(/\bav\b/gi, "Avenue")
    .replace(/\bbd\b/gi, "Boulevard")
    .replace(/\bpl\b/gi, "Place");
}

async function geocodeFullAddress(address: string): Promise<{ coord: [number, number]; label: string } | null> {
  const trimmed = expandAbbreviations(address.trim());
  const normalized = normalizeAddressText(trimmed);
  // Court-circuit : si la requête correspond à un lieu canonique connu, on
  // renvoie directement ses coordonnées vérifiées (évite les mauvaises adresses Nominatim).
  const canonical = CANONICAL_PLACES.find((p) => p.match.test(normalized));
  if (canonical) {
    return { coord: canonical.coord, label: canonical.label };
  }
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
  return normalizeAddressText(expandAbbreviations(query))
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

async function searchPhotonAddress(query: string, origin: [number, number]): Promise<AddressChoice[]> {
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
        const label = [props.name, props.street, props.postcode, props.city || props.county].filter(Boolean).join(", ");
        const coord: [number, number] = [Number(coords[1]), Number(coords[0])];
        if (!label || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return null;
        return { label: shortLabel(label), coord, distanceKm: distanceKmBetween(origin, coord) };
      })
      .filter(Boolean) as AddressChoice[];
  } catch {
    return [];
  }
}

// ─── Configuration des résultats ────────────────────────────────────────────
// Nombre max de suggestions affichées (top N). Configurable selon contexte.
const MAX_CHOICES_DEFAULT = 4;
const MAX_CHOICES_SUPERMARKET = 5; // un peu plus pour comparer plusieurs magasins
const SUPERMARKET_RADIUS_KM = 15;  // on resserre pour éviter les magasins trop loin
const SUPERMARKET_MAX_DISTANCE_KM = 25;

// Marques de supermarchés courantes — utilisées pour filtrer Overpass par catégorie
// (shop=supermarket) et éliminer les POIs sans rapport (école qui contient « lidl » dans un texte, etc.)
const SUPERMARKET_BRANDS = [
  "aldi", "lidl", "carrefour", "leclerc", "auchan", "intermarche", "intermarché",
  "super u", "hyper u", "u express", "casino", "monoprix", "franprix", "biocoop",
  "grand frais", "picard", "spar", "g20", "netto", "cora", "match", "colruyt",
];

function detectSupermarketBrand(query: string): string | null {
  const n = normalizeAddressText(query);
  for (const brand of SUPERMARKET_BRANDS) {
    const nb = normalizeAddressText(brand);
    if (n.includes(nb)) return nb;
  }
  return null;
}

async function searchOverpassPois(query: string, origin: [number, number], radiusKm: number): Promise<AddressChoice[]> {
  const token = usefulSearchTokens(query)[0];
  if (!token) return [];
  const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brand = detectSupermarketBrand(query);
  // Pour les supermarchés, on resserre le rayon pour éviter les magasins trop éloignés
  const effectiveRadiusKm = brand ? Math.min(radiusKm, SUPERMARKET_RADIUS_KM) : radiusKm;
  const radiusM = Math.round(effectiveRadiusKm * 1000);
  // Pour les supermarchés, on filtre strictement par catégorie shop=supermarket
  // ET par brand/name correspondant au mot-clé → résultats vraiment pertinents.
  const safeBrand = brand ? brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null;
  const body = brand
    ? `[out:json][timeout:6];(
node(around:${radiusM},${origin[0]},${origin[1]})["shop"="supermarket"]["brand"~"${safeBrand}",i];
node(around:${radiusM},${origin[0]},${origin[1]})["shop"="supermarket"]["name"~"${safeBrand}",i];
way(around:${radiusM},${origin[0]},${origin[1]})["shop"="supermarket"]["brand"~"${safeBrand}",i];
way(around:${radiusM},${origin[0]},${origin[1]})["shop"="supermarket"]["name"~"${safeBrand}",i];
);out center tags 15;`
    : `[out:json][timeout:6];(
node(around:${radiusM},${origin[0]},${origin[1]})["name"~"${safeToken}",i];
way(around:${radiusM},${origin[0]},${origin[1]})["name"~"${safeToken}",i];
);out center tags 15;`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.elements)) return [];
    type Raw = { name: string; brand: string; shop: string; street: string; lat: number; lng: number; distanceKm: number };
    const raws: Raw[] = data.elements
      .map((item: any): Raw | null => {
        const lat = Number(item.lat ?? item.center?.lat);
        const lng = Number(item.lon ?? item.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const tags = item.tags ?? {};
        const rawBrand = String(tags.brand ?? "").trim();
        const rawName = String(tags.name ?? rawBrand).trim();
        const shop = String(tags.shop ?? "").trim();
        if (!rawName) return null;
        const streetParts = [
          tags["addr:housenumber"] && tags["addr:street"]
            ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
            : tags["addr:street"],
          tags["addr:postcode"],
          tags["addr:city"],
        ].filter(Boolean);
        const street = streetParts.join(", ");
        const coord: [number, number] = [lat, lng];
        return { name: rawName, brand: rawBrand, shop, street, lat, lng, distanceKm: distanceKmBetween(origin, coord) };
      })
      .filter(Boolean) as Raw[];

    // Filtrage strict supermarchés : exige shop=supermarket ET (brand OU name) matchant la marque,
    // limite stricte de distance pour éviter les résultats hors zone pertinente.
    let filtered = raws;
    if (brand) {
      const nb = brand;
      filtered = raws.filter((r) => {
        if (r.shop !== "supermarket") return false;
        if (r.distanceKm > SUPERMARKET_MAX_DISTANCE_KM) return false;
        const matchBrand = normalizeAddressText(r.brand).includes(nb);
        const matchName = normalizeAddressText(r.name).includes(nb);
        return matchBrand || matchName;
      });
    }

    // Tri par distance, top N strict (5 pour supermarchés, 6 sinon pour permettre dedupe ensuite)
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
    const topN = brand ? MAX_CHOICES_SUPERMARKET : 6;
    const top = filtered.slice(0, topN);

    // Enrichissement parallèle : pour les POIs sans rue, on récupère l'adresse via reverse geocoding
    const enriched = await Promise.all(
      top.map(async (r) => {
        let address = r.street;
        if (!address) {
          const rev = await reverseGeocode(r.lat, r.lng).catch(() => null);
          if (rev) address = rev;
        }
        // Nom propre : on préfère brand (« Aldi ») au name technique (« Aldi 9 »),
        // sinon on retire un suffixe purement numérique trompeur.
        const cleanName = (r.brand || r.name.replace(/\s+\d+\s*$/, "")).trim() || r.name;
        const label = address ? `${cleanName} — ${address}` : cleanName;
        return {
          label: shortLabel(label),
          coord: [r.lat, r.lng] as [number, number],
          distanceKm: r.distanceKm,
        } as AddressChoice;
      })
    );
    // On filtre les POIs sans aucune adresse identifiable (trop ambigus)
    return enriched.filter((c) => c.label.includes("—") || c.label.includes(","));
  } catch {
    return [];
  }
}

// Lieux canoniques (coordonnées vérifiées) — utilisés en priorité absolue
// quand la requête correspond, pour éviter les mauvaises adresses Nominatim/Overpass.
const CANONICAL_PLACES: Array<{
  match: RegExp;
  label: string;
  coord: [number, number]; // [lat, lng]
}> = [
  {
    match: /(aeroport|airport).*(bordeaux|merignac|bod)|^bod$|merignac.*(aeroport|airport)/,
    label: "Aéroport de Bordeaux-Mérignac (Terminal), 33700 Mérignac",
    coord: [44.8283, -0.7156],
  },
  {
    match: /gare.*(saint.jean|st.jean|bordeaux)|bordeaux.*(saint.jean|st.jean).*gare|gare.*bordeaux/,
    label: "Gare de Bordeaux-Saint-Jean, Rue Charles Domercq, 33800 Bordeaux",
    coord: [44.8259, -0.5564],
  },
  {
    match: /place.*(quinconces|kinconce)/,
    label: "Place des Quinconces, 33000 Bordeaux",
    coord: [44.8444, -0.5739],
  },
  {
    match: /(matmut|stade.*atlantique|stade.*bordeaux)/,
    label: "Matmut Atlantique, Cours Jules Ladoumègue, 33300 Bordeaux",
    coord: [44.8959, -0.5614],
  },
  {
    match: /cite.*du.*vin|cité.*du.*vin/,
    label: "La Cité du Vin, Esplanade de Pontac, 33300 Bordeaux",
    coord: [44.8627, -0.5505],
  },
];

function findCanonicalPlace(query: string, origin: [number, number]): AddressChoice | null {
  const n = normalizeAddressText(expandAbbreviations(query));
  for (const p of CANONICAL_PLACES) {
    if (p.match.test(n)) {
      return { label: p.label, coord: p.coord, distanceKm: distanceKmBetween(origin, p.coord) };
    }
  }
  return null;
}

// ─── Cache des recherches récentes (5 min, par requête + origine arrondie) ───
type CachedChoices = { ts: number; choices: AddressChoice[] };
const CHOICES_CACHE = new Map<string, CachedChoices>();
const CHOICES_CACHE_TTL_MS = 5 * 60 * 1000;
const CHOICES_CACHE_MAX = 80;

function buildCacheKey(query: string, origin: [number, number], radiusKm: number): string {
  return `${normalizeAddressText(query)}|${origin[0].toFixed(2)},${origin[1].toFixed(2)}|${radiusKm}`;
}
function readCache(key: string): AddressChoice[] | null {
  const hit = CHOICES_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CHOICES_CACHE_TTL_MS) {
    CHOICES_CACHE.delete(key);
    return null;
  }
  return hit.choices;
}
function writeCache(key: string, choices: AddressChoice[]) {
  if (CHOICES_CACHE.size >= CHOICES_CACHE_MAX) {
    const oldest = CHOICES_CACHE.keys().next().value;
    if (oldest) CHOICES_CACHE.delete(oldest);
  }
  CHOICES_CACHE.set(key, { ts: Date.now(), choices });
}

function rankAndTrim(
  query: string,
  origin: [number, number],
  buckets: AddressChoice[],
  canonical: AddressChoice | null,
  maxChoices: number = MAX_CHOICES_DEFAULT,
): AddressChoice[] {
  const tokens = usefulSearchTokens(query);
  const brand = detectSupermarketBrand(query);
  let pool = dedupeAddressChoices([...(canonical ? [canonical] : []), ...buckets])
    .filter((choice) => isPlausibleAddressMatch(query, choice.label));

  if (brand) {
    // Filtrage strict supermarchés : on ne garde que les libellés dont le NOM (avant " — ")
    // commence par la marque. Cela écarte les rues/lieux contenant le mot par hasard
    // (« Rue Aldi », école « Lidl Center », etc.) renvoyés par Nominatim/Photon.
    const nb = brand;
    pool = pool.filter((choice) => {
      const head = normalizeAddressText(choice.label.split("—")[0] ?? choice.label);
      return head.startsWith(nb) || head.split(" ").slice(0, 3).join(" ").includes(nb);
    });
    // Limite stricte de distance pour supermarchés
    pool = pool.filter((c) => c.distanceKm <= SUPERMARKET_MAX_DISTANCE_KM);
  }

  const all = pool.sort((a, b) => {
    const aLabel = normalizeAddressText(a.label);
    const bLabel = normalizeAddressText(b.label);
    const aHits = tokens.filter((token) => aLabel.includes(token)).length;
    const bHits = tokens.filter((token) => bLabel.includes(token)).length;
    const aBucket = Math.round(a.distanceKm / 2);
    const bBucket = Math.round(b.distanceKm / 2);
    return aBucket - bBucket || bHits - aHits || a.distanceKm - b.distanceKm;
  });

  const limit = brand ? Math.min(maxChoices, MAX_CHOICES_SUPERMARKET) : maxChoices;
  if (canonical) {
    const others = all.filter((c) => c.label !== canonical.label);
    return [canonical, ...others].slice(0, limit);
  }
  return all.slice(0, limit);
}

async function searchNearbyAddressChoices(
  query: string,
  origin: [number, number],
  radiusKm = 20,
): Promise<AddressChoice[]> {
  const key = buildCacheKey(query, origin, radiusKm);
  const cached = readCache(key);
  if (cached) return cached;

  const normalizedQ = normalizeAddressText(query);
  const extraVariants: string[] = [];
  if (/aeroport|airport/.test(normalizedQ) && /bordeaux|merignac|bod/.test(normalizedQ)) {
    extraVariants.push("Aéroport de Bordeaux-Mérignac", "Bordeaux-Mérignac Airport", "BOD Bordeaux");
  }
  if (/gare|saint.jean|st.jean/.test(normalizedQ)) {
    extraVariants.push("Gare de Bordeaux-Saint-Jean", "Gare Saint Jean Bordeaux", "Bordeaux Saint-Jean");
  }
  const variants = [...new Set([query, `${query}, Gironde`, ...extraVariants])];
  const [nominatimGroups, photonChoices, overpassChoices] = await Promise.all([
    Promise.all(variants.map((v) => searchAddress(v, 6).catch(() => []))),
    searchPhotonAddress(query, origin),
    searchOverpassPois(query, origin, radiusKm),
  ]);
  const nominatimChoices = nominatimGroups.flat().map((item) => ({
    label: shortLabel(item.label),
    coord: item.coord,
    distanceKm: distanceKmBetween(origin, item.coord),
  }));
  const canonical = findCanonicalPlace(query, origin);
  const result = rankAndTrim(query, origin, [...nominatimChoices, ...photonChoices, ...overpassChoices], canonical);
  writeCache(key, result);
  return result;
}

// Version streaming : appelle onPartial dès qu'une source répond (canonical → photon → overpass → nominatim),
// pour afficher les premiers matches sans attendre que tout soit terminé.
async function searchNearbyAddressChoicesStreaming(
  query: string,
  origin: [number, number],
  radiusKm: number,
  onPartial: (choices: AddressChoice[], done: boolean) => void,
): Promise<AddressChoice[]> {
  const key = buildCacheKey(query, origin, radiusKm);
  const cached = readCache(key);
  if (cached) {
    onPartial(cached, true);
    return cached;
  }

  const canonical = findCanonicalPlace(query, origin);
  let nominatim: AddressChoice[] = [];
  let photon: AddressChoice[] = [];
  let overpass: AddressChoice[] = [];

  const emit = (done: boolean) => {
    onPartial(rankAndTrim(query, origin, [...nominatim, ...photon, ...overpass], canonical), done);
  };

  // 0) Canonical immédiat
  if (canonical) emit(false);

  const normalizedQ = normalizeAddressText(query);
  const extraVariants: string[] = [];
  if (/aeroport|airport/.test(normalizedQ) && /bordeaux|merignac|bod/.test(normalizedQ)) {
    extraVariants.push("Aéroport de Bordeaux-Mérignac", "Bordeaux-Mérignac Airport", "BOD Bordeaux");
  }
  if (/gare|saint.jean|st.jean/.test(normalizedQ)) {
    extraVariants.push("Gare de Bordeaux-Saint-Jean", "Gare Saint Jean Bordeaux", "Bordeaux Saint-Jean");
  }
  const variants = [...new Set([query, `${query}, Gironde`, ...extraVariants])];

  const pPhoton = searchPhotonAddress(query, origin).then((r) => {
    photon = r;
    emit(false);
  });
  const pOverpass = searchOverpassPois(query, origin, radiusKm).then((r) => {
    overpass = r;
    emit(false);
  });
  const pNominatim = Promise.all(variants.map((v) => searchAddress(v, 6).catch(() => []))).then((groups) => {
    nominatim = groups.flat().map((item) => ({
      label: shortLabel(item.label),
      coord: item.coord,
      distanceKm: distanceKmBetween(origin, item.coord),
    }));
    emit(false);
  });

  await Promise.allSettled([pPhoton, pOverpass, pNominatim]);
  const result = rankAndTrim(query, origin, [...nominatim, ...photon, ...overpass], canonical);
  writeCache(key, result);
  onPartial(result, true);
  return result;
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

// ─── OSRM polyline : utilise getLongestRoute (cache + alternatives=3 partagé)
async function getOsrmPolylineLongest(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  const r = await getLongestRoute(from, to);
  return r.coords;
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
  const [departChoices, setDepartChoices] = useState<AddressChoice[]>([]);
  const [searchingDepart, setSearchingDepart] = useState(false);
  const [searchingDestination, setSearchingDestination] = useState(false);
  const departDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchMode, setSearchMode] = useState<"address" | "poi">("address");
  const [departSearchMode, setDepartSearchMode] = useState<"address" | "poi">("address");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceBothListening, setVoiceBothListening] = useState(false);
  const voiceRecogRef = useRef<any>(null);
  const voiceBothRecogRef = useRef<any>(null);
  const resolveDestinationAddressRef = useRef<(() => void) | null>(null);
  const resolveDepartAddressRef = useRef<(() => void) | null>(null);

  const startVoiceRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("La reconnaissance vocale n'est pas supportée par ce navigateur.");
      return;
    }
    if (voiceRecogRef.current) {
      voiceRecogRef.current.stop();
      voiceRecogRef.current = null;
      setVoiceListening(false);
      return;
    }
    const recog = new SR();
    recog.lang = "fr-FR";
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onstart = () => setVoiceListening(true);
    recog.onend = () => {
      setVoiceListening(false);
      voiceRecogRef.current = null;
    };
    recog.onerror = () => {
      setVoiceListening(false);
      voiceRecogRef.current = null;
    };
    recog.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      set("destination", transcript);
      setToCoord(null);
      setDestinationChoices([]);
      // Déclencher la résolution d'adresse après un court délai
      setTimeout(() => resolveDestinationAddressRef.current?.(), 300);
    };
    voiceRecogRef.current = recog;
    recog.start();
  }, []);

  // Reconnaissance vocale "départ + destination" en une seule phrase.
  // Détecte des séparateurs courants : "à", "vers", "jusqu'à", "destination",
  // "direction", "puis", "et", "->".
  const startVoiceRecognitionBoth = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("La reconnaissance vocale n'est pas supportée par ce navigateur.");
      return;
    }
    if (voiceBothRecogRef.current) {
      voiceBothRecogRef.current.stop();
      voiceBothRecogRef.current = null;
      setVoiceBothListening(false);
      return;
    }
    const recog = new SR();
    recog.lang = "fr-FR";
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onstart = () => setVoiceBothListening(true);
    recog.onend = () => {
      setVoiceBothListening(false);
      voiceBothRecogRef.current = null;
    };
    recog.onerror = () => {
      setVoiceBothListening(false);
      voiceBothRecogRef.current = null;
    };
    recog.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      // Sépare via mots-clés. On enlève "de"/"depuis" initial éventuel.
      const cleaned = transcript
        .trim()
        .replace(/^\s*(de|depuis|du|d'|partir de|départ)\s+/i, "");
      const splitRegex =
        /\s+(?:jusqu'?[àa]|jusque?|destination|direction|vers|puis|->|=>|à destination de|à\s+(?=[A-ZÀ-Ÿ]))\s+/i;
      const parts = cleaned.split(splitRegex);
      let depart = "";
      let destination = "";
      if (parts.length >= 2) {
        depart = parts[0].trim();
        destination = parts.slice(1).join(" ").trim();
      } else {
        // fallback : tente " à " simple
        const idx = cleaned.toLowerCase().lastIndexOf(" à ");
        if (idx > 0) {
          depart = cleaned.slice(0, idx).trim();
          destination = cleaned.slice(idx + 3).trim();
        } else {
          // pas de séparateur trouvé → on met tout en destination
          destination = cleaned;
        }
      }
      if (depart) {
        set("depart", depart);
        setFromCoord(null);
        setDepartChoices([]);
      }
      if (destination) {
        set("destination", destination);
        setToCoord(null);
        setDestinationChoices([]);
      }
      // Résolution séquentielle : départ d'abord (sert d'origine), puis destination.
      setTimeout(() => {
        if (depart) resolveDepartAddressRef.current?.();
        setTimeout(() => resolveDestinationAddressRef.current?.(), 600);
      }, 200);
    };
    voiceBothRecogRef.current = recog;
    recog.start();
  }, []);


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

  // ── Tarification Paris : règle unique demandée
  //    7h-19h = Jour, 19h-7h = Nuit, dimanche/jour férié = Nuit, toujours en heure Europe/Paris. ──
  function getTarifMotif(iso: string | null): { isJour: boolean; label: string; motif: string } {
    if (!iso) return { isJour: true, label: "Tarif jour", motif: "Heure de Paris" };
    const p = partsParis(iso);
    if (p.weekday === "Sun") return { isJour: false, label: "Tarif nuit", motif: "Dimanche" };
    if (estJourFerieFR(p.year, p.month, p.day)) return { isJour: false, label: "Tarif nuit", motif: "Jour férié" };
    const hStr = `${p.hour}h${String(p.minute).padStart(2, "0")}`;
    const h = p.hour + p.minute / 60;
    if (h >= 19 || h < 7) return { isJour: false, label: "Tarif nuit", motif: `Heure de Paris (${hStr})` };
    return { isJour: true, label: "Tarif jour", motif: `Heure de Paris (${hStr})` };
  }

  const TARIF_JOUR_KM = 2.16;
  const TARIF_NUIT_KM = 3.24;
  const PRISE = 2.83;

  // Détail du calcul mixte : prorata jour/nuit minute par minute.
  function detailMixte(distKm: number, pickupMs: number, dureeS: number) {
    if (distKm <= 0) {
      return { jourKm: 0, nuitKm: 0, jourMin: 0, nuitMin: 0, pctJour: 0, pctNuit: 0, total: PRISE };
    }
    const steps = Math.max(Math.round(dureeS / 60), 1);
    const stepMs = (dureeS * 1000) / steps;
    const stepMin = stepMs / 60000;
    const frac = distKm / steps;
    let jourKm = 0,
      nuitKm = 0,
      jourMin = 0,
      nuitMin = 0;
    for (let i = 0; i < steps; i++) {
      const iso = new Date(pickupMs + i * stepMs).toISOString();
      if (estTarifJourParis(iso)) {
        jourKm += frac;
        jourMin += stepMin;
      } else {
        nuitKm += frac;
        nuitMin += stepMin;
      }
    }
    const total = parseFloat((PRISE + jourKm * TARIF_JOUR_KM + nuitKm * TARIF_NUIT_KM).toFixed(2));
    const pctJour = Math.round((jourKm / distKm) * 100);
    const pctNuit = 100 - pctJour;
    return { jourKm, nuitKm, jourMin, nuitMin, pctJour, pctNuit, total };
  }

  function calculerPrixMixteLocal(distKm: number, pickupMs: number, dureeS: number): number {
    return detailMixte(distKm, pickupMs, dureeS).total;
  }

  const tarifInfo = getTarifMotif(pickupIso);
  const tarifJour = tarifInfo.isJour;

  const detailCalc =
    orsResult && pickupIso ? detailMixte(orsResult.distanceKm, new Date(pickupIso).getTime(), orsResult.dureeS) : null;

  const prixAller: number = (() => {
    if (!orsResult) return PRISE_EN_CHARGE;
    const raw = detailCalc ? detailCalc.total : calculerPrix(orsResult.distanceKm, true);
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
          // Casing noir façon Uber + tracé fin par-dessus pour un rendu net
          routeLayer.current = L.layerGroup([
            L.polyline(coords, { color: "#000000", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round" }),
            L.polyline(coords, { color: "#111111", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }),
          ]).addTo(mapInst.current);
          mapInst.current.fitBounds(
            L.latLngBounds([
              [fromCoord[0], fromCoord[1]],
              [toCoord[0], toCoord[1]],
              ...coords,
            ]),
            { padding: [60, 60], maxZoom: 16, animate: true },
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

      // Fallback GraphHopper retiré : la clé API ne peut pas être embarquée
      // côté client sans être abusée. OSRM (étapes précédentes) reste primaire.

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
    setSearchingDepart(true);
    const origin = fromCoord ?? BORDEAUX_CENTER;
    const namedPlace = departSearchMode === "poi" || isNamedPlaceQuery(value);

    const canonical = findCanonicalPlace(value, origin);
    if (canonical) {
      setCalcLoading(false);
      setSearchingDepart(false);
      setDepartChoices([]);
      setFromCoord(canonical.coord);
      set("depart", canonical.label);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.depart;
        return next;
      });
      return;
    }

    if (namedPlace) {
      const nearby = await searchNearbyAddressChoicesStreaming(
        value,
        origin,
        DESTINATION_SEARCH_RADIUS_KM,
        (partial) => {
          const close = partial.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM).slice(0, 4);
          if (close.length) setDepartChoices(close);
        },
      );
      const close = nearby.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM);
      if (close.length === 1 || (close.length > 1 && close[0].distanceKm + 5 < close[1].distanceKm)) {
        setCalcLoading(false);
        setSearchingDepart(false);
        setDepartChoices([]);
        setFromCoord(close[0].coord);
        set("depart", close[0].label);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.depart;
          return next;
        });
        return;
      }
      if (close.length > 1) {
        setCalcLoading(false);
        setSearchingDepart(false);
        setDepartChoices(close.slice(0, 4));
        setFromCoord(null);
        setErrors((prev) => ({ ...prev, depart: "Plusieurs lieux trouvés — choisissez le bon" }));
        return;
      }
    }

    const result = await geocodeFullAddress(value);
    if (result) {
      const distOk = distanceKmBetween(origin, result.coord) <= DESTINATION_SEARCH_RADIUS_KM;
      if (distOk || !fromCoord) {
        setCalcLoading(false);
        setSearchingDepart(false);
        setDepartChoices([]);
        setFromCoord(result.coord);
        set("depart", result.label);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.depart;
          return next;
        });
        return;
      }
    }

    const nearbyChoices = await searchNearbyAddressChoicesStreaming(
      value,
      origin,
      DESTINATION_SEARCH_RADIUS_KM,
      (partial) => {
        const close = partial.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM).slice(0, 4);
        if (close.length) setDepartChoices(close);
      },
    );
    const closeChoices = nearbyChoices.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM).slice(0, 4);
    setCalcLoading(false);
    setSearchingDepart(false);

    if (closeChoices.length) {
      setDepartChoices(closeChoices);
      setFromCoord(null);
      setErrors((prev) => ({ ...prev, depart: "Sélectionnez une adresse dans la liste (≤ 50 km)" }));
    } else {
      setDepartChoices([]);
      setFromCoord(null);
      setErrors((prev) => ({ ...prev, depart: "Adresse introuvable — précisez la ville ou le lieu" }));
    }
  }, [f.depart, fromCoord, departSearchMode]);

  // ── Résoudre adresse destination ─────────────────────────────────────────
  const resolveDestinationAddress = useCallback(async () => {
    const value = f.destination.trim();
    if (!value) return;
    setCalcLoading(true);
    setSearchingDestination(true);

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
    const namedPlace = searchMode === "poi" || isNamedPlaceQuery(value);

    const canonical = findCanonicalPlace(value, origin);
    if (canonical) {
      setCalcLoading(false);
      setSearchingDestination(false);
      setDestinationChoices([]);
      setToCoord(canonical.coord);
      set("destination", canonical.label);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.destination;
        return next;
      });
      return;
    }

    // Pour les lieux nommés (aéroport, gare, supermarché, monument…) ou
    // si le mode « lieu » est actif, on cherche d'abord parmi les POI
    // proches du départ pour éviter les mauvaises correspondances Nominatim.
    if (namedPlace) {
      const nearby = await searchNearbyAddressChoicesStreaming(
        value,
        origin,
        DESTINATION_SEARCH_RADIUS_KM,
        (partial) => {
          const close = partial.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM).slice(0, 4);
          if (close.length) setDestinationChoices(close);
        },
      );
      const close = nearby.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM);
      // Auto-pick si le 1er est nettement plus proche que le 2e (≤5 km, ou seul résultat)
      if (close.length === 1 || (close.length > 1 && close[0].distanceKm + 5 < close[1].distanceKm)) {
        setCalcLoading(false);
        setSearchingDestination(false);
        setDestinationChoices([]);
        setToCoord(close[0].coord);
        set("destination", close[0].label);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.destination;
          return next;
        });
        return;
      }
      if (close.length > 1) {
        setCalcLoading(false);
        setSearchingDestination(false);
        setDestinationChoices(close.slice(0, 4));
        setToCoord(null);
        setErrors((prev) => ({ ...prev, destination: "Plusieurs lieux trouvés — choisissez le bon" }));
        return;
      }
      // sinon on bascule sur Nominatim plein texte ci-dessous
    }

    // 1) Recherche Nominatim classique
    const result = await geocodeFullAddress(value);
    if (result) {
      const distOk = distanceKmBetween(origin, result.coord) <= DESTINATION_SEARCH_RADIUS_KM;
      if (distOk) {
        setCalcLoading(false);
        setSearchingDestination(false);
        setDestinationChoices([]);
        setToCoord(result.coord);
        set("destination", result.label);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.destination;
          return next;
        });
        return;
      }
      // Résultat trouvé mais trop loin → on propose des alternatives proches
    }

    // 2) Fallback : recherche élargie (Photon + Overpass + variantes Nominatim) dans 50 km
    const nearbyChoices = await searchNearbyAddressChoicesStreaming(
      value,
      origin,
      DESTINATION_SEARCH_RADIUS_KM,
      (partial) => {
        const close = partial.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM).slice(0, 4);
        if (close.length) setDestinationChoices(close);
      },
    );
    const closeChoices = nearbyChoices.filter((c) => c.distanceKm <= DESTINATION_SEARCH_RADIUS_KM).slice(0, 4);
    setCalcLoading(false);
    setSearchingDestination(false);

    if (closeChoices.length) {
      setDestinationChoices(closeChoices);
      setToCoord(null);
      setErrors((prev) => ({
        ...prev,
        destination: "Sélectionnez une adresse dans la liste (≤ 50 km)",
      }));
    } else {
      setDestinationChoices([]);
      setToCoord(null);
      setErrors((prev) => ({
        ...prev,
        destination: "Adresse introuvable — précisez la ville ou le lieu",
      }));
    }
  }, [f.destination, f.depart, fromCoord, searchMode]);

  useEffect(() => {
    resolveDestinationAddressRef.current = resolveDestinationAddress;
  }, [resolveDestinationAddress]);

  useEffect(() => {
    resolveDepartAddressRef.current = resolveDepartAddress;
  }, [resolveDepartAddress]);


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
        await subscribePush({
          data: { audience: "client", fcm_token: token, user_agent: navigator.userAgent },
        });
      } catch {
        // silencieux — pas bloquant
      }
    };
    registerPush();
  }, []);

  // ── Soumission ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return; // guard anti double-submit

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
        Math.cos((fromCoord[0] * Math.PI) / 180) * Math.cos((toCoord[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      distanceKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3).toFixed(2));
      dureeS = Math.round((distanceKm / 30) * 3600); // ~30 km/h en ville
      toast.warning("Distance estimée (GPS indisponible) — le prix peut être ajusté par le chauffeur.");
    }

    setSending(true);

    try {
      const suiviId = newSuiviId();

      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickupIsoFinal = f.date && f.heure ? toParisIso(f.date, f.heure) : new Date().toISOString();

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
        .select("id,suivi_id")
        .single();

      if (error) throw error;

      // ── Abonnement push client avec le vrai reservation_id ─────────────────
      // On n'appelle JAMAIS requestPermission() ici : le geste utilisateur est
      // consommé par le submit et les navigateurs mobiles bloquent la popup.
      // La permission doit être accordée via le bouton 🔔 avant la soumission.
      try {
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          "serviceWorker" in navigator &&
          "PushManager" in window
        ) {
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
      } catch (pushErr) {
        console.warn("[push] client subscribe failed", pushErr);
      }

      toast.success(`${t("conf.ok.title")} ${f.prenom}`);
      setSending(false);

      // ── Notifier l'admin (push FCM + email) ───────────────────────────────
      // Fire-and-forget : on n'attend pas la réponse pour ne pas bloquer la navigation.
      notifyNewReservation({ data: { reservation_id: inserted.id } }).catch((e) => {
        console.warn("[notify] admin notify failed", e);
      });

      navigate({ to: "/suivi/$id", params: { id: inserted.suivi_id ?? inserted.id } });
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
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
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
                            await subscribePush({
                              data: {
                                audience: "client",
                                fcm_token: token,
                                user_agent: navigator.userAgent,
                              },
                            });
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
                    <option key={l.code} value={l.code} style={{ background: "#1e3a8a", color: "#f5f5f5" }}>
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
                    {errors[k] && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
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
                    {errors[k] && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Adresses ── */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>
                  {t("res.loc.ride_section")}
                </div>
                <button
                  type="button"
                  onClick={startVoiceRecognitionBoth}
                  title='Dictez le trajet complet en une phrase, ex : "12 rue de la République à aéroport de Bordeaux"'
                  style={{
                    background: voiceBothListening ? "rgba(239,68,68,0.15)" : "rgba(245,200,66,0.12)",
                    border: `1px solid ${voiceBothListening ? "rgba(239,68,68,0.4)" : "rgba(245,200,66,0.4)"}`,
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    color: voiceBothListening ? "#f87171" : "#f5c842",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    animation: voiceBothListening ? "pulse 1s ease-in-out infinite" : "none",
                  }}
                >
                  {voiceBothListening ? "⏹ J'écoute…" : "🎤 Dicter départ + destination"}
                </button>
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
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 6,
                    padding: 3,
                    background: "rgba(15,23,42,0.5)",
                    border: "1px solid rgba(245,200,66,0.25)",
                    borderRadius: 10,
                    width: "fit-content",
                  }}
                  role="tablist"
                  aria-label="Mode de recherche départ"
                >
                  {([
                    { key: "address", label: "🏠 Adresse" },
                    { key: "poi", label: "📍 Lieu / POI" },
                  ] as const).map((opt) => {
                    const active = departSearchMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setDepartSearchMode(opt.key);
                          setDepartChoices([]);
                          setFromCoord(null);
                        }}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: "none",
                          background: active ? "#f5c842" : "transparent",
                          color: active ? "#0f172a" : "#cbd5e1",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={f.depart}
                    onChange={(e) => {
                      const v = e.target.value;
                      set("depart", v);
                      setFromCoord(null);
                      setDepartChoices([]);
                      if (departDebounceRef.current) clearTimeout(departDebounceRef.current);
                      if (v.trim().length >= 3) {
                        departDebounceRef.current = setTimeout(() => {
                          resolveDepartAddressRef.current?.();
                        }, 500);
                      }
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
                {searchingDepart && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: "#fde68a", fontSize: 11 }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid #fde68a", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                    Recherche en cours…
                  </div>
                )}
                {searchingDepart && departChoices.length === 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ height: 44, borderRadius: 10, background: "linear-gradient(90deg, rgba(245,200,66,0.05), rgba(245,200,66,0.15), rgba(245,200,66,0.05))", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
                    ))}
                  </div>
                )}
                {departChoices.length > 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {departChoices.map((choice) => (
                      <button
                        key={`${choice.label}-${choice.coord[0]}-${choice.coord[1]}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          set("depart", choice.label);
                          setFromCoord(choice.coord);
                          setDepartChoices([]);
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.depart;
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
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{choice.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#fde68a", marginTop: 2 }}>
                          à {choice.distanceKm.toFixed(1)} km
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Destination */}
              <div>
                <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: 6 }}>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#cbd5e1",
                      fontWeight: 600,
                      flex: 1,
                    }}
                  >
                    {t("res.loc.to")}
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      padding: 3,
                      background: "rgba(15,23,42,0.5)",
                      border: "1px solid rgba(245,200,66,0.25)",
                      borderRadius: 10,
                    }}
                    role="tablist"
                    aria-label="Mode de recherche destination"
                  >
                    {([
                      { key: "address", label: "🏠 Adresse" },
                      { key: "poi", label: "📍 Lieu / POI" },
                    ] as const).map((opt) => {
                      const autoPoi = opt.key === "poi" && searchMode === "address" && isNamedPlaceQuery(f.destination);
                      const active = searchMode === opt.key || autoPoi;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          title={
                            opt.key === "poi"
                              ? "Mode Lieu/POI : cherche gares, aéroports, supermarchés, monuments… dans un rayon de 50 km autour du départ. Cliquez sur « Adresse » pour revenir à la saisie d'une adresse postale."
                              : "Mode Adresse : géocode une adresse postale (rue, numéro, ville). Cliquez sur « Lieu / POI » pour rechercher un point d'intérêt."
                          }
                          onClick={() => {
                            setSearchMode(opt.key);
                            setDestinationChoices([]);
                            setToCoord(null);
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: active ? "#f5c842" : "transparent",
                            color: active ? "#0f172a" : "#cbd5e1",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            opacity: autoPoi ? 0.85 : 1,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {searchMode === "address" && isNamedPlaceQuery(f.destination) && (
                    <span
                      title="Le texte saisi ressemble à un lieu connu (gare, aéroport, supermarché, monument…). La recherche POI s'applique automatiquement. Pour rester en mode adresse postale, cliquez sur « 🏠 Adresse »."
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fde68a",
                        background: "rgba(245,200,66,0.12)",
                        border: "1px solid rgba(245,200,66,0.35)",
                        borderRadius: 999,
                        padding: "3px 8px",
                        cursor: "help",
                      }}
                    >
                      ✨ Lieu détecté — POI auto · cliquez 🏠 Adresse pour repasser
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={f.destination}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("destination", v);
                    setToCoord(null);
                    setDestinationChoices([]);
                    if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
                    if (v.trim().length >= 3) {
                      destinationDebounceRef.current = setTimeout(() => {
                        resolveDestinationAddressRef.current?.();
                      }, 500);
                    }
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
                {searchingDestination && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: "#fde68a", fontSize: 11 }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid #fde68a", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                    Recherche en cours…
                  </div>
                )}
                {searchingDestination && destinationChoices.length === 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ height: 44, borderRadius: 10, background: "linear-gradient(90deg, rgba(245,200,66,0.05), rgba(245,200,66,0.15), rgba(245,200,66,0.05))", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
                    ))}
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
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{choice.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#fde68a", marginTop: 2 }}>
                          à {choice.distanceKm.toFixed(1)} km du départ
                        </span>
                      </button>
                    ))}
                  </div>
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
                    <div
                      style={{
                        fontSize: 11,
                        color: tarifJour ? "#fbbf24" : "#818cf8",
                        marginTop: 2,
                        fontWeight: 600,
                      }}
                    >
                      {tarifJour ? "☀️ Tarif jour" : "🌙 Tarif nuit"}
                      <span style={{ color: "#94a3b8", fontWeight: 500, marginLeft: 6 }}>— {tarifInfo.motif}</span>
                    </div>
                    {detailCalc && detailCalc.pctJour > 0 && detailCalc.pctNuit > 0 && (
                      <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                        <span style={{ color: "#fbbf24" }}>☀️ {detailCalc.pctJour}% jour</span>
                        <span style={{ color: "#94a3b8", margin: "0 6px" }}>/</span>
                        <span style={{ color: "#818cf8" }}>🌙 {detailCalc.pctNuit}% nuit</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 2 }}>{t("rsim.estimate")}</div>
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

              {/* Détail du calcul mixte */}
              {orsResult && detailCalc && (
                <details
                  style={{
                    marginTop: 8,
                    padding: "10px 14px",
                    background: "rgba(15,23,42,0.5)",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.2)",
                    fontSize: 12,
                    color: "#cbd5e1",
                  }}
                >
                  <summary style={{ cursor: "pointer", color: "#f5c842", fontWeight: 600 }}>
                    🧮 Détail du calcul
                  </summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <div style={{ color: "#94a3b8" }}>
                      Distance totale : <b style={{ color: "#f5f5f5" }}>{orsResult.distanceKm.toFixed(2)} km</b>
                      {" · "}Durée : <b style={{ color: "#f5f5f5" }}>{Math.round(orsResult.dureeS / 60)} min</b>
                    </div>
                    <div style={{ height: 1, background: "rgba(148,163,184,0.15)", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Prise en charge</span>
                      <b style={{ color: "#f5f5f5" }}>{PRISE.toFixed(2)} €</b>
                    </div>
                    {detailCalc.jourKm > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#fbbf24" }}>
                          ☀️ Jour : {detailCalc.jourKm.toFixed(2)} km ({Math.round(detailCalc.jourMin)} min) ×{" "}
                          {TARIF_JOUR_KM.toFixed(2)} €/km — <b>{detailCalc.pctJour}%</b>
                        </span>
                        <b style={{ color: "#f5f5f5" }}>{(detailCalc.jourKm * TARIF_JOUR_KM).toFixed(2)} €</b>
                      </div>
                    )}
                    {detailCalc.nuitKm > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#818cf8" }}>
                          🌙 Nuit : {detailCalc.nuitKm.toFixed(2)} km ({Math.round(detailCalc.nuitMin)} min) ×{" "}
                          {TARIF_NUIT_KM.toFixed(2)} €/km — <b>{detailCalc.pctNuit}%</b>
                        </span>
                        <b style={{ color: "#f5f5f5" }}>{(detailCalc.nuitKm * TARIF_NUIT_KM).toFixed(2)} €</b>
                      </div>
                    )}
                    <div style={{ height: 1, background: "rgba(148,163,184,0.15)", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <b style={{ color: "#f5c842" }}>Total estimé</b>
                      <b style={{ color: "#f5c842" }}>{detailCalc.total.toFixed(2)} €</b>
                    </div>
                    {detailCalc.jourKm > 0 && detailCalc.nuitKm > 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
                        Prorata calculé minute par minute selon le passage de 7h ou 19h (heure de Paris).
                      </div>
                    )}
                    <div style={{ color: "#94a3b8", fontSize: 11 }}>
                      Règle : 7h–19h = tarif jour · 19h–7h, dimanche et jours fériés = tarif nuit.
                    </div>
                  </div>
                </details>
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
                  {errors.date && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors.date}</div>}
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
                  {errors.heure && <div style={{ color: "#fecaca", fontSize: 12, marginTop: 4 }}>{errors.heure}</div>}
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
