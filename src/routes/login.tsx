import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const isAdmin = localStorage.getItem("taxi_admin");

    if (isAdmin === "true") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [navigate]);

  const handleLogin = () => {
    const ADMIN_PIN = "2407"; // CHANGE TON CODE PIN

    if (pin === ADMIN_PIN) {
      localStorage.setItem("taxi_admin", "true");
      navigate({ to: "/admin/dashboard" });
    } else {
      setError("Code incorrect");
    }
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
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: 40,
          width: "100%",
          maxWidth: 400,
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Accès Admin
        </h1>

        <input
          type="password"
          placeholder="Code PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            padding: "0 16px",
            fontSize: 18,
            marginBottom: 16,
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 12,
            border: 0,
            background: "#0ea5e9",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Connexion
        </button>

        {error && (
          <p
            style={{
              color: "red",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
