import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Clock,
  MapPin,
  Users,
  Package,
  Gauge,
  CreditCard,
  AlertTriangle,
  Send,
  Loader2,
  Phone,
  MessageCircle,
  Star,
  FileText,
  Download,
  PrinterIcon,
  CalendarPlus,
  Share2,
  WifiOff,
  Car,
  Bell,
  BellRing,
  BellOff,
} from "lucide-react";
import { useI18n, useT } from "@/i18n/I18nProvider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getReservationForFinPublic } from "@/lib/reservation.functions";
import { recomputeReservationDuration } from "@/lib/reservation-recompute.functions";
import { durationSecondsToMinutes, durationSecondsToMs } from "@/lib/duration";
import { listSuiviMessages, sendSuiviClientMessage, markReservationMessagesRead, countUnreadClientForReservation, type ChatMessage } from "@/lib/chat.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getTaxiSupabase } from "@/lib/taxi-supabase";

export const Route = createFileRoute("/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de votre taxi — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "theme-color", content: "#0f172a" },
    ],
  }),
  component: SuiviPage,
});

// ─────────────────────────────────────────────────────────────────────────────────
const JOSE_PHONE = "0673072322";
// Délai d'expiration du lien de suivi après la fin de la course (en jours)
const SUIVI_EXPIRY_DAYS = 30;

function isSuiviExpired(reservation: any): boolean {
  if (reservation.status !== "completed" && reservation.status !== "cancelled") return false;
  // Utilise updated_at ou pickup_datetime comme référence
  const ref = reservation.completed_at ?? reservation.updated_at ?? reservation.pickup_datetime;
  if (!ref) return false;
  const refMs = new Date(ref).getTime();
  const expiryMs = refMs + SUIVI_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > expiryMs;
}
const VEHICLE_MODEL = "Mercedes-Benz";
const VEHICLE_COLOR = "Noir";
const VEHICLE_PLATE = "HF-450-JG";

const PREMIUM_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; overflow-x: hidden; overscroll-behavior-y: contain; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  button, a { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  input, textarea { -webkit-tap-highlight-color: transparent; }
  .suivi-root { overscroll-behavior-y: contain; }
  
  @keyframes gradient-flow {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  @keyframes float-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(29, 78, 216, 0.4), inset 0 1px 0 rgba(255,255,255,0.1); }
    50% { box-shadow: 0 0 30px rgba(29, 78, 216, 0.6), inset 0 1px 0 rgba(255,255,255,0.2); }
  }
  
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  .suivi-premium {
    animation: float-up 0.5s ease-out both;
  }
  
  .suivi-pulse-active {
    animation: pulse-glow 2s ease-in-out infinite;
  }
  
  .suivi-slide {
    animation: slide-in-right 0.4s ease-out both;
  }
  
  .suivi-card {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
    /* Fix #8 — préfixe webkit pour iOS < 15 */
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .suivi-card:hover {
    box-shadow: 0 8px 40px rgba(15, 23, 42, 0.12);
    transform: translateY(-2px);
  }
  
  .suivi-glass {
    background: rgba(255, 255, 255, 0.7);
    /* Fix #8 — préfixe webkit pour iOS < 15 */
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 12px;
  }
`;

// ─── Types ─────────────────────────────────────────────────────────────────────────
type Reservation = {
  id: string;
  depart: string;
  destination?: string | null;
  arrivee?: string | null;
  pickup_datetime?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  status: string;
  prix_estime?: number | null;
  distance_km?: number | null;
  duree_s?: number | null;
  client_name?: string | null;
  nom?: string | null;
  nb_passagers?: number | null;
  nb_bagages?: number | null;
  mode_paiement?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  client_account_id?: string | null;
};

// ─── Status Config ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bgGradient: string;
    borderColor: string;
    icon: string;
  }
> = {
  pending: {
    label: "suivi.status.pending",
    color: "#92400e",
    bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    borderColor: "rgba(217, 119, 6, 0.2)",
    icon: "⏳",
  },
  accepted: {
    label: "suivi.status.accepted",
    color: "#15803d",
    bgGradient: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
    borderColor: "rgba(34, 197, 94, 0.2)",
    icon: "✨",
  },
  en_route: {
    label: "suivi.status.en_route",
    color: "#1d4ed8",
    bgGradient: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
    borderColor: "rgba(29, 78, 216, 0.2)",
    icon: "🚕",
  },
  arrived: {
    label: "suivi.status.arrived",
    color: "#7c3aed",
    bgGradient: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
    borderColor: "rgba(124, 58, 237, 0.2)",
    icon: "📍",
  },
  completed: {
    label: "suivi.status.completed",
    color: "#475569",
    bgGradient: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
    borderColor: "rgba(71, 85, 105, 0.2)",
    icon: "✓",
  },
  cancelled: {
    label: "suivi.status.cancelled",
    color: "#991b1b",
    bgGradient: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
    borderColor: "rgba(185, 28, 28, 0.2)",
    icon: "✕",
  },
};

// ─── Timeline Stepper ──────────────────────────────────────────────────────────────
function PremiumTimeline({ status }: { status: string }) {
  const t = useT();
  const steps = ["accepted", "en_route", "arrived", "completed"];
  if (status === "cancelled") return null;

  // "pending" (avant validation chauffeur) → aucune étape encore active
  const currentIdx = steps.indexOf(status as any);

  const stepLabels: Record<string, string> = {
    accepted: t("suivi.timeline.accepted"),
    en_route: t("suivi.status.en_route"),
    arrived: t("suivi.timeline.arrived"),
    completed: t("suivi.timeline.completed"),
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
      {steps.map((s, i) => {
        const isDone = i <= currentIdx;
        const isActive = i === currentIdx;
        const config = STATUS_CONFIG[s];

        return (
          <div
            key={s}
            style={{ display: "flex", alignItems: "flex-start", flex: i < steps.length - 1 ? 1 : "0 0 auto" }}
          >
            {/* Étape + label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                flex: "0 0 auto",
                width: "62px",
              }}
            >
              <div
                className={`suivi-premium ${isActive && status === "arrived" ? "suivi-pulse-active" : ""}`}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: isDone ? config.bgGradient : "#e2e8f0",
                  border: `2px solid ${isDone ? config.borderColor : "transparent"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: config.color,
                  flexShrink: 0,
                  transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {isDone && !isActive ? "✓" : config.icon}
              </div>
              <div
                style={{
                  fontSize: "10.5px",
                  fontWeight: isActive ? 700 : 500,
                  color: isDone ? config.color : "#94a3b8",
                  textAlign: "center",
                  lineHeight: 1.25,
                  width: "100%",
                  whiteSpace: "normal",
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  hyphens: "none",
                  letterSpacing: "-0.1px",
                }}
              >
                {stepLabels[s]}
              </div>
            </div>
            {/* Ligne entre étapes */}
            {i < steps.length - 1 && (
              <div style={{ flex: 1, minWidth: "6px", paddingTop: "14px" }}>
                <div
                  style={{
                    height: "2px",
                    background: isDone ? `linear-gradient(90deg, ${config.color}40, ${config.color}70)` : "#e2e8f0",
                    borderRadius: "1px",
                    transition: "all 0.4s ease",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chat Component (anonyme, scopé par clé URL /suivi/$id) ──────────────────
function ChatSection({ suiviKey, reservationId, t }: { suiviKey: string; reservationId: string; t: (k: string) => string }) {
  const [unread, setUnread] = useState(0);
  return (
    <div
      className="suivi-premium suivi-card"
      style={{ marginBottom: "16px", padding: "16px", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: "12px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <MessageCircle size={16} />
        {t("suivi.chat_title")}
        {unread > 0 ? (
          <span
            title={`${unread} message${unread > 1 ? "s" : ""} du taxi non lu${unread > 1 ? "s" : ""} · conversation en cours`}
            aria-label={`${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`}
            style={{
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              borderRadius: 10,
              background: "#ef4444",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "auto",
            }}
          >
            {unread}
          </span>
        ) : (
          <span
            title="Aucun message non lu"
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "#64748b",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            ✓ à jour
          </span>
        )}
      </div>
      <AnonChat suiviKey={suiviKey} reservationId={reservationId} onUnreadChange={setUnread} />
    </div>
  );
}

function AnonChat({
  suiviKey,
  reservationId,
  onUnreadChange,
}: {
  suiviKey: string;
  reservationId: string;
  onUnreadChange?: (n: number) => void;
}) {
  const t = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const driverBadgeChannelRef = useRef<any>(null);
  const listFn = useServerFn(listSuiviMessages);
  const sendFn = useServerFn(sendSuiviClientMessage);
  const markReadFn = useServerFn(markReservationMessagesRead);
  const countUnreadFn = useServerFn(countUnreadClientForReservation);
  const [unreadSql, setUnreadSql] = useState(0);

  const load = useCallback(async () => {
    try {
      const rows = await listFn({ data: { suivi_key: suiviKey, limit: 60 } });
      setMessages(rows as ChatMessage[]);
    } catch (e) {
      console.warn("[suivi-chat] load failed", e);
    }
  }, [suiviKey, listFn]);

  useEffect(() => {
    load();
    // Realtime: synchronisation instantanée via Supabase Realtime (sans polling)
    const ch = (supabase as any)
      .channel(`chat_suivi_${reservationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservation_messages",
          filter: `reservation_id=eq.${reservationId}`,
        },
        (payload: any) => {
          // Bump immédiat du compteur : évite l'aller-retour load() → count().
          const row = payload?.new;
          if (row && !row.read_by_client) setUnreadSql((n) => n + 1);
          load();
        },
      )
      .subscribe();
    const driverBadgeChannel = (supabase as any).channel("drv-chat-badge");
    driverBadgeChannelRef.current = driverBadgeChannel;
    driverBadgeChannel.subscribe();
    // Re-sync au retour de l'onglet (filet de sécurité si la connexion realtime a été coupée)
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
      supabase.removeChannel(driverBadgeChannel);
      driverBadgeChannelRef.current = null;
    };
  }, [reservationId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Compteur non lus : COUNT SQL exact (source de vérité identique à celle du
  // chauffeur), rafraîchi à chaque changement de liste + focus onglet.
  const refreshUnread = useCallback(async () => {
    try {
      const n = await countUnreadFn({ data: { suivi_key: suiviKey } });
      setUnreadSql(Number(n) || 0);
    } catch {}
  }, [countUnreadFn, suiviKey]);
  useEffect(() => {
    refreshUnread();
  }, [messages, refreshUnread]);
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) refreshUnread();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshUnread]);
  useEffect(() => {
    onUnreadChange?.(unreadSql);
  }, [unreadSql, onUnreadChange]);
  useEffect(() => {
    if (unreadSql === 0) return;
    if (typeof document !== "undefined" && document.hidden) return;
    let cancelled = false;
    (async () => {
      try {
        await markReadFn({ data: { reservation_id: reservationId, role: "client" } });
        if (!cancelled) {
          setMessages((prev) =>
            prev.map((m) => (!m.read_by_client ? { ...m, read_by_client: true } : m)),
          );
          setUnreadSql(0);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [unreadSql, reservationId, markReadFn]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const row = await sendFn({ data: { suivi_key: suiviKey, content: trimmed } });
      setMessages((prev) =>
        prev.some((m) => m.id === (row as ChatMessage).id) ? prev : [...prev, row as ChatMessage],
      );
      driverBadgeChannelRef.current?.send({
        type: "broadcast",
        event: "new_client_message",
        payload: { at: Date.now() },
      });
      setText("");
    } catch (e: any) {
      console.error("[suivi-chat] send failed", e);
      toast.error(t("suivi.chat_send_error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "min(320px, 40dvh)" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingRight: "4px",
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "12px", padding: "20px 0" }}>
            {t("suivi.chat_empty")}
          </div>
        )}
        {messages.map((msg) => {
          const mine = msg.sender === "client";
          return (
            <div
              key={msg.id}
              className="suivi-slide"
              style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "75%" }}
            >
              <div
                style={{
                  background: mine ? "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)" : "#f1f5f9",
                  color: mine ? "#fff" : "#0f172a",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>
              <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px", padding: "0 4px" }}>
                {mine ? t("suivi.chat_you") || "Vous" : "José"}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder={t("suivi.chat_placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={sending}
          style={{
            flex: 1,
            padding: "12px 12px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "16px",
            fontFamily: "inherit",
            transition: "all 0.3s",
            color: "#0f172a",
            background: "#ffffff",
            minHeight: "44px",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          style={{
            padding: "10px 16px",
            minWidth: "44px",
            minHeight: "44px",
            background: sending || !text.trim() ? "#cbd5e1" : "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: sending || !text.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.3s",
          }}
        >
          {sending ? <Loader2 size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

// ─── Calendrier ICS ──────────────────────────────────────────────────────────────
function generateICS(reservation: any, t: (k: string) => string): string {
  if (!reservation.pickup_datetime) return "#";
  const start = new Date(reservation.pickup_datetime);
  // Utilise duree_s si disponible, sinon 1h par défaut
  const durationMs = reservation.duree_s ? durationSecondsToMs(reservation.duree_s) : 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const labelDepart = t("suivi.depart_label");
  const labelArrivee = t("suivi.arrivee_label");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Taxi City Bordeaux//FR",
    "BEGIN:VEVENT",
    `UID:tcb-${reservation.id}@taxicitybordeaux.fr`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:🚕 Taxi City Bordeaux`,
    `DESCRIPTION:${labelDepart} : ${reservation.depart}\n${labelArrivee} : ${reservation.destination ?? reservation.arrivee ?? ""}`,
    `LOCATION:${reservation.depart}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([lines], { type: "text/calendar" });
  return URL.createObjectURL(blob);
}

// ─── Facture ──────────────────────────────────────────────────────────────────────
const PICKUP_FEE = 2.83;
const RATE_DAY = 2.16;
const RATE_NIGHT = 3.24;

function InvoiceBlock({ reservation, locale, t }: { reservation: any; locale: string; t: (k: string) => string }) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Fix #7 — sur mobile, "Imprimer" ouvre la facture PDF plutôt que window.print() sur toute la page
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
  const handlePrint = () => {
    if (isMobile) {
      handleDownloadPDF();
    } else {
      window.print();
    }
  };

  const handleSendEmail = async () => {
    const emailAddr =
      (reservation as any).email || (reservation as any).client_email || window.prompt(t("suivi.invoice_email_prompt"));
    if (!emailAddr) return;
    setEmailSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-receipt", {
        body: { reservation_id: reservation.id, email: emailAddr },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success(t("suivi.invoice_email_sent") + " " + emailAddr);
    } catch (e: any) {
      toast.error(t("suivi.invoice_email_error") + " " + (e?.message ?? t("suivi.error_unknown")));
    } finally {
      setEmailSending(false);
    }
  };

  const handleDownloadPDF = () => {
    const invoiceWindow = window.open("", "_blank");
    if (!invoiceWindow) return;
    const RECEIPT_LOCALE: Record<string, string> = {
      fr: "fr-FR",
      en: "en-GB",
      es: "es-ES",
      pt: "pt-PT",
      it: "it-IT",
      ar: "ar-SA",
    };
    const intlLocale = RECEIPT_LOCALE[locale] ?? "fr-FR";
    const dateStr = reservation.pickup_datetime
      ? new Date(reservation.pickup_datetime).toLocaleString(intlLocale, {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Paris",
        })
      : new Date().toLocaleDateString(intlLocale);
    const prix = reservation.prix_estime
      ? new Intl.NumberFormat(intlLocale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)
      : "—";
    // Fix #1 — résoudre les labels i18n avant le template string
    const labelDepart = t("suivi.depart_label");
    const labelArrivee = t("suivi.arrivee_label");
    const labelPassagers = t("suivi.passagers");
    const labelDocTitle = t("suivi.receipt.doc_title");
    const labelReceiptTitle = t("suivi.receipt.title");
    const labelDetailsTitle = t("suivi.receipt.details_title");
    const labelDistance = t("suivi.receipt.distance");
    const labelPayment = t("suivi.receipt.payment");
    const labelTotal = t("suivi.receipt.total");
    const labelPrint = t("suivi.receipt.print");
    const labelClose = t("suivi.receipt.close");
    const labelFooterLegal = t("suivi.receipt.footer_legal");
    const labelFooterThanks = t("suivi.receipt.footer_thanks");
    const dir = locale === "ar" ? "rtl" : "ltr";
    const html = `<!DOCTYPE html><html lang="${locale}" dir="${dir}"><head><meta charset="UTF-8"/>
<title>${labelDocTitle}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; max-width: 700px; margin: 40px auto; padding: 0 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 22px; font-weight: 900; color: #1d4ed8; letter-spacing: -0.5px; }
  .brand small { display: block; font-size: 12px; font-weight: 400; color: #64748b; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #64748b; }
  .meta strong { display: block; font-size: 16px; color: #1a1a1a; font-weight: 700; }
  h2 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .row:last-child { border: none; }
  .row .label { color: #475569; }
  .row .value { font-weight: 600; }
  .total-box { margin-top: 24px; background: #f8fafc; border-radius: 10px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
  .total-box .label { font-size: 14px; color: #475569; }
  .total-box .amount { font-size: 26px; font-weight: 900; color: #1d4ed8; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  .btn { display: inline-block; margin: 20px 8px 0; padding: 10px 24px; background: #1d4ed8; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
</style></head><body>
<div class="header">
  <div class="brand">🚕 Taxi City Bordeaux<small>taxicitybordeaux.fr · 06 73 07 23 22</small></div>
  <div class="meta"><strong>${labelReceiptTitle}</strong>N° ${reservation.id.slice(-8).toUpperCase()}<br/>${dateStr}</div>
</div>
<h2>${labelDetailsTitle}</h2>
<div class="row"><span class="label">${labelDepart} 🟢</span><span class="value">${reservation.depart ?? "—"}</span></div>
<div class="row"><span class="label">${labelArrivee} 🔴</span><span class="value">${reservation.destination ?? reservation.arrivee ?? "—"}</span></div>
${reservation.distance_km != null ? `<div class="row"><span class="label">${labelDistance}</span><span class="value">${Number(reservation.distance_km).toFixed(1)} km</span></div>` : ""}
${reservation.nb_passagers != null ? `<div class="row"><span class="label">${labelPassagers}</span><span class="value">${reservation.nb_passagers}</span></div>` : ""}
${reservation.mode_paiement ? `<div class="row"><span class="label">${labelPayment}</span><span class="value">${reservation.mode_paiement}</span></div>` : ""}
<div class="total-box"><span class="label">${labelTotal}</span><span class="amount">${prix}</span></div>
<div class="no-print" style="text-align:center">
  <button class="btn" onclick="window.print()">${labelPrint}</button>
  <button class="btn" onclick="window.close()" style="background:#64748b">${labelClose}</button>
</div>
<div class="footer">${labelFooterLegal}<br/>${labelFooterThanks}</div>
</body></html>`;
    invoiceWindow.document.write(html);
    invoiceWindow.document.close();
    setTimeout(() => invoiceWindow.print(), 400);
  };

  return (
    <div className="suivi-premium suivi-card" style={{ marginBottom: "16px", padding: "20px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#1d4ed8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <FileText size={14} /> {t("suivi.receipt_title")}
      </div>

      {/* Récap trajet */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            paddingBottom: "8px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <span style={{ color: "#64748b" }}>{t("suivi.depart_label")} 🟢</span>
          <span style={{ fontWeight: 600, color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>
            {reservation.depart}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            paddingBottom: "8px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <span style={{ color: "#64748b" }}>{t("suivi.arrivee_label")} 🔴</span>
          <span style={{ fontWeight: 600, color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>
            {reservation.destination ?? reservation.arrivee ?? "—"}
          </span>
        </div>
        {reservation.distance_km != null && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
              paddingBottom: "8px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ color: "#64748b" }}>{t("suivi.distance")}</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{Number(reservation.distance_km).toFixed(1)} km</span>
          </div>
        )}
        {reservation.mode_paiement && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
              paddingBottom: "8px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ color: "#64748b" }}>{t("suivi.paiement")}</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{reservation.mode_paiement}</span>
          </div>
        )}
        {reservation.prix_estime != null && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>{t("fin.price_label")}</span>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#1d4ed8" }}>
              {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            textAlign: "right",
            marginTop: "2px",
          }}
        >
          {t("suivi.receipt.footer_legal")}
        </div>
      </div>

      {/* Boutons — 2 colonnes sur mobile */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <button
          onClick={handlePrint}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "12px 10px",
            background: "rgba(255,255,255,0.08)",
            color: "#94a3b8",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PrinterIcon size={15} /> {t("suivi.print")}
        </button>
        <button
          onClick={handleDownloadPDF}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "12px 10px",
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
          }}
        >
          <Download size={15} /> {t("suivi.download_pdf")}
        </button>
        <button
          onClick={handleSendEmail}
          disabled={emailSending || emailSent}
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "12px 10px",
            background: emailSent
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : emailSending
                ? "#cbd5e1"
                : "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: emailSending || emailSent ? "not-allowed" : "pointer",
            boxShadow: emailSent ? "0 4px 12px rgba(22,163,74,0.3)" : "0 4px 12px rgba(14,165,233,0.3)",
          }}
        >
          {emailSending ? (
            <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
          ) : emailSent ? (
            <>{t("suivi.invoice_email_done")}</>
          ) : (
            <>{t("suivi.invoice_email_send")}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Course récurrente ─────────────────────────────────────────────────────────
function RecurringModal({ reservation, onClose }: { reservation: any; onClose: () => void }) {
  const t = useT();
  const DAYS = [
    t("suivi.day.sun"),
    t("suivi.day.mon"),
    t("suivi.day.tue"),
    t("suivi.day.wed"),
    t("suivi.day.thu"),
    t("suivi.day.fri"),
    t("suivi.day.sat"),
  ];
  const [freq, setFreq] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(() => {
    if (reservation.pickup_datetime) {
      return new Date(reservation.pickup_datetime).getDay();
    }
    return 1;
  });
  const [time, setTime] = useState<string>(() => {
    if (reservation.pickup_datetime) {
      const d = new Date(reservation.pickup_datetime);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "08:00";
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("recurring_rides").insert([
        {
          source_reservation_id: reservation.id,
          depart: reservation.depart,
          destination: reservation.destination ?? reservation.arrivee,
          nb_passagers: reservation.nb_passagers ?? 1,
          nb_bagages: reservation.nb_bagages ?? 0,
          mode_paiement: reservation.mode_paiement ?? "cb",
          client_name: reservation.client_name,
          frequency: freq,
          day_of_week: dayOfWeek,
          time_hhmm: time,
          active: true,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      setSaved(true);
      toast.success(t("suivi.rec_success"));
      setTimeout(onClose, 1800);
    } catch (e: any) {
      toast.error(t("suivi.rec_error") + " " + (e?.message ?? t("suivi.error_unknown")));
    } finally {
      setSaving(false);
    }
  };

  const freqLabel: Record<string, string> = {
    weekly: t("suivi.rec_weekly"),
    biweekly: t("suivi.rec_biweekly"),
    monthly: t("suivi.rec_monthly"),
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90dvh",
          overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{t("suivi.rec_title")}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {reservation.depart} → {reservation.destination ?? reservation.arrivee ?? "—"}
        </div>

        {/* Fréquence */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            {t("suivi.rec_freq")}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["weekly", "biweekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFreq(f)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  border: "2px solid",
                  borderColor: freq === f ? "#1d4ed8" : "#e2e8f0",
                  background: freq === f ? "#eff6ff" : "#fff",
                  color: freq === f ? "#1d4ed8" : "#64748b",
                  cursor: "pointer",
                }}
              >
                {freqLabel[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Jour */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            {t("suivi.rec_day")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
            {DAYS.map((label, i) => (
              <button
                key={i}
                onClick={() => setDayOfWeek(i)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "2px solid",
                  borderColor: dayOfWeek === i ? "#1d4ed8" : "#e2e8f0",
                  background: dayOfWeek === i ? "#eff6ff" : "#fff",
                  color: dayOfWeek === i ? "#1d4ed8" : "#64748b",
                  cursor: "pointer",
                }}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Heure */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            {t("suivi.rec_time")}
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              fontSize: 16,
              color: "#0f172a",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            width: "100%",
            padding: "15px 16px",
            background: saved
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            cursor: saving || saved ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(29,78,216,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : null}
          {saved ? t("suivi.rec_saved") : saving ? t("suivi.rec_saving") : t("suivi.rec_activate")}
        </button>
      </div>
    </div>
  );
}

// ─── Avis ──────────────────────────────────────────────────────────────────────────
function ReviewBlock({ reservationId, authorName, t }: { reservationId: string; authorName?: string | null; t: (k: string) => string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/public/reviews?reservation_id=${encodeURIComponent(reservationId)}`);
        if (!response.ok) return;
        const state = await response.json();
        if (!cancelled && state.hasReview) setAlreadyReviewed(true);
      } catch {
        // Non bloquant : si la vérification échoue, l'envoi empêchera quand même les doublons côté serveur.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t("suivi.review_select"));
      return;
    }
    setSubmitting(true);
    try {
      const cleanedComment = comment.trim();
      const response = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          author_name: authorName?.trim() || null,
          note: rating,
          commentaire: cleanedComment || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t("suivi.review_impossible"));
      if (result.alreadySubmitted) setAlreadyReviewed(true);
      setSubmitted(true);
      toast.success(t("suivi.review_thanks"));
    } catch (e: any) {
      toast.error(t("suivi.review_error") + " " + (e.message ?? t("suivi.review_impossible")));
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyReviewed || submitted) {
    return (
      <div className="suivi-premium suivi-card" style={{ marginBottom: "16px", padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⭐</div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
          {t("suivi.review_sent")}
        </div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>{t("suivi.review_sent_sub")}</div>
      </div>
    );
  }

  return (
    <div className="suivi-premium suivi-card" style={{ marginBottom: "16px", padding: "20px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#f59e0b",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <Star size={14} /> {t("suivi.review_title")}
      </div>

      {/* Étoiles */}
      <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "16px" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              minWidth: "44px",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.15s",
              transform: (hover || rating) >= star ? "scale(1.2)" : "scale(1)",
            }}
          >
            <Star
              size={32}
              fill={(hover || rating) >= star ? "#f59e0b" : "none"}
              stroke={(hover || rating) >= star ? "#f59e0b" : "#cbd5e1"}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#f59e0b", textAlign: "center", marginBottom: "12px" }}>
          {
            ["", t("fin.star.bad"), t("fin.star.ok"), t("fin.star.good"), t("fin.star.great"), t("fin.star.excellent")][
              rating
            ]
          }
        </div>
      )}

      {/* Commentaire */}
      <textarea
        placeholder={t("fin.rating.comment")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          fontSize: "16px",
          fontFamily: "inherit",
          resize: "vertical",
          marginBottom: "12px",
          boxSizing: "border-box",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: rating === 0 || submitting ? "#e2e8f0" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          color: rating === 0 || submitting ? "#94a3b8" : "#fff",
          border: "none",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: rating === 0 || submitting ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          transition: "all 0.3s",
        }}
      >
        {submitting ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Star size={15} />}
        {submitting ? t("suivi.review_submitting") : t("suivi.review_submit")}
      </button>
    </div>
  );
}

// ─── Partage de trajet enrichi ────────────────────────────────────────────────
function ShareTrajetButton({ reservation }: { reservation: any }) {
  const t = useT();
  const { lang: locale } = useI18n();
  const [open, setOpen] = useState(false);

  // Arrivée estimée : pickup_datetime + duree_s si dispo, sinon "en cours"
  const getETA = (): string => {
    if (reservation.pickup_datetime && reservation.duree_s) {
      const eta = new Date(new Date(reservation.pickup_datetime).getTime() + durationSecondsToMs(reservation.duree_s));
      const ETA_LOCALE: Record<string, string> = {
        fr: "fr-FR",
        en: "en-GB",
        es: "es-ES",
        pt: "pt-PT",
        it: "it-IT",
        ar: "ar-SA",
      };
      return eta.toLocaleTimeString(ETA_LOCALE[locale] ?? "fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      });
    }
    return null as any;
  };

  const eta = getETA();
  const suiviUrl = typeof window !== "undefined" ? window.location.href : "";
  const dest = reservation.destination ?? reservation.arrivee ?? "";

  const buildMessage = (_canal: "sms" | "whatsapp" | "copy"): string => {
    const lines = [
      `${t("suivi.share_msg_route")} ${dest || t("suivi.share_msg_dest_default")}`,
      eta ? `${t("suivi.share_msg_eta")} ${eta}` : null,
      t("suivi.share_msg_follow"),
      suiviUrl,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildMessage("copy"));
      setOpen(false);
      toast.success(t("suivi.share_link_copied"));
    } catch {
      /* noop */
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
          border: "none",
          borderRadius: "8px",
          padding: "8px 12px",
          minHeight: "36px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          fontWeight: 700,
          color: "#fff",
          boxShadow: "0 2px 8px rgba(14,165,233,0.35)",
        }}
      >
        <Share2 size={13} />
        {t("suivi.share")}
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 9998,
          backdropFilter: "blur(3px)",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          zIndex: 9999,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          maxWidth: 480,
          maxHeight: "90dvh",
          overflowY: "auto",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 18px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{t("suivi.share_title")}</div>
        {/* Aperçu du message */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#334155",
            lineHeight: 1.6,
            border: "1px solid #e2e8f0",
            whiteSpace: "pre-line",
          }}
        >
          {buildMessage("copy")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(buildMessage("whatsapp"))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 16px",
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              color: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {t("suivi.share_whatsapp")}
          </a>
          {/* SMS */}
          <a
            href={`sms:?body=${encodeURIComponent(buildMessage("sms"))}`}
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 16px",
              background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
              color: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
            }}
          >
            <MessageCircle size={18} />
            {t("suivi.share_sms")}
          </a>
          {/* Copier */}
          <button
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "13px 16px",
              background: "rgba(248,250,252,1)",
              color: "#334155",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t("suivi.share_copy")}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────────
function SuiviPage() {
  const { id } = Route.useParams();
  const { lang: locale } = useI18n();
  const t = useT();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  // ⚠️ IMPORTANT : le vrai id (clé primaire) de la réservation, résolu après
  // chargement. L'URL /suivi/$id peut contenir soit le vrai id, soit le
  // suivi_id (lien public à expiration 30j) — resolvedId est TOUJOURS le
  // vrai id une fois `reservation` chargée, et doit être utilisé pour tout
  // filtre/insert basé sur reservations.id (Realtime, tracking_events...).
  const resolvedId = reservation?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const josePhone = JOSE_PHONE;
  const [pushDismissed, setPushDismissed] = useState(false);
  const { status: pushStatus, subscribe: pushSubscribe } = usePushNotifications();
  const [pushActivatedHere, setPushActivatedHere] = useState(false);
  useEffect(() => {
    if (!reservation) return;
    try {
      setPushActivatedHere(localStorage.getItem(`push_client_${reservation.id}`) === "1");
    } catch {
      /* ignore */
    }
  }, [reservation?.id]);

  const fetchReservation = useServerFn(getReservationForFinPublic);

  const loadReservation = useCallback(
    async (silent = false, quiet = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const row = await fetchReservation({ data: { key: id } });
        if (!row) {
          setError(t("suivi.not_found"));
        } else {
          const r = row as Reservation;
          setReservation(r);
          isCompletedRef.current = r.status === "completed";
          isCancelledRef.current = r.status === "cancelled";
          if (silent && !quiet) toast.success(t("suivi.status_refreshed"));
          lastUpdateRef.current = Date.now();
          setStaleMinutes(0);
        }
      } catch (e) {
        console.error("Fetch error:", e);
        setError(t("suivi.load_error"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchReservation, id],
  );

  useEffect(() => {
    loadReservation(false);
  }, [loadReservation]);

  // ── Recalcul serveur de la durée (à la minute près) pour les anciennes
  // réservations dont `duree_s` avait été calculé sur le trajet le plus long
  // via rocade (inflation). On ne déclenche qu'une fois par id/session.
  const recomputeDuration = useServerFn(recomputeReservationDuration);
  useEffect(() => {
    if (!reservation?.id || !reservation.duree_s) return;
    if (reservation.status === "completed" || reservation.status === "cancelled") return;
    const cacheKey = `dur_rechecked_${reservation.id}`;
    try {
      if (sessionStorage.getItem(cacheKey) === "1") return;
    } catch {
      /* ignore */
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await recomputeDuration({ data: { id: reservation.id } });
        try {
          sessionStorage.setItem(cacheKey, "1");
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        if (res && "changed" in res && res.changed && typeof res.duree_s === "number") {
          setReservation((prev) => (prev ? { ...prev, duree_s: res.duree_s as number } : prev));
        }
      } catch {
        /* silencieux : si Google indisponible on garde la valeur en base */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reservation?.id, reservation?.duree_s, reservation?.status, recomputeDuration]);

  // ── Fallback temps réel via Supabase Broadcast ──
  // La table `reservations` n'expose aucune policy SELECT à `anon` (PII),
  // donc les événements postgres_changes UPDATE ne sont jamais livrés au
  // client public. Le driver déclenche un broadcast `suivi:<id>` après
  // chaque changement (statut, itinéraire, prix, heure) — on l'écoute ici
  // et on rafraîchit via la RPC SECURITY DEFINER qui contourne RLS.
  useEffect(() => {
    if (!resolvedId) return;
    const ch = (supabase as any)
      .channel(`suivi:${resolvedId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "update" }, () => {
        loadReservation(true, true);
      })
      .subscribe();
    // Refresh au retour d'onglet (iOS suspend souvent la connexion realtime).
    // On n'écoute PAS window.focus : sur mobile, ouvrir le clavier (input chat,
    // sélecteur) déclenche des blur/focus qui rappelaient loadReservation et
    // faisaient "clignoter" les statuts pendant la saisie d'un message.
    // On ajoute aussi un throttle : pas plus d'un refresh toutes les 3s.
    const onVisible = () => {
      if (document.hidden) return;
      if (Date.now() - lastUpdateRef.current < 3000) return;
      loadReservation(true, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [resolvedId, loadReservation]);

  // ── Tracking analytics — log l'ouverture du lien de suivi ──
  // Même correctif : on attend resolvedId (vrai id) plutôt que le param URL
  // brut, sinon reservation_id inséré ici peut être le suivi_id au lieu du
  // vrai id — ce qui fausse silencieusement les analytics du dashboard driver.
  useEffect(() => {
    if (!resolvedId) return;
    const src = new URLSearchParams(window.location.search).get("src") ?? "direct";
    (supabase as any)
      .from("tracking_events")
      .insert({
        reservation_id: resolvedId,
        event_type: "tracking_opened",
        source: src,
        user_agent: navigator.userAgent.slice(0, 200),
      })
      .then(() => {}); // fire & forget
  }, [resolvedId]);

  // ── Realtime connection state ──
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [staleMinutes, setStaleMinutes] = useState(0);
  const lastUpdateRef = useRef<number>(Date.now());
  const channelRef = useRef<any>(null);

  const isCompletedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Stale reminder: toutes les 5 min sans update on incrémente le compteur
  useEffect(() => {
    if (isCompletedRef.current || isCancelledRef.current) return;
    const staleTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 60000);
      setStaleMinutes(elapsed);
      // Après 8 min sans update, rafraîchissement silencieux auto
      if (elapsed > 0 && elapsed % 8 === 0) {
        loadReservation(true);
      }
    }, 60000);
    return () => clearInterval(staleTimer);
  }, [loadReservation]);

  // ── Real-time updates with auto-reconnect ──
  // ⚠️ IMPORTANT : on utilise reservation?.id (le vrai id / clé primaire,
  // résolu par le serveur via getReservationForFinPublic) et NON le param
  // d'URL brut `id`. L'URL /suivi/$id peut contenir soit le vrai id, soit
  // le suivi_id (lien public à expiration 30j) — c'est pour ça que le
  // chargement initial passe par `{ key: id }` côté serveur, qui sait
  // résoudre les deux. Le driver, lui, met à jour via `.eq("id", resa.id)`
  // avec le vrai id. Si on filtre le Realtime sur le param URL brut alors
  // que ce n'est pas le vrai id (cas suivi_id), le filtre Postgres
  // `id=eq.<suivi_id>` ne matche jamais aucun UPDATE → aucune mise à jour
  // temps réel ne remonte jamais, silencieusement.
  useEffect(() => {
    if (!resolvedId) return;

    let destroyed = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function subscribe() {
      if (destroyed) return;
      const taxiSupabase = getTaxiSupabase();
      const channel = taxiSupabase
        .channel(`reservations:id=eq.${resolvedId}_${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${resolvedId}` },
          (payload: any) => {
            try {
              lastUpdateRef.current = Date.now();
              setStaleMinutes(0);
              const newRow = payload.new as Reservation;
              if (!newRow) return;
              const newStatus = newRow.status;
              const newPrice = newRow.prix_estime;
              setReservation((prev) => {
                if (prev && prev.status !== newStatus) {
                  if (newStatus === "accepted") toast.success("✅ " + t("suivi.status.accepted") + " !");
                  else if (newStatus === "en_route") toast.success("🚕 " + t("suivi.status.en_route") + " !");
                  else if (newStatus === "arrived") toast.success("📍 " + t("suivi.status.arrived") + " !");
                  else if (newStatus === "completed")
                    toast.success("🏁 " + t("suivi.status.completed") + " — " + t("suivi.completed_title"));
                }
                if (
                  prev &&
                  prev.prix_estime != null &&
                  newPrice != null &&
                  Number(prev.prix_estime) !== Number(newPrice)
                ) {
                  toast.success(t("suivi.price_updated"));
                }
                isCompletedRef.current = newRow.status === "completed";
                isCancelledRef.current = newRow.status === "cancelled";
                return newRow;
              });
            } catch (e) {
              console.error("Real-time update error:", e);
            }
          },
        )
        .subscribe((status: string) => {
          console.log("[suivi] Realtime status:", status);
          if (status === "SUBSCRIBED") {
            setRealtimeOk(true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setRealtimeOk(false);
            // Reconnect after 5s
            if (!destroyed) {
              retryTimeout = setTimeout(() => {
                try {
                  taxiSupabase.removeChannel(channel);
                } catch {}
                subscribe();
              }, 5000);
            }
          }
        });
      channelRef.current = channel;
    }

    subscribe();

    return () => {
      destroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      try {
        getTaxiSupabase().removeChannel(channelRef.current);
      } catch {}
    };
  }, [resolvedId]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <style>{PREMIUM_CSS}</style>
        <Loader2 size={40} style={{ color: "#1d4ed8", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "20px",
        }}
      >
        <style>{PREMIUM_CSS}</style>
        <div className="suivi-card" style={{ maxWidth: "400px", padding: "40px 24px", textAlign: "center" }}>
          <AlertTriangle size={48} style={{ color: "#991b1b", marginBottom: "16px" }} />
          <h1 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
            {error || t("suivi.not_found")}
          </h1>
          <Link
            to="/"
            style={{
              color: "#1d4ed8",
              textDecoration: "none",
              fontSize: "14px",
              marginTop: "20px",
              display: "inline-block",
            }}
          >
            {t("suivi.back_home_arrow")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Expiration du lien ──
  if (isSuiviExpired(reservation)) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "20px",
        }}
      >
        <style>{PREMIUM_CSS}</style>
        <div className="suivi-card" style={{ maxWidth: "400px", padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔏</div>
          <h1 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
            {t("suivi.expired_title")}
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px", lineHeight: 1.6 }}>
            {t("suivi.expired_desc").replace("{days}", String(SUIVI_EXPIRY_DAYS))}
          </p>
          <a
            href="/reserver"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
              color: "#fff",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "14px",
              boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
            }}
          >
            {t("suivi.expired_cta")}
          </a>
        </div>
      </div>
    );
  }

  const isCompleted = reservation.status === "completed";
  const isCancelled = reservation.status === "cancelled";
  const config = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;

  return (
    <>
      <style>{PREMIUM_CSS}</style>
      <div
        className="suivi-root"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          minHeight: "100dvh",
          padding: "16px",
          paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          maxWidth: "100vw",
          overflowX: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Bouton retour vers site */}
        <div style={{ marginBottom: "12px" }}>
          <a
            href="https://taxicitybordeaux.fr"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              color: "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Taxi City Bordeaux
          </a>
        </div>

        {/* Bandeau reconnexion */}
        {!realtimeOk && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 14px",
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <WifiOff size={14} style={{ color: "#fca5a5", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#fca5a5", fontWeight: 600 }}>{t("suivi.offline_banner")}</span>
          </div>
        )}

        {/* Bandeau page inactive */}
        {staleMinutes >= 5 && !isCompleted && !isCancelled && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 14px",
              background: "rgba(245,158,11,0.15)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600 }}>
              {t("suivi.stale_warning")} {staleMinutes} min — {t("suivi.status_up_to_date")}
            </span>
            <button
              onClick={() => loadReservation(true)}
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#f59e0b",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              {t("suivi.stale_refresh")}
            </button>
          </div>
        )}

        {/* Push banners removed — push activation handled elsewhere */}

        {/* Header Premium */}
        <div className="suivi-premium" style={{ marginBottom: "24px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              padding: "20px",
              boxShadow: "0 8px 32px rgba(15, 23, 42, 0.1)",
            }}
          >
            {/* Heure de prise en charge — très visible */}
            {reservation.pickup_datetime && !isCompleted && (
              <div
                style={{
                  background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <Clock size={18} style={{ color: "#fff", flexShrink: 0 }} />
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {t("suivi.pickup_label")}
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                    {new Date(reservation.pickup_datetime).toLocaleString(locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Paris",
                    })}
                  </div>
                </div>
                {/* Lien calendrier */}
                <a
                  href={generateICS(reservation, t)}
                  download={`taxi-bordeaux-${reservation.id.slice(-6)}.ics`}
                  title={t("suivi.calendar_add_title")}
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <CalendarPlus size={13} />
                  {t("suivi.add_to_cal")}
                </a>
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div>
                <h1 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                  {config.icon} {t(config.label)}
                </h1>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  {t("suivi.booking_ref")}
                  {reservation.id.slice(-8).toUpperCase()}
                </p>
                {/* Nom du chauffeur quand acceptée */}
                {["accepted", "en_route", "arrived"].includes(reservation.status) && reservation.driver_name && (
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 10px",
                      background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
                      borderRadius: "20px",
                      border: "1px solid rgba(34,197,94,0.2)",
                      width: "fit-content",
                    }}
                  >
                    <Car size={12} style={{ color: "#15803d" }} />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#15803d" }}>
                      {reservation.driver_name} {t("suivi.driver_label")}
                    </span>
                  </div>
                )}
              </div>
              {/* Bouton partager — enrichi pendant la course */}
              {["en_route", "arrived", "accepted"].includes(reservation.status) ? (
                <ShareTrajetButton reservation={reservation} />
              ) : typeof navigator !== "undefined" && navigator.share ? (
                <button
                  onClick={() => navigator.share({ title: "Suivi de ma course", url: window.location.href })}
                  style={{
                    background: "rgba(148,163,184,0.1)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    minHeight: "36px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  <Share2 size={13} />
                  {t("suivi.share")}
                </button>
              ) : null}
            </div>

            {/* Véhicule — affiché dès accepted */}
            {["accepted", "en_route", "arrived", "completed"].includes(reservation.status) && (
              <div
                className="vehicle-photo-block"
                style={{
                  marginTop: "12px",
                  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                {/* Photo du véhicule */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "clamp(140px, 42vw, 190px)",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src="/vehicle-jose.jpg"
                    alt={t("suivi.car_alt")}
                    onError={(e) => {
                      // Masque le bloc image si le fichier n'existe pas
                      const parent = (e.target as HTMLImageElement).closest(
                        ".vehicle-photo-block",
                      ) as HTMLElement | null;
                      if (parent) parent.style.display = "none";
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      // "contain" au lieu de "cover" : la hauteur du cadre était fixe (140px)
                      // alors que la largeur rétrécit sur mobile → "cover" recadrait les
                      // côtés de la voiture. "contain" garde le véhicule entier visible.
                      objectFit: "contain",
                      objectPosition: "center center",
                      display: "block",
                    }}
                  />
                  {/* Overlay gradient bas */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "60px",
                      background: "linear-gradient(to top, #0f172a, transparent)",
                    }}
                  />
                  {/* Badge Taxi flottant */}
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      background: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(8px)",
                      borderRadius: "20px",
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    🚕 {t("suivi.your_taxi")}
                  </div>
                </div>

                {/* Infos sous la photo */}
                <div
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                      {VEHICLE_MODEL}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>
                      {VEHICLE_COLOR}
                    </div>
                  </div>
                  {/* Plaque d'immatriculation */}
                  <div
                    style={{
                      padding: "5px 10px",
                      background: "#fff",
                      borderRadius: "6px",
                      border: "2px solid #003189",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 900,
                        color: "#1a1a1a",
                        letterSpacing: "1px",
                        lineHeight: 1.2,
                      }}
                    >
                      {VEHICLE_PLATE}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <PremiumTimeline status={reservation.status} />
          </div>
        </div>

        {/* Routes Card */}
        <div
          className="suivi-premium suivi-card"
          style={{ marginBottom: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <MapPin size={20} style={{ color: "#1d4ed8", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>🟢</span> {t("suivi.depart_label")}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {reservation.depart}
              </div>
            </div>
          </div>
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%)",
            }}
          />
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <MapPin size={20} style={{ color: "#7c3aed", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>🔴</span> {t("suivi.arrivee_label")}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {reservation.destination || reservation.arrivee || "À définir"}
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          {reservation.nb_passagers != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Users size={18} style={{ color: "#1d4ed8", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.passagers")}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_passagers}</div>
            </div>
          )}
          <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
            <Package size={18} style={{ color: "#f59e0b", margin: "0 auto 6px", display: "block" }} />
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.bagages")}</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_bagages ?? 0}</div>
          </div>
          {reservation.distance_km != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Gauge size={18} style={{ color: "#8b5cf6", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.distance")}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                {reservation.distance_km.toFixed(1)} km
              </div>
            </div>
          )}
          {/* Fix #11 — durée estimée si duree_s disponible */}
          {reservation.duree_s != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Clock size={18} style={{ color: "#0ea5e9", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.duration_label")}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                {durationSecondsToMinutes(reservation.duree_s)} {t("suivi.minutes_short")}
              </div>
            </div>
          )}
          {reservation.prix_estime != null &&
            ["accepted", "en_route", "arrived", "completed"].includes(reservation.status) && (
              <div
                className="suivi-premium suivi-card"
                style={{
                  padding: "14px",
                  textAlign: "center",
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                }}
              >
                <CreditCard size={18} style={{ color: "#92400e", margin: "0 auto 6px", display: "block" }} />
                <div style={{ fontSize: "13px", color: "#92400e", marginBottom: "4px" }}>{t("suivi.tarif_estime")}</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400e" }}>
                  {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
                    reservation.prix_estime,
                  )}
                </div>
              </div>
            )}
          {reservation.mode_paiement && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <CreditCard size={18} style={{ color: "#0ea5e9", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.paiement")}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{reservation.mode_paiement}</div>
            </div>
          )}
        </div>

        {/* Contact Jose */}
        {!isCompleted && (
          <div className="suivi-premium suivi-card" style={{ marginBottom: "16px", padding: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#1d4ed8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "12px",
              }}
            >
              📞 {t("suivi.contact_title")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <a
                href={`tel:${josePhone}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 14px",
                  background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                  color: "#fff",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: "none",
                  transition: "all 0.3s",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(29, 78, 216, 0.3)",
                }}
              >
                <Phone size={16} />
                <span style={{ flex: 1 }}>{t("suivi.call_jose")}</span>
                <span style={{ fontSize: "12px", opacity: 0.8, fontWeight: 400 }}>
                  {josePhone.replace(/(\d{2})(?=\d)/g, "$1 ").trim()}
                </span>
              </a>
              <a
                href={`https://wa.me/${josePhone.replace(/^0/, "33")}?text=${encodeURIComponent(`Bonjour José`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 14px",
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  color: "#fff",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: "none",
                  transition: "all 0.3s",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
                }}
              >
                <MessageCircle size={16} />
                {t("suivi.whatsapp_jose")}
              </a>
            </div>
          </div>
        )}

        {/* Chat */}
        {!isCompleted && <ChatSection suiviKey={id} reservationId={reservation.id} t={t} />}

        {/* Bloc Course terminée — Facture + Avis */}
        {isCompleted && (
          <>
            <InvoiceBlock reservation={reservation} locale={locale} t={t} />
            <ReviewBlock reservationId={reservation.id} authorName={reservation.client_name ?? reservation.nom ?? "Client"} t={t} />
            {/* Actions post-course */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              {/* 🔁 Rebooker le même trajet */}
              <a
                href={`/reserver?depart=${encodeURIComponent(reservation.depart ?? "")}&destination=${encodeURIComponent(reservation.destination ?? reservation.arrivee ?? "")}&passagers=${reservation.nb_passagers ?? 1}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "13px 16px",
                  background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                  color: "#fff",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                  boxShadow: "0 4px 12px rgba(29, 78, 216, 0.3)",
                }}
              >
                🔁 {t("suivi.rebook_same").replace("🔁 ", "")}
              </a>
              {/* 🗓️ Trajet récurrent */}
              <button
                onClick={() => setShowRecurring(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "13px 16px",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                }}
              >
                <CalendarPlus size={16} /> {t("suivi.rebook_weekly")}
              </button>
              <Link
                to="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "11px 16px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#94a3b8",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: "1px solid rgba(148,163,184,0.15)",
                }}
              >
                {t("suivi.back_home")}
              </Link>
            </div>
            {/* Modal récurrent */}
            {showRecurring && <RecurringModal reservation={reservation} onClose={() => setShowRecurring(false)} />}
          </>
        )}

        {/* Bouton Rafraîchir — masqué si course terminée ou annulée */}
        {!isCompleted && !isCancelled && (
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={() => loadReservation(true)}
              disabled={refreshing}
              style={{
                width: "100%",
                padding: "13px 16px",
                background: refreshing ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
                color: refreshing ? "#64748b" : "#94a3b8",
                border: "1px solid rgba(148,163,184,0.15)",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: refreshing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.3s",
                backdropFilter: "blur(10px)",
              }}
            >
              {refreshing ? (
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <span style={{ fontSize: "16px" }}>🔄</span>
              )}
              {refreshing ? t("suivi.refreshing") : t("suivi.refresh")}
            </button>
          </div>
        )}

        {/* Footer — masqué si completed ou cancelled (boutons dans le bloc terminée) */}
        {!isCompleted && !isCancelled && (
          <div style={{ textAlign: "center" }}>
            <Link
              to="/"
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                textDecoration: "none",
                transition: "color 0.3s",
              }}
            >
              {t("suivi.back_home_arrow")}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
