import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

const Schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
  speed: z.number().min(0).max(500).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  is_online: z.boolean(),
});

const ALLOWED_ORIGINS = new Set([
  "https://taxicitybordeaux.fr",
  "https://www.taxicitybordeaux.fr",
  "https://cloud-launchpad-hug.lovable.app",
]);
const DEFAULT_ORIGIN = "https://taxicitybordeaux.fr";

function corsFor(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-driver-key",
    Vary: "Origin",
  };
}

function safeKeyEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export const Route = createFileRoute("/api/public/driver-location")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsFor(request) }),
      POST: async ({ request }) => {
        const corsHeaders = corsFor(request);
        const key = request.headers.get("x-driver-key") ?? "";
        const expected = process.env.DRIVER_KEY ?? "";
        if (!expected || !safeKeyEqual(key, expected)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        const { data: existing } = await supabaseAdmin.from("driver_location").select("id").limit(1).maybeSingle();
        const payload = { ...parsed.data, updated_at: new Date().toISOString() };
        if (existing?.id) {
          await supabaseAdmin.from("driver_location").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("driver_location").insert(payload);
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      },
    },
  },
});
