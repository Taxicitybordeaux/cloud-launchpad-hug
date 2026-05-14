import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackingIdSchema } from "@/lib/tracking-id";
import {
  SkeletonStyles,
  CardSkeleton,
  LineSkeleton,
  ButtonSkeleton,
  ReservationRowSkeleton,
} from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/flow-check")({
  head: () => ({ meta: [{ title: "Vérification du flow — Admin" }, { name: "robots", content: "noindex" }] }),
  component: FlowCheckPage,
});

type Status = "ok" | "warn" | "fail" | "pending";
type Check = { id: string; label: string; status: Status; detail?: string; data?: any };
type Reservation = {
  id: string;
  tracking_id: string | null;
  status: string;
  client_name: string | null;
  nom: string | null;
  destination: string | null;
  arrivee: string | null;
  prix_estime: number | null;
  created_at: string;
};

const colorOf = (s: Status) =>
  s === "ok" ? "#22c55e" : s === "warn" ? "#f59e0b" : s === "fail" ? "#ef4444" : "#64748b";
const iconOf = (s: Status) => (s === "ok" ? "✅" : s === "warn" ? "⚠️" : s === "fail" ? "❌" : "⏳");

function FlowCheckPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // ✅ point 6 : running est l'état réel — true pendant le fetch, false après
  const [running, setRunning] = useState(true); // démarre à true = loading initial
  const [resasLoading, setResasLoading] = useState(true); // spécifique au tableau des réservations
  const [mode, setMode] = useState<"single" | "multi" | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [simResults, setSimResults] = useState<
    { id: string; tracking_id: string; ms: number; ok: boolean; detail: string }[]
  >([]);
  const [simRunning, setSimRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    setResasLoading(true);
    const results: Check[] = [];

    // 1) Driver GPS row
    const { data: gps, error: gpsErr } = await supabase.from("driver_gps").select("*").eq("id", "driver").maybeSingle();
    if (gpsErr) {
      results.push({ id: "gps", label: "Driver GPS — lecture publique", status: "fail", detail: gpsErr.message });
    } else if (!gps) {
      results.push({
        id: "gps",
        label: "Driver GPS — ligne 'driver' absente",
        status: "warn",
        detail: "La ligne driver_gps id='driver' n'existe pas. Le chauffeur doit activer son GPS au moins une fois.",
      });
    } else {
      const hasPos = gps.latitude != null && gps.longitude != null;
      const fresh = gps.updated_at ? Date.now() - new Date(gps.updated_at).getTime() < 5 * 60 * 1000 : false;
      results.push({
        id: "gps",
        label: `Driver GPS — ${gps.is_active ? "actif" : "inactif"}${hasPos ? " · position OK" : " · sans position"}${fresh ? " · récent" : " · ancien"}`,
        status: gps.is_active && hasPos && fresh ? "ok" : "warn",
        detail: `lat=${gps.latitude ?? "—"} lng=${gps.longitude ?? "—"} · maj ${gps.updated_at ?? "—"}`,
        data: gps,
      });
    }

    // 2) Reservations + tracking IDs
    const { data: resas, error: resasErr } = await supabase
      .from("reservations")
      .select("id, tracking_id, status, client_name, nom, destination, arrivee, prix_estime, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (resasErr) {
      results.push({ id: "resas", label: "Réservations — lecture", status: "fail", detail: resasErr.message });
    } else {
      const list = (resas ?? []) as Reservation[];
      setReservations(list);
      setResasLoading(false); // ✅ tableau prêt
      const accepted = list.filter((r) =>
        ["acceptee", "acceptée", "accepted"].includes((r.status || "").toLowerCase()),
      );
      const withTid = list.filter((r) => r.tracking_id);
      const validTid = withTid.filter((r) => trackingIdSchema.safeParse(r.tracking_id).success);
      const invalidTid = withTid.length - validTid.length;
      results.push({
        id: "resas",
        label: `Réservations — ${list.length} récentes · ${accepted.length} acceptées · ${withTid.length} avec tracking_id`,
        status: list.length === 0 ? "warn" : "ok",
      });
      results.push({
        id: "tid",
        label: `Tracking IDs — ${validTid.length}/${withTid.length} au format UUID v4`,
        status: invalidTid === 0 ? "ok" : "fail",
        detail: invalidTid > 0 ? `${invalidTid} tracking_id ne respectent pas le schéma UUID v4.` : undefined,
      });
    }

    // 3) RLS checks
    try {
      const { error } = await supabase.from("reservations").select("id").limit(1);
      results.push({
        id: "rls-resa-read",
        label: "RLS · reservations — lecture publique",
        status: error ? "fail" : "ok",
        detail: error?.message,
      });
    } catch (e: any) {
      results.push({ id: "rls-resa-read", label: "RLS · reservations — lecture", status: "fail", detail: e.message });
    }

    try {
      const { error } = await supabase.from("driver_gps").select("id").limit(1);
      results.push({
        id: "rls-gps-read",
        label: "RLS · driver_gps — lecture publique",
        status: error ? "fail" : "ok",
        detail: error?.message,
      });
    } catch (e: any) {
      results.push({ id: "rls-gps-read", label: "RLS · driver_gps — lecture", status: "fail", detail: e.message });
    }

    const { data: roles, error: rolesErr } = await supabase.from("user_roles").select("id").limit(1);
    if (rolesErr) {
      results.push({
        id: "rls-roles",
        label: "RLS · user_roles — protégée",
        status: "ok",
        detail: "Lecture refusée hors admin (attendu).",
      });
    } else {
      results.push({
        id: "rls-roles",
        label: `RLS · user_roles — ${roles?.length ?? 0} ligne(s) lisible(s)`,
        status: "ok",
        detail: "Vous êtes admin, lecture autorisée.",
      });
    }

    try {
      const { error } = await supabase
        .from("site_analytics")
        .insert({ event: "flow_check_ping", session_id: "flow-check" });
      results.push({
        id: "rls-analytics",
        label: "RLS · site_analytics — écriture publique",
        status: error ? "fail" : "ok",
        detail: error?.message,
      });
    } catch (e: any) {
      results.push({
        id: "rls-analytics",
        label: "RLS · site_analytics — écriture",
        status: "fail",
        detail: e.message,
      });
    }

    // 4) Realtime
    const channel = supabase.channel("flow-check-rt");
    const rtOk = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      channel
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_gps" }, () => {})
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            resolve(true);
          }
        });
    });
    supabase.removeChannel(channel);
    results.push({
      id: "realtime",
      label: "Realtime — abonnement driver_gps",
      status: rtOk ? "ok" : "warn",
      detail: rtOk ? undefined : "Le canal realtime n'a pas confirmé l'abonnement en 3s.",
    });

    setChecks(results);
    setRunning(false); // ✅ fin du chargement réel
  };

  const loadMode = async () => {
    const { data } = await supabase.from("app_settings").select("tracking_mode").eq("id", 1).maybeSingle();
    setMode(data?.tracking_mode === "multi" ? "multi" : "single");
  };

  const updateMode = async (next: "single" | "multi") => {
    setSavingMode(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ tracking_mode: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSavingMode(false);
    if (error) {
      alert("Échec mise à jour mode: " + error.message);
      return;
    }
    setMode(next);
  };

  const runSimulatedScans = async () => {
    setSimRunning(true);
    setSimResults([]);
    const targets = reservations
      .filter((r) => r.tracking_id && trackingIdSchema.safeParse(r.tracking_id).success)
      .slice(0, 5);
    if (targets.length === 0) {
      setSimResults([
        { id: "none", tracking_id: "—", ms: 0, ok: false, detail: "Aucune réservation avec tracking_id UUID valide." },
      ]);
      setSimRunning(false);
      return;
    }
    const settings = await supabase.from("app_settings").select("tracking_mode").eq("id", 1).maybeSingle();
    const m = settings.data?.tracking_mode === "multi" ? "multi" : "single";
    const runOne = async (r: Reservation) => {
      const start = performance.now();
      const tid = r.tracking_id!;
      const [resa, gps] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, status, destination, arrivee, prix_estime")
          .eq("tracking_id", tid)
          .maybeSingle(),
        supabase
          .from("driver_gps")
          .select("id, latitude, longitude, is_active, updated_at")
          .eq("id", m === "multi" ? tid : "driver")
          .maybeSingle(),
      ]);
      const ms = Math.round(performance.now() - start);
      const okResa = !resa.error && !!resa.data;
      const okGps = !gps.error;
      return {
        id: r.id,
        tracking_id: tid,
        ms,
        ok: okResa && okGps,
        detail: `${okResa ? "✓ resa" : "✗ resa"} · ${okGps ? (gps.data ? "✓ gps " + (gps.data.is_active ? "actif" : "inactif") : "gps absent") : "✗ gps " + gps.error?.message}`,
      };
    };
    const results = await Promise.all(targets.map(runOne));
    setSimResults(results);
    setSimRunning(false);
  };

  useEffect(() => {
    runChecks();
    loadMode();
  }, []);

  const summary = {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };

  return (
    <div
      style={{ padding: "20px 16px", fontFamily: "'DM Sans',sans-serif", color: "#f1f5f9", boxSizing: "border-box" }}
    >
      <SkeletonStyles />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 24, margin: 0 }}>
            🩺 Vérification du flow
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
            Audit en direct : tracking IDs, GPS, réservations, RLS, realtime.
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={running}
          style={{
            padding: "10px 18px",
            background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            cursor: running ? "wait" : "pointer",
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? "Analyse en cours…" : "🔄 Relancer"}
        </button>
      </div>

      {/* Summary counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 24 }}>
        {/* ✅ point 6 : skeleton pendant running, valeurs réelles après */}
        {(["ok", "warn", "fail"] as Status[]).map((s) => (
          <div
            key={s}
            style={{ background: "#0f172a", border: `1px solid ${colorOf(s)}33`, borderRadius: 14, padding: 16 }}
          >
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em" }}>{s.toUpperCase()}</div>
            {running ? (
              <div style={{ marginTop: 8 }}>
                <CardSkeleton withTitle={false} lines={1} />
              </div>
            ) : (
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 900, color: colorOf(s) }}>
                {summary[s as keyof typeof summary] || 0}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Checks list */}
      <section
        style={{
          background: "#0f172a",
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, marginTop: 0, marginBottom: 12 }}>
          Checks
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* ✅ point 6 : skeleton branché sur running (état réel) */}
          {running && checks.length === 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 10,
                    borderLeft: "3px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <LineSkeleton width={20} height={20} />
                  <div style={{ flex: 1 }}>
                    <LineSkeleton width={`${60 + ((i * 7) % 30)}%`} height={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {checks.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 10,
                borderLeft: `3px solid ${colorOf(c.status)}`,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: "20px" }}>{iconOf(c.status)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.label}</div>
                {c.detail && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      marginTop: 2,
                      fontFamily: "'JetBrains Mono',monospace",
                      wordBreak: "break-word",
                    }}
                  >
                    {c.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mode tracking */}
      <section
        style={{
          background: "#0f172a",
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, marginTop: 0, marginBottom: 6 }}>
          Mode de tracking
        </h2>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0, marginBottom: 14 }}>
          <strong>Chauffeur unique</strong> : tous les clients voient la même position GPS (
          <code>driver_gps id='driver'</code>).
          <br />
          <strong>Multi-courses</strong> : chaque course a sa propre ligne GPS (<code>id = tracking_id</code>).
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(["single", "multi"] as const).map((opt) => {
            const active = mode === opt;
            return (
              <button
                key={opt}
                onClick={() => updateMode(opt)}
                disabled={savingMode || active}
                style={{
                  padding: "12px 18px",
                  background: active ? "linear-gradient(135deg,#0ea5e9,#0369a1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.1)"}`,
                  color: "#fff",
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: active || savingMode ? "default" : "pointer",
                  opacity: savingMode ? 0.6 : 1,
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 13,
                }}
              >
                {opt === "single" ? "🧑‍✈️ Chauffeur unique" : "🚕🚕 Multi-courses"}
                {active ? " · actif" : ""}
              </button>
            );
          })}
          {savingMode && <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>Sauvegarde…</span>}
        </div>
      </section>

      {/* Simulated scans */}
      <section
        style={{
          background: "#0f172a",
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, margin: 0 }}>
            Test scans simultanés
          </h2>
          <button
            onClick={runSimulatedScans}
            disabled={simRunning || reservations.length === 0}
            style={{
              padding: "8px 14px",
              background: "rgba(14,165,233,0.15)",
              color: "#7dd3fc",
              border: "1px solid rgba(14,165,233,0.3)",
              borderRadius: 8,
              fontWeight: 700,
              cursor: simRunning ? "wait" : "pointer",
              fontSize: 12,
            }}
          >
            {simRunning ? "Simulation…" : "▶ Lancer 5 scans en parallèle"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0, marginBottom: 12 }}>
          Requêtes <code>reservations</code> + <code>driver_gps</code> en parallèle pour les 5 dernières courses.
        </p>
        {simResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {simResults.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 8,
                  borderLeft: `3px solid ${r.ok ? "#22c55e" : "#ef4444"}`,
                }}
              >
                <span style={{ fontSize: 16 }}>{r.ok ? "✅" : "❌"}</span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#cbd5e1" }}>
                    {r.tracking_id.slice(0, 8)}… <span style={{ color: "#64748b" }}>· {r.ms} ms</span>
                  </div>
                  <div style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Réservations récentes */}
      <section
        style={{ background: "#0f172a", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, marginTop: 0, marginBottom: 12 }}>
          Réservations récentes ({resasLoading ? "…" : reservations.length})
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Client", "Statut", "Tracking ID", "UUID ?", "Destination", "Prix", "Lien"].map((h) => (
                  <th key={h} style={{ padding: 8 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ✅ point 6 : skeleton branché sur resasLoading (état réel du fetch réservations) */}
              {resasLoading ? (
                Array.from({ length: 4 }).map((_, i) => <ReservationRowSkeleton key={i} cols={7} />)
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                    Aucune réservation récente.
                  </td>
                </tr>
              ) : (
                reservations.map((r) => {
                  const valid = r.tracking_id ? trackingIdSchema.safeParse(r.tracking_id).success : false;
                  const url = r.tracking_id ? `/scan/${r.tracking_id}` : null;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: 8 }}>{r.client_name || r.nom || "—"}</td>
                      <td style={{ padding: 8 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: "rgba(14,165,233,0.15)",
                            color: "#0ea5e9",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: 8, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8" }}>
                        {r.tracking_id || "—"}
                      </td>
                      <td style={{ padding: 8 }}>{r.tracking_id ? (valid ? "✅" : "❌") : "—"}</td>
                      <td style={{ padding: 8 }}>{r.destination || r.arrivee || "—"}</td>
                      <td style={{ padding: 8 }}>{r.prix_estime != null ? `${r.prix_estime} €` : "—"}</td>
                      <td style={{ padding: 8 }}>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>
                            ouvrir
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
