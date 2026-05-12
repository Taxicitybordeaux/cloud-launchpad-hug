import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix, TARIFS } from "@/lib/tarif";

export const Route = createFileRoute("/reserver")({
  head: () => ({ meta: [{ title: "Réserver — Taxi City Bordeaux" }, { name: "description", content: "Réservez votre taxi en ligne, par email ou WhatsApp." }] }),
  component: ReservationPage,
});

function ReservationPage() {
  const today = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({ prenom: "", nom: "", phone: "", email: "", depart: "", destination: "", date: today, heure: "", passagers: 1, tarifJour: true, distance: 5 });
  const [mode, setMode] = useState<"form" | "email" | "whatsapp">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const prix = useMemo(() => calculerPrix(Number(f.distance) || 0, f.tarifJour), [f.distance, f.tarifJour]);

  useEffect(() => {
    const sid = (typeof window !== "undefined" && (sessionStorage.getItem("sid") || Math.random().toString(36).slice(2)));
    if (sid && typeof window !== "undefined") sessionStorage.setItem("sid", sid);
    supabase.from("site_analytics").insert({ event: "visit", session_id: sid || null });
  }, []);

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.prenom) e.prenom = "Requis"; if (!f.nom) e.nom = "Requis";
    if (!f.phone) e.phone = "Requis"; if (!f.email) e.email = "Requis";
    if (!f.depart) e.depart = "Requis"; if (!f.destination) e.destination = "Requis";
    if (!f.date) e.date = "Requis"; if (!f.heure) e.heure = "Requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildText = () =>
    `Réservation taxi%0A%0AClient: ${f.prenom} ${f.nom}%0ATél: ${f.phone}%0AEmail: ${f.email}%0A%0ADépart: ${f.depart}%0ADestination: ${f.destination}%0ADate: ${f.date} ${f.heure}%0APassagers: ${f.passagers}%0ATarif: ${f.tarifJour ? "Jour" : "Nuit"}%0APrix estimé: ${prix} €`;

  const submitForm = async () => {
    if (!validate()) return;
    setSending(true);
    const fullName = `${f.prenom} ${f.nom}`.trim();
    const pickup = new Date(`${f.date}T${f.heure || "12:00"}:00`).toISOString();
    await supabase.from("reservations").insert({
      nom: fullName, telephone: f.phone, email: f.email,
      depart: f.depart, arrivee: f.destination, pickup_datetime: pickup, passagers: f.passagers,
      client_name: fullName, client_phone: f.phone, client_email: f.email,
      destination: f.destination, distance_km: f.distance, date_course: f.date, heure_course: f.heure,
      nb_passagers: f.passagers, tarif_jour: f.tarifJour, prix_estime: prix,
      status: "pending", source: "form",
    });
    const sid = typeof window !== "undefined" ? sessionStorage.getItem("sid") : null;
    await supabase.from("site_analytics").insert({ event: "reservation_attempt", session_id: sid });
    setSending(false);
    setSuccess(true);
  };

  const Input = ({ k, type = "text", placeholder, ...rest }: any) => (
    <div>
      <input type={type} value={(f as any)[k]} onChange={e => set(k, type === "number" ? Number(e.target.value) : e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${errors[k] ? "#ef4444" : "#e2e8f0"}`, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }} {...rest} />
      {errors[k] && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors[k]}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 16px", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "#fff", borderRadius: 24, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#0f172a", margin: 0 }}>Réserver votre taxi</h1>
        <p style={{ color: "#64748b", marginTop: 6 }}>Réponse sous 15 min · 7j/7 · 24h/24</p>

        {success ? (
          <div style={{ marginTop: 24, padding: 20, background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 14, color: "#065f46", textAlign: "center" }}>✅ Votre demande a été envoyée ! Vous serez contacté sous 15 min.</div>
        ) : (
          <>
            <h3 style={{ fontFamily: "'Syne',sans-serif", marginTop: 24, color: "#0f172a" }}>Vos coordonnées</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input k="prenom" placeholder="Prénom" />
              <Input k="nom" placeholder="Nom" />
              <Input k="phone" type="tel" placeholder="Téléphone" />
              <Input k="email" type="email" placeholder="Email" />
            </div>

            <h3 style={{ fontFamily: "'Syne',sans-serif", marginTop: 24, color: "#0f172a" }}>Votre course</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <Input k="depart" placeholder="Adresse de départ" />
              <Input k="destination" placeholder="Adresse de destination" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Input k="date" type="date" min={today} />
                <Input k="heure" type="time" />
                <select value={f.passagers} onChange={e => set("passagers", Number(e.target.value))} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} passager{n > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ flex: 1, padding: 12, border: `2px solid ${f.tarifJour ? "#0ea5e9" : "#e2e8f0"}`, borderRadius: 12, cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" checked={f.tarifJour} onChange={() => set("tarifJour", true)} /> Jour (6h-21h) — 2.16 €/km
                </label>
                <label style={{ flex: 1, padding: 12, border: `2px solid ${!f.tarifJour ? "#0ea5e9" : "#e2e8f0"}`, borderRadius: 12, cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" checked={!f.tarifJour} onChange={() => set("tarifJour", false)} /> Nuit (21h-6h) — 3.24 €/km
                </label>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 20, background: "#f1f5f9", borderRadius: 16 }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", margin: 0, color: "#0f172a" }}>Simulateur de prix</h3>
              <div style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>Prise en charge: {TARIFS.PRISE_EN_CHARGE} €</div>
              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                Distance estimée:
                <input type="number" step="0.1" value={f.distance} onChange={e => set("distance", Number(e.target.value))} style={{ width: 80, padding: 6, border: "1px solid #cbd5e1", borderRadius: 8 }} /> km
              </div>
              <div style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>Tarif au km: {f.tarifJour ? "2.16" : "3.24"} €</div>
              <div style={{ marginTop: 12, fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 900, color: "#0ea5e9" }}>TOTAL ESTIMÉ : {prix} €</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Prix indicatif — le compteur fait foi</div>
            </div>

            <h3 style={{ fontFamily: "'Syne',sans-serif", marginTop: 24, color: "#0f172a" }}>Mode de réservation</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {(["form", "email", "whatsapp"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ padding: 12, border: `2px solid ${mode === m ? "#0ea5e9" : "#e2e8f0"}`, background: mode === m ? "#f0f9ff" : "#fff", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  {m === "form" ? "📝 Formulaire" : m === "email" ? "✉️ Email" : "💬 WhatsApp"}
                </button>
              ))}
            </div>

            {mode === "form" && (
              <button disabled={sending} onClick={submitForm} style={{ width: "100%", height: 56, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: 0, borderRadius: 14, fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, cursor: sending ? "wait" : "pointer", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Envoi…" : "📨 Envoyer ma demande"}
              </button>
            )}
            {mode === "email" && (
              <a href={`mailto:contact@taxicitybordeaux.fr?subject=Réservation taxi&body=${buildText()}`} style={{ display: "block", textAlign: "center", height: 56, lineHeight: "56px", background: "#0ea5e9", color: "#fff", borderRadius: 14, fontFamily: "'Syne',sans-serif", fontWeight: 800, textDecoration: "none" }}>
                ✉️ Envoyer par email
              </a>
            )}
            {mode === "whatsapp" && (
              <a href={`https://wa.me/33673072322?text=${buildText()}`} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", height: 56, lineHeight: "56px", background: "#25D366", color: "#fff", borderRadius: 14, fontFamily: "'Syne',sans-serif", fontWeight: 800, textDecoration: "none" }}>
                💬 Envoyer sur WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
