import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Connexion — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [tapCount, setTapCount] = useState(0);
  const [hint, setHint] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("admin_pin_ok") === "1") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [navigate]);

  const handleLogoTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    setHint(true);
    setTimeout(() => setHint(false), 250);

    if (tapTimer.current) clearTimeout(tapTimer.current);

    if (next >= 3) {
      setTapCount(0);
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      sessionStorage.setItem("admin_pin_ok", "1");
      navigate({ to: "/admin/dashboard" });
      return;
    }

    tapTimer.current = setTimeout(() => setTapCount(0), 2000);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tap    { 0%{transform:scale(1)} 50%{transform:scale(0.85)} 100%{transform:scale(1)} }
        .login-card { animation:fadeUp 0.4s ease both; }
        .logo-tap   { animation:tap 0.25s ease; }
      `}</style>

      <div
        className="login-card"
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: "48px 32px",
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          textAlign: "center",
        }}
      >
        <div
          onClick={handleLogoTap}
          className={hint ? "logo-tap" : ""}
          style={{
            width: 90,
            height: 90,
            background: "#0ea5e9",
            borderRadius: "50%",
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            cursor: "default",
            userSelect: "none",
            WebkitUserSelect: "none",
            boxShadow: tapCount > 0 ? "0 0 0 10px rgba(14,165,233,0.2)" : "none",
            transition: "box-shadow 0.2s",
          }}
        >
          🚕
        </div>

        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#0f172a", margin: 0 }}>
          Taxi City Bordeaux
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>Espace administration</p>

        {/* Indicateur 3 taps */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: i < tapCount ? "#0ea5e9" : "#e2e8f0",
                transition: "background 0.15s",
              }}
            />
          ))}
        </div>

        <p style={{ color: "#cbd5e1", fontSize: 11, marginTop: 16 }}>Accès réservé au chauffeur</p>
      </div>
    </div>
  );
}
