import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, User, Phone } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { ClientAuthHeader } from "@/components/ClientAuthHeader";
import { clientLogin, clientRegister } from "@/lib/client-auth.functions";
import { setClientSession, getClientSession } from "@/lib/client-session";
import { useI18n, useT } from "@/i18n/I18nProvider";

// ── Global mobile-optimized styles ─────────────────────────────────────────
const css = `
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  html, body {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
    overscroll-behavior-y: contain;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  input, textarea, select { font-size: 16px; }
  .client-login-root {
    position: fixed; inset: 0;
    max-width: 480px; margin: 0 auto;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, #0a0a0a 0%, #111827 100%);
    overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  .client-login-content {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 40px 16px 20px; min-height: 100%;
  }
`;

export const Route = createFileRoute("/client/login")({
  head: () => ({
    meta: [
      { title: "Mon Espace Client — Taxi City Bordeaux" },
      {
        name: "description",
        content:
          "Connectez-vous à votre espace client Taxi City Bordeaux pour suivre vos courses et gérer vos réservations.",
      },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f172a" },
    ],
  }),
  component: ClientLoginPage,
});

type Mode = "login" | "register";

function ClientLoginPage() {
  const navigate = useNavigate();
  const t = useT();
  const { dir, isRtl } = useI18n();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getClientSession()) navigate({ to: "/client/dashboard" });
  }, [navigate]);

  function validate(): string | null {
    if (!email.trim()) return t("client.login.err_email_req");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return t("client.login.err_email_invalid");
    if (!password) return t("client.login.err_pwd_req");
    if (password.length < 6) return t("client.login.err_pwd_short");
    if (mode === "register") {
      if (!name.trim()) return t("client.login.err_name_req");
      if (!phone.trim() || phone.trim().length < 6) return t("client.login.err_phone_req");
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const session =
        mode === "login"
          ? await clientLogin({ data: { email: email.trim(), password } })
          : await clientRegister({ data: { email: email.trim(), password, name: name.trim(), phone: phone.trim() } });
      setClientSession(session);
      navigate({ to: "/client/dashboard" });
    } catch (err) {
      const raw = String((err as Error)?.message || err);
      if (raw.includes("EMAIL_TAKEN")) setError(t("client.login.err_email_taken"));
      else if (raw.includes("INVALID_CREDENTIALS")) setError(t("client.login.err_credentials"));
      else if (raw.includes("CREATE_FAILED")) setError(t("client.login.err_create"));
      else setError(t("client.login.err_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: css + "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');",
        }}
      />
      <main className="client-login-root" dir={dir}>
        {/* Subtle gold halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)" }}
        />

        <div className="client-login-content">
          <div className="mx-auto w-full max-w-sm">
            <ClientAuthHeader />

            <div
              className="mt-8 w-full rounded-2xl border p-6"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderColor: "rgba(255,255,255,0.10)",
                boxShadow: "0 25px 60px -20px rgba(0,0,0,0.6)",
              }}
            >
              <h1
                className="text-center text-2xl font-bold text-white"
                style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
              >
                {t("client_login_title")}
              </h1>
              <p className="mt-2 text-center text-sm text-white/60">
                {mode === "login" ? t("client_login_subtitle") : t("client_register_title")}
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
                {mode === "register" && (
                  <>
                    <Field icon={<User className="h-4 w-4" />}>
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="name"
                        placeholder={t("client_name_field")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                      />
                    </Field>
                    <Field icon={<Phone className="h-4 w-4" />}>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder={t("client_phone_field")}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                      />
                    </Field>
                  </>
                )}

                <Field icon={<Mail className="h-4 w-4" />}>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t("client_email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                  />
                </Field>

                <Field icon={<Lock className="h-4 w-4" />}>
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={t("client_password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? t("client.login.hide") : t("client.login.show")}
                    onClick={() => setShowPwd((v) => !v)}
                    className="ml-2 text-white/50 transition hover:text-white"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </Field>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 text-base font-semibold text-black transition active:scale-[0.98] disabled:opacity-60"
                  style={{
                    height: 52,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)",
                    boxShadow: "0 10px 30px -10px rgba(201,168,76,0.5)",
                  }}
                >
                  {loading ? (
                    <BrandLoader size={22} />
                  ) : mode === "login" ? (
                    t("client_login_btn")
                  ) : (
                    t("client_register_btn")
                  )}
                </button>
              </form>

              {mode === "login" && (
                <Link
                  to="/client/forgot-password"
                  className="mt-4 block text-center text-xs text-white/60 transition hover:text-[#E8C96D]"
                >
                  {t("client.login.forgot")}
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
                className="mt-5 block w-full text-center text-sm text-white/70 transition hover:text-white"
              >
                {mode === "login" ? (
                  <span className="font-semibold text-[#E8C96D]">{t("client_register_link")}</span>
                ) : (
                  <span className="font-semibold text-[#E8C96D]">{t("client_login_btn")}</span>
                )}
              </button>
            </div>

            <p className="mt-6 text-center text-xs text-white/40">
              {t("client.login.terms_prefix")}{" "}
              <Link to="/mentions-legales" className="underline hover:text-white/70">
                {t("client.login.terms_link")}
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label
      className="flex items-center gap-2.5 rounded-xl border px-3.5 transition focus-within:border-[#C9A84C]/60"
      style={{
        height: 50,
        background: "rgba(0,0,0,0.25)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <span className="text-white/50">{icon}</span>
      {children}
    </label>
  );
}
