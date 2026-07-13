import { Link, useLocation } from "@tanstack/react-router";
import { Phone, Menu, X, UserCircle2 } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/tcb-logo-badge.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useT } from "@/i18n/I18nProvider";

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

export function SiteHeader() {
  const t = useT();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (location.pathname === "/driver") return null;

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/services", label: t("nav.services") },
    { to: "/a-propos", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-20 sm:px-4 md:flex md:justify-between">
        <Link
          to="/"
          className="site-header-logo flex min-w-0 shrink-0 items-center overflow-hidden"
          onClick={() => setOpen(false)}
          aria-label="Taxi City Bordeaux"
        >
          <img
            src={logo}
            alt="Taxi City Bordeaux"
            width={1200}
            height={896}
            decoding="async"
            loading="eager"
            fetchPriority="high"
            className="site-header-logo-img rounded-md"
          />
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
            to="/client/login"
            aria-label="Espace client"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:border-primary"
          >
            <UserCircle2 className="h-4 w-4 text-primary" /> {t("nav.account")}
          </Link>
          <Link
            to="/reservation"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90"
          >
            {t("nav.book")}
          </Link>
        </div>

        <div className="site-header-mobile-actions flex min-w-0 shrink-0 items-center gap-1.5 md:hidden">
          <a
            href={`tel:${PHONE}`}
            aria-label="Appeler"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Phone className="h-4 w-4" />
          </a>
          <ThemeToggle className="h-10 w-10 shrink-0" />
          <LanguageSwitcher className="site-header-language shrink-0" />
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border"
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
                to="/client/login"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-base font-semibold"
              >
                <UserCircle2 className="h-5 w-5 text-primary" /> {t("nav.account")}
              </Link>
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
