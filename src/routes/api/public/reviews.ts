import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const DRIVER_TOKEN = "DSF234";

const submitSchema = z.object({
  reservation_id: z.string().uuid().optional().nullable(),
  author_name: z.string().trim().min(1).max(80).optional().nullable(),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().trim().max(900).optional().nullable(),
});

const moderateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "refused"]),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

function tokenFrom(request: Request) {
  const url = new URL(request.url);
  return request.headers.get("x-driver-token") || url.searchParams.get("token") || "";
}

function assertDriver(request: Request) {
  const expected = (process.env.DRIVER_PANEL_TOKEN || DRIVER_TOKEN).trim();
  if (tokenFrom(request) !== expected) return false;
  return true;
}

export const Route = createFileRoute("/api/public/reviews")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
        const supabase = getTaxiSupabaseAdmin();
        const url = new URL(request.url);
        const reservationId = url.searchParams.get("reservation_id");

        if (reservationId) {
          const parsed = z.string().uuid().safeParse(reservationId);
          if (!parsed.success) return Response.json({ error: "Invalid reservation" }, { status: 400 });
          const { data, error } = await supabase
            .from("avis")
            .select("id,status")
            .eq("reservation_id", parsed.data)
            .limit(1)
            .maybeSingle();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ hasReview: !!data, status: data?.status ?? null });
        }

        if (!assertDriver(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const columns = "id,author_name,note,commentaire,created_at,status,reservation_id,chauffeur_id";
        const [{ data: pending, error: pendingError }, { data: published, error: publishedError }] = await Promise.all([
          supabase.from("avis").select(columns).eq("status", "pending").order("created_at", { ascending: false }),
          supabase
            .from("avis")
            .select(columns)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        if (pendingError) return Response.json({ error: pendingError.message }, { status: 500 });
        if (publishedError) return Response.json({ error: publishedError.message }, { status: 500 });
        return Response.json({ pending: pending ?? [], published: published ?? [] });
      },

      POST: async ({ request }) => {
        const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
        const supabase = getTaxiSupabaseAdmin();
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = submitSchema.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
        const data = parsed.data;

        if (data.reservation_id) {
          const { data: existing, error: existingError } = await supabase
            .from("avis")
            .select("id,status")
            .eq("reservation_id", data.reservation_id)
            .limit(1)
            .maybeSingle();
          if (existingError) return Response.json({ error: existingError.message }, { status: 500 });
          if (existing) return Response.json({ ok: true, alreadySubmitted: true, id: existing.id, status: existing.status });
        }

        let authorName = data.author_name?.trim() || "";
        if (!authorName && data.reservation_id) {
          const { data: reservation } = await supabase
            .from("reservations")
            .select("client_name,nom")
            .eq("id", data.reservation_id)
            .maybeSingle();
          authorName = (reservation?.client_name || reservation?.nom || "Client").trim();
        }

        const { data: inserted, error } = await supabase
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
        if (error) return Response.json({ error: error.message }, { status: 500 });

        try {
          const { sendPushToAudience } = await import("@/lib/push.server");
          const stars = "★".repeat(data.note) + "☆".repeat(5 - data.note);
          const excerpt = (data.commentaire ?? "").trim().slice(0, 90);
          await sendPushToAudience("chauffeur", {
            title: `⭐ Nouvel avis ${stars}`,
            body: excerpt ? `${authorName} : « ${excerpt}${excerpt.length >= 90 ? "…" : ""} »` : `${authorName} vient de laisser un avis.`,
            url: "/driver?token=DSF234",
            tag: `new-review-${inserted.id}`,
          });
        } catch (error) {
          console.warn("[reviews] push notification failed", error);
        }

        return Response.json({ ok: true, alreadySubmitted: false, id: inserted.id, status: inserted.status });
      },

      PATCH: async ({ request }) => {
        if (!assertDriver(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = moderateSchema.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
        const { error } = await getTaxiSupabaseAdmin().from("avis").update({ status: parsed.data.status }).eq("id", parsed.data.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },

      DELETE: async ({ request }) => {
        if (!assertDriver(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { getTaxiSupabaseAdmin } = await import("@/lib/taxi-supabase.server");
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = deleteSchema.safeParse(raw);
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
        const { error } = await getTaxiSupabaseAdmin().from("avis").delete().eq("id", parsed.data.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});