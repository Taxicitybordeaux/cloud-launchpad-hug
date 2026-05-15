import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, TARIFS } from "@/lib/tarif";

export const Route = createFileRoute("/reserver")({
  head: () => ({
    meta: [
      { title: "Réserver — Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi en ligne, par email ou WhatsApp." },
    ],
  }),
  component: ReservationPage,
});

function ReservationPage() {
  const today = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({
    prenom: "",
    nom: "",
    phone: "",
    email: "",
    depart: "",
    destination: "",
    date: today,
    heure: "",
    passagers: 1,
    tarifJour: true,
    distance: 5,
  });
  const [mode, setMode] = useState<"form" | "email" | "whatsapp">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false); // point 2
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(""); // point 4

  const prix = useMemo(() => calculerPrix(Number(f.distance) || 0, f.tarifJour), [f.distance, f.tarifJour]);

  useEffect(() => {
    const sid = typeof window !== "undefined" && (sessionStorage.getItem("sid") || Math.random().toString(36).slice(2));
    if (sid && typeof window !== "undefined") sessionStorage.setItem("sid", sid as string);
    supabase.from("site_analytics").insert({ event: "visit", session_id: sid || null });
  }, []);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.prenom) e.prenom = "Requis";
    if (!f.nom) e.nom = "Requis";
    if (!f.phone) e.phone = "Requis";
    if (!f.email) e.email = "Requis";
    if (!f.depart) e.depart = "Requis";
    if (!f.destination) e.destination = "Requis";
    if (!f.date) e.date = "Requis";
    if (!f.heure) e.heure = "Requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Point 16: WhatsApp message with first name or generic greeting
  const buildWhatsAppText = () => {
    const greeting = f.prenom ? `Bonjour, je m'appelle ${f.prenom}` : "Bonjour";
    return encodeURIComponent(
      `${greeting}, je souhaite réserver un taxi. Êtes-vous disponible ?\n\n` +
        `Départ : ${f.depart || "À préciser"}\n` +
        `Destination : ${f.destination || "À préciser"}\n` +
        `Date : ${f.date} ${f.heure}\n` +
        `Passagers : ${f.passagers}\n` +
        `Tarif : ${f.tarifJour ? "Jour" : "Nuit"}\n` +
        `Prix estimé : ${prix} €`,
    );
  };

  const buildEmailText = () =>
    `Réservation taxi%0A%0AClient: ${f.prenom} ${f.nom}%0ATél: ${f.phone}%0AEmail: ${f.email}%0A%0ADépart: ${f.depart}%0ADestination: ${f.destination}%0ADate: ${f.date} ${f.heure}%0APassagers: ${f.passagers}%0ATarif: ${f.tarifJour ? "Jour" : "Nuit"}%0APrix estimé: ${prix} €`;

  // Points 2, 3, 4
  const submitForm = async () => {
    if (!validate()) return;
    setSending(true);
    setSubmitError("");

    try {
      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickup = new Date(`${f.date}T${f.heure || "12:00"}:00`).toISOString();
      const pickupMs = new Date(pickup).getTime();
      const fromIso = new Date(pickupMs - 30 * 60_000).toISOString();
      const toIso = new Date(pickupMs + 30 * 60_000).toISOString();

      const { data: conflicts } = await supabase
        .from("reservations")
        .select("id")
        .gte("pickup_datetime", fromIso)
        .lte("pickup_datetime", toIso)
        .not("status", "in", "(annulee,refusee,terminee)")
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        setErrors((prev) => ({
          ...prev,
          heure: "Ce créneau est déjà réservé. Choisissez un autre horaire (±30 min).",
        }));
        setSending(false);
        return;
      }

      const { error: insertError } = await supabase.from("reservations").insert({
        nom: fullName,
        telephone: f.phone,
        email: f.email,
        depart: f.depart,
        arrivee: f.destination,
        pickup_datetime: pickup,
        passagers: f.passagers,
        client_name: fullName,
        client_phone: f.phone,
        client_email: f.email,
        destination: f.destination,
        distance_km: f.distance,
        date_course: f.date,
        heure_course: f.heure,
        nb_passagers: f.passagers,
        tarif_jour: f.tarifJour,
        prix_estime: prix,
        status: "pending",
        source: "form",
      });

      if (insertError) throw new Error(insertError.message);

      // Point 3: send confirmation email to client
      try {
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess?.session?.access_token;
        if (accessToken && f.email) {
          await fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              templateName: "reservation-confirmation",
              recipientEmail: f.email,
              idempotencyKey: `reservation-confirm-${f.email}-${pickup}`,
              templateData: {
                prenom: f.prenom,
                nom: fullName,
                depart: f.depart,
                destination: f.destination,
                date: f.date,
                heure: f.heure,
                passagers: f.passagers,
                prix_estime: prix,
                tarif: f.tarifJour ? "Jour (6h–21h)" : "Nuit (21h–6h)",
              },
            }),
          });
        }
      } catch {
        // email failure is non-blocking
      }

      const sid = typeof window !== "undefined" ? sessionStorage.getItem("sid") : null;
      await supabase.from("site_analytics").insert({ event: "reservation_attempt", session_id: sid });
      setSuccess(true);
    } catch (err: any) {
      // Point 4: show error with retry button
      setSubmitError(err?.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  };

  const Input = ({ k, type = "text", placeholder, ...rest }: any) => (
    <div>
      <input
        type={type}
        value={(f as any)[k]}
        onChange={(e) => set(k, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${errors[k] ? "#ef4444" : "#e2e8f0"}`,
          fontSize: 14,
          fontFamily: "'DM Sans',sans-serif",
          boxSizing: "border-box",
        }}
        {...rest}
      />
      {errors[k] && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
    </div>
  );

  return (
    // Point 19: responsive layout — padding adapté mobile
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "clamp(16px,5vw,40px) clamp(12px,4vw,16px)",
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
 
        /* Point 19: mobile-first responsive overrides */
        .resa-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .resa-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .resa-mode-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .tarif-row { display: flex; gap: 12px; }
 
        @media (max-width: 480px) {
          .resa-grid-2 { grid-template-columns: 1fr; }
          .resa-grid-3 { grid-template-columns: 1fr 1fr; }
          .resa-mode-grid { grid-template-columns: 1fr; }
          .tarif-row { flex-direction: column; }
        }
 
        /* Point 2: spinner animation */
        @keyframes resaSpin { to { transform: rotate(360deg); } }
        .resa-spinner {
          display: inline-block;
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: resaSpin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }
      `}</style>

      <div
        className="form-sticky-submit"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 24,
          padding: "clamp(20px,5vw,32px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontFamily: "'Syne',sans-serif",
            fontWeight: 800,
            fontSize: "clamp(22px,5vw,28px)",
            color: "#0f172a",
            margin: 0,
          }}
        >
          Réserver votre taxi
        </h1>
        <p style={{ color: "#64748b", marginTop: 6, fontSize: "clamp(13px,3.5vw,15px)" }}>
          Réponse sous 15 min · 7j/7 · 24h/24
        </p>

        {success ? (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              background: "#ecfdf5",
              border: "1px solid #6ee7b7",
              borderRadius: 14,
              color: "#065f46",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>
              Votre demande a été envoyée !
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              Vous serez contacté sous 15 min. Un email de confirmation a été envoyé à {f.email}.
            </div>
          </div>
        ) : (
          <>
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                marginTop: 24,
                color: "#0f172a",
                fontSize: "clamp(14px,4vw,16px)",
              }}
            >
              Vos coordonnées
            </h3>
            <div className="resa-grid-2">
              <Input k="prenom" placeholder="Prénom" />
              <Input k="nom" placeholder="Nom" />
              <Input k="phone" type="tel" placeholder="Téléphone" />
              <Input k="email" type="email" placeholder="Email" />
            </div>

            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                marginTop: 24,
                color: "#0f172a",
                fontSize: "clamp(14px,4vw,16px)",
              }}
            >
              Votre course
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              <Input k="depart" placeholder="Adresse de départ" />
              <Input k="destination" placeholder="Adresse de destination" />
              <div className="resa-grid-3">
                <Input k="date" type="date" min={today} />
                <Input k="heure" type="time" />
                <select
                  value={f.passagers}
                  onChange={(e) => set("passagers", Number(e.target.value))}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} passager{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tarif-row">
                <label
                  style={{
                    flex: 1,
                    padding: 12,
                    border: `2px solid ${f.tarifJour ? "#0ea5e9" : "#e2e8f0"}`,
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <input type="radio" checked={f.tarifJour} onChange={() => set("tarifJour", true)} /> Jour (6h-21h) —
                  2.16 €/km
                </label>
                <label
                  style={{
                    flex: 1,
                    padding: 12,
                    border: `2px solid ${!f.tarifJour ? "#0ea5e9" : "#e2e8f0"}`,
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <input type="radio" checked={!f.tarifJour} onChange={() => set("tarifJour", false)} /> Nuit (21h-6h) —
                  3.24 €/km
                </label>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 20, background: "#f1f5f9", borderRadius: 16 }}>
              <h3
                style={{
                  fontFamily: "'Syne',sans-serif",
                  margin: 0,
                  color: "#0f172a",
                  fontSize: "clamp(14px,4vw,16px)",
                }}
              >
                Simulateur de prix
              </h3>
              <div style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>
                Prise en charge : {TARIFS.PRISE_EN_CHARGE} €
              </div>
              <div
                style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 }}
              >
                Distance estimée :
                <input
                  type="number"
                  step="0.1"
                  value={f.distance}
                  onChange={(e) => set("distance", Number(e.target.value))}
                  style={{ width: 80, padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }}
                />{" "}
                km
              </div>
              <div style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>
                Tarif au km : {f.tarifJour ? "2.16" : "3.24"} €
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: "'Syne',sans-serif",
                  fontSize: "clamp(24px,6vw,32px)",
                  fontWeight: 900,
                  color: "#0ea5e9",
                }}
              >
                TOTAL ESTIMÉ : {prix} €
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Prix indicatif — le compteur fait foi</div>
            </div>

            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                marginTop: 24,
                color: "#0f172a",
                fontSize: "clamp(14px,4vw,16px)",
              }}
            >
              Mode de réservation
            </h3>
            <div className="resa-mode-grid" style={{ marginBottom: 16 }}>
              {(["form", "email", "whatsapp"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: "clamp(10px,3vw,12px)",
                    border: `2px solid ${mode === m ? "#0ea5e9" : "#e2e8f0"}`,
                    background: mode === m ? "#f0f9ff" : "#fff",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "clamp(12px,3vw,13px)",
                  }}
                >
                  {m === "form" ? "📝 Formulaire" : m === "email" ? "✉️ Email" : "💬 WhatsApp"}
                </button>
              ))}
            </div>

            {/* Point 4: error banner with retry */}
            {submitError && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "14px 16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  color: "#991b1b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  fontSize: 14,
                }}
              >
                <span>❌ {submitError}</span>
                <button
                  onClick={submitForm}
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: 0,
                    padding: "8px 16px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  🔄 Réessayer
                </button>
              </div>
            )}

            {mode === "form" && (
              /* Point 2: spinner + disabled state during sending */
              <button
                disabled={sending}
                onClick={submitForm}
                style={{
                  width: "100%",
                  height: 56,
                  background: sending
                    ? "linear-gradient(135deg,#7dd3fc,#38bdf8)"
                    : "linear-gradient(135deg,#0ea5e9,#0369a1)",
                  color: "#fff",
                  border: 0,
                  borderRadius: 14,
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(14px,4vw,16px)",
                  cursor: sending ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.2s",
                }}
              >
                {sending ? (
                  <>
                    <span className="resa-spinner" />
                    Envoi en cours…
                  </>
                ) : (
                  "📨 Envoyer ma demande"
                )}
              </button>
            )}

            {mode === "email" && (
              <a
                href={`mailto:contact@taxicitybordeaux.fr?subject=Réservation taxi&body=${buildEmailText()}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 56,
                  background: "#0ea5e9",
                  color: "#fff",
                  borderRadius: 14,
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  textDecoration: "none",
                  fontSize: "clamp(14px,4vw,16px)",
                }}
              >
                ✉️ Envoyer par email
              </a>
            )}

            {mode === "whatsapp" && (
              /* Point 16: message with first name */
              <a
                href={`https://wa.me/33673072322?text=${buildWhatsAppText()}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 56,
                  background: "#25D366",
                  color: "#fff",
                  borderRadius: 14,
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  textDecoration: "none",
                  fontSize: "clamp(14px,4vw,16px)",
                }}
              >
                💬 Envoyer sur WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
