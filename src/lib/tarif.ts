// Tarifs officiels taxi Bordeaux (homologués préfecture)
export const PRISE_EN_CHARGE = 2.83;
export const TARIF_JOUR = 2.16; // €/km — tarif A (7h–19h)
export const TARIF_NUIT = 3.24; // €/km — tarif B (19h–7h)
export const VITESSE_MOYENNE_KMH = 40; // vitesse moyenne estimée en ville

export const TARIFS = {
  PRISE_EN_CHARGE,
  TARIF_JOUR,
  TARIF_NUIT,
  VITESSE_MOYENNE_KMH,
} as const;

const DEBUT_JOUR = 7;
const FIN_JOUR = 19;

/**
 * Extrait les composantes Paris d'une date de manière fiable (tous navigateurs,
 * tous runtimes serveur).
 */
export function partsParis(iso: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
} {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    weekday: get("weekday"),
  };
}

// Dimanche de Pâques (Meeus/Jones/Butcher, grégorien).
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function addDays(year: number, month: number, day: number, add: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + add);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Jours fériés légaux français (métropole).
export function estJourFerieFR(year: number, month: number, day: number): boolean {
  const fixed: Array<[number, number]> = [
    [1, 1], [5, 1], [5, 8], [7, 14], [8, 15], [11, 1], [11, 11], [12, 25],
  ];
  if (fixed.some(([m, d]) => m === month && d === day)) return true;
  const e = easterSunday(year);
  const movable = [
    addDays(year, e.month, e.day, 1),   // Lundi de Pâques
    addDays(year, e.month, e.day, 39),  // Ascension
    addDays(year, e.month, e.day, 50),  // Lundi de Pentecôte
  ];
  return movable.some((f) => f.month === month && f.day === day);
}

/**
 * Tarif nuit : 19h–7h heure de Paris, OU dimanche, OU jour férié (toute la journée).
 */
export function estTarifNuitJournee(iso: string): boolean {
  return !estTarifJourParis(iso);
}

export function estTarifJourParis(iso: string): boolean {
  const p = partsParis(iso);
  if (p.weekday === "Sun") return false;
  if (estJourFerieFR(p.year, p.month, p.day)) return false;
  const h = p.hour + p.minute / 60;
  return h >= DEBUT_JOUR && h < FIN_JOUR;
}

function arrondir(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Calcul simple — tarif uniforme sur toute la course.
 * Conservé pour compatibilité et pour les cas sans datetime.
 */
export function calculerPrix(distanceKm: number, tarifJour: boolean): number {
  const tarifKm = tarifJour ? TARIF_JOUR : TARIF_NUIT;
  return arrondir(PRISE_EN_CHARGE + distanceKm * tarifKm);
}

/**
 * Calcul mixte : prorata jour/nuit selon l'heure de Paris.
 * Règle unique : 7h–19h = jour, 19h–7h = nuit.
 *
 * @param distanceKm  Distance totale de la course
 * @param pickupIso   ISO datetime de prise en charge
 */
export function calculerPrixMixte(distanceKm: number, pickupIso: string): number {
  if (!pickupIso || distanceKm <= 0) {
    return calculerPrix(distanceKm, true);
  }

  const dureeH = distanceKm / VITESSE_MOYENNE_KMH;
  const dureeMs = Math.max(dureeH * 3_600_000, 60_000);
  const departMs = new Date(pickupIso).getTime();
  const steps = Math.max(Math.ceil(dureeMs / 60_000), 1);

  let kmJour = 0;
  let kmNuit = 0;

  for (let i = 0; i < steps; i++) {
    const t = new Date(departMs + i * (dureeMs / steps)).toISOString();
    const kmSlice = distanceKm / steps;
    if (estTarifJourParis(t)) kmJour += kmSlice;
    else kmNuit += kmSlice;
  }

  return arrondir(PRISE_EN_CHARGE + kmJour * TARIF_JOUR + kmNuit * TARIF_NUIT);
}

/**
 * Stub — à remplacer par un vrai appel OSRM/Mapbox si besoin.
 */
export function estimerDistance(_depart: string, _destination: string): number {
  return 5;
}
