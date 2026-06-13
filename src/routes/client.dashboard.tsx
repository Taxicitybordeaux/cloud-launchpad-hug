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
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ClientAuthHeader } from "@/components/ClientAuthHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { DirectChatPanel } from "@/components/DirectChatPanel";
import { supabase } from "@/integrations/supabase/client";
import { getClientSession, clearClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import {
  listClientReservations,
  updateReservationTime,
  cancelClientReservation,
  requestPhoneCancellation,
  type ClientReservation,
} from "@/lib/client-reservations.functions";
import { useI18n, useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [{ title: "Mon espace client — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientDashboard,
});

const ACTIVE_STATUSES = new Set(["nouvelle", "pending", "accepted", "en_route", "arrived"]);
const CANCELLABLE = new Set(["nouvelle", "pending", "accepted"]);

const STATUS_META: Record<string, { key: string; bg: string; fg: string }> = {
  nouvelle: { key: "cd_status_pending", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  pending: { key: "cd_status_pending", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  accepted: { key: "cd_status_accepted", bg: "rgba(34,197,94,0.15)", fg: "#4ade80" },
  en_route: { key: "cd_status_en_route", bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  arrived: { key: "cd_status_arrived", bg: "rgba(99,102,241,0.18)", fg: "#a5b4fc" },
  completed: { key: "cd_status_completed", bg: "rgba(148,163,184,0.18)", fg: "#cbd5e1" },
  cancelled: { key: "cd_status_cancelled", bg: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
  refused: { key: "cd_status_refused", bg: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
};

function fmtDate(iso: string, locale: string) {
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

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ClientDashboard() {
  const navigate = useNavigate();
  const t = useT();
  const { dir, isRtl, lang } = useI18n();
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
  const [session, setSession] = useState<ClientSession | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<ClientReservation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [phoneModalId, setPhoneModalId] = useState<string | null>(null);
  const [phoneModalBusy, setPhoneModalBusy] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});

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
      toast.error(t("cd_toast_load_err"));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  // Unread counts (messages from chauffeur not yet read by client) — via
  // server fn because the table is locked to admins at the RLS level.
  const loadUnread = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const { countUnreadForClient } = await import("@/lib/chat.functions");
      const counts = await countUnreadForClient({ data: { reservation_ids: ids } });
      setUnread(counts);
    } catch (e) {
      console.warn("[client.dashboard] unread load failed", e);
    }
  }, []);

  useEffect(() => {
    if (!rows) return;
    const ids = rows.map((r) => r.id);
    loadUnread(ids);
    if (ids.length === 0) return;
    // Poll every 15s for unread updates (RLS blocks anon realtime here).
    const it = setInterval(() => loadUnread(ids), 15000);
    return () => clearInterval(it);
  }, [rows, loadUnread]);

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
      toast.success(t("cd_toast_time_changed"));
      setEditingId(null);
      setEditTime("");
      refresh();
    } catch (e: any) {
      toast.error(
        e?.message === "STATUS_LOCKED" ? t("cd_toast_locked_edit") : t("cd_toast_edit_failed"),
      );
    } finally {
      setBusy(null);
    }
  }

  async function onCancel(id: string) {
    if (!session) return;
    if (!confirm(t("cd_confirm_cancel"))) return;
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
      toast.success(t("cd_toast_cancelled"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message === "STATUS_LOCKED" ? t("cd_toast_locked_cancel") : t("cd_toast_cancel_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmPhoneCancel(id: string) {
    if (!session) return;
    setPhoneModalBusy(true);
    try {
      await requestPhoneCancellation({
        data: {
          account_id: session.id,
          phone: session.phone,
          email: session.email,
          reservation_id: id,
        },
      });
      toast.success("Demande d'annulation par téléphone enregistrée");
      setPhoneModalId(null);
      refresh();
      window.location.href = "tel:0673072322";
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setPhoneModalBusy(false);
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

  const greeting = useMemo(() => session?.name?.split(" ")[0] || "client", [session]);

  if (!ready || !session) return null;

  return (
    <main
      dir={dir}
      className="relative min-h-[100dvh] overflow-hidden px-4 py-8 sm:py-12"
      style={{
        background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)",
        textAlign: isRtl ? "right" : undefined,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col">
        <ClientAuthHeader backLabel={t("cd_back_home")} />

        {/* Header bar */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("cd_eyebrow")}</p>
            <h1
              className="mt-1 text-2xl font-bold text-white sm:text-3xl"
              style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
            >
              {t("client_dashboard_hello")} {greeting}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("cd_back")}
            </Link>
            <button
              onClick={logout}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
            >
              <LogOut className="h-3.5 w-3.5" /> {t("client_logout")}
            </button>
          </div>
        </div>

        {/* Actions */}
        {(() => {
          const lastRide = rows && rows.length > 0 ? rows[0] : null;
          const sameRideUrl = lastRide
            ? `/reserver?depart=${encodeURIComponent(lastRide.depart)}&destination=${encodeURIComponent(lastRide.destination || lastRide.arrivee || "")}`
            : null;
          return (
            <div className={`mb-6 grid gap-3 ${sameRideUrl ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <Link
                to="/reserver"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-black transition active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
              >
                <Plus className="h-4 w-4" /> {t("cd_book_ride")}
              </Link>
              {sameRideUrl && (
                <a
                  href={sameRideUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-5 py-3.5 text-sm font-semibold text-[#E8C96D] transition hover:bg-[#C9A84C]/20"
                >
                  <RotateCcw className="h-4 w-4" /> {t("cd_book_same")}
                </a>
              )}
              <a
                href="tel:0673072322"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Phone className="h-4 w-4" /> {t("cd_cancel_phone")}
              </a>
            </div>
          );
        })()}

        {/* Liste */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">{t("client_my_rides")}</h2>

          {loading && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10 text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("cd_loading")}
            </div>
          )}

          {!loading && rows && rows.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
              {t("client_no_rides")}
              <div className="mt-4">
                <Link
                  to="/reserver"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#E8C96D] px-4 py-2 text-xs font-semibold text-black"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("cd_book")}
                </Link>
              </div>
            </div>
          )}

          {!loading && rows && rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((r) => {
                const meta = STATUS_META[r.status];
                const status = {
                  label: meta ? t(meta.key) : r.status,
                  bg: meta?.bg || "rgba(255,255,255,0.08)",
                  fg: meta?.fg || "#fff",
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
                          <Calendar className="h-3.5 w-3.5" /> {fmtDate(r.pickup_datetime, locale)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.phone_cancel_requested_at && (
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                              style={{ background: "rgba(249,115,22,0.18)", color: "#fdba74" }}
                            >
                              {t("cd_phone_cancel_requested")}
                            </span>
                          )}
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ background: status.bg, color: status.fg }}
                          >
                            {status.label}
                          </span>
                        </div>
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
                          {t("cd_price_estimated")} :{" "}
                          <span className="font-semibold text-[#E8C96D]">{Number(r.prix_estime).toFixed(2)} €</span>
                        </div>
                      )}
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/10 bg-black/30 p-4 sm:p-5">
                        <div className="mb-4 grid gap-1.5 text-xs text-white/70">
                          <div>
                            {t("cd_passengers")} : {r.nb_passagers ?? r.passagers ?? 1}
                          </div>
                          <div>
                            {t("cd_luggage")} : {r.bagages ?? 0}
                          </div>
                          {r.paiement && (
                            <div>
                              {t("cd_payment")} : {r.paiement}
                            </div>
                          )}
                          <div className="text-white/40">
                            {t("cd_ref")} {(r.tracking_id || r.id).slice(0, 10)}
                          </div>
                        </div>

                        {editingId === r.id ? (
                          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                            <label className="mb-1.5 block text-xs text-white/70">{t("cd_new_datetime")}</label>
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
                                {busy === r.id ? "…" : t("cd_confirm")}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditTime("");
                                }}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
                              >
                                {t("cd_cancel")}
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
                              <Clock className="h-3.5 w-3.5" /> {t("cd_edit_time")}
                            </button>
                          )}

                          {isActive && (r.suivi_id || r.tracking_id) && (
                            <a
                              href={`/suivi/${r.suivi_id || r.tracking_id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black"
                              style={{
                                background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)",
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" /> {t("cd_track_ride")}
                            </a>
                          )}

                          {isActive && (
                            <button
                              onClick={() => setChatId(r.id)}
                              className="relative inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> {t("cd_chat")}
                              {unread[r.id] > 0 && (
                                <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                  {unread[r.id]}
                                </span>
                              )}
                            </button>
                          )}

                          {isActive && CANCELLABLE.has(r.status) && (
                            <button
                              onClick={() => onCancel(r.id)}
                              disabled={busy === r.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                            >
                              <X className="h-3.5 w-3.5" /> {t("cd_cancel")}
                            </button>
                          )}

                          {isCompleted && (
                            <>
                              <button
                                onClick={() => recommander(r)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black"
                                style={{
                                  background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)",
                                }}
                              >
                                <RotateCw className="h-3.5 w-3.5" /> {t("cd_recommend")}
                              </button>
                              <Link
                                to="/reserver"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                              >
                                <Plus className="h-3.5 w-3.5" /> {t("cd_new_ride")}
                              </Link>
                            </>
                          )}

                          {isActive && !r.phone_cancel_requested_at && (
                            <button
                              onClick={() => setPhoneModalId(r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                            >
                              <Phone className="h-3.5 w-3.5" /> {t("cd_cancel_phone")}
                            </button>
                          )}
                          {isActive && r.phone_cancel_requested_at && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40">
                              <Phone className="h-3.5 w-3.5" /> {t("cd_request_sent")}
                            </span>
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

      <AlertDialog open={!!phoneModalId} onOpenChange={(open) => !open && setPhoneModalId(null)}>
        <AlertDialogContent className="border-white/10 bg-[#111827]/95 text-white backdrop-blur">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t("cd_modal_title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {t("cd_modal_desc_before")} <span className="font-semibold text-[#E8C96D]">06 73 07 23 22</span>{" "}
              {t("cd_modal_desc_after")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPhoneModalId(null)}
              className="border-white/10 bg-transparent text-white hover:bg-white/5"
            >
              {t("cd_back")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => phoneModalId && onConfirmPhoneCancel(phoneModalId)}
              disabled={phoneModalBusy}
              className="text-black"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            >
              {phoneModalBusy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Phone className="mr-1 h-3.5 w-3.5" />
              )}
              {t("cd_confirm_and_call")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {chatId && <ChatPanel reservationId={chatId} role="client" peerName="José 🚖" onClose={() => setChatId(null)} />}

      {/* ── Chat général avec José ── */}
      {session && (
        <section
          style={{
            maxWidth: 720,
            margin: "32px auto 0",
            padding: "0 16px 40px",
            width: "100%",
          }}
        >
          <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>💬 Message à José</div>
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
              height: 480,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <DirectChatPanel accountId={session.id} role="client" peerName="José 🚖" />
          </div>
        </section>
      )}
    </main>
  );
}
