import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
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

// ─── Tarifs officiels ─────────────────────────────────────────
const PRISE_EN_CHARGE = 2.83;
const TARIF_JOUR = 2.16; // 7h–19h
const TARIF_NUIT = 3.24; // 19h–7h
// Lire la clé au moment de l'appel (pas au chargement du module)
const getOrsKey = () => import.meta.env.VITE_ORS_API_KEY ?? "";

// ─── Calcul mixte jour/nuit ───────────────────────────────────
function calculerPrixMixte(departMs: number, dureeS: number, distanceKm: number): number {
  if (dureeS <= 0 || distanceKm <= 0) return PRISE_EN_CHARGE;
  const arriveeMs = departMs + dureeS * 1000;
  const STEP = 60_000;
  let prixKm = 0;
  let t = departMs;
  while (t < arriveeMs) {
    const fin = Math.min(t + STEP, arriveeMs);
    const fraction = (fin - t) / (arriveeMs - departMs);
    const kmTranche = distanceKm * fraction;
    const heure = new Date(t).getHours();
    const tarif = heure >= 7 && heure < 19 ? TARIF_JOUR : TARIF_NUIT;
    prixKm += kmTranche * tarif;
    t = fin;
  }
  return Math.round((PRISE_EN_CHARGE + prixKm) * 100) / 100;
}

// ─── Géocodage via Photon — priorité house > street > city ────
async function geocodeAdresse(query: string): Promise<[number, number] | null> {
  if (query.length < 3) return null;
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lang", "fr");
    url.searchParams.set("lat", "44.8378");
    url.searchParams.set("lon", "-0.5792");
    const res = await fetch(url.toString());
    const data = await res.json();
    const features = data.features ?? [];
    if (!features.length) return null;
    const PRIORITY = ["house", "street", "locality", "district", "city", "county", "state"];
    const sorted = [...features].sort((a, b) => {
      const ia = PRIORITY.indexOf(a.properties?.osm_value ?? "");
      const ib = PRIORITY.indexOf(b.properties?.osm_value ?? "");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const feat = sorted[0];
    return [feat.geometry.coordinates[0], feat.geometry.coordinates[1]];
  } catch {
    return null;
  }
}

// ─── Distance + durée via ORS ─────────────────────────────────
interface OrsResult {
  distanceKm: number;
  dureeS: number;
}

async function getOrsRoute(from: [number, number], to: [number, number]): Promise<OrsResult | null> {
  const ORS_KEY = getOrsKey();
  if (!ORS_KEY) return null;
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ORS_KEY}` },
      body: JSON.stringify({
        coordinates: [from, to],
        radiuses: [-1, -1],
      }),
    });
    const data = await res.json();
    if (data?.error) {
      console.warn("[ORS] Erreur API:", data.error.code, data.error.message);
      return null;
    }
    const summary = data?.routes?.[0]?.summary;
    if (!summary) {
      console.warn("[ORS] Pas de route:", JSON.stringify(data));
      return null;
    }
    return {
      distanceKm: Math.round((summary.distance / 1000) * 10) / 10,
      dureeS: Math.round(summary.duration),
    };
  } catch (e) {
    console.error("[ORS] Erreur:", e);
    return null;
  }
}

// ─── Composants UI ────────────────────────────────────────────
function sectionLabel(text: string) {
  return (
    <h3
      style={{
        fontFamily: "'Syne',sans-serif",
        marginTop: 24,
        marginBottom: 12,
        color: "#0f172a",
        fontSize: "clamp(14px,4vw,16px)",
      }}
    >
      {text}
    </h3>
  );
}

function fieldLabel(text: string) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#64748b",
        marginBottom: 4,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
      }}
    >
      {text}
    </div>
  );
}

interface InputProps {
  k: string;
  value: any;
  onChange: (k: string, v: any) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  min?: string | number;
  onBlur?: () => void;
}
function Input({ k, value, onChange, type = "text", placeholder, error, min, onBlur }: InputProps) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(k, type === "number" ? Number(e.target.value) : e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        min={min}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${error ? "#ef4444" : "#e2e8f0"}`,
          fontSize: 16,
          fontFamily: "'DM Sans',sans-serif",
          boxSizing: "border-box" as const,
          background: "#ffffff",
          color: "#0f172a",
          colorScheme: "light" as any,
          WebkitAppearance: "none" as any,
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
        boxSizing: "border-box" as const,
        background: "#ffffff",
        color: "#0f172a",
        WebkitAppearance: "none" as any,
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

// ─── Composant principal ──────────────────────────────────────
function ReservationPage() {
  const { t, lang } = useI18n();

  // FIX #418 — new Date() au render diverge entre SSR et client.
  // On initialise à "" et on fixe côté client dans un useEffect.
  const [today, setToday] = useState("");

  const [f, setF] = useState({
    prenom: "",
    nom: "",
    phone: "",
    email: "",
    depart: "",
    destination: "",
    date: "",
    heure: "",
    passagers: 1,
    bagages: 0,
    paiement: "especes",
    trajet: "aller" as "aller" | "aller-retour",
  });

  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [geocodingDepart, setGeocodingDepart] = useState(false);
  const [geocodingDest, setGeocodingDest] = useState(false);

  const [orsResult, setOrsResult] = useState<OrsResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const [mode, setMode] = useState<"form" | "email" | "whatsapp" | "sms">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Fixe la date côté client uniquement (après hydratation)
  useEffect(() => {
    const d = new Date().toISOString().split("T")[0];
    setToday(d);
    setF((p) => ({ ...p, date: p.date || d }));
  }, []);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  // ── Géocodage : debounce 900ms sur frappe + blur en filet de sécurité ──
  const departTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerGeoDepart = useCallback(async (val: string) => {
    if (!val || val.length < 3) return;
    setGeocodingDepart(true);
    const coord = await geocodeAdresse(val);
    setFromCoord(coord);
    setGeocodingDepart(false);
  }, []);

  const triggerGeoDest = useCallback(async (val: string) => {
    if (!val || val.length < 3) return;
    setGeocodingDest(true);
    const coord = await geocodeAdresse(val);
    setToCoord(coord);
    setGeocodingDest(false);
  }, []);

  const handleDepartChange = useCallback(
    (val: string) => {
      set("depart", val);
      setFromCoord(null);
      setOrsResult(null);
      if (departTimerRef.current) clearTimeout(departTimerRef.current);
      departTimerRef.current = setTimeout(() => triggerGeoDepart(val), 900);
    },
    [triggerGeoDepart],
  );

  const handleDestChange = useCallback(
    (val: string) => {
      set("destination", val);
      setToCoord(null);
      setOrsResult(null);
      if (destTimerRef.current) clearTimeout(destTimerRef.current);
      destTimerRef.current = setTimeout(() => triggerGeoDest(val), 900);
    },
    [triggerGeoDest],
  );

  const handleDepartBlur = useCallback(() => {
    triggerGeoDepart(f.depart);
  }, [f.depart, triggerGeoDepart]);
  const handleDestBlur = useCallback(() => {
    triggerGeoDest(f.destination);
  }, [f.destination, triggerGeoDest]);

  // Lance ORS dès que les deux coords sont prêtes
  useEffect(() => {
    if (!fromCoord || !toCoord) {
      setOrsResult(null);
      return;
    }
    setCalcLoading(true);
    getOrsRoute(fromCoord, toCoord).then((r) => {
      setOrsResult(r);
      setCalcLoading(false);
    });
  }, [fromCoord, toCoord]);

  // Calcul mixte
  const departMs = f.date && f.heure ? new Date(`${f.date}T${f.heure}:00`).getTime() : null;
  const heureNum = f.heure ? parseInt(f.heure.split(":")[0], 10) : 12;
  const tarifJourAuto = heureNum >= 7 && heureNum < 19;

  const prix =
    orsResult && departMs
      ? calculerPrixMixte(departMs, orsResult.dureeS, orsResult.distanceKm)
      : orsResult
        ? Math.round((PRISE_EN_CHARGE + orsResult.distanceKm * (tarifJourAuto ? TARIF_JOUR : TARIF_NUIT)) * 100) / 100
        : PRISE_EN_CHARGE;

  const partJourNuit =
    orsResult && departMs
      ? (() => {
          const arriveeMs = departMs + orsResult.dureeS * 1000;
          let msJour = 0;
          const STEP = 60_000;
          let t = departMs;
          while (t < arriveeMs) {
            const fin = Math.min(t + STEP, arriveeMs);
            const h = new Date(t).getHours();
            if (h >= 7 && h < 19) msJour += fin - t;
            t = fin;
          }
          const pctJour = Math.round((msJour / (arriveeMs - departMs)) * 100);
          return pctJour > 0 && pctJour < 100 ? { jour: pctJour, nuit: 100 - pctJour } : null;
        })()
      : null;

  useEffect(() => {
    const sid = typeof window !== "undefined" && (sessionStorage.getItem("sid") || Math.random().toString(36).slice(2));
    if (sid && typeof window !== "undefined") sessionStorage.setItem("sid", sid as string);
    supabase.from("site_analytics").insert({ event: "visit", session_id: sid || null });
  }, []);

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

  const trajetLabel = (v: string) => (v === "aller-retour" ? t("res.loc.roundtrip") : t("res.loc.oneway"));

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
        `${t("res.loc.rate")} : ${tarifJourAuto ? t("res.loc.day") : t("res.loc.night")}\n` +
        `Prix estimé : ${prix.toFixed(2)} €`,
    );
  };

  const buildEmailText = () =>
    `${t("res.loc.email_subject")}%0A%0A${t("res.loc.client")}: ${f.prenom} ${f.nom}%0A${t("res.loc.phone")}: ${f.phone}%0AEmail: ${f.email}%0A%0A${t("res.loc.trip")}: ${trajetLabel(f.trajet)}%0A${t("res.loc.from")}: ${f.depart}%0A${t("res.loc.to")}: ${f.destination}%0A${t("res.loc.date")}: ${f.date} ${f.heure}%0A${t("res.loc.pax")}: ${f.passagers}%0A${t("res.loc.bags")}: ${f.bagages}%0APrix estimé: ${prix.toFixed(2)} €`;

  const submitForm = async () => {
    if (!validate()) return;
    setSending(true);
    setSubmitError("");
    try {
      const fullName = `${f.prenom} ${f.nom}`.trim();
      const pickup = new Date(`${f.date}T${f.heure || "12:00"}:00`).toISOString();
      const pickupMs = new Date(pickup).getTime();

      const { data: conflicts } = await supabase
        .from("reservations")
        .select("id")
        .gte("pickup_datetime", new Date(pickupMs - 30 * 60_000).toISOString())
        .lte("pickup_datetime", new Date(pickupMs + 30 * 60_000).toISOString())
        .not("status", "in", "(annulee,refusee,terminee)")
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        setErrors((prev) => ({ ...prev, heure: t("res.err.slot_taken") }));
        setSending(false);
        return;
      }

      const { error: insertError } = await supabase.from("reservations").insert({
        nom: fullName,
        telephone: f.phone,
        email: f.email,
        depart: f.depart,
        arrivee: f.destination,
        destination: f.destination,
        pickup_datetime: pickup,
        passagers: f.passagers,
        bagages: f.bagages,
        client_name: fullName,
        client_phone: f.phone,
        client_email: f.email,
        distance_km: orsResult?.distanceKm ?? null,
        date_course: f.date,
        heure_course: f.heure,
        nb_passagers: f.passagers,
        tarif_jour: tarifJourAuto,
        prix_estime: orsResult ? prix : null,
        status: "pending",
        source: "form",
        paiement: f.paiement,
        message: `Trajet: ${trajetLabel(f.trajet)}${orsResult ? ` | Distance: ${orsResult.distanceKm} km | Durée: ${Math.round(orsResult.dureeS / 60)} min` : ""}`,
      });

      if (insertError) throw new Error(insertError.message);

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
                bagages: f.bagages,
                prix_estime: orsResult ? prix : null,
                tarif: tarifJourAuto ? t("res.loc.day_full") : t("res.loc.night_full"),
              },
            }),
          });
        }
      } catch {
        /* email non-bloquant */
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
    label:
      n === 0 ? `0 ${t("res.loc.luggage_sg")}` : `${n} ${n > 1 ? t("res.loc.luggage_pl") : t("res.loc.luggage_sg")}`,
  }));

  return (
    <div
      suppressHydrationWarning
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "clamp(16px,5vw,40px) clamp(12px,4vw,16px)",
        fontFamily: "'DM Sans',sans-serif",
        color: "#0f172a",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .resa-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .resa-grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
        .resa-mode-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
        .tarif-row { display: flex; gap: 12px; }
        .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 480px) {
          .resa-grid-2 { grid-template-columns: 1fr; }
          .resa-grid-4 { grid-template-columns: 1fr 1fr; }
          .resa-mode-grid { grid-template-columns: 1fr 1fr; }
          .tarif-row { flex-direction: column; }
        }
        @keyframes resaSpin { to { transform: rotate(360deg); } }
        .resa-spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          border-radius: 50%; animation: resaSpin 0.7s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }
        .sticky-submit-bar { position: sticky; bottom: 0; padding-top: 12px; background: #fff; z-index: 10; }
        .addr-wrap { position: relative; }
        .addr-badge { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; }
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
        <p style={{ color: "#64748b", marginTop: 6, fontSize: "clamp(13px,3.5vw,15px)" }}>{t("res.loc.subtitle")}</p>

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
            <div style={{ marginTop: 6, fontSize: 14 }}>{t("res.loc.success_desc").replace("{email}", f.email)}</div>
          </div>
        ) : (
          <>
            {/* ── Coordonnées ── */}
            {sectionLabel(t("res.loc.contact_section"))}
            <div className="resa-grid-2">
              <div>
                {fieldLabel(t("res.loc.firstname"))}
                <Input
                  k="prenom"
                  value={f.prenom}
                  onChange={set}
                  placeholder={t("res.loc.firstname")}
                  error={errors.prenom}
                />
              </div>
              <div>
                {fieldLabel(t("res.loc.lastname"))}
                <Input k="nom" value={f.nom} onChange={set} placeholder={t("res.loc.lastname")} error={errors.nom} />
              </div>
              <div>
                {fieldLabel(t("res.loc.phone"))}
                <Input
                  k="phone"
                  value={f.phone}
                  onChange={set}
                  type="tel"
                  placeholder={t("res.loc.phone")}
                  error={errors.phone}
                />
              </div>
              <div>
                {fieldLabel("Email")}
                <Input
                  k="email"
                  value={f.email}
                  onChange={set}
                  type="email"
                  placeholder={t("res.loc.email")}
                  error={errors.email}
                />
              </div>
            </div>

            {/* ── Course ── */}
            {sectionLabel(t("res.loc.ride_section"))}
            <div style={{ display: "grid", gap: 12 }}>
              {/* Départ */}
              <div>
                {fieldLabel(`🟢 ${t("res.loc.depart_label")}`)}
                <div className="addr-wrap">
                  <input
                    type="text"
                    value={f.depart}
                    onChange={(e) => handleDepartChange(e.target.value)}
                    onBlur={handleDepartBlur}
                    placeholder={t("res.f.from.ph")}
                    style={{
                      width: "100%",
                      padding: "12px 40px 12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${errors.depart ? "#ef4444" : fromCoord ? "#22c55e" : "#e2e8f0"}`,
                      fontSize: 16,
                      fontFamily: "'DM Sans',sans-serif",
                      boxSizing: "border-box" as const,
                      background: "#fff",
                      color: "#0f172a",
                      WebkitAppearance: "none" as any,
                    }}
                  />
                  <span className="addr-badge">{geocodingDepart ? "⏳" : fromCoord ? "✅" : ""}</span>
                </div>
                {errors.depart && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.depart}</div>}
              </div>

              {/* Destination */}
              <div>
                {fieldLabel(`🏁 ${t("res.loc.dest_label")}`)}
                <div className="addr-wrap">
                  <input
                    type="text"
                    value={f.destination}
                    onChange={(e) => handleDestChange(e.target.value)}
                    onBlur={handleDestBlur}
                    placeholder={t("res.f.to.ph")}
                    style={{
                      width: "100%",
                      padding: "12px 40px 12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${errors.destination ? "#ef4444" : toCoord ? "#22c55e" : "#e2e8f0"}`,
                      fontSize: 16,
                      fontFamily: "'DM Sans',sans-serif",
                      boxSizing: "border-box" as const,
                      background: "#fff",
                      color: "#0f172a",
                      WebkitAppearance: "none" as any,
                    }}
                  />
                  <span className="addr-badge">{geocodingDest ? "⏳" : toCoord ? "✅" : ""}</span>
                </div>
                {errors.destination && (
                  <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.destination}</div>
                )}
              </div>

              {/* Type de trajet */}
              <div>
                {fieldLabel(t("res.f.trip"))}
                <div className="tarif-row">
                  {(
                    [
                      { v: "aller", l: `➡️ ${t("res.f.trip.one")}` },
                      { v: "aller-retour", l: `🔁 ${t("res.f.trip.round")}` },
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

              {/* Date, heure, passagers, bagages */}
              <div className="resa-grid-4">
                <div>
                  {fieldLabel(t("res.loc.date_label"))}
                  <Input k="date" value={f.date} onChange={set} type="date" min={today} error={errors.date} />
                </div>
                <div>
                  {fieldLabel(t("res.loc.time_label"))}
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
                  {fieldLabel(t("res.f.passengers"))}
                  <SelectField value={f.passagers} onChange={(v) => set("passagers", v)} options={passagerOptions} />
                </div>
                <div>
                  {fieldLabel(t("res.f.luggage"))}
                  <SelectField value={f.bagages} onChange={(v) => set("bagages", v)} options={bagagesOptions} />
                </div>
              </div>
            </div>

            {/* ── Moyen de paiement ── */}
            {sectionLabel(t("res.loc.payment_section"))}
            <div className="payment-grid">
              {[
                { v: "especes", l: `💵 ${t("res.loc.cash")}` },
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
                    style={{ display: "none" }}
                  />
                  {opt.l}
                </label>
              ))}
            </div>

            {/* ── Simulateur de prix ── */}
            {sectionLabel("Simulateur de prix")}
            <div style={{ padding: 20, background: "#f1f5f9", borderRadius: 16 }}>
              <div
                style={{
                  marginBottom: 10,
                  padding: "10px 14px",
                  background: "rgba(14,165,233,0.08)",
                  border: "1px solid rgba(14,165,233,0.2)",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {tarifJourAuto ? (
                  <>
                    <span>☀️</span>
                    <span>Tarif jour (7h–19h) — 2,16 €/km</span>
                  </>
                ) : (
                  <>
                    <span>🌙</span>
                    <span>Tarif nuit (19h–7h) — 3,24 €/km</span>
                  </>
                )}
                {partJourNuit && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
                    {partJourNuit.jour}% jour / {partJourNuit.nuit}% nuit
                  </span>
                )}
              </div>

              <div style={{ fontSize: 14, color: "#475569" }}>Prise en charge : {PRISE_EN_CHARGE} €</div>

              <div style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
                {calcLoading ? (
                  <span style={{ color: "#94a3b8" }}>⏳ Calcul de l'itinéraire…</span>
                ) : orsResult ? (
                  <span>
                    Distance : <strong style={{ color: "#0f172a" }}>{orsResult.distanceKm} km</strong>
                    {" — "}Durée estimée :{" "}
                    <strong style={{ color: "#0f172a" }}>{Math.round(orsResult.dureeS / 60)} min</strong>
                  </span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>
                    Saisissez le départ et la destination pour calculer automatiquement.
                  </span>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  TOTAL ESTIMÉ
                </div>
                <div
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontSize: "clamp(24px,6vw,32px)",
                    fontWeight: 700,
                    color: "#dc2626",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {prix.toFixed(2)} €
                </div>
                {partJourNuit && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    Tarif mixte — votre trajet déborde sur le tarif nuit
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginTop: 6 }}>
                * Des frais de réservation peuvent être appliqués
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Prix indicatif — le compteur fait foi</div>
            </div>

            {/* ── Mode de réservation ── */}
            {sectionLabel(t("res.loc.mode_section"))}
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
                  }}
                >
                  🔄 {t("res.loc.retry")}
                </button>
              </div>
            )}

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
