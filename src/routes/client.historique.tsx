import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, ArrowRight, Download, FileText, Search } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { toast } from "sonner";
import { ClientBottomNav } from "@/components/ClientBottomNav";
import { getClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import { listClientReservations, type ClientReservation } from "@/lib/client-reservations.functions";
import { downloadReceiptPDF, exportReservationsCSV } from "@/lib/client-receipt";
import { useT } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/client/historique")({
  head: () => ({
    meta: [{ title: "Historique — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientHistorique,
});

const PAST = new Set(["completed", "cancelled", "refused"]);

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

function ClientHistorique() {
  const navigate = useNavigate();
  const t = useT();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [rows, setRows] = useState<ClientReservation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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
      setRows(data.filter((r) => PAST.has(r.status)));
    } catch {
      toast.error(t("client.historique.load_err"));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  // Realtime — re-fetch si une course terminée/annulée apparaît
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("historique-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, refresh]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86400000 : null;
    return rows.filter((r) => {
      const ts = new Date(r.pickup_datetime).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (q) {
        const hay = `${r.depart} ${r.arrivee || ""} ${r.destination || ""} ${r.tracking_id || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, from, to]);

  const totalEur = useMemo(
    () => (filtered || []).reduce((sum, r) => sum + (r.prix_estime ? Number(r.prix_estime) : 0), 0),
    [filtered],
  );

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
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("client.eyebrow")}</p>
          <h1
            className="mt-1 text-2xl font-bold text-white sm:text-3xl"
            style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
          >
            {t("client.historique.title")}
          </h1>
        </div>

        {/* Filters */}
        <div className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur sm:grid-cols-4">
          <label className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("client.historique.search_ph")}
              className="w-full rounded-lg border border-white/15 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
            />
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
          />
        </div>

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-xs text-white/60">
            {filtered ? `${filtered.length} ${t("client.historique.courses_total")} — ${totalEur.toFixed(2)} €` : "—"}
          </div>
          <button
            disabled={!filtered || filtered.length === 0}
            onClick={() => filtered && exportReservationsCSV(filtered)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> {t("client.historique.export_csv")}
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10 text-white/60">
            <BrandLoader size={20} /> {t("client.trajets.loading")}
          </div>
        )}

        {!loading && filtered && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">
            {t("client.historique.empty")}
          </div>
        )}

        {!loading && filtered && filtered.length > 0 && (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const dest = r.arrivee || r.destination || "—";
              const isCompleted = r.status === "completed";
              return (
                <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                      <Calendar className="h-3.5 w-3.5" /> {fmtDate(r.pickup_datetime)}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: isCompleted ? "rgba(148,163,184,0.18)" : "rgba(239,68,68,0.18)",
                        color: isCompleted ? "#cbd5e1" : "#fca5a5",
                      }}
                    >
                      {isCompleted
                        ? t("client.historique.completed")
                        : r.status === "cancelled"
                          ? t("client.historique.cancelled")
                          : t("client.historique.refused")}
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
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-white/60">
                      {t("client.historique.ref")} {(r.tracking_id || r.id).slice(0, 10)}
                      {r.prix_estime != null && (
                        <>
                          {" — "}
                          <span className="font-semibold text-[#E8C96D]">{Number(r.prix_estime).toFixed(2)} €</span>
                        </>
                      )}
                    </div>
                    {isCompleted && (
                      <button
                        onClick={() =>
                          downloadReceiptPDF(r, {
                            name: session.name,
                            email: session.email,
                            phone: session.phone,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black"
                        style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
                      >
                        <FileText className="h-3.5 w-3.5" /> {t("client.historique.receipt_pdf")}
                      </button>
                    )}
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
