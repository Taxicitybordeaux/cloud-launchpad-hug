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
      {
        name: "description",
        content:
          "Contactez Taxi City Bordeaux : 06 73 07 23 22, taxi.city033@gmail.com. Interventions à Bordeaux et dans toute la Gironde.",
      },
    ],
  }),
  component: ContactPage,
});

const initial = {
  nom: "",
  email: "",
  telephone_raw: "",
  country: "FR" as CountryCode,
  sujet: "",
  message: "",
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
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-14 md:py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("contact.eyebrow")}</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl md:text-5xl">{t("contact.title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:mt-4 sm:text-base">{t("contact.intro")}</p>
      </div>

      {/* Contact cards: 1-col on mobile, 2-col on md */}
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6">
        <a
          href="tel:0673072322"
          className="group flex flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary sm:flex-col sm:items-start sm:p-6"
        >
          <Phone className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
          <div>
            <h2 className="font-display text-lg font-semibold sm:mt-3 sm:text-xl">{t("contact.phone")}</h2>
            <p className="text-xl font-bold text-primary sm:mt-1 sm:text-2xl">06 73 07 23 22</p>
            <p className="mt-0.5 text-sm text-muted-foreground sm:mt-1">{t("contact.phone.sub")}</p>
          </div>
        </a>

        <a
          href="https://wa.me/33673072322"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary sm:flex-col sm:items-start sm:p-6"
        >
          <MessageCircle className="h-7 w-7 shrink-0 text-green-500 sm:h-8 sm:w-8" />
          <div>
            <h2 className="font-display text-lg font-semibold sm:mt-3 sm:text-xl">{t("contact.wa.title")}</h2>
            <p className="font-semibold sm:mt-1 sm:text-lg">{t("contact.wa.line")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground sm:mt-1">{t("contact.wa.sub")}</p>
          </div>
        </a>

        <a
          href="mailto:taxi.city033@gmail.com"
          className="group flex flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary sm:flex-col sm:items-start sm:p-6"
        >
          <Mail className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
          <div>
            <h2 className="font-display text-lg font-semibold sm:mt-3 sm:text-xl">{t("contact.email")}</h2>
            <p className="break-all font-semibold sm:mt-1 sm:text-base">taxi.city033@gmail.com</p>
            <p className="mt-0.5 text-sm text-muted-foreground sm:mt-1">{t("contact.email.sub")}</p>
          </div>
        </a>

        <div className="flex flex-row items-center gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-col sm:items-start sm:p-6">
          <MapPin className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
          <div>
            <h2 className="font-display text-lg font-semibold sm:mt-3 sm:text-xl">{t("contact.zone.title")}</h2>
            <p className="font-semibold sm:mt-1">{t("contact.zone.line1")}</p>
            <p className="text-sm text-muted-foreground">{t("contact.zone.line2")}</p>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">{t("contact.zone.sub")}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-primary/30 bg-card p-4 text-center sm:mt-8 sm:p-5">
        <Clock className="mx-auto h-6 w-6 text-primary sm:h-7 sm:w-7" />
        <p className="mt-2 font-display text-base font-semibold sm:text-lg">{t("common.available_247")}</p>
      </div>

      {/* FORM */}
      <section className="mt-12 sm:mt-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("contact.form.eyebrow")}</p>
          <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl md:text-4xl">{t("contact.form.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">{t("contact.form.intro")}</p>
        </div>

        {success ? (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-card p-8 text-center sm:mt-10 sm:p-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary sm:h-14 sm:w-14" />
            <h3 className="mt-4 font-display text-xl font-bold sm:mt-5 sm:text-2xl">
              {t("contact.form.success.title")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">{t("contact.form.success.desc")}</p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-5 rounded-md border border-border px-6 py-2.5 text-sm font-semibold hover:border-primary sm:mt-6"
            >
              {t("contact.form.success.again")}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5 sm:mt-10 sm:space-y-5 md:p-8"
          >
            {/* Stack fields vertically on mobile, 2-col on md */}
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
              <Field
                label={t("contact.form.name")}
                name="nom"
                value={form.nom}
                onChange={handleChange}
                error={errors.nom}
              />
              <Field
                label={t("contact.form.email")}
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("contact.form.phone")}</label>
              <div className="flex gap-2">
                <select
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className="h-12 rounded-md border border-border bg-input px-2 text-base"
                  aria-label="country"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.dial}
                    </option>
                  ))}
                </select>
                <input
                  name="telephone_raw"
                  type="tel"
                  value={form.telephone_raw}
                  onChange={handleChange}
                  placeholder="6 73 07 23 22"
                  className="h-12 flex-1 rounded-md border border-border bg-input px-3 text-base focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {errors.telephone_raw && <p className="mt-1 text-xs text-destructive">{errors.telephone_raw}</p>}
            </div>

            <Field
              label={t("contact.form.subject")}
              name="sujet"
              value={form.sujet}
              onChange={handleChange}
              error={errors.sujet}
              placeholder={t("contact.form.subject.ph")}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("contact.form.message")}</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={5}
                placeholder={t("contact.form.message.ph")}
                className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
            </div>

            {errors._global && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{errors._global}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition active:scale-95 disabled:opacity-60 sm:rounded-md sm:py-3.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> {t("contact.form.sending")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> {t("contact.form.send")}
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">{t("contact.form.note")}</p>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        {...props}
        className="h-12 w-full rounded-md border border-border bg-input px-3 text-base focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
