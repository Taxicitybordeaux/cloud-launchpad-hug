// Client-side helper: notifies the /suivi/:id page in realtime when the driver
// updates a reservation (status, route, price, time…). Uses Supabase Broadcast
// which bypasses RLS entirely — required because anon has no SELECT policy on
// public.reservations (PII protection), so postgres_changes UPDATE events are
// never delivered to the tracking page.
import { supabase } from "@/integrations/supabase/client";

export function broadcastSuiviUpdate(reservationId: string | null | undefined, kind: string = "update") {
  if (!reservationId) return;
  try {
    const ch = (supabase as any).channel(`suivi:${reservationId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    ch.subscribe((status: string) => {
      if (status !== "SUBSCRIBED") return;
      try {
        ch.send({ type: "broadcast", event: "update", payload: { kind, at: Date.now() } });
      } catch {}
      // Tear down shortly after so we don't leak channels.
      setTimeout(() => {
        try {
          supabase.removeChannel(ch);
        } catch {}
      }, 800);
    });
  } catch (e) {
    console.warn("[suivi-broadcast] failed", e);
  }
}
