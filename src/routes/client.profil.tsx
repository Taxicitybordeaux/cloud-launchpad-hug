import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Plus, Trash2, Home, Briefcase, Plane, MapPin, ExternalLink, Repeat, Power } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { toast } from "sonner";
import { ClientBottomNav } from "@/components/ClientBottomNav";
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
  { label: "Maison", icon: "home" },
  { label: "Bureau", icon: "briefcase" },
  { label: "Aéroport", icon: "plane" },
  { label: "Autre", icon: "pin" },
];

function ClientProfil() {
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
      toast.error("Échec de l'enregistrement");
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
          <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">Espace client</p>
          <h1
            className="mt-1 text-2xl font-bold text-white sm:text-3xl"
            style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
          >
            Mon profil
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
              <div className="truncate text-base font-semibold text-white">{session.name || "Client VIP"}</div>
              <div className="truncate text-xs text-white/60">{session.email}</div>
              <div className="truncate text-xs text-white/60">{session.phone}</div>
            </div>
          </div>
        </section>

        {/* Favorites */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Adresses favorites</h2>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
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
                      <Icon className="h-3.5 w-3.5" /> {p.label}
                    </button>
                  );
                })}
              </div>
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Nom (ex. Maison)"
                className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
              />
              <input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Adresse complète"
                className="mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
              />
              <div className="flex gap-2">
                <button
                  onClick={onSave}
                  disabled={busy}
                  className="flex-1 rounded-lg px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
                >
                  {busy ? "…" : "Enregistrer"}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
              <BrandLoader size={20} /> Chargement…
            </div>
          )}

          {!loading && favorites && favorites.length === 0 && !adding && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
              Aucune adresse favorite. Ajoutez Maison, Bureau, Aéroport… pour réserver en 1 clic.
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
                      title="Réserver depuis cette adresse"
                    >
                      <ExternalLink className="h-3 w-3" /> Réserver
                    </a>
                    <button
                      onClick={() => onDelete(f.id)}
                      className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-red-300"
                      aria-label="Supprimer"
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
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </div>

      <ClientBottomNav />
    </main>
  );
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function RecurringRidesSection({ accountId }: { accountId: string }) {
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
      toast.error("Impossible de charger vos trajets récurrents");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate() {
    if (!form.depart.trim() || !form.destination.trim()) {
      toast.error("Départ et destination requis");
      return;
    }
    setBusy(true);
    try {
      await createRecurringRide({ data: { account_id: accountId, ...form } });
      toast.success("Trajet récurrent créé");
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
      toast.error("Échec de la création");
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(r: RecurringRide) {
    try {
      await toggleRecurringRide({ data: { account_id: accountId, id: r.id, active: !r.active } });
      refresh();
    } catch {
      toast.error("Échec");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer ce trajet récurrent ?")) return;
    try {
      await deleteRecurringRide({ data: { account_id: accountId, id } });
      refresh();
    } catch {
      toast.error("Échec");
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
          <Repeat className="h-4 w-4" /> Trajets récurrents
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
            style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Nouveau
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Nom du trajet (ex. Aéroport vendredi matin)"
            className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <input
            value={form.depart}
            onChange={(e) => setForm({ ...form, depart: e.target.value })}
            placeholder="Adresse de départ"
            className="mb-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#E8C96D]"
          />
          <input
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
            placeholder="Adresse d'arrivée"
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
            placeholder="Demandes spéciales (siège bébé, animal…)"
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
              {busy ? "…" : "Créer le trajet récurrent"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5"
            >
              Annuler
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            Chaque semaine, votre course est réservée automatiquement 24h à l'avance.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
          <BrandLoader size={20} /> Chargement…
        </div>
      )}

      {!loading && rides && rides.length === 0 && !adding && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
          Aucun trajet récurrent. Programmez vos déplacements habituels (domicile → aéroport, bureau…) pour qu'ils soient réservés automatiquement chaque semaine.
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
                    Chaque {DAYS[r.day_of_week]}. à {String(r.hour).padStart(2, "0")}h
                    {String(r.minute).padStart(2, "0")} · {r.passagers} pax · {r.bagages} bag.
                  </div>
                </div>
                <button
                  onClick={() => onToggle(r)}
                  className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-[#E8C96D]"
                  aria-label={r.active ? "Mettre en pause" : "Activer"}
                  title={r.active ? "Mettre en pause" : "Activer"}
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
