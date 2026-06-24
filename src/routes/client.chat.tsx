import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClientBottomNav } from "@/components/ClientBottomNav";
import { DirectChatPanel } from "@/components/DirectChatPanel";
import { getClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/client/chat")({
  head: () => ({
    meta: [{ title: "Chat — Taxi City Bordeaux" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientChatPage,
});

function ClientChatPage() {
  const navigate = useNavigate();
  const t = useT();
  const [session, setSession] = useState<ClientSession | null>(null);

  useEffect(() => {
    const s = getClientSession();
    if (!s) {
      navigate({ to: "/client/login" });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session) return null;

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col overflow-hidden px-4 pt-8"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111827 100%)" }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#E8C96D]">{t("client.eyebrow")}</p>
          <h1
            className="mt-1 text-2xl font-bold text-white sm:text-3xl"
            style={{ fontFamily: "'Syne', 'Playfair Display', serif" }}
          >
            {t("client.chat.title")}
          </h1>
          <p className="mt-1 text-xs text-white/50">{t("client.chat.subtitle")}</p>
        </div>
        <div
          className="flex flex-col overflow-hidden rounded-2xl border border-white/10"
          style={{ height: "calc(100dvh - 240px)", minHeight: 360 }}
        >
          <DirectChatPanel accountId={session.id} role="client" peerName="José 🚖" />
        </div>
      </div>
      <ClientBottomNav />
    </main>
  );
}
