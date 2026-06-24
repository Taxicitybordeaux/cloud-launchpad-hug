import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Car, History, MessageCircle, User } from "lucide-react";

const tabs = [
  { to: "/client/dashboard", label: "Accueil", Icon: Home },
  { to: "/client/trajets", label: "Trajets", Icon: Car },
  { to: "/client/historique", label: "Historique", Icon: History },
  { to: "/client/chat", label: "Chat", Icon: MessageCircle },
  { to: "/client/profil", label: "Profil", Icon: User },
] as const;

export function ClientBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* spacer so content isn't hidden behind the fixed bar */}
      <div aria-hidden className="h-20" />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 backdrop-blur-xl"
        style={{
          background: "rgba(10,10,10,0.85)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-1.5">
          {tabs.map(({ to, label, Icon }) => {
            const active = pathname === to;
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition"
                  style={{
                    color: active ? "#E8C96D" : "rgba(255,255,255,0.55)",
                  }}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {label}
                  </span>
                  {active && (
                    <span
                      aria-hidden
                      className="mt-0.5 h-0.5 w-6 rounded-full"
                      style={{ background: "#E8C96D" }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
