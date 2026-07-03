import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

const Schema = z.object({
  latitude: z.number().min(43.5).max(46.2),
  longitude: z.number().min(-2.2).max(1),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
  speed: z.number().min(0).max(500).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  is_online: z.boolean(),
  driver_key: z.string().min(8).max(200).optional(),
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
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400, headers: corsHeaders });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.flatten() }, { status: 400, headers: corsHeaders });
        }

        const expected = process.env.DRIVER_KEY ?? "";
        const provided = request.headers.get("x-driver-key") ?? parsed.data.driver_key ?? "";
        if (!expected || !safeKeyEqual(provided, expected)) {
          return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin.from("driver_gps").upsert(
          {
            id: "driver",
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
            accuracy: parsed.data.accuracy ?? null,
            is_active: parsed.data.is_online,
            updated_at: now,
            heartbeat_at: now,
          },
          { onConflict: "id" },
        );

        if (error) return Response.json({ error: "write failed" }, { status: 500, headers: corsHeaders });
        return Response.json({ ok: true }, { headers: corsHeaders });
      },
    },
  },
});