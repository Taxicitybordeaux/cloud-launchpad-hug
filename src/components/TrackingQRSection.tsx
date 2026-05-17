import { useEffect, useRef, useState } from "react";

// ─── types ───────────────────────────────────────────────────────────────────

type Step = { icon: string; title: string; desc: string };
type Feature = { icon: string; title: string; desc: string };

export interface TrackingQRSectionProps {
  /** called when QR is generated (analytics) */
  onImpression?: (clientId: string) => void;
  /** called when user copies the link */
  onCopy?: (url: string) => void;
  /** base URL for the tracking link — defaults to window.location.origin */
  baseUrl?: string;
  /** i18n strings — all optional, French defaults provided */
  labels?: {
    badge?: string;
    title?: string;
    subtitle?: string;
    bannerTitle?: string;
    bannerDesc?: string;
    timer?: string; // use {count} placeholder
    copyBtn?: string;
    copiedBtn?: string;
    liveLabel?: string;
    steps?: Step[];
    features?: Feature[];
    cta?: string;
  };
}

// ─── defaults ────────────────────────────────────────────────────────────────

const DEFAULT_LABELS = {
  badge: "SUIVI EN TEMPS RÉEL",
  title: "Scannez et suivez votre chauffeur en temps réel",
  subtitle:
    "Un QR unique généré pour chaque client. Scannez, ouvrez le lien sur votre téléphone, et suivez l'arrivée du taxi sur la carte.",
  bannerTitle: "Ouvrez ce lien sur votre téléphone et flashez le QR code",
  bannerDesc: "Position du chauffeur, ETA, prix estimé. Aucune installation requise.",
  timer: "Nouveau code dans {count}s",
  copyBtn: "🔗 Copier le lien",
  copiedBtn: "✓ Lien copié !",
  liveLabel: "EN ROUTE",
  steps: [
    { icon: "📱", title: "Réservez", desc: "Formulaire, email ou WhatsApp" },
    { icon: "🔍", title: "Scannez votre QR", desc: "Lien unique généré pour vous" },
    { icon: "🗺️", title: "Suivez en direct", desc: "Carte, ETA, destination, prix" },
    { icon: "🚕", title: "Montez à bord !", desc: "Coordonnées chauffeur en 1 clic" },
  ],
  features: [
    { icon: "📍", title: "Position GPS", desc: "Suivi temps réel" },
    { icon: "⏱️", title: "Temps d'arrivée", desc: "Précision à la minute" },
    { icon: "💶", title: "Tarif estimé", desc: "Fourchette transparente" },
    { icon: "📞", title: "Contact direct", desc: "06 73 07 23 22" },
    { icon: "🔒", title: "QR unique", desc: "Par client, par scan" },
  ],
  cta: "📞 Réserver — 06 73 07 23 22",
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function qrUrl(trackingLink: string): string {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220" +
    "&data=" +
    encodeURIComponent(trackingLink) +
    "&margin=12&color=0a0f1e&bgcolor=ffffff&ecc=H"
  );
}

// ─── corner decorations ──────────────────────────────────────────────────────

const corners: React.CSSProperties[] = [
  {
    position: "absolute",
    width: 22,
    height: 22,
    top: 0,
    left: 0,
    border: "3px solid #0ea5e9",
    borderRight: "none",
    borderBottom: "none",
  },
  {
    position: "absolute",
    width: 22,
    height: 22,
    top: 0,
    right: 0,
    border: "3px solid #0ea5e9",
    borderLeft: "none",
    borderBottom: "none",
  },
  {
    position: "absolute",
    width: 22,
    height: 22,
    bottom: 0,
    left: 0,
    border: "3px solid #0ea5e9",
    borderRight: "none",
    borderTop: "none",
  },
  {
    position: "absolute",
    width: 22,
    height: 22,
    bottom: 0,
    right: 0,
    border: "3px solid #0ea5e9",
    borderLeft: "none",
    borderTop: "none",
  },
];

// ─── component ───────────────────────────────────────────────────────────────

export function TrackingQRSection({ onImpression, onCopy, baseUrl, labels = {} }: TrackingQRSectionProps) {
  const L = { ...DEFAULT_LABELS, ...labels };

  const [clientId, setClientId] = useState<string>("");
  const [count, setCount] = useState<number>(30);
  const [copied, setCopied] = useState<boolean>(false);
  const initialized = useRef<boolean>(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const id = makeId();
    setClientId(id);
    onImpression?.(id);

    const timer = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          const next = makeId();
          setClientId(next);
          onImpression?.(next);
          return 30;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onImpression]);

  const origin = baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const trackingLink = clientId ? `${origin}/scan/${clientId}` : "";
  const qrSrc = trackingLink ? qrUrl(trackingLink) : "";

  const handleCopy = async () => {
    if (!trackingLink) return;
    try {
      await navigator.clipboard.writeText(trackingLink);
      setCopied(true);
      onCopy?.(trackingLink);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard unavailable
    }
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <section
      style={{
        background: "#0a0f1e",
        padding: "clamp(48px,8vw,88px) clamp(16px,5vw,40px)",
        color: "#f1f5f9",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @keyframes qr-scan  { 0%{top:0} 50%{top:calc(100% - 2px)} 100%{top:0} }
        @keyframes qr-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes qr-pin   { 0%{transform:translate(0,0)} 50%{transform:translate(20px,-12px)} 100%{transform:translate(0,0)} }
        .qr-fonts { font-family: inherit }
      `}</style>

      {/* ── Header ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(14,165,233,.12)",
            color: "#0ea5e9",
            padding: "6px 14px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#0ea5e9",
              animation: "qr-pulse 1.5s ease-in-out infinite",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          {L.badge}
        </span>

        <h2
          style={{
            fontWeight: 900,
            fontSize: "clamp(24px,4vw,44px)",
            marginTop: 16,
            lineHeight: 1.15,
            margin: "16px 0 0",
          }}
        >
          {L.title}
        </h2>

        <p
          style={{
            color: "#94a3b8",
            maxWidth: 560,
            margin: "14px auto 0",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          {L.subtitle}
        </p>

        {/* Banner */}
        <div
          style={{
            maxWidth: 720,
            margin: "26px auto 0",
            background: "linear-gradient(135deg,rgba(14,165,233,.12),rgba(14,165,233,.04))",
            border: "1px solid rgba(14,165,233,.35)",
            borderRadius: 16,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>📲</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", margin: 0 }}>{L.bannerTitle}</p>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, lineHeight: 1.5, marginBottom: 0 }}>
              {L.bannerDesc}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div
        style={{
          maxWidth: 1100,
          margin: "40px auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: 28,
          alignItems: "center",
        }}
      >
        {/* QR card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 24,
            maxWidth: 280,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 220,
              height: 220,
              margin: "0 auto",
              overflow: "hidden",
              borderRadius: 12,
            }}
          >
            {qrSrc && <img src={qrSrc} alt="QR code de suivi" width={220} height={220} style={{ display: "block" }} />}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                background: "linear-gradient(90deg,transparent,#0ea5e9,transparent)",
                animation: "qr-scan 2.5s linear infinite",
              }}
            />
            {corners.map((cs, i) => (
              <div key={i} style={cs} />
            ))}
          </div>

          <p
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "#64748b",
              textAlign: "center",
              marginBottom: 0,
            }}
          >
            {L.timer.replace("{count}", String(count))}
          </p>

          <button
            onClick={handleCopy}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "10px 12px",
              background: copied ? "#22c55e" : "#0ea5e9",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              transition: "background .2s",
            }}
          >
            {copied ? L.copiedBtn : L.copyBtn}
          </button>
        </div>

        {/* Phone mockup */}
        <div
          style={{
            width: 180,
            height: 320,
            background: "#1e293b",
            borderRadius: 28,
            padding: 8,
            margin: "0 auto",
            border: "3px solid #334155",
          }}
        >
          <div
            style={{
              background: "#0a0f1e",
              borderRadius: 22,
              height: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
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

            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                background: "rgba(239,68,68,.85)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: 99,
              }}
            >
              ● {L.liveLabel}
            </div>

            <div style={{ padding: 12, color: "#fff", fontWeight: 800 }}>
              <div style={{ fontSize: 20 }}>4 min</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>12–18 €</div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 auto",
            maxWidth: 340,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {L.steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(14,165,233,.12)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </span>
              <div>
                <p style={{ fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{s.title}</p>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Feature strip ── */}
      <div
        style={{
          maxWidth: 1100,
          margin: "48px auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 12,
        }}
      >
        {L.features.map((f, i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 14,
              padding: "14px 12px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22 }}>{f.icon}</div>
            <p style={{ fontWeight: 700, marginTop: 6, fontSize: 13, color: "#f1f5f9", marginBottom: 0 }}>{f.title}</p>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <a
          href="tel:0673072322"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 56,
            padding: "0 28px",
            minWidth: 300,
            background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 16,
            fontWeight: 700,
            fontSize: 16,
            boxShadow: "0 8px 32px rgba(14,165,233,.3)",
            boxSizing: "border-box",
          }}
        >
          {L.cta}
        </a>
      </div>
    </section>
  );
}

export default TrackingQRSection;
