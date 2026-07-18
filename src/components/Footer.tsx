import { Link } from "@tanstack/react-router";
import { Phone, MessageCircle, MapPin, Clock, ShieldCheck } from "lucide-react";
import logo from "@/assets/tcb-logo-badge.png";
import { useT } from "@/i18n/I18nProvider";

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";
const WHATSAPP = `https://wa.me/33${PHONE.replace(/^0/, "")}`;

export function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  const navLinks = [
    { to: "/" as const, hash: undefined, label: t("nav.home") },
    { to: "/reservation" as const, hash: undefined, label: t("nav.book_long") },
    { to: "/" as const, hash: "faq", label: t("footer.link.faq") },
  ];

  const serviceLinks = [
    { to: "/taxi-aeroport-bordeaux-merignac" as const, label: t("footer.link.airport") },
    { to: "/taxi-gare-saint-jean-bordeaux" as const, label: t("footer.link.station") },
    { to: "/taxi-bordeaux-arcachon" as const, label: t("footer.link.arcachon") },
    { to: "/taxi-conventionne-bordeaux" as const, label: t("footer.link.cpam") },
  ];

  const legalLinks = [
    { to: "/mentions-legales" as const, label: t("footer.link.legal") },
    { to: "/confidentialite" as const, label: t("footer.link.privacy") },
  ];

  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 md:py-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-8">
          {/* BRAND */}
          <div>
            <Link
              to="/"
              className="inline-flex touch-manipulation items-center gap-2.5 [-webkit-tap-highlight-color:transparent]"
            >
              <img src={logo} alt="Taxi City Bordeaux" className="h-10 w-10 rounded-full object-cover" />
              <span className="font-display text-lg font-bold">Taxi City Bordeaux</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>

            <div className="mt-5 space-y-2.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-primary" /> {t("footer.availability")}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" /> {t("footer.coverage")}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> {t("footer.cpam")}
              </span>
            </div>
          </div>

          {/* NAVIGATION */}
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
              {t("footer.nav_title")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {navLinks.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    hash={l.hash}
                    className="touch-manipulation text-sm text-muted-foreground transition [-webkit-tap-highlight-color:transparent] hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SERVICES */}
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
              {t("footer.services_title")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {serviceLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="touch-manipulation text-sm text-muted-foreground transition [-webkit-tap-highlight-color:transparent] hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
              {t("footer.contact_title")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={`tel:${PHONE}`}
                  className="inline-flex touch-manipulation items-center gap-2 text-sm text-muted-foreground transition [-webkit-tap-highlight-color:transparent] hover:text-primary"
                >
                  <Phone className="h-4 w-4 shrink-0 text-primary" /> {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex touch-manipulation items-center gap-2 text-sm text-muted-foreground transition [-webkit-tap-highlight-color:transparent] hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-primary" /> WhatsApp
                </a>
              </li>
            </ul>
            <Link
              to="/reservation"
              className="mt-5 inline-flex touch-manipulation items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] [-webkit-tap-highlight-color:transparent] active:scale-95"
            >
              {t("nav.book")}
            </Link>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:mt-12 sm:flex-row sm:justify-between sm:text-left sm:pt-8">
          <p>
            © {year} Taxi City Bordeaux — {t("footer.rights")}
          </p>
          <div className="flex items-center gap-4">
            {legalLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="touch-manipulation transition [-webkit-tap-highlight-color:transparent] hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p>{t("footer.siret")}</p>
        </div>
      </div>
    </footer>
  );
}
