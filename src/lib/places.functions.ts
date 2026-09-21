// Autocomplétion d'adresses via le connecteur Google Maps géré par Lovable.
// Les appels passent par la passerelle côté serveur : aucune clé Google n'est
// exposée au navigateur et la facturation du projet Google du client n'est pas requise.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

// Biais de recherche : agglomération bordelaise (~40 km autour du centre).
const BORDEAUX_BIAS = {
  circle: {
    center: { latitude: 44.8378, longitude: -0.5792 },
    radius: 40000,
  },
};

function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Google Maps connector credentials are missing");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
  };
}

export type PlaceSuggestion = { placeId: string; label: string };

export const autocompletePlaces = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        input: z.string().min(3).max(200),
        sessionToken: z.string().max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        locationBias: BORDEAUX_BIAS,
        includedRegionCodes: ["fr"],
        languageCode: "fr",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Places autocomplete failed [${res.status}]: ${body}`);
      throw new Error(`Places autocomplete failed [${res.status}]`);
    }
    const json: any = await res.json();
    const suggestions: PlaceSuggestion[] = (json?.suggestions ?? [])
      .map((s: any) => ({
        placeId: s?.placePrediction?.placeId as string | undefined,
        label: s?.placePrediction?.text?.text as string | undefined,
      }))
      .filter((s: any): s is PlaceSuggestion => Boolean(s.placeId && s.label))
      .slice(0, 5);
    return suggestions;
  });

export type PlaceDetail = { label: string; lat: number; lng: number };

export const getPlaceDetail = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        placeId: z.string().min(3).max(300),
        sessionToken: z.string().max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PlaceDetail | null> => {
    const url = new URL(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}`);
    url.searchParams.set("languageCode", "fr");
    if (data.sessionToken) url.searchParams.set("sessionToken", data.sessionToken);
    const res = await fetch(url.toString(), {
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask": "formattedAddress,displayName,location",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Place details failed [${res.status}]: ${body}`);
      throw new Error(`Place details failed [${res.status}]`);
    }
    const json: any = await res.json();
    const lat = json?.location?.latitude;
    const lng = json?.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const name = json?.displayName?.text as string | undefined;
    const addr = json?.formattedAddress as string | undefined;
    const label = name && addr && !addr.startsWith(name) ? `${name}, ${addr}` : (addr ?? name ?? "");
    return { label, lat, lng };
  });
