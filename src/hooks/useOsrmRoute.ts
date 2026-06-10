// src/hooks/useOsrmRoute.ts
// Hook React à utiliser dans ton formulaire de réservation Lovable
// Appelle l'Edge Function Supabase osrm-route (Option B)

import { useState, useCallback } from "react";

export interface OsrmResult {
  distance_km: number;   // distance routière corrigée (facteur 1.32)
  duration_sec: number;  // durée estimée en secondes
  raw_distance_m: number; // distance brute OSRM en mètres
  factor_applied: number; // facteur de correction appliqué
}

interface OsrmState {
  data: OsrmResult | null;
  loading: boolean;
  error: string | null;
}

export function useOsrmRoute() {
  const [state, setState] = useState<OsrmState>({
    data: null,
    loading: false,
    error: null,
  });

  const getRoute = useCallback(
    async (fromLng: number, fromLat: number, toLng: number, toLat: number) => {
      setState({ data: null, loading: true, error: null });

      try {
        const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://auiagkpdpnfqxfngisfc.supabase.co";
        const supabaseAnonKey =
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWFna3BkcG5mcXhmbmdpc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzU2NzUsImV4cCI6MjA5NDAxMTY3NX0.MkW2KzCYHvQ0GEjjP3_puf3PkCHWaYcvW2bI1ctTuJU";

        const res = await fetch(`${supabaseUrl}/functions/v1/osrm-route`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            from_lng: fromLng,
            from_lat: fromLat,
            to_lng: toLng,
            to_lat: toLat,
          }),
        });

        const json = await res.json();

        if (!res.ok || json?.error) {
          throw new Error(json?.message ?? `Erreur HTTP ${res.status}`);
        }

        setState({ data: json as OsrmResult, loading: false, error: null });
        return json as OsrmResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    []
  );

  return { ...state, getRoute };
}

// ─── EXEMPLE D'UTILISATION dans ton composant de réservation ────────────────
//
// import { useOsrmRoute } from "@/hooks/useOsrmRoute";
//
// function ReservationForm() {
//   const { data, loading, error, getRoute } = useOsrmRoute();
//
//   // Appelle ça quand l'utilisateur valide son adresse de destination :
//   const handleAddressConfirmed = async () => {
//     const result = await getRoute(
//       -0.5792, 44.8378,   // from : lon, lat (ex: géocodage de l'adresse départ)
//       -0.5561, 44.8259    // to   : lon, lat (ex: géocodage de l'adresse arrivée)
//     );
//     if (result) {
//       console.log(`Distance : ${result.distance_km} km`);
//       console.log(`Durée : ${Math.round(result.duration_sec / 60)} min`);
//     }
//   };
//
//   return (
//     <div>
//       <button onClick={handleAddressConfirmed} disabled={loading}>
//         {loading ? "Calcul en cours…" : "Calculer le trajet"}
//       </button>
//
//       {error && <p className="text-red-500">{error}</p>}
//
//       {data && (
//         <div>
//           <p>Distance : {data.distance_km} km</p>
//           <p>Durée estimée : {Math.round(data.duration_sec / 60)} min</p>
//         </div>
//       )}
//     </div>
//   );
// }
