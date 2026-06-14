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
  return [
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      value: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      ref: decodeJwtRef(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    { name: "SERVICE_ROLE_KEY", value: process.env.SERVICE_ROLE_KEY || "", ref: decodeJwtRef(process.env.SERVICE_ROLE_KEY) },
    { name: "TAXI_SERVICE_KEY", value: process.env.TAXI_SERVICE_KEY || "", ref: decodeJwtRef(process.env.TAXI_SERVICE_KEY) },
  ].filter((candidate) => candidate.value.length > 0);
}

export function getTaxiSupabaseConfig() {
  const supabaseUrl = TAXI_SUPABASE_URL;
  const targetRef = projectRefFromUrl(supabaseUrl);
  const candidates = serviceKeyCandidates();
  const matched = candidates.find((candidate) => candidate.ref && candidate.ref === targetRef) ?? candidates[0];

  if (!matched) {
    throw new Error("Missing service key for Taxi City backend");
  }

  if (matched.ref && targetRef && matched.ref !== targetRef) {
    console.error("[taxi-backend] service key project mismatch", { targetRef, selectedRef: matched.ref, key: matched.name });
  } else {
    console.log("[taxi-backend] service key selected", { targetRef, key: matched.name });
  }

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