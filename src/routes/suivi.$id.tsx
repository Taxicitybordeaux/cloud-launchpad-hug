import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
// Push client retiré — bandeau d'étapes visuel à la place (voir composant ci-dessous).
import { getRouteGeoCoords, getDistanceAndDurationKm, calibrateKm } from "@/lib/googleRoute";
import { geocodeAddress, searchAddress } from "@/lib/googleGeocode";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { notifyReservationStatus } from "@/lib/push.functions";


export const Route = createFileRoute("/suivi/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    gps: search.gps === "1" ? "1" : undefined,
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
    { q: "Mon chauffeur ne répond pas ?", a: "Appelez directement le 06 73 07 23 22 disponible 7j/7 · 24h/24." },
    {
      q: "Je ne vois pas les infos départ/destination ?",
      a: "Elles sont finalisées par notre équipe et apparaîtront automatiquement dès validation.",
    },
    { q: "Comment annuler ma course ?", a: "Contactez-nous au 06 73 07 23 22 ou via WhatsApp ci-dessous." },
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#f8fafc" }}>
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
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#475569", marginBottom: 10 }}
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
  tracking_id?: string | null;
  distance_km?: number | null;
  created_at?: string | null;
  route_coords?: any;
  route_label?: string | null;
  lang?: string | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────
const BORDEAUX_CENTER: [number, number] = [44.8378, -0.5792];
const ARRIVAL_THRESHOLD_M = 120;
const MAX_TRACKING_DRIVER_GPS_ACCURACY_M = 1500;
const MAX_TRACKING_DRIVER_DISTANCE_FROM_BORDEAUX_M = 130000;
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

function isReliableDriverGps(
  data:
    | { latitude?: number | null; longitude?: number | null; is_active?: boolean | null; accuracy?: number | null }
    | null
    | undefined,
): data is { latitude: number; longitude: number; is_active: true; accuracy?: number | null } {
  if (!data?.is_active || data.latitude == null || data.longitude == null) return false;
  if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return false;
  if (data.latitude === 0 && data.longitude === 0) return false;
  if (
    typeof data.accuracy === "number" &&
    Number.isFinite(data.accuracy) &&
    data.accuracy > MAX_TRACKING_DRIVER_GPS_ACCURACY_M
  )
    return false;
  return (
    distMeters({ lat: data.latitude, lng: data.longitude }, { lat: BORDEAUX_CENTER[0], lng: BORDEAUX_CENTER[1] }) <=
    MAX_TRACKING_DRIVER_DISTANCE_FROM_BORDEAUX_M
  );
}

function closestIndexOnRoute(lat: number, lng: number, coords: [number, number][]) {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = distMeters({ lat, lng }, { lat: coords[i][0], lng: coords[i][1] });
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function isLatLngTuple(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))
  );
}

function normalizeLatLngTuple(value: unknown): [number, number] | null {
  if (!isLatLngTuple(value)) return null;
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (Math.abs(first) <= 10 && second >= 35 && second <= 60) return [second, first];
  if (first >= 35 && first <= 60 && Math.abs(second) <= 10) return [first, second];
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [first, second];
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return [second, first];
  return null;
}

function normalizeRouteCoords(value: unknown): [number, number][] | null {
  const raw = Array.isArray((value as any)?.coordinates) ? (value as any).coordinates : value;
  if (!Array.isArray(raw)) return null;
  const coords = raw.map(normalizeLatLngTuple).filter((p): p is [number, number] => Boolean(p));
  return coords.length >= 2 ? coords : null;
}

function knownPlaceCoords(query: string): [number, number] | null {
  const q = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    q.includes("aeroport") ||
    q.includes("bordeaux-merignac") ||
    q.includes("bordeaux merignac") ||
    q.includes("hall a")
  )
    return [44.8291, -0.7028];
  if (q.includes("gare saint") || q.includes("saint-jean") || q.includes("charles domercq")) return [44.8265, -0.5569];
  if (q.includes("place de la bourse")) return [44.8415, -0.5704];
  return null;
}

function geocodeCandidates(input: string): string[] {
  const cleaned = input.replace(/[–—]/g, ",").replace(/\s+/g, " ").trim();
  const withoutParentheses = cleaned
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const beforeDetail = input.split(/[–—]/)[0]?.trim();
  const candidates = [input, cleaned, withoutParentheses, beforeDetail].filter((v): v is string => !!v && v.length > 1);
  const known = knownPlaceCoords(input);
  if (known && input.toLowerCase().includes("aéroport"))
    candidates.push("Aéroport Bordeaux Mérignac, Mérignac, France");
  if (known && input.toLowerCase().includes("gare")) candidates.push("Gare Saint-Jean, Bordeaux, France");
  return Array.from(new Set(candidates));
}

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Google Maps icon helpers ─────────────────────────────────────────────────
// Icônes SVG data-URI : autonomes, sans dépendance externe, compatibles Google
// Maps Marker.icon. Pas d'animation pulse (limitation Maps JS sans OverlayView).
function emojiMarkerIcon(mapsApi: any, opts: { emoji: string; bg: string; border: string; size?: number }) {
  const size = opts.size ?? 40;
  const r = size / 2 - 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${opts.bg}" stroke="${opts.border}" stroke-width="3"/><text x="${size / 2}" y="${size / 2 + 7}" font-size="${Math.round(size * 0.55)}" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${opts.emoji}</text></svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new mapsApi.maps.Size(size, size),
    anchor: new mapsApi.maps.Point(size / 2, size / 2),
  };
}


// ── Types GPS ─────────────────────────────────────────────────────────────────
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
  const positionAt = data?.updated_at ? new Date(data.updated_at) : null;
  const heartbeatAt = data?.heartbeat_at ? new Date(data.heartbeat_at) : positionAt;
  const freshnessAt =
    heartbeatAt && positionAt
      ? heartbeatAt.getTime() > positionAt.getTime()
        ? heartbeatAt
        : positionAt
      : (heartbeatAt ?? positionAt);
  if (!data) return { ok: false, reason: "Aucune ligne GPS chauffeur trouvée.", positionAt, heartbeatAt };
  if (!data.is_active)
    return { ok: false, reason: "GPS chauffeur désactivé dans le dashboard.", positionAt, heartbeatAt };
  if (data.latitude == null || data.longitude == null)
    return { ok: false, reason: "GPS actif, en attente du premier point latitude/longitude.", positionAt, heartbeatAt };
  if (
    !Number.isFinite(data.latitude) ||
    !Number.isFinite(data.longitude) ||
    (data.latitude === 0 && data.longitude === 0)
  )
    return { ok: false, reason: "Dernière position GPS invalide ignorée.", positionAt, heartbeatAt };
  if (freshnessAt) {
    const ageMs = Date.now() - freshnessAt.getTime();
    if (Number.isFinite(ageMs) && ageMs > GPS_STALE_AFTER_MS)
      return {
        ok: false,
        reason: "Signal chauffeur trop ancien : aucune activité GPS depuis plus de 20 min.",
        positionAt,
        heartbeatAt,
      };
    if (Number.isFinite(ageMs) && ageMs > GPS_WARN_AFTER_MS)
      return {
        ok: true,
        reason: "Dernière position connue conservée : chauffeur probablement immobile ou app en veille.",
        positionAt,
        heartbeatAt,
      };
  }
  return { ok: true, reason: "Aucun arrêt : GPS chauffeur valide.", positionAt, heartbeatAt };
}

async function fetchDriverGps(): Promise<{ data: DriverGpsRecord | null; rlsBlocked: boolean }> {
  const { data, error } = await supabase
    .from("driver_gps")
    .select("latitude,longitude,accuracy,is_active,heartbeat_at,updated_at")
    .eq("id", "driver")
    .maybeSingle();
  if (error) {
    const isRls =
      error.code === "42501" ||
      (error.message ?? "").toLowerCase().includes("permission") ||
      (error.message ?? "").toLowerCase().includes("rls");
    if (isRls) return { data: null, rlsBlocked: true };
    return { data: null, rlsBlocked: false };
  }
  return { data: data ?? null, rlsBlocked: false };
}

async function fetchReservationForSuivi(key: string): Promise<Reservation | null> {
  const { data, error } = await (supabase as any).rpc("get_reservation_for_suivi", { p_key: key.trim() });
  if (error) {
    console.warn("[suivi] reservation lookup failed", error);
    return null;
  }
  return Array.isArray(data) ? ((data[0] ?? null) as Reservation | null) : ((data ?? null) as Reservation | null);
}

// ── Composant principal ───────────────────────────────────────────────────────
function SuiviPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const notifyStatusFn = useServerFn(notifyReservationStatus);
  const [statusBusy, setStatusBusy] = useState<null | "en_route" | "arrived" | "completed">(null);

  // ── États ─────────────────────────────────────────────────────────────────
  const [resa, setResa] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [taxiPos, setTaxiPos] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  // [FUSION] totalKm depuis tracking — pour la barre de progression départ→destination
  const [totalKm, setTotalKm] = useState<number | null>(null);
  // [FUSION] km restants (string) depuis tracking — affiché sous l'ETA
  const [etaKm, setEtaKm] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [courseTerminee, setCourseTerminee] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [userPanned, setUserPanned] = useState(false);
  const [mapHeight, setMapHeight] = useState(260);
  const [retryNonce, setRetryNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ── Mode chauffeur ────────────────────────────────────────────────────────
  // Mode chauffeur uniquement via lien GPS admin/push : ?gps=1 ou ?rid=<uuid>.
  // Ne pas utiliser resa.suivi_id/tracking_id ici : ce sont aussi les liens client,
  // sinon le client est pris pour le chauffeur et ne part pas vers /fin/$id.
  const { gps: gpsParam, rid: ridParam } = Route.useSearch();
  const isDriver = gpsParam === "1" || (!!ridParam && (!resa || ridParam === resa.id));
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
  const driverGpsActiveRef = useRef(false);
  const driverSignalsSentRef = useRef(0);
  const driverErrorsRef = useRef(0);
  const driverLastHeartbeatRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);
  const gpsDataRef = useRef<DriverGpsRecord | null>(null);
  const lastEtaAtRef = useRef<number>(0);
  const enRouteSinceRef = useRef<number | null>(null);
  const [, setGpsTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setGpsTick((n) => (n + 1) % 1000000), 5000);
    return () => clearInterval(t);
  }, []);
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
  const [error, setError] = useState<null | {
    code: "invalid" | "expired" | "notfound";
    title: string;
    message: string;
  }>(null);
  // [FUSION] deadzone & autoResume persistés dans localStorage (depuis tracking)
  const [deadZonePct, setDeadZonePct] = useState<number>(() => {
    if (typeof window === "undefined") return 60;
    const v = Number(window.localStorage.getItem("tcb_tracking_deadzone"));
    return Number.isFinite(v) && v >= 30 && v <= 90 ? v : 60;
  });
  const [autoResume, setAutoResume] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("tcb_tracking_autoresume") !== "0";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("tcb_tracking_deadzone", String(deadZonePct));
    } catch {}
  }, [deadZonePct]);
  useEffect(() => {
    try {
      window.localStorage.setItem("tcb_tracking_autoresume", autoResume ? "1" : "0");
    } catch {}
  }, [autoResume]);

  // (notifications push client supprimées — bandeau d'étapes plus bas)

  // ── Refs carte ─────────────────────────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const mapInitializing = useRef(false);
  const markerRef = useRef<any>(null);
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);
  const lastAppliedPos = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const animFrame = useRef<number | null>(null);
  const lastDriverPos = useRef<{ lat: number; lng: number } | null>(null);
  const initialZoom = useRef<number | null>(null);
  const userPannedRef = useRef(false);
  const autoResumeRef = useRef(true);

  // Refs data
  const depGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  const arrGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  const destCoordsRef = useRef<[number, number] | null>(null);
  const pickupCoordsRef = useRef<[number, number] | null>(null);
  const resaIdRef = useRef<string>("");
  const gpsIdRef = useRef<string>("driver");
  const modeRef = useRef<"single" | "multi">("single");
  const channelRef = useRef<any>(null);
  const subscribingRef = useRef(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionStateRef = useRef<"connected" | "disconnected">("disconnected");
  const notifScheduledRef = useRef(false);
  const pickupNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    userPannedRef.current = userPanned;
  }, [userPanned]);
  useEffect(() => {
    autoResumeRef.current = autoResume;
  }, [autoResume]);

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

  // ── Animation fluide marqueur — durée adaptative (depuis tracking) ───────
  const animateMarkerTo = (toLat: number, toLng: number) => {
    const marker = markerRef.current;
    if (!marker) return;
    if (animFrame.current !== null) {
      cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
    }
    const fromPos = marker.getPosition?.();
    if (!fromPos) {
      marker.setPosition({ lat: toLat, lng: toLng });
      return;
    }
    const fromLat = fromPos.lat();
    const fromLng = fromPos.lng();
    const dist = distMeters({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
    const duration = Math.min(2200, Math.max(700, dist * 25));
    const startT = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startT) / duration);
      const k = ease(t);
      const lat = fromLat + (toLat - fromLat) * k;
      const lng = fromLng + (toLng - fromLng) * k;
      marker.setPosition({ lat, lng });
      if (t < 1) animFrame.current = requestAnimationFrame(step);
      else animFrame.current = null;
    };
    animFrame.current = requestAnimationFrame(step);
  };


  // ── Geocode helper — mêmes variantes/fallbacks que /reserver, ne jamais échouer
  const geocode = async (q: string): Promise<[number, number] | null> => {
    const known = knownPlaceCoords(q);
    if (known) return known;

    const trimmed = q.trim();
    const cleaned = trimmed.replace(/[–—]/g, ",").replace(/\s+/g, " ").trim();
    const withoutParen = cleaned
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parts = cleaned
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const short = parts.slice(0, 2).join(", ");
    const first = parts[0] ?? cleaned;

    const namedVariants: string[] = [];
    const lc = cleaned.toLowerCase();
    if (/aeroport|aéroport|airport/.test(lc)) {
      namedVariants.push("Aéroport de Bordeaux-Mérignac", "Bordeaux-Mérignac Airport", "aéroport Bordeaux Mérignac");
    }
    if (/gare/.test(lc)) {
      namedVariants.push("Gare de Bordeaux-Saint-Jean", "Gare Saint-Jean, Bordeaux");
    }

    const attempts = [
      ...namedVariants,
      trimmed,
      cleaned,
      withoutParen,
      `${cleaned}, France`,
      short,
      `${short}, France`,
      `${first}, France`,
      `${first}, Bordeaux, France`,
      `${first}, Gironde, France`,
    ].filter((v, i, arr) => !!v && v.length > 2 && arr.indexOf(v) === i);

    for (const query of attempts) {
      try {
        const c = await geocodeAddress(query);
        if (c) return [c.lat, c.lng];
      } catch {}
      try {
        const r = await searchAddress(query, 1);
        if (r[0]) return [r[0].coord[0], r[0].coord[1]];
      } catch {}
    }
    return known;
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
    if (mapInitializing.current) return;
    let mapsApi: any = null;
    if (mapInst.current) {
      mapsApi = (window as any).google;
      if (mapsApi?.maps && !markerRef.current) {
        markerRef.current = new mapsApi.maps.Marker({
          position: { lat, lng },
          map: mapInst.current,
          zIndex: 20,
          icon: emojiMarkerIcon(mapsApi, { emoji: "🚕", bg: "#1a1a2e", border: "#f5c842" }),
        });
      }
      return;
    }
    mapInitializing.current = true;
    try {
      mapsApi = await loadGoogleMaps();
    } catch {
      mapInitializing.current = false;
      return;
    }
    if (mapInst.current) {
      mapInitializing.current = false;
      return;
    }
    if (!mapsApi?.maps || !mapRef.current) {
      mapInitializing.current = false;
      return;
    }
    let map: any;
    try {
      map = new mapsApi.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: mapsApi.maps.ControlPosition.RIGHT_BOTTOM },
        clickableIcons: false,
        gestureHandling: "greedy",
        backgroundColor: "#0d1117",
      });
      initialZoom.current = 14;
      map.addListener("dragstart", () => setUserPanned(true));
      map.addListener("zoom_changed", () => setUserPanned(true));
      markerRef.current = new mapsApi.maps.Marker({
        position: { lat, lng },
        map,
        zIndex: 20,
        icon: emojiMarkerIcon(mapsApi, { emoji: "🚕", bg: "#1a1a2e", border: "#f5c842" }),
      });
      mapInst.current = map;
    } catch (err) {
      console.warn("[suivi] map init failed", err);
      mapInitializing.current = false;
      return;
    }
    mapInitializing.current = false;
    setTimeout(() => mapsApi.maps.event.trigger(map, "resize"), 300);
    setTimeout(() => mapsApi.maps.event.trigger(map, "resize"), 500);
  };


  // ── Appliquer position chauffeur ────────────────────────────────────────
  const applyDriverPosition = useCallback(
    async (lat: number, lng: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const map = mapInst.current;
      if (!map) {
        await initMap(lat, lng);
        lastAppliedPos.current = { lat, lng, t: Date.now() };
        lastDriverPos.current = { lat, lng };
        setTaxiPos({ lat, lng });
        // Après initMap, redessiner le trajet si pas encore fait
        if (!destCoordsRef.current && resaIdRef.current) {
          const rData = await fetchReservationForSuivi(resaIdRef.current);
          if (rData?.depart && (rData?.destination || rData?.arrivee)) {
            await drawTripRoute(
              rData.depart,
              rData.destination || rData.arrivee!,
              rData.route_coords as [number, number][] | null,
              rData.distance_km ?? null,
            );
          }
        }
        await calculateETA(lat, lng, destCoordsRef.current ?? undefined);
        return;
      }
      const now = Date.now();
      const last = lastAppliedPos.current;
      if (last) {
        const moved = distMeters(last, { lat, lng });
        // Ignorer seulement si : mouvement < 8m ET mise à jour très récente (< 4s)
        // → évite les doubles-updates rapides, mais laisse passer si le chauffeur
        //   est vraiment immobile depuis plus de 4s (on veut quand même recalculer l'ETA)
        if (moved < 8 && now - last.t < 4000) return;
      }
      lastAppliedPos.current = { lat, lng, t: now };
      lastDriverPos.current = { lat, lng };
      setTaxiPos({ lat, lng });

      animateMarkerTo(lat, lng);

      if (userPannedRef.current) {
        if (autoResumeRef.current) {
          try {
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest(),
              ne = bounds.getNorthEast();
            const swLat = sw.lat(), swLng = sw.lng(), neLat = ne.lat(), neLng = ne.lng();
            const margin = (1 - deadZonePct / 100) / 2;
            const inside =
              lat >= swLat + (neLat - swLat) * margin &&
              lat <= neLat - (neLat - swLat) * margin &&
              lng >= swLng + (neLng - swLng) * margin &&
              lng <= neLng - (neLng - swLng) * margin;
            if (inside) {
              setUserPanned(false);
              userPannedRef.current = false;
            }
          } catch {}
        }
        await calculateETA(lat, lng, destCoordsRef.current ?? undefined);
        return;
      }
      try {
        const c = map.getCenter();
        if (distMeters({ lat: c.lat(), lng: c.lng() }, { lat, lng }) < 15) {
          await calculateETA(lat, lng, destCoordsRef.current ?? undefined);
          return;
        }
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest(),
          ne = bounds.getNorthEast();
        const swLat = sw.lat(), swLng = sw.lng(), neLat = ne.lat(), neLng = ne.lng();
        const margin = (1 - deadZonePct / 100) / 2;
        const outside =
          lat < swLat + (neLat - swLat) * margin ||
          lat > neLat - (neLat - swLat) * margin ||
          lng < swLng + (neLng - swLng) * margin ||
          lng > neLng - (neLng - swLng) * margin;
        if (outside) map.panTo({ lat, lng });
      } catch {}
      await calculateETA(lat, lng, destCoordsRef.current ?? undefined);
    },
    [deadZonePct],
  );

  const recenterOnDriver = useCallback(() => {
    const map = mapInst.current,
      pos = lastDriverPos.current;
    if (!map || !pos) return;
    map.panTo({ lat: pos.lat, lng: pos.lng });
    map.setZoom(initialZoom.current ?? map.getZoom() ?? 14);
    setUserPanned(false);
  }, []);


  // ── Tracé départ → destination (stocke totalKm) ──────────────────────────
  const drawTripRoute = useCallback(
    async (
      depart: string,
      destination: string,
      cachedCoords?: [number, number][] | null,
      resaDistanceKm?: number | null,
    ) => {
      // Attendre que la carte soit prête (elle peut ne pas l'être encore)
      let map = mapInst.current;
      if (!map) {
        // Retry pendant 8s max : en PWA/mobile, le bundle Leaflet peut arriver
        // après le premier rendu. Ne pas abandonner le tracé trop tôt.
        for (let i = 0; i < 16; i++) {
          await new Promise((r) => setTimeout(r, 500));
          map = mapInst.current;
          if (map) break;
        }
      }
      const L = (window as any).L;
      if (!map || !L) return;

      const normalizedCachedCoords = normalizeRouteCoords(cachedCoords);
      const [geoA, geoB] = await Promise.all([geocode(depart), geocode(destination)]);
      const a = geoA ?? normalizedCachedCoords?.[0] ?? null;
      const b = geoB ?? normalizedCachedCoords?.[normalizedCachedCoords.length - 1] ?? null;
      if (!a || !b) {
        console.warn("[drawTripRoute] Geocode échoué pour:", !a ? depart : destination);
        return;
      }

      depGeoRef.current = { lat: a[0], lng: a[1] };
      arrGeoRef.current = { lat: b[0], lng: b[1] };
      destCoordsRef.current = b;
      pickupCoordsRef.current = a;

      try {
        let coords: [number, number][] = [a, b];
        let distanceKm: number | undefined;
        if (normalizedCachedCoords) {
          coords = normalizedCachedCoords;
          // Priorité : distance_km stockée en Supabase (déjà calibrée par l'Edge Function).
          // Évite la double calibration (l'Edge Function calibre déjà, recalibrer gonfle la distance).
          if (resaDistanceKm && resaDistanceKm > 0) {
            distanceKm = resaDistanceKm;
          } else {
            // Fallback : mesure brute sur les coords sans recalibrer (coords déjà issues d'OSRM calibré)
            let d = 0;
            for (let i = 1; i < coords.length; i++) {
              d += distMeters(
                { lat: coords[i - 1][0], lng: coords[i - 1][1] },
                { lat: coords[i][0], lng: coords[i][1] },
              );
            }
            distanceKm = d / 1000; // pas de calibrateKm ici — coords déjà calibrées
          }
        } else {
          // getRouteGeoCoords attend [lng, lat] (format GeoJSON/OSRM), pas [lat, lng]
          const route = await getRouteGeoCoords([a[1], a[0]], [b[1], b[0]]).catch(() => null);
          const routeCoords = normalizeRouteCoords(route?.coords);
          coords = routeCoords ?? [a, b];
          // route.distanceKm est déjà calibré ; le fallback à vol d'oiseau aussi
          distanceKm =
            route?.distanceKm || calibrateKm(distMeters({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) / 1000);
        }
        if (distanceKm && distanceKm > 0) setTotalKm(parseFloat(distanceKm.toFixed(1)));

        // Relire la carte après les awaits — l'instance peut avoir changé
        map = mapInst.current ?? map;
        if (!map) return;

        const depIcon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center"><span style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.35);animation:gpsRing 1.6s ease-out infinite"></span><span style="position:absolute;inset:6px;border-radius:50%;background:rgba(34,197,94,0.5);animation:gpsRing 1.6s ease-out infinite;animation-delay:.4s"></span><div style="position:relative;width:30px;height:30px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 4px 14px rgba(34,197,94,0.7);display:flex;align-items:center;justify-content:center;font-size:15px">📍</div></div>`,
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
        // Relire une dernière fois — les awaits geocode/OSRM peuvent avoir duré plusieurs secondes
        const activeMap = mapInst.current ?? map;
        fromMarker.current = L.marker(a, { icon: depIcon }).addTo(activeMap).bindPopup("📍 Prise en charge");
        toMarker.current = L.marker(b, { icon: destIcon }).addTo(activeMap).bindPopup("🏁 Destination");

        const driverPos = markerRef.current?.getLatLng();

        const targetBounds = L.latLngBounds([...coords, markerRef.current?.getLatLng()].filter(Boolean)).pad(0.2);
        const fit = () => {
          activeMap.invalidateSize({ animate: false });
          const size = activeMap.getSize();
          if (!size || size.x === 0 || size.y === 0) return false;
          activeMap.fitBounds(targetBounds, { animate: true, duration: 0.8 });
          return true;
        };
        // Si le conteneur est encore masqué (visibility:hidden pendant le
        // loading), getSize() renvoie 0x0 et fitBounds() ne ferait rien de
        // correct → on retente jusqu'à ce que le conteneur soit mesurable.
        if (!fit()) {
          let tries = 0;
          const retry = () => {
            tries++;
            if (fit() || tries > 20) return;
            setTimeout(retry, 150);
          };
          setTimeout(retry, 150);
        }
      } catch (err) {
        console.error("[drawTripRoute] erreur lors du tracé:", err);
      }
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
    if (diff > 0 && diff <= 30 * 60_000) {
      toast.warning(`⏰ Prise en charge dans ${Math.round(diff / 60_000)} min`, {
        description: "Préparez-vous ! Le chauffeur arrive bientôt.",
        duration: 8000,
      });
    }
    const notifMs = pickupMs - 15 * 60_000;
    if (notifMs > now) {
      if (typeof Notification !== "undefined" && Notification.permission === "default")
        Notification.requestPermission();
      setTimeout(() => {
        const formatted = new Date(pickupDatetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("driver_gps")
        .select("latitude,longitude,accuracy,is_active")
        .eq("id", "driver")
        .maybeSingle();
      if (isReliableDriverGps(data)) {
        setLastUpdate(new Date());
        // Si le trajet n'est pas encore tracé, le faire avant d'appliquer la position
        if (!destCoordsRef.current && resaIdRef.current) {
          const rData = await fetchReservationForSuivi(resaIdRef.current);
          if (rData?.depart && (rData?.destination || rData?.arrivee)) {
            await drawTripRoute(
              rData.depart,
              rData.destination || rData.arrivee!,
              rData.route_coords as [number, number][] | null,
              rData.distance_km ?? null,
            );
          }
        }
        await applyDriverPosition(data.latitude, data.longitude);
      }
      if (resaIdRef.current) {
        const r = await fetchReservationForSuivi(resaIdRef.current);
        if (r) setResa((prev) => (prev ? { ...prev, ...r } : prev));
      }
    }, 5_000);
  }, [applyDriverPosition, drawTripRoute]);

  // ── Realtime ─────────────────────────────────────────────────────────────
  const subscribeRealtime = useCallback(
    (_gpsId: string, resaId: string, _mode: "single" | "multi") => {
      // Démarre le polling immédiatement comme filet de sécurité
      startPolling();

      // Nom de channel unique par session pour éviter les collisions entre onglets
      const sessionSuffix = Math.random().toString(36).slice(2, 8);

      const gpsChannel = supabase
        .channel(`suivi-driver-location-${sessionSuffix}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_gps" }, async (payload) => {
          const d = payload.new as any;
          if (!d.is_active) return;
          if (isReliableDriverGps(d)) {
            setLastUpdate(new Date());
            await applyDriverPosition(d.latitude, d.longitude);
          }
        })
        .on("system", {}, (status: any) => {
          const s = (status?.status || "").toLowerCase();
          if (s === "subscribed") {
            connectionStateRef.current = "connected";
            stopPolling();
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
          } else if (["channel_error", "timed_out", "closed"].includes(s)) {
            connectionStateRef.current = "disconnected";
            startPolling();
            if (!reconnectTimerRef.current) {
              reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null;
                stopPolling();
                setRetryNonce((n) => n + 1);
              }, 10_000);
            }
          }
        })
        .subscribe();

      const resaChannel = supabase
        .channel(`suivi-resa-${resaId}-${sessionSuffix}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${resaId}` },
          async (payload) => {
            const r = payload.new as any;
            const newStatus = (r.status || "").toLowerCase();
            if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(newStatus)) {
              toast.error("Course annulée", { description: "Cette réservation n'est plus active." });
              setError({
                code: "expired",
                title: "Course annulée ou refusée",
                message: "Cette course n'est plus active.",
              });
              return;
            }
            if (["terminee", "terminée", "completed", "done"].includes(newStatus)) {
              toast.info("Course terminée", { description: "Merci d'avoir voyagé avec Taxi City Bordeaux." });
              setCourseTerminee(true);

              // Incrément total_courses sur la fiche client si le passage à
              // "completed" se fait depuis /suivi (et pas via l'admin, qui
              // gère déjà son propre compteur). Idempotent : si l'ancien
              // statut était déjà "completed", on ne fait rien.
              const wasCompleted = (payload.old as any)?.status === "completed";
              if (!wasCompleted) {
                const phone = (r as any).client_phone || (r as any).telephone;
                if (phone) {
                  try {
                    const { data: existing } = await supabase
                      .from("clients")
                      .select("id, total_courses")
                      .eq("phone", phone)
                      .maybeSingle();
                    if (existing) {
                      await supabase
                        .from("clients")
                        .update({ total_courses: (existing.total_courses ?? 0) + 1 })
                        .eq("id", existing.id);
                    }
                  } catch (e) {
                    console.warn("[suivi] increment total_courses failed", e);
                  }
                }
              }

              // Client → page de fin (on passe le vrai UUID, pas le suivi_id)
              // Chauffeur → retour au dashboard admin (fallback si le bouton n'a pas redirigé)
              if (!isDriver) {
                const resaRealId = (payload.new as any)?.id ?? id;
                setTimeout(() => navigate({ to: "/fin/$id", params: { id: resaRealId } }), 1200);
              } else {
                setTimeout(() => navigate({ to: "/admin/dashboard" }), 1500);
              }
              return;
            }
            setResa((prev) => {
              if (!prev) return prev;
              const next = { ...prev, ...r };
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
                drawTripRoute(
                  next.depart,
                  next.destination || next.arrivee!,
                  next.route_coords,
                  next.distance_km ?? null,
                ).then(() => {
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
        .subscribe();

      channelRef.current = [gpsChannel, resaChannel];
    },
    [applyDriverPosition, startPolling, stopPolling, drawTripRoute],
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
      // 1. Résoudre l'ID de suivi via la fonction publique sécurisée.
      // Compatible suivi_id, tracking_id et UUID interne sans déclencher de 400.
      const trackingKey = id.trim();
      setLoadStep(1);
      const r = trackingKey ? await fetchReservationForSuivi(trackingKey) : null;

      if (!r) {
        toast.error("Aucune course trouvée", { id: toastId });
        setError({
          code: "notfound",
          title: "Réservation introuvable",
          message: "Ce lien de suivi n'est pas valide ou a expiré.",
        });
        setLoading(false);
        return;
      }

      // [FUSION] Vérification expiration 24h (depuis tracking)
      const createdAt = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (createdAt && Date.now() - createdAt > 24 * 60 * 60 * 1000) {
        toast.error("Lien expiré", { id: toastId });
        setError({
          code: "expired",
          title: "Lien de suivi expiré",
          message: "Ce lien de suivi a expiré (plus de 24h). Contactez-nous pour en obtenir un nouveau.",
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
      const { data: locData } = await supabase
        .from("driver_gps")
        .select("latitude,longitude,accuracy,is_active")
        .eq("id", "driver")
        .maybeSingle();
      const gpsLat: number | null =
        locData?.latitude != null && Number.isFinite(locData.latitude) ? locData.latitude : null;
      const gpsLng: number | null =
        locData?.longitude != null && Number.isFinite(locData.longitude) ? locData.longitude : null;
      const driverOnline = isReliableDriverGps(locData ?? {});
      if (gpsLat !== null && gpsLng !== null && driverOnline) {
        await initMap(gpsLat, gpsLng);
        setTaxiPos({ lat: gpsLat, lng: gpsLng });
        setLastUpdate(new Date());
        // drawTripRoute d'abord pour peupler destCoordsRef, PUIS ETA vers la vraie destination
        if (dep && dest) {
          await drawTripRoute(dep, dest, r.route_coords, r.distance_km ?? null);
        }
        // destCoordsRef est maintenant peuplé par drawTripRoute
        await calculateETA(gpsLat, gpsLng, destCoordsRef.current ?? undefined);
      } else {
        // Driver offline : initMap sur Bordeaux, puis tracer le trajet
        await initMap(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
        if (dep && dest) {
          // drawTripRoute attend que map soit prêt (retry interne), pas besoin d'await ici
          drawTripRoute(dep, dest, r.route_coords, r.distance_km ?? null);
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
        supabase
          .from("driver_gps")
          .select("latitude,longitude,accuracy,is_active")
          .eq("id", "driver")
          .maybeSingle()
          .then(async ({ data }) => {
            if (isReliableDriverGps(data)) {
              setLastUpdate(new Date());
              // Si le trajet n'est pas tracé (ex: retour de veille longue), le redessiner
              if (!destCoordsRef.current) {
                const rData = await fetchReservationForSuivi(resaIdRef.current);
                if (rData?.depart && (rData?.destination || rData?.arrivee)) {
                  await drawTripRoute(
                    rData.depart,
                    rData.destination || rData.arrivee!,
                    rData.route_coords as [number, number][] | null,
                    rData.distance_km ?? null,
                  );
                }
              }
              applyDriverPosition(data.latitude, data.longitude);
            }
          });
        if (connectionStateRef.current === "disconnected") {
          setRetryNonce((n) => n + 1);
        }
      }
    };
    const handleOnline = () => {
      if (resaIdRef.current) setRetryNonce((n) => n + 1);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    init();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      const ch = channelRef.current;
      if (Array.isArray(ch)) ch.forEach((c) => c && supabase.removeChannel(c));
      else if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      stopPolling();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (animFrame.current !== null) {
        cancelAnimationFrame(animFrame.current);
        animFrame.current = null;
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
      arrGeoRef.current = null;
      depGeoRef.current = null;
      lastAppliedPos.current = null;
      lastDriverPos.current = null;
    };
  }, [id, retryNonce, subscribeRealtime, stopPolling, schedulePickupNotification, drawTripRoute]);

  // ── Push notifications client supprimées ─────────────────────────────────
  // Le client n'est plus abonné aux push. Toutes les étapes de la course
  // s'affichent visuellement via le bandeau d'étapes ci-dessous (realtime
  // Supabase met à jour `resa.status` automatiquement).

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
        const r = await fetchReservationForSuivi(resaIdRef.current);
        if (r) {
          setResa((prev) => {
            currentResa = prev ? { ...prev, ...r } : (r as unknown as Reservation);
            return currentResa;
          });
        }
      }
      const { data } = await supabase
        .from("driver_gps")
        .select("latitude,longitude,accuracy,is_active")
        .eq("id", "driver")
        .maybeSingle();
      if (isReliableDriverGps(data)) {
        setLastUpdate(new Date());
        // Si le tracé n'est pas encore affiché, tenter de le redessiner d'abord
        if (!destCoordsRef.current && currentResa?.depart && (currentResa?.destination || currentResa?.arrivee)) {
          await drawTripRoute(
            currentResa.depart,
            currentResa.destination || currentResa.arrivee!,
            currentResa.route_coords,
            currentResa.distance_km ?? null,
          );
        }
        await applyDriverPosition(data.latitude, data.longitude);
      }
      if (mapInst.current) setTimeout(() => mapInst.current?.invalidateSize({ animate: false }), 100);
      toast.success("✅ Informations mises à jour");
    } catch {
      toast.error("Échec du rafraîchissement");
    } finally {
      setRefreshing(false);
    }
  }, [applyDriverPosition, drawTripRoute]);

  // ── Détection fin de course (GPS) ────────────────────────────────────────
  useEffect(() => {
    if (!taxiPos || !resa || courseTerminee) return;
    if (!["en_route", "accepted", "arrived"].includes(resa.status)) return;

    // Fallback : si arrGeoRef n'est pas peuplé mais destCoordsRef l'est, l'utiliser
    const arrRef =
      arrGeoRef.current ??
      (destCoordsRef.current ? { lat: destCoordsRef.current[0], lng: destCoordsRef.current[1] } : null);
    if (!arrRef) return;

    const dist = distMeters({ lat: taxiPos.lat, lng: taxiPos.lng }, arrRef);
    // Seuil élargi à 200m pour compenser la précision variable du GPS
    // Côté client uniquement : indicateur visuel. L'update Supabase se fait via le bouton "Course terminée" de José.
    if (dist < 200 && !isDriver) {
      setCourseTerminee(true);
    }
  }, [taxiPos, resa, courseTerminee]);

  // ── Ajout au calendrier (depuis tracking) ────────────────────────────────
  const addToCalendar = (type: "google" | "apple") => {
    if (!resa?.pickup_datetime) return;
    const start = new Date(resa.pickup_datetime);
    const end = new Date(start.getTime() + 60 * 60_000);
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
  // ── Mode chauffeur : GPS robuste + debug + messages ─────────────────────────
  const addLog = useCallback((msg: string, type: "ok" | "warn" | "err" = "ok") => {
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDriverDebug((prev) => {
      const updated = { ...prev, log: [{ time, msg, type }, ...prev.log].slice(0, 10) };
      driverDebugRef.current = updated;
      return updated;
    });
  }, []);
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  const startSilentAudio = useCallback(() => {
    // No-op: l'oscillateur produisait un son audible sur certains navigateurs.
  }, []);

  const stopSilentAudio = useCallback(() => {
    // No-op
  }, []);

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
    const TRACKING_ENDPOINT = "/api/public/driver-location";
    const DRIVER_KEY = import.meta.env.VITE_DRIVER_KEY || import.meta.env.VITE_DRIVER_TOKEN || "";
    const MAX_ACCURACY_M = 1500;
    const MAX_DIST_FROM_BORDEAUX_M = 130_000;
    const MAX_JUMP_M = 5_000;
    const BORDEAUX = { lat: 44.8378, lng: -0.5792 };

    const sendHeartbeat = async () => {
      const now = new Date().toISOString();
      await supabase
        .from("driver_gps")
        .upsert({ id: "driver", heartbeat_at: now, is_active: true }, { onConflict: "id" });
      driverLastHeartbeatRef.current = Date.now();
    };

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
        await supabase.from("driver_gps").upsert(
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
      }
    };

    const pushGps = (coords: GeolocationCoordinates) => {
      const { latitude, longitude, accuracy, speed, heading } = coords;
      if (!driverGpsActiveRef.current) return;
      const prev = driverDebugRef.current;
      if (prev.lat !== null && prev.lng !== null) {
        const d = distMeters({ lat: prev.lat, lng: prev.lng }, { lat: latitude, lng: longitude });
        if (d > MAX_JUMP_M) {
          addLog(`🚨 Saut GPS ignoré (${Math.round(d)}m)`, "warn");
          return;
        }
      }
      const distFromBx = distMeters({ lat: latitude, lng: longitude }, BORDEAUX);
      if (distFromBx > MAX_DIST_FROM_BORDEAUX_M) {
        addLog("⚠️ Position hors Bordeaux ignorée", "warn");
        return;
      }
      if (accuracy !== null && accuracy > MAX_ACCURACY_M) {
        addLog(`⚠️ Précision trop faible (±${Math.round(accuracy)}m)`, "warn");
        return;
      }
      driverLastSignalAtRef.current = Date.now();
      driverSignalsSentRef.current++;
      setDriverGpsStatus("active");
      setDriverDebug((prev) => {
        const u = {
          ...prev,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? null,
          signalsSent: driverSignalsSentRef.current,
        };
        driverDebugRef.current = u;
        return u;
      });
      addLog(`📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)} ±${accuracy ? Math.round(accuracy) : "?"}m`, "ok");
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
          navigator.sendBeacon(TRACKING_ENDPOINT, new Blob([payload], { type: "application/json" }));
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
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && driverGpsActiveRef.current) {
        requestDriverWakeLock();
        addLog("📄 Retour bfcache — WakeLock réacquis", "ok");
        if (driverWatchRef.current === null) {
          driverWatchRef.current = navigator.geolocation.watchPosition((pos) => pushGps(pos.coords), handleError, {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 15000,
          });
        }
      }
    };

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
        addLog("⏱ Timeout GPS — retry dans 8s", "warn");
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
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityFlush);

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
    startSilentAudio();

    let _bgTick = 0;
    if (bgKeepaliveRef.current != null) clearInterval(bgKeepaliveRef.current);
    bgKeepaliveRef.current = setInterval(() => {
      _bgTick++;
    }, 1000);

    if (driverHeartbeatRef.current) clearInterval(driverHeartbeatRef.current);
    let _heartbeatTick = 0;
    driverHeartbeatRef.current = setInterval(async () => {
      _heartbeatTick++;
      try {
        await sendHeartbeat();
        setDriverDebug((prev) => ({ ...prev, heartbeatAge: 0 }));
      } catch {
        addLog("⚠️ Heartbeat échoué", "warn");
      }
      setDriverDebug((prev) => ({ ...prev, heartbeatAge: prev.heartbeatAge !== null ? prev.heartbeatAge + 5 : 0 }));
      if (_heartbeatTick % 4 === 0 && driverGpsActiveRef.current) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const silentMs = driverLastSignalAtRef.current ? Date.now() - driverLastSignalAtRef.current : 0;
            if (silentMs > 10_000) {
              addLog("📍 Position forcée (heartbeat 20s)", "ok");
              pushGps(pos.coords);
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
        );
      }
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
    isDriver,
    driverGpsActive,
    addLog,
    requestDriverWakeLock,
    releaseDriverWakeLock,
    startSilentAudio,
    stopSilentAudio,
  ]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || !driverGpsActiveRef.current) return;
      requestDriverWakeLock();
      addLog("👁 Retour au premier plan — GPS vérifié", "ok");
      if (driverWatchRef.current === null) {
        if (!driverRestartingRef.current) {
          driverRestartingRef.current = true;
          driverLastSignalAtRef.current = Date.now();
          driverWatchRef.current = navigator.geolocation.watchPosition(
            (pos) => pushGpsRef.current?.(pos.coords),
            (e) => handleErrorRef.current?.(e),
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
          );
          driverRestartingRef.current = false;
        }
      } else {
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
        driverWatchRef.current = navigator.geolocation.watchPosition(
          (pos) => pushGpsRef.current?.(pos.coords),
          (e) => handleErrorRef.current?.(e),
          { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
        );
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

  // ── invalidateSize + refit dès que le loading se termine ─────────────────
  // Bug fix : pendant `loading=true`, le conteneur de la carte a
  // `visibility:hidden` → sa taille mesurée par Leaflet peut être 0x0 (ou
  // incorrecte) au moment où drawTripRoute() a appelé fitBounds(). Le tracé
  // et les icônes sont bien ajoutés à la carte, mais la vue (zoom/centre)
  // reste celle calculée sur un conteneur de taille nulle → rien de visible
  // tant qu'on ne pan/zoom pas manuellement. On corrige la taille ET on
  // recalcule la vue une fois le conteneur réellement visible.
  useEffect(() => {
    if (loading || !mapInst.current) return;
    const L = (window as any).L;
    const map = mapInst.current;
    const refit = () => {
      map.invalidateSize({ animate: false });
      if (!L) return;
      const bounds: any[] = [];
      if (fromMarker.current) bounds.push(fromMarker.current.getLatLng());
      if (toMarker.current) bounds.push(toMarker.current.getLatLng());
      const driverPos = markerRef.current?.getLatLng();
      if (driverPos) bounds.push(L.latLngBounds([driverPos, driverPos]));
      if (bounds.length === 0) return;
      try {
        let combined = bounds[0];
        for (let i = 1; i < bounds.length; i++) combined = combined.extend(bounds[i]);
        map.fitBounds(combined.pad(0.2), { animate: false });
      } catch {}
    };
    const t1 = setTimeout(refit, 50);
    const t2 = setTimeout(refit, 250);
    const t3 = setTimeout(refit, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
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
    arrived: { label: "Taxi à votre porte", color: "#f5c842", bg: "rgba(245,200,66,0.12)", icon: "📍", pulse: true },
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
    cancelled: { label: "Course annulée", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "❌", pulse: false },
    refused: { label: "Course refusée", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "🚫", pulse: false },
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
    return `${Math.floor(ageSec / 60)}m ${ageSec % 60}s`;
  };
  const diagnosticColor = (() => {
    const ageMs = trackingDiag.lastHeartbeatAt ? Date.now() - trackingDiag.lastHeartbeatAt.getTime() : Infinity;
    if (trackingDiag.stopReason.startsWith("Aucun arrêt") && ageMs < 30000) return "#22c55e";
    if (ageMs < 120000) return "#f59e0b";
    return "#ef4444";
  })();
  // [FUSION] calcul barre de progression (depuis tracking)
  const kmLeft = etaKm ? parseFloat(etaKm) : null;
  const pctDone =
    totalKm && kmLeft !== null ? Math.min(100, Math.max(0, Math.round(((totalKm - kmLeft) / totalKm) * 100))) : null;

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
        <p style={{ fontSize: 12, color: "#64748b", maxWidth: 300, textAlign: "center", marginTop: 4 }}>
          La connexion prend plus de temps que prévu…
        </p>
      )}
      {elapsed > 30 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 6 }}>
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
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 22, color: "#f8fafc", margin: 0 }}>
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
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#334155", marginTop: 12 }}>
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
        .typo-label   { font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; }
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
      <div style={{ flex: 1, position: "relative", minHeight: 0, visibility: loading || error ? "hidden" : "visible" }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Bouton recentrer */}
        {userPanned && taxiPos && (
          <button
            onClick={recenterOnDriver}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 1000,
              background: "rgba(10,10,20,0.9)",
              border: "1px solid rgba(245,200,66,0.4)",
              color: "#f5c842",
              borderRadius: 12,
              padding: "10px 16px",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              minHeight: 44,
            }}
          >
            🎯 Recentrer
          </button>
        )}

        {/* Indicateur last update */}
        {lastUpdate && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 1000,
              background: "rgba(10,10,20,0.75)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 10,
              padding: "5px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#64748b" }}>
              {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        )}

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

          {/* ── BANDEAU D'ÉTAPES (remplace les notifs push client) ── */}
          {(() => {
            const STEPS: { key: string; label: string; icon: string }[] = [
              { key: "pending", label: "Réservée", icon: "📝" },
              { key: "accepted", label: "Confirmée", icon: "✅" },
              { key: "en_route", label: "En route", icon: "🚕" },
              { key: "arrived", label: "Sur place", icon: "📍" },
              { key: "completed", label: "Terminée", icon: "🏁" },
            ];
            const norm = (s: string) => (s === "nouvelle" ? "pending" : s === "terminee" ? "completed" : s);
            const current = norm(effectiveStatus);
            const cancelled = ["cancelled", "refused"].includes(current);
            const currentIdx = cancelled
              ? -1
              : Math.max(
                  0,
                  STEPS.findIndex((s) => s.key === current),
                );
            return (
              <div style={{ padding: "0 16px 14px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                    padding: "12px 10px",
                    background: cancelled ? "rgba(239,68,68,0.08)" : "rgba(245,200,66,0.06)",
                    border: `1px solid ${cancelled ? "rgba(239,68,68,0.25)" : "rgba(245,200,66,0.20)"}`,
                    borderRadius: 16,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={STEPS.length - 1}
                  aria-valuenow={currentIdx}
                  aria-label="Étape de la course"
                >
                  {cancelled ? (
                    <div
                      style={{
                        width: "100%",
                        textAlign: "center",
                        color: "#ef4444",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      ❌ Course {current === "refused" ? "refusée" : "annulée"}
                    </div>
                  ) : (
                    STEPS.map((s, i) => {
                      const done = i < currentIdx;
                      const active = i === currentIdx;
                      const color = done ? "#22c55e" : active ? "#f5c842" : "#475569";
                      return (
                        <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: active
                                  ? "rgba(245,200,66,0.18)"
                                  : done
                                    ? "rgba(34,197,94,0.18)"
                                    : "rgba(71,85,105,0.18)",
                                border: `1.5px solid ${color}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 13,
                                color,
                                fontWeight: 700,
                                animation: active ? "pulse 2s ease-in-out infinite" : "none",
                              }}
                            >
                              {done ? "✓" : s.icon}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color,
                                marginTop: 4,
                                fontWeight: active ? 700 : 500,
                                textAlign: "center",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {s.label}
                            </div>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div
                              style={{
                                flex: "0 0 14px",
                                height: 2,
                                background: i < currentIdx ? "#22c55e" : "#334155",
                                marginTop: -14,
                                borderRadius: 2,
                              }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

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
                {eta !== null && taxiPos && !courseTerminee && (
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
                {!taxiPos && !courseTerminee && (
                  <div className="typo-body" style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    ⏳ En attente de la position GPS du chauffeur…
                  </div>
                )}
              </div>
              {taxiPos && (
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

          {/* ── PANNEAU GPS TAXI — chauffeur (interactif) + client (lecture seule) ── */}
          {(isDriver || taxiPos) && (
            <div style={{ padding: "0 20px 12px" }}>
              <div
                style={{
                  background: taxiPos ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.035)",
                  border: `1px solid ${taxiPos ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 16,
                  padding: "14px 16px",
                  pointerEvents: isDriver ? "auto" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: taxiPos ? 10 : 0 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: taxiPos ? "#22c55e" : "#475569",
                      flexShrink: 0,
                      boxShadow: taxiPos ? "0 0 0 3px rgba(34,197,94,0.2)" : "none",
                      animation: taxiPos ? "pulse 2s ease-in-out infinite" : "none",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 13,
                      color: taxiPos ? "#22c55e" : "#475569",
                      flex: 1,
                    }}
                  >
                    {taxiPos ? "🛰 GPS actif" : "📡 En attente GPS chauffeur"}
                  </span>
                  {isDriver && (
                    <button
                      disabled={!["en_route", "accepted", "arrived"].includes(effectiveStatus) && !driverGpsActive}
                      title={
                        !["en_route", "accepted", "arrived"].includes(effectiveStatus) && !driverGpsActive
                          ? "⛔ En attente de validation admin"
                          : ""
                      }
                      onClick={() => {
                        if (!["en_route", "accepted", "arrived"].includes(effectiveStatus) && !driverGpsActive) {
                          toast.error("⛔ Course non encore validée par l'admin");
                          return;
                        }
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
                        cursor:
                          !["en_route", "accepted", "arrived"].includes(effectiveStatus) && !driverGpsActive
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          !["en_route", "accepted", "arrived"].includes(effectiveStatus) && !driverGpsActive ? 0.45 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {driverGpsActive ? "⬛ Couper" : "▶ Activer"}
                    </button>
                  )}
                </div>
                {taxiPos && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { label: "LAT", value: taxiPos.lat.toFixed(4), color: "#e2e8f0" },
                      { label: "LNG", value: taxiPos.lng.toFixed(4), color: "#e2e8f0" },
                      {
                        label: "PRÉCISION",
                        value: driverDebug.accuracy !== null ? `±${Math.round(driverDebug.accuracy)}m` : "—",
                        color: driverDebug.accuracy !== null && driverDebug.accuracy > 50 ? "#f59e0b" : "#22c55e",
                      },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "7px 10px" }}
                      >
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
                {taxiPos && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#475569", fontFamily: "'DM Sans',sans-serif" }}>
                    {driverDebug.signalsSent > 0 ? `${driverDebug.signalsSent} màj · ` : ""}âge{" "}
                    {formatDiagnosticAge(trackingDiag.lastPositionAt)}
                  </div>
                )}
                {isDriver && driverGpsActive && (
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
          )}

          <div style={{ padding: "0 20px 4px" }}>
            {/* [FUSION] Barre de progression départ→destination (depuis tracking) */}
            {resa.depart && (resa.destination || resa.arrivee) && (
              <div
                style={{
                  marginBottom: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "16px 16px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🟢</span>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🏁</span>
                </div>
                <div
                  style={{
                    position: "relative",
                    height: 6,
                    borderRadius: 3,
                    overflow: "visible",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: pctDone !== null ? `${pctDone}%` : "0%",
                      background: "#f5c842",
                      borderRadius: 3,
                      transition: "width 0.6s ease",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: pctDone !== null ? `${pctDone}%` : "0%",
                      transform: "translate(-50%, -50%)",
                      transition: "left 0.6s ease",
                      zIndex: 2,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "#f5c842",
                      border: "2px solid #08080f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(245,200,66,0.45)",
                    }}
                  >
                    <img
                      src={TAXI_ICON_URI}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                      alt="taxi"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
                      color: "#475569",
                      maxWidth: "45%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {resa.depart}
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
                      color: "#475569",
                      maxWidth: "45%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                    }}
                  >
                    {resa.destination || resa.arrivee}
                  </span>
                </div>
                {pctDone !== null && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#f5c842" }}>
                      {pctDone}% parcouru · {etaKm} km restants
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIONS CHAUFFEUR — interactif pour José, lecture seule pour le client ── */}
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
                  pointerEvents: isDriver ? "auto" : "none",
                  opacity: isDriver ? 1 : 0.85,
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 10,
                    color: "#f8fafc",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {isDriver ? "Actions chauffeur" : "Étapes de votre course"}
                </div>

                <button
                  type="button"
                  disabled={
                    !isDriver ||
                    statusBusy !== null ||
                    ["en_route", "arrived", "completed", "terminee"].includes(effectiveStatus) ||
                    !["accepted", "en_route"].includes(effectiveStatus)
                  }
                  onClick={async () => {
                    if (!isDriver || !resaIdRef.current) return;
                    if (!["accepted", "en_route"].includes(effectiveStatus)) {
                      toast.error("⛔ Course non encore validée par l'admin");
                      return;
                    }
                    setStatusBusy("en_route");
                    try {
                      const result = await notifyStatusFn({
                        data: {
                          reservation_id: resaIdRef.current,
                          status: "en_route",
                          update_status: true,
                          suivi_key: id,
                        },
                      });
                      setResa((prev) => (prev ? { ...prev, status: "en_route" } : prev));
                      const pushSent = (result as any)?.client?.sent ?? 0;
                      toast.success(
                        pushSent > 0
                          ? "🚗 Notification envoyée au client"
                          : "🚗 Statut mis à jour — aucune souscription client active",
                      );
                    } catch (err) {
                      console.error(err);
                      toast.error("Échec envoi: " + ((err as any)?.message ?? String(err)));
                    } finally {
                      setStatusBusy(null);
                    }
                  }}
                  title={
                    !isDriver
                      ? "Action réservée au chauffeur"
                      : !["accepted", "en_route"].includes(effectiveStatus)
                        ? "⛔ En attente de validation admin"
                        : ""
                  }
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: ["en_route", "arrived", "completed", "terminee"].includes(effectiveStatus)
                      ? "rgba(59,130,246,0.18)"
                      : "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.4)",
                    color: "#60a5fa",
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor:
                      isDriver &&
                      ["accepted", "en_route"].includes(effectiveStatus) &&
                      !["en_route", "arrived", "completed", "terminee"].includes(effectiveStatus)
                        ? "pointer"
                        : "not-allowed",
                    opacity: isDriver && effectiveStatus === "accepted" ? 1 : 0.45,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {statusBusy === "en_route"
                    ? "Envoi…"
                    : ["en_route", "arrived", "completed", "terminee"].includes(effectiveStatus)
                      ? "✅ Chauffeur en route"
                      : "🚗 Je suis en route"}
                </button>

                <button
                  type="button"
                  disabled={
                    !isDriver ||
                    statusBusy !== null ||
                    ["arrived", "completed", "terminee"].includes(effectiveStatus) ||
                    !["en_route", "accepted", "arrived"].includes(effectiveStatus)
                  }
                  onClick={async () => {
                    if (!isDriver || !resaIdRef.current) return;
                    if (!["en_route", "accepted", "arrived"].includes(effectiveStatus)) {
                      toast.error("⛔ Course non encore validée par l'admin");
                      return;
                    }
                    setStatusBusy("arrived");
                    try {
                      const result = await notifyStatusFn({
                        data: {
                          reservation_id: resaIdRef.current,
                          status: "arrived",
                          update_status: true,
                          suivi_key: id,
                        },
                      });
                      setResa((prev) => (prev ? { ...prev, status: "arrived" } : prev));
                      const pushSent = (result as any)?.client?.sent ?? 0;
                      toast.success(
                        pushSent > 0
                          ? "📍 Notification envoyée au client"
                          : "📍 Statut mis à jour — aucune souscription client active",
                      );
                    } catch (err) {
                      console.error(err);
                      toast.error("Échec envoi: " + ((err as any)?.message ?? String(err)));
                    } finally {
                      setStatusBusy(null);
                    }
                  }}
                  title={
                    !isDriver
                      ? "Action réservée au chauffeur"
                      : !["en_route", "accepted", "arrived"].includes(effectiveStatus)
                        ? "⛔ En attente de validation admin"
                        : ""
                  }
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: ["arrived", "completed", "terminee"].includes(effectiveStatus)
                      ? "rgba(34,197,94,0.18)"
                      : "rgba(245,200,66,0.14)",
                    border: `1px solid ${["arrived", "completed", "terminee"].includes(effectiveStatus) ? "rgba(34,197,94,0.4)" : "rgba(245,200,66,0.4)"}`,
                    color: ["arrived", "completed", "terminee"].includes(effectiveStatus) ? "#22c55e" : "#f5c842",
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor:
                      isDriver && ["en_route", "accepted", "arrived"].includes(effectiveStatus)
                        ? "pointer"
                        : "not-allowed",
                    opacity: isDriver && ["en_route", "accepted", "arrived"].includes(effectiveStatus) ? 1 : 0.45,
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
                  disabled={
                    !isDriver ||
                    statusBusy !== null ||
                    courseTerminee ||
                    !["en_route", "accepted", "arrived"].includes(effectiveStatus)
                  }
                  onClick={async () => {
                    if (!isDriver || !resaIdRef.current) return;
                    if (!["en_route", "accepted", "arrived"].includes(effectiveStatus)) {
                      toast.error("⛔ Course non encore validée par l'admin");
                      return;
                    }
                    if (!window.confirm("Confirmer la fin de la course ?")) return;
                    setStatusBusy("completed");
                    try {
                      await notifyStatusFn({
                        data: {
                          reservation_id: resaIdRef.current,
                          status: "completed",
                          update_status: true,
                          suivi_key: id,
                        },
                      });
                      setCourseTerminee(true);
                      setResa((prev) => (prev ? { ...prev, status: "completed" } : prev));
                      setDriverGpsActive(false);
                      toast.success("🏁 Course terminée");

                      // ── Chercher la prochaine course acceptée ──────────────
                      const { data: nextResa } = await supabase
                        .from("reservations")
                        .select("id, suivi_id, tracking_id, pickup_datetime")
                        .eq("status", "accepted")
                        .order("pickup_datetime", { ascending: true })
                        .limit(1)
                        .maybeSingle();

                      setTimeout(() => {
                        if (nextResa) {
                          const nextSuiviId = nextResa.suivi_id || nextResa.tracking_id || nextResa.id;
                          toast.info("🚕 Prochaine course chargée");
                          navigate({ to: "/suivi/$id", params: { id: nextSuiviId } });
                        } else {
                          navigate({ to: "/admin/dashboard" });
                        }
                      }, 800);
                    } catch (err) {
                      console.error(err);
                      toast.error("Échec de la mise à jour");
                    } finally {
                      setStatusBusy(null);
                    }
                  }}
                  title={
                    !isDriver
                      ? "Action réservée au chauffeur"
                      : !["en_route", "accepted", "arrived"].includes(effectiveStatus)
                        ? "⛔ En attente de validation admin"
                        : ""
                  }
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
                    cursor:
                      isDriver && ["en_route", "accepted", "arrived"].includes(effectiveStatus)
                        ? "pointer"
                        : "not-allowed",
                    opacity: isDriver && ["en_route", "accepted", "arrived"].includes(effectiveStatus) ? 1 : 0.45,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {statusBusy === "completed" ? "Envoi…" : "🏁 Course terminée"}
                </button>

                {!isDriver && (
                  <div
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 10,
                      color: "#475569",
                      textAlign: "center",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    🔒 Contrôlé par votre chauffeur
                  </div>
                )}

                {isDriver && !["en_route", "accepted", "arrived"].includes(effectiveStatus) && (
                  <div
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 11,
                      color: "#f59e0b",
                      textAlign: "center",
                      marginTop: 2,
                      padding: "6px 10px",
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: 10,
                    }}
                  >
                    ⏳ En attente de validation par l'admin — les boutons seront actifs dès que la course est confirmée.
                  </div>
                )}

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
                      color: "#f8fafc",
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
                      color: "#f8fafc",
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
                      ⏱ {eta} min{etaKm && <span style={{ color: "#475569" }}> · {etaKm} km restants</span>}
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
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  flexShrink: 0,
                  overflow: "hidden",
                  border: "2px solid rgba(245,200,66,0.3)",
                }}
              >
                <img src={TAXI_ICON_URI} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="taxi" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="typo-title" style={{ fontSize: 18, color: "#f1f5f9" }}>
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
                <div className="typo-label" style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 4 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
                    }}
                  />
                  <div style={{ width: 2, flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 1 }} />
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
                    <div className="typo-label" style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>
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
                    <div className="typo-label" style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>
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
                  <div className="typo-label" style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>
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
                    <div className="typo-label" style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>
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
                  <div className="typo-label" style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>
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
                  <div className="typo-label" style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>
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
                    <div className="typo-label" style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>
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
                const formatted = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
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
                <span style={{ display: "inline-block", animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
                  {refreshing ? "⏳" : "🔄"}
                </span>{" "}
                Rafraîchir
              </button>
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
