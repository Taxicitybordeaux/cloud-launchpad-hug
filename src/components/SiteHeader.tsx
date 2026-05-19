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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-4">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img
            src={logo}
            alt="Taxi City Bordeaux"
            width={40}
            height={40}
            decoding="async"
            className="h-10 w-auto rounded-md object-contain sm:h-12"
          />
          {/* Show brand name on mobile so users know where they are */}
          <span className="text-sm font-semibold leading-tight sm:hidden">
            Taxi City
            <br />
            Bordeaux
          </span>
          <span className="sr-only sm:not-sr-only sm:text-sm sm:font-semibold">Taxi City Bordeaux</span>
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

        {/* Mobile right side: phone shortcut + theme + burger */}
        <div className="flex items-center gap-1.5 md:hidden">
          {/* Quick-call button always visible on mobile — most important action */}
          <a
            href={`tel:${PHONE}`}
            aria-label="Appeler"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Phone className="h-4 w-4" />
          </a>
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col px-4 py-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                activeProps={{ className: "text-primary" }}
                onClick={() => setOpen(false)}
                className="border-b border-border/50 py-3.5 text-base font-medium text-foreground/85"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-4 mb-3 flex flex-col gap-2.5">
              <a
                href={`tel:${PHONE}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-base font-semibold"
              >
                <Phone className="h-5 w-5 text-primary" /> {PHONE_DISPLAY}
              </a>
              <Link
                to="/reservation"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-primary px-4 py-3 text-center text-base font-semibold text-primary-foreground"
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
