/**
 * BrandLoader — animation de marque Taxi City (anneau gold rotatif + initiale).
 * Utilisé partout dans l'espace client à la place de Loader2.
 */
export function BrandLoader({
  size = 32,
  label = "Chargement",
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}) {
  const stroke = Math.max(2, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const inner = (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ animation: "tc-spin 1.1s linear infinite" }}
      >
        <defs>
          <linearGradient id={`tc-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#E8C96D" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(201,168,76,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#tc-grad-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.28} ${c}`}
        />
      </svg>
      <span
        aria-hidden
        className="absolute font-bold"
        style={{
          fontFamily: "'Syne', 'Playfair Display', serif",
          fontSize: size * 0.42,
          background: "linear-gradient(135deg,#C9A84C 0%,#E8C96D 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          lineHeight: 1,
        }}
      >
        T
      </span>
      <style>{`@keyframes tc-spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );

  if (!fullscreen) return inner;

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      style={{ background: "transparent" }}
    >
      {inner}
      <p
        className="text-xs uppercase tracking-[0.25em]"
        style={{ color: "rgba(232,201,109,0.7)" }}
      >
        {label}
      </p>
    </div>
  );
}
