import { Link, useLocation } from "@tanstack/react-router";

export function SiteFooter() {
  const { pathname } = useLocation();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/tracking") ||
    pathname.startsWith("/chauffeur") ||
    pathname.startsWith("/lovable") ||
    pathname.startsWith("/email")
  ) {
    return null;
  }

  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "#0a0f1e",
        color: "#cbd5e1",
        /* Reduced top padding on mobile */
        padding: "40px 16px 24px",
        fontFamily: "'DM Sans',sans-serif",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&display=swap');

        /* Footer responsive grid */
        .footer-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
        }
        @media (min-width: 640px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 36px;
          }
        }
        @media (min-width: 1024px) {
          .footer-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 40px;
          }
        }

        /* Footer brand col spans full width on small, half on sm */
        .footer-brand {
          grid-column: 1 / -1;
        }
        @media (min-width: 1024px) {
          .footer-brand {
            grid-column: 1 / 2;
          }
        }

        /* Bottom bar */
        .footer-bottom {
          max-width: 1200px;
          margin: 32px auto 0;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: #64748b;
          text-align: center;
        }
        @media (min-width: 640px) {
          .footer-bottom {
            flex-direction: row;
            justify-content: space-between;
            text-align: left;
          }
        }

        /* Social buttons: bigger tap target on mobile */
        .footer-social-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 18px;
          transition: background 0.2s;
        }
        .footer-social-btn:active {
          background: rgba(255,255,255,0.12);
        }

        /* Footer links: bigger tap area */
        .footer-link {
          color: #cbd5e1;
          text-decoration: none;
          font-size: 15px;
          padding: 3px 0;
          display: inline-block;
        }
        @media (min-width: 1024px) {
          .footer-link { font-size: 14px; }
        }
        .footer-link-sm {
          color: #cbd5e1;
          text-decoration: none;
          font-size: 12px;
        }

        .footer-li-text {
          font-size: 15px;
          color: #94a3b8;
          padding: 3px 0;
        }
        @media (min-width: 1024px) {
          .footer-li-text { font-size: 14px; }
        }

        .footer-col-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .footer-ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>

      <div className="footer-grid">
        {/* Brand */}
        <div className="footer-brand">
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 900,
              fontSize: 20,
              color: "#f8fafc",
              marginBottom: 10,
            }}
          >
            🚕 Taxi City Bordeaux
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#94a3b8", margin: 0, maxWidth: 280 }}>
            Votre taxi conventionné à Bordeaux et en Gironde. Disponible 7j/7 — 24h/24.
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <a
              href="https://wa.me/33673072322"
              aria-label="WhatsApp"
              className="footer-social-btn"
              style={{ border: "1px solid #25D36640" }}
            >
              💬
            </a>
            <a
              href="tel:0673072322"
              aria-label="Appeler"
              className="footer-social-btn"
              style={{ border: "1px solid #0ea5e940" }}
            >
              📞
            </a>
            <a
              href="mailto:contact@taxicitybordeaux.fr"
              aria-label="Email"
              className="footer-social-btn"
              style={{ border: "1px solid #94a3b840" }}
            >
              ✉️
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="footer-col-title">Navigation</h3>
          <ul className="footer-ul">
            {[
              { to: "/", label: "Accueil" },
              { to: "/services", label: "Services" },
              { to: "/reserver", label: "Réserver" },
              { to: "/a-propos", label: "À propos" },
              { to: "/contact", label: "Contact" },
            ].map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="footer-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Services */}
        <div>
          <h3 className="footer-col-title">Nos courses</h3>
          <ul className="footer-ul">
            {[
              "✈️ Aéroport Mérignac",
              "🚉 Gare Saint-Jean",
              "🍷 Vignobles & châteaux",
              "🏥 Transport conventionné CPAM",
              "🛣️ Longues distances",
            ].map((item) => (
              <li key={item} className="footer-li-text">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="footer-col-title">Contact</h3>
          <ul className="footer-ul">
            <li>
              <a href="tel:0673072322" className="footer-link">
                📞 06 73 07 23 22
              </a>
            </li>
            <li>
              <a href="mailto:contact@taxicitybordeaux.fr" className="footer-link" style={{ wordBreak: "break-all" }}>
                ✉️ contact@taxicitybordeaux.fr
              </a>
            </li>
            <li className="footer-li-text">📍 Bordeaux & Gironde</li>
            <li className="footer-li-text">🕒 7j/7 · 24h/24</li>
          </ul>

          {/* CTA call button — visible and tappable on mobile */}
          <a
            href="tel:0673072322"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 20,
              background: "#1d4ed8",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            📞 Appeler maintenant
          </a>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div>© {year} Taxi City Bordeaux. Tous droits réservés.</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/mentions-legales" className="footer-link-sm">
            Mentions légales
          </Link>
          <Link to="/confidentialite" className="footer-link-sm">
            Confidentialité
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
