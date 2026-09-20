import { createHash } from "crypto";
import { getCookie } from "@tanstack/react-start/server";

export const CLIENT_SESSION_COOKIE = "tcb_client_session_token";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireClientAccount(expectedAccountId?: string) {
  const token = getCookie(CLIENT_SESSION_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error("UNAUTHORIZED");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("client_sessions")
    .select("client_account_id,expires_at")
    .eq("token_hash", hashSessionToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data || (expectedAccountId && data.client_account_id !== expectedAccountId)) {
    throw new Error("UNAUTHORIZED");
  }
  return data.client_account_id;
}