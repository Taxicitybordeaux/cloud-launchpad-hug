import { useEffect, useSyncExternalStore } from "react";
import type { ReservationLite } from "./whatsapp";

let current: ReservationLite | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const reservationDraftStore = {
  set(value: ReservationLite | null) {
    current = value;
    emit();
  },
  get(): ReservationLite | null {
    return current;
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useReservationDraft(): ReservationLite | null {
  return useSyncExternalStore(
    reservationDraftStore.subscribe,
    reservationDraftStore.get,
    () => null,
  );
}

/** Helper hook for the reservation form to publish/clear the draft. */
export function usePublishReservationDraft(draft: ReservationLite) {
  useEffect(() => {
    reservationDraftStore.set(draft);
    return () => {
      reservationDraftStore.set(null);
    };
  }, [draft]);
}
