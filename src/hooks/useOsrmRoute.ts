// src/hooks/useOsrmRoute.ts
// Wrapper React autour de getLongestRoute() (src/lib/osrm.ts) pour garder
// l'API existante (data/loading/error/getRoute). Passe par l'Edge Function
// Supabase `osrm-route` (cache, timeout, règle rocade côté serveur).

import { useState, useCallback } from "react";
import { getLongestRoute } from "@/lib/osrm";

export interface OsrmResult {
  distance_km: number;
  duration_sec: number;
  raw_distance_m: number;
  factor_applied: number;
}

interface OsrmState {
  data: OsrmResult | null;
  loading: boolean;
  error: string | null;
}

export function useOsrmRoute() {
  const [state, setState] = useState<OsrmState>({ data: null, loading: false, error: null });

  const getRoute = useCallback(
    async (fromLng: number, fromLat: number, toLng: number, toLat: number) => {
      setState({ data: null, loading: true, error: null });
      try {
        const r = await getLongestRoute([fromLat, fromLng], [toLat, toLng]);
        if (!r.distanceKm || !r.durationSec) {
          const err = "Aucun itinéraire trouvé";
          setState({ data: null, loading: false, error: err });
          return null;
        }
        const result: OsrmResult = {
          distance_km: r.distanceKm,
          duration_sec: r.durationSec,
          raw_distance_m: r.distanceKm * 1000,
          factor_applied: 1,
        };
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    [],
  );

  return { ...state, getRoute };
}
