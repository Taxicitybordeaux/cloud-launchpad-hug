import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
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

// ─── Numéro de José ─────────────────────────────────────────────────────────
const JOSE_PHONE = "0600000000"; // ← remplacer par le vrai numéro

// ─── CSS animations ──────────────────────────────────────────────────────────
const globalCss = `
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(29,78,216,0.4); }
    70% { box-shadow: 0 0 0 10px rgba(29,78,216,0); }
    100% { box-shadow: 0 0 0 0 rgba(29,78,216,0); }
  }
  .suivi-pulse { animation: pulse-ring 1.8s ease-in-out infinite; }
  @keyframes fade-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  .suivi-fadein { animation: fade-in 0.35s ease both; }
`;

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
};

function formatPickup(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

// ─── Statut config ───────────────────────────────────────────────────────────
const STEPS = ["pending", "accepted", "en_route", "arrived", "completed"] as const;
const STATUS_MAP: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  pending: { label: "En attente de confirmation", emoji: "⏳", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  accepted: { label: "Course confirmée", emoji: "✅", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  en_route: { label: "Le chauffeur est en route", emoji: "🚕", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  arrived: { label: "Le chauffeur est arrivé", emoji: "📍", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  completed: { label: "Course terminée", emoji: "🏁", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
  cancelled: { label: "Course annulée", emoji: "❌", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
};
const STEP_LABELS: Record<string, string> = {
  pending: "Demande",
  accepted: "Confirmée",
  en_route: "En route",
  arrived: "Arrivé",
  completed: "Terminée",
};

// ─── Stepper ─────────────────────────────────────────────────────────────────
function StatusStepper({ status }: { status: string }) {
  if (status === "cancelled") return null;
  const currentIdx = STEPS.indexOf(status as any);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 4 }}>
      {STEPS.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                className={active && status === "en_route" ? "suivi-pulse" : ""}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: done ? (active ? (STATUS_MAP[status]?.color ?? "#0f172a") : "#22c55e") : "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  transition: "background 0.3s",
                  border: active ? `2px solid ${STATUS_MAP[status]?.color ?? "#0f172a"}` : "2px solid transparent",
                }}
              >
                {done ? (
                  active ? (
                    (STATUS_MAP[s]?.emoji ?? "•")
                  ) : (
                    "✓"
                  )
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>{i + 1}</span>
                )}
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: done ? "#0f172a" : "#94a3b8",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.03em",
                }}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: i < currentIdx ? "#22c55e" : "#e2e8f0",
                  margin: "0 4px",
                  marginBottom: 16,
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chat anonyme ─────────────────────────────────────────────────────────────
function getAnonChatId(reservationId: string): string {
  const key = `tcb_anon_chat_${reservationId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = `anon_${reservationId}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

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
    if (!trimmed) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("direct_messages").insert({
        reservation_id: reservationId,
        sender_id: anonId,
        sender_role: "client",
        sender_name: name || "Client",
        content: trimmed,
      });
      if (error) throw error;
      setText("");
    } catch {
      toast.error("Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  if (!nameSet) {
    return (
      <div style={{ padding: "4px 0" }}>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>Comment vous appelle-t-on ?</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre prénom"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              fontSize: 16,
              fontFamily: "inherit",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                localStorage.setItem(`tcb_anon_name_${reservationId}`, name.trim());
                setNameSet(true);
              }
            }}
          />
          <button
            onClick={() => {
              if (name.trim()) {
                localStorage.setItem(`tcb_anon_name_${reservationId}`, name.trim());
                setNameSet(true);
              }
            }}
            style={{
              padding: "10px 16px",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 320 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "30px 0" }}>
            Démarrez la conversation avec José 👋
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.sender_role === "client";
          return (
            <div
              key={m.id}
              className="suivi-fadein"
              style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 6, alignItems: "flex-end" }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  background: isMe ? "#0f172a" : "#f1f5f9",
                  color: isMe ? "#fff" : "#0f172a",
                  borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "9px 12px",
                  fontSize: 13.5,
                  lineHeight: 1.45,
                }}
              >
                {!isMe && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>José 🚖</div>
                )}
                {m.content}
                <div
                  style={{
                    fontSize: 10,
                    color: isMe ? "rgba(255,255,255,0.5)" : "#94a3b8",
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Votre message…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            fontSize: 16,
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          style={{
            padding: "10px 16px",
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 18,
            cursor: "pointer",
            opacity: !text.trim() || sending ? 0.35 : 1,
            transition: "opacity 0.15s",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// ─── Formulaire avis post-course ─────────────────────────────────────────────
function AvisForm({ reservationId, clientName }: { reservationId: string; clientName?: string | null }) {
  const [note, setNote] = useState(0);
  const [hover, setHover] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(() => !!localStorage.getItem(`tcb_avis_sent_${reservationId}`));

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0", color: "#166534" }}>
        <div style={{ fontSize: 26, marginBottom: 6 }}>⭐ Merci pour votre avis !</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Votre retour a bien été transmis à José.</div>
      </div>
    );
  }

  const submit = async () => {
    if (note === 0) {
      toast.error("Choisissez une note");
      return;
    }
    setSending(true);
    try {
      const { error } = await (supabase as any).from("avis").insert({
        reservation_id: reservationId,
        author_name: clientName || "Client",
        note,
        commentaire: commentaire.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      localStorage.setItem(`tcb_avis_sent_${reservationId}`, "1");
      setSent(true);
      toast.success("Merci pour votre avis !");
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Étoiles */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, justifyContent: "center" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setNote(i)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 34,
              lineHeight: 1,
              color: i <= (hover || note) ? "#f59e0b" : "#e2e8f0",
              transition: "color 0.1s",
              padding: "0 2px",
            }}
          >
            ★
          </button>
        ))}
      </div>
      {note > 0 && (
        <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginBottom: 10 }}>
          {["", "Très insatisfait", "Insatisfait", "Correct", "Satisfait", "Excellent !"][note]}
        </div>
      )}
      <textarea
        value={commentaire}
        onChange={(e) => setCommentaire(e.target.value)}
        placeholder="Commentaire (facultatif)…"
        rows={3}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          fontSize: 14,
          fontFamily: "inherit",
          resize: "none",
          boxSizing: "border-box",
        }}
      />
      <button
        onClick={submit}
        disabled={sending || note === 0}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "12px",
          background: note === 0 ? "#e2e8f0" : "#f59e0b",
          color: note === 0 ? "#94a3b8" : "#0f172a",
          border: "none",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 800,
          cursor: note === 0 ? "default" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {sending ? "Envoi…" : "Envoyer mon avis"}
      </button>
    </div>
  );
}

// ─── Boutons calendrier ───────────────────────────────────────────────────────
function CalendarButtons({ reservation }: { reservation: Reservation }) {
  if (!reservation.pickup_datetime) return null;
  const dt = new Date(reservation.pickup_datetime);
  const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const toIcsDate = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const title = encodeURIComponent(
    `Taxi — ${reservation.depart} → ${reservation.destination ?? reservation.arrivee ?? ""}`,
  );
  const details = encodeURIComponent(`Suivi : ${typeof window !== "undefined" ? window.location.href : ""}`);
  const location = encodeURIComponent(reservation.depart);
  const googleUrl = `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${toIcsDate(dt)}/${toIcsDate(dtEnd)}&details=${details}&location=${location}`;
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Taxi City Bordeaux//FR",
    "BEGIN:VEVENT",
    `UID:tcb-${reservation.id}@taxicitybordeaux.fr`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(dt)}`,
    `DTEND:${toIcsDate(dtEnd)}`,
    `SUMMARY:Taxi City Bordeaux`,
    `DESCRIPTION:Départ : ${reservation.depart}\\nDestination : ${reservation.destination ?? reservation.arrivee ?? ""}`,
    `LOCATION:${reservation.depart}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const icsBlob = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

  const btnS: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    color: "#0f172a",
    background: "#f8fafc",
    fontFamily: "inherit",
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={btnS}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="2" />
          <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="2" />
          <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="2" />
        </svg>
        Google Calendar
      </a>
      <a href={icsBlob} download={`taxi-${reservation.id}.ics`} style={btnS}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#666" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" stroke="#666" strokeWidth="2" />
          <line x1="8" y1="2" x2="8" y2="6" stroke="#666" strokeWidth="2" />
          <line x1="3" y1="10" x2="21" y2="10" stroke="#666" strokeWidth="2" />
        </svg>
        iPhone / Mac
      </a>
    </div>
  );
}

// ─── Partage ──────────────────────────────────────────────────────────────────
function ShareButton() {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({ title: "Suivi taxi", text: "Suivez ma course en temps réel", url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié !");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 14px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "inherit",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Partager ce suivi
    </button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
function SuiviPage() {
  const { lang } = useI18n();
  const locale =
    lang === "fr"
      ? "fr-FR"
      : lang === "en"
        ? "en-US"
        : lang === "es"
          ? "es-ES"
          : lang === "it"
            ? "it-IT"
            : lang === "pt"
              ? "pt-PT"
              : lang === "ar"
                ? "ar"
                : "fr-FR";

  const { id } = Route.useParams();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchReservation = useServerFn(getReservationForFinPublic);
  const prevStatusRef = useRef<string | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchReservation({ data: { key: id } });
        if (cancelled) return;
        if (!row) {
          setNotFound(true);
        } else {
          setReservation(row as Reservation);
          setLastUpdated(new Date());
          prevStatusRef.current = (row as any).status ?? null;
          prevPriceRef.current = (row as any).prix_estime ?? null;
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReservation, id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`reservations:id=eq.${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${id}` },
        (payload: any) => {
          try {
            const newRow = payload.new as Reservation;
            if (!newRow) return;
            const newStatus = (newRow as any).status ?? null;
            const newPrice = (newRow as any).prix_estime ?? null;
            if (prevStatusRef.current && newStatus && prevStatusRef.current !== newStatus) {
              if (newStatus === "accepted") toast.success("✅ Votre course a été confirmée !");
              else if (newStatus === "en_route") toast.success("🚕 Le chauffeur est en route !");
              else if (newStatus === "arrived") toast.success("📍 Le chauffeur est arrivé !");
              else if (newStatus === "completed") toast.success("🏁 Course terminée. Merci !");
            }
            if (prevPriceRef.current != null && newPrice != null && Number(prevPriceRef.current) !== Number(newPrice)) {
              toast.success("💶 Le prix a été mis à jour.");
            }
            setReservation(newRow);
            setLastUpdated(new Date());
            prevStatusRef.current = newStatus;
            prevPriceRef.current = newPrice;
          } catch {}
        },
      )
      .subscribe();
    return () => {
      try {
        channel.unsubscribe();
      } catch {}
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 32, height: 32 }} className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !reservation) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <AlertTriangle style={{ width: 48, height: 48, margin: "0 auto 16px" }} className="text-destructive" />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Réservation introuvable</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>Nous n'avons pas trouvé cette réservation.</p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            background: "#0f172a",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 10,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const st = STATUS_MAP[reservation.status] ?? {
    label: reservation.status,
    emoji: "📋",
    color: "#64748b",
    bg: "#f8fafc",
    border: "#e2e8f0",
  };
  const dest = reservation.destination ?? reservation.arrivee ?? "—";
  const josePhone = JOSE_PHONE.replace(/\s/g, "");
  const isCompleted = reservation.status === "completed";
  const isCancelled = reservation.status === "cancelled";
  const isActive = ["en_route", "arrived"].includes(reservation.status);

  return (
    <>
      <style>{globalCss}</style>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "24px 14px calc(env(safe-area-inset-bottom, 0px) + 40px)",
          paddingTop: "max(24px, env(safe-area-inset-top, 0px))",
        }}
      >
        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: 6,
            }}
          >
            Taxi City Bordeaux
          </div>
          {reservation.client_name && (
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
              Bonjour {reservation.client_name} 👋
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>Suivi de votre course</h1>
          {reservation.pickup_datetime && (
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              📅 {formatPickup(reservation.pickup_datetime, locale)}
            </p>
          )}
        </div>

        {/* Statut banner */}
        <div
          className={isActive ? "suivi-pulse" : ""}
          style={{
            background: st.bg,
            border: `1.5px solid ${st.border}`,
            borderRadius: 14,
            padding: "13px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>{st.emoji}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: st.color,
                opacity: 0.7,
              }}
            >
              Statut
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: st.color }}>{st.label}</div>
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>
              <div>Mis à jour</div>
              <div>{lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          )}
        </div>

        {/* Stepper */}
        {!isCancelled && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 12px 12px",
              marginBottom: 14,
            }}
          >
            <StatusStepper status={reservation.status} />
          </div>
        )}

        {/* Trajet */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#94a3b8",
              marginBottom: 12,
            }}
          >
            Trajet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em" }}>DÉPART</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{reservation.depart}</div>
              </div>
            </div>
            <div style={{ borderLeft: "2px dashed #e2e8f0", marginLeft: 9, height: 10 }} />
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🏁</span>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em" }}>
                  DESTINATION
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{dest}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Infos détaillées */}
        {(reservation.nb_passagers != null ||
          reservation.nb_bagages != null ||
          reservation.distance_km != null ||
          reservation.prix_estime != null ||
          reservation.mode_paiement) && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#94a3b8",
                marginBottom: 12,
              }}
            >
              Détails
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {reservation.nb_passagers != null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>👥</span>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>Passagers</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{reservation.nb_passagers}</div>
                  </div>
                </div>
              )}
              {reservation.nb_bagages != null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>🧳</span>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>Bagages</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{reservation.nb_bagages}</div>
                  </div>
                </div>
              )}
              {reservation.distance_km != null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>🛣️</span>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>Distance</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {reservation.distance_km.toFixed(1)} km
                    </div>
                  </div>
                </div>
              )}
              {reservation.prix_estime != null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>💶</span>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>Prix estimé</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
                        reservation.prix_estime,
                      )}
                    </div>
                  </div>
                </div>
              )}
              {reservation.mode_paiement && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>Paiement</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
                      {reservation.mode_paiement}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendrier + Partage */}
        {!isCompleted && !isCancelled && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#94a3b8",
                marginBottom: 10,
              }}
            >
              Actions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <CalendarButtons reservation={reservation} />
              <ShareButton />
            </div>
          </div>
        )}

        {/* Appeler José */}
        {!isCompleted && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#1d4ed8",
                marginBottom: 10,
              }}
            >
              Besoin d'aide ?
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={`tel:${josePhone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "#1d4ed8",
                  color: "#fff",
                  padding: "11px 18px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35a2 2 0 0 1 1.97-2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.1 6.1l1.97-1.97a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Appeler José
              </a>
              <a
                href={`https://wa.me/${josePhone.replace(/^0/, "33")}?text=${encodeURIComponent(`Bonjour José, c'est ${reservation.client_name ?? "votre client"} — course du ${reservation.pickup_datetime ? new Date(reservation.pickup_datetime).toLocaleDateString("fr-FR") : ""}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "#16a34a",
                  color: "#fff",
                  padding: "11px 18px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Chat */}
        {!isCompleted && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Chat avec José</div>
            </div>
            <AnonChat reservationId={reservation.id} />
          </div>
        )}

        {/* Avis post-course */}
        {isCompleted && (
          <div
            className="suivi-fadein"
            style={{
              background: "#fff",
              border: "1.5px solid #fde68a",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
              ⭐ Comment s'est passée votre course ?
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>Votre avis aide José à s'améliorer.</div>
            <AvisForm reservationId={reservation.id} clientName={reservation.client_name} />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <Link to="/" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>
            ← taxicitybordeaux.fr
          </Link>
        </div>
      </div>
    </>
  );
}
