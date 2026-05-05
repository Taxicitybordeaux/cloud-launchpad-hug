import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Calendar, MapPin, Phone, MessageCircle, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { buildReservationMessage, whatsappLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/reservation/$id")({
  head: () => ({
    meta: [
      { title: "Confirmation de réservation – Taxi City Bordeaux" },
      { name: "description", content: "Votre demande de réservation a bien été enregistrée." },
      { name: "robots", content: "noindex" },
    ],
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
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_reservation_public", { p_id: id });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setNotFound(true);
      } else {
        setReservation(data[0] as Reservation);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    const { data, error } = await supabase.rpc("cancel_reservation_public", { p_id: id });
    setCancelling(false);
    if (!error && data) {
      setReservation((r) => (r ? { ...r, status: "annulee" } : r));
      setConfirmCancel(false);
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
        <h1 className="mt-6 font-display text-3xl font-bold">Réservation introuvable</h1>
        <p className="mt-3 text-muted-foreground">
          Le lien semble invalide ou la réservation a été supprimée.
        </p>
        <button
          onClick={() => navigate({ to: "/reservation" })}
          className="mt-6 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Faire une nouvelle réservation
        </button>
      </div>
    );
  }

  const refNumber = `TCB-${reservation.id.slice(0, 8).toUpperCase()}`;
  const isCancelled = reservation.status === "annulee";

  const waMessage = buildReservationMessage({
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
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        {isCancelled ? (
          <>
            <XCircle className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-5 font-display text-3xl font-bold md:text-4xl">Réservation annulée</h1>
            <p className="mt-3 text-muted-foreground">Cette réservation a bien été annulée.</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <h1 className="mt-5 font-display text-3xl font-bold md:text-4xl">Demande enregistrée !</h1>
            <p className="mt-3 text-muted-foreground">
              Nous vous rappelons rapidement pour confirmer votre course.
            </p>
          </>
        )}
      </div>

      {/* Reference number */}
      <div className="mt-8 rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">N° de réservation</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-primary">{refNumber}</p>
        <p className="mt-1 text-xs text-muted-foreground">À conserver pour toute modification ou annulation.</p>
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Récapitulatif</h2>
        <Row icon={Calendar} label="Prise en charge"
             value={new Date(reservation.pickup_datetime).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })} />
        <Row icon={MapPin} label="Départ" value={reservation.depart} />
        <Row icon={MapPin} label="Arrivée" value={reservation.arrivee} />
        <Row icon={Phone} label="Téléphone" value={reservation.telephone} />
        <div className="text-sm text-muted-foreground">
          {reservation.passagers} passager(s) • {reservation.bagages} bagage(s) • {reservation.service_type}
        </div>
        {reservation.message && (
          <p className="rounded-md border border-border bg-input/40 p-3 text-sm whitespace-pre-line">{reservation.message}</p>
        )}
      </div>

      {/* Actions */}
      {!isCancelled && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={whatsappLink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3 font-semibold text-white shadow transition hover:opacity-90"
          >
            <MessageCircle className="h-5 w-5" /> Confirmer sur WhatsApp
          </a>
          <a
            href="tel:0673072322"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-3 font-semibold transition hover:border-primary"
          >
            <Phone className="h-5 w-5" /> 06 73 07 23 22
          </a>
        </div>
      )}

      {/* Modify / cancel */}
      {!isCancelled && (
        <div className="mt-6 rounded-xl border border-border bg-card/50 p-5">
          <h3 className="text-sm font-semibold">Modifier ou annuler</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pour modifier votre demande, contactez-nous par téléphone ou WhatsApp avec votre numéro de réservation.
          </p>
          {confirmCancel ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer l'annulation
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
              >
                Garder ma réservation
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmCancel(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"
            >
              <XCircle className="h-4 w-4" /> Annuler ma réservation
            </button>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Retour à l'accueil</Link>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="text-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
