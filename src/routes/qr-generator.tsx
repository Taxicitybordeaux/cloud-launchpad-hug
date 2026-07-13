import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { jsPDF } from "jspdf";
import logoSrc from "@/assets/tcb-logo-badge.png";

export const Route = createFileRoute("/qr-generator")({
  head: () => ({
    meta: [
      { title: "Générateur QR — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrGeneratorPage,
});

// Vignette CT = 55 mm (format Allo Bordeaux Taxi). À 300 dpi → 650 px. On rend 1200 px pour marge.
const MM_PER_INCH = 25.4;
const DPI = 300;
const VIGNETTE_MM = 55;
const VIGNETTE_PX = Math.round((VIGNETTE_MM / MM_PER_INCH) * DPI); // 650
const PRINT_SIZE_PX = 1200; // QR haute résolution (upscaled)
const PREVIEW_SIZE_PX = 480;




// A4 portrait @ 300 dpi = 2480 x 3508
const A4_W = 2480;
const A4_H = 3508;

type Mode = "url" | "vcard";

type Form = {
  mode: Mode;
  url: string;
  name: string;
  phone: string;
  email: string;
  site: string;
  org: string;
};

const DEFAULTS: Form = {
  mode: "url",
  url: "https://taxicitybordeaux.fr/carte",
  name: "Josè",
  phone: "0673072322",
  email: "taxi.city033@gmail.com",
  site: "https://taxicitybordeaux.fr",
  org: "Taxi City Bordeaux",
};

function buildPayload(f: Form): string {
  if (f.mode === "url") return f.url.trim();
  return buildVCard(f);
}

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

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Nom requis";
  const phoneDigits = f.phone.replace(/[^\d+]/g, "");
  if (!phoneDigits) e.phone = "Téléphone requis";
  else if (!/^\+?\d{9,15}$/.test(phoneDigits))
    e.phone = "Numéro invalide (9 à 15 chiffres)";
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()))
    e.email = "Email invalide";
  if (f.site) {
    try {
      const u = new URL(f.site.trim());
      if (!/^https?:$/.test(u.protocol)) e.site = "URL doit commencer par https://";
    } catch {
      e.site = "URL invalide (https://…)";
    }
  }
  return e;
}

async function renderQr(
  canvas: HTMLCanvasElement,
  size: number,
  data: string,
  logo: HTMLImageElement,
  logoPct: number, // 0.20 à 0.70
) {
  await QRCode.toCanvas(canvas, data, {
    width: size,
    margin: 0,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const ratio = logo.width / logo.height;

  const logoBox = Math.round(size * logoPct);
  let lw = logoBox;
  let lh = logoBox;
  if (ratio > 1) lh = Math.round(logoBox / ratio);
  else lw = Math.round(logoBox * ratio);

  // Plaque blanche arrondie derrière le logo — technique pro :
  // isole le logo des modules noirs et garantit la lisibilité des inscriptions.
  const pad = Math.round(size * 0.018);
  const pw = lw + pad * 2;
  const ph = lh + pad * 2;
  const px = Math.round((size - pw) / 2);
  const py = Math.round((size - ph) / 2);
  const radius = Math.round(Math.min(pw, ph) * 0.08);

  ctx.save();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, px, py, pw, ph, radius);
  ctx.fill();
  ctx.strokeStyle = "#C9A84C";
  ctx.lineWidth = Math.max(1, Math.round(size * 0.003));
  roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, radius);
  ctx.stroke();
  ctx.restore();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const lx = Math.round((size - lw) / 2);
  const ly = Math.round((size - lh) / 2);
  ctx.drawImage(logo, lx, ly, lw, lh);

}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function QrGeneratorPage() {
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [logoPct, setLogoPct] = useState(0.5);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);

  const generate = useCallback(async (logoPctOverride = logoPct) => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
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
      const data = buildPayload(form);
      await renderQr(previewRef.current, PREVIEW_SIZE_PX, data, logoRef.current, logoPctOverride);
      await renderQr(printRef.current, PRINT_SIZE_PX, data, logoRef.current, logoPctOverride);
    } finally {
      setBusy(false);
    }
  }, [form, logoPct]);

  const [maxInfo, setMaxInfo] = useState<string | null>(null);

  const maximize = useCallback(async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    setMaxInfo("Recherche en cours…");
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
      const data = buildPayload(form);
      const testSize = 600;
      const test = document.createElement("canvas");
      test.width = testSize;
      test.height = testSize;
      const ctx = test.getContext("2d");
      if (!ctx) return;
      // Test décroissant de 70% à 20% par pas de 1% — 3 lectures OK requises
      let best: number | null = null;
      for (let pctInt = 70; pctInt >= 20; pctInt--) {
        const pct = pctInt / 100;
        let ok = 0;
        for (let attempt = 0; attempt < 3; attempt++) {
          await renderQr(test, testSize, data, logoRef.current, pct);
          const img = ctx.getImageData(0, 0, testSize, testSize);
          const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (res && res.data === data) ok++;
          else break;
        }
        if (ok === 3) {
          best = pct;
          break;
        }
      }
      if (best === null) {
        setMaxInfo("Aucune taille sûre trouvée — logo réduit à 20%.");
        setLogoPct(0.2);
        await generate(0.2);
      } else {
        setMaxInfo(`Taille max scannable : ${Math.round(best * 100)}%`);
        setLogoPct(best);
        await generate(best);
      }
    } finally {
      setBusy(false);
    }
  }, [form, generate]);

  useEffect(() => {
    // Au chargement : cherche automatiquement la taille max de logo scannable
    maximize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function download55mm() {
    // PNG carré 55x55mm à 300 dpi — taille physique exacte de la vignette CT.
    if (!printRef.current) return;
    const out = document.createElement("canvas");
    out.width = VIGNETTE_PX;
    out.height = VIGNETTE_PX;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, VIGNETTE_PX, VIGNETTE_PX);
    ctx.drawImage(printRef.current, 0, 0, VIGNETTE_PX, VIGNETTE_PX);
    out.toBlob((b) => b && triggerDownload(b, `qr-${slug(form.name)}-55mm-300dpi.png`), "image/png");
  }

  function downloadA4() {
    // PDF au format physique exact 55×55 mm — identique à Allo Taxi Bordeaux.
    // Pas de page A4, pas de marge : la page PDF fait 55×55 mm et le QR remplit
    // toute la page pour une impression 1:1 sans risque de mise à l'échelle.
    if (!printRef.current) return;
    const dataUrl = printRef.current.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [55, 55],
      compress: true,
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, 55, 55, undefined, "FAST");
    pdf.save(`qr-${slug(form.name)}-55x55mm.pdf`);
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
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#E8C96D", margin: 0 }}>
          Outil interne
        </p>
        <h1 style={{ fontFamily: "'Syne','Playfair Display',serif", fontSize: 32, margin: "6px 0 24px" }}>
          Générateur QR — Taxi City Bordeaux
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
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
            {/* Mode */}
            <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 10 }}>
              {(["url", "vcard"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode: m }))}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: form.mode === m ? "#E8C96D" : "transparent",
                    color: form.mode === m ? "#000" : "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {m === "url" ? "Page cliquable (recommandé)" : "vCard (ajout contact)"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              {form.mode === "url"
                ? "Le QR pointe vers /carte : boutons Appeler, WhatsApp, SMS, Email, Réserver, Ajouter contact — tout est cliquable."
                : "Le QR contient une vCard : le téléphone propose « Ajouter aux contacts »."}
            </div>

            {form.mode === "url" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>URL de la page cliquable</span>
                <input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
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
            )}

            {form.mode === "vcard" && (
              <>
            {(
              [
                ["name", "Nom affiché"],
                ["org", "Organisation"],
                ["phone", "Téléphone"],
                ["email", "Email"],
                ["site", "Site web"],
              ] as [keyof Form, string][]
            ).map(([key, label]) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{label}</span>
                <input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  style={{
                    background: "#0f172a",
                    border: `1px solid ${errors[key] ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 14,
                  }}
                />
                {errors[key] && (
                  <span style={{ fontSize: 12, color: "#fca5a5" }}>{errors[key]}</span>
                )}
              </label>
            ))}
              </>
            )}

            {/* Réglages logo */}
            <div style={{ marginTop: 8, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
                Logo au centre (les infos restent dans la vCard)
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12 }}>Taille du logo — {Math.round(logoPct * 100)}%</span>
                <input
                  type="range"
                  min={20}
                  max={70}
                  value={Math.round(logoPct * 100)}
                  onChange={(e) => setLogoPct(Number(e.target.value) / 100)}
                />
              </label>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
                Conseil : la correction d'erreur H tolère jusqu'à ~30 % du QR masqué. Au-delà de 40 %, teste bien le scan.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => generate()}
                disabled={busy || !isValid}
                style={btnGhost(busy || !isValid)}
              >
                {busy ? "Génération…" : "Régénérer"}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Optimisation auto : cible une couverture lisible mais bien
                  // en dessous du seuil de la correction H (~30% masquable).
                  const payloadLen = buildPayload(form).length;
                  const pct = payloadLen < 180 ? 0.46 : payloadLen < 260 ? 0.42 : 0.36;
                  setLogoPct(pct);
                  setMaxInfo(null);
                  generate(pct);
                }}
                disabled={busy || !isValid}
                style={btnGhost(busy || !isValid)}
                title="Ajuste la taille du logo pour rester lisible tout en gardant un scan fiable"
              >
                Optimiser le logo
              </button>
              <button
                type="button"
                onClick={maximize}
                disabled={busy || !isValid}
                style={btnGhost(busy || !isValid)}
                title="Cherche la plus grande taille de logo qui reste scannable et l'applique"
              >
                Max lisible
              </button>
            </div>
            {maxInfo && (
              <div style={{ fontSize: 12, color: "#E8C96D", marginTop: 4 }}>{maxInfo}</div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={download55mm}
                disabled={busy || !isValid}
                style={btnGold(busy || !isValid)}
              >
                PNG 55×55 mm
              </button>
              <button
                type="button"
                onClick={downloadA4}
                disabled={busy || !isValid}
                style={btnGold(busy || !isValid)}
              >
                PDF 55×55 mm
              </button>
            </div>

            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "8px 0 0", lineHeight: 1.5 }}>
              <b>Impression :</b> le QR sort physiquement à <b>55×55 mm</b> (format vignette Allo Bordeaux Taxi),
              centré sur la feuille A4 avec repères de coupe. Imprime <b>à 100% (Taille réelle)</b> —
              surtout pas « Ajuster à la page » — puis découpe.
            </p>
          </div>

          {/* Aperçu avec gabarit 55×55 mm */}
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
            <div
              style={{
                position: "relative",
                width: PREVIEW_SIZE_PX,
                maxWidth: "100%",
                aspectRatio: "1 / 1",
              }}
            >
              {/* Gabarit de coupe */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  border: "2px dashed #C9A84C",
                  borderRadius: 4,
                  pointerEvents: "none",
                }}
              />
              <canvas
                ref={previewRef}
                width={PREVIEW_SIZE_PX}
                height={PREVIEW_SIZE_PX}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: "50%",
                  transform: "translate(-50%,-100%)",
                  fontSize: 11,
                  color: "#C9A84C",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                }}
              >
                55 mm
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  right: -10,
                  transform: "translate(100%,-50%)",
                  fontSize: 11,
                  color: "#C9A84C",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                }}
              >
                55 mm
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
              Aperçu à l'échelle — gabarit de coupe 55 × 55 mm (vignette CT).
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

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "qr";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function btnGhost(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#fff",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
function btnGold(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg,#C9A84C,#E8C96D)",
    color: "#000",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
