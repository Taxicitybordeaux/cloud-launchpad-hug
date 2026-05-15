import { useEffect, useRef, useMemo, useState, useCallback, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Phone, ArrowRight, Info, MapPin, Loader2, Navigation } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

// ─── Config tarifs ────────────────────────────────────────────
const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

const PICKUP_FEE = 2.83;
const RATE_DAY = 2.16; // 7h–19h
const RATE_NIGHT = 3.24; // 19h–7h

// Clé ORS gratuite (optionnelle) — https://openrouteservice.org/dev/#/signup
// Si absente, la distance est calculée à vol d'oiseau ×1.3
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY ?? "";

type Period = "day" | "night";

function formatEUR(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

// ─── Types ────────────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// ─── Hook : suggestions d'adresses via Nominatim (OpenStreetMap) ─
function useNominatim(query: string) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
        url.searchParams.set("limit", "5");
        url.searchParams.set("countrycodes", "fr");
        const res = await fetch(url.toString(), {
          headers: { "Accept-Language": "fr" },
        });
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

// ─── Champ adresse avec liste déroulante de suggestions ───────
interface AddressFieldProps {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: NominatimResult) => void;
}

function AddressField({ id, label, icon, value, onChange, onSelect }: AddressFieldProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { results, loading } = useNominatim(inputVal);

  useEffect(() => {
    setInputVal(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (v: string) => {
    setInputVal(v);
    onChange(v);
    setOpen(true);
  };

  const handleSelect = (r: NominatimResult) => {
    const short = r.display_name.split(",").slice(0, 3).join(", ");
    setInputVal(short);
    onChange(short);
    onSelect(r);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground mb-2">
        {label}
      </label>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-primary">{icon}</span>
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={inputVal}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Tapez une adresse…"
          className="w-full rounded-xl border border-border bg-background pl-9 pr-10 py-3 text-sm focus:border-primary focus:outline-none transition"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-background shadow-lg overflow-hidden">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(r)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/10 transition flex items-start gap-2"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="line-clamp-2 text-foreground/90">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Calcul de distance (haversine ×1.3 ou ORS routing) ───────
function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useDistance(from: [number, number] | null, to: [number, number] | null) {
  const [km, setKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to) {
      setKm(null);
      return;
    }

    if (!ORS_API_KEY) {
      // Fallback : vol d'oiseau + correction routière 1.3
      setKm(Math.round(haversineKm(from, to) * 1.3 * 10) / 10);
      return;
    }

    setLoading(true);
    fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({ coordinates: [from, to] }),
    })
      .then((r) => r.json())
      .then((data) => {
        const meters: number | undefined = data?.routes?.[0]?.summary?.distance;
        setKm(meters != null ? Math.round((meters / 1000) * 10) / 10 : null);
      })
      .catch(() => setKm(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  return { km, loading };
}

// ─── Composant principal ──────────────────────────────────────
export function FareSimulator() {
  const t = useT();

  const [period, setPeriod] = useState<Period>("day");
  const [fromAddr, setFromAddr] = useState("");
  const [toAddr, setToAddr] = useState("");
  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);

  const { km, loading: distLoading } = useDistance(fromCoord, toCoord);
  const rate = period === "day" ? RATE_DAY : RATE_NIGHT;

  const total = useMemo(() => (km != null ? PICKUP_FEE + km * rate : null), [km, rate]);

  const handleFromSelect = useCallback((r: NominatimResult) => {
    setFromCoord([parseFloat(r.lon), parseFloat(r.lat)]);
  }, []);

  const handleToSelect = useCallback((r: NominatimResult) => {
    setToCoord([parseFloat(r.lon), parseFloat(r.lat)]);
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("sim.eyebrow")}</p>
        <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("sim.title")}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("sim.intro")}</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] sm:p-8 md:grid-cols-2">
        {/* ── Inputs ── */}
        <div className="space-y-6">
          <AddressField
            id="sim-from"
            label={t("sim.departure") ?? "Adresse de départ"}
            icon={<Navigation className="h-4 w-4" />}
            value={fromAddr}
            onChange={(v) => {
              setFromAddr(v);
              if (!v) setFromCoord(null);
            }}
            onSelect={handleFromSelect}
          />

          <AddressField
            id="sim-to"
            label={t("sim.destination") ?? "Adresse de destination"}
            icon={<MapPin className="h-4 w-4" />}
            value={toAddr}
            onChange={(v) => {
              setToAddr(v);
              if (!v) setToCoord(null);
            }}
            onSelect={handleToSelect}
          />

          <fieldset>
            <legend className="block text-sm font-semibold text-foreground">{t("sim.period")}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["day", "night"] as const).map((p) => {
                const active = period === p;
                return (
                  <label
                    key={p}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sim-period"
                      value={p}
                      checked={active}
                      onChange={() => setPeriod(p)}
                      className="sr-only"
                    />
                    <span className="font-medium">
                      {p === "day" ? "☀️ Jour (7h–19h)" : "🌙 Nuit / Dimanche / Jours fériés (19h–7h)"}
                    </span>
                    <span className="mt-1 block text-xs">{formatEUR(p === "day" ? RATE_DAY : RATE_NIGHT)} / km</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* ── Résultat ── */}
        <div className="flex flex-col justify-between rounded-xl bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calculator className="h-4 w-4 text-primary" />
              {t("sim.estimate")}
            </div>

            {distLoading ? (
              <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm">Calcul de la distance…</span>
              </div>
            ) : total != null ? (
              <>
                <div className="mt-3 font-display text-5xl font-bold text-red-600" aria-live="polite">
                  {formatEUR(total)}
                </div>
                <p className="mt-2 text-xs font-bold text-red-600">
                  <strong>*</strong> Des frais de réservation peuvent être appliqués
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Entrez un départ et une destination pour obtenir une estimation.
              </p>
            )}

            {km != null && (
              <dl className="mt-6 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("sim.pickup")}</dt>
                  <dd className="font-medium">{formatEUR(PICKUP_FEE)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("sim.perkm")}</dt>
                  <dd className="font-medium">{formatEUR(rate)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Distance estimée</dt>
                  <dd className="font-medium">{km} km</dd>
                </div>
              </dl>
            )}
          </div>

          <p className="mt-6 flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{t("sim.disclaimer")}</span>
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={`tel:${PHONE}`}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:border-primary sm:flex-1"
            >
              <Phone className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{PHONE_DISPLAY}</span>
            </a>
            <Link
              to="/reservation"
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] sm:flex-1"
            >
              {t("sim.cta_book")} <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
