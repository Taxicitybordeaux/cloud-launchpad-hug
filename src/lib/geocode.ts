// src/lib/geocode.ts

const DEFAULT_GEOCODER = (import.meta.env.VITE_GEOCODER_URL as string) || "https://nominatim.openstreetmap.org";
const DEFAULT_GEOCODER_KEY = (import.meta.env.VITE_GEOCODER_API_KEY as string) || "";
const DEFAULT_GEOCODER_KEY_PARAM = (import.meta.env.VITE_GEOCODER_KEY_PARAM as string) || "key";

export const GEOCODER_BASE = DEFAULT_GEOCODER.replace(/\/+$/g, "");
export const GEOCODER_API_KEY = DEFAULT_GEOCODER_KEY.trim();
export const GEOCODER_API_KEY_PARAM = DEFAULT_GEOCODER_KEY_PARAM.trim();

export type Coord = { lat: number; lng: number };
export type AutocompleteResult = { label: string; coord: [number, number] };

function appendApiKey(url: URL) {
  if (GEOCODER_API_KEY) {
    url.searchParams.set(GEOCODER_API_KEY_PARAM || "key", GEOCODER_API_KEY);
  }
}

export async function searchAddress(query: string, limit = 5): Promise<AutocompleteResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = new URL(`${GEOCODER_BASE}/search`);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("countrycodes", "fr");
    url.searchParams.set("accept-language", "fr");
    appendApiKey(url);
    const res = await fetch(url.toString(), { headers: { "Accept-Language": "fr" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data ?? []).slice(0, limit).map((item: any) => ({
      label: item.display_name ?? item.name ?? query,
      coord: [Number(item.lat), Number(item.lon)],
    }));
  } catch {
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<Coord | null> {
  const results = await searchAddress(query, 1);
  return results[0] ? { lat: results[0].coord[0], lng: results[0].coord[1] } : null;
}

export function getCurrentPosition(
  options?: PositionOptions,
  timeout = 10000,
): Promise<(Coord & { accuracy?: number }) | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let timedOut = false;
    const to = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, timeout);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (timedOut) return;
        clearTimeout(to);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      () => {
        if (timedOut) return;
        clearTimeout(to);
        resolve(null);
      },
      options,
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = new URL(`${GEOCODER_BASE}/reverse`);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "fr");
    appendApiKey(url);
    const res = await fetch(url.toString(), { headers: { "Accept-Language": "fr" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    const a = data.address ?? {};
    const parts = [
      a.house_number,
      a.road ?? a.pedestrian ?? a.footway,
      a.city ?? a.town ?? a.village ?? a.municipality,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : (data.display_name ?? null);
  } catch {
    return null;
  }
}
