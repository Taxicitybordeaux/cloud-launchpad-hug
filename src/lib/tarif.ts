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
 * Calcul mixte : si la course chevauche 19h ou 7h, les kilomètres
 * sont répartis au prorata entre tarif jour et tarif nuit.
 *
 * @param distanceKm  Distance totale de la course
 * @param pickupIso   ISO datetime de prise en charge
 */
export function calculerPrixMixte(distanceKm: number, pickupIso: string): number {
  if (!pickupIso || distanceKm <= 0) {
    return calculerPrix(distanceKm, true);
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
