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
import { useI18n } from "@/i18n/I18nProvider";
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
  status: string;
  prix_estime?: number | null;
  distance_km?: number | null;
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
    label: "En attente",
    color: "#92400e",
    bgGradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    borderColor: "rgba(217, 119, 6, 0.2)",
    icon: "⏳",
  },
  accepted: {
    label: "Confirmée",
    color: "#15803d",
    bgGradient: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
    borderColor: "rgba(34, 197, 94, 0.2)",
    icon: "✨",
  },
  en_route: {
    label: "Le chauffeur arrive chez vous",
    color: "#1d4ed8",
    bgGradient: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
    borderColor: "rgba(29, 78, 216, 0.2)",
    icon: "🚕",
  },
  arrived: {
    label: "Arrivé devant chez vous",
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
    label: "Annulée",
    color: "#991b1b",
    bgGradient: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
    borderColor: "rgba(185, 28, 28, 0.2)",
    icon: "✕",
  },
};

// ─── Timeline Stepper ──────────────────────────────────────────────────────────────
function PremiumTimeline({ status }: { status: string }) {
  const steps = ["pending", "accepted", "arrived", "completed"];
  if (status === "cancelled") return null;

  const currentIdx = steps.indexOf(status as any);

  const stepLabels: Record<string, string> = {
    pending: "En attente",
    accepted: "Confirmée",
    arrived: "Devant chez vous",
    completed: "Terminée",
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
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px", paddingX: "4px" }}>
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

function InvoiceBlock({ reservation, locale }: { reservation: any; locale: string }) {
  const handlePrint = () => window.print();

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
<div class="row"><span class="label">🟢 Départ</span><span class="value">${reservation.depart ?? "—"}</span></div>
<div class="row"><span class="label">🔴 Arrivée</span><span class="value">${reservation.destination ?? reservation.arrivee ?? "—"}</span></div>
${reservation.distance_km != null ? `<div class="row"><span class="label">Distance</span><span class="value">${Number(reservation.distance_km).toFixed(1)} km</span></div>` : ""}
${reservation.nb_passagers != null ? `<div class="row"><span class="label">Passagers</span><span class="value">${reservation.nb_passagers}</span></div>` : ""}
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
        <FileText size={14} /> Reçu de course
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
          <span style={{ color: "#64748b" }}>🟢 Départ</span>
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
          <span style={{ color: "#64748b" }}>🔴 Arrivée</span>
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
            <span style={{ color: "#64748b" }}>Distance</span>
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
            <span style={{ color: "#64748b" }}>Paiement</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{reservation.mode_paiement}</span>
          </div>
        )}
        {reservation.prix_estime != null && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Total</span>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#1d4ed8" }}>
              {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)}
            </span>
          </div>
        )}
      </div>

      {/* Boutons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handlePrint}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 12px",
            background: "rgba(255,255,255,0.08)",
            color: "#94a3b8",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PrinterIcon size={15} /> Imprimer
        </button>
        <button
          onClick={handleDownloadPDF}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 12px",
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
          <Download size={15} /> Télécharger PDF
        </button>
      </div>
    </div>
  );
}

// ─── Avis ──────────────────────────────────────────────────────────────────────────
function ReviewBlock({ reservationId }: { reservationId: string }) {
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
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Avis envoyé</div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Merci pour votre retour, cela nous aide à nous améliorer !
        </div>
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
        <Star size={14} /> Votre avis
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
          {["", "Très décevant", "Décevant", "Correct", "Bien", "Excellent !"][rating]}
        </div>
      )}

      {/* Commentaire */}
      <textarea
        placeholder="Un commentaire ? (optionnel)"
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
        {submitting ? "Envoi…" : "Envoyer mon avis"}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────────
function SuiviPage() {
  const { id } = Route.useParams();
  const { locale } = useI18n();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  }, [isCompleted, isCancelled, loadReservation]);

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
                  if (newStatus === "accepted") toast.success("✅ Votre course a été confirmée !");
                  else if (newStatus === "en_route") toast.success("🚕 Le chauffeur arrive chez vous !");
                  else if (newStatus === "arrived") toast.success("📍 Le chauffeur est devant chez vous !");
                  else if (newStatus === "completed") toast.success("🏁 Course terminée. Merci !");
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
            <span style={{ fontSize: "12px", color: "#fca5a5", fontWeight: 600 }}>
              Connexion interrompue — Reconnexion en cours…
            </span>
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
              ⏱ Page ouverte depuis {staleMinutes} min — statut à jour ?
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
              Actualiser
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
                    Prise en charge
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
                  <CalendarPlus size={13} /> Cal
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
                  {config.icon} {config.label}
                </h1>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  Réservation #{reservation.id.slice(-8).toUpperCase()}
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
                      {reservation.driver_name} est votre chauffeur
                    </span>
                  </div>
                )}
              </div>
              {/* Bouton partager */}
              {typeof navigator !== "undefined" && navigator.share && (
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
                  <Share2 size={13} /> Partager
                </button>
              )}
            </div>

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
                <span>🟢</span> Départ
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
                <span>🔴</span> Arrivée
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
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Bagages</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_bagages}</div>
            </div>
          )}
          {reservation.distance_km != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Gauge size={18} style={{ color: "#8b5cf6", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Distance</div>
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
                <div style={{ fontSize: "13px", color: "#92400e", marginBottom: "4px" }}>Tarif estimé</div>
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
              <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Paiement</div>
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
              📞 Besoin d'aide ?
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
                <span style={{ flex: 1 }}>Appeler José</span>
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
                WhatsApp
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
            <InvoiceBlock reservation={reservation} locale={locale} />
            <ReviewBlock reservationId={reservation.id} />
            {/* Boutons navigation */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              <Link
                to="/reservation"
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
                🚕 Réserver un nouveau trajet
              </Link>
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
                ← Retour à l'accueil
              </Link>
            </div>
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
              {refreshing ? "Actualisation…" : "Actualiser le statut"}
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
