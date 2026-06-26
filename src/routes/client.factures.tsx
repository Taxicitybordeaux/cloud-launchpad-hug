import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Download, ArrowLeft, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { BrandLoader } from "@/components/BrandLoader";
import { ClientBottomNav } from "@/components/ClientBottomNav";
import { useT } from "@/i18n/I18nProvider";
import { getClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import {
  getClientCompanyInfo,
  listCompletedForBilling,
  type CompanyInfo,
  type InvoiceRow,
} from "@/lib/client-billing.functions";
import { downloadMonthlyInvoicePDF, downloadYearlyInvoicePDF } from "@/lib/client-invoices";

export const Route = createFileRoute("/client/factures")({
  head: () => ({
    meta: [{ title: "Mes factures — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientFactures,
});

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function ClientFactures() {
  const navigate = useNavigate();
  const t = useT();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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
      const [comp, data] = await Promise.all([
        getClientCompanyInfo({ data: { account_id: session.id } }),
        listCompletedForBilling({
          data: {
            account_id: session.id,
            phone: session.phone,
            email: session.email,
            from: new Date(year, 0, 1).toISOString(),
            to: new Date(year + 1, 0, 1).toISOString(),
          },
        }),
      ]);
      setCompany(comp);
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de charger vos factures");
    } finally {
      setLoading(false);
    }
  }, [session, year]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  const byMonth = useMemo(() => {
    const map = new Map<number, InvoiceRow[]>();
    for (const r of rows ?? []) {
      const m = new Date(r.date).getMonth() + 1;
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(r);
    }
    return map;
  }, [rows]);

  const totalYear = useMemo(() => (rows ?? []).reduce((s, r) => s + r.prix_estime, 0), [rows]);

  function downloadMonth(month: number) {
    if (!session || !company) return;
    const list = byMonth.get(month) ?? [];
    if (list.length === 0) return;
    setBusy(`m-${month}`);
    try {
      downloadMonthlyInvoicePDF({
        accountId: session.id,
        year,
        month,
        rows: list,
        client: { name: session.name || "", email: session.email || "", phone: session.phone || "" },
        company,
      });
    } finally {
      setBusy(null);
    }
  }

  function downloadYear() {
    if (!session || !company || !rows || rows.length === 0) return;
    setBusy("year");
    try {
      downloadYearlyInvoicePDF({
        accountId: session.id,
        year,
        rows,
        client: { name: session.name || "", email: session.email || "", phone: session.phone || "" },
        company,
      });
    } finally {
      setBusy(null);
    }
  }

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  return (
    <main
      className="relative min-h-[100dvh] px-4 pt-8 pb-4"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)" }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <Link
            to="/client/profil"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Profil
          </Link>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("client.eyebrow")}</p>
          <h1
            className="mt-1 flex items-center gap-2 text-2xl font-bold text-white sm:text-3xl"
            style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
          >
            <FileText className="h-6 w-6 text-[#E8C96D]" /> {t("client.factures.title")}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {t("client.factures.subtitle")}
          </p>
        </div>

        {!company?.company_name && (
          <div className="mb-5 rounded-xl border border-[#E8C96D]/30 bg-[#E8C96D]/5 p-4">
            <div className="flex items-start gap-3">
              <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-[#E8C96D]" />
              <div className="flex-1 text-sm text-white/80">
                {t("client.factures.company_prompt")}
                <Link
                  to="/client/profil"
                  className="ml-2 font-semibold text-[#E8C96D] underline-offset-2 hover:underline"
                >
                  {t("client.factures.complete_profile")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-white/60">
            <BrandLoader size={20} /> {t("client.trajets.loading")}
          </div>
        ) : (rows ?? []).length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
            {t("client.factures.empty_year")} {year}.
          </div>
        ) : (
          <>
            {/* Récap annuel */}
            <div
              className="mb-6 rounded-2xl border border-[#E8C96D]/30 p-5"
              style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.10), rgba(232,201,109,0.04))" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("client.factures.year_label")} {year}</p>
                  <p
                    className="mt-1 text-2xl font-bold text-white"
                    style={{ fontFamily: "'Syne', serif" }}
                  >
                    {totalYear.toFixed(2)} €{" "}
                    <span className="text-sm font-normal text-white/60">/ {(rows ?? []).length} {t("client.factures.courses")}</span>
                  </p>
                </div>
                <button
                  onClick={downloadYear}
                  disabled={busy === "year"}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
                >
                  <Download className="h-4 w-4" /> {t("client.factures.year_pdf")}
                </button>
              </div>
            </div>

            {/* Par mois */}
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/50">{t("client.factures.by_month")}</p>
            <div className="space-y-2.5">
              {Array.from(byMonth.entries())
                .sort(([a], [b]) => b - a)
                .map(([month, list]) => {
                  const total = list.reduce((s, r) => s + r.prix_estime, 0);
                  return (
                    <div
                      key={month}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div>
                        <div className="text-sm font-semibold capitalize text-white">{monthLabel(year, month)}</div>
                        <div className="text-xs text-white/50">
                          {list.length} course{list.length > 1 ? "s" : ""} · {total.toFixed(2)} €
                        </div>
                      </div>
                      <button
                        onClick={() => downloadMonth(month)}
                        disabled={busy === `m-${month}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8C96D]/40 px-3 py-2 text-xs font-semibold text-[#E8C96D] hover:bg-[#E8C96D]/10 disabled:opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
      <ClientBottomNav />
    </main>
  );
}
