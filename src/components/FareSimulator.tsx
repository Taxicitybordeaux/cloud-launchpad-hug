import { useEffect, useRef, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Phone, ArrowRight, Info, MapPin, Loader2, Clock } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { getDistanceAndDurationKm } from "@/lib/osrm";
import { getCurrentPosition } from "@/lib/geocode";

// ─── Config tarifs ────────────────────────────────────────────
const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

const PICKUP_FEE = 2.83;
const RATE_DAY = 2.16; // 7h–19h
const RATE_NIGHT = 3.24; // 19h–7h

function formatEUR(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

// ─── Tarif mixte ─────────────────────────────────────────────
/**
 * Étant donné une heure de départ et une durée de trajet (secondes),
 * calcule le tarif kilométrique moyen pondéré entre jour et nuit.
 * Découpe le trajet en tranches d'1 min pour déterminer chaque tarif.
 */
function computeMixedRate(departure: Date, durationSec: number): number {
  if (durationSec <= 0) {
    const h = departure.getHours();
    return h >= 7 && h < 19 ? RATE_DAY : RATE_NIGHT;
  }

  const start = departure.getTime();
  const end = start + durationSec * 1000;
  const STEP = 60_000; // 1 minute
  let dayMs = 0;
  let nightMs = 0;
  let cursor = start;

  while (cursor < end) {
    const slice = Math.min(STEP, end - cursor);
    const h = new Date(cursor).getHours();
    if (h >= 7 && h < 19) dayMs += slice;
    else nightMs += slice;
    cursor += slice;
  }

  const total = dayMs + nightMs;
  if (total === 0) return RATE_DAY;
  return (dayMs / total) * RATE_DAY + (nightMs / total) * RATE_NIGHT;
}

// ─── Types ───────────────────────────────────────────────────
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// ─── Géocodage silencieux (1er résultat Nominatim) ───────────
import { geocodeAddress } from "@/lib/geocode";

async function geocodeSilent(query: string): Promise<[number, number] | null> {
  if (query.trim().length < 3) return null;
  try {
    const c = await geocodeAddress(query);
    if (!c) return null;
    return [c.lng, c.lat];
  } catch {
    return null;
  }
}

// ─── Champ adresse — saisie libre, géocodage silencieux au blur ──
interface AddressFieldProps {
  id: string;
  label: string;
  placeholder: string;
  errorMsg: string;
  onCoord: (coord: [number, number] | null) => void;
}

function AddressField({ id, label, placeholder, errorMsg, onCoord }: AddressFieldProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [ok, setOk] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastQuery = useRef("");

  const handleChange = (v: string) => {
    lastQuery.current = v;
    onCoord(null);
    setOk(false);
    setFailed(false);
  };

  const handleBlur = async () => {
    const q = lastQuery.current.trim();
    if (q.length < 3) return;
    setGeocoding(true);
    const coord = await geocodeSilent(q);
    setGeocoding(false);
    if (coord) {
      onCoord(coord);
      setOk(true);
      setFailed(false);
    } else {
      setOk(false);
      setFailed(true);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground mb-2">
        {id === "sim-from" ? "🟢 " : "🏁 "}
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          autoComplete="off"
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-background px-4 pr-10 py-3 text-sm focus:outline-none transition
            ${failed ? "border-red-400 focus:border-red-400" : ""}
            ${ok && !failed ? "border-primary focus:border-primary" : ""}
            ${!ok && !failed ? "border-border focus:border-primary" : ""}
          `}
        />
        {geocoding && (
          <Loader2 className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!geocoding && ok && <MapPin className="pointer-events-none absolute right-3 h-4 w-4 text-primary" />}
      </div>
      {failed && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
    </div>
  );
}

// ─── Calcul distance + durée via OSRM ────────────────────────
function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RouteResult {
  km: number;
  durationSec: number;
}

function useRoute(from: [number, number] | null, to: [number, number] | null) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      return;
    }
    setLoading(true);

    (async () => {
      try {
        const dd = await getDistanceAndDurationKm(from, to);
        if (dd && dd.distanceKm != null) {
          setRoute({ km: Math.round(dd.distanceKm * 10) / 10, durationSec: Math.round(dd.durationSec) });
        } else {
          throw new Error('no route');
        }
      } catch {
        const km = Math.round(haversineKm(from, to) * 1.3 * 10) / 10;
        setRoute({ km, durationSec: Math.round((km / 50) * 3600) });
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to]);

  return { route, loading };
}

// ─── Formatage durée ──────────────────────────────────────────
function formatDuration(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const min = Math.round((sec % 3600) / 60);
    return `${h}h${String(min).padStart(2, "0")}`;
  }
  return `${Math.round(sec / 60)} min`;
}

// ─── Composant principal ──────────────────────────────────────
export function FareSimulator() {
  const t = useT();

  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);

  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const { route, loading: distLoading } = useRoute(fromCoord, toCoord);

  // Heure courante — mise à jour chaque minute pour que le badge reste exact
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isDay = now.getHours() >= 7 && now.getHours() < 19;
  const periodLabel = isDay
    ? `${t("sim.period_day")} ${formatEUR(RATE_DAY)} / km`
    : `${t("sim.period_night")} ${formatEUR(RATE_NIGHT)} / km`;

  // Taux mixte : pondéré sur la durée réelle du trajet depuis maintenant
  const rate = useMemo(
    () => (route ? computeMixedRate(now, route.durationSec) : isDay ? RATE_DAY : RATE_NIGHT),
    [route, now, isDay],
  );

  // Tarif mixte si on chevauche une frontière 7h / 19h
  const isMixed = route ? Math.abs(rate - RATE_DAY) > 0.01 && Math.abs(rate - RATE_NIGHT) > 0.01 : false;

  const total = useMemo(() => (route ? PICKUP_FEE + route.km * rate : null), [route, rate]);

  const handleUseMyPosition = async () => {
    setGeoMsg(null);
    const pos = await getCurrentPosition({ enableHighAccuracy: true }, 10000);
    if (!pos) {
      setGeoMsg("Impossible d'obtenir votre position");
      return;
    }
    setFromCoord([pos.lng, pos.lat]);
    setGeoMsg("Position utilisée comme origine");
    setTimeout(() => setGeoMsg(null), 3000);
  };

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
            label={t("sim.from_label")}
            placeholder={t("sim.addr_placeholder")}
            errorMsg={t("sim.addr_error")}
            onCoord={setFromCoord}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleUseMyPosition}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary"
            >
              📍 Utiliser ma position
            </button>
            {geoMsg && <div style={{ color: '#94a3b8', fontSize: 13 }}>{geoMsg}</div>}
          </div>
          <AddressField
            id="sim-to"
            label={t("sim.to_label")}
            placeholder={t("sim.addr_placeholder")}
            errorMsg={t("sim.addr_error")}
            onCoord={setToCoord}
          />

          {/* Badge période — lecture seule, automatique */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span>{periodLabel}</span>
            {isMixed && (
              <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {t("sim.badge_mixed")}
              </span>
            )}
          </div>
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
                <span className="text-sm">{t("sim.dist_loading")}</span>
              </div>
            ) : (
              <div
                className="mt-3 text-5xl font-bold text-red-600 tabular-nums"
                style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
                aria-live="polite"
              >
                {formatEUR(total ?? PICKUP_FEE)}
              </div>
            )}

            <p className="mt-2 text-xs font-bold text-red-600">{t("sim.booking_fee_note")}</p>

            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t("sim.pickup")}</dt>
                <dd className="font-medium">{formatEUR(PICKUP_FEE)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{isMixed ? t("sim.perkm_mixed") : t("sim.perkm")}</dt>
                <dd className="font-medium">{formatEUR(rate)} / km</dd>
              </div>
              {route && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("sim.dist_label")}</dt>
                  <dd className="font-medium">{route.km} km</dd>
                </div>
              )}
              {route && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("sim.duration_label")}</dt>
                  <dd className="font-medium">{formatDuration(route.durationSec)}</dd>
                </div>
              )}
            </dl>
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
              <span>{PHONE_DISPLAY}</span>
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
