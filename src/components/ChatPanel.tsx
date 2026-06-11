import { useCallback, useEffect, useRef, useState } from "react";
import { Send, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  sendClientMessage,
  sendChauffeurMessage,
  type ChatMessage,
} from "@/lib/chat.functions";

type Props = {
  reservationId: string;
  role: "client" | "chauffeur";
  onClose: () => void;
  peerName?: string;
  peerStatus?: string;
};

export function ChatPanel({
  reservationId,
  role,
  onClose,
  peerName,
  peerStatus = "En ligne",
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const title = peerName || (role === "client" ? "José 🚖" : "Client");

  const markRead = useCallback(async () => {
    const patch =
      role === "client"
        ? { read_by_client: true }
        : { read_by_chauffeur: true };
    const otherSender = role === "client" ? "chauffeur" : "client";
    await supabase
      .from("reservation_messages")
      .update(patch)
      .eq("reservation_id", reservationId)
      .eq("sender", otherSender)
      .eq(role === "client" ? "read_by_client" : "read_by_chauffeur", false);
  }, [reservationId, role]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("reservation_messages")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as ChatMessage[]);
      setLoading(false);
      markRead();
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationId, markRead]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${reservationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservation_messages",
          filter: `reservation_id=eq.${reservationId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (
            (role === "client" && m.sender === "chauffeur") ||
            (role === "chauffeur" && m.sender === "client")
          ) {
            markRead();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reservationId, role, markRead]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const fn = role === "client" ? sendClientMessage : sendChauffeurMessage;
      const msg = await fn({ data: { reservation_id: reservationId, content } });
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-t border-white/10 shadow-2xl sm:h-[680px] sm:rounded-2xl sm:border"
        style={{ background: "#0f172a" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-white/10 px-4 py-3"
          style={{ background: "linear-gradient(180deg, rgba(201,168,76,0.12) 0%, transparent 100%)" }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> {peerStatus}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex justify-center pt-10 text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="pt-10 text-center text-sm text-white/40">
              Aucun message pour l'instant. Écrivez le premier !
            </div>
          )}
          <ul className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.sender === role;
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                      mine ? "text-black" : "text-white"
                    }`}
                    style={
                      mine
                        ? { background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }
                        : { background: "rgba(255,255,255,0.08)" }
                    }
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div
                      className={`mt-1 text-[10px] ${mine ? "text-black/50" : "text-white/40"}`}
                    >
                      {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-white/10 bg-black/30 px-3 py-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Écrire un message…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#E8C96D]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black transition active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            aria-label="Envoyer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
