import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Plus, Trash2, Home, Briefcase, Plane, MapPin, ExternalLink, Repeat, Power } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { toast } from "sonner";
import { ClientBottomNav } from "@/components/ClientBottomNav";
import { useT } from "@/i18n/I18nProvider";
import { getClientSession, clearClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import {
  listClientFavorites,
  upsertClientFavorite,
  deleteClientFavorite,
  type ClientFavorite,
} from "@/lib/client-favorites.functions";
import {
  listRecurringRides,
  createRecurringRide,
  toggleRecurringRide,
  deleteRecurringRide,
  type RecurringRide,
} from "@/lib/client-recurring.functions";

export const Route = createFileRoute("/client/profil")({
  head: () => ({
    meta: [{ title: "Mon profil — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientProfil,
});

const ICONS: Record<string, typeof Home> = {
  home: Home,
  briefcase: Briefcase,
  plane: Plane,
  pin: MapPin,
};

const PRESETS = [
  { label: "Maison", icon: "home", tKey: "profil.favorites.preset.home" },
  { label: "Bureau", icon: "briefcase", tKey: "profil.favorites.preset.office" },
  { label: "Aéroport", icon: "plane", tKey: "profil.favorites.preset.airport" },
  { label: "Autre", icon: "pin", tKey: "profil.favorites.preset.other" },
];

function ClientProfil() {
  const t = useT();
  const navigate = useNavigate();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [favorites, setFavorites] = useState<ClientFavorite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [formLabel, setFormLabel] = useState("Maison");
  const [formIcon, setFormIcon] = useState("home");
  const [formAddress, setFormAddress] = useState("");
  const [busy, setBusy] = useState(false);

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
      const data = await listClientFavorites({ data: { account_id: session.id } });
      setFavorites(data);
    } catch {
      toast.error("Impossible de charger vos favoris");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  async function onSave() {
    if (!session || !formAddress.trim()) {
      toast.error("Adresse requise");
      return;
    }
    setBusy(true);
    try {
      await upsertClientFavorite({
        data: {
          account_id: session.id,
          label: formLabel.trim() || "Adresse",
          address: formAddress.trim(),
          icon: formIcon,
        },
      });
      toast.success("Adresse ajoutée");
      setAdding(false);
      setFormLabel("Maison");
      setFormIcon("home");
      setFormAddress("");
      refresh();
    } catch {
      toast.error(t("profil.company.toast.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!session) return;
    if (!confirm("Supprimer cette adresse favorite ?")) return;
    try {
      await deleteClientFavorite({ data: { account_id: session.id, id } });
      refresh();
    } catch {
      toast.error("Échec de la suppression");
    }
  }

  function logout() {
    clearClientSession();
    navigate({ to: "/" });
  }

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
          <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("profil.eyebrow")}</p>
          <h1
            className="mt-1 text-2xl font-bold text-white sm:text-3xl"
            style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
          >
            {t("profil.title")}
          </h1>
        </div>

        {/* Identity card */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-black"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            >
              {(session.name || session.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-white">{session.name || t("profil.client_vip")}</div>
              <div className="truncate text-xs text-white/60">{session.email}</div>
              <div className="truncate text-xs text-white/60">{session.phone}</div>
            </div>
          </div>
        </section>

        {/* Favorites */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">{t("profil.favorites.title")}</h2>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
              >
                <Plus className="h-3.5 w-3.5" /> {t("profil.favorites.add")}
              </button>
            )}
          </div>

          {adding && (
            <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="mb-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => {
                  const Icon = ICONS[p.icon];
                  const active = formLabel === p.label && formIcon === p.icon;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFormLabel(p.label);
                        setFormIcon(p.icon);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition"
                      style={{
                        borderColor: active ? "#C9A84C" : "rgba(255,255,255,0.15)",
                        background: active ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                        color: active ? "#E8C96D" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" /> {t(p.tKey)}
                    </button>
                  );
                })}
              </div>
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={t("profil.favorites.name_ph")}
                className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
              />
              <input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder={t("profil.favorites.address_ph")}
                className="mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
              />
              <div className="flex gap-2">
                <button
                  onClick={onSave}
                  disabled={busy}
                  className="flex-1 rounded-lg px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
                >
                  {busy ? "…" : t("profil.common.save")}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5"
                >
                  {t("profil.common.cancel")}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
              <BrandLoader size={20} /> {t("profil.common.loading")}
            </div>
          )}

          {!loading && favorites && favorites.length === 0 && !adding && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
              {t("profil.favorites.empty")}
            </div>
          )}

          {!loading && favorites && favorites.length > 0 && (
            <ul className="space-y-2">
              {favorites.map((f) => {
                const Icon = ICONS[f.icon || "pin"] || MapPin;
                return (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "rgba(201,168,76,0.15)", color: "#E8C96D" }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{f.label}</div>
                      <div className="truncate text-xs text-white/60">{f.address}</div>
                    </div>
                    <a
                      href={`/reserver?depart=${encodeURIComponent(f.address)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#E8C96D]"
                      title={t("profil.favorites.book_from")}
                    >
                      <ExternalLink className="h-3 w-3" /> {t("profil.favorites.book")}
                    </a>
                    <button
                      onClick={() => onDelete(f.id)}
                      className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-red-300"
                      aria-label={t("profil.favorites.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <RecurringRidesSection accountId={session.id} />

        <CompanyInfoSection accountId={session.id} />

        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" /> {t("profil.logout")}
        </button>
      </div>

      <ClientBottomNav />
    </main>
  );
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function RecurringRidesSection({ accountId }: { accountId: string }) {
  const t = useT();
  const [rides, setRides] = useState<RecurringRide[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    label: "Domicile → Aéroport",
    depart: "",
    destination: "",
    day_of_week: 5,
    hour: 7,
    minute: 0,
    passagers: 1,
    bagages: 1,
    paiement: "cb" as "cb" | "especes",
    message: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRecurringRides({ data: { account_id: accountId } });
      setRides(data);
    } catch {
      toast.error(t("profil.recurring.toast.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate() {
    if (!form.depart.trim() || !form.destination.trim()) {
      toast.error(t("profil.recurring.toast.required"));
      return;
    }
    setBusy(true);
    try {
      await createRecurringRide({ data: { account_id: accountId, ...form } });
      toast.success(t("profil.recurring.toast.created"));
      setAdding(false);
      setForm({
        label: "Domicile → Aéroport",
        depart: "",
        destination: "",
        day_of_week: 5,
        hour: 7,
        minute: 0,
        passagers: 1,
        bagages: 1,
        paiement: "cb",
        message: "",
      });
      refresh();
    } catch {
      toast.error(t("profil.recurring.toast.create_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(r: RecurringRide) {
    try {
      await toggleRecurringRide({ data: { account_id: accountId, id: r.id, active: !r.active } });
      refresh();
    } catch {
      toast.error(t("profil.recurring.toast.failed"));
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t("profil.recurring.confirm_delete"))) return;
    try {
      await deleteRecurringRide({ data: { account_id: accountId, id } });
      refresh();
    } catch {
      toast.error(t("profil.recurring.toast.failed"));
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
          <Repeat className="h-4 w-4" /> {t("profil.recurring.title")}
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
            style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
          >
            <Plus className="h-3.5 w-3.5" /> {t("profil.recurring.new")}
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder={t("profil.recurring.label_ph")}
            className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <input
            value={form.depart}
            onChange={(e) => setForm({ ...form, depart: e.target.value })}
            placeholder={t("profil.recurring.depart_ph")}
            className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <input
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            placeholder={t("profil.recurring.dest_ph")}
            className="mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <div className="mb-3 grid grid-cols-3 gap-2">
            <select
              value={form.day_of_week}
              onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value, 10) })}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i} className="bg-black">
                  {d}
                </option>
              ))}
            </select>
            <select
              value={form.hour}
              onChange={(e) => setForm({ ...form, hour: parseInt(e.target.value, 10) })}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i} className="bg-black">
                  {String(i).padStart(2, "0")}h
                </option>
              ))}
            </select>
            <select
              value={form.minute}
              onChange={(e) => setForm({ ...form, minute: parseInt(e.target.value, 10) })}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m} className="bg-black">
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <select
              value={form.passagers}
              onChange={(e) => setForm({ ...form, passagers: parseInt(e.target.value, 10) })}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n} className="bg-black">
                  {n} pax
                </option>
              ))}
            </select>
            <select
              value={form.bagages}
              onChange={(e) => setForm({ ...form, bagages: parseInt(e.target.value, 10) })}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n} className="bg-black">
                  {n} bag.
                </option>
              ))}
            </select>
            <select
              value={form.paiement}
              onChange={(e) => setForm({ ...form, paiement: e.target.value as "cb" | "especes" })}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-[#E8C96D]"
            >
              <option value="cb" className="bg-black">
                CB
              </option>
              <option value="especes" className="bg-black">
                Espèces
              </option>
            </select>
          </div>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value.slice(0, 500) })}
            placeholder={t("profil.recurring.msg_ph")}
            rows={2}
            className="mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <div className="flex gap-2">
            <button
              onClick={onCreate}
              disabled={busy}
              className="flex-1 rounded-lg px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            >
              {busy ? "…" : t("profil.recurring.create")}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5"
            >
              {t("profil.common.cancel")}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {t("profil.recurring.auto_note")}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
          <BrandLoader size={20} /> {t("profil.common.loading")}
        </div>
      )}

      {!loading && rides && rides.length === 0 && !adding && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
          {t("profil.recurring.empty")}
        </div>
      )}

      {!loading && rides && rides.length > 0 && (
        <ul className="space-y-2">
          {rides.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur"
              style={{ opacity: r.active ? 1 : 0.55 }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(201,168,76,0.15)", color: "#E8C96D" }}
                >
                  <Repeat className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{r.label}</div>
                  <div className="truncate text-xs text-white/60">
                    {r.depart} → {r.destination}
                  </div>
                  <div className="mt-1 text-[11px] text-[#E8C96D]">
                    {t("profil.recurring.every")} {t(`profil.recurring.day.${["sun","mon","tue","wed","thu","fri","sat"][r.day_of_week]}`)}. {t("profil.recurring.at")} {String(r.hour).padStart(2, "0")}h{String(r.minute).padStart(2, "0")} · {r.passagers} {t("profil.recurring.pax")} · {r.bagages} {t("profil.recurring.bag")}
                  </div>
                </div>
                <button
                  onClick={() => onToggle(r)}
                  className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-[#E8C96D]"
                  aria-label={r.active ? t("profil.recurring.pause") : t("profil.recurring.activate")}
                  title={r.active ? t("profil.recurring.pause") : t("profil.recurring.activate")}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-red-300"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompanyInfoSection({ accountId }: { accountId: string }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({
    company_name: "",
    siret: "",
    tva_intracom: "",
    billing_address: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { getClientCompanyInfo } = await import("@/lib/client-billing.functions");
      const data = await getClientCompanyInfo({ data: { account_id: accountId } });
      setCompany({
        company_name: data.company_name ?? "",
        siret: data.siret ?? "",
        tva_intracom: data.tva_intracom ?? "",
        billing_address: data.billing_address ?? "",
      });
    } catch {
      // silencieux : section optionnelle
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save() {
    setSaving(true);
    try {
      const { updateClientCompanyInfo } = await import("@/lib/client-billing.functions");
      await updateClientCompanyInfo({
        data: {
          account_id: accountId,
          company_name: company.company_name.trim() || null,
          siret: company.siret.trim() || null,
          tva_intracom: company.tva_intracom.trim() || null,
          billing_address: company.billing_address.trim() || null,
        },
      });
      toast.success(t("profil.company.toast.saved"));
    } catch {
      toast.error(t("profil.company.toast.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#E8C96D]"
          style={{ fontFamily: "'Syne', serif" }}
        >
          <Briefcase className="h-3.5 w-3.5" /> {t("profil.company.title")}
        </h2>
        <Link
          to="/client/factures"
          className="inline-flex items-center gap-1 rounded-lg border border-[#E8C96D]/40 bg-[#E8C96D]/10 px-3 py-1.5 text-[11px] font-semibold text-[#E8C96D] hover:bg-[#E8C96D]/20"
        >
          {t("profil.company.invoices_link")}
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
          <BrandLoader size={18} /> {t("profil.common.loading")}
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-2 text-xs text-white/50">
            {t("profil.company.optional")}
          </p>
          <input
            value={company.company_name}
            onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
            placeholder={t("profil.company.name_ph")}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={company.siret}
              onChange={(e) => setCompany({ ...company, siret: e.target.value })}
              placeholder={t("profil.company.siret_ph")}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
            />
            <input
              value={company.tva_intracom}
              onChange={(e) => setCompany({ ...company, tva_intracom: e.target.value })}
              placeholder={t("profil.company.tva_ph")}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
            />
          </div>
          <textarea
            value={company.billing_address}
            onChange={(e) => setCompany({ ...company, billing_address: e.target.value })}
            placeholder={t("profil.company.billing_ph")}
            rows={2}
            className="w-full resize-none rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            >
              {saving ? "…" : t("profil.common.save")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
