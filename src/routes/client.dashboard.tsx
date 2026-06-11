import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Calendar,
  MapPin,
  ArrowRight,
  Clock,
  Phone,
  MessageCircle,
  Eye,
  RotateCw,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ClientAuthHeader } from "@/components/ClientAuthHeader";
import { getClientSession, clearClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import {
  listClientReservations,
  updateReservationTime,
  cancelClientReservation,
  requestPhoneCancellation,
  type ClientReservation,
} from "@/lib/client-reservations.functions";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Mon espace client — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientDashboard,
});

const ACTIVE_STATUSES = new Set(["nouvelle", "pending", "accepted", "en_route", "arrived"]);
const CANCELLABLE = new Set(["nouvelle", "pending", "accepted"]);

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  nouvelle: { label: "En attente", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  pending: { label: "En attente", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  accepted: { label: "Acceptée", bg: "rgba(34,197,94,0.15)", fg: "#4ade80" },
  en_route: { label: "Chauffeur en route", bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  arrived: { label: "Chauffeur arrivé", bg: "rgba(99,102,241,0.18)", fg: "#a5b4fc" },
  completed: { label: "Terminée", bg: "rgba(148,163,184,0.18)", fg: "#cbd5e1" },
  cancelled: { label: "Annulée", bg: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
  refused: { label: "Refusée", bg: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ClientDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<ClientReservation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const s = getClientSession();
    if (!s) {
      navigate({ to: "/client/login" });
      return;
    }
    setSession(s);
    setReady(true);
  }, [navigate]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await listClientReservations({
        data: { account_id: session.id, phone: session.phone, email: session.email },
      });
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de charger vos courses");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  function logout() {
    clearClientSession();
    navigate({ to: "/" });
  }

  async function onSubmitNewTime(id: string) {
    if (!session || !editTime) return;
    setBusy(id);
    try {
      await updateReservationTime({
        data: {
          account_id: session.id,
          phone: session.phone,
          email: session.email,
          reservation_id: id,
          pickup_datetime: new Date(editTime).toISOString(),
        },
      });
      toast.success("Heure modifiée — chauffeur notifié");
      setEditingId(null);
      setEditTime("");
      refresh();
    } catch (e: any) {
      toast.error(
        e?.message === "STATUS_LOCKED"
          ? "Cette course ne peut plus être modifiée"
          : "Modification impossible",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onCancel(id: string) {
    if (!session) return;
    if (!confirm("Confirmer l'annulation de cette course ?")) return;
    setBusy(id);
    try {
      await cancelClientReservation({
        data: {
          account_id: session.id,
          phone: session.phone,
          email: session.email,
          reservation_id: id,
        },
      });
      toast.success("Course annulée");
      refresh();
    } catch (e: any) {
      toast.error(
        e?.message === "STATUS_LOCKED"
          ? "Cette course ne peut plus être annulée"
          : "Annulation impossible",
      );
    } finally {
      setBusy(null);
    }
  }

  function recommander(r: ClientReservation) {
    const params = new URLSearchParams();
    if (r.depart) params.set("depart", r.depart);
    const dest = r.arrivee || r.destination || "";
    if (dest) params.set("destination", dest);
    params.set("passagers", String(r.nb_passagers ?? r.passagers ?? 1));
    params.set("bagages", String(r.bagages ?? 0));
    window.location.href = `/reserver?${params.toString()}`;
  }

  const greeting = useMemo(
    () => session?.name?.split(" ")[0] || "client",
    [session],
  );

  if (!ready || !session) return null;

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden px-4 py-8 sm:py-12"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col">
        <ClientAuthHeader backLabel="Accueil" />

        {/* Header bar */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">Espace client</p>
            <h1
              className="mt-1 text-2xl font-bold text-white sm:text-3xl"
              style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
            >
              Bonjour {greeting}
            </h1>
          </div>
          <button
            onClick={logout}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
          >
            <LogOut className="h-3.5 w-3.5" /> Déconnexion
          </button>
        </div>

        {/* Actions */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/reserver"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-black transition active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
          >
            <Plus className="h-4 w-4" /> Réserver une course
          </Link>
          <a
            href="tel:0673072322"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <Phone className="h-4 w-4" /> Annuler par téléphone
          </a>
        </div>

        {/* Liste */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
            Mes courses
          </h2>

          {loading && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10 text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
            </div>
          )}

          {!loading && rows && rows.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
              Aucune course pour le moment.
              <div className="mt-4">
                <Link
                  to="/reserver"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#E8C96D] px-4 py-2 text-xs font-semibold text-black"
                >
                  <Plus className="h-3.5 w-3.5" /> Réserver
                </Link>
              </div>
            </div>
          )}

          {!loading && rows && rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((r) => {
                const status = STATUS_LABEL[r.status] || {
                  label: r.status,
                  bg: "rgba(255,255,255,0.08)",
                  fg: "#fff",
                };
                const isOpen = openId === r.id;
                const isActive = ACTIVE_STATUSES.has(r.status);
                const isCompleted = r.status === "completed";
                const dest = r.arrivee || r.destination || "—";

                return (
                  <li
                    key={r.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : r.id)}
                      className="flex w-full flex-col gap-2.5 p-4 text-left transition hover:bg-white/[0.03] sm:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                          <Calendar className="h-3.5 w-3.5" /> {fmtDate(r.pickup_datetime)}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: status.bg, color: status.fg }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-white">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E8C96D]" />
                        <div className="flex-1 leading-snug">
                          <span className="text-white/90">{r.depart}</span>
                          <ArrowRight className="mx-1.5 inline h-3.5 w-3.5 text-white/40" />
                          <span className="text-white/90">{dest}</span>
                        </div>
                      </div>
                      {r.prix_estime != null && (
                        <div className="text-xs text-white/60">
                          Prix estimé :{" "}
                          <span className="font-semibold text-[#E8C96D]">
                            {Number(r.prix_estime).toFixed(2)} €
                          </span>
                        </div>
                      )}
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/10 bg-black/30 p-4 sm:p-5">
                        <div className="mb-4 grid gap-1.5 text-xs text-white/70">
                          <div>Passagers : {r.nb_passagers ?? r.passagers ?? 1}</div>
                          <div>Bagages : {r.bagages ?? 0}</div>
                          {r.paiement && <div>Paiement : {r.paiement}</div>}
                          <div className="text-white/40">
                            Réf. {(r.tracking_id || r.id).slice(0, 10)}
                          </div>
                        </div>

                        {editingId === r.id ? (
                          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                            <label className="mb-1.5 block text-xs text-white/70">
                              Nouvelle date / heure
                            </label>
                            <input
                              type="datetime-local"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              min={toLocalInput(new Date().toISOString())}
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#E8C96D]"
                            />
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => onSubmitNewTime(r.id)}
                                disabled={busy === r.id}
                                className="flex-1 rounded-lg bg-[#E8C96D] px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
                              >
                                {busy === r.id ? "…" : "Confirmer"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditTime("");
                                }}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          {isActive && editingId !== r.id && (
                            <button
                              onClick={() => {
                                setEditingId(r.id);
                                setEditTime(toLocalInput(r.pickup_datetime));
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                            >
                              <Clock className="h-3.5 w-3.5" /> Modifier l'heure
                            </button>
                          )}

                          {isActive && (r.suivi_id || r.tracking_id) && (
                            <a
                              href={`/suivi/${r.suivi_id || r.tracking_id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black"
                              style={{
                                background:
                                  "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)",
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" /> Suivre ma course
                            </a>
                          )}

                          {isActive && (
                            <button
                              disabled
                              title="Bientôt disponible"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> Tchat
                            </button>
                          )}

                          {isActive && CANCELLABLE.has(r.status) && (
                            <button
                              onClick={() => onCancel(r.id)}
                              disabled={busy === r.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                            >
                              <X className="h-3.5 w-3.5" /> Annuler
                            </button>
                          )}

                          {isCompleted && (
                            <>
                              <button
                                onClick={() => recommander(r)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)",
                                }}
                              >
                                <RotateCw className="h-3.5 w-3.5" /> Recommander
                              </button>
                              <Link
                                to="/reserver"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                              >
                                <Plus className="h-3.5 w-3.5" /> Nouvelle course
                              </Link>
                            </>
                          )}

                          {isActive && (
                            <a
                              href="tel:0673072322"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                            >
                              <Phone className="h-3.5 w-3.5" /> Annuler par téléphone
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
