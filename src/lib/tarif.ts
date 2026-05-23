// Tarifs officiels taxi Bordeaux (homologués préfecture)
export const PRISE_EN_CHARGE = 2.83;
export const TARIF_JOUR = 2.16; // €/km — tarif A (7h–19h)
export const TARIF_NUIT = 3.24; // €/km — tarif B (19h–7h, dimanches, jours fériés)
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
 * Calcule les jours fériés français pour une année donnée.
 * Retourne un Set de chaînes "YYYY-MM-DD".
 */
function joursFerriesFrance(annee: number): Set<string> {
  // Calcul de Pâques (algorithme de Meeus/Jones/Butcher)
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const moisPaques = Math.floor((h + l - 7 * m + 114) / 31);
  const jourPaques = ((h + l - 7 * m + 114) % 31) + 1;

  const paques = new Date(annee, moisPaques - 1, jourPaques);
  const lundiPaques = new Date(paques);
  lundiPaques.setDate(paques.getDate() + 1);
  const ascension = new Date(paques);
  ascension.setDate(paques.getDate() + 39);
  const lundiPentecote = new Date(paques);
  lundiPentecote.setDate(paques.getDate() + 50);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return new Set([
    `${annee}-01-01`, // Jour de l'An
    fmt(lundiPaques), // Lundi de Pâques
    `${annee}-05-01`, // Fête du Travail
    `${annee}-05-08`, // Victoire 1945
    fmt(ascension), // Ascension
    fmt(lundiPentecote), // Lundi de Pentecôte
    `${annee}-07-14`, // Fête Nationale
    `${annee}-08-15`, // Assomption
    `${annee}-11-01`, // Toussaint
    `${annee}-11-11`, // Armistice
    `${annee}-12-25`, // Noël
  ]);
}

/**
 * Retourne true si la date (ISO) tombe un dimanche ou un jour férié français.
 */
export function estTarifNuitJournee(iso: string): boolean {
  const date = new Date(iso);
  // Convertir en date Paris
  const dateParis = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const jourSemaine = dateParis.getDay(); // 0 = dimanche
  if (jourSemaine === 0) return true;

  const annee = dateParis.getFullYear();
  const mois = String(dateParis.getMonth() + 1).padStart(2, "0");
  const jour = String(dateParis.getDate()).padStart(2, "0");
  const cle = `${annee}-${mois}-${jour}`;

  return joursFerriesFrance(annee).has(cle);
}

/**
 * Retourne l'heure décimale Paris à partir d'un ISO string.
 * Ex : "2026-05-17T17:45:00" → 17.75
 */
function heureParis(iso: string): number {
  const str = new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h = 0, m = 0] = str.split(":").map(Number);
  return h + m / 60;
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
 * Calcul mixte : tient compte de l'heure, des dimanches et jours fériés.
 * - Dimanche ou jour férié → tarif nuit sur toute la course
 * - Sinon, prorata jour/nuit selon l'heure de départ et la durée estimée
 *
 * @param distanceKm  Distance totale de la course
 * @param pickupIso   ISO datetime de prise en charge
 */
export function calculerPrixMixte(distanceKm: number, pickupIso: string): number {
  if (!pickupIso || distanceKm <= 0) {
    return calculerPrix(distanceKm, true);
  }

  // Dimanche ou jour férié → 100% tarif nuit
  if (estTarifNuitJournee(pickupIso)) {
    return arrondir(PRISE_EN_CHARGE + distanceKm * TARIF_NUIT);
  }

  const debutH = heureParis(pickupIso);
  const dureeH = distanceKm / VITESSE_MOYENNE_KMH;
  const finH = debutH + dureeH;

  let kmJour = 0;
  let kmNuit = 0;

  if (debutH >= DEBUT_JOUR && finH <= FIN_JOUR) {
    // Course entièrement de jour (7h–19h)
    kmJour = distanceKm;
  } else if (finH <= DEBUT_JOUR || debutH >= FIN_JOUR) {
    // Course entièrement de nuit
    kmNuit = distanceKm;
  } else if (debutH >= DEBUT_JOUR && debutH < FIN_JOUR && finH > FIN_JOUR) {
    // Commence de jour, passe en nuit après 19h
    const ratio = (FIN_JOUR - debutH) / dureeH;
    kmJour = distanceKm * ratio;
    kmNuit = distanceKm * (1 - ratio);
  } else if (debutH < DEBUT_JOUR && finH > DEBUT_JOUR) {
    // Commence de nuit (avant 7h), passe en jour après 7h
    const ratio = (DEBUT_JOUR - debutH) / dureeH;
    kmNuit = distanceKm * ratio;
    kmJour = distanceKm * (1 - ratio);
  } else {
    // Fallback
    kmNuit = distanceKm;
  }

  return arrondir(PRISE_EN_CHARGE + kmJour * TARIF_JOUR + kmNuit * TARIF_NUIT);
}

/**
 * Stub — à remplacer par un vrai appel OSRM/Mapbox si besoin.
 */
export function estimerDistance(_depart: string, _destination: string): number {
  return 5;
}
