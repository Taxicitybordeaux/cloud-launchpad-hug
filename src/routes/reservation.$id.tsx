import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Phone,
  MessageCircle,
  Loader2,
  XCircle,
  AlertTriangle,
  Navigation,
} from "lucide-react";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useT, useI18n } from "@/i18n/I18nProvider";
import { getReservationPublic, cancelReservationPublic } from "@/lib/reservation.functions";

export const Route = createFileRoute("/reservation/$id")({
  head: () => ({
    meta: [{ title: "Confirmation – Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ConfirmationPage,
});

type Reservation = {
  id: string;
  nom: string;
  telephone: string;
  email: string | null;
  pickup_datetime: string;
  depart: string;
  arrivee: string;
  passagers: number;
  bagages: number;
  service_type: string;
  message: string | null;
  status: string;
  created_at: string;
};

function ConfirmationPage() {
  const t = useT();
  const { lang } = useI18n();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { status: pushStatus, subscribe } = usePushNotifications();
  const fetchReservation = useServerFn(getReservationPublic);
  const cancelReservation = useServerFn(cancelReservationPublic);
  // Redirection automatique après 5 secondes si réservation valide et non annulée
  useEffect(() => {
    if (reservation && !["annulee", "cancelled", "canceled"].includes(reservation.status)) {
      const timeout = setTimeout(() => {
        navigate({ to: "/suivi/$id", params: { id: reservation.id }, search: {} });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [reservation, navigate]);

  useEffect(() => {
    if (reservation && reservation.status !== "annulee" && pushStatus === "idle") {
      subscribe("client", reservation.id).catch(() => {});
    }
  }, [reservation, pushStatus, subscribe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchReservation({ data: { id } });
        if (cancelled) return;
        if (!row) setNotFound(true);
        else setReservation(row as Reservation);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchReservation]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await cancelReservation({ data: { id } });
      if (res?.ok) {
        setReservation((r) => (r ? { ...r, status: "cancelled" } : r));
        setConfirmCancel(false);
      }
    } catch {
      // silencieux : l'UI reste sur l'écran de confirmation
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !reservation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="mt-6 font-display text-3xl font-bold">{t("conf.notfound.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("conf.notfound.desc")}</p>
        <button
          onClick={() => navigate({ to: "/reservation" })}
          className="mt-6 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          {t("conf.notfound.cta")}
        </button>
      </div>
    );
  }

  const refNumber = `TCB-${reservation.id.slice(0, 8).toUpperCase()}`;
  const isCancelled = ["annulee", "cancelled", "canceled"].includes(reservation.status);

  const waMessage = buildReservationMessage(
    {
      nom: reservation.nom,
      telephone: reservation.telephone,
      pickup_datetime: reservation.pickup_datetime,
      depart: reservation.depart,
      arrivee: reservation.arrivee,
      passagers: reservation.passagers,
      bagages: reservation.bagages,
      service_type: reservation.service_type,
      message: reservation.message ?? undefined,
      reservation_id: reservation.id,
    },
    lang,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        {isCancelled ? (
          <>
            <XCircle className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-5 font-display text-3xl font-bold md:text-4xl">{t("conf.cancelled.title")}</h1>
            <p className="mt-3 text-muted-foreground">{t("conf.cancelled.desc")}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <h1 className="mt-5 font-display text-3xl font-bold md:text-4xl">{t("conf.ok.title")}</h1>
            <p className="mt-3 text-muted-foreground">{t("conf.ok.desc")}</p>
          </>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{t("conf.ref.label")}</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-primary">{refNumber}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("conf.ref.note")}</p>
      </div>

      {!isCancelled && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          📲 Les notifications de suivi sont activées automatiquement pour cette réservation.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">{t("conf.summary")}</h2>
        <Row
          icon={Calendar}
          label={t("conf.row.pickup")}
          value={(() => {
            const iso = reservation.pickup_datetime;
            if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
              const [y, m, d] = iso.split("-").map(Number);
              return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { dateStyle: "full" });
            }
            return new Date(iso).toLocaleString("fr-FR", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Europe/Paris",
            });
          })()}
        />
        <Row icon={MapPin} label={t("conf.row.from")} value={reservation.depart} />
        <Row icon={MapPin} label={t("conf.row.to")} value={reservation.arrivee} />
        <Row icon={Phone} label={t("conf.row.phone")} value={reservation.telephone} />
        <div className="text-sm text-muted-foreground">
          {reservation.passagers} {t("conf.passengers")} • {reservation.bagages} {t("conf.luggage")} •{" "}
          {reservation.service_type}
        </div>
        {reservation.message && (
          <p className="rounded-md border border-border bg-input/40 p-3 text-sm whitespace-pre-line">
            {reservation.message}
          </p>
        )}
      </div>

      {!isCancelled && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={whatsappLink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3 font-semibold text-white shadow transition hover:opacity-90"
          >
            <MessageCircle className="h-5 w-5" /> {t("conf.wa")}
          </a>
          <a
            href="tel:0673072322"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-3 font-semibold transition hover:border-primary"
          >
            <Phone className="h-5 w-5" /> 06 73 07 23 22
          </a>
        </div>
      )}

      {!isCancelled && (
        <Link
          to="/suivi/$id"
          params={{ id: reservation.id }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground shadow transition hover:opacity-90"
        >
          <Navigation className="h-5 w-5" /> {t("conf.track")}
        </Link>
      )}

      {!isCancelled && (
        <div className="mt-6 rounded-xl border border-border bg-card/50 p-5">
          <h3 className="text-sm font-semibold">{t("conf.modify.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("conf.modify.desc")}</p>
          {confirmCancel ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("conf.cancel.confirm")}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
              >
                {t("conf.cancel.keep")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmCancel(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"
            >
              <XCircle className="h-4 w-4" /> {t("conf.cancel")}
            </button>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
          {t("conf.back")}
        </Link>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 text-primary" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
