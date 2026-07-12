import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import logoSrc from "@/assets/tcb-logo.jpeg";

export const Route = createFileRoute("/qr-generator")({
  head: () => ({
    meta: [
      { title: "Générateur QR — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrGeneratorPage,
});

// Vignette CT ≈ 80 mm. À 300 dpi → 945 px. On rend 1200 px pour marge.
const PRINT_SIZE_PX = 1200; // haute résolution impression
const PREVIEW_SIZE_PX = 480; // aperçu écran

type Form = {
  name: string;
  phone: string;
  email: string;
  site: string;
  org: string;
};

const DEFAULTS: Form = {
  name: "Josè",
  phone: "0673072322",
  email: "taxi.city033@gmail.com",
  site: "https://taxicitybordeaux.fr",
  org: "Taxi City Bordeaux",
};

function buildVCard(f: Form): string {
  const tel = f.phone.replace(/\s+/g, "");
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${f.name}`,
    `N:${f.name};;;;`,
    `ORG:${f.org}`,
    tel ? `TEL;TYPE=CELL:${tel}` : "",
    f.email ? `EMAIL:${f.email}` : "",
    f.site ? `URL:${f.site}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
}

async function renderQr(
  canvas: HTMLCanvasElement,
  size: number,
  data: string,
  logo: HTMLImageElement,
) {
  await QRCode.toCanvas(canvas, data, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Zone logo ~22% de la largeur (safe avec H ~30%)
  const logoBox = Math.round(size * 0.22);
  const pad = Math.round(size * 0.015);
  const bx = Math.round((size - logoBox) / 2);
  const by = Math.round((size - logoBox) / 2);
  // Fond blanc derrière le logo pour lisibilité du scan
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx - pad, by - pad, logoBox + pad * 2, logoBox + pad * 2);
  // Dessine le logo en préservant le ratio
  const ratio = logo.width / logo.height;
  let lw = logoBox;
  let lh = logoBox;
  if (ratio > 1) lh = Math.round(logoBox / ratio);
  else lw = Math.round(logoBox * ratio);
  const lx = Math.round((size - lw) / 2);
  const ly = Math.round((size - lh) / 2);
  ctx.drawImage(logo, lx, ly, lw, lh);
}

function QrGeneratorPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const generate = useCallback(async () => {
    if (!previewRef.current || !printRef.current) return;
    setBusy(true);
    try {
      if (!logoRef.current) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = logoSrc;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("logo load"));
        });
        logoRef.current = img;
      }
      const data = buildVCard(form);
      await renderQr(previewRef.current, PREVIEW_SIZE_PX, data, logoRef.current);
      await renderQr(printRef.current, PRINT_SIZE_PX, data, logoRef.current);
    } finally {
      setBusy(false);
    }
  }, [form]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function download() {
    if (!printRef.current) return;
    printRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${form.name.toLowerCase().replace(/\s+/g, "-")}-tcb.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg,#0a0a0a 0%,#111827 100%)",
        color: "#fff",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#E8C96D",
            margin: 0,
          }}
        >
          Outil interne
        </p>
        <h1
          style={{
            fontFamily: "'Syne','Playfair Display',serif",
            fontSize: 32,
            margin: "6px 0 24px",
          }}
        >
          Générateur QR — Taxi City Bordeaux
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Formulaire */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {(
              [
                ["name", "Nom affiché"],
                ["org", "Organisation"],
                ["phone", "Téléphone"],
                ["email", "Email"],
                ["site", "Site web"],
              ] as [keyof Form, string][]
            ).map(([key, label]) => (
              <label
                key={key}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  {label}
                </span>
                <input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  style={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
              </label>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "Génération…" : "Régénérer"}
              </button>
              <button
                type="button"
                onClick={download}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg,#C9A84C,#E8C96D)",
                  color: "#000",
                  fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Télécharger PNG 300 dpi
              </button>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
                margin: "8px 0 0",
                lineHeight: 1.5,
              }}
            >
              Format calibré pour impression à la taille vignette CT (80×80 mm à
              300 dpi). Un scan ajoute directement le contact au téléphone
              (vCard). Seul le logo apparaît au centre — les infos sont
              encodées dans le QR.
            </p>
          </div>

          {/* Aperçu */}
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <canvas
              ref={previewRef}
              width={PREVIEW_SIZE_PX}
              height={PREVIEW_SIZE_PX}
              style={{
                width: "100%",
                maxWidth: PREVIEW_SIZE_PX,
                height: "auto",
                display: "block",
              }}
            />
            <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
              Aperçu — impression finale : 80×80 mm (taille vignette CT).
            </div>
            {/* Canvas d'export caché, haute résolution */}
            <canvas
              ref={printRef}
              width={PRINT_SIZE_PX}
              height={PRINT_SIZE_PX}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
