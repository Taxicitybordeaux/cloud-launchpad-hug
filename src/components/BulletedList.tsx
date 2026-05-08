import { cn } from "@/lib/utils";

type BulletedListProps = {
  items: readonly string[];
  className?: string;
  itemClassName?: string;
  /** Tailwind text-size class for the items (default: text-sm) */
  size?: string;
  /** Accessible label describing the list contents (e.g. "Services inclus"). */
  ariaLabel?: string;
  /** ID of an element that labels the list. Use instead of ariaLabel when a visible heading exists. */
  ariaLabelledBy?: string;
};

/**
 * Consistent bulleted list used across the site.
 * - Dot stays aligned with the first line (`mt-1.5 shrink-0`)
 * - Long text wraps cleanly (`min-w-0 break-words [hyphens:auto]`)
 * - Even vertical rhythm (`space-y-2`)
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
  size = "text-sm",
  ariaLabel,
  ariaLabelledBy,
}: BulletedListProps) {
  return (
    <ul
      className={cn("space-y-2", size, className)}
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
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
          />
          <span className="min-w-0 flex-1 break-words leading-snug [hyphens:auto]">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
