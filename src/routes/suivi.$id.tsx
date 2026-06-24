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
} from "lucide-react";
import { useI18n, useT } from "@/i18n/I18nProvider";
import { getReservationForFinPublic } from "@/lib/reservation.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getTaxiSupabase } from "@/lib/taxi-supabase";

export const Route = createFileRoute("/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de votre taxi — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
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
const VEHICLE_MODEL = "Mercedes-Benz Classe E";
const VEHICLE_COLOR = "Gris anthracite";
const VEHICLE_PLATE = "HF-450-JG";

const PREMIUM_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; }
  
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
    backdrop-filter: blur(10px);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .suivi-card:hover {
    box-shadow: 0 8px 40px rgba(15, 23, 42, 0.12);
    transform: translateY(-2px);
  }
  
  .suivi-glass {
    background: rgba(255, 255, 255, 0.7);
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
  nb_passagers?: number | null;
  nb_bagages?: number | null;
  mode_paiement?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
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
    label: "Complétée",
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
  const steps = ["pending", "accepted", "arrived", "completed"];
  if (status === "cancelled") return null;

  const currentIdx = steps.indexOf(status as any);

  const stepLabels: Record<string, string> = {
    pending: "En attente",
    accepted: "Confirmée",
    arrived: "Devant chez vous",
    completed: "suivi.status.completed",
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
      {steps.map((s, i) => {
        const isDone = i <= currentIdx;
        const isActive = i === currentIdx;
        const config = STATUS_CONFIG[s];

        return (
          <div key={s} style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
            {/* Étape + label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                flex: "0 0 auto",
                width: "52px",
              }}
            >
              <div
                className={`suivi-premium ${isActive && status === "arrived" ? "suivi-pulse-active" : ""}`}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: isDone ? config.bgGradient : "#e2e8f0",
                  border: `2px solid ${isDone ? config.borderColor : "transparent"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
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
                  fontSize: "11px",
                  fontWeight: isActive ? 700 : 500,
                  color: isDone ? config.color : "#94a3b8",
                  textAlign: "center",
                  lineHeight: 1.2,
                  maxWidth: "52px",
                  wordBreak: "break-word",
                }}
              >
                {stepLabels[s]}
              </div>
            </div>
            {/* Ligne entre étapes */}
            {i < steps.length - 1 && (
              <div style={{ flex: 1, paddingTop: "15px" }}>
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

// ─── Chat Component ───────────────────────────────────────────────────────────────
function AnonChat({ reservationId }: { reservationId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem(`tcb_anon_name_${reservationId}`) || "");
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem(`tcb_anon_name_${reservationId}`));
  const endRef = useRef<HTMLDivElement>(null);
  const anonId = getAnonChatId(reservationId);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("direct_messages")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: true })
      .limit(60);
    setMessages(data ?? []);
  }, [reservationId]);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel(`chat_suivi_${reservationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `reservation_id=eq.${reservationId}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [reservationId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || !nameSet) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("direct_messages").insert([
        {
          reservation_id: reservationId,
          anon_id: anonId,
          anon_name: name,
          message: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Chat error:", error);
        toast.error("Erreur d'envoi du message");
        return;
      }

      setText("");
      toast.success("Message envoyé");
    } catch (e) {
      console.error("Send error:", e);
      toast.error("Erreur de connexion");
    } finally {
      setSending(false);
    }
  };

  const setNameAndContinue = () => {
    if (!name.trim()) return;
    localStorage.setItem(`tcb_anon_name_${reservationId}`, name);
    setNameSet(true);
  };

  if (!nameSet) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          type="text"
          placeholder="Votre prénom..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setNameAndContinue()}
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "14px",
            fontFamily: "inherit",
            transition: "all 0.3s",
          }}
        />
        <button
          onClick={setNameAndContinue}
          style={{
            padding: "10px 14px",
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.3s",
          }}
        >
          Continuer
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "320px" }}>
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
            Pas de messages encore
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className="suivi-slide"
            style={{
              alignSelf: msg.anon_id === anonId ? "flex-end" : "flex-start",
              maxWidth: "75%",
            }}
          >
            <div
              style={{
                background: msg.anon_id === anonId ? "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)" : "#f1f5f9",
                color: msg.anon_id === anonId ? "#fff" : "#0f172a",
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: "13px",
                wordBreak: "break-word",
              }}
            >
              {msg.message}
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px", padding: "0 4px" }}>
              {msg.anon_name || "José"}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={sending}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            fontFamily: "inherit",
            transition: "all 0.3s",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          style={{
            padding: "10px 14px",
            background: sending || !text.trim() ? "#cbd5e1" : "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: sending || !text.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
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

function getAnonChatId(reservationId: string): string {
  const key = `tcb_anon_chat_${reservationId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = `anon_${reservationId}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ─── Calendrier ICS ──────────────────────────────────────────────────────────────
function generateICS(reservation: any): string {
  if (!reservation.pickup_datetime) return "#";
  const start = new Date(reservation.pickup_datetime);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h par défaut
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
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
    `DESCRIPTION:Départ : ${reservation.depart}\nArrivée : ${reservation.destination ?? reservation.arrivee ?? ""}`,
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

  const handlePrint = () => window.print();

  const handleSendEmail = async () => {
    const emailAddr =
      (reservation as any).email ||
      (reservation as any).client_email ||
      window.prompt("Adresse email du client :");
    if (!emailAddr) return;
    setEmailSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-receipt", {
        body: { reservation_id: reservation.id, email: emailAddr },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success("📧 Reçu envoyé à " + emailAddr);
    } catch (e: any) {
      toast.error("Erreur envoi email : " + (e?.message ?? "inconnue"));
    } finally {
      setEmailSending(false);
    }
  };

  const handleDownloadPDF = () => {
    const invoiceWindow = window.open("", "_blank");
    if (!invoiceWindow) return;
    const dateStr = reservation.pickup_datetime
      ? new Date(reservation.pickup_datetime).toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Paris",
        })
      : new Date().toLocaleDateString("fr-FR");
    const prix = reservation.prix_estime
      ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(reservation.prix_estime)
      : "—";
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Facture — Taxi City Bordeaux</title>
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
  <div class="brand">🚕 Taxi City Bordeaux<small>taxicitybordeaux.fr · 06 73 07 23 22</small></div>
  <div class="meta"><strong>Reçu de course</strong>N° ${reservation.id.slice(-8).toUpperCase()}<br/>${dateStr}</div>
</div>
<h2>Détails du trajet</h2>
<div class="row"><span class="label">{t("suivi.depart_label")} 🟢</span><span class="value">${reservation.depart ?? "—"}</span></div>
<div class="row"><span class="label">{t("suivi.arrivee_label")} 🔴</span><span class="value">${reservation.destination ?? reservation.arrivee ?? "—"}</span></div>
${reservation.distance_km != null ? `<div class="row"><span class="label">Distance</span><span class="value">${Number(reservation.distance_km).toFixed(1)} km</span></div>` : ""}
${reservation.nb_passagers != null ? `<div class="row"><span class="label">{t("suivi.passagers")}</span><span class="value">${reservation.nb_passagers}</span></div>` : ""}
${reservation.mode_paiement ? `<div class="row"><span class="label">Paiement</span><span class="value">${reservation.mode_paiement}</span></div>` : ""}
<div class="total-box"><span class="label">Total course</span><span class="amount">${prix}</span></div>
<div class="no-print" style="text-align:center">
  <button class="btn" onclick="window.print()">🖨️ Imprimer</button>
  <button class="btn" onclick="window.close()" style="background:#64748b">Fermer</button>
</div>
<div class="footer">Taxi City Bordeaux — SIRET : à compléter — TVA non applicable, art. 293 B du CGI<br/>Merci de votre confiance !</div>
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
      </div>

      {/* Boutons */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={handlePrint}
          style={{
            flex: 1,
            minWidth: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 10px",
            background: "rgba(255,255,255,0.08)",
            color: "#94a3b8",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PrinterIcon size={14} /> {t("suivi.print")}
        </button>
        <button
          onClick={handleDownloadPDF}
          style={{
            flex: 1,
            minWidth: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 10px",
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
          }}
        >
          <Download size={14} /> {t("suivi.download_pdf")}
        </button>
        {/* ── Email ── */}
        <button
          onClick={handleSendEmail}
          disabled={emailSending || emailSent}
          style={{
            flex: 1,
            minWidth: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 10px",
            background: emailSent
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : emailSending
              ? "#cbd5e1"
              : "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: emailSending || emailSent ? "not-allowed" : "pointer",
            boxShadow: emailSent
              ? "0 4px 12px rgba(22,163,74,0.3)"
              : "0 4px 12px rgba(14,165,233,0.3)",
          }}
        >
          {emailSending ? (
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          ) : emailSent ? (
            <>✓ Envoyé</>
          ) : (
            <>📧 Email</>
          )}
        </button>
      </div>
    </div>
  );
}


// ─── Course récurrente ─────────────────────────────────────────────────────────
const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function RecurringModal({
  reservation,
  onClose,
}: {
  reservation: any;
  onClose: () => void;
}) {
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
      const { error } = await (supabase as any).from("recurring_rides").insert([{
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
      }]);
      if (error) throw error;
      setSaved(true);
      toast.success("🗓️ Trajet récurrent activé !");
      setTimeout(onClose, 1800);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message ?? "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const freqLabel: Record<string, string> = {
    weekly: "Chaque semaine",
    biweekly: "Toutes les 2 sem.",
    monthly: "Chaque mois",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 9999, backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 40px",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          🗓️ Réserver ce trajet régulièrement
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {reservation.depart} → {reservation.destination ?? reservation.arrivee ?? "—"}
        </div>

        {/* Fréquence */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 8 }}>
            Fréquence
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["weekly", "biweekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFreq(f)}
                style={{
                  flex: 1, padding: "10px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700,
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 8 }}>
            Jour
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
            {DAYS_FR.map((label, i) => (
              <button
                key={i}
                onClick={() => setDayOfWeek(i)}
                style={{
                  padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 8 }}>
            Heure de prise en charge
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1.5px solid #e2e8f0", fontSize: 16, color: "#0f172a",
              fontFamily: "inherit", boxSizing: "border-box" as const,
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            width: "100%", padding: "15px 16px",
            background: saved
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 800, cursor: saving || saved ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(29,78,216,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {saving ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : null}
          {saved ? "✓ Activé !" : saving ? "Enregistrement…" : "Activer ce trajet récurrent"}
        </button>
      </div>
    </div>
  );
}

// ─── Avis ──────────────────────────────────────────────────────────────────────────
function ReviewBlock({ reservationId, t }: { reservationId: string; t: (k: string) => string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    // Vérifier si un avis a déjà été soumis pour cette réservation
    (async () => {
      const { data } = await (supabase as any)
        .from("reviews")
        .select("id")
        .eq("reservation_id", reservationId)
        .maybeSingle();
      if (data) setAlreadyReviewed(true);
    })();
  }, [reservationId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Veuillez sélectionner une note");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("reviews").insert([
        {
          reservation_id: reservationId,
          rating,
          comment: comment.trim() || null,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      setSubmitted(true);
      toast.success("⭐ Merci pour votre avis !");
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? "impossible d'envoyer l'avis"));
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
              padding: "4px",
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
          fontSize: "13px",
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
  const [open, setOpen] = useState(false);

  // Arrivée estimée : pickup_datetime + duree_s si dispo, sinon "en cours"
  const getETA = (): string => {
    if (reservation.pickup_datetime && reservation.duree_s) {
      const eta = new Date(
        new Date(reservation.pickup_datetime).getTime() + reservation.duree_s * 1000,
      );
      return eta.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    }
    return null as any;
  };

  const eta = getETA();
  const suiviUrl = typeof window !== "undefined" ? window.location.href : "";
  const dest = reservation.destination ?? reservation.arrivee ?? "";

  const buildMessage = (canal: "sms" | "whatsapp" | "copy"): string => {
    const lines = [
      `🚕 Je suis en route vers ${dest || "ma destination"}`,
      eta ? `⏱️ Arrivée estimée : ${eta}` : null,
      `📍 Suis mon trajet en direct :`,
      suiviUrl,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildMessage("copy"));
      // petit toast visuel sans dépendance
      setOpen(false);
      // toast from sonner already imported
      toast.success("📋 Lien copié !");
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
          padding: "6px 10px",
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
        Partager
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 9998, backdropFilter: "blur(3px)",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#fff", borderRadius: "20px 20px 0 0",
          padding: "20px 20px 40px",
          zIndex: 9999,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 18px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          📱 Partager mon trajet
        </div>
        {/* Aperçu du message */}
        <div
          style={{
            background: "#f8fafc", borderRadius: 10, padding: "12px 14px",
            marginBottom: 16, fontSize: 13, color: "#334155", lineHeight: 1.6,
            border: "1px solid #e2e8f0", whiteSpace: "pre-line",
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
              display: "flex", alignItems: "center", gap: 10,
              padding: "13px 16px",
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              color: "#fff", borderRadius: 12, textDecoration: "none",
              fontWeight: 700, fontSize: 14,
              boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Envoyer sur WhatsApp
          </a>
          {/* SMS */}
          <a
            href={`sms:?body=${encodeURIComponent(buildMessage("sms"))}`}
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "13px 16px",
              background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
              color: "#fff", borderRadius: 12, textDecoration: "none",
              fontWeight: 700, fontSize: 14,
              boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
            }}
          >
            <MessageCircle size={18} />
            Envoyer par SMS
          </a>
          {/* Copier */}
          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "13px 16px",
              background: "rgba(248,250,252,1)",
              color: "#334155", border: "1px solid #e2e8f0",
              borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            📋 Copier le lien
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const josePhone = JOSE_PHONE;

  const fetchReservation = useServerFn(getReservationForFinPublic);

  const loadReservation = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const row = await fetchReservation({ data: { key: id } });
        if (!row) {
          setError("Réservation introuvable");
        } else {
          const r = row as Reservation;
          setReservation(r);
          isCompletedRef.current = r.status === "completed";
          isCancelledRef.current = r.status === "cancelled";
          if (silent) toast.success("Statut actualisé ✓");
        }
      } catch (e) {
        console.error("Fetch error:", e);
        setError("Erreur de chargement");
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
  useEffect(() => {
    if (!id) return;

    let destroyed = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function subscribe() {
      if (destroyed) return;
      const taxiSupabase = getTaxiSupabase();
      const channel = taxiSupabase
        .channel(`reservations:id=eq.${id}_${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${id}` },
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
                  toast.success("💶 Le prix a été mis à jour.");
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
  }, [id]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
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
          minHeight: "100vh",
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
            {error || "Réservation non trouvée"}
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
            ← Retour à l'accueil
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
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "20px",
        }}
      >
        <style>{PREMIUM_CSS}</style>
        <div
          className="suivi-card"
          style={{ maxWidth: "400px", padding: "40px 24px", textAlign: "center" }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔏</div>
          <h1 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
            Ce suivi a expiré
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px", lineHeight: 1.6 }}>
            Le lien de suivi est accessible pendant {SUIVI_EXPIRY_DAYS} jours après la course.
            Pour revoir votre historique, connectez-vous à votre espace client.
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
            🚕 Réserver un taxi
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
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          minHeight: "100vh",
          padding: "16px",
          paddingBottom: "32px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
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
              {t("suivi.stale_warning")} {staleMinutes} min — statut à jour ?
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
                  href={generateICS(reservation)}
                  download={`taxi-bordeaux-${reservation.id.slice(-6)}.ics`}
                  title="Ajouter au calendrier"
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
                    padding: "6px 8px",
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
            {["accepted", "en_route", "arrived"].includes(reservation.status) && (
              <div
                style={{
                  marginTop: "12px",
                  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                {/* Photo du véhicule */}
                <div style={{ position: "relative", width: "100%", height: "140px", overflow: "hidden" }}>
                  <img
                    src="/vehicle-jose.jpg"
                    alt="Mercedes-Benz Classe E — Taxi City Bordeaux"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center 30%",
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
                        fontSize: "7px",
                        fontWeight: 800,
                        color: "#003189",
                        letterSpacing: "0.3px",
                        lineHeight: 1,
                      }}
                    >
                      F
                    </div>
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
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Passagers</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_passagers}</div>
            </div>
          )}
          {reservation.nb_bagages != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Package size={18} style={{ color: "#f59e0b", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.bagages")}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_bagages}</div>
            </div>
          )}
          {reservation.distance_km != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Gauge size={18} style={{ color: "#8b5cf6", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>{t("suivi.distance")}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                {reservation.distance_km.toFixed(1)} km
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
        {!isCompleted && (
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
              Chat avec José
            </div>
            <AnonChat reservationId={reservation.id} />
          </div>
        )}

        {/* Bloc Course terminée — Facture + Avis */}
        {isCompleted && (
          <>
            <InvoiceBlock reservation={reservation} locale={locale} t={t} />
            <ReviewBlock reservationId={reservation.id} t={t} />
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
                🔁 Réserver le même trajet
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
                <CalendarPlus size={16} /> Réserver ce trajet chaque semaine
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
            {showRecurring && (
              <RecurringModal
                reservation={reservation}
                onClose={() => setShowRecurring(false)}
              />
            )}
          </>
        )}

        {/* Bouton Rafraîchir — masqué si course terminée */}
        {!isCompleted && (
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

        {/* Footer — masqué si completed (boutons dans le bloc terminée) */}
        {!isCompleted && (
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
              ← Retour à l'accueil
            </Link>
          </div>
        )}
      </div>
    </>
  );
}