import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, MessageCircle } from "lucide-react";
import { useI18n, useT } from "@/i18n/I18nProvider";
import { getClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import { DirectChatPanel } from "@/components/DirectChatPanel";
import { getReservationForFinPublic } from "@/lib/reservation.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de votre taxi — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuiviPage,
});

type Reservation = {
  id: string;
  depart: string;
  destination?: string | null;
  arrivee?: string | null;
  pickup_datetime?: string | null;
  status: string;
  prix_estime?: number | null;
  distance_km?: number | null;
};

function formatPickup(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

function SuiviPage() {
  const t = useT();
  const { lang } = useI18n();
  const locale =
    lang === "fr"
      ? "fr-FR"
      : lang === "en"
      ? "en-US"
      : lang === "es"
      ? "es-ES"
      : lang === "it"
      ? "it-IT"
      : lang === "pt"
      ? "pt-PT"
      : lang === "ar"
      ? "ar"
      : "fr-FR";
  const { id } = Route.useParams();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<ClientSession | null>(null);
  const fetchReservation = useServerFn(getReservationForFinPublic);
  const prevStatusRef = useRef<string | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = getClientSession();
    if (stored) setSession(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchReservation({ data: { key: id } });
        if (cancelled) return;
        if (!row) {
          setNotFound(true);
        } else {
          setReservation(row as Reservation);
          prevStatusRef.current = (row as any).status ?? null;
          prevPriceRef.current = (row as any).prix_estime ?? null;
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReservation, id]);

  // Poll reservation periodically to detect status or price changes
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const row = await fetchReservation({ data: { key: id } });
        if (!mounted || !row) return;
        const newStatus = (row as any).status ?? null;
        const newPrice = (row as any).prix_estime ?? null;

        if (prevStatusRef.current && newStatus && prevStatusRef.current !== newStatus) {
          if (newStatus === "accepted") {
            toast.success("Votre course a été acceptée par le chauffeur.");
          } else if (newStatus === "en_route") {
            toast.success("Le chauffeur est en route vers vous.");
          } else if (newStatus === "arrived") {
            toast.success("Le chauffeur est arrivé.");
          }
        }

        if (
          prevPriceRef.current != null &&
          newPrice != null &&
          Number(prevPriceRef.current) !== Number(newPrice)
        ) {
          toast.success("Le prix a été mis à jour.");
        }

        setReservation((prev) => {
          if (!prev) return row as Reservation;
          const merged = { ...(row as Reservation) };
          return merged;
        });

        prevStatusRef.current = newStatus;
        prevPriceRef.current = newPrice;
      } catch (e) {
        // ignore polling errors
      }
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchReservation, id]);

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
        <h1 className="mt-6 font-display text-3xl font-bold">Suivi introuvable</h1>
        <p className="mt-3 text-muted-foreground">Nous n'avons pas trouvé cette réservation.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const statusLabel = reservation.status;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Suivi de course</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Votre taxi arrive bientôt</h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
          Prise en charge prévue le {formatPickup(reservation.pickup_datetime ?? "", locale)}
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Statut</p>
              <p className="mt-2 text-xl font-semibold">{statusLabel}</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="font-semibold text-slate-100">Départ</p>
              <p className="mt-2 text-base text-white">{reservation.depart}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="font-semibold text-slate-100">Destination</p>
              <p className="mt-2 text-base text-white">{reservation.destination ?? reservation.arrivee ?? "-"}</p>
            </div>
            {(reservation.distance_km != null || reservation.prix_estime != null) && (
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {reservation.distance_km != null && <span>Distance estimée : {reservation.distance_km.toFixed(1)} km</span>}
                  {reservation.prix_estime != null && (
                    <span>{new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
-              to={`/reservation/${reservation.id}`}
+              to={`/suivi/${reservation.id}`}
               className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-primary"
             >
               Voir ma réservation
             </Link>
           </div>
         </div>

         <div className="rounded-3xl border border-border bg-card p-6">
           <div className="flex items-center gap-3 text-sm text-muted-foreground">
             <MessageCircle className="h-5 w-5 text-primary" />
             <span className="font-semibold text-slate-100">Chat avec le chauffeur</span>
           </div>
           <div className="mt-5 text-sm leading-6 text-muted-foreground">
             <p>Échangez directement avec votre chauffeur depuis le bas de cette page.</p>
           </div>
           <div className="mt-6 rounded-3xl border border-border bg-background p-4" style={{ minHeight: 220 }}>
             {session ? (
               <div className="h-[420px] min-h-[420px]">
                 <DirectChatPanel accountId={session.id} role="client" peerName="José 🚖" />
               </div>
             ) : (
               <div className="space-y-4 text-sm text-muted-foreground">
                 <p>Connectez-vous pour ouvrir le chat avec votre chauffeur.</p>
                 <Link
                   to="/client/login"
                   className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                 >
                   Connexion
                 </Link>
               </div>
             )}
           </div>
         </div>
       </div>
     </div>
   );
 }
