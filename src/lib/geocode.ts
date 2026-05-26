// src/lib/geocode.ts
// Toutes les requêtes Nominatim passent par l'Edge Function Supabase
// pour éviter les blocages CORS depuis le navigateur.

const SUPABASE_URL = "https://auiagkpdpnfqxfngisfc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWFna3BkcG5mcXhmbmdpc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzU2NzUsImV4cCI6MjA5NDAxMTY3NX0.MkW2KzCYHvQ0GEjjP3_puf3PkCHWaYcvW2bI1ctTuJU";

const EDGE = `${SUPABASE_URL}/functions/v1/geocode`;

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

export type Coord = { lat: number; lng: number };
export type AutocompleteResult = { label: string; coord: [number, number] };

// ─── searchAddress ────────────────────────────────────────────────────────────
export async function searchAddress(query: string, limit = 5): Promise<AutocompleteResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(EDGE, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ type: "search", query: query.trim(), limit }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).map((item: any) => ({
      label: item.display_name ?? item.name ?? query,
      coord: [Number(item.lat), Number(item.lon)] as [number, number],
    }));
  } catch {
    return [];
  }
}

// ─── geocodeAddress ───────────────────────────────────────────────────────────
export async function geocodeAddress(query: string): Promise<Coord | null> {
  const results = await searchAddress(query, 1);
  return results[0] ? { lat: results[0].coord[0], lng: results[0].coord[1] } : null;
}

// ─── reverseGeocode ───────────────────────────────────────────────────────────
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(EDGE, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ type: "reverse", lat, lon: lng }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.error) return null;
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

// ─── getCurrentPosition ───────────────────────────────────────────────────────
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
