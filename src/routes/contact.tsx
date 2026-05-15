import { createFileRoute } from "@tanstack/react-router";
import { Phone, Mail, MapPin, MessageCircle, Clock } from "lucide-react";
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

function ContactPage() {
  const t = useT();

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
    </div>
  );
}
