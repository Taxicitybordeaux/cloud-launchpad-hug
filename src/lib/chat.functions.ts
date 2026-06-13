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
  skip_push: z.boolean().optional(),
});

// Throttle chauffeur → client pushes per reservation to avoid spam when
// several messages are typed quickly. FCM `tag` already collapses on-device,
// but skipping the network call entirely cuts noise + cost.
const lastChauffeurPushAt = new Map<string, number>();
const PUSH_THROTTLE_MS = 8000;

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

    const now = Date.now();
    const last = lastChauffeurPushAt.get(data.reservation_id) ?? 0;
    const shouldPush = !data.skip_push && now - last >= PUSH_THROTTLE_MS;

    if (shouldPush) {
      const body = data.content.length > 80 ? data.content.slice(0, 77) + "…" : data.content;
      lastChauffeurPushAt.set(data.reservation_id, now);
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
    }
    return row as ChatMessage;
  });

export const listReservationMessages = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("reservation_messages")
      .select("id,reservation_id,sender,content,read_by_client,read_by_chauffeur,created_at")
      .eq("reservation_id", data.reservation_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as ChatMessage[]).slice().reverse();
  });

export const markReservationMessagesRead = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        role: z.enum(["client", "chauffeur"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const peer = data.role === "client" ? "chauffeur" : "client";
    const patch = data.role === "client" ? { read_by_client: true } : { read_by_chauffeur: true };
    const readCol = data.role === "client" ? "read_by_client" : "read_by_chauffeur";
    const { error } = await supabaseAdmin
      .from("reservation_messages")
      .update(patch)
      .eq("reservation_id", data.reservation_id)
      .eq("sender", peer)
      .eq(readCol, false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const countUnreadForClient = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_ids: z.array(z.string().uuid()).max(200) }).parse(input))
  .handler(async ({ data }) => {
    if (data.reservation_ids.length === 0) return {} as Record<string, number>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reservation_messages")
      .select("reservation_id")
      .in("reservation_id", data.reservation_ids)
      .eq("sender", "chauffeur")
      .eq("read_by_client", false);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of (rows ?? []) as { reservation_id: string }[]) {
      counts[r.reservation_id] = (counts[r.reservation_id] ?? 0) + 1;
    }
    return counts;
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

// ─── Chat général client ↔ José (sans réservation) ───────────────────────────

export type DirectMessage = {
  id: string;
  client_account_id: string;
  sender: "client" | "chauffeur";
  content: string;
  read_by_client: boolean;
  read_by_chauffeur: boolean;
  created_at: string;
};

export type AdminDirectThread = {
  client_account_id: string;
  client_name: string | null;
  client_email: string | null;
  last_message_at: string;
  last_message_content: string;
  unread_chauffeur: number;
};

const directSendSchema = z.object({
  client_account_id: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

export const sendDirectClientMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => directSendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        client_account_id: data.client_account_id,
        sender: "client",
        content: data.content,
        read_by_client: true,
        read_by_chauffeur: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as DirectMessage;
  });

export const sendDirectChauffeurMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => directSendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToAudience } = await import("@/lib/push.server");
    const { data: row, error } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        client_account_id: data.client_account_id,
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
        { title: "💬 José vous répond", body, url: "/client/dashboard", tag: `direct-${data.client_account_id}` },
        { accountId: data.client_account_id },
      );
    } catch (e) {
      console.warn("[direct-chat] push failed", e);
    }
    return row as DirectMessage;
  });

export const listDirectMessages = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        client_account_id: z.string().uuid(),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("direct_messages")
      .select("id,client_account_id,sender,content,read_by_client,read_by_chauffeur,created_at")
      .eq("client_account_id", data.client_account_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as DirectMessage[]).slice().reverse();
  });

export const markDirectMessagesRead = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ client_account_id: z.string().uuid(), role: z.enum(["client", "chauffeur"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const peer = data.role === "client" ? "chauffeur" : "client";
    const patch = data.role === "client" ? { read_by_client: true } : { read_by_chauffeur: true };
    const readCol = data.role === "client" ? "read_by_client" : "read_by_chauffeur";
    const { error } = await supabaseAdmin
      .from("direct_messages")
      .update(patch)
      .eq("client_account_id", data.client_account_id)
      .eq("sender", peer)
      .eq(readCol, false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminDirectThreads = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: msgs, error } = await supabaseAdmin
    .from("direct_messages")
    .select("client_account_id,sender,content,read_by_chauffeur,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  const byAccount = new Map<string, { last: any; unread: number }>();
  for (const m of msgs ?? []) {
    if (!byAccount.has(m.client_account_id)) byAccount.set(m.client_account_id, { last: m, unread: 0 });
    const entry = byAccount.get(m.client_account_id)!;
    if (m.sender === "client" && !m.read_by_chauffeur) entry.unread += 1;
  }
  const ids = Array.from(byAccount.keys());
  if (ids.length === 0) return [] as AdminDirectThread[];
  const { data: accounts } = await supabaseAdmin.from("client_accounts").select("id,client_name,email").in("id", ids);
  const map = new Map((accounts ?? []).map((a: any) => [a.id, a]));
  return ids
    .map((id) => {
      const e = byAccount.get(id)!;
      const a: any = map.get(id) ?? {};
      return {
        client_account_id: id,
        client_name: a.client_name ?? null,
        client_email: a.email ?? null,
        last_message_at: e.last.created_at,
        last_message_content: e.last.content,
        unread_chauffeur: e.unread,
      };
    })
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
});
