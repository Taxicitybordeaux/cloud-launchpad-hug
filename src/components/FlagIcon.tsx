import type { ReactNode } from "react";

const FLAGS: Record<string, ReactNode> = {
  fr: (
    <svg viewBox="0 0 36 24" className="h-4 w-6 rounded-sm" aria-hidden="true">
      <rect x="0" y="0" width="12" height="24" fill="#0055A4" />
      <rect x="12" y="0" width="12" height="24" fill="#FFFFFF" />
      <rect x="24" y="0" width="12" height="24" fill="#EF4135" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 36 24" className="h-4 w-6 rounded-sm" aria-hidden="true">
      <rect x="0" y="0" width="36" height="24" fill="#012169" />
      <path d="M0 0L36 24M36 0L0 24" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M18 0v24M0 12h36" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0 0L36 24M36 0L0 24" stroke="#C8102E" strokeWidth="2" />
      <path d="M18 0v24M0 12h36" stroke="#C8102E" strokeWidth="3" />
    </svg>
  ),
  es: (
    <svg viewBox="0 0 36 24" className="h-4 w-6 rounded-sm" aria-hidden="true">
      <rect x="0" y="0" width="36" height="6" fill="#AA151B" />
      <rect x="0" y="6" width="36" height="12" fill="#F1BF00" />
      <rect x="0" y="18" width="36" height="6" fill="#AA151B" />
    </svg>
  ),
  pt: (
    <svg viewBox="0 0 36 24" className="h-4 w-6 rounded-sm" aria-hidden="true">
      <rect x="0" y="0" width="14" height="24" fill="#006600" />
      <rect x="14" y="0" width="22" height="24" fill="#FF0000" />
      <circle cx="14" cy="12" r="4" fill="#FFFF00" />
    </svg>
  ),
  it: (
    <svg viewBox="0 0 36 24" className="h-4 w-6 rounded-sm" aria-hidden="true">
      <rect x="0" y="0" width="12" height="24" fill="#009246" />
      <rect x="12" y="0" width="12" height="24" fill="#FFFFFF" />
      <rect x="24" y="0" width="12" height="24" fill="#CE2B37" />
    </svg>
  ),
  ar: (
    <svg viewBox="0 0 36 24" className="h-4 w-6 rounded-sm" aria-hidden="true">
      <rect x="0" y="0" width="36" height="24" fill="#006C35" />
      <text x="18" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontFamily="serif">لا إله إلا الله</text>
    </svg>
  ),
};

export function FlagIcon({ code }: { code: string }) {
  return FLAGS[code] ?? null;
}
