// Synchronisation partagée entre les panneaux de chat (ChatPanel, DirectChatPanel)
// et le compteur global de badge sur l'onglet Driver.
//
// Objectifs :
//  1. Garantir que `markThreadRead` (mise à jour `read_by_chauffeur=true`)
//     est terminé AVANT que le badge global ne soit recompté, même lors d'un
//     changement d'onglet ou d'un retour sur la page (focus / visibility).
//  2. Fournir un indicateur de statut Realtime observable pour diagnostiquer
//     les CHANNEL_ERROR et le déclenchement du fallback polling 20s.

export type BadgeRealtimeStatus =
  | "idle"
  | "subscribing"
  | "subscribed"
  | "polling"
  | "error"
  | "closed";

type MarkFn = () => Promise<unknown>;

const readers = new Map<string, MarkFn>();

/**
 * Enregistre un thread ouvert côté chauffeur. Le `mark` sera appelé
 * (et attendu) avant chaque recomptage du badge global.
 * Retourne la fonction de désabonnement.
 */
export function registerChauffeurReader(id: string, mark: MarkFn): () => void {
  readers.set(id, mark);
  return () => {
    readers.delete(id);
  };
}

/**
 * Vide tous les threads ouverts (markRead) avant recomptage.
 * Utilisé par le compteur global de badge dans driver.tsx.
 */
export async function flushChauffeurReaders(): Promise<void> {
  if (readers.size === 0) return;
  const fns = Array.from(readers.values());
  try {
    await Promise.allSettled(fns.map((fn) => fn()));
  } catch {
    // no-op : les erreurs individuelles sont déjà loggées côté panneaux
  }
}

// ── Statut Realtime observable ───────────────────────────────────────────────
let currentStatus: BadgeRealtimeStatus = "idle";
let currentDetail: string | null = null;
const listeners = new Set<(s: BadgeRealtimeStatus, detail: string | null) => void>();

export function getBadgeRealtimeStatus(): { status: BadgeRealtimeStatus; detail: string | null } {
  return { status: currentStatus, detail: currentDetail };
}

export function setBadgeRealtimeStatus(status: BadgeRealtimeStatus, detail: string | null = null) {
  if (status === currentStatus && detail === currentDetail) return;
  currentStatus = status;
  currentDetail = detail;
  // Log diagnostic centralisé
  const tag = "[drv-badge:rt]";
  const msg = detail ? `${status} — ${detail}` : status;
  if (status === "error" || status === "polling") {
    console.warn(`${tag} ${msg}`);
  } else {
    console.info(`${tag} ${msg}`);
  }
  for (const l of listeners) {
    try {
      l(status, detail);
    } catch {}
  }
}

export function subscribeBadgeRealtimeStatus(
  cb: (s: BadgeRealtimeStatus, detail: string | null) => void,
): () => void {
  listeners.add(cb);
  // notifie immédiatement l'état courant
  try {
    cb(currentStatus, currentDetail);
  } catch {}
  return () => {
    listeners.delete(cb);
  };
}
