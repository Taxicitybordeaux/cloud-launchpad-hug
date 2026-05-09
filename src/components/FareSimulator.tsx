import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, Phone, ArrowRight, Info } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

const PICKUP_FEE = 2.83;
const RATE_DAY = 2.16;
const RATE_NIGHT = 3.24;

type Period = "day" | "night";

function formatEUR(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function FareSimulator() {
  const t = useT();
  const [distance, setDistance] = useState<number>(10);
  const [period, setPeriod] = useState<Period>("day");

  const rate = period === "day" ? RATE_DAY : RATE_NIGHT;
  const total = useMemo(() => {
    const km = Number.isFinite(distance) && distance > 0 ? distance : 0;
    return PICKUP_FEE + km * rate;
  }, [distance, rate]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          {t("sim.eyebrow")}
        </p>
        <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
          {t("sim.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          {t("sim.intro")}
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] sm:p-8 md:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <label
              htmlFor="sim-distance"
              className="block text-sm font-semibold text-foreground"
            >
              {t("sim.distance")}
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="sim-distance"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={distance > 0 ? distance : ""}
                onChange={(e) => {
                  // Strip leading zeros so users typing on mobile never end up with "0365".
                  const cleaned = e.target.value.replace(/^0+(?=\d)/, "");
                  if (cleaned === "") { setDistance(0); return; }
                  const v = parseFloat(cleaned);
                  setDistance(Number.isFinite(v) ? Math.max(0, v) : 0);
                }}
                className="w-32 rounded-xl border border-border bg-background px-4 py-3 font-display text-lg font-semibold focus:border-primary focus:outline-none"
                aria-describedby="sim-distance-hint"
              />
              <span
                id="sim-distance-hint"
                className="text-sm text-muted-foreground"
              >
                {t("sim.km")}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={Math.min(100, Math.max(1, Math.round(distance) || 1))}
              onChange={(e) => setDistance(parseInt(e.target.value, 10))}
              className="mt-3 w-full accent-primary"
              aria-label={t("sim.distance")}
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-semibold text-foreground">
              {t("sim.period")}
            </legend>
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
                      {t(p === "day" ? "sim.day" : "sim.night")}
                    </span>
                    <span className="mt-1 block text-xs">
                      {formatEUR(p === "day" ? RATE_DAY : RATE_NIGHT)} / {t("sim.km")}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Result */}
        <div className="flex flex-col justify-between rounded-xl bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calculator className="h-4 w-4 text-primary" />
              {t("sim.estimate")}
            </div>
            <div
              className="mt-3 font-display text-5xl font-bold text-primary"
              aria-live="polite"
            >
              {formatEUR(total)}
            </div>

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
                <dt className="text-muted-foreground">{t("sim.distance")}</dt>
                <dd className="font-medium">
                  {Math.max(0, distance || 0)} {t("sim.km")}
                </dd>
              </div>
            </dl>
          </div>

          <p className="mt-6 flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{t("sim.disclaimer")}</span>
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`tel:${PHONE}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:border-primary"
            >
              <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
            </a>
            <Link
              to="/reservation"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)]"
            >
              {t("sim.cta_book")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
