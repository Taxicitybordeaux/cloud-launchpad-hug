import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Text size of each list item. Maps to a Tailwind text utility. */
export type BulletedListSize = "xs" | "sm" | "base" | "lg";
/** Vertical rhythm between items. */
export type BulletedListDensity = "tight" | "normal" | "relaxed";
/** Color of the decorative dot. Mapped to design tokens, never raw colors. */
export type BulletedListTone =
  | "primary"
  | "accent"
  | "muted"
  | "foreground"
  | "destructive"
  | "success";

type BulletedListProps = {
  items: readonly string[];
  className?: string;
  itemClassName?: string;
  /** Preset text size (default: "sm"). */
  size?: BulletedListSize;
  /** Vertical spacing between items (default: "normal"). */
  density?: BulletedListDensity;
  /** Dot color, picked from semantic design tokens (default: "primary"). */
  tone?: BulletedListTone;
  /** Accessible label describing the list contents (e.g. "Services inclus"). */
  ariaLabel?: string;
  /** ID of an element that labels the list. Use instead of ariaLabel when a visible heading exists. */
  ariaLabelledBy?: string;
};

const SIZE_CLASS: Record<BulletedListSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

const DENSITY_CLASS: Record<BulletedListDensity, string> = {
  tight: "space-y-1",
  normal: "space-y-2",
  relaxed: "space-y-3",
};

// Dot size scales subtly with text size to keep optical balance.
const DOT_SIZE_CLASS: Record<BulletedListSize, string> = {
  xs: "mt-1 h-1 w-1",
  sm: "mt-1.5 h-1.5 w-1.5",
  base: "mt-2 h-2 w-2",
  lg: "mt-2.5 h-2 w-2",
};

// Map tones to semantic tokens declared in src/styles.css.
const TONE_CLASS: Record<BulletedListTone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  muted: "bg-muted-foreground",
  foreground: "bg-foreground",
  destructive: "bg-destructive",
  success: "bg-emerald-500", // fallback if no semantic success token is defined
};

/**
 * Consistent bulleted list used across the site.
 *
 * Variants:
 * - `size`: xs | sm | base | lg — text size of each item (dot scales with it).
 * - `density`: tight | normal | relaxed — vertical rhythm between items.
 * - `tone`: primary | accent | muted | foreground | destructive | success — dot color.
 *
 * Layout invariants:
 * - Dot stays aligned with the first line (`shrink-0` + size-aware top offset).
 * - Long text wraps cleanly (`min-w-0 break-words [hyphens:auto]`).
 *
 * Accessibility:
 * - Uses native semantic <ul>/<li> so screen readers announce list size and position.
 * - Decorative bullet dot is hidden via `aria-hidden`.
 * - Pass `ariaLabel` (or `ariaLabelledBy`) to give the list a meaningful name.
 * - The list itself is non-interactive: keyboard users skip it like any prose
 *   block. If a list item needs to be actionable, wrap its text in a real
 *   <a>/<button> at the call site so default focus order and Enter/Space work.
 */
export function BulletedList({
  items,
  className,
  itemClassName,
  size = "sm",
  density = "normal",
  tone = "primary",
  ariaLabel,
  ariaLabelledBy,
}: BulletedListProps) {
  return (
    <ul
      className={cn(DENSITY_CLASS[density], SIZE_CLASS[size], className)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {items.map((item) => (
        <li
          key={item}
          className={cn("flex items-start gap-2 text-foreground/80", itemClassName)}
        >
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 rounded-full",
              DOT_SIZE_CLASS[size],
              TONE_CLASS[tone],
            )}
          />
          <span className="min-w-0 flex-1 break-words leading-snug [hyphens:auto]">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
