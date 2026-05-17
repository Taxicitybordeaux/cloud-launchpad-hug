import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reserver")({
  head: () => ({
    meta: [
      { title: "Réserver — Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi en ligne, par email ou WhatsApp." },
    ],
  }),
  component: ReservationPage,
});

// ─────────────────────────────────────────────────────────────
// Input simple — défini EN DEHORS du composant parent pour
// éviter le démontage/remontage à chaque render (perte de focus).
// ─────────────────────────────────────────────────────────────
interface InputProps {
  k: string;
  value: any;
  onChange: (k: string, v: any) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}

function Input({ k, value, onChange, type = "text", placeholder, error, min, max, step }: InputProps) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(k, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${error ? "#ef4444" : "#e2e8f0"}`,
          fontSize: 16,
          fontFamily: "'DM Sans',sans-serif",
          boxSizing: "border-box",
          background: "#ffffff",
          color: "#0f172a",
          colorScheme: "light",
          WebkitAppearance: "none",
        }}
      />
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Select — sorti du composant parent (même raison)
// ─────────────────────────────────────────────────────────────
interface SelectFieldProps {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
}

function SelectField({ value, onChange, options }: SelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        fontSize: 16,
        width: "100%",
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#0f172a",
        WebkitAppearance: "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────
// Nominatim autocomplete
// ─────────────────────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function useNominatim(query: string) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "12");
        url.searchParams.set("countrycodes", "fr");
        url.searchParams.set("addressdetails", "1");
        const res = await fetch(url.toString(), { headers: { "Accept-Language": "fr" } });
        setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 380);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return { results, loading };
}

// ─────────────────────────────────────────────────────────────
// Champ adresse avec suggestions
// ─────────────────────────────────────────────────────────────
interface AddressInputProps {
  fieldKey: "depart" | "destination";
  value: string;
  onChange: (k: string, v: string) => void;
  placeholder: string;
  error?: string;
}

function AddressInput({ fieldKey, value: _value, onChange, placeholder, error }: AddressInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { results, loading } = useNominatim(query);

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    onChange(fieldKey, v);
    setOpen(true);
  };

  const handleSelect = (r: NominatimResult) => {
    const short = r.display_name.split(",").slice(0, 3).join(", ");
    if (inputRef.current) inputRef.current.value = short;
    setQuery(short);
    onChange(fieldKey, short);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          defaultValue=""
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "12px 40px 12px 14px",
            borderRadius: 12,
            border: `1px solid ${error ? "#ef4444" : "#e2e8f0"}`,
            fontSize: 16,
            fontFamily: "'DM Sans',sans-serif",
            boxSizing: "border-box",
            background: "#ffffff",
            color: "#0f172a",
            WebkitAppearance: "none",
          }}
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              color: "#94a3b8",
            }}
          >
            ⏳
          </span>
        )}
      </div>
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}

      {open && results.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 100,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 0,
            listStyle: "none",
            overflow: "hidden",
          }}
        >
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(r)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#0f172a",
                  fontFamily: "'DM Sans',sans-serif",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <span style={{ color: "#0ea5e9", marginTop: 2, flexShrink: 0 }}>📍</span>
                <span
                  style={
                    {
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    } as CSSProperties
                  }
                >
                  {r.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
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
    bagages: 0,
    tarifJour: true,
    paiement: "especes",
    trajet: "aller" as "aller" | "aller-retour",
  });

  const [mode, setMode] = useState<"form" | "email" | "whatsapp" | "sms">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  const trajetLabel = (t: string) => (t === "aller-retour" ? "Aller-retour 🔁" : "Aller simple ➡️");

  const buildWhatsAppText = () => {
    const greeting = f.prenom ? `Bonjour, je m'appelle ${f.prenom}` : "Bonjour";
    return encodeURIComponent(
      `${greeting}, je souhaite réserver un taxi. Êtes-vous disponible ?\n\n` +
        `Trajet : ${trajetLabel(f.trajet)}\n` +
        `Départ : ${f.depart || "À préciser"}\n` +
        `Destination : ${f.destination || "À préciser"}\n` +
        `Date : ${f.date} ${f.heure}\n` +
        `Passagers : ${f.passagers}\n` +
        `Bagages : ${f.bagages}\n` +
        `Tarif : ${f.tarifJour ? "Jour" : "Nuit"}`,
    );
  };

  const buildEmailText = () =>
    `Réservation taxi%0A%0AClient: ${f.prenom} ${f.nom}%0ATél: ${f.phone}%0AEmail: ${f.email}%0A%0ATrajet: ${trajetLabel(f.trajet)}%0ADépart: ${f.depart}%0ADestination: ${f.destination}%0ADate: ${f.date} ${f.heure}%0APassagers: ${f.passagers}%0ABagages: ${f.bagages}%0ATarif: ${f.tarifJour ? "Jour" : "Nuit"}`;

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
        bagages: f.bagages,
        client_name: fullName,
        client_phone: f.phone,
        client_email: f.email,
        destination: f.destination,
        distance_km: null,
        date_course: f.date,
        heure_course: f.heure,
        nb_passagers: f.passagers,
        tarif_jour: f.tarifJour,
        prix_estime: null,
        status: "pending",
        source: "form",
        paiement: f.paiement,
      });

      if (insertError) throw new Error(insertError.message);

      try {
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess?.session?.access_token;
        if (accessToken && f.email) {
          await fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
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
                bagages: f.bagages,
                prix_estime: null,
                tarif: f.tarifJour ? "Jour (7h–19h) — 2,16 €/km" : "Nuit (19h–7h) — 3,24 €/km",
              },
            }),
          });
        }
      } catch {
        // email non-bloquant
      }

      const sid = typeof window !== "undefined" ? sessionStorage.getItem("sid") : null;
      await supabase.from("site_analytics").insert({ event: "reservation_attempt", session_id: sid });
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err?.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  };

  const passagerOptions = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    value: n,
    label: `${n} passager${n > 1 ? "s" : ""}`,
  }));

  const bagagesOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    value: n,
    label: n === 0 ? "0 bagage" : `${n} bagage${n > 1 ? "s" : ""}`,
  }));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "clamp(16px,5vw,40px) clamp(12px,4vw,16px)",
        fontFamily: "'DM Sans',sans-serif",
        color: "#0f172a",
        colorScheme: "light",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        .resa-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .resa-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .resa-grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
        .resa-mode-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
        .tarif-row { display: flex; gap: 12px; }

        @media (max-width: 480px) {
          .resa-grid-2 { grid-template-columns: 1fr; }
          .resa-grid-3 { grid-template-columns: 1fr 1fr; }
          .resa-grid-4 { grid-template-columns: 1fr 1fr; }
          .resa-mode-grid { grid-template-columns: 1fr 1fr; }
          .tarif-row { flex-direction: column; }
        }

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

        .sticky-submit-bar {
          position: sticky;
          bottom: 0;
          padding-top: 12px;
          background: #fff;
          z-index: 10;
        }
      `}</style>

      <div
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
            {/* ── Coordonnées ── */}
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
              <Input k="prenom" value={f.prenom} onChange={set} placeholder="Prénom" error={errors.prenom} />
              <Input k="nom" value={f.nom} onChange={set} placeholder="Nom" error={errors.nom} />
              <Input k="phone" value={f.phone} onChange={set} type="tel" placeholder="Téléphone" error={errors.phone} />
              <Input k="email" value={f.email} onChange={set} type="email" placeholder="Email" error={errors.email} />
            </div>

            {/* ── Course ── */}
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
              {/* Adresses */}
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 4,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  🟢 Adresse de départ
                </div>
                <AddressInput
                  fieldKey="depart"
                  value={f.depart}
                  onChange={set}
                  placeholder="Ex : 12 rue Sainte-Catherine, Bordeaux"
                  error={errors.depart}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 4,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  🏁 Adresse de destination
                </div>
                <AddressInput
                  fieldKey="destination"
                  value={f.destination}
                  onChange={set}
                  placeholder="Ex : Aéroport de Bordeaux"
                  error={errors.destination}
                />
              </div>

              {/* Date, heure, passagers, bagages */}
              <div className="resa-grid-4">
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Date
                  </div>
                  <Input k="date" value={f.date} onChange={set} type="date" min={today} error={errors.date} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Heure
                  </div>
                  <Input
                    k="heure"
                    value={f.heure}
                    onChange={set}
                    type="time"
                    placeholder="Ex : 14:30"
                    error={errors.heure}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Passagers
                  </div>
                  <SelectField value={f.passagers} onChange={(v) => set("passagers", v)} options={passagerOptions} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Bagages
                  </div>
                  <SelectField value={f.bagages} onChange={(v) => set("bagages", v)} options={bagagesOptions} />
                </div>
              </div>
            </div>

            {/* ── Tarif ── */}
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                marginTop: 24,
                color: "#0f172a",
                fontSize: "clamp(14px,4vw,16px)",
              }}
            >
              Tarif
            </h3>
            <div className="tarif-row">
              <label
                style={{
                  flex: 1,
                  padding: 12,
                  border: `2px solid ${f.tarifJour ? "#0ea5e9" : "#e2e8f0"}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="radio"
                  checked={f.tarifJour}
                  onChange={() => set("tarifJour", true)}
                  style={{ accentColor: "#0ea5e9" }}
                />
                ☀️ Jour (7h–19h) — 2,16 €/km
              </label>
              <label
                style={{
                  flex: 1,
                  padding: 12,
                  border: `2px solid ${!f.tarifJour ? "#818cf8" : "#e2e8f0"}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="radio"
                  checked={!f.tarifJour}
                  onChange={() => set("tarifJour", false)}
                  style={{ accentColor: "#818cf8" }}
                />
                🌙 Nuit (19h–7h) — dimanches & jours fériés — 3,24 €/km
              </label>
            </div>

            {/* ── Moyen de paiement ── */}
            <h3
              style={{
                fontFamily: "'Syne',sans-serif",
                marginTop: 24,
                color: "#0f172a",
                fontSize: "clamp(14px,4vw,16px)",
              }}
            >
              Moyen de paiement
            </h3>
            <div className="resa-grid-4">
              {[
                { v: "especes", l: "💶 Espèces" },
                { v: "cb", l: "💳 CB" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  style={{
                    padding: 12,
                    border: `2px solid ${f.paiement === opt.v ? "#0ea5e9" : "#e2e8f0"}`,
                    borderRadius: 12,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    background: f.paiement === opt.v ? "#f0f9ff" : "#fff",
                    color: "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="radio"
                    name="paiement"
                    checked={f.paiement === opt.v}
                    onChange={() => set("paiement", opt.v)}
                    style={{ accentColor: "#0ea5e9", display: "none" }}
                  />
                  {opt.l}
                </label>
              ))}
            </div>

            {/* ── Mode de réservation ── */}
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
              {(["form", "email", "whatsapp", "sms"] as const).map((m) => (
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
                    fontSize: "clamp(11px,2.8vw,13px)",
                  }}
                >
                  {m === "form"
                    ? "📝 Formulaire"
                    : m === "email"
                      ? "✉️ Email"
                      : m === "whatsapp"
                        ? "💬 WhatsApp"
                        : "💬 SMS"}
                </button>
              ))}
            </div>

            {/* Bandeau d'erreur */}
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

            {/* ── Bouton d'envoi ── */}
            <div className="sticky-submit-bar">
              {mode === "form" && (
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
                  href={`mailto:taxi.city033@gmail.com?subject=Réservation taxi&body=${buildEmailText()}`}
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

              {mode === "sms" && (
                <a
                  href={`sms:0673072322?body=${buildWhatsAppText()}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 56,
                    background: "#6366f1",
                    color: "#fff",
                    borderRadius: 14,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    textDecoration: "none",
                    fontSize: "clamp(14px,4vw,16px)",
                  }}
                >
                  💬 Envoyer par SMS
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
