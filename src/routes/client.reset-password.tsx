import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { ClientAuthHeader } from "@/components/ClientAuthHeader";
import { BrandLoader } from "@/components/BrandLoader";
import { clientPerformPasswordReset } from "@/lib/client-auth-reset.functions";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/client/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tk = params.get("token");
    if (!tk) {
      setError(t("client.reset.invalid_link"));
      return;
    }
    setToken(tk);
  }, [t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) return;
    if (password.length < 6) {
      setError(t("client.login.err_pwd_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("client.reset.err_mismatch"));
      return;
    }
    setLoading(true);
    try {
      await clientPerformPasswordReset({ data: { token, password } });
      setDone(true);
      setTimeout(() => navigate({ to: "/client/login" }), 2500);
    } catch (err) {
      const raw = String((err as Error)?.message || err);
      if (raw.includes("EXPIRED_TOKEN")) setError(t("client.reset.err_expired"));
      else if (raw.includes("INVALID_TOKEN")) setError(t("client.reset.err_invalid_used"));
      else setError(t("client.login.err_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden px-4 py-10 sm:py-16"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center">
        <ClientAuthHeader />
        <div
          className="w-full rounded-2xl border p-6 sm:p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(255,255,255,0.10)",
            boxShadow: "0 25px 60px -20px rgba(0,0,0,0.6)",
          }}
        >
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(34,197,94,0.15)" }}>
                <CheckCircle2 className="h-7 w-7 text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}>
                {t("client.reset.done_title")}
              </h1>
              <p className="mt-3 text-sm text-white/70">{t("client.reset.done_desc")}</p>
            </div>
          ) : !token && error ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>
                <AlertTriangle className="h-7 w-7 text-red-300" />
              </div>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}>
                {t("client.reset.invalid_title")}
              </h1>
              <p className="mt-3 text-sm text-white/70">{error}</p>
              <Link
                to="/client/forgot-password"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-3 text-sm font-semibold text-[#E8C96D]"
              >
                {t("client.reset.request_new")}
              </Link>
            </div>
          ) : (
            <>
              <h1
                className="text-center text-2xl font-bold text-white sm:text-3xl"
                style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
              >
                {t("client.reset.title")}
              </h1>
              <p className="mt-2 text-center text-sm text-white/60">
                {t("client.reset.desc")}
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
                <Field>
                  <Lock className="h-4 w-4 text-white/50" />
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("client.reset.pwd_ph")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? t("client.login.hide") : t("client.login.show")}
                    onClick={() => setShowPwd((v) => !v)}
                    className="ml-2 text-white/50 hover:text-white"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </Field>
                <Field>
                  <Lock className="h-4 w-4 text-white/50" />
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("client.reset.pwd_confirm_ph")}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                  />
                </Field>
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: "rgba(239,68,68,0.4)",
                      background: "rgba(239,68,68,0.08)",
                      color: "#fca5a5",
                    }}
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
                  {loading ? <BrandLoader size={22} /> : t("client.reset.submit")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="flex items-center gap-2.5 rounded-xl border px-3.5 transition focus-within:border-[#C9A84C]/60"
      style={{ height: 50, background: "rgba(0,0,0,0.25)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      {children}
    </label>
  );
}
