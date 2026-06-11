import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, X, Loader2, Check, CheckCheck, ChevronUp, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  sendClientMessage,
  sendChauffeurMessage,
  type ChatMessage,
} from "@/lib/chat.functions";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Props = {
  reservationId: string;
  role: "client" | "chauffeur";
  onClose: () => void;
  peerName?: string;
};

const PAGE_SIZE = 30;
const TYPING_BROADCAST_THROTTLE_MS = 1500;
const TYPING_HIDE_AFTER_MS = 3500;

export function ChatPanel({ reservationId, role, onClose, peerName }: Props) {
  const peerRole = role === "client" ? "chauffeur" : "client";
  const title = peerName || (role === "client" ? "José 🚖" : "Client");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  // Recherche + filtres dates dans l'historique du tchat.
  const [showSearch, setShowSearch] = useState(false);
  const [searchKw, setSearchKw] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSentAt = useRef(0);
  const typingHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickToBottom = useRef(true);
  const prependAnchor = useRef<{ height: number } | null>(null);

  // Mark peer's unread messages as read.
  const markRead = useCallback(async () => {
    const patch =
      role === "client" ? { read_by_client: true } : { read_by_chauffeur: true };
    const readCol = role === "client" ? "read_by_client" : "read_by_chauffeur";
    await supabase
      .from("reservation_messages")
      .update(patch)
      .eq("reservation_id", reservationId)
      .eq("sender", peerRole)
      .eq(readCol, false);
  }, [reservationId, role, peerRole]);

  // ── Initial load (latest PAGE_SIZE messages, ASC for render) ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setHasMore(true);
    (async () => {
      const { data } = await supabase
        .from("reservation_messages")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (cancelled) return;
      const rows = ((data ?? []) as ChatMessage[]).slice().reverse();
      setMessages(rows);
      setHasMore((data?.length ?? 0) >= PAGE_SIZE);
      setLoading(false);
      stickToBottom.current = true;
      markRead();
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationId, markRead]);

  // ── Pagination: load older messages ──
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    // Capture height to restore scroll position after prepending.
    if (scrollRef.current) {
      prependAnchor.current = { height: scrollRef.current.scrollHeight };
    }
    const { data } = await supabase
      .from("reservation_messages")
      .select("*")
      .eq("reservation_id", reservationId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const older = ((data ?? []) as ChatMessage[]).slice().reverse();
    setMessages((prev) => [...older, ...prev]);
    setHasMore((data?.length ?? 0) >= PAGE_SIZE);
    setLoadingMore(false);
  }, [reservationId, messages, hasMore, loadingMore]);

  // ── Single realtime channel: postgres_changes + presence + broadcast ──
  useEffect(() => {
    // Guard against React strict-mode double-subscribe.
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`chat:${reservationId}`, {
      config: { presence: { key: role } },
    });
    channelRef.current = channel;

    // New / updated messages.
    channel
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
          if (m.sender === peerRole) markRead();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservation_messages",
          filter: `reservation_id=eq.${reservationId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        },
      )
      // Typing indicator (broadcast).
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.role === role) return;
        setPeerTyping(true);
        if (typingHideTimer.current) clearTimeout(typingHideTimer.current);
        typingHideTimer.current = setTimeout(
          () => setPeerTyping(false),
          TYPING_HIDE_AFTER_MS,
        );
      })
      // Presence: detect if peer is currently in the chat.
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setPeerOnline(Boolean(state[peerRole] && state[peerRole].length > 0));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ role, at: Date.now() });
        }
      });

    return () => {
      if (typingHideTimer.current) clearTimeout(typingHideTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [reservationId, role, peerRole, markRead]);

  // ── Scroll handling: stick-to-bottom + restore on prepend ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (prependAnchor.current) {
      // Restore scroll so the user's view doesn't jump after loading older.
      const delta = el.scrollHeight - prependAnchor.current.height;
      el.scrollTop = delta;
      prependAnchor.current = null;
      return;
    }

    if (stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < 80;
    if (el.scrollTop < 60 && hasMore && !loadingMore) loadOlder();
  }

  // ── Typing broadcast (throttled) ──
  function emitTyping() {
    const now = Date.now();
    if (now - lastTypingSentAt.current < TYPING_BROADCAST_THROTTLE_MS) return;
    lastTypingSentAt.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { role },
    });
  }

  // ── Send ──
  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    stickToBottom.current = true;
    try {
      if (role === "client") {
        const msg = await sendClientMessage({
          data: { reservation_id: reservationId, content },
        });
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      } else {
        // Chauffeur side: skip push if the client is currently in the chat.
        const msg = await sendChauffeurMessage({
          data: {
            reservation_id: reservationId,
            content,
            skip_push: peerOnline,
          },
        });
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      }
      setInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  const statusLabel = useMemo(() => {
    if (peerTyping) return "Écrit…";
    if (peerOnline) return "En ligne";
    return "Hors ligne";
  }, [peerOnline, peerTyping]);

  const statusColor = peerOnline || peerTyping ? "text-emerald-400" : "text-white/40";
  const dotColor = peerOnline || peerTyping ? "bg-emerald-400" : "bg-white/30";

  // Filtrage local (sur l'historique chargé : pages courantes) — mot-clé +
  // plage de dates. Si l'utilisateur veut filtrer plus ancien que ce qui est
  // chargé, il scrolle vers le haut (loadOlder) et le filtre s'applique.
  const filterActive =
    searchKw.trim().length > 0 || searchFrom.length > 0 || searchTo.length > 0;
  const fromTs = searchFrom ? new Date(searchFrom + "T00:00:00").getTime() : null;
  const toTs = searchTo ? new Date(searchTo + "T23:59:59").getTime() : null;
  const kwLower = searchKw.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    if (!filterActive) return messages;
    return messages.filter((m) => {
      const ts = new Date(m.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (kwLower && !m.content.toLowerCase().includes(kwLower)) return false;
      return true;
    });
  }, [messages, filterActive, fromTs, toTs, kwLower]);

  function exportCsv() {
    // Export CSV de la conversation (filtre appliqué si actif). UTF-8 BOM
    // pour qu'Excel détecte les accents correctement.
    const rows = visibleMessages;
    const escape = (v: string) => {
      const s = String(v ?? "").replace(/\r?\n/g, " ");
      return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["created_at", "sender", "content", "read_by_client", "read_by_chauffeur"];
    const lines = [
      header.join(","),
      ...rows.map((m) =>
        [
          new Date(m.created_at).toISOString(),
          m.sender,
          escape(m.content),
          m.read_by_client ? "1" : "0",
          m.read_by_chauffeur ? "1" : "0",
        ].join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tchat-${reservationId.slice(0, 8)}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          style={{
            background:
              "linear-gradient(180deg, rgba(201,168,76,0.12) 0%, transparent 100%)",
          }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className={`flex items-center gap-1.5 text-[11px] ${statusColor}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />{" "}
              {statusLabel}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className={`rounded-full p-1.5 transition hover:bg-white/10 ${
                showSearch || filterActive ? "text-[#E8C96D]" : "text-white/60 hover:text-white"
              }`}
              aria-label="Rechercher"
              aria-pressed={showSearch}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={visibleMessages.length === 0}
              className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Exporter la conversation en CSV"
              title="Exporter en CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="space-y-2 border-b border-white/10 bg-black/30 px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="search"
                value={searchKw}
                onChange={(e) => setSearchKw(e.target.value)}
                placeholder="Rechercher un mot-clé…"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-2 text-xs text-white placeholder-white/40 outline-none focus:border-[#E8C96D]"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/60">
              <label className="flex-1">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-white/40">Du</span>
                <input
                  type="date"
                  value={searchFrom}
                  onChange={(e) => setSearchFrom(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-[#E8C96D]"
                />
              </label>
              <label className="flex-1">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-white/40">Au</span>
                <input
                  type="date"
                  value={searchTo}
                  onChange={(e) => setSearchTo(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-[#E8C96D]"
                />
              </label>
              {filterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKw("");
                    setSearchFrom("");
                    setSearchTo("");
                  }}
                  className="self-end rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Réinitialiser
                </button>
              )}
            </div>
            {filterActive && (
              <div className="text-[10px] text-white/50">
                {visibleMessages.length} message{visibleMessages.length > 1 ? "s" : ""} trouvé
                {visibleMessages.length > 1 ? "s" : ""} sur {messages.length} chargé
                {messages.length > 1 ? "s" : ""}.{" "}
                {hasMore && (
                  <button
                    type="button"
                    onClick={loadOlder}
                    className="underline hover:text-white/80"
                  >
                    charger plus d'historique
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {hasMore && messages.length > 0 && (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60 hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
                Messages plus anciens
              </button>
            </div>
          )}

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
          {!loading && messages.length > 0 && filterActive && visibleMessages.length === 0 && (
            <div className="pt-10 text-center text-sm text-white/40">
              Aucun message ne correspond à votre recherche.
            </div>
          )}

          <ul className="space-y-2.5">
            {visibleMessages.map((m) => {
              const mine = m.sender === role;
              const isRead = mine
                ? role === "client"
                  ? m.read_by_chauffeur
                  : m.read_by_client
                : false;
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
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        mine ? "text-black/55" : "text-white/40"
                      }`}
                    >
                      <span>
                        {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine &&
                        (isRead ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {peerTyping && (
            <div className="mt-3 flex justify-start">
              <div
                className="flex items-center gap-1 rounded-2xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.08)" }}
                aria-label="L'autre personne est en train d'écrire"
              >
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </div>
            </div>
          )}
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
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.trim().length > 0) emitTyping();
            }}
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

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/60"
      style={{ animationDelay: delay }}
    />
  );
}
