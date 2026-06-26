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

const clientSendSchema = sendSchema.extend({
  account_id: z.string().uuid(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().toLowerCase().max(255).optional().nullable(),
});

function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D+/g, "");
  return digits.length >= 6 ? digits.slice(-9) : null;
}

async function assertClientOwnsReservation(
  reservationId: string,
  identity: { account_id: string; phone?: string | null; email?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: r } = await supabaseAdmin
    .from("reservations")
    .select("id, client_account_id, client_phone, telephone, client_email, email")
    .eq("id", reservationId)
    .maybeSingle();
  if (!r) throw new Error("NOT_FOUND");
  if (r.client_account_id === identity.account_id) return;
  const phoneTail = normalizePhone(identity.phone);
  const matchPhone =
    !!phoneTail &&
    (normalizePhone((r as any).client_phone) === phoneTail || normalizePhone((r as any).telephone) === phoneTail);
  const matchEmail =
    !!identity.email &&
    (((r as any).client_email || "").toLowerCase() === identity.email.toLowerCase() ||
      ((r as any).email || "").toLowerCase() === identity.email.toLowerCase());
  if (!matchPhone && !matchEmail) throw new Error("FORBIDDEN");
}

// Throttle chauffeur → client pushes per reservation to avoid spam when
// several messages are typed quickly. FCM `tag` already collapses on-device,
// but skipping the network call entirely cuts noise + cost.
const lastChauffeurPushAt = new Map<string, number>();
const PUSH_THROTTLE_MS = 8000;

export const sendClientMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => clientSendSchema.parse(input))
  .handler(async ({ data }) => {
    await assertClientOwnsReservation(data.reservation_id, {
      account_id: data.account_id,
      phone: data.phone ?? null,
      email: data.email ?? null,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Récupère nom client pour le titre push
    const { data: r } = await supabaseAdmin
      .from("reservations")
      .select("client_name, nom, suivi_id")
      .eq("id", data.reservation_id)
      .maybeSingle();
    const clientName = (r as any)?.client_name || (r as any)?.nom || "Client";

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

    // ── Push chauffeur : nouveau message client (course) ─────────────────────
    if (!data.skip_push) {
      try {
        const { sendPushToAudience } = await import("@/lib/push.server");
        await sendPushToAudience("chauffeur", {
          title: `💬 Message de ${clientName}`,
          body: data.content.slice(0, 100),
          url: "/driver?token=DSF234",
          tag: `chat-driver-resa-${data.reservation_id}`,
          requireInteraction: false,
        });
      } catch (e) {
        console.warn("[chat] push chauffeur (resa) failed (non-blocking)", e);
      }
    }

    return row as ChatMessage;
  });

export const sendChauffeurMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => sendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Récupère suivi_id pour construire l'URL de redirection client
    const { data: resa } = await supabaseAdmin
      .from("reservations")
      .select("suivi_id")
      .eq("id", data.reservation_id)
      .maybeSingle();
    const suiviId = (resa as any)?.suivi_id || data.reservation_id;

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

    // ── Push client : réponse chauffeur (redirige vers /suivi/$id) ───────────
    if (!data.skip_push) {
      try {
        const { sendPushToAudience } = await import("@/lib/push.server");
        await sendPushToAudience(
          "client",
          {
            title: "💬 José a répondu à votre message",
            body: data.content.slice(0, 100),
            url: `/suivi/${suiviId}`,
            tag: `chat-client-resa-${data.reservation_id}`,
            requireInteraction: false,
            data: { reservation_id: data.reservation_id },
          },
          { reservationId: data.reservation_id },
        );
      } catch (e) {
        console.warn("[chat] push client (resa) failed (non-blocking)", e);
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

    // Récupère nom client pour le titre push
    const { data: acct } = await supabaseAdmin
      .from("client_accounts")
      .select("client_name, email")
      .eq("id", data.client_account_id)
      .maybeSingle();
    const clientName = (acct as any)?.client_name || (acct as any)?.email || "Client";

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

    // ── Push chauffeur : nouveau message direct client ────────────────────────
    try {
      const { sendPushToAudience } = await import("@/lib/push.server");
      await sendPushToAudience("chauffeur", {
        title: `💬 Message de ${clientName}`,
        body: data.content.slice(0, 100),
        url: "/driver?token=DSF234",
        tag: `chat-driver-direct-${data.client_account_id}`,
        requireInteraction: false,
      });
    } catch (e) {
      console.warn("[chat] push chauffeur (direct) failed (non-blocking)", e);
    }

    return row as DirectMessage;
  });

export const sendDirectChauffeurMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => directSendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    // ── Push client : réponse chauffeur (direct → /client/chat) ─────────────
    try {
      const { sendPushToAudience } = await import("@/lib/push.server");
      await sendPushToAudience(
        "client",
        {
          title: "💬 José a répondu à votre message",
          body: data.content.slice(0, 100),
          url: "/client/chat",
          tag: `chat-client-direct-${data.client_account_id}`,
          requireInteraction: false,
        },
        { accountId: data.client_account_id },
      );
    } catch (e) {
      console.warn("[chat] push client (direct) failed (non-blocking)", e);
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

// ─── Vue FUSIONNÉE pour José (espace chauffeur) ──────────────────────────────
// Agrège direct_messages (par compte client) et reservation_messages (par
// course) en UN seul thread par client. Sert uniquement côté driver — le
// client reste sur ses 2 UI séparées (/suivi/$id pour la course, /client/chat
// pour la conversation persistante).

export type MergedSource = "direct" | "reservation";

export type MergedThread = {
  // Clé stable pour grouper côté UI (account_id si dispo, sinon phone tail)
  thread_key: string;
  client_account_id: string | null;
  client_phone: string | null;
  client_name: string | null;
  // Toutes les réservations rattachées à ce client (utile pour scoper la réponse)
  reservation_ids: string[];
  // Course "active" (la plus récente non terminée) — cible privilégiée d'une réponse
  active_reservation_id: string | null;
  active_reservation_label: string | null;
  last_message_at: string;
  last_message_content: string;
  last_message_source: MergedSource;
  unread_chauffeur: number;
};

export type MergedMessage = {
  id: string;
  source: MergedSource;
  reservation_id: string | null;
  reservation_label: string | null;
  sender: "client" | "chauffeur";
  content: string;
  read_by_chauffeur: boolean;
  created_at: string;
};

function normPhone(p?: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/\D+/g, "");
  return d.length >= 6 ? d.slice(-9) : null;
}

export const listMergedChauffeurThreads = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Direct messages (par compte)
  const { data: directs } = await supabaseAdmin
    .from("direct_messages")
    .select("client_account_id,sender,content,read_by_chauffeur,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  // 2) Reservation messages (par course)
  const { data: resaMsgs } = await supabaseAdmin
    .from("reservation_messages")
    .select("reservation_id,sender,content,read_by_chauffeur,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  // Récupère les réservations pour résoudre account_id / phone / nom / statut
  const resaIds = Array.from(new Set((resaMsgs ?? []).map((m: any) => m.reservation_id)));
  let resaMap = new Map<string, any>();
  if (resaIds.length > 0) {
    const { data: resas } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, client_account_id, client_name, nom, client_phone, telephone, depart, destination, arrivee, status, pickup_datetime",
      )
      .in("id", resaIds);
    resaMap = new Map((resas ?? []).map((r: any) => [r.id, r]));
  }

  // Récupère les comptes
  const acctIds = new Set<string>();
  for (const m of directs ?? []) if ((m as any).client_account_id) acctIds.add((m as any).client_account_id);
  for (const r of resaMap.values()) if (r.client_account_id) acctIds.add(r.client_account_id);
  let acctMap = new Map<string, any>();
  if (acctIds.size > 0) {
    const { data: accts } = await supabaseAdmin
      .from("client_accounts")
      .select("id, client_name, email, phone")
      .in("id", Array.from(acctIds));
    acctMap = new Map((accts ?? []).map((a: any) => [a.id, a]));
  }

  type Bucket = {
    thread_key: string;
    client_account_id: string | null;
    client_phone: string | null;
    client_name: string | null;
    reservation_ids: Set<string>;
    active_reservation_id: string | null;
    active_pickup_at: string | null;
    active_reservation_label: string | null;
    last_at: string;
    last_content: string;
    last_source: MergedSource;
    unread: number;
  };
  const buckets = new Map<string, Bucket>();

  function bucketFor(
    key: string,
    init: () => Omit<Bucket, "reservation_ids" | "last_at" | "last_content" | "last_source" | "unread">,
  ): Bucket {
    let b = buckets.get(key);
    if (!b) {
      const i = init();
      b = {
        ...i,
        reservation_ids: new Set<string>(),
        last_at: "",
        last_content: "",
        last_source: "direct",
        unread: 0,
      };
      buckets.set(key, b);
    }
    return b;
  }

  function updateLast(b: Bucket, m: { content: string; created_at: string }, source: MergedSource) {
    if (!b.last_at || m.created_at > b.last_at) {
      b.last_at = m.created_at;
      b.last_content = m.content;
      b.last_source = source;
    }
  }

  // Direct
  for (const m of (directs ?? []) as any[]) {
    const acct = acctMap.get(m.client_account_id);
    const key = `a:${m.client_account_id}`;
    const b = bucketFor(key, () => ({
      thread_key: key,
      client_account_id: m.client_account_id,
      client_phone: acct?.phone ?? null,
      client_name: acct?.client_name ?? acct?.email ?? "Client",
      active_reservation_id: null,
      active_pickup_at: null,
      active_reservation_label: null,
    }));
    updateLast(b, m, "direct");
    if (m.sender === "client" && !m.read_by_chauffeur) b.unread += 1;
  }

  // Reservation
  for (const m of (resaMsgs ?? []) as any[]) {
    const r = resaMap.get(m.reservation_id);
    if (!r) continue;
    const acct = r.client_account_id ? acctMap.get(r.client_account_id) : null;
    const phoneTail = normPhone(r.client_phone || r.telephone);
    const key = r.client_account_id ? `a:${r.client_account_id}` : phoneTail ? `p:${phoneTail}` : `r:${r.id}`;
    const b = bucketFor(key, () => ({
      thread_key: key,
      client_account_id: r.client_account_id ?? null,
      client_phone: r.client_phone || r.telephone || null,
      client_name: acct?.client_name ?? r.client_name ?? r.nom ?? "Client",
      active_reservation_id: null,
      active_pickup_at: null,
      active_reservation_label: null,
    }));
    b.reservation_ids.add(m.reservation_id);
    // active = course pas terminée la plus récente
    const isActive = !["completed", "cancelled", "no_show"].includes(r.status);
    if (isActive && (!b.active_pickup_at || (r.pickup_datetime ?? "") > b.active_pickup_at)) {
      b.active_reservation_id = r.id;
      b.active_pickup_at = r.pickup_datetime ?? null;
      const dest = r.destination || r.arrivee || "";
      b.active_reservation_label = `#${String(r.id).slice(0, 6).toUpperCase()} · ${dest.slice(0, 24)}`;
    }
    updateLast(b, m, "reservation");
    if (m.sender === "client" && !m.read_by_chauffeur) b.unread += 1;
  }

  const out: MergedThread[] = Array.from(buckets.values()).map((b) => ({
    thread_key: b.thread_key,
    client_account_id: b.client_account_id,
    client_phone: b.client_phone,
    client_name: b.client_name,
    reservation_ids: Array.from(b.reservation_ids),
    active_reservation_id: b.active_reservation_id,
    active_reservation_label: b.active_reservation_label,
    last_message_at: b.last_at,
    last_message_content: b.last_content,
    last_message_source: b.last_source,
    unread_chauffeur: b.unread,
  }));
  out.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  return out;
});

export const loadMergedConversation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        client_account_id: z.string().uuid().nullable().optional(),
        reservation_ids: z.array(z.string().uuid()).max(50).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lim = data.limit ?? 200;
    const out: MergedMessage[] = [];

    if (data.client_account_id) {
      const { data: rows } = await supabaseAdmin
        .from("direct_messages")
        .select("id,sender,content,read_by_chauffeur,created_at")
        .eq("client_account_id", data.client_account_id)
        .order("created_at", { ascending: false })
        .limit(lim);
      for (const r of (rows ?? []) as any[]) {
        out.push({
          id: r.id,
          source: "direct",
          reservation_id: null,
          reservation_label: null,
          sender: r.sender,
          content: r.content,
          read_by_chauffeur: r.read_by_chauffeur,
          created_at: r.created_at,
        });
      }
    }

    const rids = data.reservation_ids ?? [];
    if (rids.length > 0) {
      const { data: rows } = await supabaseAdmin
        .from("reservation_messages")
        .select("id,reservation_id,sender,content,read_by_chauffeur,created_at")
        .in("reservation_id", rids)
        .order("created_at", { ascending: false })
        .limit(lim);
      const labels = new Map<string, string>();
      for (const id of rids) labels.set(id, `#${String(id).slice(0, 6).toUpperCase()}`);
      for (const r of (rows ?? []) as any[]) {
        out.push({
          id: r.id,
          source: "reservation",
          reservation_id: r.reservation_id,
          reservation_label: labels.get(r.reservation_id) ?? null,
          sender: r.sender,
          content: r.content,
          read_by_chauffeur: r.read_by_chauffeur,
          created_at: r.created_at,
        });
      }
    }

    out.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return out;
  });

export const markMergedConversationRead = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        client_account_id: z.string().uuid().nullable().optional(),
        reservation_ids: z.array(z.string().uuid()).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.client_account_id) {
      await supabaseAdmin
        .from("direct_messages")
        .update({ read_by_chauffeur: true })
        .eq("client_account_id", data.client_account_id)
        .eq("sender", "client")
        .eq("read_by_chauffeur", false);
    }
    const rids = data.reservation_ids ?? [];
    if (rids.length > 0) {
      await supabaseAdmin
        .from("reservation_messages")
        .update({ read_by_chauffeur: true })
        .in("reservation_id", rids)
        .eq("sender", "client")
        .eq("read_by_chauffeur", false);
    }
    return { ok: true };
  });
