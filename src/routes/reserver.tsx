import { createFileRoute } from "@tanstack/react-router";
import { calculerPrixMixte } from "@/lib/tarif";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nProvider";

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
  const { t, lang } = useI18n();
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

  // Calcul automatique du tarif selon l'heure de départ
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : 12;
  const tarifJourAuto = heureNum >= 7 && heureNum < 19;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.prenom) e.prenom = t("res.err.required");
    if (!f.nom) e.nom = t("res.err.required");
    if (!f.phone) e.phone = t("res.err.required");
    if (!f.email) e.email = t("res.err.required");
    if (!f.depart) e.depart = t("res.err.required");
    if (!f.destination) e.destination = t("res.err.required");
    if (!f.date) e.date = t("res.err.required");
    if (!f.heure) e.heure = t("res.err.required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const trajetLabel = (v: string) =>
    v === "aller-retour" ? t("res.loc.roundtrip") : t("res.loc.oneway");

  const buildWhatsAppText = () => {
    const greeting = f.prenom ? `${t("res.wa.hello")} ${f.prenom}` : t("res.wa.hello_anon");
    return encodeURIComponent(
      `${greeting}, ${t("res.wa.body")}\n\n` +
        `${t("res.loc.trip")} : ${trajetLabel(f.trajet)}\n` +
        `${t("res.loc.from")} : ${f.depart || t("res.loc.tbd")}\n` +
        `${t("res.loc.to")} : ${f.destination || t("res.loc.tbd")}\n` +
        `${t("res.loc.date")} : ${f.date} ${f.heure}\n` +
        `${t("res.loc.pax")} : ${f.passagers}\n` +
        `${t("res.loc.bags")} : ${f.bagages}\n` +
        `${t("res.loc.rate")} : ${tarifJourAuto ? t("res.loc.day") : t("res.loc.night")}`,
    );
  };

  const buildEmailText = () =>
    `${t("res.loc.email_subject")}%0A%0A${t("res.loc.client")}: ${f.prenom} ${f.nom}%0A${t("res.loc.phone")}: ${f.phone}%0AEmail: ${f.email}%0A%0A${t("res.loc.trip")}: ${trajetLabel(f.trajet)}%0A${t("res.loc.from")}: ${f.depart}%0A${t("res.loc.to")}: ${f.destination}%0A${t("res.loc.date")}: ${f.date} ${f.heure}%0A${t("res.loc.pax")}: ${f.passagers}%0A${t("res.loc.bags")}: ${f.bagages}%0A${t("res.loc.rate")}: ${tarifJourAuto ? t("res.loc.day") : t("res.loc.night")}`;

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
          heure: t("res.err.slot_taken"),
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
        tarif_jour: tarifJourAuto,
        prix_estime: null,
        status: "pending",
        source: "form",
        paiement: f.paiement,
        message: `Trajet: ${trajetLabel(f.trajet)}`,
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
                tarif: tarifJourAuto ? t("res.loc.day_full") : t("res.loc.night_full"),
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
      setSubmitError(err?.message || t("res.err.global"));
    } finally {
      setSending(false);
    }
  };

  const passagerOptions = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    value: n,
    label: `${n} ${n > 1 ? t("res.loc.passengers_pl") : t("res.loc.passenger_sg")}`,
  }));

  const bagagesOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
    value: n,
    label: n === 0 ? `0 ${t("res.loc.luggage_sg")}` : `${n} ${n > 1 ? t("res.loc.luggage_pl") : t("res.loc.luggage_sg")}`,
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
          {t("res.title")}
        </h1>
        <p style={{ color: "#64748b", marginTop: 6, fontSize: "clamp(13px,3.5vw,15px)" }}>
          {t("res.loc.subtitle")}
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
              {t("res.loc.success_title")}
            </div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              {t("res.loc.success_desc").replace("{email}", f.email)}
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
              {t("res.loc.contact_section")}
            </h3>
            <div className="resa-grid-2">
              <Input k="prenom" value={f.prenom} onChange={set} placeholder={t("res.loc.firstname")} error={errors.prenom} />
              <Input k="nom" value={f.nom} onChange={set} placeholder={t("res.loc.lastname")} error={errors.nom} />
              <Input k="phone" value={f.phone} onChange={set} type="tel" placeholder={t("res.loc.phone")} error={errors.phone} />
              <Input k="email" value={f.email} onChange={set} type="email" placeholder={t("res.loc.email")} error={errors.email} />
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
              {t("res.loc.ride_section")}
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
                  🟢 {t("res.loc.depart_label")}
                </div>
                <AddressInput
                  fieldKey="depart"
                  value={f.depart}
                  onChange={set}
                  placeholder={t("res.f.from.ph")}
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
                  🏁 {t("res.loc.dest_label")}
                </div>
                <AddressInput
                  fieldKey="destination"
                  value={f.destination}
                  onChange={set}
                  placeholder={t("res.f.to.ph")}
                  error={errors.destination}
                />
              </div>

              {/* ── Type de trajet ── */}
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
                  {t("res.f.trip")}
                </div>
                <div className="tarif-row">
                  {([
                    { v: "aller", l: `➡️ ${t("res.f.trip.one")}` },
                    { v: "aller-retour", l: `🔁 ${t("res.f.trip.round")}` },
                  ] as const).map((opt) => (
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
                  {t("res.loc.date_label")}
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
                  {t("res.loc.time_label")}
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
                  {t("res.f.passengers")}
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
                  {t("res.f.luggage")}
                  </div>
                  <SelectField value={f.bagages} onChange={(v) => set("bagages", v)} options={bagagesOptions} />
                </div>
              </div>
            </div>

            {/* ── Tarif ── */}
                          {t("res.loc.rate_section")}
            </h3>
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(14,165,233,0.08)",
                border: "1px solid rgba(14,165,233,0.2)",
                borderRadius: 12,
                fontSize: 14,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {tarifJourAuto ? (
                <><span>☀️</span><span><strong>{t("res.loc.day_rate")}</strong> (7h–19h) — 2,16 €/km</span></>
              ) : (
                <><span>🌙</span><span><strong>{t("res.loc.night_rate")}</strong> (19h–7h) — 3,24 €/km</span></>
              )}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
                {t("res.loc.auto_calc")}
              </span>
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
              {t("res.loc.payment_section")}
            </h3>
            <div className="resa-grid-4">
              {[
                { v: "especes", l: `💶 ${t("res.loc.cash")}` },
                { v: "cb", l: `💳 ${t("res.loc.card")}` },
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
              {t("res.loc.mode_section")}
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
                    ? `📝 ${t("res.loc.mode_form")}`
                    : m === "email"
                      ? `✉️ ${t("res.loc.mode_email")}`
                      : m === "whatsapp"
                        ? `💬 WhatsApp`
                        : `💬 SMS`}
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
                  🔄 {t("res.loc.retry")}
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
                      {t("res.sending")}
                    </>
                  ) : (
                    `📨 ${t("res.send")}`
                  )}
                </button>
              )}

              {mode === "email" && (
                <a
                  href={`mailto:taxi.city033@gmail.com?subject=${t("res.loc.email_subject")}&body=${buildEmailText()}`}
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
                  ✉️ {t("res.loc.send_email")}
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
                  💬 {t("res.loc.send_wa")}
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
                  💬 {t("res.loc.send_sms")}
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}