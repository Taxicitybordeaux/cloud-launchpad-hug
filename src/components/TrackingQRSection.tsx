import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function TrackingQRSection() {
  const [clientId, setClientId] = useState("");
  const [count, setCount] = useState(30);
  const [copied, setCopied] = useState(false);

  const newId = () => `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sid = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sid);
    setClientId(newId());
    supabase.from("site_analytics").insert({ event: "qr_impression", session_id: sid });
    const t = setInterval(() => {
      setCount(c => {
        if (c <= 1) { setClientId(newId()); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const trackingUrl = typeof window !== "undefined" && clientId ? `${window.location.origin}/scan/${clientId}` : "";
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(trackingUrl)}&margin=12&color=0a0f1e&bgcolor=ffffff&ecc=H`;

  const copy = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      const sid = sessionStorage.getItem("sid");
      supabase.from("site_analytics").insert({ event: "qr_click", session_id: sid });
    } catch {}
  };

  const corner: React.CSSProperties = { position: "absolute", width: 22, height: 22, border: "3px solid #0ea5e9" };

  return (
    <section style={{ background: "#0a0f1e", padding: "88px 24px", color: "#f1f5f9", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
@keyframes scanLine{0%{top:0}50%{top:calc(100% - 2px)}100%{top:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes movePin{0%{transform:translate(0,0)}50%{transform:translate(20px,-12px)}100%{transform:translate(0,0)}}`}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(14,165,233,0.12)", color: "#0ea5e9", padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", animation: "pulse 1.5s infinite" }} /> SUIVI EN TEMPS RÉEL
        </span>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: "clamp(28px,4vw,44px)", marginTop: 16, lineHeight: 1.1 }}>Scannez et suivez votre chauffeur en temps réel</h2>
        <p style={{ color: "#94a3b8", maxWidth: 560, margin: "14px auto 0", fontSize: 15 }}>Un QR unique généré pour chaque client. Scannez, ouvrez le lien sur votre téléphone, et suivez l'arrivée du taxi sur la carte.</p>
      </div>

      <div style={{ maxWidth: 1100, margin: "48px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 28, alignItems: "center" }}>
        {/* QR */}
        <div style={{ background: "#fff", borderRadius: 24, padding: 24, position: "relative", maxWidth: 280, margin: "0 auto" }}>
          <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto", overflow: "hidden", borderRadius: 12 }}>
            {trackingUrl && <img src={qr} alt="QR de suivi" width={220} height={220} style={{ display: "block" }} />}
            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#0ea5e9,transparent)", animation: "scanLine 2.5s linear infinite" }} />
            <div style={{ ...corner, top: 0, left: 0, borderRight: 0, borderBottom: 0 }} />
            <div style={{ ...corner, top: 0, right: 0, borderLeft: 0, borderBottom: 0 }} />
            <div style={{ ...corner, bottom: 0, left: 0, borderRight: 0, borderTop: 0 }} />
            <div style={{ ...corner, bottom: 0, right: 0, borderLeft: 0, borderTop: 0 }} />
          </div>
          <div style={{ marginTop: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#64748b", textAlign: "center" }}>Nouveau code dans {count}s</div>
          <button onClick={copy} style={{ marginTop: 10, width: "100%", padding: "10px 12px", background: copied ? "#22c55e" : "#0ea5e9", color: "#fff", border: 0, borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            {copied ? "✓ Lien copié !" : "🔗 Copier le lien"}
          </button>
        </div>

        {/* Phone mockup */}
        <div style={{ width: 180, height: 320, background: "#1e293b", borderRadius: 28, padding: 8, margin: "0 auto", position: "relative", border: "3px solid #334155" }}>
          <div style={{ background: "#0a0f1e", borderRadius: 22, height: "100%", overflow: "hidden", position: "relative" }}>
            <svg viewBox="0 0 180 220" width="100%" height="65%" style={{ background: "#1e293b" }}>
              <path d="M20 180 Q60 120 100 100 T160 30" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="4 4" fill="none" />
              <circle cx="20" cy="180" r="6" fill="#0ea5e9" style={{ animation: "movePin 3s infinite" }} />
              <text x="150" y="40" fontSize="20">📍</text>
            </svg>
            <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 99 }}>● EN DIRECT</div>
            <div style={{ padding: 12, color: "#fff", fontFamily: "'Syne',sans-serif", fontWeight: 800 }}>
              <div style={{ fontSize: 20 }}>4 min</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>12–18 €</div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { e: "📱", t: "Réservez", d: "Formulaire, email ou WhatsApp" },
            { e: "🔍", t: "Scannez votre QR", d: "Lien unique généré pour vous" },
            { e: "🗺️", t: "Suivez en direct", d: "Carte, ETA, destination, prix" },
            { e: "🚕", t: "Montez à bord !", d: "Coordonnées chauffeur en 1 clic" },
          ].map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 36, height: 36, background: "rgba(14,165,233,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.e}</span>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>{s.t}</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Feature strip */}
      <div style={{ maxWidth: 1100, margin: "56px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        {[
          { e: "📍", t: "Position GPS", d: "Suivi temps réel" },
          { e: "⏱️", t: "Temps d'arrivée", d: "Précision à la minute" },
          { e: "💶", t: "Tarif estimé", d: "Fourchette transparente" },
          { e: "📞", t: "Contact direct", d: "06 73 07 23 22" },
          { e: "🔒", t: "QR unique", d: "Par client, par scan" },
        ].map((f, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22 }}>{f.e}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, marginTop: 6 }}>{f.t}</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{f.d}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 40 }}>
        <a href="tel:0673072322" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 56, minWidth: 300, padding: "0 28px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", textDecoration: "none", borderRadius: 16, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, boxShadow: "0 8px 32px rgba(14,165,233,0.3)" }}>
          📞 Réserver — 06 73 07 23 22
        </a>
      </div>
    </section>
  );
}

export default TrackingQRSection;
