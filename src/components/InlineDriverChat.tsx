import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, CheckCheck, Check } from "lucide-react";
import {
  listReservationMessages,
  markReservationReadByChauffeur,
  sendChauffeurMessage,
  type ChatMessage,
} from "@/lib/chat.functions";
import { registerChauffeurReader, acquireReadLock, releaseReadLock, broadcastChatBadge } from "@/lib/chat-badge-sync";

type Props = {
  reservationId: string;
  onUnreadChange?: (n: number) => void;
  /** "dark" = charte Taxi City Bordeaux (fond nuit, or). Par défaut : thème clair d'origine. */
  theme?: "light" | "dark";
};

const PALETTES = {
  light: {
    boxBg: "#FBF7EE",
    boxBorder: "1px solid #E8DFCB",
    listBg: "#ffffff",
    listBorder: "1px solid #EEE6D2",
    loading: "#666",
    empty: "#888",
    mineBg: "linear-gradient(135deg,#C9A84C,#E8C96D)",
    mineBorder: "none",
    theirBg: "#F5EEDC",
    theirBorder: "1px solid #E8DFCB",
    text: "#0f172a",
    timeMine: "rgba(0,0,0,0.55)",
    timeTheir: "rgba(0,0,0,0.45)",
    inputBg: "#ffffff",
    inputColor: "#000000",
    inputBorder: "1px solid #E8DFCB",
    sendBg: "linear-gradient(135deg,#C9A84C,#E8C96D)",
    sendColor: "#000",
  },
  dark: {
    boxBg: "rgba(255,255,255,.03)",
    boxBorder: "1px solid rgba(246,240,229,.12)",
    listBg: "rgba(0,0,0,.28)",
    listBorder: "1px solid rgba(246,240,229,.1)",
    loading: "rgba(246,240,229,.6)",
    empty: "rgba(246,240,229,.5)",
    mineBg: "linear-gradient(180deg,#e0b866,#c99b4a)",
    mineBorder: "none",
    theirBg: "rgba(255,255,255,.08)",
    theirBorder: "1px solid rgba(246,240,229,.12)",
    text: "#f6f0e5",
    timeMine: "rgba(10,17,24,.6)",
    timeTheir: "rgba(246,240,229,.5)",
    inputBg: "rgba(0,0,0,.28)",
    inputColor: "#f6f0e5",
    inputBorder: "1px solid rgba(246,240,229,.2)",
    sendBg: "linear-gradient(180deg,#e0b866,#c99b4a)",
    sendColor: "#0a1118",
  },
} as const;

export function InlineDriverChat({ reservationId, onUnreadChange, theme = "light" }: Props) {
  const p = PALETTES[theme];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(async () => {
    // Verrou cross-onglets : si un autre onglet a déjà lancé le markRead
    // sur cette réservation dans les 3 dernières secondes, on skip l'UPDATE
    // (l'autre onglet diffusera le delta via BroadcastChannel).
    if (!acquireReadLock(reservationId)) {
      onUnreadChange?.(0);
      return;
    }
    try {
      const res = await markReservationReadByChauffeur({
        data: { reservation_id: reservationId },
      });
      onUnreadChange?.(0);
      if ((res?.updated ?? 0) > 0) {
        broadcastChatBadge({ type: "read", reservationId, at: Date.now() });
      }
    } catch {
      /* ignore */
    } finally {
      releaseReadLock(reservationId);
    }
  }, [reservationId, onUnreadChange]);

  const load = useCallback(async () => {
    try {
      const rows = await listReservationMessages({
        data: { reservation_id: reservationId, limit: 30 },
      });
      setMessages(rows);
    } catch (e) {
      console.warn("[inline-chat] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    load();
    markRead();
  }, [load, markRead]);

  // Sync badge + auto-refresh
  useEffect(() => {
    const unregister = registerChauffeurReader(`resa:${reservationId}`, markRead);
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 5000);
    const onVis = () => {
      if (!document.hidden) {
        load();
        markRead();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      unregister();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reservationId, load, markRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const msg = await sendChauffeurMessage({
        data: { reservation_id: reservationId, content },
      });
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      setInput("");
    } catch (e) {
      console.error("[inline-chat] send failed", e);
      alert("Envoi impossible, réessaie.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 8,
        background: p.boxBg,
        border: p.boxBorder,
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          maxHeight: 200,
          overflowY: "auto",
          background: p.listBg,
          border: p.listBorder,
          borderRadius: 8,
          padding: 8,
          marginBottom: 8,
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: 12, color: p.loading }}>
            <Loader2 className="animate-spin" style={{ width: 14, height: 14, display: "inline" }} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 12, color: p.empty, fontSize: 12 }}>
            Aucun message pour l'instant.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender === "chauffeur";
          const isRead = mine ? m.read_by_client : false;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  background: mine ? p.mineBg : p.theirBg,
                  color: theme === "dark" && mine ? "#0a1118" : p.text,
                  border: mine ? p.mineBorder : p.theirBorder,
                  borderRadius: 12,
                  padding: "6px 10px",
                  fontSize: 13,
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.content}
                <div
                  style={{
                    marginTop: 2,
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    color: mine ? p.timeMine : p.timeTheir,
                  }}
                >
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {mine &&
                    (isRead ? (
                      <CheckCheck style={{ width: 12, height: 12, color: "#1d4ed8" }} />
                    ) : (
                      <Check style={{ width: 12, height: 12, opacity: 0.6 }} />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{ display: "flex", gap: 6, alignItems: "flex-end" }}
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
          placeholder="Répondre au client…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            maxHeight: 100,
            background: p.inputBg,
            color: p.inputColor,
            border: p.inputBorder,
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: p.sendBg,
            color: p.sendColor,
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}
          aria-label="Envoyer"
        >
          {sending ? (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          ) : (
            <Send style={{ width: 16, height: 16 }} />
          )}
        </button>
      </form>
    </div>
  );
}
