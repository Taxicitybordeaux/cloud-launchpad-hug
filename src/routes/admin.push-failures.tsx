import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listPushFailures } from "@/lib/push.functions";

export const Route = createFileRoute("/admin/push-failures")({
  head: () => ({
    meta: [
      { title: "Échecs push — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PushFailuresPage,
});

type FailureRow = {
  id: string;
  created_at: string;
  audience: string;
  tag: string | null;
  reservation_id: string | null;
  fcm_token_suffix: string | null;
  http_status: number | null;
  error_code: string | null;
  title: string | null;
  body: string | null;
  user_agent: string | null;
};

const STORED_PIN_KEY = "admin_password";
const DEFAULT_PIN = "DSF234";

function getStoredPin(): string {
  if (typeof localStorage === "undefined") return DEFAULT_PIN;
  return localStorage.getItem(STORED_PIN_KEY) ?? DEFAULT_PIN;
}

function PushFailuresPage() {
  const fetchFailures = useServerFn(listPushFailures);
  const [onlyPrice, setOnlyPrice] = useState(true);
  const [rows, setRows] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsAdmin(sessionStorage.getItem("admin_pin_ok") === "1");
  }, []);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchFailures({
        data: { pin: getStoredPin(), only_price_update: onlyPrice, limit: 200 },
      });
      setRows(((res as any)?.failures ?? []) as FailureRow[]);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, onlyPrice]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, color: "#f1f5f9", background: "#0a0f1e", minHeight: "100vh" }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif" }}>Accès refusé</h1>
        <p>Connectez-vous via <a href="/login" style={{ color: "#60a5fa" }}>/login</a>.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: "#0a0f1e", color: "#f1f5f9", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Admin · Diagnostic
          </div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, margin: "4px 0 0" }}>
            📡 Échecs d'envoi push
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={onlyPrice}
              onChange={(e) => setOnlyPrice(e.target.checked)}
            />
            Uniquement « Prix mis à jour »
          </label>
          <button
            onClick={reload}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.4)",
              color: "#60a5fa",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Chargement…" : "🔄 Rafraîchir"}
          </button>
          <a
            href="/admin/dashboard"
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#f1f5f9",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← Dashboard
          </a>
        </div>
      </header>

      {err && (
        <div
          style={{
            padding: 12,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 10,
            color: "#fca5a5",
            marginBottom: 16,
          }}
        >
          ❌ {err}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
        {rows.length} échec{rows.length > 1 ? "s" : ""}{" "}
        {onlyPrice ? "sur les push « Prix mis à jour »" : "toutes audiences confondues"}.
      </div>

      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)", textAlign: "left" }}>
              <th style={th}>Date</th>
              <th style={th}>Audience</th>
              <th style={th}>Tag</th>
              <th style={th}>Réservation</th>
              <th style={th}>Status HTTP</th>
              <th style={th}>Code FCM</th>
              <th style={th}>Token (suffixe)</th>
              <th style={th}>Titre</th>
              <th style={th}>User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Aucun échec enregistré ✨
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={td}>
                  {new Date(r.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td style={td}>{r.audience}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.tag ?? "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>
                  {r.reservation_id ? (
                    <a
                      href={`/suivi/${r.reservation_id}`}
                      style={{ color: "#60a5fa" }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.reservation_id.slice(0, 8)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={td}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      background:
                        r.http_status && r.http_status >= 500
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(245,158,11,0.15)",
                      color: r.http_status && r.http_status >= 500 ? "#fca5a5" : "#fcd34d",
                      fontWeight: 700,
                    }}
                  >
                    {r.http_status ?? "—"}
                  </span>
                </td>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#fca5a5" }}>
                  {r.error_code ?? "—"}
                </td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                  …{r.fcm_token_suffix ?? "—"}
                </td>
                <td style={td}>{r.title ?? "—"}</td>
                <td style={{ ...td, color: "#94a3b8", fontSize: 11, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.user_agent ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
        💡 <b>UNREGISTERED</b> = token révoqué (auto-supprimé). <b>INVALID_ARGUMENT</b> = device inactif (purgé après 30j).{" "}
        <b>5xx</b> = panne FCM temporaire — rejouer plus tard.
      </p>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", fontWeight: 700 };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top" };
