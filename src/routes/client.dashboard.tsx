import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, User, Phone, Mail, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { getClientSession, clearClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Mon Tableau de bord — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getClientSession();
    if (!s) {
      navigate({ to: "/client/login" });
      return;
    }
    setSession(s);
    setReady(true);
  }, [navigate]);

  function logout() {
    clearClientSession();
    navigate({ to: "/" });
  }

  if (!ready || !session) return null;

  return (
    <main
      className="min-h-[100dvh] px-4 py-8 sm:py-12"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)" }}
    >
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>

        <div
          className="rounded-2xl border p-6 sm:p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(255,255,255,0.10)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">Espace client</p>
              <h1
                className="mt-1 text-2xl font-bold text-white sm:text-3xl"
                style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
              >
                Bonjour {session.name?.split(" ")[0] || "client"}
              </h1>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
            >
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </div>

          <div className="mt-6 grid gap-2.5 text-sm text-white/80">
            <div className="flex items-center gap-2.5"><User className="h-4 w-4 text-white/40" /> {session.name || "—"}</div>
            <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-white/40" /> {session.email}</div>
            <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-white/40" /> {session.phone || "—"}</div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              to="/reservation"
              className="rounded-xl px-5 py-4 text-center text-sm font-semibold text-black transition active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            >
              Réserver une course
            </Link>
            <Link
              to="/mes-courses"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Mes courses
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
