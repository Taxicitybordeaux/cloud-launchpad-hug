// Tarifs officiels taxi Bordeaux (homologués préfecture)
const PRISE_EN_CHARGE = 2.83;
const TARIF_JOUR = 2.16; // €/km — tarif A (7h-19h)
const TARIF_NUIT = 3.24; // €/km — tarif B (19h-7h)

// Vitesse moyenne estimée en ville pour calculer la durée de course
const VITESSE_MOYENNE_KMH = 40;

/**
 * Retourne l'heure décimale (Paris) d'un ISO string.
 * Ex: "2026-05-17T17:45:00" → 17.75
 */
function heureParis(iso: string): number {
  const str = new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // str = "17:45"
  const [h, m] = str.split(":").map(Number);
  return h + m / 60;
}

/**
 * Calcul simple (tarif uniforme) — gardé pour compatibilité.
 */
export function calculerPrix(distanceKm: number, tarifJour: boolean): number {
  const tarifKm = tarifJour ? TARIF_JOUR : TARIF_NUIT;
  const total = PRISE_EN_CHARGE + distanceKm * tarifKm;
  return Math.round(total * 100) / 100;
}

/**
 * Calcul mixte : si la course chevauche 19h ou 7h, on découpe
 * les kilomètres au prorata du temps passé dans chaque tranche.
 *
 * @param distanceKm   Distance totale de la course
 * @param pickupIso    ISO datetime de prise en charge (avec ou sans timezone)
 * @returns            Prix arrondi au centime
 */
export function calculerPrixMixte(distanceKm: number, pickupIso: string): number {
  if (!pickupIso || !distanceKm) return calculerPrix(distanceKm, true);

  const dureeCourse = (distanceKm / VITESSE_MOYENNE_KMH) * 60; // minutes
  const debutH = heureParis(pickupIso); // ex: 17.75 (17h45)
  const finH = debutH + dureeCourse / 60; // ex: 19.25 (19h15)

  // Tranches jour : 7h–19h, nuit : 19h–7h (lendemain)
  // On travaille sur une journée étendue (0..31h pour gérer minuit)
  const DEBUT_JOUR = 7;
  const FIN_JOUR = 19; // 19h00 = début tarif nuit

  let kmJour = 0;
  let kmNuit = 0;

  const dureeH = finH - debutH; // durée totale en heures

  if (dureeH <= 0) {
    // fallback
    const jour = debutH >= DEBUT_JOUR && debutH < FIN_JOUR;
    return calculerPrix(distanceKm, jour);
  }

  // Découpage minute par minute simplifié : on calcule les fractions de temps
  // passées dans chaque tranche, puis on proratise les km.
  //
  // Cas 1 : course entièrement de jour
  if (debutH >= DEBUT_JOUR && finH <= FIN_JOUR) {
    kmJour = distanceKm;
    kmNuit = 0;
  }
  // Cas 2 : course entièrement de nuit (avant 7h ou après 19h)
  else if (finH <= DEBUT_JOUR || debutH >= FIN_JOUR) {
    kmJour = 0;
    kmNuit = distanceKm;
  }
  // Cas 3 : course commence jour, finit nuit (ex: départ 18h, fin 20h)
  else if (debutH >= DEBUT_JOUR && debutH < FIN_JOUR && finH > FIN_JOUR) {
    const heuresJour = FIN_JOUR - debutH;
    const heuresNuit = finH - FIN_JOUR;
    kmJour = distanceKm * (heuresJour / dureeH);
    kmNuit = distanceKm * (heuresNuit / dureeH);
  }
  // Cas 4 : course commence nuit (avant 7h), finit jour
  else if (debutH < DEBUT_JOUR && finH > DEBUT_JOUR) {
    const heuresNuit = DEBUT_JOUR - debutH;
    const heuresJour = finH - DEBUT_JOUR;
    kmJour = distanceKm * (heuresJour / dureeH);
    kmNuit = distanceKm * (heuresNuit / dureeH);
  }
  // Cas 5 : course enjambe nuit→jour→nuit (très longue course, rare)
  else {
    // fallback conservateur : tarif nuit
    kmJour = 0;
    kmNuit = distanceKm;
  }

  const total = PRISE_EN_CHARGE + kmJour * TARIF_JOUR + kmNuit * TARIF_NUIT;
  return Math.round(total * 100) / 100;
}

export function estimerDistance(_depart: string, _destination: string): number {
  return 5;
}

export const TARIFS = { PRISE_EN_CHARGE, TARIF_JOUR, TARIF_NUIT, VITESSE_MOYENNE_KMH }; // Tarifs officiels taxi Bordeaux (homologués préfecture)
const PRISE_EN_CHARGE = 2.83;
const TARIF_JOUR = 2.16; // €/km — tarif A (7h-19h)
const TARIF_NUIT = 3.24; // €/km — tarif B (19h-7h)

export function calculerPrix(distanceKm: number, tarifJour: boolean): number {
  const tarifKm = tarifJour ? TARIF_JOUR : TARIF_NUIT;
  const total = PRISE_EN_CHARGE + distanceKm * tarifKm;
  return Math.round(total * 100) / 100;
}

export function estimerDistance(_depart: string, _destination: string): number {
  return 5;
}

export const TARIFS = { PRISE_EN_CHARGE, TARIF_JOUR, TARIF_NUIT };
