import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reservation")({
  head: () => ({
    meta: [
      { title: "Réservation – Taxi City Bordeaux" },
      { name: "description", content: "Réservez votre taxi à Bordeaux en ligne. Confirmation rapide, service 7j/7." },
    ],
  }),
  component: ReservationPage,
});

const schema = z.object({
  nom: z.string().trim().min(2, "Nom requis").max(100),
  telephone: z.string().trim().min(8, "Téléphone requis").max(20),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  pickup_datetime: z.string().min(1, "Date/heure requise"),
  depart: z.string().trim().min(2, "Adresse de départ requise").max(200),
  arrivee: z.string().trim().min(2, "Adresse d'arrivée requise").max(200),
  passagers: z.coerce.number().int().min(1).max(8),
  bagages: z.coerce.number().int().min(0).max(10),
  service_type: z.string().max(50),
  message: z.string().max(1000).optional(),
});

const initial = {
  nom: "", telephone: "", email: "",
  pickup_datetime: "", depart: "", arrivee: "",
  passagers: "1", bagages: "0", service_type: "standard", message: "",
};

function ReservationPage() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("reservations").insert({
      nom: parsed.data.nom,
      telephone: parsed.data.telephone,
      email: parsed.data.email || null,
      pickup_datetime: new Date(parsed.data.pickup_datetime).toISOString(),
      depart: parsed.data.depart,
      arrivee: parsed.data.arrivee,
      passagers: parsed.data.passagers,
      bagages: parsed.data.bagages,
      service_type: parsed.data.service_type,
      message: parsed.data.message || null,
    });
    setLoading(false);
    if (error) {
      setErrors({ _global: "Erreur lors de l'envoi. Merci de nous appeler au 06 73 07 23 22." });
      return;
    }
    setSuccess(true);
    setForm(initial);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <CheckCircle2 className="mx-auto h-20 w-20 text-primary" />
        <h1 className="mt-6 font-display text-4xl font-bold">Demande envoyée !</h1>
        <p className="mt-4 text-muted-foreground">
          Votre demande de réservation a bien été enregistrée. Nous vous recontactons rapidement par téléphone pour confirmer.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="tel:0673072322" className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground">📞 06 73 07 23 22</a>
          <button onClick={() => setSuccess(false)} className="rounded-md border border-border px-6 py-3 font-semibold">Nouvelle réservation</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Réservation en ligne</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Réservez votre taxi</h1>
        <p className="mt-4 text-muted-foreground">Remplissez le formulaire — nous vous rappelons pour confirmer.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nom complet *" name="nom" value={form.nom} onChange={handleChange} error={errors.nom} />
          <Field label="Téléphone *" name="telephone" type="tel" value={form.telephone} onChange={handleChange} error={errors.telephone} />
        </div>
        <Field label="Email (facultatif)" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />

        <Field label="Date et heure de prise en charge *" name="pickup_datetime" type="datetime-local" value={form.pickup_datetime} onChange={handleChange} error={errors.pickup_datetime} />

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Adresse de départ *" name="depart" value={form.depart} onChange={handleChange} error={errors.depart} placeholder="Ex : 12 cours de l'Intendance, Bordeaux" />
          <Field label="Adresse d'arrivée *" name="arrivee" value={form.arrivee} onChange={handleChange} error={errors.arrivee} placeholder="Ex : Aéroport Mérignac" />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Passagers" name="passagers" type="number" min={1} max={8} value={form.passagers} onChange={handleChange} error={errors.passagers} />
          <Field label="Bagages" name="bagages" type="number" min={0} max={10} value={form.bagages} onChange={handleChange} error={errors.bagages} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Type de course</label>
            <select name="service_type" value={form.service_type} onChange={handleChange}
              className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm">
              <option value="standard">Standard</option>
              <option value="aeroport">Aéroport</option>
              <option value="gare">Gare</option>
              <option value="cpam">Conventionné CPAM</option>
              <option value="mariage">Mariage / événement</option>
              <option value="business">Business</option>
              <option value="longue_distance">Longue distance</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Message (facultatif)</label>
          <textarea name="message" value={form.message} onChange={handleChange} rows={4}
            placeholder="Numéro de vol, précisions, demandes particulières…"
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </div>

        {errors._global && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errors._global}</p>}

        <button type="submit" disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90 disabled:opacity-60">
          {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Envoi…</> : "Envoyer ma demande"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Pour une course immédiate, appelez-nous directement au <a href="tel:0673072322" className="text-primary font-semibold">06 73 07 23 22</a>
        </p>
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
