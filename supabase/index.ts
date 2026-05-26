// supabase/functions/osrm-route/index.ts
// Déployer avec : supabase functions deploy osrm-route --project-ref TON_PROJECT_REF

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { from_lng, from_lat, to_lng, to_lat } = await req.json();

    if (
      from_lng == null || from_lat == null ||
      to_lng == null   || to_lat == null
    ) {
      return new Response(
        JSON.stringify({ error: true, message: "Paramètres manquants : from_lng, from_lat, to_lng, to_lat requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client Supabase avec la clé service (jamais exposée côté client)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("get_osrm_route", {
      from_lng,
      from_lat,
      to_lng,
      to_lat,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: true, message: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: true, message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
