// Client Supabase public (anon key) pour le projet Taxi City Bordeaux
// Utilisé côté client uniquement (Realtime, lecture publique).
// NE PAS utiliser pour des opérations admin — utiliser taxi-supabase.server.ts côté serveur.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const TAXI_SUPABASE_URL = "https://auiagkpdpnfqxfngisfc.supabase.co";
const TAXI_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWFna3BkcG5mcXhmbmdpc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzU2NzUsImV4cCI6MjA5NDAxMTY3NX0.MkW2KzCYHvQ0GEjjP3_puf3PkCHWaYcvW2bI1ctTuJU";

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

export function getTaxiSupabase() {
  if (cachedClient) return cachedClient;
  cachedClient = createClient<Database>(TAXI_SUPABASE_URL, TAXI_SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return cachedClient;
}
