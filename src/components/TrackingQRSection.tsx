import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";
import { t } from "@/lib/dict";

// ─── helpers ────────────────────────────────────────────────────────────────

function generateId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildQrSrc(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&margin=12&color=0a0f1e&bgcolor=ffffff&ecc=H`;
}

// ─── component ───────────────────────────────────────────────────────────────

export function TrackingQRSection() {
  const lang = useLang();

  // SSR-safe: empty on server, populated after mount
  const [clientId, setClientId] = useState("");
  const [count, setCount] = useState(30);
  const [copied, setCopied] = useState(false);
  const sidRef = useRef("");

  useEffect(() => {
    // Generate first id client-side only (avoids hydration mismatch)
    setClientId(generateId());

    // Session tracking
    const sid = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sid);
    sidRef.current = sid;

    // Fire-and-forget analytics impression
    supabase.from("site_analytics").insert({ event: "qr_impression", session_id: sid });

    // Countdown + rotate QR every 30 s
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
      // clipboard unavailable — silent fail
    }
  };

  // ── steps & features data ────────────────────────────────────────────────
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

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <section className="bg-[#0a0f1e] text-slate-100 font-sans">
      {/* Keyframe animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes qr-scan {
          0%   { top: 0 }
          50%  { top: calc(100% - 2px) }
          100% { top: 0 }
        }
        @keyframes qr-pulse {
          0%, 100% { opacity: 1 }
          50%       { opacity: 0.3 }
        }
        @keyframes qr-pin {
          0%   { transform: translate(0, 0) }
          50%  { transform: translate(20px, -12px) }
          100% { transform: translate(0, 0) }
        }

        .qr-scan-line  { animation: qr-scan  2.5s linear infinite; }
        .qr-live-dot   { animation: qr-pulse 1.5s ease-in-out infinite; }
        .qr-pin-circle { animation: qr-pin   3s ease-in-out infinite; }
      `}</style>

      <div className="px-[clamp(16px,5vw,40px)] py-[clamp(48px,8vw,88px)]">
        {/* ── Header ── */}
        <div className="max-w-[1200px] mx-auto text-center">
          {/* Badge */}
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-sky-400"
            style={{
              background: "rgba(14,165,233,0.12)",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
            }}
          >
            <span className="qr-live-dot w-[7px] h-[7px] rounded-full bg-sky-400 shrink-0" />
            {t(lang, "qr.badge")}
          </span>

          {/* Title */}
          <h2
            className="mt-4 leading-[1.15] font-black text-slate-50"
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(24px, 4vw, 44px)",
            }}
          >
            {t(lang, "qr.title")}
          </h2>

          {/* Subtitle */}
          <p className="mt-3.5 mx-auto text-slate-400 text-[15px] leading-relaxed" style={{ maxWidth: 560 }}>
            {t(lang, "qr.subtitle")}
          </p>

          {/* Info banner */}
          <div
            className="mt-6 mx-auto flex items-center gap-3.5 text-left rounded-2xl px-5 py-4"
            style={{
              maxWidth: 720,
              background: "linear-gradient(135deg,rgba(14,165,233,0.12),rgba(14,165,233,0.04))",
              border: "1px solid rgba(14,165,233,0.35)",
            }}
          >
            <span className="text-2xl leading-none shrink-0">📲</span>
            <div>
              <p className="text-sm font-extrabold text-slate-50" style={{ fontFamily: "'Syne', sans-serif" }}>
                {t(lang, "qr.banner.title")}
              </p>
              <p className="mt-1 text-[13px] text-slate-400 leading-relaxed">{t(lang, "qr.banner.desc")}</p>
            </div>
          </div>
        </div>

        {/* ── Main grid: QR card | Phone mockup | Steps ── */}
        <div
          className="max-w-[1100px] mx-auto mt-10 grid items-center gap-7"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          }}
        >
          {/* QR card */}
          <div className="bg-white rounded-3xl p-6 mx-auto w-full" style={{ maxWidth: 280, boxSizing: "border-box" }}>
            {/* QR frame */}
            <div className="relative w-[220px] h-[220px] mx-auto overflow-hidden rounded-xl">
              {qrSrc && <img src={qrSrc} alt="QR de suivi" width={220} height={220} className="block" />}

              {/* Scan line */}
              <div
                className="qr-scan-line absolute left-0 right-0 h-0.5 pointer-events-none"
                style={{
                  background: "linear-gradient(90deg, transparent, #0ea5e9, transparent)",
                }}
              />

              {/* Corner decorations */}
              {[
                { top: 0, left: 0, borderRight: "none", borderBottom: "none" },
                { top: 0, right: 0, borderLeft: "none", borderBottom: "none" },
                { bottom: 0, left: 0, borderRight: "none", borderTop: "none" },
                { bottom: 0, right: 0, borderLeft: "none", borderTop: "none" },
              ].map((style, i) => (
                <div
                  key={i}
                  className="absolute w-[22px] h-[22px] pointer-events-none"
                  style={{ border: "3px solid #0ea5e9", ...style }}
                />
              ))}
            </div>

            {/* Timer */}
            <p
              className="mt-3 text-center text-[11px] text-slate-500"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {t(lang, "qr.timer").replace("{count}", String(count))}
            </p>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="mt-2.5 w-full py-2.5 rounded-xl text-white text-[13px] font-bold transition-colors duration-200 cursor-pointer border-0"
              style={{ background: copied ? "#22c55e" : "#0ea5e9" }}
            >
              {copied ? t(lang, "qr.copied") : t(lang, "qr.copy")}
            </button>
          </div>

          {/* Phone mockup */}
          <div
            className="mx-auto rounded-[28px] p-2"
            style={{
              width: 180,
              height: 320,
              background: "#1e293b",
              border: "3px solid #334155",
              flexShrink: 0,
            }}
          >
            <div className="relative rounded-[22px] h-full overflow-hidden" style={{ background: "#0a0f1e" }}>
              {/* Map SVG */}
              <svg viewBox="0 0 180 220" width="100%" height="65%" style={{ background: "#1e293b", display: "block" }}>
                <path
                  d="M20 180 Q60 120 100 100 T160 30"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                <circle cx="20" cy="180" r="6" fill="#0ea5e9" className="qr-pin-circle" />
                <text x="150" y="40" fontSize="20">
                  📍
                </text>
              </svg>

              {/* Live badge */}
              <div
                className="absolute top-2.5 right-2.5 text-white font-extrabold rounded-full px-2 py-0.5"
                style={{ background: "rgba(239,68,68,0.85)", fontSize: 9 }}
              >
                ● {t(lang, "suivi.online").toUpperCase()}
              </div>

              {/* ETA + price */}
              <div className="px-3 py-2 text-white font-black" style={{ fontFamily: "'Syne', sans-serif" }}>
                <div className="text-xl">4 min</div>
                <div
                  className="text-[11px] text-slate-400 font-medium mt-0.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  12–18 €
                </div>
              </div>
            </div>
          </div>

          {/* Steps list */}
          <ol className="list-none p-0 mx-auto flex flex-col gap-3.5" style={{ maxWidth: 340 }}>
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-lg"
                  style={{ background: "rgba(14,165,233,0.12)" }}
                >
                  {s.icon}
                </span>
                <div>
                  <p className="font-bold text-slate-50 leading-snug" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {s.title}
                  </p>
                  <p className="text-[13px] text-slate-400 mt-0.5">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Feature strip ── */}
        <div
          className="max-w-[1100px] mx-auto mt-12 grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              className="text-center rounded-2xl px-3 py-3.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="text-[22px]">{f.icon}</div>
              <p className="mt-1.5 text-[13px] font-bold text-slate-50" style={{ fontFamily: "'Syne', sans-serif" }}>
                {f.title}
              </p>
              <p className="text-[12px] text-slate-400 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-10 text-center">
          <a
            href="tel:0673072322"
            className="inline-flex items-center justify-center gap-2 rounded-2xl text-white no-underline font-black text-base"
            style={{
              fontFamily: "'Syne', sans-serif",
              height: 56,
              padding: "0 28px",
              minWidth: "min(300px, 100%)",
              background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
              boxShadow: "0 8px 32px rgba(14,165,233,0.3)",
              boxSizing: "border-box",
            }}
          >
            {t(lang, "qr.cta")}
          </a>
        </div>
      </div>
    </section>
  );
}

export default TrackingQRSection;
