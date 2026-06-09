import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Edit2,
  LogOut,
  MapPin,
  Phone,
  RotateCcw,
  User,
  X,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { notifyReservationStatus } from "@/lib/push_functions";

export const Route = createFileRoute("/client")({
  head: () => ({
    meta: [
      { title: "Mon espace – Taxi City Bordeaux" },
      {
        name: "description",
        content:
          "Gérez vos réservations de taxi à Bordeaux. Consultez votre historique, reréservez ou modifiez vos courses facilement.",
      },
    ],
  }),
  component: ClientSpace,
});

const PHONE = "0673072322";
const PHONE_DISPLAY = "06 73 07 23 22";

/* ─── Types ─────────────────────────────────────────────────── */
type Reservation = {
  id: string;
  depart: string;
  arrivee: string;
  pickup_datetime: string;
  status: "pending" | "accepted" | "en_route" | "arrived" | "completed" | "cancelled";
  prix_estime?: number;
  created_at: string;
};

/* ─── Helpers ────────────────────────────────────────────────── */
function statusLabel(s: Reservation["status"]) {
  return (
    {
      pending: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
      accepted: { label: "Acceptée", cls: "bg-blue-100 text-blue-800" },
      en_route: { label: "En route", cls: "bg-indigo-100 text-indigo-800" },
      arrived: { label: "Taxi arrivé", cls: "bg-purple-100 text-purple-800" },
      completed: { label: "Terminée", cls: "bg-green-100 text-green-800" },
      cancelled: { label: "Annulée", cls: "bg-red-100 text-red-800" },
    }[s] ?? { label: s, cls: "bg-gray-100 text-gray-800" }
  );
}

function formatDate(iso: string) {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Retourne true seulement si la course est encore en attente côté José */
function canModify(s: Reservation["status"]) {
  return s === "pending";
}

/* ─── Page principale ────────────────────────────────────────── */
function ClientSpace() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? "" } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? "" } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <PageLoader />;
  if (!user) return <AuthGate onAuth={setUser} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

/* ─── Loader ─────────────────────────────────────────────────── */
function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/* ─── Auth Gate ──────────────────────────────────────────────── */
function AuthGate({ onAuth }: { onAuth: (u: { id: string; email: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        const u = data.session?.user;
        if (u) onAuth({ id: u.id, email: u.email ?? "" });
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        const u = data.session?.user ?? data.user;
        if (u) onAuth({ id: u.id, email: u.email ?? "" });
        else setError("Un e-mail de confirmation vous a été envoyé. Vérifiez votre boîte.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      if (msg.includes("Invalid login credentials")) setError("Email ou mot de passe incorrect.");
      else if (msg.includes("User already registered")) setError("Ce compte existe déjà. Connectez-vous.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-10 sm:pt-16">
      <div className="mb-8 flex justify-center">
        <img src={logo} alt="Taxi City Bordeaux" className="h-16 w-auto sm:h-20" />
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-6 flex rounded-xl border border-border p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Connexion" : "Créer un compte"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Adresse e-mail</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Mot de passe</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : mode === "login" ? (
              <>
                Se connecter <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Créer mon compte <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Besoin d'aide ?{" "}
          <a href={`tel:${PHONE}`} className="text-primary underline underline-offset-2">
            {PHONE_DISPLAY}
          </a>
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────── */
function Dashboard({ user, onLogout }: { user: { id: string; email: string }; onLogout: () => void }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [modifyTarget, setModifyTarget] = useState<Reservation | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchReservations();
  }, [user.email]);

  async function fetchReservations() {
    setLoading(true);
    // Filtre par email (pas de user_id dans la table reservations)
    const { data } = await supabase
      .from("reservations")
      .select("id,depart,arrivee,pickup_datetime,status,prix_estime,created_at")
      .or(`client_email.eq.${user.email},email.eq.${user.email}`)
      .order("pickup_datetime", { ascending: false });
    setReservations((data as Reservation[]) ?? []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    onLogout();
  }

  /** Annulation — uniquement si pending */
  async function handleCancel(id: string) {
    const res = reservations.find((r) => r.id === id);
    if (!res || res.status !== "pending") {
      showToast("Cette course ne peut plus être annulée en ligne. Appelez le " + PHONE_DISPLAY, "error");
      return;
    }

    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);

    if (error) {
      showToast("Impossible d'annuler. Appelez-nous.", "error");
      return;
    }

    // Push FCM à José
    try {
      await notifyReservationStatus({ data: { reservation_id: id, status: "cancelled" } });
    } catch (e) {
      console.warn("[client] notifyReservationStatus cancelled failed", e);
    }

    showToast("Course annulée.", "success");
    setSelected(null);
    fetchReservations();
  }

  /** Modification d'heure — uniquement si pending */
  async function handleModify(id: string, newDatetime: string) {
    const res = reservations.find((r) => r.id === id);
    if (!res || res.status !== "pending") {
      showToast("Cette course ne peut plus être modifiée en ligne. Appelez le " + PHONE_DISPLAY, "error");
      return;
    }

    const { error } = await supabase.from("reservations").update({ pickup_datetime: newDatetime }).eq("id", id);

    if (error) {
      showToast("Impossible de modifier. Appelez-nous.", "error");
      return;
    }

    // Push FCM à José pour l'informer de la modification
    // On réutilise le canal "accepted" (seul statut chauffeur disponible)
    // mais on forge un push custom via sendPushToAudience si besoin ;
    // ici on notifie côté client → José voit le push chauffeur.
    // On envoie un push "accepted" qui sera remplacé dans la file par le même tag.
    // Pour une notif custom "modifiée", on peut étendre notifyReservationStatus ;
    // pour l'instant on appelle accepted qui pushera José avec le nouveau détail.
    try {
      // On crée une notif générique via le canal status — "accepted" push le chauffeur
      // avec l'URL /suivi/{id}?gps=1 et le bon tag → remplace l'éventuelle notif précédente.
      // TODO: ajouter un statut "modified" dans notifyReservationStatus si besoin d'un label dédié.
      await notifyReservationStatus({ data: { reservation_id: id, status: "accepted" } });
    } catch (e) {
      console.warn("[client] notifyReservationStatus modify failed", e);
    }

    showToast("Heure modifiée. José a été notifié.", "success");
    setModifyTarget(null);
    setSelected(null);
    fetchReservations();
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const upcoming = reservations.filter((r) => ["pending", "accepted", "en_route", "arrived"].includes(r.status));
  const past = reservations.filter((r) => ["completed", "cancelled"].includes(r.status));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:pt-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Taxi City Bordeaux" className="h-10 w-auto sm:h-12" />
          <div>
            <p className="text-xs text-muted-foreground">Mon espace</p>
            <p className="max-w-[180px] truncate text-sm font-semibold sm:max-w-none">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-destructive/50 hover:text-destructive active:scale-95"
        >
          <LogOut className="h-3.5 w-3.5" /> Déconnexion
        </button>
      </div>

      {/* CTA nouvelle réservation */}
      <Link
        to="/reservation"
        className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 transition hover:bg-primary/10 active:scale-[0.99]"
      >
        <div>
          <p className="font-semibold">Nouvelle réservation</p>
          <p className="text-sm text-muted-foreground">Réserver votre prochain taxi</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : reservations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <SectionTitle icon={CalendarCheck} label="À venir" />
              <div className="mt-3 space-y-3">
                {upcoming.map((r) => (
                  <RideCard key={r.id} r={r} onClick={() => setSelected(r)} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <SectionTitle icon={Clock} label="Historique" />
              <div className="mt-3 space-y-3">
                {past.map((r) => (
                  <RideCard key={r.id} r={r} onClick={() => setSelected(r)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aide bas de page */}
      <div className="mt-10 rounded-2xl border border-border bg-card/50 p-5">
        <p className="text-sm font-semibold">Besoin d'aide ?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pour toute modification urgente ou question, appelez-nous directement.
        </p>
        <a
          href={`tel:${PHONE}`}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition active:scale-95"
        >
          <Phone className="h-4 w-4 text-primary" /> {PHONE_DISPLAY}
        </a>
      </div>

      {/* Modal détail */}
      {selected && !modifyTarget && (
        <RideModal
          r={selected}
          onClose={() => setSelected(null)}
          onCancel={handleCancel}
          onModify={(r) => setModifyTarget(r)}
        />
      )}

      {/* Modal modification d'heure */}
      {modifyTarget && <ModifyModal r={modifyTarget} onClose={() => setModifyTarget(null)} onConfirm={handleModify} />}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </main>
  );
}

/* ─── Composants UI ──────────────────────────────────────────── */
function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{label}</p>
    </div>
  );
}

function RideCard({ r, onClick }: { r: Reservation; onClick: () => void }) {
  const s = statusLabel(r.status);
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50 active:scale-[0.99] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {formatDate(r.pickup_datetime)}
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="truncate text-sm font-medium">{r.depart}</p>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="truncate text-sm text-muted-foreground">{r.arrivee}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
          {r.prix_estime && <span className="text-sm font-semibold">{r.prix_estime.toFixed(0)} €</span>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
        Voir le détail <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}

function RideModal({
  r,
  onClose,
  onCancel,
  onModify,
}: {
  r: Reservation;
  onClose: () => void;
  onCancel: (id: string) => void;
  onModify: (r: Reservation) => void;
}) {
  const navigate = useNavigate();
  const s = statusLabel(r.status);
  const isPending = r.status === "pending";
  const isActive = ["accepted", "en_route", "arrived"].includes(r.status);
  const canRebook = ["completed", "cancelled"].includes(r.status);

  function handleRebook() {
    navigate({
      to: "/reservation",
      search: { pickup: r.depart, dropoff: r.arrivee } as Record<string, string>,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-background p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.pickup_datetime)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-[11px] text-muted-foreground">Départ</p>
              <p className="text-sm font-medium">{r.depart}</p>
            </div>
          </div>
          <div className="mx-6 border-l border-dashed border-border py-0.5" />
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[11px] text-muted-foreground">Arrivée</p>
              <p className="text-sm font-medium">{r.arrivee}</p>
            </div>
          </div>
          {r.prix_estime && (
            <div className="border-t border-border pt-3 text-right">
              <span className="text-sm text-muted-foreground">Estimation : </span>
              <span className="font-semibold">{r.prix_estime.toFixed(0)} €</span>
            </div>
          )}
        </div>

        {/* Message si José a déjà accepté */}
        {isActive && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <Phone className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Votre course est déjà prise en charge. Pour toute modification, appelez le{" "}
              <a href={`tel:${PHONE}`} className="font-semibold underline underline-offset-2">
                {PHONE_DISPLAY}
              </a>
              .
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-2">
          {canRebook && (
            <button
              onClick={handleRebook}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition active:scale-95"
            >
              <RotateCcw className="h-4 w-4" /> Reréserver ce trajet
            </button>
          )}

          {isPending && (
            <>
              <button
                onClick={() => onModify(r)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/5 active:scale-95"
              >
                <Edit2 className="h-4 w-4" /> Modifier l'heure
              </button>
              <button
                onClick={() => onCancel(r.id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3.5 text-sm font-semibold text-destructive transition hover:bg-destructive/5 active:scale-95"
              >
                <X className="h-4 w-4" /> Annuler cette course
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal modification d'heure ────────────────────────────── */
function ModifyModal({
  r,
  onClose,
  onConfirm,
}: {
  r: Reservation;
  onClose: () => void;
  onConfirm: (id: string, newDatetime: string) => Promise<void>;
}) {
  // datetime-local attend "YYYY-MM-DDTHH:mm"
  const toLocalInput = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [value, setValue] = useState(toLocalInput(r.pickup_datetime));
  const [loading, setLoading] = useState(false);

  const minDatetime = toLocalInput(new Date(Date.now() + 30 * 60 * 1000).toISOString());

  async function handleConfirm() {
    if (!value) return;
    setLoading(true);
    // Convertir en ISO UTC pour Supabase
    await onConfirm(r.id, new Date(value).toISOString());
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-background p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold">Modifier l'heure de prise en charge</p>
          <button
            onClick={onClose}
            className="rounded-xl border border-border p-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Actuelle : <span className="font-medium text-foreground">{formatDate(r.pickup_datetime)}</span>
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium">Nouvelle heure</label>
          <input
            type="datetime-local"
            value={value}
            min={minDatetime}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-primary/40 transition focus:border-primary focus:ring-2"
          />
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={loading || !value || value === toLocalInput(r.pickup_datetime)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4" /> Confirmer la modification
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CalendarCheck className="h-7 w-7" />
      </span>
      <div>
        <p className="font-semibold">Aucune course pour l'instant</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos réservations apparaîtront ici après votre première course.
        </p>
      </div>
      <Link
        to="/reservation"
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] active:scale-95"
      >
        Réserver maintenant <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
