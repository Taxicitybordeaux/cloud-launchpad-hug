import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Phone, Mail, MapPin, MessageCircle, Clock, Loader2, CheckCircle2, Send } from "lucide-react";
import { COUNTRIES, normalizePhone, type CountryCode } from "@/lib/phone";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact – Taxi City Bordeaux" },
      { name: "description", content: "Contactez Taxi City Bordeaux : 06 73 07 23 22, taxi.city033@gmail.com, 163 cours Victor Hugo 33150 Cenon." },
    ],
  }),
  component: ContactPage,
});

const initial = {
  nom: "", email: "", telephone_raw: "", country: "FR" as CountryCode,
  sujet: "", message: "",
};

function ContactPage() {
  const t = useT();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const schema = z.object({
    nom: z.string().trim().min(2, t("contact.err.name")).max(100),
    email: z.string().trim().email(t("contact.err.email")).max(255),
    telephone: z.string().trim().max(30).optional(),
    sujet: z.string().trim().max(120).optional(),
    message: z.string().trim().min(10, t("contact.err.message")).max(2000),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    let phoneE164: string | null = null;
    if (form.telephone_raw.trim()) {
      phoneE164 = normalizePhone(form.telephone_raw, form.country);
      if (!phoneE164) {
        setErrors({ telephone_raw: t("contact.err.phone") });
        return;
      }
    }

    const parsed = schema.safeParse({
      nom: form.nom,
      email: form.email,
      telephone: phoneE164 ?? undefined,
      sujet: form.sujet || undefined,
      message: form.message,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error("send failed");
      setSuccess(true);
      setForm(initial);
    } catch {
      setErrors({ _global: t("contact.form.error") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("contact.eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{t("contact.title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("contact.intro")}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <a href="tel:0673072322" className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
          <Phone className="h-8 w-8 text-primary" />
          <h2 className="mt-3 font-display text-xl font-semibold">{t("contact.phone")}</h2>
          <p className="mt-1 text-2xl font-bold text-primary">06 73 07 23 22</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("contact.phone.sub")}</p>
        </a>

        <a href="https://wa.me/33673072322" target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
          <MessageCircle className="h-8 w-8 text-green-500" />
          <h2 className="mt-3 font-display text-xl font-semibold">{t("contact.wa.title")}</h2>
          <p className="mt-1 text-lg font-semibold">{t("contact.wa.line")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("contact.wa.sub")}</p>
        </a>

        <a href="mailto:taxi.city033@gmail.com" className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary">
          <Mail className="h-8 w-8 text-primary" />
          <h2 className="mt-3 font-display text-xl font-semibold">{t("contact.email")}</h2>
          <p className="mt-1 text-base font-semibold break-all">taxi.city033@gmail.com</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("contact.email.sub")}</p>
        </a>

        <div className="rounded-2xl border border-border bg-card p-6">
          <MapPin className="h-8 w-8 text-primary" />
          <h2 className="mt-3 font-display text-xl font-semibold">{t("contact.zone.title")}</h2>
          <p className="mt-1 font-semibold">{t("contact.zone.line1")}</p>
          <p className="text-muted-foreground">{t("contact.zone.line2")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("contact.zone.sub")}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-primary/30 bg-card p-5 text-center">
        <Clock className="mx-auto h-7 w-7 text-primary" />
        <p className="mt-2 font-display text-lg font-semibold">{t("common.available_247")}</p>
      </div>

      <section className="mt-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("contact.form.eyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">{t("contact.form.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("contact.form.intro")}</p>
        </div>

        {success ? (
          <div className="mt-10 rounded-2xl border border-primary/30 bg-card p-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <h3 className="mt-5 font-display text-2xl font-bold">{t("contact.form.success.title")}</h3>
            <p className="mt-3 text-muted-foreground">{t("contact.form.success.desc")}</p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-6 rounded-md border border-border px-6 py-2.5 text-sm font-semibold hover:border-primary"
            >
              {t("contact.form.success.again")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t("contact.form.name")} name="nom" value={form.nom} onChange={handleChange} error={errors.nom} />
              <Field label={t("contact.form.email")} name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("contact.form.phone")}</label>
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

            <Field label={t("contact.form.subject")} name="sujet" value={form.sujet} onChange={handleChange} error={errors.sujet} placeholder={t("contact.form.subject.ph")} />

            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("contact.form.message")}</label>
              <textarea name="message" value={form.message} onChange={handleChange} rows={6}
                placeholder={t("contact.form.message.ph")}
                className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
            </div>

            {errors._global && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errors._global}</p>}

            <button type="submit" disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90 disabled:opacity-60">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> {t("contact.form.sending")}</> : <><Send className="h-4 w-4" /> {t("contact.form.send")}</>}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {t("contact.form.note")}
            </p>
          </form>
        )}
      </section>

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
