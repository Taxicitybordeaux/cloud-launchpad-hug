// supabase/functions/osrm-route/index.ts
// Déployer avec : supabase functions deploy osrm-route --project-ref TON_PROJECT_REF

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OSRM_DISTANCE_FACTOR = 1.0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { from_lng, from_lat, to_lng, to_lat } = await req.json();

    if (from_lng == null || from_lat == null || to_lng == null || to_lat == null) {
      return new Response(JSON.stringify({ error: true, message: "Paramètres manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from_lng},${from_lat};${to_lng},${to_lat}` +
      `?overview=false&alternatives=3&steps=false`;

    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: true, message: "OSRM unreachable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();

    if (!json.routes || json.routes.length === 0) {
      return new Response(JSON.stringify({ error: true, message: "Aucun itinéraire trouvé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trajet le plus LONG parmi les alternatives
    const longest = json.routes.reduce((best: any, r: any) => (r.distance > best.distance ? r : best));

    const distance_km = Math.round((longest.distance / 1000) * OSRM_DISTANCE_FACTOR * 10) / 10;
    const duration_sec = Math.round(longest.duration);

    return new Response(JSON.stringify({ distance_km, duration_sec }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: true, message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
