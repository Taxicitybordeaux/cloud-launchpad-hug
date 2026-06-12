import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, Link } from "@tanstack/react-router";
import { MessageCircle, Phone, FileText } from "lucide-react";
import { useReservationDraft } from "@/lib/reservation-draft";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";
import { useI18n } from "@/i18n/I18nProvider";
import { trackCtaClick } from "@/lib/analytics";

const PHONE = "0673072322";

export function WhatsAppFloat() {
  const { t, lang } = useI18n();
  const location = useLocation();

  // ── Monter uniquement côté client pour éviter l'erreur d'hydratation ──
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isHiddenPage =
    location.pathname.startsWith("/tracking/") ||
    location.pathname.startsWith("/suivi/") ||
    location.pathname.startsWith("/reservation/") ||
    location.pathname.startsWith("/scan/") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/reserver");

  const draft = useReservationDraft();
  const message = draft ? buildReservationMessage(draft, lang) : t("wa.default");
  const waHref = whatsappLink(message);

  const handleClick = (action: "whatsapp" | "call" | "quote", variant: "mobile_sticky" | "desktop_float") => () => {
    trackCtaClick({
      event_type: action === "whatsapp" ? "whatsapp_click" : action === "call" ? "call_click" : "quote_click",
      variant,
      has_draft: Boolean(draft),
      lang,
    });
  };

  const barRef = useRef<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState<number>(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setBarHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--mobile-action-bar-h", `${barHeight}px`);
  }, [barHeight]);

  // Ne rien rendre côté serveur ni avant hydratation
  if (!mounted || isHiddenPage) return null;

  const btnBase: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "10px 6px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: "clamp(11px, 3.2vw, 13px)",
    textDecoration: "none",
    color: "#fff",
    minHeight: 56,
    lineHeight: 1.1,
  };

  const content = (
    <>
      {/* Mobile : barre fixe 3 boutons */}
      <div
        ref={barRef}
        className="sm:hidden"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: "rgba(15,23,42,0.96)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(148,163,184,0.2)",
          padding: "8px 10px calc(8px + env(safe-area-inset-bottom)) 10px",
          display: "flex",
          gap: 8,
        }}
        role="navigation"
        aria-label={t("wa.aria.nav")}
      >
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick("whatsapp", "mobile_sticky")}
          style={{ ...btnBase, background: "#25D366" }}
          aria-label={t("wa.aria.whatsapp")}
        >
          <MessageCircle size={20} aria-hidden="true" />
          <span>{t("wa.btn.whatsapp")}</span>
        </a>
        <a
          href={`tel:${PHONE}`}
          onClick={handleClick("call", "mobile_sticky")}
          style={{ ...btnBase, background: "#1d4ed8" }}
          aria-label={t("wa.btn.call")}
        >
          <Phone size={20} aria-hidden="true" />
          <span>{t("wa.btn.call")}</span>
        </a>
        <Link
          to="/reserver"
          onClick={handleClick("quote", "mobile_sticky")}
          style={{ ...btnBase, background: "#0ea5e9" }}
          aria-label={t("wa.btn.quote")}
        >
          <FileText size={20} aria-hidden="true" />
          <span>{t("wa.btn.quote")}</span>
        </Link>
      </div>

      {/* Desktop : cluster flottant bas-droite */}
      <div
        className="hidden sm:flex"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 9999,
          flexDirection: "column",
          gap: 12,
        }}
      >
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick("whatsapp", "desktop_float")}
          aria-label={t("wa.aria.whatsapp")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#25D366",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          }}
        >
          <MessageCircle size={20} aria-hidden="true" />
          {t("wa.btn.whatsapp")}
        </a>
        <a
          href={`tel:${PHONE}`}
          onClick={handleClick("call", "desktop_float")}
          aria-label={t("wa.btn.call")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#1d4ed8",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          }}
        >
          <Phone size={20} aria-hidden="true" />
          {t("wa.btn.call")}
        </a>
        <Link
          to="/reserver"
          onClick={handleClick("quote", "desktop_float")}
          aria-label={t("wa.btn.quote")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#0ea5e9",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          }}
        >
          <FileText size={20} aria-hidden="true" />
          {t("wa.btn.quote")}
        </Link>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
