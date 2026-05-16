// Tarifs officiels taxi Bordeaux (homologués préfecture)
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
