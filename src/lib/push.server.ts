import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:taxi.city033@gmail.com";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
};

export type PushAudience = "admin" | "chauffeur" | "client";

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendPushToAudience(
  audience: PushAudience,
  payload: PushPayload,
  opts: { reservationId?: string } = {},
): Promise<{ sent: number; removed: number }> {
  configure();

  let q = supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("audience", audience);
  if (audience === "client" && opts.reservationId) {
    q = q.eq("reservation_id", opts.reservationId);
  }
  const { data, error } = await q;
  if (error || !data) return { sent: 0, removed: 0 };

  let sent = 0;
  const toRemove: string[] = [];
  const json = JSON.stringify(payload);

  await Promise.all(
    (data as SubRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
        sent++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          toRemove.push(sub.id);
        } else {
          console.error("[push] send failed", code, err?.body || err?.message);
        }
      }
    }),
  );

  if (toRemove.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", toRemove);
  }

  return { sent, removed: toRemove.length };
}
