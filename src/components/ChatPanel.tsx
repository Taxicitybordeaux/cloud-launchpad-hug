import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, X, Loader2, Check, CheckCheck, ChevronUp, Search, Download, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/I18nProvider";
import {
  sendClientMessage,
  sendChauffeurMessage,
  listReservationMessages,
  markReservationMessagesRead,
  type ChatMessage,
} from "@/lib/chat.functions";
import { registerChauffeurReader } from "@/lib/chat-badge-sync";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Props = {
  reservationId: string;
  role: "client" | "chauffeur";
  onClose: () => void;
  peerName?: string;
  clientIdentity?: { account_id: string; phone?: string | null; email?: string | null };
};

const PAGE_SIZE = 30;
const TYPING_BROADCAST_THROTTLE_MS = 1500;
const TYPING_HIDE_AFTER_MS = 3500;
// Colonnes nécessaires uniquement — évite le select * et réduit la bande
// passante / le coût Supabase sur les longues conversations.
const MSG_COLS = "id,reservation_id,sender,content,read_by_client,read_by_chauffeur,created_at";
// Clé localStorage de la file d'attente des messages non envoyés (offline).
const OFFLINE_QUEUE_KEY = (rid: string, role: string) => `chat:offline:${role}:${rid}`;
type OfflineMsg = { tempId: string; content: string; at: number };

export function ChatPanel({ reservationId, role, onClose, peerName, clientIdentity }: Props) {
  const t = useT();
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
  const driverBadgeChannelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSentAt = useRef(0);
  const typingHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickToBottom = useRef(true);
  const prependAnchor = useRef<{ height: number } | null>(null);

  // Mark peer's unread messages as read (via server fn — RLS locks anon).
  // On expose la promesse pour que le compteur global de badge attende que
  // la mise à jour `read_by_chauffeur=true` soit persistée AVANT de recompter.
  const markRead = useCallback(async () => {
    try {
      await markReservationMessagesRead({ data: { reservation_id: reservationId, role } });
    } catch (e) {
      console.warn("[chat] markRead failed", e);
    }
  }, [reservationId, role]);

  // Enregistre le thread ouvert pour synchro badge côté chauffeur.
  useEffect(() => {
    if (role !== "chauffeur") return;
    const unregister = registerChauffeurReader(`resa:${reservationId}`, markRead);
    const onVis = () => {
      if (!document.hidden) void markRead();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      unregister();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [role, reservationId, markRead]);

  // ── Initial load (latest PAGE_SIZE messages, ASC for render) ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setHasMore(true);
    (async () => {
      try {
        const rows = await listReservationMessages({
          data: { reservation_id: reservationId, limit: PAGE_SIZE },
        });
        if (cancelled) return;
        setMessages(rows);
        setHasMore(rows.length >= PAGE_SIZE);
      } catch (e) {
        console.warn("[chat] initial load failed", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          stickToBottom.current = true;
          markRead();
        }
      }
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
    if (scrollRef.current) {
      prependAnchor.current = { height: scrollRef.current.scrollHeight };
    }
    try {
      const older = await listReservationMessages({
        data: { reservation_id: reservationId, before: oldest.created_at, limit: PAGE_SIZE },
      });
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length >= PAGE_SIZE);
    } catch (e) {
      console.warn("[chat] loadOlder failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [reservationId, messages, hasMore, loadingMore]);

  // ── Realtime channel: presence + typing broadcast only ──
  // postgres_changes on reservation_messages is locked to admins by RLS,
  // so non-admins poll via listReservationMessages below. We keep the
  // channel for presence ("online" dot) and typing indicator.
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`chat:${reservationId}`, {
      config: { presence: { key: role } },
    });
    const driverBadgeChannel = supabase.channel("drv-chat-badge");
    channelRef.current = channel;
    driverBadgeChannelRef.current = driverBadgeChannel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.role === role) return;
        setPeerTyping(true);
        if (typingHideTimer.current) clearTimeout(typingHideTimer.current);
        typingHideTimer.current = setTimeout(() => setPeerTyping(false), TYPING_HIDE_AFTER_MS);
      })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        // Best-effort instant delivery between client ↔ chauffeur. The
        // canonical row still arrives via the next poll if this misses.
        const m = payload as ChatMessage;
        if (!m?.id) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender === peerRole) markRead();
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setPeerOnline(Boolean(state[peerRole] && state[peerRole].length > 0));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ role, at: Date.now() });
        }
      });
    driverBadgeChannel.subscribe();

    return () => {
      if (typingHideTimer.current) clearTimeout(typingHideTimer.current);
      supabase.removeChannel(channel);
      supabase.removeChannel(driverBadgeChannel);
      channelRef.current = null;
      driverBadgeChannelRef.current = null;
    };
  }, [reservationId, role, peerRole, markRead]);

  // ── Polling fallback (4s) — fetches messages newer than what we have.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden) return;
      try {
        const latest = await listReservationMessages({
          data: { reservation_id: reservationId, limit: PAGE_SIZE },
        });
        if (stop || latest.length === 0) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          let added = false;
          for (const m of latest) {
            if (!seen.has(m.id)) {
              merged.push(m);
              added = true;
            } else {
              // refresh read flags
              const idx = merged.findIndex((x) => x.id === m.id);
              if (idx >= 0) merged[idx] = { ...merged[idx], ...m };
            }
          }
          if (added && latest.some((m) => m.sender === peerRole)) markRead();
          return merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      } catch {
        /* swallow */
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [reservationId, peerRole, markRead]);

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

  function notifyDriverChatBadge() {
    if (role !== "client") return;
    driverBadgeChannelRef.current?.send({
      type: "broadcast",
      event: "new_client_message",
      payload: { at: Date.now() },
    });
  }

  // ── Offline queue ──
  // Les messages tapés sans connexion sont stockés dans localStorage et
  // ré-envoyés automatiquement lors du retour en ligne (event `online`).
  const [queued, setQueued] = useState<OfflineMsg[]>([]);
  const flushingRef = useRef(false);

  const readQueue = useCallback((): OfflineMsg[] => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY(reservationId, role));
      return raw ? (JSON.parse(raw) as OfflineMsg[]) : [];
    } catch {
      return [];
    }
  }, [reservationId, role]);

  const writeQueue = useCallback(
    (q: OfflineMsg[]) => {
      try {
        if (q.length === 0) localStorage.removeItem(OFFLINE_QUEUE_KEY(reservationId, role));
        else localStorage.setItem(OFFLINE_QUEUE_KEY(reservationId, role), JSON.stringify(q));
      } catch {}
      setQueued(q);
    },
    [reservationId, role],
  );

  const sendOne = useCallback(
    async (content: string) => {
      if (role === "client") {
        if (!clientIdentity?.account_id) throw new Error("MISSING_IDENTITY");
        return await sendClientMessage({
          data: {
            reservation_id: reservationId,
            content,
            account_id: clientIdentity.account_id,
            phone: clientIdentity.phone ?? null,
            email: clientIdentity.email ?? null,
          },
        });
      }
      return await sendChauffeurMessage({
        data: { reservation_id: reservationId, content, skip_push: peerOnline },
      });
    },
    [reservationId, role, peerOnline, clientIdentity],
  );

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const q = readQueue();
    if (q.length === 0) return;
    flushingRef.current = true;
    try {
      const remaining = [...q];
      while (remaining.length > 0) {
        const next = remaining[0];
        try {
          const msg = await sendOne(next.content);
          setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
          channelRef.current?.send({ type: "broadcast", event: "new_message", payload: msg });
          notifyDriverChatBadge();

          remaining.shift();
          writeQueue(remaining);
        } catch (e) {
          console.warn("[chat] flush failed, will retry later", e);
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [readQueue, writeQueue, sendOne]);

  useEffect(() => {
    setQueued(readQueue());
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    // Tentative immédiate au montage si du backlog existe.
    flushQueue();
    return () => window.removeEventListener("online", onOnline);
  }, [readQueue, flushQueue]);

  // ── Send ──
  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    stickToBottom.current = true;
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (isOffline) {
      const q = [...readQueue(), { tempId: crypto.randomUUID(), content, at: Date.now() }];
      writeQueue(q);
      setInput("");
      setSending(false);
      return;
    }
    try {
      const msg = await sendOne(content);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      channelRef.current?.send({ type: "broadcast", event: "new_message", payload: msg });
      notifyDriverChatBadge();
      setInput("");
    } catch (e) {
      console.error("[chat] send failed, queuing for retry", e);
      const q = [...readQueue(), { tempId: crypto.randomUUID(), content, at: Date.now() }];
      writeQueue(q);
      setInput("");
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



  // Filtrage local (sur l'historique chargé : pages courantes) — mot-clé +
  // plage de dates. Si l'utilisateur veut filtrer plus ancien que ce qui est
  // chargé, il scrolle vers le haut (loadOlder) et le filtre s'applique.
  const filterActive = searchKw.trim().length > 0 || searchFrom.length > 0 || searchTo.length > 0;
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
    a.download = `tchat-${reservationId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isDriver = role === "chauffeur";
  // Palette « blanc crème » pour le chauffeur (meilleure lisibilité iPhone,
  // texte noir sur fond crème comme demandé).
  const panelBg = isDriver ? "#FBF7EE" : "#0f172a";
  const headerBorder = isDriver ? "1px solid #E8DFCB" : "1px solid rgba(255,255,255,0.1)";
  const titleColor = isDriver ? "#1a1a1a" : "#ffffff";
  const iconColor = isDriver ? "text-black/60 hover:text-black hover:bg-black/5" : "text-white/60 hover:text-white hover:bg-white/10";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:h-[680px] sm:rounded-2xl sm:border"
        style={{
          background: panelBg,
          // 100dvh évite le bug iOS Safari où la barre d'adresse rogne le
          // clavier et masque le champ de saisie.
          height: "100dvh",
          maxHeight: "100dvh",
          borderTop: isDriver ? "1px solid #E8DFCB" : "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            borderBottom: headerBorder,
            background: isDriver
              ? "linear-gradient(180deg, #F5EEDC 0%, #FBF7EE 100%)"
              : "linear-gradient(180deg, rgba(201,168,76,0.12) 0%, transparent 100%)",
          }}
        >
          {isDriver && (
            <button
              onClick={onClose}
              className="mr-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold text-black transition active:scale-95"
              aria-label="Retour driver"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Retour driver
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold" style={{ color: titleColor }}>{title}</div>
            <div className={`flex items-center gap-1.5 text-[11px] ${isDriver ? (peerOnline || peerTyping ? "text-emerald-600" : "text-black/40") : statusColor}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${peerOnline || peerTyping ? "bg-emerald-500" : (isDriver ? "bg-black/30" : "bg-white/30")}`} /> {statusLabel}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className={`rounded-full p-1.5 transition ${
                showSearch || filterActive ? "text-[#C9A84C]" : iconColor
              }`}
              aria-label={t("chat.search")}
              aria-pressed={showSearch}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={visibleMessages.length === 0}
              className={`rounded-full p-1.5 transition disabled:opacity-40 ${iconColor}`}
              aria-label={t("chat.export_csv")}
              title={t("chat.export_csv_short")}
            >
              <Download className="h-4 w-4" />
            </button>
            {!isDriver && (
              <button
                onClick={onClose}
                className={`rounded-full p-1.5 transition ${iconColor}`}
                aria-label={t("chat.close")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>


        {queued.length > 0 && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-300">
            📡 {queued.length} {queued.length > 1 ? t("chat.queued") : t("chat.queued_one")}
          </div>
        )}

        {showSearch && (
          <div className="space-y-2 border-b border-white/10 bg-black/30 px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="search"
                value={searchKw}
                onChange={(e) => setSearchKw(e.target.value)}
                placeholder={t("chat.search_ph")}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-2 text-xs text-white placeholder-white/40 outline-none focus:border-[#E8C96D]"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/60">
              <label className="flex-1">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-white/40">{t("chat.from")}</span>
                <input
                  type="date"
                  value={searchFrom}
                  onChange={(e) => setSearchFrom(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-[#E8C96D]"
                />
              </label>
              <label className="flex-1">
                <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-white/40">{t("chat.to")}</span>
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
                  {t("chat.reset")}
                </button>
              )}
            </div>
            {filterActive && (
              <div className="text-[10px] text-white/50">
                {visibleMessages.length} {t("chat.results")} {t("chat.of")} {messages.length} {t("chat.loaded")}.{" "}
                {hasMore && (
                  <button type="button" onClick={loadOlder} className="underline hover:text-white/80">
                    {t("chat.load_more_history")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-4">
          {hasMore && messages.length > 0 && (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60 hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
                {t("chat.older")}
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
              {t("chat.empty")}
            </div>
          )}
          {!loading && messages.length > 0 && filterActive && visibleMessages.length === 0 && (
            <div className="pt-10 text-center text-sm text-white/40">
              {t("chat.empty_filter")}
            </div>
          )}

          <ul className="space-y-2.5">
            {visibleMessages.map((m) => {
              const mine = m.sender === role;
              const isRead = mine ? (role === "client" ? m.read_by_chauffeur : m.read_by_client) : false;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                      mine ? "text-black" : isDriver ? "text-black" : "text-white"
                    }`}
                    style={
                      mine
                        ? { background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }
                        : isDriver
                          ? { background: "#ffffff", border: "1px solid #E8DFCB" }
                          : { background: "rgba(255,255,255,0.08)" }
                    }
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        mine ? "text-black/55" : isDriver ? "text-black/40" : "text-white/40"
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
                          <span title={t("chat.read")}>
                            <CheckCheck className="h-3 w-3" style={{ color: "#1d4ed8" }} />
                          </span>
                        ) : (
                          <span title={t("chat.sent")}>
                            <Check className="h-3 w-3 opacity-60" />
                          </span>
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
                style={isDriver ? { background: "#ffffff", border: "1px solid #E8DFCB" } : { background: "rgba(255,255,255,0.08)" }}
                aria-label={t("chat.typing")}
              >
                <Dot delay="0ms" dark={isDriver} />
                <Dot delay="150ms" dark={isDriver} />
                <Dot delay="300ms" dark={isDriver} />
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
          className="flex items-end gap-2 px-3 py-3"
          style={{
            borderTop: isDriver ? "1px solid #E8DFCB" : "1px solid rgba(255,255,255,0.1)",
            background: isDriver ? "#F5EEDC" : "rgba(0,0,0,0.3)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
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
            placeholder={isDriver ? "Répondre au client…" : t("chat.input_ph")}
            rows={1}
            className={
              isDriver
                ? "max-h-32 flex-1 resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black placeholder-black/40 outline-none focus:border-[#C9A84C]"
                : "max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#E8C96D]"
            }
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black transition active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            aria-label={t("chat.send")}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

      </div>
    </div>
  );
}

function Dot({ delay, dark = false }: { delay: string; dark?: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 animate-bounce rounded-full ${dark ? "bg-black/50" : "bg-white/60"}`}
      style={{ animationDelay: delay }}
    />
  );
}
