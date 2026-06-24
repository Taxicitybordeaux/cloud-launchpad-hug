import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ClientFavorite = {
  id: string;
  client_id: string;
  label: string;
  address: string;
  icon: string | null;
  sort_order: number;
};

const ListSchema = z.object({ account_id: z.string().uuid() });
const UpsertSchema = z.object({
  account_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(2).max(300),
  icon: z.string().trim().max(40).optional().nullable(),
  sort_order: z.number().int().min(0).max(999).optional(),
});
const DeleteSchema = z.object({
  account_id: z.string().uuid(),
  id: z.string().uuid(),
});

export const listClientFavorites = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ListSchema.parse(input))
  .handler(async ({ data }): Promise<ClientFavorite[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("client_favorites")
      .select("id, client_id, label, address, icon, sort_order")
      .eq("client_id", data.account_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error("LIST_FAILED");
    return (rows ?? []) as ClientFavorite[];
  });

export const upsertClientFavorite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpsertSchema.parse(input))
  .handler(async ({ data }): Promise<ClientFavorite> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("client_favorites")
        .update({
          label: data.label,
          address: data.address,
          icon: data.icon ?? null,
          sort_order: data.sort_order ?? 0,
        })
        .eq("id", data.id)
        .eq("client_id", data.account_id)
        .select("id, client_id, label, address, icon, sort_order")
        .single();
      if (error || !row) throw new Error("UPDATE_FAILED");
      return row as ClientFavorite;
    }
    const { data: row, error } = await supabaseAdmin
      .from("client_favorites")
      .insert({
        client_id: data.account_id,
        label: data.label,
        address: data.address,
        icon: data.icon ?? null,
        sort_order: data.sort_order ?? 0,
      })
      .select("id, client_id, label, address, icon, sort_order")
      .single();
    if (error || !row) throw new Error("CREATE_FAILED");
    return row as ClientFavorite;
  });

export const deleteClientFavorite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_favorites")
      .delete()
      .eq("id", data.id)
      .eq("client_id", data.account_id);
    if (error) throw new Error("DELETE_FAILED");
    return { ok: true };
  });
