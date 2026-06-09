import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getRouteGeoCoords, getDistanceAndDurationKm } from "@/lib/osrm";
import { geocodeAddress } from "@/lib/geocode";
import { suiviIdSchema } from "@/lib/suivi-id";
import { notifyReservationStatus } from "@/lib/push.functions";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_TILE_OPTIONS = { attribution: "© OpenStreetMap contributors", maxZoom: 19 };

export const Route = createFileRoute("/suivi/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    gps: search.gps === "1" ? "1" : undefined,
    // rid = UUID natif de la réservation, passé par le dashboard lors de l'ouverture
    // de la page chauffeur → permet le lookup direct si la propagation DB est tardive.
    rid: typeof search.rid === "string" && search.rid.length === 36 ? search.rid : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Suivi de votre taxi — Taxi City Bordeaux" },
      { name: "description", content: "Suivez votre taxi en temps réel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuiviPage,
});

// ── Infos chauffeur (fixes) ───────────────────────────────────────────────────
const CHAUFFEUR = {
  nom: "José",
  vehicule: "Mercedes",
  plaque: "HF 450 JG",
  phone: "0673072322",
};

// ── Photo taxi (marqueur carte) ───────────────────────────────────────────────
const TAXI_ICON_URI =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABQAFADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBbhrFRJGkU0iHcAyuG8wdTgZ65449a5v8A4puw8V2Wo+JNKurnTUuPNSe0YbwoXdscYOVHcYB9DVLR5GliVEMk+1fnab5JVUZ5VgMZyDkcjI49KlvpLScSWskV4I2kGbgMVWMgYXjILgkHkZ9MDFfO06soS7nfUpxteJ634p0Pwk3h7xF4wstZ1m6h1uMTraCJVjSQgMkkbKmYmUgfOMcAhs5zWZ8CtX1TTbK+EXhzSjZSHzb2/ZPIecgHk4GJD17DqT3rzzR7vxtltJ0PVZDaW+0R5utqopyQc98c8DI5qrceGvil/an9nw+KZLi2RzIsovCQqcfMIhyM4xjp7966VUrVai5N+lgjTpxXNJPl6n0BN8TvDOpGCzhIPnxtGv2ecowLjAAJUbWyO9eS+MrzRrzTLqC8jjvFhjmcEXH7+2faRgHIPONpHQj6CuRfQp7C6uJtZjvnldgv2u9nW3Rn3ZUhshfw3E1fHw6vbpZpLrTrG3SQjzXe6fJ44yUJ9fWu54THVHv+BlKrQS92K9bv/Nnmmva9NfX2xZkgYrhYnyTwOhLck49c5p9tYatPpJkt9Pupo8blkETsrgehAxx9fWvTh8HfAkyLNqGqMtwAMrCkpXjty4yPpjivX9G8a6nb3cMNo3h/7NZw7lhghuYlSNBgJGhcpnkBQTjJGe9X/ZU0tTB1Y9D4+tp9t8S8wjeFvmJYgp9QeK9W+G1ve6nfbrGcBWxNLIgykQPTPbccHj/DNdDqPhH4f6v4nl/tmV7vWbu6Jna3dpv30rH5SxdQeeM7VHFWdTsvAukXdl4ZbxRruh/2fEIZVtFVVOSWDtsdhnLYzzwMZGK56+XOS+JI6cPiIRkuZOx5Dp+tyXwKrCYNz5dVVm8rkDPykEg/N0HHpzWgL63neC3aCOCRVAE2D8hx0zwGOBnp2616Dd/C7wJo1t5ut385zzmScK2fTCjOeB0z9axYL34cw69YW8K6jY6fA+641DfJLNIoBGxFJJGST8x+72GcVx0qPtp2jou/Q2q0nRjeTV+3U3PhH4b1vXYVEZ8q3gfEl7OhxEpUgqF43Plsheg4LYHB9x0Tw7pelWX2PTkaOItvnkZt0kzf33b+Jv0HQACsbw98Rvh0+mR2Gj6jbWcMOUSCVfKYAHqA2M5POeSep5qtJ8R/CL2jvBrsQiDHczpIig57nbgV9jgcPToxSi/mfM4yrWrOzi7LodNqlnpN3bTWl9ax3dtKmySKYBkcehXoa4i/uG8FvCdMmceGZWEF1ayOX/s/PCSxMfmEW7CuhJCghlwARU0Xi3QdSjL2HiDT7gdCY51P9arTPbX8ckMl5azRSqUdC6kMpGCCM+lei4RaumclLnjpJadh16yXQcJGpkLEEkZ/LNcN4vuYNL8y7kjWNbO1muGO0Algp2/XkZrrJNJnt9HuzYeI0tp4ID9nju4hKjELxkgZxwBknvmvFPE2q39x4L1A+K7hYbq6TyNyIFzlhyoHBHzduuDXJiaiUWenhIXfoeb6Pd315mQXMvmXG9cn5dzA7sqc8kHk+mR61u6Laaz4imOkaDo8DzWIDT3FoxMfOd0k0rnCfiQOOK7H4fP4D0L7XLaanJqFpcWEkM1u1sjymYgjfC5GYtw+UjDevYYyr3XfEN1oQFvE2iaGRm00vT9qrJuOGdictKx5UysR3xgAivDlS0sz1I821j0a/wDhz4t16Qtf6tZQIeVRA7/geOfqait/gr5Um/UdfCpn7tvCdx98k8V7BNdSsoWyjLEjG5Rkn8ayLqK/kba4nyewWvcWApLZHH9YnJ6s5/TPCPhjSPKaLTo7i5jXBnn+Znz1JGcfpTfEHh/Sdbmia7tnBjBVfKfywM9Tgd/et+LS7uTOSP8AgTYrH8X3Eei6bIUuLd7pon2KHyVbBxx9e+Kt0IxjtoEZtvfU4j4X+F9En8ORardadDJcm4m2yv12q5C/yNdJfppkPC28RJ6AIKyPDiXVhomlaeYbq3tgEt/PMRJZyCS2P4QSGOTmptVvLS3QmESCInbvGWlnb+6nc56Z/KsVaETolec2xkssXlSyStFZ2cY/fSuOAPQDufavG/ih4m1KWR7KCJ7CJHU26hyJhEQ+S/8AtNu6cYGOK7zxlqR0VrNtWMUeoShpLCwxuitFH/LSTHBf36DnrjNebatf/wBq3SMmLmUsWaVh99z1Iz0Ge/euLEVXLS5rTp3MzRdIaB4n1G2ZnKq8duzffzyNwHRcdupr03RNOigQ32oMJp1j3mPONoxwOOlctpqpp7q7/vr2ToDzt9zT/E+rx2OmixaQvdXOX+9gk/3m9vQVxNt6LY61FR3PpVvEkcZAjVYwPQgVUufF6xDl856CvK9Y8WaC+mz3On65cQiBlEqSxSRyx7s7cxyDkZGMqxxxnGRWb4U8Xw+Irn+ztL0+8a5ZcvJKVCdO7k8Dv9K96eOjsjyY4dPVnqU/iXWNTmFnpwKM/GRy3/1qvW+h2mlTLLfSpealIN7O3711/wB1Bk59zWT4S0e2Tb9p8SQlHDNK1gRIsSgZYvMxCqAOuAT+lbSeOPA3hdFuLG3k1C3kmMP2p5QVeTpgDqxz/E3r+FS8VBK71YuR3tExfE8OvTQzatdaVPFplsMIrzIGkJ7sCwPPoM8VmaUqIp1O8kR7jBwx4WFfRc9Pc/yHFcR+0X8RNV1nX7w2l7LaaYIxZ21nG/y8AeY7EdTkH6DA9a8u0i+1e+hb7Ve3EttFgCNpTh2PRa4Z4i8tTrpQdrHU/FHxHpmp+LJNRia4FtNbR2plMWUYKxJIPYHj6496oA2tiN1ofMZgMORkD0x6mp7vw99s8ParqBO23tLj7H580hH2mYD5ljQDgA9CT2yfSofCFhPdWljtXMnlDZnovJ+c/wAhXHJ3d2ddPTRbGx4d0+5luV2ruuJeSzDIjHr9a9d8HeFLCxhE8kaSTtyzuAST9TVPwT4dhsbdGkB3nqevP9a6x5PKXA+VQCBWMpN6GtjwH4y+LbvUNPttITxzeeJ4bllnd7zSEs3gCk4z8u5s5z6YHfNa/hGDw1b+F9PtNH8U2AuywuL+3u7KRhdMCCISUz+6wMkYG49eAuPG42WS4L3Ls+9gWdiS3Xk+5+teheBfEnhPwxDdPNHd3EzklH8pcsB0Uc8Dvk4rqhq7yOH2fKtD0O0mj1DRb6y1G11m0mvbtp5zYxwpBKq/6qJd5DCMdcY5OM9Kxn8PPFGFudbk0/RoJTKgnlX5PU8YUHr0J61x+t/FTU7qVhptjBZoeFd/3r/0Fcbqmo6nq9x52oahLdOPu+Y+Qv0XoPwq5TgttRwgzT+IGqafqmtJHpCv9htE8uFmHMhzy/4/0q3pEX2ewtk+xpeSy42W7A4keRgoBwQem49eoFc5C0KBYxhn9QOhr03wbcafpepXerX9uZoNJs4rlWZhiNsFV+X+JizhVHqcnjNY35tWbqPKrm54qikGh2Gj3CyW66cjzMogc+e7jbGzNjaH5IcEg5ra8CeHIdOso1I3lVAJPc4pdOhsNd8O6dczQKdXvNSd1jVjstoEAd9q5x8zuASev4V2lvbpDCFwMisqmmhpAkRWVVRcDFNMLzyJADyT2PQd6Qz7XBB4HArc0C2DuZ5FUs4G36Vk3YZ//9k=";

// ── HelpPanel (FAQ + WhatsApp) ────────────────────────────────────────────────
function HelpPanel({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const [view, setView] = useState<"faq" | "contact">("faq");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const faqs = [
    {
      q: "Où est mon chauffeur ?",
      a: "La carte affiche sa position en temps réel dès qu'il active son GPS. Si elle est vide, il est encore en route vers vous.",
    },
    {
      q: "Le prix affiché est-il définitif ?",
      a: "Non, c'est une estimation. Le compteur homologué fait foi à l'arrivée.",
    },
    {
      q: "Mon chauffeur ne répond pas ?",
      a: "Appelez directement le 06 73 07 23 22 disponible 7j/7 · 24h/24.",
    },
    {
      q: "Je ne vois pas les infos départ/destination ?",
      a: "Elles sont finalisées par notre équipe et apparaîtront automatiquement dès validation.",
    },
    {
      q: "Comment annuler ma course ?",
      a: "Contactez-nous au 06 73 07 23 22 ou via WhatsApp ci-dessous.",
    },
  ];

  const sendContact = () => {
    if (msg.trim().length < 5) return;
    const waText = encodeURIComponent(`[Support] Réservation ${reservationId.slice(0, 8)}\n\n${msg}`);
    window.open(`https://wa.me/33673072322?text=${waText}`, "_blank", "noopener,noreferrer");
    setSent(true);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "28px 20px 40px",
          width: "100%",
          maxWidth: 540,
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: 18,
              color: "#f8fafc",
            }}
          >
            🆘 Besoin d'aide ?
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: 0,
              color: "#94a3b8",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["faq", "contact"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${view === v ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.08)"}`,
                background: view === v ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
                color: view === v ? "#0ea5e9" : "#94a3b8",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {v === "faq" ? "❓ FAQ" : "💬 Nous contacter"}
            </button>
          ))}
        </div>
        {view === "faq" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((f, i) => (
              <details
                key={i}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <summary
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 700,
                    color: "#f1f5f9",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {f.q}
                </summary>
                <p
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13,
                    color: "#94a3b8",
                    margin: "10px 0 0",
                    lineHeight: 1.55,
                  }}
                >
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        )}
        {view === "contact" && (
          <div>
            {sent ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: "#22c55e",
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                }}
              >
                ✅ Message envoyé via WhatsApp !
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11,
                    color: "#475569",
                    marginBottom: 10,
                  }}
                >
                  ID Réservation: {reservationId.slice(0, 12)}…
                </div>
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Décrivez votre problème…"
                  rows={4}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: "#f8fafc",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 14,
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={sendContact}
                  disabled={msg.trim().length < 5}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    height: 50,
                    background: msg.trim().length < 5 ? "rgba(37,211,102,0.3)" : "#25D366",
                    color: "#fff",
                    border: 0,
                    borderRadius: 14,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: msg.trim().length < 5 ? "not-allowed" : "pointer",
                  }}
                >
                  💬 Envoyer via WhatsApp
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Reservation {
  id: string;
  depart: string;
  arrivee?: string | null;
  destination?: string | null;
  pickup_datetime?: string | null;
  date_course?: string | null;
  heure_course?: string | null;
  status: string;
  client_name?: string | null;
  nom?: string | null;
  client_phone?: string | null;
  telephone?: string | null;
  prix_estime?: string | number | null;
  nb_passagers?: number | null;
  passagers?: number | null;
  bagages?: number | null;
  suivi_id?: string | null;
  distance_km?: number | null;
  created_at?: string | null;
  route_coords?: any;
  route_label?: string | null;
  gps_validated_at?: string | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────
const BORDEAUX_CENTER: [number, number] = [44.8378, -0.5792];
const ARRIVAL_THRESHOLD_M = 120;
const CASE_SUBTITLE_COLOR = "#f8fafc";
const shownIncompleteToast = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPickup(r: Reservation): string {
  if (r.pickup_datetime) {
    try {
      return new Date(r.pickup_datetime).toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {}
  }
  if (r.date_course && r.heure_course) return `${r.date_course} à ${r.heure_course}`;
  return "—";
}

function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = (toRad(b.lng) - toRad(a.lng)) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat) - toRad(a.lat);
  return Math.sqrt(x * x + y * y) * R;
}

type DriverGpsRecord = {
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean | null;
  accuracy?: number | null;
  heartbeat_at?: string | null;
  updated_at?: string | null;
};

const GPS_WARN_AFTER_MS = 2 * 60_000;
const GPS_STALE_AFTER_MS = 20 * 60_000;

function analyzeDriverGps(data: DriverGpsRecord | null | undefined): {
  ok: boolean;
  reason: string;
  positionAt: Date | null;
  heartbeatAt: Date | null;
} {
  // updated_at peut être absent des payloads Realtime partiels (replica identity default).
  // On utilise heartbeat_at en priorité pour la fraîcheur, updated_at en fallback.
  const positionAt = data?.updated_at ? new Date(data.updated_at) : null;
  const heartbeatAt = data?.heartbeat_at ? new Date(data.heartbeat_at) : positionAt;
  // Signal de fraîcheur : le plus récent entre heartbeat_at et updated_at
  const freshnessAt =
    heartbeatAt && positionAt
      ? heartbeatAt.getTime() > positionAt.getTime()
        ? heartbeatAt
        : positionAt
      : (heartbeatAt ?? positionAt);

  if (!data) return { ok: false, reason: "Aucune ligne GPS chauffeur trouvée.", positionAt, heartbeatAt };
  if (!data.is_active)
    return {
      ok: false,
      reason: "GPS chauffeur désactivé dans le dashboard.",
      positionAt,
      heartbeatAt,
    };
  if (data.latitude == null || data.longitude == null) {
    return {
      ok: false,
      reason: "GPS actif, en attente du premier point latitude/longitude.",
      positionAt,
      heartbeatAt,
    };
  }
  if (
    !Number.isFinite(data.latitude) ||
    !Number.isFinite(data.longitude) ||
    (data.latitude === 0 && data.longitude === 0)
  ) {
    return {
      ok: false,
      reason: "Dernière position GPS invalide ignorée.",
      positionAt,
      heartbeatAt,
    };
  }
  // Vérifier la fraîcheur sur le signal le plus récent (heartbeat_at ou updated_at).
  // Si les deux sont absents (payload Realtime partiel), on laisse passer — le polling
  // refera la vérification avec les données complètes depuis la DB.
  if (freshnessAt) {
    const ageMs = Date.now() - freshnessAt.getTime();
    if (Number.isFinite(ageMs) && ageMs > GPS_STALE_AFTER_MS) {
      return {
        ok: false,
        reason: "Signal chauffeur trop ancien : aucune activité GPS depuis plus de 20 min.",
        positionAt,
        heartbeatAt,
      };
    }
    // Position reçue mais sans mouvement récent → on garde le taxi affiché.
    // Dans les bouchons / à un feu rouge, watchPosition peut ne rien émettre :
    // le heartbeat maintient alors la course active sans couper le suivi.
    if (Number.isFinite(ageMs) && ageMs > GPS_WARN_AFTER_MS) {
      return {
        ok: true,
        reason: "Dernière position connue conservée : chauffeur probablement immobile ou app en veille.",
        positionAt,
        heartbeatAt,
      };
    }
  }
  return { ok: true, reason: "Aucun arrêt : GPS chauffeur valide.", positionAt, heartbeatAt };
}

// ── Helper : lecture driver_gps avec détection RLS ───────────────────────────
// Supabase retourne { data: null, error: null } quand RLS bloque une ligne
// (résultat vide sans erreur explicite). On distingue ce cas de l'absence réelle
// de données en vérifiant si le body est vide et error vaut null.
async function fetchDriverGps(): Promise<{ data: DriverGpsRecord | null; rlsBlocked: boolean }> {
  const { data, error } = await supabase
    .from("driver_gps")
    .select("latitude,longitude,accuracy,is_active,heartbeat_at,updated_at")
    .eq("id", "driver")
    .maybeSingle();
  if (error) {
    // Erreur RLS explicite (ex: row-level security, permission denied)
    const isRls =
      error.code === "42501" ||
      (error.message ?? "").toLowerCase().includes("permission") ||
      (error.message ?? "").toLowerCase().includes("rls");
    if (isRls) {
      console.warn("[driver_gps] Accès bloqué par RLS :", error.message);
      return { data: null, rlsBlocked: true };
    }
    return { data: null, rlsBlocked: false };
  }
  return { data: data ?? null, rlsBlocked: false };
}

function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve();
      return;
    }
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link");
      l.id = "leaflet-css";
      l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      // Fix #2 : poll + timeout doivent se nettoyer mutuellement pour éviter
      // toute fuite et garantir un resolve/reject unique.
      let settled = false;
      let pollId: ReturnType<typeof setInterval> | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (pollId) clearInterval(pollId);
        if (timeoutId) clearTimeout(timeoutId);
        pollId = null;
        timeoutId = null;
      };
      pollId = setInterval(() => {
        if (settled) return;
        if ((window as any).L) {
          settled = true;
          cleanup();
          resolve();
        }
      }, 50);
      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        (window as any).L ? resolve() : reject(new Error("Leaflet timeout"));
      }, 8000);
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Leaflet load error"));
    document.head.appendChild(s);
  });
}

// ── Composant principal ───────────────────────────────────────────────────────
function SuiviPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const notifyStatusFn = useServerFn(notifyReservationStatus);
  const [statusBusy, setStatusBusy] = useState<null | "arrived" | "completed">(null);



  // ── États ─────────────────────────────────────────────────────────────────
  const [resa, setResa] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  // [FUSION] totalKm depuis tracking — pour la barre de progression départ→destination
  const [totalKm, setTotalKm] = useState<number | null>(null);
  // [FUSION] km restants (string) depuis tracking — affiché sous l'ETA
  const [etaKm, setEtaKm] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [courseTerminee, setCourseTerminee] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [mapHeight, setMapHeight] = useState(260);
  const [retryNonce, setRetryNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // ── Mode chauffeur — auto si ?gps=1 (notif push) ou triple-tap ──────────────
  const { gps: gpsParam, rid: ridParam } = Route.useSearch();
  const [isDriverMode, setIsDriverMode] = useState(gpsParam === "1");
  const driverTapCountRef = useRef(0);
  const driverTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDriverTripleTap = () => {
    driverTapCountRef.current += 1;
    if (driverTapTimerRef.current) clearTimeout(driverTapTimerRef.current);
    if (driverTapCountRef.current >= 3) {
      driverTapCountRef.current = 0;
      setIsDriverMode(true);
    } else {
      driverTapTimerRef.current = setTimeout(() => {
        driverTapCountRef.current = 0;
      }, 800);
    }
  };
  const [driverGpsActive, setDriverGpsActive] = useState(gpsParam === "1");
  const [driverGpsStatus, setDriverGpsStatus] = useState<
    "idle" | "starting" | "active" | "weak" | "denied" | "background" | "error"
  >("idle");
  const [driverDebug, setDriverDebug] = useState({
    lat: null as number | null,
    lng: null as number | null,
    accuracy: null as number | null,
    signalsSent: 0,
    errors: 0,
    wakeLock: false,
    heartbeatAge: null as number | null,
    log: [] as { time: string; msg: string; type: "ok" | "warn" | "err" }[],
  });
  const driverDebugRef = useRef(driverDebug);
  const driverWatchRef = useRef<number | null>(null);
  const driverHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverWakeLockRef = useRef<any>(null);
  const driverLastSignalAtRef = useRef<number | null>(null);
  const driverRestartingRef = useRef(false);
  const silentAudioRef = useRef<any>(null);
  const bgKeepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pushGpsRef = useRef<((coords: GeolocationCoordinates) => void) | null>(null);
  const handleErrorRef = useRef<((err: GeolocationPositionError) => void) | null>(null);

  // ── Audio silencieux iOS — maintient la page active en arrière-plan ────────
  // iOS Safari suspend les timers et watchPosition après ~30s en arrière-plan.
  // Jouer un son silencieux en boucle force le moteur audio à rester actif,
  // ce qui empêche la suspension complète de la page.
  const startSilentAudio = useCallback(() => {
    if (silentAudioRef.current) return; // déjà actif
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001; // quasi-silence — inaudible mais non nul (iOS coupe le silence total)
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      silentAudioRef.current = { ctx, oscillator, gain };
    } catch {}
  }, []);

  const stopSilentAudio = useCallback(() => {
    try {
      silentAudioRef.current?.oscillator?.stop?.();
      silentAudioRef.current?.ctx?.close?.();
    } catch {}
    silentAudioRef.current = null;
  }, []);
  const driverGpsActiveRef = useRef(false);
  const driverSignalsSentRef = useRef(0);
  const driverErrorsRef = useRef(0);
  const driverLastHeartbeatRef = useRef<number | null>(null);

  // ⚠️ addDriverLog est un alias de addLog — NE PAS dupliquer la logique ici.
  // addLog (ligne ~2098) est la seule fonction qui met à jour driverDebugRef.current,
  // indispensable pour le filtre anti-saut GPS dans pushGps. Toute écriture via
  // addDriverLog sans passer par addLog laissait driverDebugRef périmé.
  // addLog est déclaré plus bas ; on le définit ici comme ref-forward pour éviter
  // la dépendance circulaire de useCallback.
  const addLogRef = useRef<(msg: string, type?: "ok" | "warn" | "err") => void>(() => {});
  const addDriverLog = useCallback((msg: string, type: "ok" | "warn" | "err" = "ok") => {
    addLogRef.current(msg, type);
  }, []);
  const [trackingDiag, setTrackingDiag] = useState({
    realtime: "initialisation",
    stopReason: "Initialisation du suivi…",
    lastPositionAt: null as Date | null,
    lastHeartbeatAt: null as Date | null,
  });
  const [realtimeEvents, setRealtimeEvents] = useState<
    Array<{ time: string; kind: "sub" | "unsub" | "status" | "pos" | "err"; msg: string }>
  >([]);
  const [rtPanelOpen, setRtPanelOpen] = useState(false);
  const pushRtEvent = useCallback((kind: "sub" | "unsub" | "status" | "pos" | "err", msg: string) => {
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setRealtimeEvents((prev) => [{ time, kind, msg }, ...prev].slice(0, 25));
  }, []);

  const [error, setError] = useState<null | {
    code: "invalid" | "expired" | "notfound";
    title: string;
    message: string;
  }>(null);

  const { status: pushStatus, subscribe } = usePushNotifications();

  // ── Refs carte ─────────────────────────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const mapInitializing = useRef(false);
  const markerRef = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const routeOutline = useRef<any>(null);
  const tripLayer = useRef<any>(null);
  const tripOutline = useRef<any>(null);
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);
  const lastDriverPos = useRef<{ lat: number; lng: number } | null>(null);
  const initialZoom = useRef<number | null>(null);

  // Refs data
  const depGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  // arrGeoRef supprimé (#2) : destCoordsRef ([lat,lng]) fait office de ref destination unique.
  const destCoordsRef = useRef<[number, number] | null>(null);
  const pickupCoordsRef = useRef<[number, number] | null>(null);
  const resaIdRef = useRef<string>("");
  const gpsIdRef = useRef<string>("driver");
  const modeRef = useRef<"single" | "multi">("single");
  const channelRef = useRef<any>(null);
  const subscribingRef = useRef(false); // #7 : anti-concurrence subscribeRealtime
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionStateRef = useRef<"connected" | "disconnected">("disconnected");
  const notifScheduledRef = useRef(false);
  const pickupNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastUpdateRef = useRef<Date | null>(null);
  const gpsDataRef = useRef<DriverGpsRecord | null>(null);
  const lastEtaAtRef = useRef<number>(0);
  const enRouteSinceRef = useRef<number | null>(null);
  const [, setGpsTick] = useState(0);

  // ── Tick pour rafraîchir la couleur de l'indicateur GPS ─────────────────
  useEffect(() => {
    const t = setInterval(() => setGpsTick((n) => (n + 1) % 1000000), 5000);
    return () => clearInterval(t);
  }, []);

  // ── Sync lastUpdateRef ──────────────────────────────────────────────────
  useEffect(() => {
    lastUpdateRef.current = lastUpdate;
  }, [lastUpdate]);

  const recordGpsDiagnostic = useCallback((data: DriverGpsRecord | null | undefined, source: string) => {
    gpsDataRef.current = data ?? null;
    const analysis = analyzeDriverGps(data);
    const liveAt = analysis.heartbeatAt ?? analysis.positionAt;
    if (analysis.ok && liveAt) setLastUpdate(liveAt);
    setTrackingDiag({
      realtime: connectionStateRef.current === "connected" ? `connecté · ${source}` : `déconnecté · ${source}`,
      stopReason: analysis.reason,
      lastPositionAt: analysis.positionAt,
      lastHeartbeatAt: analysis.heartbeatAt,
    });
    return analysis;
  }, []);

  // ── Hauteur carte dynamique (iOS Safari) ────────────────────────────────
  useEffect(() => {
    const update = () => setMapHeight(Math.min(Math.max(Math.round(window.innerHeight * 0.4), 220), 380));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // ── Geocode helper avec retry (3 tentatives, délai exponentiel) ─────────
  const geocode = async (q: string): Promise<[number, number] | null> => {
    const hasCity =
      /\b(bordeaux|cenon|mérignac|merignac|pessac|talence|bègles|begles|lormont|floirac|villenave|bouliac|carbon|blanquefort|eysines|le bouscat|bruges|gradignan|cestas)\b/i.test(
        q,
      ) || /\b\d{5}\b/.test(q);
    const query = hasCity ? `${q}, France` : `${q}, Bordeaux, France`;

    // 3 tentatives avec backoff exponentiel (0ms, 800ms, 2000ms)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 800));
        const c = await geocodeAddress(query);
        if (c) return [c.lat, c.lng];
      } catch {}
    }
    // Dernier recours : essai sans qualificatif de ville
    try {
      const c = await geocodeAddress(`${q}, France`);
      if (c) return [c.lat, c.lng];
    } catch {}
    return null;
  };

  // ── ETA — stocke aussi les km restants (depuis tracking) ────────────────
  const calculateETA = async (lat: number, lng: number, destCoords?: [number, number]) => {
    // Utiliser la destination passée en paramètre, ou la ref courante, JAMAIS BORDEAUX_CENTER
    const dest = destCoords ?? destCoordsRef.current;
    if (!dest) {
      // Pas de destination connue → ne pas afficher de valeur fausse
      setEta(null);
      setEtaKm(null);
      return;
    }
    try {
      const [dLat, dLng] = dest;
      // Appel OSRM direct (même source que totalKm) pour que pctDone soit cohérent
      const route = await getRouteGeoCoords([lng, lat], [dLng, dLat]);
      if (route.distanceKm && route.distanceKm > 0) {
        setEtaKm(route.distanceKm.toFixed(1));
      }
      // Durée via Edge Function (plus précise pour l'ETA affiché)
      const result = await getDistanceAndDurationKm([lng, lat], [dLng, dLat]);
      if (result) {
        setEta(Math.ceil(result.dureeS / 60));
        if (!route.distanceKm) setEtaKm(result.distanceKm.toFixed(1));
      }
    } catch {
      setEta(null);
      setEtaKm(null);
    }
  };

  // ── Init carte ───────────────────────────────────────────────────────────
  const initMap = async (lat: number, lng: number) => {
    // Fix #1 : guard atomique sur les deux flags AVANT et APRÈS le await loadLeaflet().
    // Sans la double vérification, deux appelants (polling + realtime) peuvent passer
    // le 1er guard puis créer deux cartes sur le même div pendant que loadLeaflet résout.
    if (mapInitializing.current || mapInst.current) return;
    mapInitializing.current = true;
    try {
      await loadLeaflet();
    } catch {
      mapInitializing.current = false;
      return;
    }
    // Re-check après await : la map a pu être créée ou détruite entre-temps.
    if (mapInst.current) {
      mapInitializing.current = false;
      return;
    }
    const L = (window as any).L;
    if (!L || !mapRef.current) {
      mapInitializing.current = false;
      return;
    }
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 14, zoomControl: false });
    initialZoom.current = 14;
    L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #f5c842;overflow:hidden;box-shadow:0 0 0 0 rgba(245,200,66,0);animation:driverPulse 2s infinite;background:#1a1a2e;display:flex;align-items:center;justify-content:center;font-size:26px">🚕</div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    mapInst.current = map;
    mapInitializing.current = false; // libéré après l'assignation de mapInst + markerRef
    setTimeout(() => map.invalidateSize({ animate: false }), 300);
    setTimeout(() => map.invalidateSize({ animate: false }), 500);
  };

  // Throttle ETA : 1 appel max toutes les 20s, fire-and-forget.
  // Fix #6 : on accepte un dest explicite (snapshot au moment de l'appel) pour
  // éviter qu'une mise à jour de destCoordsRef entre deux appels ne fasse calculer
  // un ETA vers une ancienne destination.
  const calculateETAThrottled = (lat: number, lng: number, dest?: [number, number] | null) => {
    const now = Date.now();
    if (now - lastEtaAtRef.current < 20000) return;
    lastEtaAtRef.current = now;
    const target = dest ?? destCoordsRef.current;
    calculateETA(lat, lng, target ?? undefined).catch(() => {});
  };

  // ── Sync marker + recentrage carte sur chaque nouvelle position ─────────
  // Même pattern que le dashboard admin : marker.setLatLng + map.setView direct.
  useEffect(() => {
    if (!driverPos || !mapInst.current) return;
    // Fix #4 : la closure du retry doit relire la dernière position depuis le ref,
    // pas depuis la closure capturée (qui pourrait être périmée si driverPos a changé).
    const applyPos = () => {
      if (!markerRef.current || !mapInst.current) return;
      const pos = lastDriverPos.current ?? driverPos;
      const latlng: [number, number] = [pos.lat, pos.lng];
      markerRef.current.setLatLng(latlng);
      mapInst.current.setView(latlng, mapInst.current.getZoom());
    };
    applyPos();
    if (!markerRef.current) {
      const t = setTimeout(applyPos, 400);
      return () => clearTimeout(t);
    }
  }, [driverPos]);

  // ── Tracé départ → destination (stocke totalKm) ──────────────────────────
  const drawTripRoute = useCallback(
    async (depart: string, destination: string, cachedCoords?: [number, number][] | null) => {
      // Attendre que la carte soit prête (elle peut ne pas l'être encore)
      let map = mapInst.current;
      if (!map) {
        // Attendre jusqu'à 8s que la carte soit prête (redirection depuis admin)
        for (let i = 0; i < 16; i++) {
          await new Promise((r) => setTimeout(r, 500));
          map = mapInst.current;
          if (map) break;
        }
        if (!map) return;
      }
      const L = (window as any).L;
      if (!map || !L) return;

      const [a, b] = await Promise.all([geocode(depart), geocode(destination)]);
      // Re-vérifier après les awaits : la carte peut avoir été détruite (démontage)
      if (!mapInst.current || !a || !b) {
        if (!a || !b) console.warn("[drawTripRoute] Geocode échoué pour:", !a ? depart : destination);
        return;
      }

      depGeoRef.current = { lat: a[0], lng: a[1] };
      // arrGeoRef supprimé (#2) : destCoordsRef couvre déjà la destination.
      destCoordsRef.current = b;
      pickupCoordsRef.current = a;

      try {
        let coords: [number, number][];
        let distanceKm: number | undefined;
        if (cachedCoords && Array.isArray(cachedCoords) && cachedCoords.length > 1) {
          coords = cachedCoords as [number, number][];
          let d = 0;
          for (let i = 1; i < coords.length; i++) {
            d += distMeters({ lat: coords[i - 1][0], lng: coords[i - 1][1] }, { lat: coords[i][0], lng: coords[i][1] });
          }
          distanceKm = d / 1000;
        } else {
          // getRouteGeoCoords attend [lng, lat] (format GeoJSON/OSRM), pas [lat, lng]
          const route = await getRouteGeoCoords([a[1], a[0]], [b[1], b[0]]);
          coords = route.coords.length > 0 ? route.coords : [a, b];
          distanceKm = route.distanceKm;
        }
        if (distanceKm && distanceKm > 0) setTotalKm(parseFloat(distanceKm.toFixed(1)));

        if (tripLayer.current) {
          tripLayer.current.remove();
          tripLayer.current = null;
        }
        if (tripOutline.current) {
          tripOutline.current.remove();
          tripOutline.current = null;
        }

        tripOutline.current = L.polyline(coords, {
          color: "#000000",
          weight: 9,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        tripLayer.current = L.polyline(coords, {
          color: "#111111",
          weight: 5,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        const depIcon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center">
          <span style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.35);animation:gpsRing 1.6s ease-out infinite"></span>
          <span style="position:absolute;inset:6px;border-radius:50%;background:rgba(34,197,94,0.5);animation:gpsRing 1.6s ease-out infinite;animation-delay:.4s"></span>
          <div style="position:relative;width:30px;height:30px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 4px 14px rgba(34,197,94,0.7);display:flex;align-items:center;justify-content:center;font-size:15px">📍</div></div>
        <style>@keyframes gpsRing{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.6);opacity:0}}</style>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const destIcon = L.divIcon({
          className: "",
          html: `<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(239,68,68,0.6);display:flex;align-items:center;justify-content:center;font-size:16px">🏁</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        if (fromMarker.current) fromMarker.current.remove();
        if (toMarker.current) toMarker.current.remove();
        fromMarker.current = L.marker(a, { icon: depIcon }).addTo(map).bindPopup("📍 Prise en charge");
        toMarker.current = L.marker(b, { icon: destIcon }).addTo(map).bindPopup("🏁 Destination");

        map.invalidateSize();
        map.fitBounds(L.latLngBounds([...coords, markerRef.current?.getLatLng()].filter(Boolean)), {
          padding: [60, 60],
          maxZoom: 16,
          animate: true,
          duration: 0.8,
        });
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Notification avant prise en charge ──────────────────────────────────
  const schedulePickupNotification = useCallback((pickupDatetime: string) => {
    if (notifScheduledRef.current) return;
    notifScheduledRef.current = true;
    const pickupMs = new Date(pickupDatetime).getTime();
    const now = Date.now();
    const diff = pickupMs - now;
    if (diff > 0 && diff <= 30 * 60000) {
      toast.warning(`⏰ Prise en charge dans ${Math.round(diff / 60000)} min`, {
        description: "Préparez-vous ! Le chauffeur arrive bientôt.",
        duration: 8000,
      });
    }
    const notifMs = pickupMs - 15 * 60000;
    if (notifMs > now) {
      if (typeof Notification !== "undefined" && Notification.permission === "default")
        Notification.requestPermission();
      if (pickupNotifTimerRef.current) clearTimeout(pickupNotifTimerRef.current);
      pickupNotifTimerRef.current = setTimeout(() => {
        pickupNotifTimerRef.current = null;
        const formatted = new Date(pickupDatetime).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        toast.warning(`🚕 Prise en charge dans 15 min`, {
          description: `Votre taxi est prévu à ${formatted}. Soyez prêt !`,
          duration: 10000,
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("🚕 Taxi City Bordeaux", {
            body: `Votre prise en charge est prévue à ${formatted}. Votre chauffeur arrive !`,
            icon: "/favicon.ico",
          });
        }
      }, notifMs - now);
    }
  }, []);

  // ── Polling fallback ────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    // Toujours stopper l'interval précédent avant d'en créer un nouveau.
    // L'ancien guard "if return" empêchait le redémarrage propre après un retryNonce.
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    // Source GPS unique : driver_gps — même table que celle écrite par l'admin.
    // Pas de taxi_positions, pas d'ambiguïté, pas de conflit.
    pollingTimerRef.current = setInterval(async () => {
      const { data, rlsBlocked } = await fetchDriverGps();
      if (rlsBlocked) {
        pushRtEvent("err", "driver_gps: accès refusé (RLS) — polling suspendu");
        stopPolling();
        return;
      }
      const gpsAnalysis = recordGpsDiagnostic(data, "polling");
      if (gpsAnalysis.ok && data?.latitude != null && data?.longitude != null) {
        // Initialiser la carte si elle n'existe pas encore (le chauffeur GPS était actif
        // avant que la page ait fini de charger, ou Bordeaux_center avait été utilisé)
        if (!mapInst.current) {
          await initMap(data.latitude, data.longitude);
        }
        if ((!destCoordsRef.current || !fromMarker.current) && resaIdRef.current) {
          const { data: rData } = await supabase
            .from("reservations")
            .select("depart,arrivee,destination,route_coords")
            .eq("id", resaIdRef.current)
            .maybeSingle();
          if (rData?.depart && (rData?.destination || rData?.arrivee)) {
            await drawTripRoute(
              rData.depart,
              rData.destination || rData.arrivee!,
              rData.route_coords as [number, number][] | null,
            );
          }
        }
        setDriverPos({ lat: data.latitude, lng: data.longitude });
        lastDriverPos.current = { lat: data.latitude, lng: data.longitude };
        calculateETAThrottled(data.latitude, data.longitude);
      }
      if (resaIdRef.current) {
        const { data: r } = await supabase
          .from("reservations")
          .select(
            "status,depart,arrivee,destination,prix_estime,pickup_datetime,nb_passagers,passagers,bagages,distance_km,route_coords,route_label",
          )
          .eq("id", resaIdRef.current)
          .maybeSingle();
        if (r) setResa((prev) => (prev ? { ...prev, ...r } : prev));
      }
    }, 5000);
  }, [drawTripRoute, recordGpsDiagnostic]);

  // ── Realtime ─────────────────────────────────────────────────────────────
  const subscribeRealtime = useCallback(
    (_gpsId: string, resaId: string, _mode: "single" | "multi") => {
      // #7 : éviter les souscriptions concurrentes (retryNonce + visibilitychange peuvent
      // se déclencher simultanément). Si une souscription est déjà en cours, on l'ignore.
      if (subscribingRef.current) {
        pushRtEvent("status", "subscribeRealtime ignoré (appel concurrent)");
        return;
      }
      subscribingRef.current = true;

      try {
        // Nettoyer les channels précédents AVANT d'en créer de nouveaux
        // (évite les channels dupliqués qui se battent pour la même position)
        const prev = channelRef.current;
        if (Array.isArray(prev)) {
          prev.forEach((c) => c && supabase.removeChannel(c));
          if (prev.length) pushRtEvent("unsub", `removeChannel ×${prev.length}`);
        } else if (prev) {
          supabase.removeChannel(prev);
          pushRtEvent("unsub", "removeChannel");
        }
        channelRef.current = null;

        // Stopper puis redémarrer le polling proprement (évite l'ancien interval
        // qui tournait encore avec une closure périmée après un retryNonce)
        stopPolling();
        startPolling();

        // Nom de channel unique par session pour éviter les collisions entre onglets
        const sessionSuffix = Math.random().toString(36).slice(2, 8);
        pushRtEvent("sub", `subscribe suivi-driver-location-${sessionSuffix}`);

        // Source GPS unique : driver_gps.
        // L'admin écrit dedans, le suivi l'écoute via Realtime + polling.
        const gpsChannel = supabase
          .channel(`suivi-driver-location-${sessionSuffix}`)
          .on(
            "postgres_changes",
            // INSERT + UPDATE : upsert émet INSERT si la ligne n'existait pas encore.
            // Sans ça, le 1er signal GPS du chauffeur (après une page fraîche) est ignoré.
            { event: "INSERT", schema: "public", table: "driver_gps" },
            async (payload) => {
              const d = payload.new as any;
              const gpsAnalysis = recordGpsDiagnostic(d, "realtime INSERT");
              if (gpsAnalysis.ok) {
                if (!mapInst.current && d.latitude != null && d.longitude != null) {
                  await initMap(d.latitude, d.longitude);
                }
                setDriverPos({ lat: d.latitude, lng: d.longitude });
                lastDriverPos.current = { lat: d.latitude, lng: d.longitude };
                calculateETAThrottled(d.latitude, d.longitude);
                pushRtEvent("pos", `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)} (realtime INSERT)`);
              } else {
                pushRtEvent("err", `INSERT ignoré: ${gpsAnalysis.reason}`);
              }
            },
          )
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_gps" }, async (payload) => {
            const d = payload.new as any;
            const gpsAnalysis = recordGpsDiagnostic(d, "realtime");
            if (gpsAnalysis.ok) {
              setDriverPos({ lat: d.latitude, lng: d.longitude });
              lastDriverPos.current = { lat: d.latitude, lng: d.longitude };
              calculateETAThrottled(d.latitude, d.longitude);
              pushRtEvent("pos", `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)} (realtime)`);
            } else {
              pushRtEvent("err", `position ignorée: ${gpsAnalysis.reason}`);
            }
          })
          .subscribe((status: any) => {
            const s = String(status || "").toLowerCase();
            pushRtEvent("status", `system: ${s || "?"}`);
            if (s === "subscribed") {
              connectionStateRef.current = "connected";
              setTrackingDiag((prev) => ({ ...prev, realtime: "connecté · realtime" }));
              // Ne PAS couper le polling — il reste actif comme filet de sécurité permanent.
              // Le realtime est un bonus de rapidité ; si la WS devient silencieuse sans
              // déclencher d'erreur (réseau mobile, idle), le polling continue à couvrir.
              if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
              }
            } else if (["channel_error", "timed_out", "closed"].includes(s)) {
              connectionStateRef.current = "disconnected";
              setTrackingDiag((prev) => ({ ...prev, realtime: `déconnecté · ${s}` }));
              pushRtEvent("err", `realtime stoppé: ${s} → fallback polling + retry 10s`);
              startPolling();
              if (!reconnectTimerRef.current) {
                reconnectTimerRef.current = setTimeout(() => {
                  reconnectTimerRef.current = null;
                  setRetryNonce((n) => n + 1);
                }, 10000);
              }
            }
          });

        const resaChannel = supabase
          .channel(`suivi-resa-${resaId}-${sessionSuffix}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${resaId}` },
            (payload) => {
              const r = payload.new as any;
              const newStatus = (r.status || "").toLowerCase();
              if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(newStatus)) {
                toast.error("Course annulée", {
                  description: "Cette réservation n'est plus active.",
                });
                setError({
                  code: "expired",
                  title: "Course annulée ou refusée",
                  message: "Cette course n'est plus active.",
                });
                return;
              }
              if (["terminee", "terminée", "completed", "done"].includes(newStatus)) {
                toast.info("Course terminée", {
                  description: "Merci d'avoir voyagé avec Taxi City Bordeaux.",
                });
                setCourseTerminee(true);
                const targetId = resaIdRef.current || r.id;
                if (targetId) {
                  setTimeout(() => navigate({ to: "/fin/$id", params: { id: targetId } }), 600);
                }
                return;
              }
              setResa((prev) => {
                if (!prev) return prev;
                const next = { ...prev, ...r };
                const prevStatus = (prev.status || "").toLowerCase();
                if (prevStatus !== newStatus) {
                  if (newStatus === "accepted") {
                    toast.success("✅ Course acceptée", {
                      description: "Votre chauffeur arrive bientôt.",
                      duration: 6000,
                    });
                  } else if (newStatus === "en_route") {
                    toast.success("🚕 Chauffeur en route", {
                      description: "Suivez sa position en direct.",
                      duration: 6000,
                    });
                  } else if (newStatus === "arrived") {
                    toast.success("📍 Chauffeur arrivé", {
                      description: "Votre taxi vous attend.",
                      duration: 8000,
                    });
                  }
                }
                if (prev.prix_estime !== r.prix_estime && r.prix_estime)
                  toast.info("💶 Prix mis à jour", { description: `${r.prix_estime} €` });
                if (prev.destination !== r.destination && r.destination)
                  toast.info("📍 Destination mise à jour", { description: r.destination });
                if (
                  next.depart &&
                  (next.destination || next.arrivee) &&
                  (prev.depart !== next.depart ||
                    prev.destination !== next.destination ||
                    JSON.stringify(prev.route_coords) !== JSON.stringify(r.route_coords))
                ) {
                  // Redessiner le tracé puis recalculer l'ETA avec la nouvelle destination
                  drawTripRoute(next.depart, next.destination || next.arrivee!, next.route_coords).then(() => {
                    const driverPos = lastDriverPos.current;
                    if (driverPos && destCoordsRef.current) {
                      calculateETA(driverPos.lat, driverPos.lng, destCoordsRef.current);
                    }
                  });
                }
                return next;
              });
            },
          )
          .subscribe((status: any) => {
            const s = String(status || "").toLowerCase();
            pushRtEvent("status", `resa system: ${s || "?"}`);
            if (s === "subscribed") {
              // Au moment où la souscription statut redevient active, on relit
              // immédiatement la réservation pour combler tout UPDATE manqué
              // pendant la coupure.
              (async () => {
                const { data: r } = await supabase
                  .from("reservations")
                  .select(
                    "status,depart,arrivee,destination,prix_estime,pickup_datetime,nb_passagers,passagers,bagages,distance_km,route_coords,route_label",
                  )
                  .eq("id", resaId)
                  .maybeSingle();
                if (r) setResa((prev) => (prev ? { ...prev, ...r } : prev));
              })();
            } else if (["channel_error", "timed_out", "closed"].includes(s)) {
              pushRtEvent("err", `resa channel stoppé: ${s} → retry 10s`);
              if (!reconnectTimerRef.current) {
                reconnectTimerRef.current = setTimeout(() => {
                  reconnectTimerRef.current = null;
                  setRetryNonce((n) => n + 1);
                }, 10000);
              }
            }
          });

        channelRef.current = [gpsChannel, resaChannel];
      } finally {
        subscribingRef.current = false; // #7 : libérer le flag (même en cas d'erreur)
      }
    },
    [startPolling, stopPolling, drawTripRoute, recordGpsDiagnostic, pushRtEvent],
  );

  // ── Chrono chargement ────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
  }, [loading]);

  // ── Chargement principal ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLoading(true);
    setError(null);
    setLoadStep(0);

    // [FUSION] analytics visite — identique à tracking
    const sessionId = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sessionId);
    supabase.from("site_analytics").insert({ event: "suivi_open", session_id: sessionId });

    const toastId = "suivi-load";

    const init = async () => {
      // 1. Valider l'ID
      const parsed = suiviIdSchema.safeParse(id);
      let r: Reservation | null = null;
      let lastErr: any = null;

      setLoadStep(1);

      // ── Lookup dual avec retry ────────────────────────────────────────────
      // Stratégie :
      //   1. RPC get_reservation_for_suivi(suivi_id) — path normal client
      //   2. Si miss ET ?rid= présent → même RPC avec l'UUID natif de la réservation.
      //      Le dashboard passe ?rid=<reservation.id> quand il ouvre la page chauffeur,
      //      ce qui permet de retrouver la réservation même si la propagation DB
      //      n'a pas encore rendu le suivi_id visible sur la connexion anon.
      // Le nombre de tentatives est étendu à 5 pour la page chauffeur (?gps=1)
      // car elle s'ouvre immédiatement après le UPDATE admin.
      const rpcLookup = async (key: string): Promise<Reservation | null> => {
        const { data, error: eRpc } = await (supabase as any).rpc("get_reservation_for_suivi", {
          p_key: key,
        });
        if (eRpc) {
          lastErr = eRpc;
          console.warn("[suivi] RPC error pour key:", key.slice(0, 8), eRpc.message);
          return null;
        }
        const row = Array.isArray(data) ? data[0] : data;
        return (row as Reservation) ?? null;
      };

      const lookup = async (attempt: number): Promise<Reservation | null> => {
        const key = parsed.success ? parsed.data : id;
        console.info(`[suivi] lookup #${attempt + 1} — suivi_id: ${key.slice(0, 8)}`);

        // Tentative 1 : par suivi_id
        const bysuiviId = await rpcLookup(key);
        if (bysuiviId) {
          console.info(
            "[suivi] ✅ Trouvé par suivi_id, resa.id:",
            bysuiviId.id?.slice(0, 8),
            "status:",
            bysuiviId.status,
          );
          return bysuiviId;
        }
        console.warn("[suivi] ❌ Miss par suivi_id");

        // Tentative 2 : par UUID natif (?rid=) — page chauffeur uniquement
        if (ridParam && ridParam.length === 36) {
          console.info("[suivi] Fallback lookup par rid:", ridParam.slice(0, 8));
          const byRid = await rpcLookup(ridParam);
          if (byRid) {
            console.info("[suivi] ✅ Trouvé par rid, status:", byRid.status);
            return byRid;
          }
          console.warn("[suivi] ❌ Miss par rid aussi");
        }

        return null;
      };

      // 5 tentatives si page chauffeur (s'ouvre juste après UPDATE admin),
      // 3 sinon. Délai 600ms chauffeur, 400ms client.
      const isDriverPage = gpsParam === "1";
      const maxAttempts = isDriverPage ? 5 : 3;
      const retryDelay = isDriverPage ? 600 : 400;

      console.info(
        "[suivi] Init — id:",
        id.slice(0, 8),
        "| gps:",
        gpsParam,
        "| rid:",
        ridParam?.slice(0, 8),
        "| maxAttempts:",
        maxAttempts,
      );

      for (let attempt = 0; attempt < maxAttempts && !r; attempt++) {
        if (attempt > 0) {
          console.info(`[suivi] Retry dans ${retryDelay}ms… (${attempt}/${maxAttempts - 1})`);
          await new Promise((res) => setTimeout(res, retryDelay));
        }
        r = await lookup(attempt);
      }

      if (!r) {
        console.error("[suivi] ❌ Échec final — aucune réservation trouvée", { id, ridParam, lastErr });
        toast.error("Aucune course trouvée", { id: toastId });
        setError({
          code: "notfound",
          title: "Réservation introuvable",
          message: lastErr?.message
            ? `Erreur d'accès : ${lastErr.message}`
            : "Ce lien de suivi n'est pas valide ou a expiré.",
        });
        setLoading(false);
        return;
      }

      // Vérification expiration :
      // - Si pickup_datetime dispo → le lien expire 6h APRÈS la prise en charge
      // - Sinon fallback → created_at + 48h (large marge pour les réservations à l'avance)
      const pickupMs = r.pickup_datetime ? new Date(r.pickup_datetime).getTime() : 0;
      const createdAt = r.created_at ? new Date(r.created_at).getTime() : 0;
      const expiresAt = pickupMs
        ? pickupMs + 6 * 60 * 60 * 1000 // pickup + 6h
        : createdAt + 48 * 60 * 60 * 1000; // created_at + 48h
      if (expiresAt && Date.now() > expiresAt) {
        toast.error("Lien expiré", { id: toastId });
        setError({
          code: "expired",
          title: "Lien de suivi expiré",
          message: "Ce lien de suivi a expiré. Contactez-nous pour en obtenir un nouveau.",
        });
        setLoading(false);
        return;
      }

      // 2. Vérifier statut
      const status = (r.status || "").toLowerCase();
      if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(status)) {
        setError({
          code: "expired",
          title: "Course annulée ou refusée",
          message: "Cette course n'est plus active. Contactez-nous pour en créer une nouvelle.",
        });
        setLoading(false);
        return;
      }
      if (["terminee", "terminée", "completed", "done"].includes(status)) {
        setCourseTerminee(true);
      }

      resaIdRef.current = r.id;
      setResa(r);

      if (r.pickup_datetime) schedulePickupNotification(r.pickup_datetime);

      const dep = r.depart,
        dest = r.destination ?? r.arrivee;
      if (!dep && !dest && r.prix_estime == null && !shownIncompleteToast.has(r.id)) {
        shownIncompleteToast.add(r.id);
        toast.warning("ℹ️ Détails incomplets", {
          description: "Départ, destination et prix seront disponibles très prochainement.",
          duration: 7000,
        });
      }

      setLoadStep(2);

      setLoadStep(3);
      // Lecture depuis driver_gps (table réelle du chauffeur)
      const { data: locData, rlsBlocked: locRlsBlocked } = await fetchDriverGps();
      if (locRlsBlocked) {
        pushRtEvent("err", "driver_gps: accès refusé par RLS au chargement");
      }
      const gpsLat: number | null =
        locData?.latitude != null && Number.isFinite(locData.latitude) ? locData.latitude : null;
      const gpsLng: number | null =
        locData?.longitude != null && Number.isFinite(locData.longitude) ? locData.longitude : null;
      const gpsAnalysis = recordGpsDiagnostic(locData ?? {}, "chargement initial");
      if (gpsLat !== null && gpsLng !== null && gpsAnalysis.ok) {
        await initMap(gpsLat, gpsLng);
        setDriverPos({ lat: gpsLat, lng: gpsLng });
        // drawTripRoute d'abord pour peupler destCoordsRef, PUIS ETA vers la vraie destination
        if (dep && dest) {
          await drawTripRoute(dep, dest, r.route_coords);
        }
        // destCoordsRef est maintenant peuplé par drawTripRoute
        await calculateETA(gpsLat, gpsLng, destCoordsRef.current ?? undefined);
      } else {
        // Driver offline : initMap sur Bordeaux, puis tracer le trajet
        await initMap(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
        if (dep && dest) {
          // drawTripRoute attend que map soit prêt (retry interne), pas besoin d'await ici
          drawTripRoute(dep, dest, r.route_coords);
        }
      }

      const clientName = ((r.client_name || r.nom) ?? "").toString().trim();
      toast.success("✅ Course trouvée", {
        id: toastId,
        description: `${clientName ? clientName + " — " : ""}chauffeur unique`,
        duration: 4000,
      });

      setLoading(false);
      subscribeRealtime("driver", r.id, "single");
    };

    // ── Reconnexion automatique : reprise de veille / retour réseau ────────
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && resaIdRef.current) {
        fetchDriverGps().then(async ({ data, rlsBlocked }) => {
          if (rlsBlocked) {
            pushRtEvent("err", "driver_gps: accès refusé (RLS) au retour de visibilité");
            return;
          }
          const gpsAnalysis = recordGpsDiagnostic(data, "retour onglet");
          if (gpsAnalysis.ok && data?.latitude != null && data?.longitude != null) {
            // Si le trajet n'est pas tracé (ex: retour de veille longue), le redessiner
            if (!destCoordsRef.current) {
              const { data: rData } = await supabase
                .from("reservations")
                .select("depart,arrivee,destination,route_coords")
                .eq("id", resaIdRef.current)
                .maybeSingle();
              if (rData?.depart && (rData?.destination || rData?.arrivee)) {
                await drawTripRoute(
                  rData.depart,
                  rData.destination || rData.arrivee!,
                  rData.route_coords as [number, number][] | null,
                );
              }
            }
            setDriverPos({ lat: data.latitude, lng: data.longitude });
            lastDriverPos.current = { lat: data.latitude, lng: data.longitude };
            calculateETAThrottled(data.latitude, data.longitude);
          }
        });
        // Resouscrire le Realtime si déconnecté OU si silence GPS > 30s
        // (le flag connectionStateRef n'est pas toujours à jour quand la WS meurt silencieusement)
        const last = lastUpdateRef.current;
        const silentMs = last ? Date.now() - last.getTime() : Infinity;
        if (connectionStateRef.current === "disconnected" || silentMs > 30000) {
          setRetryNonce((n) => n + 1);
        }
      }
    };
    // Refresh immédiat du statut : sans attendre le prochain tick de polling
    // (5 s) ni la resouscription Realtime, on relit la réservation tout de suite.
    const refreshResaNow = async () => {
      if (!resaIdRef.current) return;
      const { data: r } = await supabase
        .from("reservations")
        .select(
          "status,depart,arrivee,destination,prix_estime,pickup_datetime,nb_passagers,passagers,bagages,distance_km,route_coords,route_label",
        )
        .eq("id", resaIdRef.current)
        .maybeSingle();
      if (r) setResa((prev) => (prev ? { ...prev, ...r } : prev));
    };
    const handleOnline = () => {
      if (!resaIdRef.current) return;
      pushRtEvent("status", "network online → refresh + resubscribe");
      refreshResaNow();
      setRetryNonce((n) => n + 1);
    };
    const handleOffline = () => {
      pushRtEvent("err", "network offline");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Fix retryNonce : si la map existe encore (ex. retry après erreur réseau),
    // on la détruit ici pour que initMap() puisse s'exécuter à nouveau.
    // Sans ce reset, le guard `if (mapInst.current) return` bloque la ré-init.
    if (mapInst.current) {
      mapInst.current.remove();
      mapInst.current = null;
      markerRef.current = null;
    }
    mapInitializing.current = false;

    init();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      const ch = channelRef.current;
      if (Array.isArray(ch)) ch.forEach((c) => c && supabase.removeChannel(c));
      else if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      stopPolling();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pickupNotifTimerRef.current) {
        clearTimeout(pickupNotifTimerRef.current);
        pickupNotifTimerRef.current = null;
      }
      notifScheduledRef.current = false;
      subscribingRef.current = false; // #7 : reset en cas de démontage pendant une souscription
      enRouteSinceRef.current = null;
      lastEtaAtRef.current = 0;
      if (tripLayer.current) {
        tripLayer.current.remove();
        tripLayer.current = null;
      }
      if (tripOutline.current) {
        tripOutline.current.remove();
        tripOutline.current = null;
      }
      if (fromMarker.current) {
        fromMarker.current.remove();
        fromMarker.current = null;
      }
      if (toMarker.current) {
        toMarker.current.remove();
        toMarker.current = null;
      }
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        markerRef.current = null;
      }
      // Remettre à zéro toutes les refs GPS pour éviter les états fantômes après reconnexion
      destCoordsRef.current = null;
      pickupCoordsRef.current = null;
      depGeoRef.current = null;
      lastDriverPos.current = null;
    };
  }, [id, retryNonce, subscribeRealtime, stopPolling, schedulePickupNotification, drawTripRoute, recordGpsDiagnostic]);

  // ── Push notifications auto ──────────────────────────────────────────────
  useEffect(() => {
    if (!resa || pushStatus !== "idle") return;
    subscribe("client", resa.id).catch(() => {});
  }, [resa, pushStatus, subscribe]);

  // ── Partager ─────────────────────────────────────────────────────────────
  const partager = async () => {
    const url = `${window.location.origin}/suivi/${id}`;
    try {
      await navigator.share({ title: "Suivi Taxi City Bordeaux", url });
    } catch {
      await navigator.clipboard.writeText(url);
      setShareMsg("✓ Copié !");
      setTimeout(() => setShareMsg(""), 2000);
    }
  };

  // ── Refresh manuel — complet (depuis tracking) ────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let currentResa: any = null;
      if (resaIdRef.current) {
        const { data: r } = await supabase
          .from("reservations")
          .select(
            "status,depart,arrivee,destination,prix_estime,pickup_datetime,nb_passagers,passagers,bagages,distance_km,client_name,nom,route_coords,route_label",
          )
          .eq("id", resaIdRef.current)
          .maybeSingle();
        if (r) {
          setResa((prev) => {
            currentResa = prev ? { ...prev, ...r } : (r as unknown as Reservation);
            return currentResa;
          });
        }
      }
      const { data, rlsBlocked } = await fetchDriverGps();
      if (rlsBlocked) {
        pushRtEvent("err", "driver_gps: accès refusé (RLS) au rafraîchissement");
        toast.warning("⚠️ Position GPS indisponible (accès restreint)");
      } else {
        const gpsAnalysis = recordGpsDiagnostic(data, "rafraîchissement manuel");
        if (gpsAnalysis.ok && data?.latitude != null && data?.longitude != null) {
          // Si le tracé n'est pas encore affiché, tenter de le redessiner d'abord
          if (!destCoordsRef.current && currentResa?.depart && (currentResa?.destination || currentResa?.arrivee)) {
            await drawTripRoute(
              currentResa.depart,
              currentResa.destination || currentResa.arrivee!,
              currentResa.route_coords,
            );
          }
          setDriverPos({ lat: data.latitude, lng: data.longitude });
          lastDriverPos.current = { lat: data.latitude, lng: data.longitude };
          calculateETAThrottled(data.latitude, data.longitude);
        }
      }
      if (mapInst.current) setTimeout(() => mapInst.current?.invalidateSize({ animate: false }), 100);
      toast.success("✅ Informations mises à jour");
    } catch {
      toast.error("Échec du rafraîchissement");
    } finally {
      setRefreshing(false);
    }
  }, [drawTripRoute]);

  // ── Détection fin de course (GPS) ────────────────────────────────────────
  // ⚠️ DÉSACTIVÉ — la logique de complétion automatique est exclusivement
  // gérée par l'admin_dashboard qui possède le contexte complet (flags
  // autoStatusFiredRef, séquence arrived → completed).
  // Laisser les deux écrire "completed" en même temps causait des doublons
  // de notification et une désynchronisation de l'état GPS.
  //
  // Ce bloc est intentionnellement vide. Le useEffect est conservé pour
  // réinitialiser enRouteSinceRef si jamais on réactive la logique côté client.
  useEffect(() => {
    if (!driverPos || !resa || courseTerminee) return;
    const status = (resa.status || "").toLowerCase();
    if (status !== "en_route") {
      enRouteSinceRef.current = null;
    }
    // Pas d'écriture DB ici — délégué à l'admin_dashboard.
  }, [driverPos, resa, courseTerminee]);

  // ── Ajout au calendrier (depuis tracking) ────────────────────────────────
  const addToCalendar = (type: "google" | "apple") => {
    if (!resa?.pickup_datetime) return;
    const start = new Date(resa.pickup_datetime);
    const end = new Date(start.getTime() + 60 * 60000);
    const title = encodeURIComponent("Course Taxi City Bordeaux");
    const details = encodeURIComponent(
      `Départ : ${resa.depart || "—"}\nDestination : ${resa.destination || resa.arrivee || "—"}\nChauffeur : 06 73 07 23 22`,
    );
    const loc = encodeURIComponent(resa.depart || "Bordeaux");
    if (type === "google") {
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      window.open(
        `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${loc}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TaxiCityBordeaux//FR",
        "BEGIN:VEVENT",
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        "SUMMARY:Course Taxi City Bordeaux",
        `DESCRIPTION:Départ : ${resa.depart || "—"}\\nDestination : ${resa.destination || resa.arrivee || "—"}`,
        `LOCATION:${resa.depart || "Bordeaux"}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "course-taxi.ics";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  // ── invalidateSize dès que le loading se termine ─────────────────────────
  useEffect(() => {
    if (!loading && mapInst.current) {
      setTimeout(() => mapInst.current?.invalidateSize({ animate: false }), 50);
      setTimeout(() => mapInst.current?.invalidateSize({ animate: false }), 250);
    }
  }, [loading]);

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string; pulse: boolean }> = {
    nouvelle: {
      label: "En attente de confirmation",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      icon: "⏳",
      pulse: true,
    },
    pending: {
      label: "En attente de confirmation",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      icon: "⏳",
      pulse: true,
    },
    accepted: {
      label: "Course confirmée — taxi en route",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.12)",
      icon: "✅",
      pulse: true,
    },
    en_route: {
      label: "Chauffeur en route vers vous",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.12)",
      icon: "🚕",
      pulse: true,
    },
    arrived: {
      label: "Taxi à votre porte",
      color: "#f5c842",
      bg: "rgba(245,200,66,0.12)",
      icon: "📍",
      pulse: true,
    },
    completed: {
      label: "Course terminée — Merci !",
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.1)",
      icon: "🏁",
      pulse: false,
    },
    terminee: {
      label: "Course terminée — Merci !",
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.1)",
      icon: "🏁",
      pulse: false,
    },
    cancelled: {
      label: "Course annulée",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.12)",
      icon: "❌",
      pulse: false,
    },
    refused: {
      label: "Course refusée",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.12)",
      icon: "🚫",
      pulse: false,
    },
  };

  const effectiveStatus = courseTerminee ? "completed" : (resa?.status ?? "pending");
  const statut = statusConfig[effectiveStatus] ?? statusConfig.pending;
  const arrivee = resa?.arrivee || resa?.destination || "—";
  const passagers = resa?.nb_passagers || resa?.passagers || 1;
  const bagages = resa?.bagages ?? 0;
  const prix = resa?.prix_estime ? `${Number(resa.prix_estime).toFixed(2)} €` : null;
  const distanceKm = resa?.distance_km ?? null;
  const clientName = ((resa?.client_name || resa?.nom) ?? "").toString().trim();
  const formatDiagnosticAge = (date: Date | null) => {
    if (!date) return "jamais";
    const ageSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (ageSec < 60) return `${ageSec}s`;
    const ageMin = Math.floor(ageSec / 60);
    const restSec = ageSec % 60;
    return `${ageMin}m ${restSec}s`;
  };
  const diagnosticColor = (() => {
    const ageMs = trackingDiag.lastHeartbeatAt ? Date.now() - trackingDiag.lastHeartbeatAt.getTime() : Infinity;
    if (trackingDiag.stopReason.startsWith("Aucun arrêt") && ageMs < 30000) return "#22c55e";
    if (ageMs < 120000) return "#f59e0b";
    return "#ef4444";
  })();
  // ── Barre de progression : projection géométrique du taxi sur le bon segment ──
  // Selon le statut :
  //   pending / accepted / en_route → taxi s'approche du CLIENT (origine→pickup)
  //   arrived / completed           → taxi emmène le client à destination (pickup→dest)
  // Calcul instantané, sans appel réseau, mis à jour à chaque position GPS.
  const pctDone = (() => {
    const taxi = driverPos;
    if (!taxi) return null;

    const status = effectiveStatus;
    const isApproaching = ["pending", "accepted", "en_route"].includes(status);
    const isDriving = ["arrived", "completed", "terminee"].includes(status);

    const pickup = depGeoRef.current; // coordonnées du point de prise en charge
    // #2 : destCoordsRef ([lat,lng]) remplace arrGeoRef — convertir en {lat,lng} pour la géométrie.
    const dest = destCoordsRef.current ? { lat: destCoordsRef.current[0], lng: destCoordsRef.current[1] } : null;

    // Segment A→B selon le statut
    // Avant l'arrivée chez le client : on ne connaît pas l'origine du taxi,
    // donc on projette le taxi sur le segment [pickup → dest] dans tous les cas.
    // C'est visuellement cohérent : 0% = taxi loin, 100% = taxi à destination.
    const segA = pickup;
    const segB = dest;

    if (segA && segB) {
      const dx = segB.lng - segA.lng;
      const dy = segB.lat - segA.lat;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return isApproaching ? 0 : 100;
      const t = ((taxi.lng - segA.lng) * dx + (taxi.lat - segA.lat) * dy) / lenSq;
      // En approche : t peut être négatif (taxi de l'autre côté) → clamp à 0
      // En course : t peut dépasser 1 (taxi a dépassé) → clamp à 100
      return Math.min(100, Math.max(0, Math.round(t * 100)));
    }

    // Fallback OSRM si géocodage pas encore prêt
    const kmLeft = etaKm ? parseFloat(etaKm) : null;
    if (totalKm && kmLeft !== null) {
      return Math.min(100, Math.max(0, Math.round(((totalKm - kmLeft) / totalKm) * 100)));
    }
    return null;
  })();

  const _loadingSteps = [
    { label: "Connexion sécurisée…", icon: "🔐" },
    { label: "Recherche de la course…", icon: "🔎" },
    { label: "Récupération de la position GPS…", icon: "📡" },
    { label: "Calcul de l'itinéraire…", icon: "🗺️" },
  ];
  const _loadingPct = [20, 45, 70, 95][loadStep] ?? 20;

  // ── Écran chargement (overlay, map div reste dans le DOM) ─────────────────
  const renderLoadingOverlay = () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#08080f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 24,
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');@keyframes spinTaxi{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}`}</style>
      <div
        style={{
          position: "relative",
          width: 110,
          height: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="110" height="110" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx="55" cy="55" r="48" stroke="rgba(245,200,66,0.12)" strokeWidth="6" fill="none" />
          <circle
            cx="55"
            cy="55"
            r="48"
            stroke="#f5c842"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 48}
            strokeDashoffset={2 * Math.PI * 48 * (1 - _loadingPct / 100)}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid #f5c842",
            animation: "spinTaxi 2s linear infinite",
          }}
        >
          <img src={TAXI_ICON_URI} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="taxi" />
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "'Syne',sans-serif",
            fontWeight: 800,
            fontSize: 20,
            color: "#f8fafc",
            marginBottom: 6,
          }}
        >
          {_loadingSteps[loadStep].icon} {_loadingSteps[loadStep].label}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#f5c842" }}>
          {Math.round(_loadingPct)}% · {elapsed}s
        </div>
      </div>
      <div style={{ width: "min(320px,80vw)", display: "flex", flexDirection: "column", gap: 8 }}>
        {_loadingSteps.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: i <= loadStep ? 1 : 0.35,
              transition: "opacity 0.3s",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: i < loadStep ? "#22c55e" : i === loadStep ? "#f5c842" : "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "#fff",
                fontWeight: 700,
                animation: i === loadStep ? "liveDot 1.2s infinite" : "none",
              }}
            >
              {i < loadStep ? "✓" : ""}
            </span>
            <span
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 13,
                color: i <= loadStep ? "#e2e8f0" : "#334155",
              }}
            >
              {s.icon} {s.label}
            </span>
          </div>
        ))}
      </div>
      {/* [FUSION] messages délai + bouton retry (depuis tracking) */}
      {elapsed > 12 && elapsed <= 30 && (
        <p
          style={{
            fontSize: 12,
            color: "#64748b",
            maxWidth: 300,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          La connexion prend plus de temps que prévu…
        </p>
      )}
      {elapsed > 30 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
          }}
        >
          <p style={{ fontSize: 13, color: "#fbbf24", textAlign: "center", margin: 0 }}>
            ⏱️ Récupération trop longue. Vérifiez votre connexion.
          </p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              setElapsed(0);
              setLoadStep(0);
              setRetryNonce((n) => n + 1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              background: "linear-gradient(135deg,#f5c842,#d97706)",
              color: "#08080f",
              border: "none",
              borderRadius: 12,
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🔄 Réessayer
          </button>
        </div>
      )}
    </div>
  );

  // ── Écran erreur (overlay, map div reste dans le DOM) ────────────────────
  const renderErrorOverlay = () => {
    if (!error) return null;
    const icon = error.code === "invalid" ? "⚠️" : error.code === "expired" ? "⏱️" : "🔍";
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#08080f",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 28,
          textAlign: "center",
          overflowY: "auto",
        }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');`}</style>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.12)",
            border: "2px solid rgba(245,158,11,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
          }}
        >
          {icon}
        </div>
        <div style={{ maxWidth: 380 }}>
          <h1
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 900,
              fontSize: 22,
              color: "#f8fafc",
              margin: 0,
            }}
          >
            {error.title}
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 14,
              color: "#94a3b8",
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            {error.message}
          </p>
          <p
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              color: "#334155",
              marginTop: 12,
            }}
          >
            Code: {id?.slice(0, 12) || "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => setRetryNonce((n) => n + 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "linear-gradient(135deg,#f5c842,#d97706)",
              color: "#08080f",
              border: "none",
              borderRadius: 12,
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🔄 Réessayer
          </button>
          <a
            href="https://taxicitybordeaux.fr"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "rgba(255,255,255,0.06)",
              color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            🏠 Site
          </a>
          <a
            href="tel:0673072322"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "#22c55e",
              color: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            📞 Appeler
          </a>
        </div>
        {/* [FUSION] bloc aide avec WhatsApp contextuel (depuis tracking) */}
        <div
          style={{
            marginTop: 14,
            padding: "14px 18px",
            background: "rgba(245,200,66,0.06)",
            border: "1px solid rgba(245,200,66,0.2)",
            borderRadius: 14,
            maxWidth: 380,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "#cbd5e1",
              marginBottom: 8,
            }}
          >
            🆘 Besoin d'aide ?
          </div>
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12,
              color: "#94a3b8",
              margin: "0 0 10px",
              lineHeight: 1.5,
            }}
          >
            Notre équipe vous répond 7j/7.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href={`https://wa.me/33673072322?text=${encodeURIComponent(`Bonjour, j'obtiens l'erreur « ${error.title} ». Code : ${id?.slice(0, 12) || "—"}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "#25D366",
                color: "#fff",
                borderRadius: 10,
                textDecoration: "none",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              💬 WhatsApp
            </a>
            <a
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "rgba(255,255,255,0.08)",
                color: "#f1f5f9",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                textDecoration: "none",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ✉️ Assistance
            </a>
          </div>
        </div>
      </div>
    );
  };

  // ── Mode chauffeur : GPS robuste + debug + messages ─────────────────────────
  const addLog = useCallback((msg: string, type: "ok" | "warn" | "err" = "ok") => {
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDriverDebug((prev) => {
      const updated = { ...prev, log: [{ time, msg, type }, ...prev.log].slice(0, 10) };
      driverDebugRef.current = updated;
      return updated;
    });
  }, []);
  // Câblage du forward-ref : addDriverLog délègue maintenant à addLog.
  // Doit être fait APRÈS la définition de addLog pour éviter la dépendance circulaire.
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  const requestDriverWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      driverWakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      setDriverDebug((prev) => ({ ...prev, wakeLock: true }));
      addLog("🔒 WakeLock activé — écran maintenu allumé", "ok");
      driverWakeLockRef.current?.addEventListener?.("release", () => {
        driverWakeLockRef.current = null;
        setDriverDebug((prev) => ({ ...prev, wakeLock: false }));
        addLog("⚠️ WakeLock relâché", "warn");
      });
    } catch {
      addLog("⚠️ WakeLock non supporté sur cet appareil", "warn");
    }
  }, [addLog]);

  const releaseDriverWakeLock = useCallback(() => {
    driverWakeLockRef.current?.release?.()?.catch?.(() => {});
    driverWakeLockRef.current = null;
    setDriverDebug((prev) => ({ ...prev, wakeLock: false }));
  }, []);

  useEffect(() => {
    // Sync du ref immédiatement (utilisé par handleError et heartbeat pour décider de relancer)
    driverGpsActiveRef.current = driverGpsActive;
    if (!driverGpsActive) {
      if (driverWatchRef.current != null) navigator.geolocation.clearWatch(driverWatchRef.current);
      if (driverHeartbeatRef.current != null) clearInterval(driverHeartbeatRef.current);
      if (bgKeepaliveRef.current != null) clearInterval(bgKeepaliveRef.current);
      bgKeepaliveRef.current = null;
      driverWatchRef.current = null;
      driverHeartbeatRef.current = null;
      driverLastSignalAtRef.current = null;
      driverRestartingRef.current = false;
      releaseDriverWakeLock();
      setDriverGpsStatus("idle");
      supabase.from("driver_gps").update({ is_active: false }).eq("id", "driver");
      return;
    }

    setDriverGpsStatus("starting");
    addLog("🚀 Démarrage GPS…", "ok");

    // Validation géographique identique au dashboard admin
    const BORDEAUX = { lat: 44.8378, lng: -0.5792 };
    const TRACKING_ENDPOINT = "/api/public/driver-location";
    const DRIVER_KEY = import.meta.env.VITE_DRIVER_KEY || import.meta.env.VITE_DRIVER_TOKEN || "";
    const MAX_ACCURACY_M = 1500;
    const MAX_DIST_FROM_BORDEAUX_M = 130_000;
    const MAX_JUMP_M = 5_000;

    const postDriverLocation = async (body: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      speed: number | null;
      heading: number | null;
      is_online: boolean;
      driver_key?: string;
    }) => {
      try {
        const res = await fetch(TRACKING_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-driver-key": DRIVER_KEY },
          body: JSON.stringify(body),
          keepalive: true,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        const now = new Date().toISOString();
        const { error: writeErr } = await supabase.from("driver_gps").upsert(
          {
            id: "driver",
            latitude: body.latitude,
            longitude: body.longitude,
            accuracy: body.accuracy,
            is_active: body.is_online,
            heartbeat_at: now,
            updated_at: now,
          },
          { onConflict: "id" },
        );
        if (writeErr) throw writeErr;
      }
    };

    const sendHeartbeat = async () => {
      const current = driverDebugRef.current;
      if (current.lat == null || current.lng == null) {
        await supabase
          .from("driver_gps")
          .update({ is_active: true, heartbeat_at: new Date().toISOString() })
          .eq("id", "driver");
        return;
      }
      await postDriverLocation({
        latitude: current.lat,
        longitude: current.lng,
        accuracy: current.accuracy,
        speed: null,
        heading: null,
        is_online: true,
        driver_key: DRIVER_KEY,
      });
    };

    const gpsDistMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const toR = (d: number) => (d * Math.PI) / 180;
      const x = (toR(b.lng) - toR(a.lng)) * Math.cos(toR((a.lat + b.lat) / 2));
      const y = toR(b.lat) - toR(a.lat);
      return Math.sqrt(x * x + y * y) * R;
    };

    const pushGps = (coords: GeolocationCoordinates) => {
      const { latitude, longitude, accuracy, speed, heading } = coords;

      // ── Validation géographique (alignée dashboard admin) ──────────────────
      // Rejette : coords invalides, trop imprécises, hors zone Bordeaux, saut anormal.
      // Couvre le cas "géolocalisation IP → Paris" sur PC/navigateur sans GPS matériel.
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) {
        addLog("❌ Position invalide ignorée (NaN)", "err");
        return;
      }
      if (accuracy > MAX_ACCURACY_M) {
        addLog(`❌ Précision trop faible (±${Math.round(accuracy)}m > ${MAX_ACCURACY_M}m) — position rejetée`, "err");
        setDriverGpsStatus("weak");
        return;
      }
      if (gpsDistMeters({ lat: latitude, lng: longitude }, BORDEAUX) > MAX_DIST_FROM_BORDEAUX_M) {
        addLog(`❌ Position hors zone Bordeaux (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) — rejetée`, "err");
        setDriverGpsStatus("error");
        return;
      }
      const lastPos =
        driverDebugRef.current.lat != null && driverDebugRef.current.lng != null
          ? { lat: driverDebugRef.current.lat, lng: driverDebugRef.current.lng }
          : null;
      if (lastPos && gpsDistMeters(lastPos, { lat: latitude, lng: longitude }) > MAX_JUMP_M) {
        addLog(`❌ Saut GPS anormal (>${MAX_JUMP_M}m) ignoré`, "warn");
        return;
      }

      driverLastSignalAtRef.current = Date.now();
      driverRestartingRef.current = false;
      const isWeak = accuracy > 500; // signal faible si > 500m (affiché uniquement, pas bloquant)
      setDriverGpsStatus(isWeak ? "weak" : "active");
      setDriverDebug((prev) => {
        const updated = {
          ...prev,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? null,
          signalsSent: prev.signalsSent + 1,
        };
        driverDebugRef.current = updated;
        return updated;
      });
      if (isWeak) addLog(`📶 Signal faible — précision ${Math.round(accuracy!)}m`, "warn");
      else addLog(`📡 Position envoyée — précision ${Math.round(accuracy ?? 0)}m`, "ok");
      postDriverLocation({
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        is_online: true,
      }).catch(() => {
        setDriverDebug((prev) => ({ ...prev, errors: prev.errors + 1 }));
        addLog("❌ Échec envoi position", "err");
      });
    };

    const flushLastKnownPosition = () => {
      const current = driverDebugRef.current;
      if (current.lat == null || current.lng == null) return;
      const payload = JSON.stringify({
        latitude: current.lat,
        longitude: current.lng,
        accuracy: current.accuracy,
        speed: null,
        heading: null,
        is_online: true,
      });
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon(TRACKING_ENDPOINT, blob);
          addLog("📨 Dernière position conservée en arrière-plan", "ok");
          return;
        }
      } catch {}
      fetch(TRACKING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    const handlePageHide = () => flushLastKnownPosition();
    const handleVisibilityFlush = () => {
      if (document.visibilityState === "hidden") {
        setDriverGpsStatus("background");
        flushLastKnownPosition();
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    // iOS bfcache : quand l'utilisateur revient via le bouton retour,
    // la page est restaurée depuis le cache — le WakeLock est perdu.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && driverGpsActiveRef.current) {
        requestDriverWakeLock();
        addLog("📄 Retour bfcache — WakeLock réacquis", "ok");
        // Si le watch est mort, relancer
        if (driverWatchRef.current === null) {
          driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGps(pos.coords), handleError, {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 15000,
          });
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityFlush);

    const handleError = (err: GeolocationPositionError) => {
      setDriverDebug((prev) => ({ ...prev, errors: prev.errors + 1 }));
      if (err.code === 1) {
        setDriverGpsStatus("denied");
        addLog("🚫 Localisation refusée — autorise dans les réglages", "err");
      } else if (err.code === 2) {
        setDriverGpsStatus("error");
        addLog("📵 Signal GPS indisponible — retry dans 8s", "warn");
      } else {
        setDriverGpsStatus("weak");
        addLog(`⏱ Timeout GPS — retry dans 8s`, "warn");
      }
      setTimeout(() => {
        if (!driverGpsActiveRef.current || driverRestartingRef.current) return;
        driverRestartingRef.current = true;
        if (driverWatchRef.current !== null) navigator.geolocation.clearWatch(driverWatchRef.current);
        driverLastSignalAtRef.current = Date.now();
        driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGps(pos.coords), handleError, {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 60000,
        });
        driverRestartingRef.current = false;
      }, 8000);
    };

    pushGpsRef.current = pushGps;
    handleErrorRef.current = handleError;


    // Position immédiate + watch continu
    // enableHighAccuracy: true + maximumAge: 0 → force le GPS matériel.
    // L'ancien enableHighAccuracy:false + maximumAge:300000 utilisait le cache de
    // géolocalisation IP qui retourne Paris sur PC/navigateur sans GPS matériel.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        addLog("✅ Première position obtenue", "ok");
        pushGps(pos.coords);
      },
      () => addLog("⚠️ Pas de position rapide — attente GPS haute précision…", "warn"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    if (driverWatchRef.current !== null) navigator.geolocation.clearWatch(driverWatchRef.current);
    driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGps(pos.coords), handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 60000,
    });

    requestDriverWakeLock();
    startSilentAudio(); // iOS : maintien arrière-plan

    // ── Intervalle 1s — maintient iOS actif en background ──────────────────
    // iOS throttle les timers à 1/min après ~30s en background SAUF si un
    // setInterval à ≤1s était actif avant le passage en background.
    // Ce ticker ne fait rien de lourd — il sert juste à garder le moteur JS éveillé.
    let _bgTick = 0;
    if (bgKeepaliveRef.current != null) clearInterval(bgKeepaliveRef.current);
    bgKeepaliveRef.current = setInterval(() => {
      _bgTick++;
    }, 1000);

    // ── Heartbeat 5s + getCurrentPosition 20s + relance GPS 45s ─────────────
    if (driverHeartbeatRef.current) clearInterval(driverHeartbeatRef.current);
    let _heartbeatTick = 0;
    driverHeartbeatRef.current = setInterval(async () => {
      _heartbeatTick++;
      try {
        await sendHeartbeat();
        const ageS = driverDebugRef.current.heartbeatAge;
        setDriverDebug((prev) => ({ ...prev, heartbeatAge: 0 }));
        if ((ageS ?? 0) > 15) addLog("💓 Heartbeat rétabli", "ok");
      } catch {
        addLog("⚠️ Heartbeat échoué", "warn");
      }
      setDriverDebug((prev) => ({ ...prev, heartbeatAge: prev.heartbeatAge !== null ? prev.heartbeatAge + 5 : 0 }));

      // getCurrentPosition toutes les 20s — force iOS à interroger le GPS
      // matériel même si watchPosition est throttlé en arrière-plan.
      if (_heartbeatTick % 4 === 0 && driverGpsActiveRef.current) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const silentMs = driverLastSignalAtRef.current ? Date.now() - driverLastSignalAtRef.current : 0;
            // N'envoyer que si watchPosition est silencieux depuis > 10s
            if (silentMs > 10_000) {
              addLog("📍 Position forcée (heartbeat 20s)", "ok");
              pushGps(pos.coords);
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
        );
      }

      // Relance GPS si aucun signal réel ne revient pendant 45s
      const silentMs = driverLastSignalAtRef.current ? Date.now() - driverLastSignalAtRef.current : 0;
      if (silentMs > 45_000 && !driverRestartingRef.current) {
        driverRestartingRef.current = true;
        addLog("🔄 Relance GPS automatique (silence 45s)", "warn");
        if (driverWatchRef.current !== null) navigator.geolocation.clearWatch(driverWatchRef.current);
        driverLastSignalAtRef.current = Date.now();
        driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGps(pos.coords), handleError, {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 45000,
        });
        driverRestartingRef.current = false;
      }
    }, 5_000);

    return () => {
      if (driverWatchRef.current != null) navigator.geolocation.clearWatch(driverWatchRef.current);
      if (driverHeartbeatRef.current != null) clearInterval(driverHeartbeatRef.current);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityFlush);
      releaseDriverWakeLock();
      stopSilentAudio();
    };
  }, [
    isDriverMode,
    driverGpsActive,
    addLog,
    requestDriverWakeLock,
    releaseDriverWakeLock,
    startSilentAudio,
    stopSilentAudio,
  ]);

  // Reprise au premier plan
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || !driverGpsActiveRef.current) return;
      requestDriverWakeLock();
      addLog("👁 Retour au premier plan — GPS vérifié", "ok");
      if (driverWatchRef.current === null) {
        // watchPosition mort (iOS a tué le GPS en arrière-plan) → relance complète
        addLog("🔄 Relance watchPosition (retour premier plan)", "ok");
        if (!driverRestartingRef.current) {
          driverRestartingRef.current = true;
          driverLastSignalAtRef.current = Date.now();
          driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGpsRef.current?.(pos.coords), (e) => handleErrorRef.current?.(e), {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 15000,
          });
          driverRestartingRef.current = false;
        }
      } else {
        // watchPosition encore vivant → getCurrentPosition immédiat pour position fraîche
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            pushGpsRef.current?.(pos.coords);
            addLog("📍 Position immédiate au retour", "ok");
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      }
      setDriverGpsStatus("active");
    };
    const handleOnline = () => {
      if (!driverGpsActiveRef.current) return;
      if (driverWatchRef.current === null) {
        addLog("🌐 Réseau rétabli — relance GPS", "ok");
        driverRestartingRef.current = true;
        driverLastSignalAtRef.current = Date.now();
        driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGpsRef.current?.(pos.coords), (e) => handleErrorRef.current?.(e), {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 15000,
        });
        driverRestartingRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [addLog, requestDriverWakeLock]);

  // ── Page principale — toujours rendue (map div toujours dans le DOM) ──────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#08080f",
        fontFamily: "'DM Sans',sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Syne:wght@700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .typo-title   { font-family: 'Syne', sans-serif; font-weight: 800; letter-spacing: -0.025em; }
        .typo-num     { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        .typo-label   { font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color:${CASE_SUBTITLE_COLOR}!important; }
        .typo-body    { font-family: 'DM Sans', sans-serif; font-weight: 500; }
        @keyframes gpsRing  { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideUp  { from{transform:translateY(32px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes driverPulse { 0%,100%{box-shadow:0 0 0 0 rgba(245,200,66,0)} 50%{box-shadow:0 0 0 14px rgba(245,200,66,0.15)} }
        @keyframes spinTaxi { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes liveDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .sheet-btn:active { transform:scale(0.96); }
        .leaflet-container { background:#0d1117 !important; width:100%!important; height:100%!important; }
        .leaflet-tooltip { background:rgba(10,10,20,0.9)!important; border:1px solid rgba(245,200,66,0.3)!important; color:#f5c842!important; font-weight:700!important; border-radius:8px!important; }
        .bottom-sheet { max-height: 58vh; }
        @media (max-height: 700px) { .bottom-sheet { max-height: 42vh; } }
        @media (max-height: 600px) { .bottom-sheet { max-height: 38vh; } }
        @media (max-width: 430px) { .bottom-sheet { max-height: 50vh; } }
        button, a { touch-action: manipulation; }
        details summary::-webkit-details-marker { display: none; }
        /* iOS momentum scroll */
        .bottom-sheet { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        /* Empêcher zoom Leaflet sur double-tap iOS */
        .leaflet-container { touch-action: pan-x pan-y; }
        /* safe-area bottom */
        .safe-bottom { padding-bottom: max(20px, env(safe-area-inset-bottom, 20px)); }
      `}</style>

      {/* ── OVERLAYS (loading / error) par-dessus la carte ── */}
      {loading && <div style={{ position: "absolute", inset: 0, zIndex: 9000 }}>{renderLoadingOverlay()}</div>}
      {!loading && error && <div style={{ position: "absolute", inset: 0, zIndex: 9000 }}>{renderErrorOverlay()}</div>}

      {resa && showHelp && <HelpPanel reservationId={resa.id} onClose={() => setShowHelp(false)} />}

      {/* ── MAP — toujours dans le DOM pour que Leaflet puisse mesurer le conteneur ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          minHeight: 0,
          visibility: loading || error ? "hidden" : "visible",
        }}
      >
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Gradient bas */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: "linear-gradient(transparent, #08080f)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      </div>

      {/* ── BOTTOM SHEET — uniquement quand la réservation est chargée ── */}
      {resa && !loading && !error && (
        <div
          className="bottom-sheet safe-bottom"
          style={{
            flexShrink: 0,
            background: "linear-gradient(180deg, #0e0e1c 0%, #080810 100%)",
            borderRadius: "28px 28px 0 0",
            boxShadow: "0 -1px 0 rgba(245,200,66,0.08), 0 -20px 60px rgba(0,0,0,0.6)",
            animation: "slideUp 0.5s cubic-bezier(.2,.8,.2,1)",
            overflowY: "auto",
          }}
        >
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 10px" }}>
            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 9 }} />
          </div>

          {/* ── STATUT ── */}
          <div style={{ padding: "0 20px 12px" }}>
            <div
              style={{
                background: `${statut.color}12`,
                border: `1px solid ${statut.color}35`,
                borderRadius: 18,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: statut.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                  animation: statut.pulse ? "pulse 2s ease-in-out infinite" : "none",
                }}
              >
                {statut.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="typo-title" style={{ fontSize: 13, color: statut.color }}>
                  {statut.label}
                </div>
                {eta !== null && driverPos && !courseTerminee && (
                  <div className="typo-body" style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {["en_route", "arrived", "accepted"].includes(effectiveStatus)
                      ? "Arrivée dans "
                      : "Prise en charge dans "}
                    <span className="typo-num" style={{ color: "#f5c842", fontSize: 14 }}>
                      {eta}
                      <span style={{ fontSize: 10, marginLeft: 2, fontWeight: 500 }}>min</span>
                    </span>
                    {/* [FUSION] km restants affiché sous l'ETA */}
                    {etaKm && <span style={{ marginLeft: 6, color: "#475569" }}>· {etaKm} km</span>}
                  </div>
                )}
                {courseTerminee && (
                  <div className="typo-body" style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Destination atteinte
                  </div>
                )}
                {!driverPos && !courseTerminee && (
                  <div className="typo-body" style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    {resa?.gps_validated_at
                      ? "⏳ En attente de la position GPS du chauffeur…"
                      : "📡 En attente d'activation du GPS par le chauffeur…"}
                  </div>
                )}
              </div>
              {driverPos && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    flexShrink: 0,
                    boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
              )}
            </div>
          </div>

          {/* ── PANNEAU GPS TAXI — visible par tous ── */}
          <div style={{ padding: "0 20px 12px" }}>
            <div
              style={{
                background: driverPos ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.035)",
                border: `1px solid ${driverPos ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 16,
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: driverPos ? 10 : 0 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: driverPos ? "#22c55e" : "#475569",
                    flexShrink: 0,
                    boxShadow: driverPos ? "0 0 0 3px rgba(34,197,94,0.2)" : "none",
                    animation: driverPos ? "pulse 2s ease-in-out infinite" : "none",
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: driverPos ? "#22c55e" : "#475569",
                    flex: 1,
                  }}
                >
                  {driverPos ? "🛰 GPS actif" : "📡 En attente GPS chauffeur"}
                </span>
                <button
                  onClick={() => {
                    if (driverGpsStatus === "idle") setDriverGpsActive(true);
                    else if (driverGpsActive) setDriverGpsActive(false);
                    else setDriverGpsActive(true);
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 10,
                    background: driverGpsActive ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                    border: `1px solid ${driverGpsActive ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)"}`,
                    color: driverGpsActive ? "#f87171" : "#22c55e",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'Syne',sans-serif",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {driverGpsActive ? "⬛ Couper" : "▶ Activer"}
                </button>
              </div>
              {driverPos && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { label: "LAT", value: driverPos.lat.toFixed(4), color: "#e2e8f0" },
                    { label: "LNG", value: driverPos.lng.toFixed(4), color: "#e2e8f0" },
                    {
                      label: "PRÉCISION",
                      value: driverDebug.accuracy !== null ? `±${Math.round(driverDebug.accuracy)}m` : "—",
                      color: driverDebug.accuracy !== null && driverDebug.accuracy > 50 ? "#f59e0b" : "#22c55e",
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "7px 10px" }}>
                      <div
                        style={{ fontSize: 9, color: "#475569", fontFamily: "'DM Sans',sans-serif", marginBottom: 2 }}
                      >
                        {label}
                      </div>
                      <div style={{ fontSize: 12, color, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {driverPos && (
                <div style={{ marginTop: 8, fontSize: 10, color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>
                  {driverDebug.signalsSent > 0 ? `${driverDebug.signalsSent} màj · ` : ""}âge{" "}
                  {formatDiagnosticAge(trackingDiag.lastPositionAt)}
                </div>
              )}
              {driverGpsActive && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    fontSize: 10,
                    color: "#f59e0b",
                    fontFamily: "'DM Sans',sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ⚠️ Gardez l'écran allumé pendant la course
                  <button
                    onClick={() => requestDriverWakeLock()}
                    style={{
                      marginLeft: "auto",
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(245,158,11,0.15)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      color: "#f59e0b",
                      fontSize: 10,
                      cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    Activer
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "0 20px 4px" }}>
            {/* ── Actions chauffeur (lecture seule pour le client) ── */}
            {resa.depart && (resa.destination || resa.arrivee) && (
              <div
                style={{
                  marginBottom: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "14px 14px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 10,
                    color: CASE_SUBTITLE_COLOR,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {isDriverMode ? "Actions chauffeur" : "Étapes de votre course"}
                </div>

                <button
                  type="button"
                  disabled={
                    !isDriverMode ||
                    statusBusy !== null ||
                    ["arrived", "completed", "terminee"].includes(effectiveStatus)
                  }
                  onClick={async () => {
                    if (!isDriverMode || !resaIdRef.current) return;
                    setStatusBusy("arrived");
                    try {
                      const { error: e } = await supabase
                        .from("reservations")
                        .update({ status: "arrived" })
                        .eq("id", resaIdRef.current);
                      if (e) throw e;
                      setResa((prev) => (prev ? { ...prev, status: "arrived" } : prev));
                      try {
                        await notifyStatusFn({
                          data: { reservation_id: resaIdRef.current, status: "arrived" },
                        });
                      } catch (err) {
                        console.warn("[suivi] push arrived failed", err);
                      }
                      toast.success("📍 Notification envoyée au client");
                    } catch (err) {
                      console.error(err);
                      toast.error("Échec de la mise à jour");
                    } finally {
                      setStatusBusy(null);
                    }
                  }}
                  title={isDriverMode ? "" : "Action réservée au chauffeur"}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: ["arrived", "completed", "terminee"].includes(effectiveStatus)
                      ? "rgba(34,197,94,0.18)"
                      : "rgba(245,200,66,0.14)",
                    border: `1px solid ${
                      ["arrived", "completed", "terminee"].includes(effectiveStatus)
                        ? "rgba(34,197,94,0.4)"
                        : "rgba(245,200,66,0.4)"
                    }`,
                    color: ["arrived", "completed", "terminee"].includes(effectiveStatus)
                      ? "#22c55e"
                      : "#f5c842",
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: isDriverMode ? "pointer" : "not-allowed",
                    opacity: isDriverMode ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {statusBusy === "arrived"
                    ? "Envoi…"
                    : ["arrived", "completed", "terminee"].includes(effectiveStatus)
                      ? "✅ Taxi devant chez vous"
                      : "🚖 Le taxi est devant chez vous"}
                </button>

                <button
                  type="button"
                  disabled={!isDriverMode || statusBusy !== null || courseTerminee}
                  onClick={async () => {
                    if (!isDriverMode || !resaIdRef.current) return;
                    if (!window.confirm("Confirmer la fin de la course ?")) return;
                    setStatusBusy("completed");
                    try {
                      const { error: e } = await supabase
                        .from("reservations")
                        .update({ status: "completed" })
                        .eq("id", resaIdRef.current);
                      if (e) throw e;
                      try {
                        await notifyStatusFn({
                          data: { reservation_id: resaIdRef.current, status: "completed" },
                        });
                      } catch (err) {
                        console.warn("[suivi] push completed failed", err);
                      }
                      setCourseTerminee(true);
                      setResa((prev) => (prev ? { ...prev, status: "completed" } : prev));
                      setDriverGpsActive(false);
                      toast.success("🏁 Course terminée");
                      const targetId = resaIdRef.current;
                      setTimeout(() => navigate({ to: "/fin/$id", params: { id: targetId } }), 500);
                    } catch (err) {
                      console.error(err);
                      toast.error("Échec de la mise à jour");
                    } finally {
                      setStatusBusy(null);
                    }
                  }}
                  title={isDriverMode ? "" : "Action réservée au chauffeur"}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#f87171",
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: isDriverMode ? "pointer" : "not-allowed",
                    opacity: isDriverMode ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {statusBusy === "completed" ? "Envoi…" : "🏁 Course terminée"}
                </button>

                {!isDriverMode && (
                  <div
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 10,
                      color: "#64748b",
                      textAlign: "center",
                      marginTop: 2,
                    }}
                  >
                    🔒 Ces boutons sont utilisés par votre chauffeur.
                  </div>
                )}

                {/* Adresses + ETA */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    paddingTop: 8,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 11,
                      color: CASE_SUBTITLE_COLOR,
                      maxWidth: "45%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📍 {resa.depart}
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 11,
                      color: CASE_SUBTITLE_COLOR,
                      maxWidth: "45%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                    }}
                  >
                    🏁 {resa.destination || resa.arrivee}
                  </span>
                </div>
                {eta !== null && (
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#64748b" }}>
                      ⏱ {eta} min
                      {etaKm && <span style={{ color: "#475569" }}> · {etaKm} km restants</span>}
                    </span>
                  </div>
                )}
              </div>
            )}


            {/* ── CHAUFFEUR ── */}
            <div
              style={{
                background: "rgba(245,200,66,0.04)",
                border: "1px solid rgba(245,200,66,0.12)",
                borderRadius: 20,
                padding: 16,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              {/* Triple-tap zone sur photo + nom → mode chauffeur */}
              <div
                onClick={handleDriverTripleTap}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  flexShrink: 0,
                  overflow: "hidden",
                  border: "2px solid rgba(245,200,66,0.3)",
                  cursor: "default",
                  WebkitTapHighlightColor: "transparent",
                  userSelect: "none",
                }}
              >
                <img src={TAXI_ICON_URI} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="taxi" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }} onClick={handleDriverTripleTap}>
                <div
                  className="typo-title"
                  style={{ fontSize: 18, color: "#f1f5f9", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
                >
                  {CHAUFFEUR.nom}
                </div>
                <div className="typo-body" style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {CHAUFFEUR.vehicule}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ color: "#f5c842", fontSize: 11 }}>★★★★★</span>
                  <span className="typo-num" style={{ color: "#64748b", fontSize: 12 }}>
                    5.0
                  </span>
                </div>
              </div>
              <div
                style={{
                  background: "rgba(8,8,15,0.6)",
                  border: "1px solid rgba(245,200,66,0.3)",
                  borderRadius: 10,
                  padding: "6px 12px",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                <div className="typo-label" style={{ fontSize: 9, color: "#f1f5f9", marginBottom: 4 }}>
                  Plaque
                </div>
                <div className="typo-num" style={{ fontSize: 14, color: "#f5c842", letterSpacing: "0.12em" }}>
                  {CHAUFFEUR.plaque}
                </div>
              </div>
            </div>

            {/* [FUSION] Bandeau client (depuis tracking) */}
            {clientName && (
              <div
                style={{
                  marginBottom: 14,
                  background: "rgba(34,197,94,0.06)",
                  border: "1px solid rgba(34,197,94,0.18)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>👋</span>
                <div>
                  <div className="typo-label" style={{ fontSize: 10, color: "#334155" }}>
                    COURSE DE
                  </div>
                  <div className="typo-body" style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 3 }}>
                    {clientName}
                  </div>
                </div>
              </div>
            )}

            {/* ── INFOS COURSE ── */}
            <div
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    paddingTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
                    }}
                  />
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 1,
                    }}
                  />
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: "#f5c842",
                      boxShadow: "0 0 0 3px rgba(245,200,66,0.15)",
                    }}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div className="typo-label" style={{ fontSize: 10, color: "#f1f5f9", marginBottom: 3 }}>
                      Départ
                    </div>
                    <div
                      className="typo-body"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#e2e8f0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {resa.depart}
                    </div>
                  </div>
                  <div>
                    <div className="typo-label" style={{ fontSize: 10, color: "#f1f5f9", marginBottom: 3 }}>
                      Destination
                    </div>
                    <div
                      className="typo-body"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#e2e8f0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {arrivee}
                    </div>
                  </div>
                </div>
              </div>
              {/* Méta */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 80,
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 12,
                    padding: "9px 10px",
                    textAlign: "center",
                  }}
                >
                  <div className="typo-label" style={{ fontSize: 9, color: "#f1f5f9", marginBottom: 4 }}>
                    Prise en charge
                  </div>
                  <div className="typo-num" style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.3 }}>
                    {formatPickup(resa)}
                  </div>
                </div>
                {distanceKm && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 12,
                      padding: "9px 12px",
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div className="typo-label" style={{ fontSize: 9, color: "#f1f5f9", marginBottom: 4 }}>
                      Distance
                    </div>
                    <div className="typo-num" style={{ fontSize: 15, color: "#cbd5e1" }}>
                      {distanceKm}
                      <span style={{ fontSize: 10, marginLeft: 2, color: "#64748b", fontWeight: 500 }}>km</span>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 12,
                    padding: "9px 12px",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  <div className="typo-label" style={{ fontSize: 9, color: "#f1f5f9", marginBottom: 4 }}>
                    Pass.
                  </div>
                  <div className="typo-num" style={{ fontSize: 15, color: "#cbd5e1" }}>
                    👥 {passagers}
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 12,
                    padding: "9px 12px",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  <div className="typo-label" style={{ fontSize: 9, color: "#f1f5f9", marginBottom: 4 }}>
                    Bagages
                  </div>
                  <div className="typo-num" style={{ fontSize: 15, color: "#cbd5e1" }}>
                    🧳 {bagages}
                  </div>
                </div>
                {prix && (
                  <div
                    style={{
                      background: "rgba(245,200,66,0.07)",
                      border: "1px solid rgba(245,200,66,0.15)",
                      borderRadius: 12,
                      padding: "9px 14px",
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div className="typo-label" style={{ fontSize: 9, color: "#f1f5f9", marginBottom: 4 }}>
                      Prix est.
                    </div>
                    <div className="typo-num" style={{ fontSize: 17, color: "#f5c842" }}>
                      {prix}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* [FUSION] Ajout au calendrier (depuis tracking) */}
            {resa.pickup_datetime &&
              (() => {
                const d = new Date(resa.pickup_datetime);
                const formatted = d.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                });
                const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    style={{
                      marginBottom: 14,
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: 14,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20 }}>🕒</span>
                      <div>
                        <div className="typo-label" style={{ fontSize: 10, color: "#334155" }}>
                          PRISE EN CHARGE
                        </div>
                        <div
                          className="typo-body"
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#f1f5f9",
                            marginTop: 3,
                            textTransform: "capitalize",
                          }}
                        >
                          {formatted} · {time}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => addToCalendar("google")}
                        title="Ajouter à Google Calendar"
                        style={{
                          padding: "7px 12px",
                          background: "rgba(245,200,66,0.12)",
                          border: "1px solid rgba(245,200,66,0.3)",
                          color: "#f5c842",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        📅 Google
                      </button>
                      <button
                        onClick={() => addToCalendar("apple")}
                        title="Ajouter à Apple Calendar (.ics)"
                        style={{
                          padding: "7px 12px",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#94a3b8",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        🍎 Apple
                      </button>
                    </div>
                  </div>
                );
              })()}

            {/* ── ACTIONS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <button
                className="sheet-btn typo-title"
                onClick={() => (window.location.href = `tel:${CHAUFFEUR.phone}`)}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  color: "#22c55e",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 52,
                  transition: "all 0.15s",
                }}
              >
                📞 Appeler
              </button>
              <button
                className="sheet-btn typo-title"
                onClick={partager}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 52,
                  transition: "all 0.15s",
                }}
              >
                {shareMsg || "🔗 Partager"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                className="sheet-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#475569",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    animation: refreshing ? "spin 0.8s linear infinite" : "none",
                  }}
                >
                  {refreshing ? "⏳" : "🔄"}
                </span>{" "}
                Rafraîchir
              </button>
              {isDriverMode &&
                (() => {
                  const statusConfig = {
                    idle: {
                      bg: "rgba(99,102,241,0.12)",
                      border: "rgba(99,102,241,0.35)",
                      color: "#a5b4fc",
                      icon: "📍",
                      label: "Activer GPS",
                    },
                    starting: {
                      bg: "rgba(245,200,66,0.12)",
                      border: "rgba(245,200,66,0.35)",
                      color: "#f5c842",
                      icon: "🔄",
                      label: "Démarrage…",
                    },
                    active: {
                      bg: "rgba(34,197,94,0.12)",
                      border: "rgba(34,197,94,0.35)",
                      color: "#22c55e",
                      icon: "📡",
                      label: "GPS actif — tout roule",
                    },
                    weak: {
                      bg: "rgba(245,158,11,0.12)",
                      border: "rgba(245,158,11,0.35)",
                      color: "#f59e0b",
                      icon: "📶",
                      label: "Signal faible — en attente…",
                    },
                    denied: {
                      bg: "rgba(239,68,68,0.12)",
                      border: "rgba(239,68,68,0.35)",
                      color: "#ef4444",
                      icon: "🚫",
                      label: "GPS refusé — ouvre les réglages",
                    },
                    background: {
                      bg: "rgba(148,163,184,0.08)",
                      border: "rgba(148,163,184,0.2)",
                      color: "#94a3b8",
                      icon: "🔋",
                      label: "Arrière-plan — reprise auto…",
                    },
                    error: {
                      bg: "rgba(239,68,68,0.08)",
                      border: "rgba(239,68,68,0.25)",
                      color: "#f87171",
                      icon: "❌",
                      label: "Erreur GPS — retry en cours…",
                    },
                  }[driverGpsStatus];
                  return (
                    <div style={{ gridColumn: "1 / -1" }}>
                      {/* Bouton GPS */}
                      <button
                        className="sheet-btn"
                        onClick={() => {
                          if (driverGpsStatus === "idle") setDriverGpsActive(true);
                          else if (driverGpsActive) setDriverGpsActive(false);
                          else setDriverGpsActive(true);
                        }}
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          borderRadius: 16,
                          background: statusConfig.bg,
                          border: `1px solid ${statusConfig.border}`,
                          color: statusConfig.color,
                          fontSize: 14,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 700,
                          animation: driverGpsStatus === "starting" ? "spin 1s linear infinite" : "none",
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{statusConfig.icon}</span>
                        {statusConfig.label}
                      </button>

                      {/* Bouton Reconnecter GPS — relance realtime + fetch immédiat driver_gps */}
                      <button
                        className="sheet-btn"
                        onClick={async () => {
                          addLog("🔄 Reconnexion realtime + fetch driver_gps…", "ok");
                          try {
                            const { data, error } = await supabase
                              .from("driver_gps")
                              .select("latitude,longitude,updated_at")
                              .eq("id", "driver")
                              .maybeSingle();
                            if (error) {
                              const isRls =
                                error.code === "42501" || (error.message ?? "").toLowerCase().includes("permission");
                              addLog(`❌ Fetch driver_gps${isRls ? " (RLS)" : ""}: ${error.message}`, "err");
                            } else if (data?.latitude && data?.longitude) {
                              setDriverPos({ lat: data.latitude, lng: data.longitude });
                              lastDriverPos.current = { lat: data.latitude, lng: data.longitude };
                              const ageS = data.updated_at
                                ? Math.round((Date.now() - new Date(data.updated_at).getTime()) / 1000)
                                : null;
                              addLog(`✅ Position récupérée (âge ${ageS ?? "?"}s)`, "ok");
                            } else {
                              addLog("⚠️ Aucune position en base", "warn");
                            }
                          } catch (e: any) {
                            addLog(`❌ Erreur fetch: ${e?.message ?? e}`, "err");
                          }
                          // Relance complète : subscribeRealtime nettoie + recrée les channels
                          setRetryNonce((n) => n + 1);
                          addLog("📡 Abonnement realtime relancé", "ok");
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          marginTop: 8,
                          borderRadius: 14,
                          background: "rgba(59,130,246,0.12)",
                          border: "1px solid rgba(59,130,246,0.35)",
                          color: "#60a5fa",
                          fontSize: 13,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ fontSize: 15 }}>🔄</span>
                        Reconnecter GPS
                      </button>

                      {/* Panel debug — visible dès que mode chauffeur actif */}
                      <div
                        style={{
                          marginTop: 12,
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          padding: 12,
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 10,
                        }}
                      >
                        <div
                          style={{
                            color: "#f5c842",
                            fontWeight: 700,
                            fontSize: 11,
                            marginBottom: 8,
                            letterSpacing: "0.08em",
                          }}
                        >
                          🛠 DEBUG GPS
                        </div>
                        <div
                          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 10 }}
                        >
                          <div style={{ color: "#64748b" }}>Lat</div>
                          <div style={{ color: "#e2e8f0" }}>{driverDebug.lat?.toFixed(6) ?? "—"}</div>
                          <div style={{ color: "#64748b" }}>Lng</div>
                          <div style={{ color: "#e2e8f0" }}>{driverDebug.lng?.toFixed(6) ?? "—"}</div>
                          <div style={{ color: "#64748b" }}>Précision</div>
                          <div
                            style={{
                              color: driverDebug.accuracy !== null && driverDebug.accuracy > 50 ? "#f59e0b" : "#22c55e",
                            }}
                          >
                            {driverDebug.accuracy !== null ? `${Math.round(driverDebug.accuracy)}m` : "—"}
                          </div>
                          <div style={{ color: "#64748b" }}>Signaux</div>
                          <div style={{ color: "#22c55e" }}>{driverDebug.signalsSent}</div>
                          <div style={{ color: "#64748b" }}>Erreurs</div>
                          <div style={{ color: driverDebug.errors > 0 ? "#ef4444" : "#22c55e" }}>
                            {driverDebug.errors}
                          </div>
                          <div style={{ color: "#64748b" }}>WakeLock</div>
                          <div style={{ color: driverDebug.wakeLock ? "#22c55e" : "#ef4444" }}>
                            {driverDebug.wakeLock ? "✅ actif" : "❌ inactif"}
                          </div>
                          <div style={{ color: "#64748b" }}>Heartbeat</div>
                          <div
                            style={{
                              color:
                                driverDebug.heartbeatAge !== null && driverDebug.heartbeatAge > 15
                                  ? "#f59e0b"
                                  : "#22c55e",
                            }}
                          >
                            {driverDebug.heartbeatAge !== null ? `${driverDebug.heartbeatAge}s` : "—"}
                          </div>
                        </div>
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                          <div style={{ color: "#f5c842", fontSize: 9, marginBottom: 6, letterSpacing: "0.06em" }}>
                            LOG
                          </div>
                          {driverDebug.log.length === 0 && <div style={{ color: "#475569" }}>En attente…</div>}
                          {driverDebug.log.map((entry, i) => (
                            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                              <span style={{ color: "#475569", flexShrink: 0 }}>{entry.time}</span>
                              <span
                                style={{
                                  color:
                                    entry.type === "ok" ? "#94a3b8" : entry.type === "warn" ? "#f59e0b" : "#ef4444",
                                }}
                              >
                                {entry.msg}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── BOUTONS ACTIONS CHAUFFEUR ── */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                        {/* En route */}
                        {resa &&
                          !["en_route", "arrived", "completed", "terminee", "terminée"].includes(
                            (resa.status || "").toLowerCase(),
                          ) && (
                            <button
                              className="sheet-btn"
                              onClick={async () => {
                                if (!resaIdRef.current) return;
                                const { error: e } = await supabase
                                  .from("reservations")
                                  .update({ status: "en_route" })
                                  .eq("id", resaIdRef.current);
                                if (e) {
                                  toast.error("Erreur mise à jour statut");
                                  addLog("❌ Échec statut en_route", "err");
                                } else {
                                  setResa((prev) => (prev ? { ...prev, status: "en_route" } : prev));
                                  toast.success("🚕 Statut mis à jour : En route");
                                  addLog("✅ Statut → en_route", "ok");
                                }
                              }}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 16,
                                background: "rgba(59,130,246,0.15)",
                                border: "1px solid rgba(59,130,246,0.4)",
                                color: "#60a5fa",
                                fontSize: 14,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                              }}
                            >
                              🚕 Marquer En route
                            </button>
                          )}

                        {/* Arrivé */}
                        {resa && (resa.status || "").toLowerCase() === "en_route" && (
                          <button
                            className="sheet-btn"
                            onClick={async () => {
                              if (!resaIdRef.current) return;
                              const { error: e } = await supabase
                                .from("reservations")
                                .update({ status: "arrived" })
                                .eq("id", resaIdRef.current);
                              if (e) {
                                toast.error("Erreur mise à jour statut");
                                addLog("❌ Échec statut arrived", "err");
                              } else {
                                setResa((prev) => (prev ? { ...prev, status: "arrived" } : prev));
                                toast.success("📍 Statut mis à jour : Arrivé chez le client");
                                addLog("✅ Statut → arrived", "ok");
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "14px 16px",
                              borderRadius: 16,
                              background: "rgba(245,200,66,0.15)",
                              border: "1px solid rgba(245,200,66,0.4)",
                              color: "#f5c842",
                              fontSize: 14,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                            }}
                          >
                            📍 Marquer Arrivé
                          </button>
                        )}

                        {/* Course terminée */}
                        {resa &&
                          !courseTerminee &&
                          ["en_route", "arrived", "accepted"].includes((resa.status || "").toLowerCase()) && (
                            <button
                              className="sheet-btn"
                              onClick={async () => {
                                if (!resaIdRef.current) return;
                                const { error: e } = await supabase
                                  .from("reservations")
                                  .update({ status: "completed" })
                                  .eq("id", resaIdRef.current);
                                if (e) {
                                  toast.error("Erreur mise à jour statut");
                                  addLog("❌ Échec statut completed", "err");
                                } else {
                                  setCourseTerminee(true);
                                  setResa((prev) => (prev ? { ...prev, status: "completed" } : prev));
                                  setDriverGpsActive(false);
                                  toast.success("🏁 Course terminée — GPS arrêté");
                                  addLog("✅ Statut → completed · GPS arrêté", "ok");
                                }
                              }}
                              style={{
                                width: "100%",
                                padding: "14px 16px",
                                borderRadius: 16,
                                background: "rgba(239,68,68,0.12)",
                                border: "1px solid rgba(239,68,68,0.35)",
                                color: "#f87171",
                                fontSize: 14,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                fontFamily: "'Syne',sans-serif",
                                fontWeight: 700,
                              }}
                            >
                              🏁 Terminer la course
                            </button>
                          )}
                      </div>

                      {/* Panneau debug repliable — événements realtime */}
                      <div
                        style={{
                          marginTop: 8,
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          overflow: "hidden",
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 10,
                        }}
                      >
                        <button
                          onClick={() => setRtPanelOpen((o) => !o)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            background: "transparent",
                            border: "none",
                            color: "#f5c842",
                            fontFamily: "'JetBrains Mono',monospace",
                            fontWeight: 700,
                            fontSize: 11,
                            letterSpacing: "0.08em",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                          }}
                        >
                          <span>📡 DEBUG REALTIME ({realtimeEvents.length})</span>
                          <span style={{ color: "#64748b" }}>{rtPanelOpen ? "▼" : "▶"}</span>
                        </button>
                        {rtPanelOpen && (
                          <div style={{ padding: "0 12px 12px" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "auto 1fr",
                                gap: "4px 10px",
                                marginBottom: 10,
                                paddingTop: 4,
                              }}
                            >
                              <div style={{ color: "#64748b" }}>État</div>
                              <div
                                style={{
                                  color: trackingDiag.realtime.startsWith("connecté") ? "#22c55e" : "#ef4444",
                                }}
                              >
                                {trackingDiag.realtime}
                              </div>
                              <div style={{ color: "#64748b" }}>Stop</div>
                              <div style={{ color: "#e2e8f0" }}>{trackingDiag.stopReason}</div>
                              <div style={{ color: "#64748b" }}>Dernière pos.</div>
                              <div style={{ color: "#e2e8f0" }}>
                                {driverPos ? `${driverPos.lat.toFixed(5)}, ${driverPos.lng.toFixed(5)}` : "—"}
                                {trackingDiag.lastPositionAt &&
                                  ` · il y a ${Math.round((Date.now() - trackingDiag.lastPositionAt.getTime()) / 1000)}s`}
                              </div>
                              <div style={{ color: "#64748b" }}>Heartbeat</div>
                              <div style={{ color: "#e2e8f0" }}>
                                {trackingDiag.lastHeartbeatAt
                                  ? `il y a ${Math.round((Date.now() - trackingDiag.lastHeartbeatAt.getTime()) / 1000)}s`
                                  : "—"}
                              </div>
                            </div>
                            <div
                              style={{
                                borderTop: "1px solid rgba(255,255,255,0.06)",
                                paddingTop: 8,
                                maxHeight: 200,
                                overflowY: "auto",
                              }}
                            >
                              <div style={{ color: "#f5c842", fontSize: 9, marginBottom: 6, letterSpacing: "0.06em" }}>
                                ÉVÉNEMENTS
                              </div>
                              {realtimeEvents.length === 0 && <div style={{ color: "#475569" }}>Aucun événement</div>}
                              {realtimeEvents.map((e, i) => {
                                const color =
                                  e.kind === "err"
                                    ? "#ef4444"
                                    : e.kind === "pos"
                                      ? "#22c55e"
                                      : e.kind === "sub"
                                        ? "#60a5fa"
                                        : e.kind === "unsub"
                                          ? "#f59e0b"
                                          : "#94a3b8";
                                const tag =
                                  e.kind === "sub"
                                    ? "SUB"
                                    : e.kind === "unsub"
                                      ? "UNSUB"
                                      : e.kind === "pos"
                                        ? "POS"
                                        : e.kind === "err"
                                          ? "ERR"
                                          : "SYS";
                                return (
                                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                                    <span style={{ color: "#475569", flexShrink: 0 }}>{e.time}</span>
                                    <span style={{ color, flexShrink: 0, width: 42, fontWeight: 700 }}>{tag}</span>
                                    <span style={{ color: "#cbd5e1", wordBreak: "break-word" }}>{e.msg}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              <button
                className="sheet-btn"
                onClick={() => setShowHelp(true)}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#475569",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 600,
                }}
              >
                🆘 Aide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
