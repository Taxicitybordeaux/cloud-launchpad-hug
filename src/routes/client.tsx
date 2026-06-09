import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
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
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  price_estimate?: number;
  created_at: string;
};

type AuthState = "idle" | "login" | "register";

/* ─── Helpers ────────────────────────────────────────────────── */
function statusLabel(s: Reservation["status"]) {
  return {
    pending: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
    confirmed: { label: "Confirmée", cls: "bg-blue-100 text-blue-800" },
    completed: { label: "Terminée", cls: "bg-green-100 text-green-800" },
    cancelled: { label: "Annulée", cls: "bg-red-100 text-red-800" },
  }[s];
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

/* ─── Auth Gate (connexion / inscription) ─────────────────────── */
function AuthGate({
  onAuth,
}: {
  onAuth: (u: { id: string; email: string }) => void;
}) {
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
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        const u = data.session?.user;
        if (u) onAuth({ id: u.id, email: u.email ?? "" });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
        const u = data.session?.user ?? data.user;
        if (u) onAuth({ id: u.id, email: u.email ?? "" });
        else
          setError(
            "Un e-mail de confirmation vous a été envoyé. Vérifiez votre boîte."
          );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      if (msg.includes("Invalid login credentials"))
        setError("Email ou mot de passe incorrect.");
      else if (msg.includes("User already registered"))
        setError("Ce compte existe déjà. Connectez-vous.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-10 sm:pt-16">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <img
          src={logo}
          alt="Taxi City Bordeaux"
          className="h-16 w-auto sm:h-20"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        {/* Tabs */}
        <div className="mb-6 flex rounded-xl border border-border p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Connexion" : "Créer un compte"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Adresse e-mail
            </label>
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

          {/* Mot de passe */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
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
                {showPwd ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Bouton */}
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

        {/* Aide */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Besoin d'aide ?{" "}
          <a
            href={`tel:${PHONE}`}
            className="text-primary underline underline-offset-2"
          >
            {PHONE_DISPLAY}
          </a>
        </p>
      </div>

      {/* Retour */}
      <div className="mt-6 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────── */
function Dashboard({
  user,
  onLogout,
}: {
  user: { id: string; email: string };
  onLogout: () => void;
}) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    fetchReservations();
  }, [user.id]);

  async function fetchReservations() {
    setLoading(true);
    const { data } = await supabase
      .from("reservations")
      .select(
        "id,pickup_address,dropoff_address,pickup_datetime,status,price_estimate,created_at"
      )
      .eq("user_id", user.id)
      .order("pickup_datetime", { ascending: false });
    setReservations((data as Reservation[]) ?? []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    onLogout();
  }

  async function handleCancel(id: string) {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      showToast("Impossible d'annuler. Appelez-nous.", "error");
    } else {
      showToast("Course annulée.", "success");
      setSelected(null);
      fetchReservations();
    }
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const upcoming = reservations.filter((r) =>
    ["pending", "confirmed"].includes(r.status)
  );
  const past = reservations.filter((r) =>
    ["completed", "cancelled"].includes(r.status)
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-8 sm:pt-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Taxi City Bordeaux" className="h-10 w-auto sm:h-12" />
          <div>
            <p className="text-xs text-muted-foreground">Mon espace</p>
            <p className="max-w-[180px] truncate text-sm font-semibold sm:max-w-none">
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-destructive/50 hover:text-destructive active:scale-95"
        >
          <LogOut className="h-3.5 w-3.5" /> Déconnexion
        </button>
      </div>

      {/* CTA Nouvelle réservation */}
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
          {/* Courses à venir */}
          {upcoming.length > 0 && (
            <div>
              <SectionTitle icon={CalendarCheck} label="À venir" />
              <div className="mt-3 space-y-3">
                {upcoming.map((r) => (
                  <RideCard
                    key={r.id}
                    r={r}
                    onClick={() => setSelected(r)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historique */}
          {past.length > 0 && (
            <div>
              <SectionTitle icon={Clock} label="Historique" />
              <div className="mt-3 space-y-3">
                {past.map((r) => (
                  <RideCard
                    key={r.id}
                    r={r}
                    onClick={() => setSelected(r)}
                  />
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
      {selected && (
        <RideModal
          r={selected}
          onClose={() => setSelected(null)}
          onCancel={handleCancel}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}
    </main>
  );
}

/* ─── Composants UI ──────────────────────────────────────────── */
function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
        {label}
      </p>
    </div>
  );
}

function RideCard({
  r,
  onClick,
}: {
  r: Reservation;
  onClick: () => void;
}) {
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
              <p className="truncate text-sm font-medium">{r.pickup_address}</p>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="truncate text-sm text-muted-foreground">
                {r.dropoff_address}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}
          >
            {s.label}
          </span>
          {r.price_estimate && (
            <span className="text-sm font-semibold">
              {r.price_estimate.toFixed(0)} €
            </span>
          )}
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
}: {
  r: Reservation;
  onClose: () => void;
  onCancel: (id: string) => void;
}) {
  const navigate = useNavigate();
  const s = statusLabel(r.status);
  const canCancel = ["pending", "confirmed"].includes(r.status);
  const canRebook = ["completed", "cancelled"].includes(r.status);

  function handleRebook() {
    navigate({
      to: "/reservation",
      search: {
        pickup: r.pickup_address,
        dropoff: r.dropoff_address,
      } as Record<string, string>,
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-background p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
              {s.label}
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDate(r.pickup_datetime)}
            </p>
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
              <p className="text-sm font-medium">{r.pickup_address}</p>
            </div>
          </div>
          <div className="mx-6 border-l border-dashed border-border py-0.5" />
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[11px] text-muted-foreground">Arrivée</p>
              <p className="text-sm font-medium">{r.dropoff_address}</p>
            </div>
          </div>
          {r.price_estimate && (
            <div className="border-t border-border pt-3 text-right">
              <span className="text-sm text-muted-foreground">Estimation : </span>
              <span className="font-semibold">{r.price_estimate.toFixed(0)} €</span>
            </div>
          )}
        </div>

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
          {canCancel && (
            <button
              onClick={() => onCancel(r.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-3.5 text-sm font-semibold text-destructive transition hover:bg-destructive/5 active:scale-95"
            >
              <X className="h-4 w-4" /> Annuler cette course
            </button>
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
