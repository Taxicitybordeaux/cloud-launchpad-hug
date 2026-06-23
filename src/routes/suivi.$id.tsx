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
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { getReservationForFinPublic } from "@/lib/reservation.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
const JOSE_PHONE = "0600000000";

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
    label: "En route",
    color: "#1d4ed8",
    bgGradient: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
    borderColor: "rgba(29, 78, 216, 0.2)",
    icon: "🚕",
  },
  arrived: {
    label: "Arrivé",
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
  const steps = ["pending", "accepted", "en_route", "arrived", "completed"];
  if (status === "cancelled") return null;

  const currentIdx = steps.indexOf(status as any);

  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center", width: "100%" }}>
      {steps.map((s, i) => {
        const isDone = i <= currentIdx;
        const isActive = i === currentIdx;
        const config = STATUS_CONFIG[s];

        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1, gap: "4px" }}>
            <div
              className={`suivi-premium ${isActive && status === "en_route" ? "suivi-pulse-active" : ""}`}
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
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  background: isDone ? `linear-gradient(90deg, ${config.color}20, ${config.color}50)` : "#e2e8f0",
                  borderRadius: "1px",
                  transition: "all 0.4s ease",
                  minWidth: "8px",
                }}
              />
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
      await (supabase as any).from("direct_messages").insert([
        {
          reservation_id: reservationId,
          anon_id: anonId,
          anon_name: name,
          message: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);
      setText("");
    } catch (e) {
      toast.error("Erreur d'envoi");
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
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "12px", paddingY: "20px" }}>
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

// ─── Main Component ───────────────────────────────────────────────────────────────
function SuiviPage() {
  const { id } = Route.useParams();
  const { locale } = useI18n();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const josePhone = JOSE_PHONE;

  const getReservation = useServerFn(getReservationForFinPublic);

  useEffect(() => {
    (async () => {
      try {
        const res = await getReservation({ reservationId: id });
        if (!res) {
          setError("Réservation introuvable");
        } else {
          setReservation(res);
        }
      } catch {
        setError("Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, getReservation]);

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
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
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
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                  {config.icon} {config.label}
                </h1>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  Réservation #{reservation.id.slice(-8).toUpperCase()}
                </p>
              </div>
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
                }}
              >
                Départ
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
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
                }}
              >
                Arrivée
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                {reservation.destination || reservation.arrivee || "À définir"}
              </div>
            </div>
          </div>
        </div>

        {/* Pickup Time */}
        {reservation.pickup_datetime && (
          <div
            className="suivi-premium suivi-card"
            style={{ marginBottom: "16px", padding: "16px", display: "flex", gap: "12px", alignItems: "center" }}
          >
            <Clock size={20} style={{ color: "#15803d", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>
                Horaire
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {new Date(reservation.pickup_datetime).toLocaleString(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Paris",
                })}
              </div>
            </div>
          </div>
        )}

        {/* Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          {reservation.nb_passagers != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Users size={18} style={{ color: "#1d4ed8", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Passagers</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_passagers}</div>
            </div>
          )}
          {reservation.nb_bagages != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Package size={18} style={{ color: "#f59e0b", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Bagages</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>{reservation.nb_bagages}</div>
            </div>
          )}
          {reservation.distance_km != null && (
            <div className="suivi-premium suivi-card" style={{ padding: "14px", textAlign: "center" }}>
              <Gauge size={18} style={{ color: "#8b5cf6", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Distance</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                {reservation.distance_km.toFixed(1)} km
              </div>
            </div>
          )}
          {reservation.prix_estime != null && (
            <div
              className="suivi-premium suivi-card"
              style={{
                padding: "14px",
                textAlign: "center",
                background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              }}
            >
              <CreditCard size={18} style={{ color: "#92400e", margin: "0 auto 6px", display: "block" }} />
              <div style={{ fontSize: "11px", color: "#92400e", marginBottom: "4px" }}>Tarif estimé</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#92400e" }}>
                {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)}
              </div>
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
                Appeler José
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

        {/* Footer */}
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
      </div>
    </>
  );
}
