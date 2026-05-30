/**
 * PushDebug — panneau de diagnostic push visible directement sur mobile.
 * À ajouter temporairement dans ton layout ou n'importe quelle page :
 *
 *   import { PushDebug } from "@/components/PushDebug";
 *   <PushDebug />
 *
 * Supprime-le une fois le problème résolu.
 */
import { useState, useCallback } from "react";
import { getFcmToken } from "@/lib/firebase";

type LogLine = { time: string; level: "info" | "error" | "ok"; msg: string };

export function PushDebug() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);

  const log = useCallback((level: LogLine["level"], msg: string) => {
    const time = new Date().toLocaleTimeString("fr-FR", { hour12: false });
    setLogs((prev) => [...prev, { time, level, msg }]);
    console.log(`[PushDebug][${level}]`, msg);
  }, []);

  const runDiag = useCallback(async () => {
    setLogs([]);
    setRunning(true);

    // 1. Support API
    log("info", `Notification in window: ${"Notification" in window}`);
    log("info", `serviceWorker in navigator: ${"serviceWorker" in navigator}`);
    log("info", `PushManager in window: ${"PushManager" in window}`);
    log("info", `Permission actuelle: ${"Notification" in window ? Notification.permission : "N/A"}`);
    log("info", `UserAgent: ${navigator.userAgent.slice(0, 120)}`);

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      log("error", "❌ Push non supporté sur ce navigateur/OS");
      setRunning(false);
      return;
    }

    // 2. Service Workers enregistrés
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      log("info", `SW enregistrés: ${regs.length}`);
      regs.forEach((r, i) => {
        const state = r.active?.state ?? r.installing?.state ?? r.waiting?.state ?? "?";
        log(
          "info",
          `  SW[${i}]: ${r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "?"} (${state})`,
        );
      });
      const fcmSW = regs.find((r) =>
        [r.active, r.installing, r.waiting].some((w) => w?.scriptURL.includes("firebase-messaging-sw")),
      );
      if (fcmSW) log("ok", "✅ firebase-messaging-sw.js trouvé");
      else log("error", "❌ firebase-messaging-sw.js NON trouvé parmi les SW");
    } catch (e: any) {
      log("error", `getRegistrations failed: ${e?.message}`);
    }

    // 3. Token FCM
    try {
      log("info", "Demande du token FCM...");
      const token = await getFcmToken();
      if (token) {
        log("ok", `✅ Token obtenu: ${token.slice(0, 20)}…${token.slice(-10)}`);
      } else {
        log("error", "❌ Token vide (null) — permission refusée ou SW introuvable");
      }
    } catch (e: any) {
      log("error", `getFcmToken threw: ${e?.message ?? String(e)}`);
    }

    // 4. Test notification locale
    try {
      const reg = await navigator.serviceWorker.ready;
      log("info", "SW ready ✅ — envoi d'une notif locale de test...");
      await reg.showNotification("🧪 PushDebug — Test local", {
        body: "Si tu vois ça, le SW fonctionne !",
        icon: "/favicon.ico",
        tag: "push-debug-test",
      });
      log("ok", "✅ Notif locale envoyée (vérifie ton écran)");
    } catch (e: any) {
      log("error", `showNotification failed: ${e?.message}`);
    }

    setRunning(false);
  }, [log]);

  const levelColor: Record<LogLine["level"], string> = {
    info: "#94a3b8",
    ok: "#4ade80",
    error: "#f87171",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "monospace",
        fontSize: 12,
        maxHeight: "55vh",
        display: "flex",
        flexDirection: "column",
        borderTop: "2px solid #334155",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          gap: 8,
          borderBottom: "1px solid #334155",
        }}
      >
        <span style={{ flex: 1, fontWeight: "bold", fontSize: 13 }}>🔍 Push Debug</span>
        <button
          onClick={runDiag}
          disabled={running}
          style={{
            background: running ? "#334155" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "4px 12px",
            cursor: running ? "default" : "pointer",
            fontSize: 12,
          }}
        >
          {running ? "Diagnostic…" : "▶ Lancer"}
        </button>
        <button
          onClick={() => setLogs([])}
          style={{
            background: "#334155",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Effacer
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "6px 10px" }}>
        {logs.length === 0 && (
          <div style={{ color: "#475569", paddingTop: 8 }}>
            Appuie sur ▶ Lancer pour diagnostiquer le push sur cet appareil.
          </div>
        )}
        {logs.map((l, i) => (
          <div key={i} style={{ marginBottom: 3, color: levelColor[l.level] }}>
            <span style={{ color: "#475569" }}>{l.time} </span>
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
