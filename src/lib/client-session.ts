// Helpers côté navigateur pour la session client (auth maison).
import type { ClientSession } from "./client-auth.functions";

const KEY = "tcb_client_session";

export function getClientSession(): ClientSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientSession;
  } catch {
    return null;
  }
}

export function setClientSession(s: ClientSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearClientSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
