import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setCookie } from "@tanstack/react-start/server";


// Session token = simple opaque random string (auth maison, pas Supabase Auth).
// On le stocke côté client (localStorage) et on l'enregistre côté serveur
// dans un champ `session_token` (ajouté à la volée si absent — fallback : id).
function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const emailSchema = z.string().trim().toLowerCase().email("Email invalide").max(255);
const passwordSchema = z.string().min(6, "Mot de passe : 6 caractères minimum").max(200);

const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, "Nom requis").max(120),
  phone: z.string().trim().min(6, "Téléphone requis").max(40),
});

const LoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type ClientSession = {
  id: string;
  email: string;
  name: string;
  phone: string;
  token: string;
};

export const clientRegister = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RegisterSchema.parse(input))
  .handler(async ({ data }): Promise<ClientSession> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("client_accounts")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing) throw new Error("EMAIL_TAKEN");

    const { default: bcrypt } = await import("bcryptjs");
    const hash = await bcrypt.hash(data.password, 10);
    const token = genToken();

    const { data: row, error } = await supabaseAdmin
      .from("client_accounts")
      .insert({
        email: data.email,
        client_name: data.name,
        phone: data.phone,
      })
      .select("id, email, client_name, phone")
      .single();
    if (error || !row) throw new Error("CREATE_FAILED");

    const { error: secretErr } = await supabaseAdmin
      .from("client_account_secrets" as any)
      .insert({ client_account_id: row.id, password_hash: hash });
    if (secretErr) {
      // best-effort rollback
      await supabaseAdmin.from("client_accounts").delete().eq("id", row.id);
      throw new Error("CREATE_FAILED");
    }

    const { CLIENT_SESSION_COOKIE, hashSessionToken } = await import("./client-session.server");
    const maxAge = 60 * 60 * 24 * 30;
    const { error: sessionError } = await supabaseAdmin.from("client_sessions").insert({
      client_account_id: row.id,
      token_hash: hashSessionToken(token),
      expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
    });
    if (sessionError) throw new Error("CREATE_FAILED");
    setCookie(CLIENT_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge });

    return {
      id: row.id,
      email: row.email,
      name: row.client_name ?? data.name,
      phone: row.phone ?? data.phone,
      token,
    };
  });

export const clientLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginSchema.parse(input))
  .handler(async ({ data }): Promise<ClientSession> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("client_accounts")
      .select("id, email, client_name, phone")
      .eq("email", data.email)
      .maybeSingle();
    if (!row) throw new Error("INVALID_CREDENTIALS");

    const { data: secret } = await supabaseAdmin
      .from("client_account_secrets" as any)
      .select("password_hash")
      .eq("client_account_id", row.id)
      .maybeSingle();
    if (!secret) throw new Error("INVALID_CREDENTIALS");

    const { default: bcrypt } = await import("bcryptjs");
    const ok = await bcrypt.compare(data.password, (secret as any).password_hash);
    if (!ok) throw new Error("INVALID_CREDENTIALS");

    const token = genToken();
    const { CLIENT_SESSION_COOKIE, hashSessionToken } = await import("./client-session.server");
    const maxAge = 60 * 60 * 24 * 30;
    const { error: sessionError } = await supabaseAdmin.from("client_sessions").insert({
      client_account_id: row.id,
      token_hash: hashSessionToken(token),
      expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
    });
    if (sessionError) throw new Error("INVALID_CREDENTIALS");
    setCookie(CLIENT_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge });

    return {
      id: row.id,
      email: row.email,
      name: row.client_name ?? "",
      phone: row.phone ?? "",
      token,
    };
  });
