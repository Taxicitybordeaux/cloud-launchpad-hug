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
          tag: `chat-driver-resa-${data.reservation_id}-${Date.now()}`,
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

    // Récupère suivi_id + compte client pour construire l'URL et cibler la push
    const { data: resa } = await supabaseAdmin
      .from("reservations")
      .select("suivi_id, client_account_id")
      .eq("id", data.reservation_id)
      .maybeSingle();
    const suiviId = (resa as any)?.suivi_id || data.reservation_id;
    const accountId = (resa as any)?.client_account_id || undefined;

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
          { reservationId: data.reservation_id, accountId },
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
    // role='client' → marque tous les messages read_by_client=true (y compris
    // la demande spéciale envoyée par le client lui-même, insérée avec
    // read_by_client=false pour déclencher le badge sur /suivi/$id).
    // role='chauffeur' → uniquement les messages du client, comme avant.
    const patch = data.role === "client" ? { read_by_client: true } : { read_by_chauffeur: true };
    const readCol = data.role === "client" ? "read_by_client" : "read_by_chauffeur";
    let q = supabaseAdmin
      .from("reservation_messages")
      .update(patch)
      .eq("reservation_id", data.reservation_id)
      .eq(readCol, false);
    if (data.role === "chauffeur") q = q.eq("sender", "client");
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Wrapper batch idempotent via RPC SQL — 1 seul round-trip, retourne le nombre
// de messages effectivement basculés à `read_by_chauffeur=true`. Utilisé par
// InlineDriverChat pour éviter la course entre clics rapides / plusieurs onglets.
export const markReservationReadByChauffeur = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: count, error } = await supabaseAdmin.rpc(
      "mark_reservation_read_by_chauffeur",
      { p_reservation_id: data.reservation_id },
    );
    if (error) throw new Error(error.message);
    return { updated: (count as number) ?? 0 };
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

// ─── Chat anonyme depuis /suivi/$id (clé URL = preuve d'identité) ────────────

const suiviSendSchema = z.object({
  suivi_key: z.string().trim().min(6).max(200),
  content: z.string().trim().min(1).max(2000),
});

async function resolveSuiviReservation(suiviKey: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_reservation_for_suivi", { p_key: suiviKey });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("NOT_FOUND");
  return row as any;
}

export const listSuiviMessages = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        suivi_key: z.string().trim().min(6).max(200),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const r = await resolveSuiviReservation(data.suivi_key);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("reservation_messages")
      .select("id,reservation_id,sender,content,read_by_client,read_by_chauffeur,created_at")
      .eq("reservation_id", r.id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 60);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as ChatMessage[]).slice().reverse();
  });

export const sendSuiviClientMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => suiviSendSchema.parse(input))
  .handler(async ({ data }) => {
    const r = await resolveSuiviReservation(data.suivi_key);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clientName = (r as any).client_name || (r as any).nom || "Client";

    const { data: row, error } = await supabaseAdmin
      .from("reservation_messages")
      .insert({
        reservation_id: r.id,
        sender: "client",
        content: data.content,
        read_by_client: true,
        read_by_chauffeur: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    try {
      const { sendPushToAudience } = await import("@/lib/push.server");
      await sendPushToAudience("chauffeur", {
        title: `💬 Message de ${clientName}`,
        body: data.content.slice(0, 100),
        url: "/driver?token=DSF234",
        tag: `chat-driver-resa-${r.id}-${Date.now()}`,
        requireInteraction: false,
      });
    } catch (e) {
      console.warn("[chat] push chauffeur (suivi) failed (non-blocking)", e);
    }

    return row as ChatMessage;
  });

// Insère la "demande spéciale" saisie lors de la réservation comme premier
// message client dans le fil de conversation, pour que le chauffeur ET le
// client (page /suivi/$id) partent d'un fil unique et cohérent.
// Idempotent : ne fait rien si un message identique existe déjà.
const seedSpecialSchema = z.object({
  reservation_id: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
});

export const seedReservationSpecialRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => seedSpecialSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Anti-doublon : si un message client identique existe déjà pour cette
    // réservation, on ne réinsère pas (utile en cas de re-submit / retry).
    const { data: existing } = await supabaseAdmin
      .from("reservation_messages")
      .select("id")
      .eq("reservation_id", data.reservation_id)
      .eq("sender", "client")
      .eq("content", data.content)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, skipped: true } as const;

    const { error } = await supabaseAdmin.from("reservation_messages").insert({
      reservation_id: data.reservation_id,
      sender: "client",
      content: data.content,
      // read_by_client:false → le badge sur /suivi/$id signale immédiatement au
      // client que sa demande spéciale a bien été transmise au chauffeur.
      // Se remet à true dès l'ouverture du chat (markReservationMessagesRead).
      read_by_client: false,
      read_by_chauffeur: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true, skipped: false } as const;
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
        tag: `chat-driver-direct-${data.client_account_id}-${Date.now()}`,
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

export const countUnreadChauffeurMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [dm, rm] = await Promise.all([
    supabaseAdmin
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender", "client")
      .eq("read_by_chauffeur", false),
    supabaseAdmin
      .from("reservation_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender", "client")
      .eq("read_by_chauffeur", false),
  ]);

  if (dm.error) throw dm.error;
  if (rm.error) throw rm.error;

  return (dm.count ?? 0) + (rm.count ?? 0);
});

export const countUnreadChauffeurForReservation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("reservation_messages")
      .select("id", { count: "exact", head: true })
      .eq("reservation_id", data.reservation_id)
      .eq("sender", "client")
      .eq("read_by_chauffeur", false);
    if (error) throw error;
    return count ?? 0;
  });

// Compteur client : messages du chauffeur non lus pour une réservation donnée.
// Comptage SQL exact (COUNT côté serveur), identique dans sa forme à
// countUnreadChauffeurForReservation, pour garantir que les deux badges
// (chauffeur / client) reflètent strictement la même vérité que la BDD.
export const countUnreadClientForReservation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ suivi_key: z.string().trim().min(6).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const r = await resolveSuiviReservation(data.suivi_key);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Compte tout message non lu côté client — inclut la "demande spéciale"
    // insérée à la création (sender=client, read_by_client=false) pour que le
    // badge s'incrémente immédiatement sur /suivi/$id.
    const { count, error } = await supabaseAdmin
      .from("reservation_messages")
      .select("id", { count: "exact", head: true })
      .eq("reservation_id", r.id)
      .eq("read_by_client", false);
    if (error) throw error;
    return count ?? 0;
  });

// Liste des réservations ayant au moins un message client non lu par le
// chauffeur — utilisé pour ne jamais rater une "demande spéciale" côté driver,
// même si la réservation n'est plus dans les statuts actifs.
export const listReservationsWithUnreadChauffeur = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reservation_messages")
      .select("reservation_id")
      .eq("sender", "client")
      .eq("read_by_chauffeur", false);
    if (error) throw error;
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.reservation_id).filter(Boolean)));
    return ids as string[];
  },
);

// Version "par ID de réservation" du compteur client — utilisée côté chauffeur
// pour afficher un indicateur "message envoyé, pas encore lu par le client".
export const countUnreadClientForReservationById = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("reservation_messages")
      .select("id", { count: "exact", head: true })
      .eq("reservation_id", data.reservation_id)
      .eq("sender", "chauffeur")
      .eq("read_by_client", false);
    if (error) throw error;
    return count ?? 0;
  });

// Batch : renvoie, pour chaque réservation demandée, le nombre de messages
// non lus par le chauffeur et par le client (COUNT SQL agrégé côté serveur).
// Utilisé par CoursesTab pour prioriser les cartes sans faire N appels.
export type UnreadMap = Record<string, { unread_chauffeur: number; unread_client: number }>;
export const getUnreadCountsForReservations = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ reservation_ids: z.array(z.string().uuid()).max(500) }).parse(input),
  )
  .handler(async ({ data }): Promise<UnreadMap> => {
    if (data.reservation_ids.length === 0) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reservation_messages")
      .select("reservation_id,sender,read_by_chauffeur,read_by_client")
      .in("reservation_id", data.reservation_ids);
    if (error) throw error;
    const out: UnreadMap = {};
    for (const id of data.reservation_ids) out[id] = { unread_chauffeur: 0, unread_client: 0 };
    for (const r of rows ?? []) {
      const entry = out[(r as any).reservation_id];
      if (!entry) continue;
      if ((r as any).sender === "client" && !(r as any).read_by_chauffeur) entry.unread_chauffeur += 1;
      if ((r as any).sender === "chauffeur" && !(r as any).read_by_client) entry.unread_client += 1;
    }
    return out;
  });





function normPhone(p?: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/\D+/g, "");
  return d.length >= 6 ? d.slice(-9) : null;
}
function normEmail(e?: string | null): string | null {
  if (!e) return null;
  const s = String(e).trim().toLowerCase();
  return s.length > 3 && s.includes("@") ? s : null;
}

// Identité canonique d'un client, quelle que soit la source (direct, résa avec
// ou sans account_id). On préfère account_id, puis email, puis phone tail.
type ClientIdentity = {
  key: string;
  account_id: string | null;
  email: string | null;
  phone_tail: string | null;
  name: string | null;
  phone_display: string | null;
};

export const listMergedChauffeurThreads = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Direct messages
  const { data: directs } = await supabaseAdmin
    .from("direct_messages")
    .select("client_account_id,sender,content,read_by_chauffeur,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  // 2) Reservation messages
  const { data: resaMsgs } = await supabaseAdmin
    .from("reservation_messages")
    .select("reservation_id,sender,content,read_by_chauffeur,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  // 3) Réservations concernées (résolution client)
  const resaIds = Array.from(new Set((resaMsgs ?? []).map((m: any) => m.reservation_id)));
  let resaMap = new Map<string, any>();
  if (resaIds.length > 0) {
    const { data: resas } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, client_account_id, client_name, nom, client_phone, telephone, client_email, email, depart, destination, arrivee, status, pickup_datetime",
      )
      .in("id", resaIds);
    resaMap = new Map((resas ?? []).map((r: any) => [r.id, r]));
  }

  // 4) TOUS les comptes clients — permet de rattacher une résa "invitée"
  //    (sans account_id) à un compte existant via email/phone.
  const { data: allAccts } = await supabaseAdmin
    .from("client_accounts")
    .select("id, client_name, email, phone");
  const acctById = new Map<string, any>();
  const acctByEmail = new Map<string, any>();
  const acctByPhone = new Map<string, any>();
  for (const a of (allAccts ?? []) as any[]) {
    acctById.set(a.id, a);
    const em = normEmail(a.email);
    if (em) acctByEmail.set(em, a);
    const ph = normPhone(a.phone);
    if (ph) acctByPhone.set(ph, a);
  }

  // Résout l'identité canonique d'un message
  function identityForDirect(accountId: string): ClientIdentity {
    const a = acctById.get(accountId);
    return {
      key: `a:${accountId}`,
      account_id: accountId,
      email: normEmail(a?.email) ?? null,
      phone_tail: normPhone(a?.phone) ?? null,
      name: a?.client_name ?? a?.email ?? "Client",
      phone_display: a?.phone ?? null,
    };
  }
  function identityForResa(r: any): ClientIdentity {
    // 1) account_id explicite
    if (r.client_account_id && acctById.has(r.client_account_id)) {
      const a = acctById.get(r.client_account_id);
      return {
        key: `a:${r.client_account_id}`,
        account_id: r.client_account_id,
        email: normEmail(a?.email) ?? normEmail(r.client_email || r.email),
        phone_tail: normPhone(a?.phone) ?? normPhone(r.client_phone || r.telephone),
        name: a?.client_name ?? r.client_name ?? r.nom ?? "Client",
        phone_display: a?.phone ?? r.client_phone ?? r.telephone ?? null,
      };
    }
    // 2) email match un compte
    const em = normEmail(r.client_email || r.email);
    if (em && acctByEmail.has(em)) {
      const a = acctByEmail.get(em);
      return {
        key: `a:${a.id}`,
        account_id: a.id,
        email: em,
        phone_tail: normPhone(a.phone) ?? normPhone(r.client_phone || r.telephone),
        name: a.client_name ?? r.client_name ?? r.nom ?? em,
        phone_display: a.phone ?? r.client_phone ?? r.telephone ?? null,
      };
    }
    // 3) phone match un compte
    const ph = normPhone(r.client_phone || r.telephone);
    if (ph && acctByPhone.has(ph)) {
      const a = acctByPhone.get(ph);
      return {
        key: `a:${a.id}`,
        account_id: a.id,
        email: normEmail(a.email) ?? em,
        phone_tail: ph,
        name: a.client_name ?? r.client_name ?? r.nom ?? "Client",
        phone_display: a.phone ?? r.client_phone ?? r.telephone ?? null,
      };
    }
    // 4) email seul (invité récurrent)
    if (em) {
      return {
        key: `e:${em}`,
        account_id: null,
        email: em,
        phone_tail: ph,
        name: r.client_name ?? r.nom ?? em,
        phone_display: r.client_phone ?? r.telephone ?? null,
      };
    }
    // 5) phone seul
    if (ph) {
      return {
        key: `p:${ph}`,
        account_id: null,
        email: null,
        phone_tail: ph,
        name: r.client_name ?? r.nom ?? "Client",
        phone_display: r.client_phone ?? r.telephone ?? null,
      };
    }
    // 6) dernier recours : la course elle-même
    return {
      key: `r:${r.id}`,
      account_id: null,
      email: null,
      phone_tail: null,
      name: r.client_name ?? r.nom ?? "Client",
      phone_display: null,
    };
  }

  type Bucket = {
    thread_key: string;
    client_account_id: string | null;
    client_phone: string | null;
    client_email: string | null;
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
  // Alias : plusieurs clés secondaires (email/phone) pointent vers la clé
  // primaire (account) — garantit qu'une résa "invitée" ré-utilisée après
  // création de compte se retrouve dans le même fil.
  const aliases = new Map<string, string>();
  function resolveKey(k: string): string {
    let cur = k;
    for (let i = 0; i < 4 && aliases.has(cur); i++) cur = aliases.get(cur)!;
    return cur;
  }
  function bindAliases(id: ClientIdentity) {
    const primary = id.key;
    const secondaries: string[] = [];
    if (id.email) secondaries.push(`e:${id.email}`);
    if (id.phone_tail) secondaries.push(`p:${id.phone_tail}`);
    for (const s of secondaries) {
      if (s === primary) continue;
      // Si un bucket existait déjà sur cette clé secondaire, on le fusionne
      const existing = buckets.get(resolveKey(s));
      const target = buckets.get(resolveKey(primary));
      if (existing && target && existing !== target) {
        // Fusion des données
        for (const rid of existing.reservation_ids) target.reservation_ids.add(rid);
        target.unread += existing.unread;
        if (!target.last_at || existing.last_at > target.last_at) {
          target.last_at = existing.last_at;
          target.last_content = existing.last_content;
          target.last_source = existing.last_source;
        }
        target.client_email = target.client_email ?? existing.client_email;
        target.client_phone = target.client_phone ?? existing.client_phone;
        if (existing.active_pickup_at && (!target.active_pickup_at || existing.active_pickup_at > target.active_pickup_at)) {
          target.active_reservation_id = existing.active_reservation_id;
          target.active_pickup_at = existing.active_pickup_at;
          target.active_reservation_label = existing.active_reservation_label;
        }
        buckets.delete(existing.thread_key);
      }
      aliases.set(s, primary);
    }
  }

  function getBucket(id: ClientIdentity): Bucket {
    const key = resolveKey(id.key);
    let b = buckets.get(key);
    if (!b) {
      b = {
        thread_key: key,
        client_account_id: id.account_id,
        client_phone: id.phone_display,
        client_email: id.email,
        client_name: id.name,
        reservation_ids: new Set<string>(),
        active_reservation_id: null,
        active_pickup_at: null,
        active_reservation_label: null,
        last_at: "",
        last_content: "",
        last_source: "direct",
        unread: 0,
      };
      buckets.set(key, b);
    } else {
      // enrichit avec les infos manquantes
      b.client_account_id = b.client_account_id ?? id.account_id;
      b.client_email = b.client_email ?? id.email;
      b.client_phone = b.client_phone ?? id.phone_display;
      if (!b.client_name || b.client_name === "Client") b.client_name = id.name ?? b.client_name;
    }
    bindAliases(id);
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
    if (!m.client_account_id) continue;
    const id = identityForDirect(m.client_account_id);
    const b = getBucket(id);
    updateLast(b, m, "direct");
    if (m.sender === "client" && !m.read_by_chauffeur) b.unread += 1;
  }

  // Reservation
  for (const m of (resaMsgs ?? []) as any[]) {
    const r = resaMap.get(m.reservation_id);
    if (!r) continue;
    const id = identityForResa(r);
    const b = getBucket(id);
    b.reservation_ids.add(m.reservation_id);
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

// Supprime définitivement une conversation fusionnée côté chauffeur
// (direct_messages du client + reservation_messages de toutes ses courses listées)
export const deleteMergedThread = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        client_account_id: z.string().uuid().nullable().optional(),
        reservation_ids: z.array(z.string().uuid()).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let deleted = 0;
    if (data.client_account_id) {
      const { count } = await supabaseAdmin
        .from("direct_messages")
        .delete({ count: "exact" })
        .eq("client_account_id", data.client_account_id);
      deleted += count ?? 0;
    }
    const rids = data.reservation_ids ?? [];
    if (rids.length > 0) {
      const { count } = await supabaseAdmin
        .from("reservation_messages")
        .delete({ count: "exact" })
        .in("reservation_id", rids);
      deleted += count ?? 0;
    }
    return { ok: true, deleted };
  });
