import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Calendar, MapPin, ArrowRight, Eye, Plus, RefreshCw, Share2 } from "lucide-react";
import { shareRideTracking } from "@/lib/share-ride";
import { BrandLoader } from "@/components/BrandLoader";
import { toast } from "sonner";
import { ClientBottomNav } from "@/components/ClientBottomNav";
import { getClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import { listClientReservations, type ClientReservation } from "@/lib/client-reservations.functions";
import { useT } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/client/trajets")({
  head: () => ({
    meta: [{ title: "Mes trajets — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientTrajets,
});

const ACTIVE = new Set(["nouvelle", "pending", "accepted", "en_route", "arrived"]);

const STATUS_KEY: Record<string, { key: string; bg: string; fg: string }> = {
  nouvelle: { key: "cd_status_pending", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  pending: { key: "cd_status_pending", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  accepted: { key: "cd_status_accepted", bg: "rgba(34,197,94,0.15)", fg: "#4ade80" },
  en_route: { key: "cd_status_en_route", bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  arrived: { key: "cd_status_arrived", bg: "rgba(99,102,241,0.18)", fg: "#a5b4fc" },
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

function ClientTrajets() {
  const navigate = useNavigate();
  const t = useT();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [rows, setRows] = useState<ClientReservation[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getClientSession();
    if (!s) {
      navigate({ to: "/client/login" });
      return;
    }
    setSession(s);
  }, [navigate]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await listClientReservations({
        data: { account_id: session.id, phone: session.phone, email: session.email },
      });
      setRows(data.filter((r) => ACTIVE.has(r.status)));
    } catch {
      toast.error(t("client.trajets.load_err"));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  // Realtime — re-fetch dès qu'une réservation active change
  useEffect(() => {
    if (!session || !rows || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    const channel = supabase
      .channel("trajets-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations", filter: `id=in.(${ids.join(",")})` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, rows, refresh]);

  if (!session) return null;

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden px-4 py-8"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #C9A84C 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("client.eyebrow")}</p>
            <h1
              className="mt-1 text-2xl font-bold text-white sm:text-3xl"
              style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
            >
              {t("client.trajets.title")}
            </h1>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t("client.trajets.refresh")}
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10 text-white/60">
            <BrandLoader size={20} /> {t("client.trajets.loading")}
          </div>
        )}

        {!loading && rows && rows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
            {t("client.trajets.empty")}
            <div className="mt-4">
              <Link
                to="/reserver"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-black"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
              >
                <Plus className="h-3.5 w-3.5" /> {t("client.trajets.new_reservation")}
              </Link>
            </div>
          </div>
        )}

        {!loading && rows && rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((r) => {
              const meta = STATUS_KEY[r.status] || { key: r.status, bg: "rgba(255,255,255,0.08)", fg: "#fff" };
              const dest = r.arrivee || r.destination || "—";
              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                      <Calendar className="h-3.5 w-3.5" /> {fmtDate(r.pickup_datetime)}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {t(meta.key)}
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
                    <div className="mt-2 text-xs text-white/60">
                      {t("client.trajets.estimated")} :{" "}
                      <span className="font-semibold text-[#E8C96D]">{Number(r.prix_estime).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/reservation/${r.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black"
                      style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
                    >
                      <Eye className="h-3.5 w-3.5" /> {t("client.trajets.follow")}
                    </a>
                    <button
                      onClick={() =>
                        shareRideTracking({
                          id: r.id,
                          suivi_id: r.suivi_id,
                          tracking_id: r.tracking_id,
                          depart: r.depart,
                          destination: r.arrivee || r.destination,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                    >
                      <Share2 className="h-3.5 w-3.5" /> {t("client.trajets.share")}
                    </button>
                    <Link
                      to="/client/dashboard"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10"
                    >
                      {t("client.trajets.details")}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ClientBottomNav />
    </main>
  );
}
