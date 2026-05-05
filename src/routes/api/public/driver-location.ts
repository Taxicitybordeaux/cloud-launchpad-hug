import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const Schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
  speed: z.number().min(0).max(500).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  is_online: z.boolean(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-driver-key",
};

export const Route = createFileRoute("/api/public/driver-location")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const key = request.headers.get("x-driver-key");
        if (!key || key !== process.env.DRIVER_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        let body;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        const { data: existing } = await supabaseAdmin
          .from("driver_location").select("id").limit(1).maybeSingle();
        const payload = { ...parsed.data, updated_at: new Date().toISOString() };
        if (existing?.id) {
          await supabaseAdmin.from("driver_location").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("driver_location").insert(payload);
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      },
    },
  },
});
