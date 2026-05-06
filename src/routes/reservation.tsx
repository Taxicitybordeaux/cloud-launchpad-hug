import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck } from "lucide-react";
import { COUNTRIES, normalizePhone, type CountryCode } from "@/lib/phone";
import { usePublishReservationDraft } from "@/lib/reservation-draft";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/reservation")({
  head: () => ({
    meta: [
      { title: "Réservation – Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi à Bordeaux en ligne. Confirmation rapide, service 7j/7." },
    ],
  }),
  component: ReservationPage,
});

const initial = {
  nom: "", telephone_raw: "", country: "FR" as CountryCode, email: "",
  pickup_datetime: "", trip_type: "aller", return_datetime: "",
  depart: "", arrivee: "",
  passagers: "1", bagages: "0", service_type: "standard",
  needs_cpam: false,
  message: "",
};

function ReservationPage() {
  const t = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const baseSchema = z.object({
    nom: z.string().trim().min(2, t("res.err.name")).max(100),
    telephone_e164: z.string().regex(/^\+\d{7,15}$/, t("res.err.phone")),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    pickup_datetime: z.string().min(1, t("res.err.pickup"))
      .refine((v) => new Date(v).getTime() > Date.now() - 60_000, t("res.err.future")),
    trip_type: z.enum(["aller", "aller_retour"]),
    return_datetime: z.string().optional(),
    depart: z.string().trim().min(2, t("res.err.from")).max(200),
    arrivee: z.string().trim().min(2, t("res.err.to")).max(200),
    passagers: z.coerce.number().int().min(1).max(8),
    bagages: z.coerce.number().int().min(0).max(10),
    service_type: z.string().max(50),
    needs_cpam: z.boolean(),
    needs_baggage_help: z.boolean(),
    needs_child_seat: z.boolean(),
    message: z.string().max(1000).optional(),
  }).refine(
    (d) => d.trip_type !== "aller_retour" || (d.return_datetime && new Date(d.return_datetime) > new Date(d.pickup_datetime)),
    { path: ["return_datetime"], message: t("res.err.return") }
  );

  const draft = useMemo(() => {
    const e164 = normalizePhone(form.telephone_raw, form.country) ?? form.telephone_raw;
    return {
      nom: form.nom, telephone: e164,
      pickup_datetime: form.pickup_datetime, return_datetime: form.return_datetime,
      trip_type: form.trip_type, depart: form.depart, arrivee: form.arrivee,
      passagers: form.passagers, bagages: form.bagages, service_type: form.service_type,
      needs_cpam: form.needs_cpam, needs_baggage_help: form.needs_baggage_help,
      needs_child_seat: form.needs_child_seat, message: form.message,
    };
  }, [form]);
  usePublishReservationDraft(draft);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm({ ...form, [target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const e164 = normalizePhone(form.telephone_raw, form.country);
    if (!e164) {
      setErrors({ telephone_raw: t("res.err.phone") });
      return;
    }

    const parsed = baseSchema.safeParse({ ...form, telephone_e164: e164 });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as string;
        errs[k === "telephone_e164" ? "telephone_raw" : k] = i.message;
      });
      setErrors(errs);
      return;
    }

    setLoading(true);
    const extras: string[] = [];
    if (form.needs_cpam) extras.push(t("res.f.needs.cpam"));
    if (form.needs_baggage_help) extras.push(t("res.f.needs.bags"));
    if (form.needs_child_seat) extras.push(t("res.f.needs.child"));

    const composedMessage = [
      parsed.data.trip_type === "aller_retour"
        ? `${t("res.f.trip.round")} — ${new Date(parsed.data.return_datetime!).toLocaleString()}`
        : null,
      extras.length ? `${t("res.f.needs")}: ${extras.join(", ")}` : null,
      parsed.data.message,
    ].filter(Boolean).join("\n");

    const { data: inserted, error } = await supabase.from("reservations").insert({
      nom: parsed.data.nom, telephone: e164, email: parsed.data.email || null,
      pickup_datetime: new Date(parsed.data.pickup_datetime).toISOString(),
      depart: parsed.data.depart, arrivee: parsed.data.arrivee,
      passagers: parsed.data.passagers, bagages: parsed.data.bagages,
      service_type: parsed.data.service_type, message: composedMessage || null,
    }).select("id").maybeSingle();

    setLoading(false);
    if (error || !inserted?.id) {
      setErrors({ _global: t("res.err.global") });
      return;
    }

    fetch("/api/public/notify-reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: parsed.data.nom, telephone: e164, email: parsed.data.email || null,
        pickup_datetime: parsed.data.pickup_datetime,
        depart: parsed.data.depart, arrivee: parsed.data.arrivee,
        passagers: parsed.data.passagers, bagages: parsed.data.bagages,
        service_type: parsed.data.service_type, message: composedMessage || null,
        reservation_id: inserted.id,
      }),
    }).catch(() => {});

    navigate({ to: "/reservation/$id", params: { id: inserted.id } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("res.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("res.title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("res.intro")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t("res.f.name")} name="nom" value={form.nom} onChange={handleChange} error={errors.nom} />

          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("res.f.phone")}</label>
            <div className="flex gap-2">
              <select name="country" value={form.country} onChange={handleChange}
                className="h-11 rounded-md border border-border bg-input px-2 text-sm" aria-label="country">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <input name="telephone_raw" type="tel" value={form.telephone_raw} onChange={handleChange}
                placeholder="6 73 07 23 22"
                className="h-11 flex-1 rounded-md border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            {errors.telephone_raw && <p className="mt-1 text-xs text-destructive">{errors.telephone_raw}</p>}
          </div>
        </div>

        <Field label={t("res.f.email")} name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />

        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("res.f.trip")}</label>
          <div className="flex gap-2">
            {[
              { v: "aller", l: t("res.f.trip.one") },
              { v: "aller_retour", l: t("res.f.trip.round") },
            ].map((o) => (
              <label key={o.v}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition ${
                  form.trip_type === o.v ? "border-primary bg-primary/10 text-primary" : "border-border bg-input text-muted-foreground hover:border-primary/40"
                }`}>
                <input type="radio" name="trip_type" value={o.v} checked={form.trip_type === o.v} onChange={handleChange} className="sr-only" />
                {o.l}
              </label>
            ))}
          </div>
        </div>

        <Field label={t("res.f.pickup")} name="pickup_datetime" type="datetime-local" value={form.pickup_datetime} onChange={handleChange} error={errors.pickup_datetime} />

        {form.trip_type === "aller_retour" && (
          <Field label={t("res.f.return")} name="return_datetime" type="datetime-local" value={form.return_datetime} onChange={handleChange} error={errors.return_datetime} />
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t("res.f.from")} name="depart" value={form.depart} onChange={handleChange} error={errors.depart} placeholder={t("res.f.from.ph")} />
          <Field label={t("res.f.to")} name="arrivee" value={form.arrivee} onChange={handleChange} error={errors.arrivee} placeholder={t("res.f.to.ph")} />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <Field label={t("res.f.passengers")} name="passagers" type="number" min={1} max={8} value={form.passagers} onChange={handleChange} error={errors.passagers} />
          <Field label={t("res.f.luggage")} name="bagages" type="number" min={0} max={10} value={form.bagages} onChange={handleChange} error={errors.bagages} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("res.f.kind")}</label>
            <select name="service_type" value={form.service_type} onChange={handleChange}
              className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm">
              <option value="standard">{t("res.f.kind.standard")}</option>
              <option value="aeroport">{t("res.f.kind.airport")}</option>
              <option value="gare">{t("res.f.kind.train")}</option>
              <option value="cpam">{t("res.f.kind.cpam")}</option>
              <option value="mariage">{t("res.f.kind.wedding")}</option>
              <option value="business">{t("res.f.kind.business")}</option>
              <option value="longue_distance">{t("res.f.kind.long")}</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-3 block text-sm font-medium">{t("res.f.needs")}</legend>
          <div className="grid gap-3 md:grid-cols-3">
            <Extra icon={ShieldCheck} name="needs_cpam" checked={form.needs_cpam} onChange={handleChange} label={t("res.f.needs.cpam")} hint={t("res.f.needs.cpam.hint")} />
            <Extra icon={Luggage} name="needs_baggage_help" checked={form.needs_baggage_help} onChange={handleChange} label={t("res.f.needs.bags")} hint={t("res.f.needs.bags.hint")} />
            <Extra icon={Baby} name="needs_child_seat" checked={form.needs_child_seat} onChange={handleChange} label={t("res.f.needs.child")} hint={t("res.f.needs.child.hint")} />
          </div>
        </fieldset>

        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("res.f.message")}</label>
          <textarea name="message" value={form.message} onChange={handleChange} rows={4}
            placeholder={t("res.f.message.ph")}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </div>

        {errors._global && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errors._global}</p>}

        <button type="submit" disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90 disabled:opacity-60">
          {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> {t("res.sending")}</> : t("res.send")}
        </button>

        <p className="text-center text-xs text-muted-foreground">{t("res.note")}</p>
      </form>
    </div>
  );
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input {...props}
        className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Extra({ icon: Icon, name, checked, onChange, label, hint }: {
  icon: React.ComponentType<{ className?: string }>;
  name: string; checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string; hint: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
      checked ? "border-primary bg-primary/5" : "border-border bg-input/40 hover:border-primary/40"
    }`}>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
