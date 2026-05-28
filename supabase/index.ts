import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImNhMGVmYTZiNGQ2MzQ3ZGJhZDJmMmY0ZDc2YjYyYTIwIiwiaCI6Im11cm11cjY0In0=";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { from_lng, from_lat, to_lng, to_lat, overview, geometries, alternatives } = await req.json();

    if (from_lng == null || from_lat == null || to_lng == null || to_lat == null) {
      return new Response(JSON.stringify({ error: true, message: "Paramètres manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OpenRouteService Directions API
    // Format : [longitude, latitude]
    const body = {
      coordinates: [
        [from_lng, from_lat],
        [to_lng, to_lat],
      ],
      preference: "recommended", // itinéraire recommandé (le plus rapide/pratique)
      units: "km",
      language: "fr-FR",
      ...(overview ? { geometry: true, geometry_format: geometries ?? "geojson" } : {}),
    };

    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: true, message: `ORS error: ${errText}` }), {
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

    const route = json.routes[0];
    const distance_km = Math.round(route.summary.distance * 10) / 10; // déjà en km (units: "km")
    const duration_sec = Math.round(route.summary.duration); // en secondes

    // Si la géométrie est demandée (pour la carte admin)
    if (overview && route.geometry) {
      return new Response(
        JSON.stringify({
          distance_km,
          duration_sec,
          geometry: route.geometry, // GeoJSON LineString
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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
