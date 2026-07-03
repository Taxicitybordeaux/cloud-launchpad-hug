import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const TAXI_SUPABASE_URL = "https://auiagkpdpnfqxfngisfc.supabase.co";

type KeyCandidate = {
  name: string;
  value: string;
  ref: string | null;
};

let cachedAdmin: ReturnType<typeof createClient<Database>> | null = null;

function projectRefFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function decodeJwtRef(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded?.ref === "string" ? decoded.ref : null;
  } catch {
    return null;
  }
}

function serviceKeyCandidates(): KeyCandidate[] {
  // Ordre de priorité : TAXI_SERVICE_KEY est LA clé dédiée au projet taxi
  // (auiagkpdpnfqxfngisfc). Les autres appartiennent au projet Lovable Cloud
  // (yxbbkzugsreztiacnswf) et NE DOIVENT PAS être utilisées ici — utiliser
  // SUPABASE_SERVICE_ROLE_KEY comme fallback pointerait sur la mauvaise base
  // et casserait toutes les lectures/écritures push (RLS / permission denied).
  return [
    { name: "TAXI_SERVICE_KEY", value: process.env.TAXI_SERVICE_KEY || "", ref: decodeJwtRef(process.env.TAXI_SERVICE_KEY) },
    { name: "SERVICE_ROLE_KEY", value: process.env.SERVICE_ROLE_KEY || "", ref: decodeJwtRef(process.env.SERVICE_ROLE_KEY) },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      value: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      ref: decodeJwtRef(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  ].filter((candidate) => candidate.value.length > 0);
}

export function getTaxiSupabaseConfig() {
  const supabaseUrl = TAXI_SUPABASE_URL;
  const targetRef = projectRefFromUrl(supabaseUrl);
  const candidates = serviceKeyCandidates();

  // 1) Priorité : une clé dont le ref JWT matche exactement le projet taxi.
  // 2) Sinon : TAXI_SERVICE_KEY même si non-JWT (format sb_secret_*), on lui
  //    fait confiance car elle est explicitement nommée pour ce projet.
  // 3) Sinon : rejeter — refuser de tomber sur une clé d'un AUTRE projet
  //    (Lovable Cloud) qui provoquerait des erreurs RLS silencieuses.
  const exactMatch = candidates.find((c) => c.ref && c.ref === targetRef);
  const taxiExplicit = candidates.find((c) => c.name === "TAXI_SERVICE_KEY");
  const wrongProject = candidates.filter((c) => c.ref && c.ref !== targetRef);
  const matched = exactMatch ?? taxiExplicit;

  if (!matched) {
    if (wrongProject.length > 0) {
      throw new Error(
        `Missing TAXI_SERVICE_KEY for project ${targetRef}. Found service keys for other projects: ${wrongProject
          .map((c) => `${c.name}(${c.ref})`)
          .join(", ")}. Refusing to use them — set TAXI_SERVICE_KEY to the service_role key of ${targetRef}.`,
      );
    }
    throw new Error(`Missing service key for Taxi City backend (${targetRef})`);
  }

  if (matched.ref && matched.ref !== targetRef) {
    // Ne devrait jamais arriver via la logique ci-dessus, garde-fou.
    throw new Error(`Service key ${matched.name} belongs to project ${matched.ref}, not ${targetRef}`);
  }

  console.log("[taxi-backend] service key selected", {
    targetRef,
    key: matched.name,
    keyFormat: matched.ref ? "jwt" : "opaque",
  });

  return { supabaseUrl, serviceKey: matched.value, targetRef, selectedKeyName: matched.name, selectedRef: matched.ref };
}

export function getTaxiSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const { supabaseUrl, serviceKey } = getTaxiSupabaseConfig();
  cachedAdmin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  });
  return cachedAdmin;
}