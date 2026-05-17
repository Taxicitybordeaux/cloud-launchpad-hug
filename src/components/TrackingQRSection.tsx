import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";
import { t } from "@/lib/dict";

function generateId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildQrSrc(url: string): string {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220" +
    "&data=" +
    encodeURIComponent(url) +
    "&margin=12&color=0a0f1e&bgcolor=ffffff&ecc=H"
  );
}

const CORNER_STYLE: React.CSSProperties = {
  position: "absolute",
  width: 22,
  height: 22,
  border: "3px solid #0ea5e9",
  pointerEvents: "none",
};

const CORNERS: React.CSSProperties[] = [
  { ...CORNER_STYLE, top: 0, left: 0, borderRight: "none", borderBottom: "none" },
  { ...CORNER_STYLE, top: 0, right: 0, borderLeft: "none", borderBottom: "none" },
  { ...CORNER_STYLE, bottom: 0, left: 0, borderRight: "none", borderTop: "none" },
  { ...CORNER_STYLE, bottom: 0, right: 0, borderLeft: "none", borderTop: "none" },
];

export function TrackingQRSection() {
  const lang = useLang();
  const [clientId, setClientId] = useState("");
  const [count, setCount] = useState(30);
  const [copied, setCopied] = useState(false);
  const sidRef = useRef("");

  useEffect(() => {
    setClientId(generateId());

    const sid = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sid);
    sidRef.current = sid;

    supabase.from("site_analytics").insert({ event: "qr_impression", session_id: sid });

    const timer = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          setClientId(generateId());
          return 30;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const trackingUrl = typeof window !== "undefined" && clientId ? `${window.location.origin}/scan/${clientId}` : "";

  const qrSrc = trackingUrl ? buildQrSrc(trackingUrl) : "";

  const handleCopy = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      supabase.from("site_analytics").insert({ event: "qr_click", session_id: sidRef.current });
    } catch {
      // silent
    }
  };

  const steps = [
    { icon: "📱", title: t(lang, "qr.step1.t"), desc: t(lang, "qr.step1.d") },
    { icon: "🔍", title: t(lang, "qr.step2.t"), desc: t(lang, "qr.step2.d") },
    { icon: "🗺️", title: t(lang, "qr.step3.t"), desc: t(lang, "qr.step3.d") },
    { icon: "🚕", title: t(lang, "qr.step4.t"), desc: t(lang, "qr.step4.d") },
  ];

  const features = [
    { icon: "📍", title: t(lang, "qr.feat1.t"), desc: t(lang, "qr.feat1.d") },
    { icon: "⏱️", title: t(lang, "qr.feat2.t"), desc: t(lang, "qr.feat2.d") },
    { icon: "💶", title: t(lang, "qr.feat3.t"), desc: t(lang, "qr.feat3.d") },
    { icon: "📞", title: t(lang, "qr.feat4.t"), desc: t(lang, "qr.feat4.d") },
    { icon: "🔒", title: t(lang, "qr.feat5.t"), desc: t(lang, "qr.feat5.d") },
  ];

  // ─── styles ────────────────────────────────────────────────────────────────

  const S = {
    section: {
      background: "#0a0f1e",
      padding: "clamp(48px,8vw,88px) clamp(16px,5vw,40px)",
      color: "#f1f5f9",
      fontFamily: "'DM Sans', sans-serif",
    } as React.CSSProperties,

    header: {
      maxWidth: 1200,
      margin: "0 auto",
      textAlign: "center",
    } as React.CSSProperties,

    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(14,165,233,0.12)",
      color: "#0ea5e9",
      padding: "6px 14px",
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.06em",
    } as React.CSSProperties,

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "#0ea5e9",
      animation: "qr-pulse 1.5s ease-in-out infinite",
      flexShrink: 0,
    } as React.CSSProperties,

    h2: {
      fontFamily: "'Syne', sans-serif",
      fontWeight: 900,
      fontSize: "clamp(24px,4vw,44px)",
      marginTop: 16,
      lineHeight: 1.15,
    } as React.CSSProperties,

    subtitle: {
      color: "#94a3b8",
      maxWidth: 560,
      margin: "14px auto 0",
      fontSize: 15,
      lineHeight: 1.6,
    } as React.CSSProperties,

    banner: {
      maxWidth: 720,
      margin: "26px auto 0",
      background: "linear-gradient(135deg,rgba(14,165,233,0.12),rgba(14,165,233,0.04))",
      border: "1px solid rgba(14,165,233,0.35)",
      borderRadius: 16,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      textAlign: "left",
    } as React.CSSProperties,

    bannerTitle: {
      fontFamily: "'Syne', sans-serif",
      fontWeight: 800,
      fontSize: 14,
      color: "#f1f5f9",
    } as React.CSSProperties,

    bannerDesc: {
      fontSize: 13,
      color: "#94a3b8",
      marginTop: 4,
      lineHeight: 1.5,
    } as React.CSSProperties,

    grid: {
      maxWidth: 1100,
      margin: "40px auto 0",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 28,
      alignItems: "center",
    } as React.CSSProperties,

    qrCard: {
      background: "#fff",
      borderRadius: 24,
      padding: 24,
      maxWidth: 280,
      width: "100%",
      margin: "0 auto",
      boxSizing: "border-box",
    } as React.CSSProperties,

    qrFrame: {
      position: "relative",
      width: 220,
      height: 220,
      margin: "0 auto",
      overflow: "hidden",
      borderRadius: 12,
    } as React.CSSProperties,

    scanLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 2,
      background: "linear-gradient(90deg, transparent, #0ea5e9, transparent)",
      animation: "qr-scan 2.5s linear infinite",
      pointerEvents: "none",
    } as React.CSSProperties,

    timer: {
      marginTop: 12,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      color: "#64748b",
      textAlign: "center",
    } as React.CSSProperties,

    phone: {
      width: 180,
      height: 320,
      background: "#1e293b",
      borderRadius: 28,
      padding: 8,
      margin: "0 auto",
      border: "3px solid #334155",
      flexShrink: 0,
    } as React.CSSProperties,

    phoneInner: {
      background: "#0a0f1e",
      borderRadius: 22,
      height: "100%",
      overflow: "hidden",
      position: "relative",
    } as React.CSSProperties,

    liveBadge: {
      position: "absolute",
      top: 10,
      right: 10,
      background: "rgba(239,68,68,0.85)",
      color: "#fff",
      fontSize: 9,
      fontWeight: 800,
      padding: "3px 8px",
      borderRadius: 99,
    } as React.CSSProperties,

    etaBox: {
      padding: 12,
      color: "#fff",
      fontFamily: "'Syne', sans-serif",
      fontWeight: 800,
    } as React.CSSProperties,

    stepsList: {
      listStyle: "none",
      padding: 0,
      margin: "0 auto",
      maxWidth: 340,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    } as React.CSSProperties,

    stepIcon: {
      width: 36,
      height: 36,
      background: "rgba(14,165,233,0.12)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      flexShrink: 0,
    } as React.CSSProperties,

    stepTitle: {
      fontFamily: "'Syne', sans-serif",
      fontWeight: 700,
      color: "#f1f5f9",
    } as React.CSSProperties,

    stepDesc: {
      color: "#94a3b8",
      fontSize: 13,
    } as React.CSSProperties,

    featureGrid: {
      maxWidth: 1100,
      margin: "48px auto 0",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 12,
    } as React.CSSProperties,

    featureCard: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
      padding: "14px 12px",
      textAlign: "center",
    } as React.CSSProperties,

    featureTitle: {
      fontFamily: "'Syne', sans-serif",
      fontWeight: 700,
      marginTop: 6,
      fontSize: 13,
      color: "#f1f5f9",
    } as React.CSSProperties,

    featureDesc: {
      color: "#94a3b8",
      fontSize: 12,
    } as React.CSSProperties,

    ctaWrap: {
      textAlign: "center",
      marginTop: 40,
    } as React.CSSProperties,

    cta: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 56,
      padding: "0 28px",
      minWidth: 300,
      background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
      color: "#fff",
      textDecoration: "none",
      borderRadius: 16,
      fontFamily: "'Syne', sans-serif",
      fontWeight: 700,
      fontSize: 16,
      boxShadow: "0 8px 32px rgba(14,165,233,0.3)",
      boxSizing: "border-box",
    } as React.CSSProperties,

    copyBtn: (active: boolean): React.CSSProperties => ({
      marginTop: 10,
      width: "100%",
      padding: "10px 12px",
      background: active ? "#22c55e" : "#0ea5e9",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      transition: "background 0.2s",
    }),
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <section style={S.section}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes qr-scan  { 0%{top:0} 50%{top:calc(100% - 2px)} 100%{top:0} }
        @keyframes qr-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes qr-pin   { 0%{transform:translate(0,0)} 50%{transform:translate(20px,-12px)} 100%{transform:translate(0,0)} }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <span style={S.badge}>
          <span style={S.liveDot} />
          {t(lang, "qr.badge")}
        </span>

        <h2 style={S.h2}>{t(lang, "qr.title")}</h2>

        <p style={S.subtitle}>{t(lang, "qr.subtitle")}</p>

        <div style={S.banner}>
          <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>📲</span>
          <div>
            <p style={S.bannerTitle}>{t(lang, "qr.banner.title")}</p>
            <p style={S.bannerDesc}>{t(lang, "qr.banner.desc")}</p>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={S.grid}>
        {/* QR card */}
        <div style={S.qrCard}>
          <div style={S.qrFrame}>
            {qrSrc && <img src={qrSrc} alt="QR de suivi" width={220} height={220} style={{ display: "block" }} />}
            <div style={S.scanLine} />
            {CORNERS.map((cs, i) => (
              <div key={i} style={cs} />
            ))}
          </div>

          <p style={S.timer}>{t(lang, "qr.timer").replace("{count}", String(count))}</p>

          <button onClick={handleCopy} style={S.copyBtn(copied)}>
            {copied ? t(lang, "qr.copied") : t(lang, "qr.copy")}
          </button>
        </div>

        {/* Phone mockup */}
        <div style={S.phone}>
          <div style={S.phoneInner}>
            <svg viewBox="0 0 180 220" width="100%" height="65%" style={{ background: "#1e293b", display: "block" }}>
              <path
                d="M20 180 Q60 120 100 100 T160 30"
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
              />
              <circle cx="20" cy="180" r="6" fill="#0ea5e9" style={{ animation: "qr-pin 3s ease-in-out infinite" }} />
              <text x="150" y="40" fontSize="20">
                📍
              </text>
            </svg>

            <div style={S.liveBadge}>● {t(lang, "suivi.online").toUpperCase()}</div>

            <div style={S.etaBox}>
              <div style={{ fontSize: 20 }}>4 min</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
                12–18 €
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <ol style={S.stepsList}>
          {steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={S.stepIcon}>{s.icon}</span>
              <div>
                <p style={S.stepTitle}>{s.title}</p>
                <p style={S.stepDesc}>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Feature strip ── */}
      <div style={S.featureGrid}>
        {features.map((f, i) => (
          <div key={i} style={S.featureCard}>
            <div style={{ fontSize: 22 }}>{f.icon}</div>
            <p style={S.featureTitle}>{f.title}</p>
            <p style={S.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div style={S.ctaWrap}>
        <a href="tel:0673072322" style={S.cta}>
          {t(lang, "qr.cta")}
        </a>
      </div>
    </section>
  );
}

export default TrackingQRSection;
