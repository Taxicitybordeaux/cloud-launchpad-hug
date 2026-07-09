// Helpers durée — SEULE source de vérité pour l'arrondi à la minute près.
// Utilisé à la fois côté stockage (reserver, recompute serveur) et côté
// affichage (/suivi/$id, ICS, ETA) pour garantir que la même valeur en base
// donne toujours le même nombre de minutes affiché — pas d'écart possible.

/**
 * Convertit des secondes brutes (Google Directions, fallback, etc.) en
 * secondes arrondies à la minute la plus proche. Toujours ≥ 60 s (1 min min).
 * C'est la valeur à écrire dans `reservations.duree_s`.
 */
export function roundSecondsToMinute(seconds: number | null | undefined): number {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes * 60;
}

/**
 * Convertit `reservations.duree_s` en nombre de minutes entier pour affichage.
 * Comme `duree_s` est déjà arrondi à la minute en base (via roundSecondsToMinute),
 * cette fonction est un simple `s / 60`, mais on garde Math.round pour tolérer
 * les anciennes lignes non arrondies. Retourne 0 si valeur manquante/invalide.
 */
export function durationSecondsToMinutes(seconds: number | null | undefined): number {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Milliseconds correspondant à `duree_s` arrondi à la minute — pour ETA/ICS.
 */
export function durationSecondsToMs(seconds: number | null | undefined): number {
  return durationSecondsToMinutes(seconds) * 60 * 1000;
}
