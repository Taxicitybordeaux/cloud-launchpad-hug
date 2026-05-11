import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";
const REFRESH_SECONDS = 30;

function makeId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildTrackingUrl(id: string) {
  return `https://taxicitybordeaux.fr/tracking/${id}`;
}

function buildQrUrl(trackingUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    trackingUrl,
  )}&margin=12&color=0a0f1e&bgcolor=ffffff&ecc=H`;
}

const STEPS = [
  { icon: "📱", title: "Réservez par téléphone", desc: "Appelez le 06 73 07 23 22, nous prenons votre course." },
  { icon: "🔍", title: "Scannez votre QR code", desc: "Ce QR code vous génère un lien personnel unique." },
  { icon: "🗺️", title: "Suivez en temps réel", desc: "Carte live, ETA et tarif estimé directement sur votre écran." },
  { icon: "🚕", title: "Votre taxi arrive !", desc: "Appelez votre chauffeur en un clic depuis la page de suivi." },
];

const FEATURES = [
  { icon: "📍", title: "Position en direct", sub: "GPS temps réel" },
  { icon: "⏱️", title: "Temps d'arrivée", sub: "Précision à la minute" },
  { icon: "💶", title: "Tarif estimé", sub: "Fourchette transparente" },
  { icon: "📞", title: "Contact direct", sub: PHONE_DISPLAY },
  { icon: "🔒", title: "QR unique", sub: "Par client, par scan" },
];

export function TrackingQRSection() {
  const [trackingId, setTrackingId] = useState<string>(() => makeId());
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);
  const [copied, setCopied] = useState(false);

  // hidden GPS panel
  const [clickCount, setClickCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  const trackingUrl = buildTrackingUrl(trackingId);
  const qrUrl = buildQrUrl(trackingUrl);

  // countdown + auto refresh of QR
  useEffect(() => {
    const t = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setTrackingId(makeId());
          return REFRESH_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // cleanup geolocation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  const handleSecretClick = () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    setClickCount((c) => {
      const next = c + 1;
      if (next >= 5) {
        setShowPanel(true);
        return 0;
      }
      return next;
    });
    clickTimerRef.current = window.setTimeout(() => setClickCount(0), 1500);
  };

  const activateGps = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("Géolocalisation non disponible sur cet appareil.");
      return;
    }
    setGpsError(null);
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        setGpsCoords({ lat: latitude, lng: longitude, acc: accuracy });
        setGpsActive(true);
        await supabase.from("driver_gps").upsert(
          {
            id: "driver",
            is_active: true,
            latitude,
            longitude,
            accuracy,
            heading: heading ?? null,
            speed: speed ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
      },
      (err) => {
        setGpsError(err.message || "Erreur GPS");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    watchIdRef.current = id;
  };

  const deactivateGps = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
    await supabase
      .from("driver_gps")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", "driver");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .tqr-syne { font-family: 'Syne', system-ui, sans-serif; }
        .tqr-dm { font-family: 'DM Sans', system-ui, sans-serif; }
        .tqr-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        @keyframes tqrScan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(196px); opacity: 0; }
        }
        @keyframes tqrPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.55; }
        }
        @keyframes tqrPulseRing {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes tqrFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes tqrDrive {
          0% { transform: translate(0, 0); }
          50% { transform: translate(28px, -22px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes tqrDash {
          to { stroke-dashoffset: -40; }
        }
      `}</style>

      <section
        className="tqr-dm"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "#0a0f1e",
          color: "#fff",
          padding: "80px 24px",
        }}
      >
        {/* ambient bg */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, rgba(14,165,233,0.06), transparent 60%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto" }}>
          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(14,165,233,0.08)",
                color: "#7dd3fc",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 0 0 rgba(34,197,94,0.6)",
                  animation: "tqrPulse 1.6s ease-in-out infinite",
                  display: "inline-block",
                }}
              />
              SUIVI EN TEMPS RÉEL
            </span>
          </div>

          {/* Headline */}
          <h2
            className="tqr-syne"
            onClick={handleSecretClick}
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: "clamp(28px, 4.4vw, 44px)",
              lineHeight: 1.1,
              margin: 0,
              cursor: "default",
              userSelect: "none",
            }}
          >
            🚕 Scannez et suivez votre chauffeur
          </h2>
          <p
            style={{
              textAlign: "center",
              maxWidth: 640,
              margin: "16px auto 0",
              color: "#94a3b8",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            Un QR code unique vous est attribué à chaque scan. Suivez votre taxi en direct,
            consultez le tarif et appelez votre chauffeur — sans aucune application.
          </p>

          {/* Main 3 columns */}
          <div
            style={{
              marginTop: 56,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "stretch",
              gap: 48,
            }}
          >
            {/* LEFT — QR card */}
            <div
              style={{
                flex: "1 1 280px",
                maxWidth: 320,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 24,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  color: "#64748b",
                  textTransform: "uppercase",
                }}
              >
                Votre QR code
              </div>

              {/* white QR box with scan effects */}
              <div
                style={{
                  position: "relative",
                  background: "#fff",
                  padding: 14,
                  borderRadius: 16,
                  width: 228,
                  height: 228,
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                }}
              >
                <img
                  src={qrUrl}
                  alt="QR code de suivi"
                  width={200}
                  height={200}
                  style={{ display: "block", borderRadius: 6 }}
                />
                {/* scan line */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 14,
                    right: 14,
                    top: 14,
                    height: 2,
                    background: "linear-gradient(90deg, transparent, #0ea5e9, transparent)",
                    boxShadow: "0 0 12px rgba(14,165,233,0.85)",
                    animation: "tqrScan 2.5s linear infinite",
                  }}
                />
                {/* corner markers */}
                {[
                  { top: 6, left: 6, borderTop: "3px solid #0ea5e9", borderLeft: "3px solid #0ea5e9" },
                  { top: 6, right: 6, borderTop: "3px solid #0ea5e9", borderRight: "3px solid #0ea5e9" },
                  { bottom: 6, left: 6, borderBottom: "3px solid #0ea5e9", borderLeft: "3px solid #0ea5e9" },
                  { bottom: 6, right: 6, borderBottom: "3px solid #0ea5e9", borderRight: "3px solid #0ea5e9" },
                ].map((s, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{
                      position: "absolute",
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      ...(s as React.CSSProperties),
                    }}
                  />
                ))}
              </div>

              <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                Pointez votre caméra ici
              </div>
              <div style={{ color: "#64748b", fontSize: 12 }}>Fonctionne sur iOS et Android</div>

              <div
                className="tqr-mono"
                style={{
                  marginTop: 6,
                  color: "#7dd3fc",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                }}
              >
                Nouveau code dans {secondsLeft}s
              </div>

              <button
                type="button"
                onClick={handleCopy}
                style={{
                  marginTop: 8,
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: copied ? "rgba(34,197,94,0.15)" : "rgba(14,165,233,0.12)",
                  color: copied ? "#86efac" : "#7dd3fc",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ Copié !" : "🔗 Copier le lien"}
              </button>
            </div>

            {/* CENTER — phone mockup */}
            <div
              style={{
                flex: "0 0 auto",
                position: "relative",
                width: 180,
                height: 320,
                background: "#0f172a",
                borderRadius: 36,
                padding: 10,
                boxShadow:
                  "0 30px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              {/* live badge */}
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  background: "#22c55e",
                  color: "#052e1a",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  borderRadius: 999,
                  boxShadow: "0 6px 18px rgba(34,197,94,0.4)",
                  animation: "tqrFloat 3s ease-in-out infinite",
                }}
              >
                ● EN DIRECT
              </div>

              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 28,
                  background: "#0b1220",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* top bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    fontSize: 9,
                    color: "#cbd5e1",
                    fontWeight: 600,
                  }}
                >
                  <span>Taxi City Bordeaux</span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#0ea5e9",
                      animation: "tqrPulse 1.4s ease-in-out infinite",
                    }}
                  />
                </div>

                {/* map */}
                <div
                  style={{
                    flex: 1,
                    margin: 6,
                    background: "#e0f2fe",
                    borderRadius: 16,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* grid */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage:
                        "linear-gradient(rgba(148,163,184,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.3) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  {/* path */}
                  <svg
                    viewBox="0 0 160 200"
                    preserveAspectRatio="none"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  >
                    <path
                      d="M 10 180 Q 60 120 80 100 T 150 20"
                      stroke="#0ea5e9"
                      strokeWidth="2.4"
                      strokeDasharray="6 5"
                      fill="none"
                      strokeLinecap="round"
                      style={{ animation: "tqrDash 1.2s linear infinite" }}
                    />
                  </svg>
                  {/* destination pin */}
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 12,
                      fontSize: 18,
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                    }}
                  >
                    📍
                  </span>
                  {/* moving driver dot */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 22,
                      left: 14,
                      width: 14,
                      height: 14,
                      animation: "tqrDrive 4s ease-in-out infinite",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        background: "rgba(14,165,233,0.4)",
                        animation: "tqrPulseRing 1.6s ease-out infinite",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        inset: 2,
                        borderRadius: "50%",
                        background: "#0ea5e9",
                        boxShadow: "0 0 0 2px #fff",
                      }}
                    />
                  </div>
                </div>

                {/* ETA strip */}
                <div
                  style={{
                    margin: 6,
                    background: "#fff",
                    borderRadius: 12,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🚕</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Arrivée dans
                    </div>
                    <div style={{ color: "#0369a1", fontWeight: 800, fontSize: 13 }}>4 min</div>
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>12–18 €</div>
                </div>
              </div>
            </div>

            {/* RIGHT — steps */}
            <div
              style={{
                flex: "1 1 280px",
                maxWidth: 360,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(14,165,233,0.1)",
                      border: "1px solid rgba(14,165,233,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="tqr-mono"
                      style={{
                        fontSize: 10,
                        color: "#7dd3fc",
                        letterSpacing: "0.1em",
                        marginBottom: 2,
                      }}
                    >
                      0{i + 1}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature strip */}
          <div
            style={{
              marginTop: 56,
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 20,
              overflow: "hidden",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 180px",
                  padding: 20,
                  textAlign: "center",
                  borderLeft: i === 0 ? undefined : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{f.title}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{f.sub}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
            <a
              href={`tel:${PHONE}`}
              className="tqr-syne"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 56,
                minWidth: 300,
                padding: "0 28px",
                borderRadius: 16,
                background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                textDecoration: "none",
                boxShadow: "0 8px 32px rgba(14,165,233,0.3)",
              }}
            >
              📞 Réserver — {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      {/* Hidden GPS panel */}
      {showPanel && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: 14,
            color: "#fff",
            zIndex: 9999,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            minWidth: 280,
            maxWidth: "calc(100vw - 32px)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#7dd3fc" }}>
              MODE CHAUFFEUR
            </div>
            <button
              onClick={() => setShowPanel(false)}
              aria-label="Fermer"
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          {gpsActive ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#22c55e",
                    animation: "tqrPulse 1.4s ease-in-out infinite",
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 700 }}>GPS actif</span>
              </div>
              {gpsCoords && (
                <div
                  className="tqr-mono"
                  style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}
                >
                  lat {gpsCoords.lat.toFixed(6)}
                  <br />
                  lng {gpsCoords.lng.toFixed(6)}
                  {gpsCoords.acc !== undefined && (
                    <>
                      <br />± {Math.round(gpsCoords.acc)} m
                    </>
                  )}
                </div>
              )}
              <button
                onClick={deactivateGps}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                ⏹ Désactiver
              </button>
            </>
          ) : (
            <>
              <button
                onClick={activateGps}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                📡 Activer mon GPS
              </button>
              {gpsError && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#fca5a5" }}>{gpsError}</div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

export default TrackingQRSection;
