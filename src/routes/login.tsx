import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.jpeg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Connexion — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

const DEFAULT_PASSWORD = "DSF234";
const STORAGE_KEY = "admin_password";
const SESSION_KEY = "admin_pin_ok";

function getStoredPassword(): string {
  if (typeof localStorage === "undefined") return DEFAULT_PASSWORD;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PASSWORD;
}

type Screen = "login" | "change";

function LoginPage() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      window.location.href = "/admin/dashboard";
    }
  }, []);

  const [screen, setScreen] = useState<Screen>("login");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changeMsg, setChangeMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = () => {
    if (!password) {
      setError("Entrez votre mot de passe.");
      return;
    }
    if (password === getStoredPassword()) {
      sessionStorage.setItem(SESSION_KEY, "1");
      window.location.href = "/admin/dashboard";
    } else {
      setError("Mot de passe incorrect.");
      setPassword("");
      triggerShake();
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    }
  };

  const handleChangePassword = () => {
    setChangeMsg(null);
    if (!oldPwd || !newPwd || !newPwd2) {
      setChangeMsg({ type: "err", text: "Tous les champs sont requis." });
      return;
    }
    if (oldPwd !== getStoredPassword()) {
      setChangeMsg({ type: "err", text: "Mot de passe actuel incorrect." });
      return;
    }
    if (newPwd.length < 6) {
      setChangeMsg({ type: "err", text: "Le nouveau mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    if (newPwd !== newPwd2) {
      setChangeMsg({ type: "err", text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    localStorage.setItem(STORAGE_KEY, newPwd);
    setChangeMsg({ type: "ok", text: "Mot de passe mis à jour ✅" });
    setOldPwd("");
    setNewPwd("");
    setNewPwd2("");
    setTimeout(() => setScreen("login"), 1500);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020817",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,0.4)} 50%{box-shadow:0 0 0 16px rgba(14,165,233,0)} }
        @keyframes gradFlow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }

        .login-card  { animation: fadeUp 0.5s cubic-bezier(.16,1,.3,1) both; }
        .login-shake { animation: shake 0.45s ease; }
        .logo-pulse  { animation: pulse 2s ease infinite; }

        .pwd-input {
          width: 100%;
          padding: 14px 48px 14px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          color: #f8fafc;
          font-size: 16px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
          letter-spacing: 0.05em;
        }
        .pwd-input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.15);
        }
        .pwd-input::placeholder { color: #475569; }

        .btn-primary {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          background-size: 200% 200%;
          color: #fff;
          border: none;
          border-radius: 14px;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          animation: gradFlow 4s ease infinite;
        }
        .btn-primary:hover  { opacity: 0.9; }
        .btn-primary:active { transform: scale(0.98); }

        .btn-ghost {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          font-size: 13px;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.15s;
        }
        .btn-ghost:hover { color: #0ea5e9; }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #475569;
          padding: 4px;
          font-size: 18px;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: #0ea5e9; }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0;
          color: #334155;
          font-size: 12px;
        }
        .divider::before,.divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }

        .tab-btn {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-active   { background: #0ea5e9; color: #fff; }
        .tab-inactive { background: rgba(255,255,255,0.04); color: #64748b; }
        .tab-inactive:hover { background: rgba(255,255,255,0.08); color: #94a3b8; }
      `}</style>

      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        className={`login-card ${shake ? "login-shake" : ""}`}
        style={{
          position: "relative",
          zIndex: 1,
          background: "rgba(15,23,42,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: "40px 32px",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            className="logo-pulse"
            style={{
              width: 90,
              height: 90,
              background: "#fff",
              borderRadius: 24,
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 32px rgba(14,165,233,0.3)",
              overflow: "hidden",
              padding: 6,
            }}
          >
            <img
              src={logo}
              alt="Taxi City Bordeaux"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 18 }}
            />
          </div>
          <h1
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 900,
              fontSize: 22,
              color: "#f8fafc",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Taxi City Bordeaux
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6 }}>Espace administration</p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            padding: 4,
            marginBottom: 28,
          }}
        >
          <button
            className={`tab-btn ${screen === "login" ? "tab-active" : "tab-inactive"}`}
            onClick={() => {
              setScreen("login");
              setError("");
              setChangeMsg(null);
            }}
          >
            🔐 Connexion
          </button>
          <button
            className={`tab-btn ${screen === "change" ? "tab-active" : "tab-inactive"}`}
            onClick={() => {
              setScreen("change");
              setError("");
              setChangeMsg(null);
            }}
          >
            🔑 Changer
          </button>
        </div>

        {/* ── Screen : Login ── */}
        {screen === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Mot de passe
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="pwd-input"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="••••••••"
                  autoFocus
                />
                <button className="eye-btn" onClick={() => setShowPwd((p) => !p)} tabIndex={-1}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
              {error && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 8,
                    color: "#f87171",
                    fontSize: 13,
                  }}
                >
                  ❌ {error}
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={handleLogin}>
              Accéder au tableau de bord →
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                className="btn-ghost"
                onClick={() => {
                  setScreen("change");
                  setError("");
                }}
              >
                Changer le mot de passe
              </button>
            </div>
          </div>
        )}

        {/* ── Screen : Changer le mot de passe ── */}
        {screen === "change" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Mot de passe actuel */}
            <div>
              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Mot de passe actuel
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="pwd-input"
                  type={showOld ? "text" : "password"}
                  value={oldPwd}
                  onChange={(e) => {
                    setOldPwd(e.target.value);
                    setChangeMsg(null);
                  }}
                  placeholder="••••••••"
                />
                <button className="eye-btn" onClick={() => setShowOld((p) => !p)} tabIndex={-1}>
                  {showOld ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Nouveau mot de passe */}
            <div>
              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Nouveau mot de passe
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="pwd-input"
                  type={showNew ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => {
                    setNewPwd(e.target.value);
                    setChangeMsg(null);
                  }}
                  placeholder="Min. 6 caractères"
                />
                <button className="eye-btn" onClick={() => setShowNew((p) => !p)} tabIndex={-1}>
                  {showNew ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Confirmer */}
            <div>
              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Confirmer le nouveau mot de passe
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="pwd-input"
                  type={showNew ? "text" : "password"}
                  value={newPwd2}
                  onChange={(e) => {
                    setNewPwd2(e.target.value);
                    setChangeMsg(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                  placeholder="Répéter le mot de passe"
                />
              </div>
            </div>

            {changeMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  background: changeMsg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${changeMsg.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                  borderRadius: 10,
                  color: changeMsg.type === "ok" ? "#4ade80" : "#f87171",
                  fontSize: 13,
                }}
              >
                {changeMsg.text}
              </div>
            )}

            <button className="btn-primary" onClick={handleChangePassword}>
              Mettre à jour le mot de passe
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                className="btn-ghost"
                onClick={() => {
                  setScreen("login");
                  setChangeMsg(null);
                }}
              >
                ← Retour à la connexion
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", color: "#1e293b", fontSize: 11, marginTop: 28, marginBottom: 0 }}>
          Accès réservé — Taxi City Bordeaux
        </p>
      </div>
    </div>
  );
}
