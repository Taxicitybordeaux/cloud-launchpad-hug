import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
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

// Vignette CT = 80 mm. À 300 dpi → 945 px. On rend 1200 px pour marge.
const MM_PER_INCH = 25.4;
const DPI = 300;
const VIGNETTE_MM = 80;
const VIGNETTE_PX = Math.round((VIGNETTE_MM / MM_PER_INCH) * DPI); // 945
const PRINT_SIZE_PX = 1200; // QR haute résolution (upscaled)
const PREVIEW_SIZE_PX = 480;

const LOGO_CROP = {
  x: 135,
  y: 110,
  width: 242,
  height: 190,
};

// A4 portrait @ 300 dpi = 2480 x 3508
const A4_W = 2480;
const A4_H = 3508;

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
  const logoBox = Math.round(size * logoPct);
  const crop = {
    x: Math.round(logo.width * (LOGO_CROP.x / 512)),
    y: Math.round(logo.height * (LOGO_CROP.y / 343)),
    width: Math.round(logo.width * (LOGO_CROP.width / 512)),
    height: Math.round(logo.height * (LOGO_CROP.height / 343)),
  };
  const ratio = crop.width / crop.height;
  let lw = logoBox;
  let lh = logoBox;
  if (ratio > 1) lh = Math.round(logoBox / ratio);
  else lw = Math.round(logoBox * ratio);
  const lx = Math.round((size - lw) / 2);
  const ly = Math.round((size - lh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, crop.x, crop.y, crop.width, crop.height, lx, ly, lw, lh);
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
      const data = buildVCard(form);
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
      const data = buildVCard(form);
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


  function download80mm() {
    // PNG carré 80x80mm à 300 dpi — pour utilisateurs qui savent choisir la taille
    if (!printRef.current) return;
    const out = document.createElement("canvas");
    out.width = VIGNETTE_PX;
    out.height = VIGNETTE_PX;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, VIGNETTE_PX, VIGNETTE_PX);
    ctx.drawImage(printRef.current, 0, 0, VIGNETTE_PX, VIGNETTE_PX);
    out.toBlob((b) => b && triggerDownload(b, `qr-${slug(form.name)}-80mm-300dpi.png`), "image/png");
  }

  function downloadA4() {
    // Impression téléphone : "pleine page" => on prépare un A4 avec QR
    // physiquement à 80x80mm et repères de coupe. Résultat : imprimé plein
    // format A4, la vignette sort à la bonne taille.
    if (!printRef.current) return;
    const out = document.createElement("canvas");
    out.width = A4_W;
    out.height = A4_H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, A4_W, A4_H);
    const qrSize = VIGNETTE_PX; // 80mm
    const x = Math.round((A4_W - qrSize) / 2);
    const y = Math.round(A4_H * 0.18);
    ctx.drawImage(printRef.current, x, y, qrSize, qrSize);
    // Repères de coupe
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    const m = 40;
    const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * m, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + dy * m);
      ctx.stroke();
    };
    drawCorner(x, y, -1, -1);
    drawCorner(x + qrSize, y, 1, -1);
    drawCorner(x, y + qrSize, -1, 1);
    drawCorner(x + qrSize, y + qrSize, 1, 1);
    // Étiquettes
    ctx.fillStyle = "#333";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Imprimer en A4 pleine page — QR final : 80 × 80 mm (vignette CT)", A4_W / 2, y + qrSize + 90);
    ctx.font = "22px sans-serif";
    ctx.fillText("Découper le long des repères", A4_W / 2, y + qrSize + 130);
    out.toBlob((b) => b && triggerDownload(b, `qr-${slug(form.name)}-A4-pleine-page.png`), "image/png");
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
                  const payloadLen = buildVCard(form).length;
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
                onClick={download80mm}
                disabled={busy || !isValid}
                style={btnGold(busy || !isValid)}
              >
                PNG 80×80 mm
              </button>
              <button
                type="button"
                onClick={downloadA4}
                disabled={busy || !isValid}
                style={btnGold(busy || !isValid)}
              >
                PNG A4 pleine page
              </button>
            </div>

            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "8px 0 0", lineHeight: 1.5 }}>
              <b>Impression depuis le téléphone :</b> choisis <i>PNG A4 pleine page</i>. Le QR y est
              placé physiquement à 80×80 mm avec repères de coupe — imprimé en pleine page A4, il sort
              exactement à la taille d'une vignette CT. Il suffit de découper.
            </p>
          </div>

          {/* Aperçu avec gabarit 80×80 mm */}
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
                80 mm
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
                80 mm
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
              Aperçu à l'échelle — gabarit de coupe 80 × 80 mm (vignette CT).
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
