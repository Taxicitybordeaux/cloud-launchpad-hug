import { Link, useLocation } from "@tanstack/react-router";

export function SiteFooter() {
  const { pathname } = useLocation();

  // Pas de footer sur admin, login et page tracking client
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
        padding: "56px 24px 28px",
        fontFamily: "'DM Sans',sans-serif",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&display=swap');`}</style>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 40,
        }}
      >
        {/* Brand */}
        <div>
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 900,
              fontSize: 22,
              color: "#f8fafc",
              marginBottom: 10,
            }}
          >
            🚕 Taxi City Bordeaux
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#94a3b8", margin: 0 }}>
            Votre taxi conventionné à Bordeaux et en Gironde. Disponible 7j/7 — 24h/24.
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <a
              href="https://wa.me/33673072322"
              aria-label="WhatsApp"
              style={socialBtn("#25D366")}
            >
              💬
            </a>
            <a href="tel:0673072322" aria-label="Appeler" style={socialBtn("#0ea5e9")}>
              📞
            </a>
            <a
              href="mailto:contact@taxicitybordeaux.fr"
              aria-label="Email"
              style={socialBtn("#94a3b8")}
            >
              ✉️
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <h3 style={colTitle}>Navigation</h3>
          <ul style={ul}>
            <li>
              <Link to="/" style={linkStyle}>
                Accueil
              </Link>
            </li>
            <li>
              <Link to="/services" style={linkStyle}>
                Services
              </Link>
            </li>
            <li>
              <Link to="/reserver" style={linkStyle}>
                Réserver
              </Link>
            </li>
            <li>
              <Link to="/a-propos" style={linkStyle}>
                À propos
              </Link>
            </li>
            <li>
              <Link to="/contact" style={linkStyle}>
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Services */}
        <div>
          <h3 style={colTitle}>Nos courses</h3>
          <ul style={ul}>
            <li style={liText}>✈️ Aéroport Mérignac</li>
            <li style={liText}>🚉 Gare Saint-Jean</li>
            <li style={liText}>🍷 Vignobles & châteaux</li>
            <li style={liText}>🏥 Transport conventionné CPAM</li>
            <li style={liText}>🛣️ Longues distances</li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 style={colTitle}>Contact</h3>
          <ul style={ul}>
            <li style={liText}>
              <a href="tel:0673072322" style={linkStyle}>
                📞 06 73 07 23 22
              </a>
            </li>
            <li style={liText}>
              <a href="mailto:contact@taxicitybordeaux.fr" style={linkStyle}>
                ✉️ contact@taxicitybordeaux.fr
              </a>
            </li>
            <li style={liText}>📍 Bordeaux & Gironde</li>
            <li style={liText}>🕒 7j/7 · 24h/24</li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1200,
          margin: "40px auto 0",
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <div>© {year} Taxi City Bordeaux. Tous droits réservés.</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/contact" style={{ ...linkStyle, fontSize: 12 }}>
            Mentions légales
          </Link>
          <Link to="/contact" style={{ ...linkStyle, fontSize: 12 }}>
            Confidentialité
          </Link>
        </div>
      </div>
    </footer>
  );
}

const colTitle = {
  fontFamily: "'Syne',sans-serif",
  fontSize: 14,
  fontWeight: 800,
  color: "#f8fafc",
  margin: "0 0 14px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const ul = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const linkStyle = {
  color: "#cbd5e1",
  textDecoration: "none",
  fontSize: 14,
  transition: "color 0.2s",
};

const liText = { fontSize: 14, color: "#94a3b8" };

const socialBtn = (color: string) => ({
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${color}40`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 16,
});

export default SiteFooter;
