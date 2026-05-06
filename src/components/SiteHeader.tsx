import { Link } from "@tanstack/react-router";
import { Phone, Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.jpeg";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useT } from "@/i18n/I18nProvider";

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

export function SiteHeader() {
  const t = useT();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/services", label: t("nav.services") },
    { to: "/a-propos", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <img src={logo} alt="Taxi City Bordeaux" className="h-12 w-auto rounded-md object-contain" />
          <span className="sr-only">Taxi City Bordeaux</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              activeProps={{ className: "text-primary" }}
              className="text-sm font-medium text-foreground/80 transition hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          <a
            href={`tel:${PHONE}`}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:border-primary"
          >
            <Phone className="h-4 w-4 text-primary" /> {PHONE_DISPLAY}
          </a>
          <Link
            to="/reservation"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90"
          >
            {t("nav.book")}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                activeProps={{ className: "text-primary" }}
                onClick={() => setOpen(false)}
                className="border-b border-border/50 py-3 text-sm font-medium text-foreground/85"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={`tel:${PHONE}`}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-semibold"
              >
                <Phone className="h-4 w-4 text-primary" /> {PHONE_DISPLAY}
              </a>
              <Link
                to="/reservation"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                {t("nav.book_long")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
