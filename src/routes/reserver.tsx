import { createFileRoute } from "@tanstack/react-router";
import { calculerPrixMixte, TARIFS } from "@/lib/tarif";
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
// Types
// ─────────────────────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface GeoPoint {
  lat: number;
  lon: number;
  label: string; // adresse courte choisie
}

// ─────────────────────────────────────────────────────────────
// Hook Nominatim — autocomplétion
// ─────────────────────────────────────────────────────────────
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
        url.searchParams.set("limit", "8");
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
// Calcul distance via OSRM (gratuit, pas de clé API)
// ─────────────────────────────────────────────────────────────
async function calcDistanceOSRM(a: GeoPoint, b: GeoPoint): Promise<{ km: number; dureMin: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.routes?.[0]) {
      const km = Math.round((data.routes[0].distance / 1000) * 10) / 10;
      const dureMin = Math.round(data.routes[0].duration / 60);
      return { km, dureMin };
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Composant champ adresse avec autocomplétion et coordonnées
// ─────────────────────────────────────────────────────────────
interface AddressInputProps {
  label: string;
  icon: string;
  value: string;
  onSelect: (label: string, geo: GeoPoint) => void;
  onChange: (v: string) => void;
  error?: string;
  placeholder: string;
}

function AddressInput({ label, icon, value, onSelect, onChange, error, placeholder }: AddressInputProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { results, loading } = useNominatim(query);

  // fermer dropdown si clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // sync externe → input
  useEffect(() => {
    if (value !== query && value === "") {
      setQuery("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (v: string) => {
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  const handleSelect = (r: NominatimResult) => {
    const short = r.display_name.split(",").slice(0, 3).join(", ");
    setQuery(short);
    if (inputRef.current) inputRef.current.value = short;
    onSelect(short, { lat: Number(r.lat), lon: Number(r.lon), label: short });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
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
        {icon} {label}
      </div>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          defaultValue={value}
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
            background: "#fff",
            color: "#0f172a",
            WebkitAppearance: "none",
          }}
        />
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
          {loading ? "⏳" : "🔍"}
        </span>
      </div>
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}

      {open && results.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 200,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 0,
            margin: 0,
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
// Input simple
// ─────────────────────────────────────────────────────────────
interface InputProps {
  k: string;
  value: any;
  onChange: (k: string, v: any) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  min?: string | number;
}
function Input({ k, value, onChange, type = "text", placeholder, error, min }: InputProps) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(k, type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        min={min}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${error ? "#ef4444" : "#e2e8f0"}`,
          fontSize: 16,
          fontFamily: "'DM Sans',sans-serif",
          boxSizing: "border-box",
          background: "#fff",
          color: "#0f172a",
          colorScheme: "light",
          WebkitAppearance: "none",
        }}
      />
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

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
        background: "#fff",
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
// Helpers heure
// ─────────────────────────────────────────────────────────────
function isNuitHeure(h: number): boolean {
  return h >= 19 || h < 7;
}

function heureArrivee(pickupIso: string, dureMin: number): string {
  const d = new Date(new Date(pickupIso).getTime() + dureMin * 60_000);
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
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
    paiement: "especes",
    trajet: "aller" as "aller" | "aller-retour",
  });

  // Coordonnées GPS des adresses choisies
  const [geoDepart, setGeoDepart] = useState<GeoPoint | null>(null);
  const [geoDest, setGeoDest] = useState<GeoPoint | null>(null);

  // Calcul trajet
  const [distKm, setDistKm] = useState<number | null>(null);
  const [dureMin, setDureMin] = useState<number | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const [mode, setMode] = useState<"form" | "email" | "whatsapp" | "sms">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Analytics ──
  useEffect(() => {
    const sid = typeof window !== "undefined" && (sessionStorage.getItem("sid") || Math.random().toString(36).slice(2));
    if (sid && typeof window !== "undefined") sessionStorage.setItem("sid", sid as string);
    supabase.from("site_analytics").insert({ event: "visit", session_id: sid || null });
  }, []);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  // ── Calculer la distance dès que les 2 adresses sont choisies ──
  useEffect(() => {
    if (!geoDepart || !geoDest) {
      setDistKm(null);
      setDureMin(null);
      return;
    }
    let cancelled = false;
    setCalcLoading(true);
    calcDistanceOSRM(geoDepart, geoDest).then((r) => {
      if (cancelled) return;
      setDistKm(r?.km ?? null);
      setDureMin(r?.dureMin ?? null);
      setCalcLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [geoDepart, geoDest]);

  // ── Tarif ──
  const pickupIso = f.date && f.heure ? `${f.date}T${f.heure}:00` : null;
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : null;

  // Détection chevauchement
  const nuitDepart = heureNum !== null ? isNuitHeure(heureNum) : false;
  const jourDepart = heureNum !== null ? !isNuitHeure(heureNum) : true;

  // Prix mixte si date+heure+km disponibles, sinon prix simple
  let prixEstime: number | null = null;
  let isMixte = false;
  if (distKm && pickupIso) {
    prixEstime = calculerPrixMixte(distKm, pickupIso);
    // Détection chevauchement : la durée fait-elle passer sur l'autre tarif ?
    if (dureMin && heureNum !== null) {
      const heureFinNum = heureNum + dureMin / 60;
      isMixte = (jourDepart && heureFinNum >= 19) || (nuitDepart && heureFinNum >= 7 && heureNum < 7);
    }
  } else if (distKm && heureNum !== null) {
    prixEstime =
      distKm > 0 ? TARIFS.PRISE_EN_CHARGE + distKm * (jourDepart ? TARIFS.TARIF_JOUR : TARIFS.TARIF_NUIT) : null;
    if (prixEstime) prixEstime = Math.round(prixEstime * 100) / 100;
  }

  // Heure d'arrivée estimée
  const arriveeStr = pickupIso && dureMin ? heureArrivee(pickupIso, dureMin) : null;

  // ── Validation ──
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

  const buildMsgText = () =>
    `Bonjour, je m'appelle ${f.prenom || "…"}, je souhaite réserver un taxi.\n\n` +
    `Trajet : ${trajetLabel(f.trajet)}\n` +
    `Départ : ${f.depart || "À préciser"}\n` +
    `Destination : ${f.destination || "À préciser"}\n` +
    `Date : ${f.date} à ${f.heure || "—"}\n` +
    (arriveeStr ? `Arrivée estimée : ${arriveeStr}\n` : "") +
    (distKm ? `Distance : ~${distKm} km\n` : "") +
    (prixEstime ? `Prix estimé : ${prixEstime.toFixed(2)} €\n` : "") +
    `Passagers : ${f.passagers} | Bagages : ${f.bagages}\n` +
    `Paiement : ${f.paiement === "especes" ? "Espèces" : "CB"}`;

  const buildEmailBody = () => buildMsgText().split("\n").map(encodeURIComponent).join("%0A");

  // ── Submit ──
  const submitForm = async () => {
    if (!validate()) return;
    setSending(true);
    setSubmitError("");
    try {
      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickup = new Date(`${f.date}T${f.heure || "12:00"}:00`).toISOString();
      const pickupMs = new Date(pickup).getTime();

      // Conflit créneau
      const { data: conflicts } = await supabase
        .from("reservations")
        .select("id")
        .gte("pickup_datetime", new Date(pickupMs - 30 * 60_000).toISOString())
        .lte("pickup_datetime", new Date(pickupMs + 30 * 60_000).toISOString())
        .not("status", "in", "(annulee,refusee,terminee)")
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        setErrors((p) => ({ ...p, heure: "Ce créneau est déjà réservé. Choisissez un autre horaire (±30 min)." }));
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
        distance_km: distKm ?? null,
        date_course: f.date,
        heure_course: f.heure,
        nb_passagers: f.passagers,
        tarif_jour: jourDepart,
        prix_estime: prixEstime ?? null,
        status: "pending",
        source: "form",
        paiement: f.paiement,
        message: `Trajet: ${trajetLabel(f.trajet)}${arriveeStr ? ` | Arrivée estimée: ${arriveeStr}` : ""}`,
      });

      if (insertError) throw new Error(insertError.message);

      // Email de confirmation (non bloquant)
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (token && f.email) {
          await fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
                prix_estime: prixEstime ? `${prixEstime.toFixed(2)} €` : "À confirmer",
                distance_km: distKm ?? null,
                arrivee_estimee: arriveeStr ?? null,
                tarif: isMixte
                  ? `Mixte (départ ${nuitDepart ? "nuit" : "jour"} → arrivée ${!nuitDepart ? "nuit" : "jour"})`
                  : jourDepart
                    ? "Jour (7h–19h) — 2,16 €/km"
                    : "Nuit (19h–7h) — 3,24 €/km",
              },
            }),
          });
        }
      } catch {
        /* non bloquant */
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

  // ── Options ──
  const passagerOptions = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    value: n,
    label: `${n} passager${n > 1 ? "s" : ""}`,
  }));
  const bagagesOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    value: n,
    label: n === 0 ? "0 bagage" : `${n} bagage${n > 1 ? "s" : ""}`,
  }));

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
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
        .resa-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .resa-grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; }
        .resa-mode-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; }
        .tarif-row { display:flex; gap:12px; }
        @media (max-width:480px) {
          .resa-grid-2 { grid-template-columns:1fr; }
          .resa-grid-4 { grid-template-columns:1fr 1fr; }
          .resa-mode-grid { grid-template-columns:1fr 1fr; }
          .tarif-row { flex-direction:column; }
        }
        @keyframes resaSpin { to { transform:rotate(360deg); } }
        .resa-spinner { display:inline-block; width:18px; height:18px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:resaSpin 0.7s linear infinite; vertical-align:middle; margin-right:8px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .resa-pulse { animation:pulse 1.2s ease-in-out infinite; }
        .sticky-submit-bar { position:sticky; bottom:0; padding-top:12px; background:#fff; z-index:10; }
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>
              Votre demande a été envoyée !
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              Vous serez contacté sous 15 min. Un email de confirmation a été envoyé à {f.email}.
            </div>
            {prixEstime && (
              <div style={{ marginTop: 14, fontSize: 16, fontWeight: 700, color: "#059669" }}>
                Prix estimé : <span style={{ color: "#ef4444", fontSize: 22 }}>{prixEstime.toFixed(2)} €</span>
              </div>
            )}
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
              <AddressInput
                label="Adresse de départ"
                icon="🟢"
                value={f.depart}
                placeholder="Ex : 12 rue Sainte-Catherine, Bordeaux"
                error={errors.depart}
                onChange={(v) => {
                  set("depart", v);
                  setGeoDepart(null);
                }}
                onSelect={(label, geo) => {
                  set("depart", label);
                  setGeoDepart(geo);
                }}
              />
              <AddressInput
                label="Adresse d'arrivée"
                icon="🏁"
                value={f.destination}
                placeholder="Ex : Aéroport de Bordeaux-Mérignac"
                error={errors.destination}
                onChange={(v) => {
                  set("destination", v);
                  setGeoDest(null);
                }}
                onSelect={(label, geo) => {
                  set("destination", label);
                  setGeoDest(geo);
                }}
              />

              {/* Type trajet */}
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
                  Type de trajet
                </div>
                <div className="tarif-row">
                  {(
                    [
                      { v: "aller", l: "➡️ Aller simple" },
                      { v: "aller-retour", l: "🔁 Aller-retour" },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.v}
                      style={{
                        flex: 1,
                        padding: 12,
                        border: `2px solid ${f.trajet === opt.v ? "#0ea5e9" : "#e2e8f0"}`,
                        borderRadius: 12,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                        background: f.trajet === opt.v ? "#f0f9ff" : "#fff",
                        color: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <input
                        type="radio"
                        name="trajet"
                        checked={f.trajet === opt.v}
                        onChange={() => set("trajet", opt.v)}
                        style={{ display: "none" }}
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>

              {/* Date / heure / passagers / bagages */}
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
                    Heure de prise en charge
                  </div>
                  <Input k="heure" value={f.heure} onChange={set} type="time" error={errors.heure} />
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

            {/* ══════════════════════════
                BLOC TARIF DYNAMIQUE
            ══════════════════════════ */}
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

            {/* Aucun champ rempli → invitation */}
            {!geoDepart && !geoDest && !f.heure && (
              <div
                style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  color: "#64748b",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                Saisissez vos adresses et l'heure de prise en charge pour obtenir un prix estimé.
              </div>
            )}

            {/* Calcul en cours */}
            {calcLoading && (
              <div
                className="resa-pulse"
                style={{
                  padding: "14px 16px",
                  background: "rgba(14,165,233,0.06)",
                  border: "1px solid rgba(14,165,233,0.2)",
                  borderRadius: 12,
                  fontSize: 14,
                  color: "#0ea5e9",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>📡</span> Calcul de la distance en cours…
              </div>
            )}

            {/* Résultat */}
            {!calcLoading && (geoDepart || geoDest || f.heure) && (
              <div
                style={{
                  padding: "16px",
                  background: prixEstime ? "rgba(239,68,68,0.04)" : "rgba(14,165,233,0.05)",
                  border: `1px solid ${prixEstime ? "rgba(239,68,68,0.2)" : "rgba(14,165,233,0.2)"}`,
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Ligne tarif horaire */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  {heureNum === null ? (
                    <>
                      <span>⏰</span>
                      <span style={{ color: "#64748b" }}>Indiquez l'heure pour connaître le tarif applicable</span>
                    </>
                  ) : isMixte ? (
                    <>
                      <span>🌓</span>
                      <span>
                        <strong>Tarif mixte</strong> — départ{" "}
                        <span style={{ color: nuitDepart ? "#818cf8" : "#f59e0b", fontWeight: 700 }}>
                          {nuitDepart ? "🌙 nuit (3,24 €/km)" : "☀️ jour (2,16 €/km)"}
                        </span>{" "}
                        puis passage en{" "}
                        <span style={{ color: !nuitDepart ? "#818cf8" : "#f59e0b", fontWeight: 700 }}>
                          {!nuitDepart ? "🌙 nuit" : "☀️ jour"}
                        </span>
                      </span>
                    </>
                  ) : nuitDepart ? (
                    <>
                      <span>🌙</span>
                      <span>
                        <strong>Tarif nuit</strong> (19h–7h) —{" "}
                        <span style={{ color: "#818cf8", fontWeight: 700 }}>3,24 €/km</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>☀️</span>
                      <span>
                        <strong>Tarif jour</strong> (7h–19h) —{" "}
                        <span style={{ color: "#f59e0b", fontWeight: 700 }}>2,16 €/km</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Distance */}
                {distKm !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151" }}>
                    <span>🗺️</span>
                    <span>
                      Distance : <strong>{distKm} km</strong>
                    </span>
                  </div>
                )}

                {/* Heure d'arrivée */}
                {arriveeStr && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151" }}>
                    <span>🏁</span>
                    <span>
                      Arrivée estimée : <strong>{arriveeStr}</strong>
                      {dureMin ? ` (${dureMin} min de trajet)` : ""}
                    </span>
                  </div>
                )}

                {/* Prix EN ROUGE */}
                {prixEstime !== null ? (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>
                      Prix estimé (prise en charge {TARIFS.PRISE_EN_CHARGE} € incluse) :
                    </span>
                    <span
                      style={{
                        fontSize: 30,
                        fontFamily: "'Syne',sans-serif",
                        fontWeight: 800,
                        color: "#ef4444",
                        lineHeight: 1,
                      }}
                    >
                      {prixEstime.toFixed(2)} €
                    </span>
                  </div>
                ) : !calcLoading && geoDepart && geoDest ? (
                  <div style={{ fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
                    ⚠️ Impossible de calculer la distance pour ces adresses.
                  </div>
                ) : !geoDepart || !geoDest ? (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    {!geoDepart && !geoDest
                      ? "Sélectionnez départ et arrivée dans les suggestions pour obtenir un prix."
                      : !geoDepart
                        ? "Sélectionnez l'adresse de départ dans les suggestions."
                        : "Sélectionnez l'adresse d'arrivée dans les suggestions."}
                  </div>
                ) : null}

                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  * Prix indicatif selon les tarifs officiels homologués préfecture — tarif final sur compteur.
                </div>
              </div>
            )}

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
                    style={{ display: "none" }}
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

            {/* Erreur */}
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

            {/* ── Bouton envoi ── */}
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
                  href={`mailto:taxi.city033@gmail.com?subject=Réservation taxi&body=${buildEmailBody()}`}
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
                  href={`https://wa.me/33673072322?text=${encodeURIComponent(buildMsgText())}`}
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
                  href={`sms:0673072322?body=${encodeURIComponent(buildMsgText())}`}
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
