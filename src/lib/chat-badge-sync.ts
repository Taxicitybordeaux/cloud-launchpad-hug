// Synchronisation partagée entre les panneaux de chat (ChatPanel, DirectChatPanel,
// InlineDriverChat) et le compteur global de badge sur l'onglet Driver.
//
// Objectifs :
//  1. Garantir que `markThreadRead` est terminé AVANT que le badge global ne
//     soit recompté (changement d'onglet / focus / visibility).
//  2. Fournir un indicateur de statut Realtime observable (diagnostic).
//  3. Éviter les doubles marquages entre plusieurs onglets ouverts via un
//     verrou court dans localStorage + une diffusion BroadcastChannel des
//     deltas d'unread pour un recalcul incrémental sans requête serveur.

export type BadgeRealtimeStatus =
  | "idle"
  | "subscribing"
  | "subscribed"
  | "polling"
  | "error"
  | "closed";

type MarkFn = () => Promise<unknown>;

const readers = new Map<string, MarkFn>();

export function registerChauffeurReader(id: string, mark: MarkFn): () => void {
  readers.set(id, mark);
  return () => {
    readers.delete(id);
  };
}

export async function flushChauffeurReaders(): Promise<void> {
  if (readers.size === 0) return;
  const fns = Array.from(readers.values());
  try {
    await Promise.allSettled(fns.map((fn) => fn()));
  } catch {
    /* no-op */
  }
}

// ── Statut Realtime observable ───────────────────────────────────────────────
let currentStatus: BadgeRealtimeStatus = "idle";
let currentDetail: string | null = null;
const listeners = new Set<(s: BadgeRealtimeStatus, detail: string | null) => void>();

export function getBadgeRealtimeStatus() {
  return { status: currentStatus, detail: currentDetail };
}

export function setBadgeRealtimeStatus(status: BadgeRealtimeStatus, detail: string | null = null) {
  if (status === currentStatus && detail === currentDetail) return;
  currentStatus = status;
  currentDetail = detail;
  const tag = "[drv-badge:rt]";
  const msg = detail ? `${status} — ${detail}` : status;
  if (status === "error" || status === "polling") console.warn(`${tag} ${msg}`);
  else console.info(`${tag} ${msg}`);
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
  try {
    cb(currentStatus, currentDetail);
  } catch {}
  return () => {
    listeners.delete(cb);
  };
}

// ── Verrou cross-onglets pour markRead ───────────────────────────────────────
// Si un onglet a déjà pris le verrou < TTL, l'autre skip l'UPDATE côté serveur
// (il recevra le delta via BroadcastChannel/storage) — évite le remontage puis
// redescente du compteur.
const LOCK_TTL_MS = 3000;
const LOCK_KEY_PREFIX = "drv-chat-read-lock:";

export function acquireReadLock(reservationId: string): boolean {
  if (typeof window === "undefined") return true;
  const key = LOCK_KEY_PREFIX + reservationId;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const at = Number(raw);
      if (Number.isFinite(at) && Date.now() - at < LOCK_TTL_MS) return false;
    }
    window.localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function releaseReadLock(reservationId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCK_KEY_PREFIX + reservationId);
  } catch {
    /* ignore */
  }
}

// ── BroadcastChannel : diffusion des deltas d'unread ─────────────────────────
export type ChatBadgeEvent =
  | { type: "read"; reservationId: string; at: number }
  | { type: "delta"; reservationId: string; delta: number; at: number };

const CHANNEL_NAME = "drv-chat-badge-v1";
let bc: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (bc) return bc;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    return bc;
  } catch {
    return null;
  }
}

const badgeListeners = new Set<(e: ChatBadgeEvent) => void>();

export function subscribeChatBadgeEvents(cb: (e: ChatBadgeEvent) => void): () => void {
  badgeListeners.add(cb);
  const ch = getChannel();
  const handler = (msg: MessageEvent<ChatBadgeEvent>) => {
    if (!msg?.data) return;
    cb(msg.data);
  };
  if (ch) ch.addEventListener("message", handler);
  return () => {
    badgeListeners.delete(cb);
    if (ch) ch.removeEventListener("message", handler);
  };
}

export function broadcastChatBadge(event: ChatBadgeEvent): void {
  // Fallback storage bump pour les navigateurs sans BroadcastChannel.
  try {
    window.localStorage.setItem("drv-chat-read-bump", String(event.at));
  } catch {
    /* ignore */
  }
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage(event);
  } catch {
    /* ignore */
  }
}
