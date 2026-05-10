// @ts-nocheck
// ============================================================
//  SECTION KIPFUL — À intégrer dans ta homepage Lovable
//  Taxi City Bordeaux — taxicitybordeaux.fr
// ============================================================
//
//  COMMENT L'UTILISER :
//  1. Crée ce fichier dans src/components/KipfulSection.jsx
//  2. Dans ta page homepage (Index.jsx ou Home.jsx), importe-le :
//       import KipfulSection from "@/components/KipfulSection";
//  3. Colle <KipfulSection /> là où tu veux la section
//     (par exemple entre "Pourquoi nous" et le footer)
//
// ============================================================

import { useState } from "react";

// ── Données mock (remplacées par les vraies dès que le proxy Supabase est actif)
const MOCK_CARDS = [
  {
    id: "card_01",
    name: "Taxi City Bordeaux",
    title: "Chauffeur de taxi conventionné",
    company: "Taxi City Bordeaux",
    email: "contact@taxicitybordeaux.fr",
    phone: "06 73 07 23 22",
    website: "https://taxicitybordeaux.fr",
    photo: null,
    slug: "taxicitybordeaux",
    theme: { color: "#1d4ed8", style: "gradient" },
    socials: { linkedin: "", instagram: "", twitter: "" },
    views: 0,
    clicks: 0,
  },
];

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Toast
function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      opacity: visible ? 1 : 0,
      transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      background: "#1e293b", color: "#fff",
      padding: "9px 22px", borderRadius: 999,
      fontSize: 13, fontWeight: 600, zIndex: 9999,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      {message}
    </div>
  );
}

// ── QR Code via API publique
function QRCode({ url, size = 140 }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=8&color=1e293b&bgcolor=ffffff`}
      alt="QR Code"
      width={size} height={size}
      style={{ borderRadius: 10, display: "block" }}
    />
  );
}

// ── Modale partage
function ShareModal({ card, onClose, showToast }) {
  const url = `https://selfcare.kipful.me/c/${card.slug}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 22, padding: 28,
          width: "100%", maxWidth: 360,
          boxShadow: "0 32px 64px rgba(0,0,0,0.18)",
          animation: "tcbModalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0f172a" }}>Partager ma carte</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>{card.name}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "#f1f5f9", border: "none", borderRadius: 9, width: 34, height: 34, cursor: "pointer", fontSize: 15 }}
          >✕</button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ padding: 12, background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0" }}>
            <QRCode url={url} size={140} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#f1f5f9", borderRadius: 11, padding: "9px 13px", marginBottom: 14 }}>
          <span style={{ flex: 1, fontSize: 11, color: "#64748b", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {url}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(url); showToast("Lien copié !"); }}
            style={{ background: card.theme.color, color: "#fff", border: "none", borderRadius: 8, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >
            Copier
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "WhatsApp", emoji: "💬", href: `https://wa.me/?text=${encodeURIComponent("Ma carte : " + url)}` },
            { label: "LinkedIn", emoji: "💼", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
            { label: "Email", emoji: "✉️", href: `mailto:?subject=Ma carte de visite&body=${encodeURIComponent("Voici ma carte : " + url)}` },
          ].map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "10px 6px", background: "#f8fafc", borderRadius: 11,
              textDecoration: "none", border: "1px solid #e2e8f0",
            }}>
              <span style={{ fontSize: 17 }}>{s.emoji}</span>
              <span style={{ fontSize: 10, color: "#374151", fontWeight: 600 }}>{s.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modale saisie token
function SessionModal({ onSave, onClose }) {
  const [token, setToken] = useState("");
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 22, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 32px 64px rgba(0,0,0,0.18)", animation: "tcbModalIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>🔑 Connecter Kipful</div>
        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
          Colle ton token de session Kipful pour afficher ta vraie carte.<br />
          <span style={{ fontSize: 11, color: "#94a3b8" }}>F12 → Network → session → Cookie : __Secure-next-auth.session-token</span>
        </div>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..."
          rows={4}
          style={{ width: "100%", borderRadius: 11, border: "1.5px solid #e2e8f0", padding: "11px 13px", fontSize: 11, fontFamily: "monospace", resize: "none", outline: "none", color: "#374151", boxSizing: "border-box", lineHeight: 1.5 }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Annuler
          </button>
          <button
            onClick={() => { if (token.trim()) { onSave(token.trim()); onClose(); } }}
            style={{ flex: 2, padding: "11px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #1d4ed8, #1e40af)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Connecter →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte visuelle
function VisualCard({ card, onShare }) {
  const [hov, setHov] = useState(false);
  const isGrad = card.theme.style === "gradient";
  const bg = isGrad
    ? `linear-gradient(135deg, ${card.theme.color} 0%, #0f172a 100%)`
    : card.theme.color;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease",
        transform: hov ? "translateY(-5px) scale(1.01)" : "none",
        boxShadow: hov ? "0 20px 40px rgba(29,78,216,0.2)" : "0 4px 16px rgba(0,0,0,0.1)",
        maxWidth: 340,
        width: "100%",
      }}
    >
      {/* Face de la carte */}
      <div style={{ background: bg, padding: "24px 22px 20px", position: "relative", overflow: "hidden" }}>
        {/* Déco */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 75, height: 75, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14, position: "relative" }}>
          <div style={{
            width: 50, height: 50, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {card.photo
              ? <img src={card.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : initials(card.name)
            }
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{card.name}</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>{card.title}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
          {card.phone && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>📞 {card.phone}</div>}
          {card.email && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>✉️ {card.email}</div>}
          {card.website && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>🌐 {card.website.replace("https://", "")}</div>}
        </div>
      </div>

      {/* Barre d'action */}
      <div style={{ background: "#fff", padding: "10px 14px", display: "flex", gap: 8, justifyContent: "space-between", borderTop: "1px solid #f1f5f9" }}>
        <button
          onClick={() => onShare(card)}
          style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: "none", background: card.theme.color, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
        >
          📤 Partager
        </button>
        <a
          href={`https://selfcare.kipful.me/c/${card.slug}`}
          target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer", textDecoration: "none", textAlign: "center" }}
        >
          👁️ Voir
        </a>
        <a
          href="https://selfcare.kipful.me/dashboard/manage/myCards"
          target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer", textDecoration: "none", textAlign: "center" }}
        >
          ✏️ Modifier
        </a>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL — à coller dans ta homepage
// ════════════════════════════════════════════════════════════
export default function KipfulSection() {
  const [cards] = useState(MOCK_CARDS);
  const [shareCard, setShareCard] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "" });

  // ── Remplace par ta vraie URL Supabase Edge Function
  const SUPABASE_PROXY = "https://TON_PROJECT.supabase.co/functions/v1/kipful-proxy";

  const showToast = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: msg }), 2500);
  };

  const handleSaveToken = async (token) => {
    localStorage.setItem("kipful_session_token", token);
    setLoading(true);
    try {
      const res = await fetch(SUPABASE_PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/api/cards", sessionToken: token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setConnected(true);
          showToast("✅ Kipful connecté !");
        } else {
          showToast("Aucune carte trouvée");
        }
      } else {
        showToast("Erreur de connexion Kipful");
      }
    } catch {
      showToast("Mode démo — proxy non configuré");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes tcbModalIn {
          from { transform: scale(0.92) translateY(16px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes tcbFadeUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .tcb-card-anim { animation: tcbFadeUp 0.5s ease both; }
      `}</style>

      {/* ══════════════════════════════════════════════════════
          SECTION — s'intègre tel quel dans la homepage
      ══════════════════════════════════════════════════════ */}
      <section style={{
        padding: "72px 24px",
        background: "linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)",
        borderTop: "1px solid #e2e8f0",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* En-tête section */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 36 }}>
            <div>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "#dbeafe", border: "1px solid #93c5fd",
                borderRadius: 999, padding: "5px 14px", marginBottom: 12,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
                <span style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }}>
                  Carte de visite digitale
                </span>
              </div>

              <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, marginBottom: 8 }}>
                Retrouvez-nous en un scan
              </h2>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
                Scannez le QR code ou partagez le lien pour accéder directement à nos coordonnées depuis votre téléphone.
              </p>
            </div>

            <button
              onClick={() => setShowSessionModal(true)}
              style={{
                padding: "10px 20px", borderRadius: 11,
                background: connected ? "#dcfce7" : "linear-gradient(135deg, #1d4ed8, #1e40af)",
                border: connected ? "1px solid #86efac" : "none",
                color: connected ? "#16a34a" : "#fff",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.2s", flexShrink: 0,
              }}
            >
              {connected ? "✅ Kipful connecté" : "🔗 Sync Kipful"}
            </button>
          </div>

          {/* Contenu principal — carte + QR */}
          <div style={{
            display: "flex", gap: 32, alignItems: "stretch",
            flexWrap: "wrap",
          }}>
            {/* Carte(s) Kipful */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 20, flex: "1 1 300px",
            }}>
              {loading ? (
                <div style={{ height: 200, borderRadius: 18, background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)", backgroundSize: "800px 100%", animation: "tcbFadeUp 1.5s infinite" }} />
              ) : (
                cards.map((card, i) => (
                  <div key={card.id} className="tcb-card-anim" style={{ animationDelay: `${i * 0.08}s` }}>
                    <VisualCard card={card} onShare={setShareCard} />
                  </div>
                ))
              )}
            </div>

            {/* Infos + QR */}
            <div style={{
              flex: "1 1 260px",
              background: "#fff",
              borderRadius: 20,
              padding: 28,
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            }}>
              <div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 16, marginBottom: 4 }}>
                  📍 Taxi City Bordeaux
                </div>
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                  Disponible 7j/7 · 24h/24<br />
                  Bordeaux & Gironde
                </div>
              </div>

              {/* QR code de la carte Kipful */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                  <QRCode url={`https://selfcare.kipful.me/c/${cards[0]?.slug || "taxicitybordeaux"}`} size={130} />
                </div>
                <div style={{ color: "#94a3b8", fontSize: 11, textAlign: "center" }}>
                  Scannez pour voir la carte complète
                </div>
              </div>

              {/* Actions rapides */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => setShareCard(cards[0])}
                  style={{
                    padding: "10px 0", borderRadius: 11,
                    background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                    border: "none", color: "#fff", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  📤 Partager ma carte
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(`https://selfcare.kipful.me/c/${cards[0]?.slug}`); showToast("Lien copié !"); }}
                  style={{
                    padding: "9px 0", borderRadius: 11,
                    background: "#f1f5f9", border: "1px solid #e2e8f0",
                    color: "#374151", fontWeight: 600, fontSize: 13,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  🔗 Copier le lien
                </button>
              </div>

              {!connected && (
                <div style={{ background: "#eff6ff", borderRadius: 11, padding: "10px 14px", border: "1px solid #bfdbfe" }}>
                  <div style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>💡 Mode démo</div>
                  <div style={{ color: "#3b82f6", fontSize: 11, lineHeight: 1.5 }}>
                    Clique sur "Sync Kipful" pour afficher ta vraie carte Kipful.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modales */}
      {shareCard && <ShareModal card={shareCard} onClose={() => setShareCard(null)} showToast={showToast} />}
      {showSessionModal && <SessionModal onSave={handleSaveToken} onClose={() => setShowSessionModal(false)} />}
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
