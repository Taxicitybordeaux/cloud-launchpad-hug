import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ChatMessage = {
  id: string;
  reservation_id: string;
  sender: "client" | "chauffeur";
  content: string;
  read_by_client: boolean;
  read_by_chauffeur: boolean;
  created_at: string;
};

export type AdminChatThread = {
  reservation_id: string;
  client_name: string | null;
  client_phone: string | null;
  depart: string | null;
  destination: string | null;
  status: string | null;
  last_message_at: string;
  last_message_content: string;
  unread_chauffeur: number;
};

const sendSchema = z.object({
  reservation_id: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

export const sendClientMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => sendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("reservation_messages")
      .insert({
        reservation_id: data.reservation_id,
        sender: "client",
        content: data.content,
        read_by_client: true,
        read_by_chauffeur: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as ChatMessage;
  });

export const sendChauffeurMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => sendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToAudience } = await import("@/lib/push.server");

    const { data: row, error } = await supabaseAdmin
      .from("reservation_messages")
      .insert({
        reservation_id: data.reservation_id,
        sender: "chauffeur",
        content: data.content,
        read_by_client: false,
        read_by_chauffeur: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const body = data.content.length > 80 ? data.content.slice(0, 77) + "…" : data.content;
    try {
      await sendPushToAudience(
        "client",
        {
          title: "💬 José vous répond",
          body,
          url: "/client/dashboard",
          tag: `chat-${data.reservation_id}`,
        },
        { reservationId: data.reservation_id },
      );
    } catch (e) {
      console.error("[chat] push to client failed", e);
    }
    return row as ChatMessage;
  });

export const listAdminChatThreads = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: msgs, error } = await supabaseAdmin
    .from("reservation_messages")
    .select("reservation_id, sender, content, read_by_chauffeur, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const byRes = new Map<string, { last: any; unread: number }>();
  for (const m of msgs ?? []) {
    const cur = byRes.get(m.reservation_id);
    if (!cur) byRes.set(m.reservation_id, { last: m, unread: 0 });
    const entry = byRes.get(m.reservation_id)!;
    if (m.sender === "client" && !m.read_by_chauffeur) entry.unread += 1;
  }
  const ids = Array.from(byRes.keys());
  if (ids.length === 0) return [] as AdminChatThread[];

  const { data: resas } = await supabaseAdmin
    .from("reservations")
    .select("id, client_name, nom, client_phone, telephone, depart, destination, arrivee, status")
    .in("id", ids);

  const map = new Map((resas ?? []).map((r: any) => [r.id, r]));
  const threads: AdminChatThread[] = ids.map((id) => {
    const e = byRes.get(id)!;
    const r: any = map.get(id) ?? {};
    return {
      reservation_id: id,
      client_name: r.client_name || r.nom || null,
      client_phone: r.client_phone || r.telephone || null,
      depart: r.depart ?? null,
      destination: r.destination || r.arrivee || null,
      status: r.status ?? null,
      last_message_at: e.last.created_at,
      last_message_content: e.last.content,
      unread_chauffeur: e.unread,
    };
  });
  threads.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  return threads;
});
