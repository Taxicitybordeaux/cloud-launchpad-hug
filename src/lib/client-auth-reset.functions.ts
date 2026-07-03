import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email("Email invalide").max(255);
const passwordSchema = z.string().min(6, "Mot de passe : 6 caractères minimum").max(200);

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const RequestSchema = z.object({ email: emailSchema });
const ResetSchema = z.object({ token: z.string().min(16).max(128), password: passwordSchema });

const APP_URL = "https://taxicitybordeaux.fr";

/**
 * Requests a password reset.
 * Always returns { ok: true } regardless of whether the email exists,
 * to avoid email enumeration.
 */
export const clientRequestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RequestSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: account } = await supabaseAdmin
      .from("client_accounts")
      .select("id, email, client_name")
      .eq("email", data.email)
      .maybeSingle();

    if (!account) return { ok: true };

    const token = genToken();
    const tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    // Invalidate previous unused tokens for this account
    await supabaseAdmin
      .from("client_password_resets" as any)
      .update({ used_at: new Date().toISOString() })
      .eq("client_account_id", account.id)
      .is("used_at", null);

    const { error: insErr } = await supabaseAdmin.from("client_password_resets" as any).insert({
      client_account_id: account.id,
      token_hash: tokenHash,
      expires_at: expires.toISOString(),
    });
    if (insErr) {
      console.error("[reset] insert token failed", insErr);
      return { ok: true };
    }

    const resetUrl = `${APP_URL}/client/reset-password?token=${token}`;
    const name = account.client_name || "Client VIP";

    const subject = "🔑 Réinitialisation de votre mot de passe — Taxi City Bordeaux";
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#111;">
<div style="max-width:560px;padding:24px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#1a1209 0%,#2d1f0a 100%);border-radius:10px;color:#E8C96D;font-weight:bold;font-size:18px;letter-spacing:0.05em;">TAXI CITY BORDEAUX</div>
  </div>
  <h1 style="font-size:22px;margin:0 0 12px;color:#1a1209;">Réinitialisation de votre mot de passe</h1>
  <p style="font-size:15px;line-height:1.6;color:#444;">Bonjour ${name},</p>
  <p style="font-size:15px;line-height:1.6;color:#444;">Vous avez demandé à réinitialiser le mot de passe de votre Espace Client VIP. Cliquez sur le bouton ci-dessous (valable 30 minutes) :</p>
  <p style="text-align:center;margin:28px 0;"><a href="${resetUrl}" style="background:linear-gradient(135deg,#C9A84C 0%,#E8C96D 100%);color:#1a1209;padding:14px 32px;border-radius:10px;font-weight:bold;text-decoration:none;display:inline-block;font-size:15px;">Choisir un nouveau mot de passe</a></p>
  <p style="font-size:13px;color:#777;line-height:1.6;">Ou copiez ce lien dans votre navigateur :<br><a href="${resetUrl}" style="color:#C9A84C;word-break:break-all;">${resetUrl}</a></p>
  <hr style="border:0;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:12px;color:#999;line-height:1.5;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.</p>
</div></body></html>`;

    const text = `Réinitialisation de votre mot de passe Taxi City Bordeaux\n\nBonjour ${name},\n\nUtilisez ce lien (valable 30 min) pour choisir un nouveau mot de passe :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

    try {
      const messageId = `reset-${account.id}-${Date.now()}`;
      // Mark in send log (best effort, ignore failure)
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "client-password-reset",
        recipient_email: account.email,
        status: "pending",
      });
      await supabaseAdmin.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: account.email,
          from: "Taxi City Bordeaux <noreply@notify.taxicitybordeaux.fr>",
          reply_to: "taxi.city033@gmail.com",
          sender_domain: "notify.taxicitybordeaux.fr",
          subject,
          html,
          text,
          purpose: "transactional",
          label: "client-password-reset",
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error("[reset] enqueue email failed", e);
    }

    return { ok: true };
  });

/**
 * Performs a password reset using the token from the email.
 */
export const clientPerformPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResetSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tokenHash = await sha256Hex(data.token);
    const { data: row } = await supabaseAdmin
      .from("client_password_resets" as any)
      .select("id, client_account_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row) throw new Error("INVALID_TOKEN");
    const r = row as any;
    if (r.used_at) throw new Error("INVALID_TOKEN");
    if (new Date(r.expires_at).getTime() < Date.now()) throw new Error("EXPIRED_TOKEN");

    const { default: bcrypt } = await import("bcryptjs");
    const hash = await bcrypt.hash(data.password, 10);

    const { error: upErr } = await supabaseAdmin
      .from("client_account_secrets" as any)
      .upsert({ client_account_id: r.client_account_id, password_hash: hash, updated_at: new Date().toISOString() });
    if (upErr) throw new Error("UPDATE_FAILED");

    await supabaseAdmin
      .from("client_password_resets" as any)
      .update({ used_at: new Date().toISOString() })
      .eq("id", r.id);

    return { ok: true };
  });
