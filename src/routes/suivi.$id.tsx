import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, MessageCircle } from "lucide-react";
import { useI18n, useT } from "@/i18n/I18nProvider";
import { getClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import { DirectChatPanel } from "@/components/DirectChatPanel";
import { getReservationForFinPublic } from "@/lib/reservation.functions";
import { supabase } from "@/integrations/supabase/client";

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
  const [priceUpdated, setPriceUpdated] = useState(false);
  const initialPriceRef = useRef<number | null>(null);
  const [acceptedAlert, setAcceptedAlert] = useState(false);
  const fetchReservation = useServerFn(getReservationForFinPublic);
  const navigate = useNavigate();

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
          if (initialPriceRef.current === null) {
            initialPriceRef.current = row.prix_estime ?? null;
          }
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

  useEffect(() => {
    if (!reservation?.id) return;
    const channel = (supabase as any)
      .channel(`reservation-status-${reservation.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${reservation.id}` },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          const updated: Reservation = {
            id: row.id,
            depart: row.depart,
            destination: row.destination,
            arrivee: row.arrivee,
            pickup_datetime: row.pickup_datetime,
            status: row.status,
            prix_estime: row.prix_estime,
            distance_km: row.distance_km,
          };
          setReservation(updated);
          if (initialPriceRef.current !== null && updated.prix_estime != null && updated.prix_estime !== initialPriceRef.current) {
            setPriceUpdated(true);
          }
          if (updated.status === "accepted") {
            <div className="mx-auto max-w-5xl px-6 py-12">
              {/* Hero */}
              <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 shadow-lg text-center text-white">
                <h2 className="text-xs uppercase tracking-widest text-slate-300">Suivi premium</h2>
                <h1 className="mt-2 text-3xl font-semibold">Suivez votre course en temps réel</h1>
                <p className="mt-2 text-sm text-slate-300">Informations claires et sécurisées — votre chauffeur confirme le tarif avant affichage.</p>
              </div>

              {/* Main grid */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left column: info + driver */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">Statut</p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="rounded-full bg-white/6 px-3 py-1 text-sm font-semibold text-white">{translatedStatus}</div>
                          <div className="text-sm text-muted-foreground">Prise en charge : {formatPickup(reservation.pickup_datetime ?? "", locale)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Link to={`/reservation/${reservation.id}`} className="text-sm text-primary underline">Voir réservation</Link>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-lg bg-background p-4">
                        <p className="text-xs text-muted-foreground">Départ</p>
                        <p className="mt-1 text-white">{reservation.depart}</p>
                      </div>
                      <div className="rounded-lg bg-background p-4">
                        <p className="text-xs text-muted-foreground">Destination</p>
                        <p className="mt-1 text-white">{reservation.destination ?? reservation.arrivee ?? "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Driver card */}
                  <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-xl font-bold text-white">J</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">Chauffeur</div>
                          <div className="mt-1 font-semibold text-white">José — Mercedes</div>
                          <div className="text-sm text-muted-foreground">Plaque: HF 450 JG</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <a href={`tel:0673072322`} className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-2 text-sm text-white">Appeler</a>
                          <a href={`https://wa.me/33673072322`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-2 text-sm text-white">WhatsApp</a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chat panel (bottom on mobile) */}
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      <div className="font-semibold text-white">Messagerie</div>
                    </div>
                    <div className="mt-4" style={{ minHeight: 300 }}>
                      {session ? (
                        <DirectChatPanel accountId={session.id} role="client" peerName="José 🚖" />
                      ) : (
                        <div className="space-y-4 text-sm text-muted-foreground">
                          <p>Connectez-vous pour discuter directement avec votre chauffeur.</p>
                          <Link to="/client/login" className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Connexion</Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column: fare and meta */}
                <aside className="lg:col-span-5">
                  <div className="sticky top-24 space-y-4">
                    <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg border border-white/6">
                      <div className="text-sm text-slate-300">Tarif estimé</div>
                      <div className="mt-4">
                        {(["accepted", "en_route", "arrived", "completed", "terminee"].includes(reservation.status) && reservation.prix_estime != null) ? (
                          <div className="text-2xl font-semibold">{new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)}</div>
                        ) : (
                          <div className="text-sm text-slate-400">Votre tarif estimé sera fixé par le chauffeur et affiché ici une fois la course confirmée.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="text-sm text-muted-foreground">Résumé</div>
                      <div className="mt-3 text-sm text-white">
                        <div>Distance estimée: {reservation.distance_km != null ? `${reservation.distance_km.toFixed(1)} km` : `-`}</div>
                        <div className="mt-2">ID: {reservation.id}</div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/reservation/${reservation.id}`}
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
