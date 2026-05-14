import type { CSSProperties } from "react";
import React from "react";

export const skeletonKeyframes = `@keyframes adminSkelShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`;

const baseSkel: CSSProperties = {
  display: "block",
  background: "linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 100%)",
  backgroundSize: "800px 100%",
  animation: "adminSkelShimmer 1.4s ease-in-out infinite",
  borderRadius: 8,
};

export function Skeleton({
  width = "100%",
  height = 14,
  radius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ ...baseSkel, width, height, borderRadius: radius ?? baseSkel.borderRadius, ...style }}
    />
  );
}

export function SkeletonStyles() {
  return <style>{skeletonKeyframes}</style>;
}

/* ─── Shared card style ─── */
const cardSkel: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 20,
};

/* ─── Stat card — matches 2-col mobile / 4-col desktop KPI grid ─── */
export function StatCardSkeleton() {
  return (
    <div style={cardSkel}>
      {/* icon circle */}
      <Skeleton width={32} height={32} radius="50%" />
      {/* value */}
      <div style={{ marginTop: 12 }}>
        <Skeleton width="55%" height={26} />
      </div>
      {/* label */}
      <div style={{ marginTop: 8 }}>
        <Skeleton width="70%" height={11} />
      </div>
    </div>
  );
}

/* ─── Table row — 6 or 7 cols ─── */
export function ReservationRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "10px 14px" }}>
          <Skeleton width={i === cols - 1 ? 60 : `${50 + ((i * 13) % 40)}%`} height={12} />
        </td>
      ))}
    </tr>
  );
}

/* ─── Course card — mobile list: matches exact card layout in admin/courses ─── */
export function CourseCardSkeleton() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
      }}
    >
      {/* Header row: name + date */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <Skeleton width={160} height={18} />
        <Skeleton width={100} height={13} />
      </div>
      {/* Trajet */}
      <Skeleton width="82%" height={13} style={{ marginBottom: 10 }} />
      {/* Info chips row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <Skeleton width={60} height={12} />
        <Skeleton width={70} height={12} />
        <Skeleton width={45} height={12} />
        <Skeleton width={50} height={12} />
      </div>
      {/* Contact row */}
      <div style={{ display: "flex", gap: 16 }}>
        <Skeleton width={110} height={13} />
        <Skeleton width={130} height={13} />
      </div>
      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <Skeleton width="50%" height={44} radius={12} />
        <Skeleton width="50%" height={44} radius={12} />
      </div>
    </div>
  );
}

/* ─── Client row — matches card layout in admin/clients ─── */
export function ClientRowSkeleton() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 20,
      }}
    >
      {/* Avatar + name/phone */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <Skeleton width={44} height={44} radius="50%" />
        <div style={{ flex: 1, display: "grid", gap: 6 }}>
          <Skeleton width="45%" height={15} />
          <Skeleton width="30%" height={11} />
        </div>
      </div>
      {/* Email */}
      <Skeleton width="60%" height={11} style={{ marginBottom: 10 }} />
      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <Skeleton width={50} height={13} />
        <Skeleton width={70} height={13} />
      </div>
      {/* Button */}
      <Skeleton width="100%" height={36} radius={10} />
    </div>
  );
}

/* ─── Generic primitives ─── */
export function ButtonSkeleton({ width = 140, height = 38 }: { width?: number | string; height?: number }) {
  return <Skeleton width={width} height={height} radius={10} />;
}

export function LineSkeleton({ width = "100%", height = 12 }: { width?: number | string; height?: number }) {
  return <Skeleton width={width} height={height} />;
}

export function LinesSkeleton({ count = 3, gap = 8 }: { count?: number; gap?: number }) {
  return (
    <div style={{ display: "grid", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={`${95 - i * 12}%`} height={12} />
      ))}
    </div>
  );
}

export function CardSkeleton({
  lines = 3,
  withTitle = true,
  withActions = false,
}: {
  lines?: number;
  withTitle?: boolean;
  withActions?: boolean;
}) {
  return (
    <div style={cardSkel}>
      {withTitle && (
        <div style={{ marginBottom: 12 }}>
          <Skeleton width="45%" height={16} />
        </div>
      )}
      <LinesSkeleton count={lines} />
      {withActions && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <ButtonSkeleton width={110} />
          <ButtonSkeleton width={110} />
        </div>
      )}
    </div>
  );
}

/* ─── GPS page card — matches exact GPS inactive layout ─── */
export function GpsCardSkeleton() {
  return (
    <div
      style={{
        maxWidth: 540,
        margin: "0 auto",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: "24px 20px",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {/* Icon */}
      <Skeleton width={52} height={52} radius="50%" style={{ margin: "0 auto" }} />
      {/* Title */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
        <Skeleton width={220} height={20} />
      </div>
      {/* Subtitle */}
      <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
        <Skeleton width={180} height={12} />
      </div>
      {/* Inputs */}
      <div style={{ marginTop: 24, display: "grid", gap: 10, textAlign: "left" }}>
        <Skeleton height={44} radius={12} />
        <Skeleton height={44} radius={12} />
        {/* Quick calc box */}
        <Skeleton height={72} radius={12} />
      </div>
      {/* Button */}
      <div style={{ marginTop: 20 }}>
        <Skeleton height={56} radius={14} />
      </div>
    </div>
  );
}

/* ─── Map skeleton (GPS acquisition) ─── */
export function MapSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gridTemplateRows: "repeat(4,1fr)",
          gap: 1,
          opacity: 0.25,
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{ ...baseSkel, borderRadius: 0, animationDelay: `${(i * 0.07).toFixed(2)}s` }} />
        ))}
      </div>
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontSize: 36, animation: "adminSkelShimmer 1.4s ease-in-out infinite" }}>📡</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#64748b", marginTop: 8 }}>
          Acquisition de la position…
        </div>
      </div>
    </div>
  );
}

/* ─── GPS updates list skeleton ─── */
export function GpsUpdatesSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Skeleton width={10} height={10} radius="50%" />
          <Skeleton width={`${60 + ((i * 11) % 30)}%`} height={11} />
          <Skeleton width={40} height={11} />
        </div>
      ))}
    </div>
  );
}

/* ─── Global loading overlay ─── */
export function GlobalLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10,15,30,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <style>{skeletonKeyframes}</style>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "4px solid rgba(14,165,233,0.2)",
          borderTop: "4px solid #0ea5e9",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#94a3b8" }}>Chargement…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
