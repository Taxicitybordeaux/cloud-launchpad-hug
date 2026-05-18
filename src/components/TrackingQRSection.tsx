import { useT } from "@/i18n/I18nProvider";

export interface TrackingQRSectionProps {
  /** legacy props kept for compatibility — unused here */
  onImpression?: (clientId: string) => void;
  onCopy?: (url: string) => void;
  baseUrl?: string;
}

export function TrackingQRSection(_props: TrackingQRSectionProps = {}) {
  const t = useT();

  const steps = [
    { icon: "📱", title: t("qr.step1.t"), desc: t("qr.step1.d") },
    { icon: "🔍", title: t("qr.step2.t"), desc: t("qr.step2.d") },
    { icon: "🗺️", title: t("qr.step3.t"), desc: t("qr.step3.d") },
    { icon: "🚕", title: t("qr.step4.t"), desc: t("qr.step4.d") },
  ];

  const features = [
    { icon: "📍", title: t("qr.feat1.t"), desc: t("qr.feat1.d") },
    { icon: "⏱️", title: t("qr.feat2.t"), desc: t("qr.feat2.d") },
    { icon: "💶", title: t("qr.feat3.t"), desc: t("qr.feat3.d") },
    { icon: "📞", title: t("qr.feat4.t"), desc: t("qr.feat4.d") },
    { icon: "🔒", title: t("qr.feat5.t"), desc: t("qr.feat5.d") },
  ];

  return (
    <section
      style={{
        background: "#0a0f1e",
        padding: "clamp(48px,8vw,88px) clamp(16px,5vw,40px)",
        color: "#f1f5f9",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
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
              display: "inline-block",
            }}
          />
          {t("qr.badge")}
        </span>

        <h2
          style={{
            fontWeight: 900,
            fontSize: "clamp(24px,4vw,44px)",
            lineHeight: 1.15,
            margin: "16px 0 0",
          }}
        >
          {t("qr.title")}
        </h2>

        <p
          style={{
            color: "#94a3b8",
            maxWidth: 620,
            margin: "14px auto 0",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          {t("qr.subtitle")}
        </p>
      </div>

      {/* Steps */}
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: "40px auto 0",
          maxWidth: 720,
          display: "grid",
          gap: 14,
        }}
      >
        {steps.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span
              style={{
                width: 40,
                height: 40,
                background: "rgba(14,165,233,.12)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {s.icon}
            </span>
            <div>
              <p style={{ fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{s.title}</p>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Feature strip */}
      <div
        style={{
          maxWidth: 1100,
          margin: "40px auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 12,
        }}
      >
        {features.map((f, i) => (
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
    </section>
  );
}
