import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DriverAvis = {
  id: string;
  author_name: string;
  note: number;
  commentaire: string | null;
  created_at: string;
  status: string;
  reservation_id: string | null;
  chauffeur_id: string | null;
};

export const getRideReviewState = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reservation_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();

    const { data: row, error } = await supabaseAdmin
      .from("avis")
      .select("id,status")
      .eq("reservation_id", data.reservation_id)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { hasReview: !!row, status: row?.status ?? null };
  });

export const submitRideReview = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        author_name: z.string().trim().min(1).max(80).optional().nullable(),
        note: z.number().int().min(1).max(5),
        commentaire: z.string().trim().max(900).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("avis")
      .select("id,status")
      .eq("reservation_id", data.reservation_id)
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) return { ok: true, alreadySubmitted: true, id: existing.id, status: existing.status };

    let authorName = data.author_name?.trim() || "";
    if (!authorName) {
      const { data: reservation } = await supabaseAdmin
        .from("reservations")
        .select("client_name,nom")
        .eq("id", data.reservation_id)
        .maybeSingle();
      authorName = (reservation?.client_name || reservation?.nom || "Client").trim();
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("avis")
      .insert({
        reservation_id: data.reservation_id,
        author_name: authorName.slice(0, 80) || "Client",
        note: data.note,
        commentaire: data.commentaire?.trim() || null,
        status: "pending",
      })
      .select("id,status")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, alreadySubmitted: false, id: inserted.id, status: inserted.status };
  });

export const listDriverAvis = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const expected = (process.env.DRIVER_PANEL_TOKEN || "DSF234").trim();
    if (data.token !== expected) throw new Error("Accès chauffeur refusé");

    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const columns = "id,author_name,note,commentaire,created_at,status,reservation_id,chauffeur_id";

    const [{ data: pending, error: pendingError }, { data: published, error: publishedError }] = await Promise.all([
      supabaseAdmin.from("avis").select(columns).eq("status", "pending").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("avis")
        .select(columns)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (pendingError) throw new Error(pendingError.message);
    if (publishedError) throw new Error(publishedError.message);
    return { pending: (pending ?? []) as DriverAvis[], published: (published ?? []) as DriverAvis[] };
  });

export const moderateDriverAvis = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(1).max(120),
        id: z.string().uuid(),
        status: z.enum(["approved", "refused"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expected = (process.env.DRIVER_PANEL_TOKEN || "DSF234").trim();
    if (data.token !== expected) throw new Error("Accès chauffeur refusé");

    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const { error } = await supabaseAdmin.from("avis").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDriverAvis = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(1).max(120), id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const expected = (process.env.DRIVER_PANEL_TOKEN || "DSF234").trim();
    if (data.token !== expected) throw new Error("Accès chauffeur refusé");

    const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
    const supabaseAdmin = getTaxiSupabaseAdmin();
    const { error } = await supabaseAdmin.from("avis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });