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

        // Écriture dans driver_gps (table utilisée par le dashboard et la page suivi)
        const now = new Date().toISOString();
        const payload = {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          accuracy: parsed.data.accuracy ?? null,
          speed: parsed.data.speed ?? null,
          heading: parsed.data.heading ?? null,
          is_active: parsed.data.is_online,
          updated_at: now,
          heartbeat_at: now, // mis à jour à chaque appel GPS → fraîcheur côté suivi client
        };

        await supabaseAdmin.from("driver_gps").update(payload).eq("id", "driver");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      },
    },
  },
});
