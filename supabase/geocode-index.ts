// supabase/functions/geocode/index.ts
// Déployer avec : supabase functions deploy geocode --project-ref auiagkpdpnfqxfngisfc

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, query, lat, lon, limit } = await req.json();

    let url: string;

    if (type === "search") {
      // Geocodage : texte → coordonnées
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: String(limit ?? 5),
        "accept-language": "fr",
      });
      url = `https://nominatim.openstreetmap.org/search?${params}`;
    } else if (type === "reverse") {
      // Geocodage inverse : coordonnées → adresse
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        format: "json",
        addressdetails: "1",
        "accept-language": "fr",
      });
      url = `https://nominatim.openstreetmap.org/reverse?${params}`;
    } else {
      return new Response(JSON.stringify({ error: "type invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "TaxiCityBordeaux/1.0 (taxicitybordeaux.fr)",
        "Accept-Language": "fr",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Nominatim error", status: res.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
