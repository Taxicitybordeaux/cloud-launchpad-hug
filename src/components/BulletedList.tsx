import { cn } from "@/lib/utils";

type BulletedListProps = {
  items: readonly string[];
  className?: string;
  itemClassName?: string;
  /** Tailwind text-size class for the items (default: text-sm) */
  size?: string;
};

/**
 * Consistent bulleted list used across the site.
 * - Dot stays aligned with the first line (`mt-1.5 shrink-0`)
 * - Long text wraps cleanly (`min-w-0 break-words [hyphens:auto]`)
 * - Even vertical rhythm (`space-y-2`)
 */
export function BulletedList({
  items,
  className,
  itemClassName,
  size = "text-sm",
}: BulletedListProps) {
  return (
    <ul className={cn("space-y-2", size, className)}>
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
