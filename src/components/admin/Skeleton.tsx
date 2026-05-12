import type { CSSProperties } from "react";

export const skeletonKeyframes = `@keyframes adminSkelShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`;

const baseSkel: CSSProperties = {
  display: "block",
  background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)",
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

const cardSkel: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 24,
};

export function StatCardSkeleton() {
  return (
    <div style={cardSkel}>
      <Skeleton width={32} height={32} radius="50%" />
      <div style={{ marginTop: 12 }}><Skeleton width="60%" height={28} /></div>
      <div style={{ marginTop: 10 }}><Skeleton width="40%" height={11} /></div>
    </div>
  );
}

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

export function CourseCardSkeleton() {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Skeleton width={140} height={16} />
        <Skeleton width={90} height={24} radius={99} />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <Skeleton width="80%" height={12} />
        <Skeleton width="65%" height={12} />
        <Skeleton width="50%" height={12} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Skeleton width={110} height={36} radius={10} />
        <Skeleton width={110} height={36} radius={10} />
      </div>
    </div>
  );
}

export function ClientRowSkeleton() {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
      <Skeleton width={44} height={44} radius="50%" />
      <div style={{ flex: 1, display: "grid", gap: 8 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="65%" height={11} />
      </div>
      <Skeleton width={70} height={28} radius={10} />
    </div>
  );
}

export function GpsCardSkeleton() {
  return (
    <div style={{ maxWidth: 540, margin: "0 auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 32, textAlign: "center" }}>
      <Skeleton width={80} height={80} radius="50%" style={{ margin: "0 auto" }} />
      <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}><Skeleton width={220} height={20} /></div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}><Skeleton width={160} height={12} /></div>
      <div style={{ marginTop: 24, display: "grid", gap: 10 }}>
        <Skeleton height={44} radius={12} />
        <Skeleton height={44} radius={12} />
        <Skeleton height={64} radius={12} />
      </div>
      <div style={{ marginTop: 20 }}><Skeleton height={56} radius={14} /></div>
    </div>
  );
}
