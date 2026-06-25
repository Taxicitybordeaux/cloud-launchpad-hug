import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Calendar,
  MapPin,
  ArrowRight,
  Clock,
  Phone,
  MessageCircle,
  Eye,
  RotateCw,
  Plus,
  X,
  RotateCcw,
  Share2,
  Home,
  Car,
  UserCircle2,
  ChevronLeft,
} from "lucide-react";
import { shareRideTracking } from "@/lib/share-ride";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ClientPushOptInCard } from "@/components/ClientPushOptInCard";
import { BrandLoader } from "@/components/BrandLoader";
import { DirectChatPanel } from "@/components/DirectChatPanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { getClientSession, clearClientSession } from "@/lib/client-session";
import type { ClientSession } from "@/lib/client-auth.functions";
import {
  listClientReservations,
  updateReservationTime,
  cancelClientReservation,
  requestPhoneCancellation,
  type ClientReservation,
} from "@/lib/client-reservations.functions";
import { useI18n, useT } from "@/i18n/I18nProvider";
import logo from "@/assets/logo.jpeg";

const css = `
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  html, body {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
    overscroll-behavior-y: contain;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  input, textarea, select { font-size: 16px; }
  .cd-root {
    position: fixed; inset: 0;
    max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, #0a0a0a 0%, #111827 100%);
  }
  .cd-header {
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: rgba(10,10,10,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .cd-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 20px 16px 80px;
  }
  .cd-tabs {
    flex-shrink: 0;
    display: flex;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: rgba(10,10,10,0.95);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .cd-tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; padding: 10px 4px 8px;
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.35);
    font-size: 10px; font-weight: 600; letter-spacing: 0.03em;
    transition: color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .cd-tab.active { color: #E8C96D; }
  .cd-tab svg { width: 20px; height: 20px; }
`;

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Mon espace client — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f172a" },
    ],
  }),
  component: ClientDashboard,
});

const ACTIVE_STATUSES = new Set(["nouvelle", "pending", "accepted", "en_route", "arrived"]);
const CANCELLABLE = new Set(["nouvelle", "pending", "accepted"]);

const STATUS_META: Record<string, { key: string; bg: string; fg: string }> = {
  nouvelle: { key: "cd_status_pending", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  pending: { key: "cd_status_pending", bg: "rgba(234,179,8,0.15)", fg: "#facc15" },
  accepted: { key: "cd_status_accepted", bg: "rgba(34,197,94,0.15)", fg: "#4ade80" },
  en_route: { key: "cd_status_en_route", bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  arrived: { key: "cd_status_arrived", bg: "rgba(99,102,241,0.18)", fg: "#a5b4fc" },
  completed: { key: "cd_status_completed", bg: "rgba(148,163,184,0.18)", fg: "#cbd5e1" },
  cancelled: { key: "cd_status_cancelled", bg: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
  refused: { key: "cd_status_refused", bg: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
};

function fmtDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Onglet Accueil ──────────────────────────────────────────────────────────
function TabHome({
  session,
  rows,
  t,
}: {
  session: ClientSession;
  rows: ClientReservation[] | null;
  t: ReturnType<typeof useT>;
}) {
  const greeting = session.name?.split(" ")[0] || "vous";
  const activeRide = rows?.find((r) => ACTIVE_STATUSES.has(r.status));

  return (
    <div>
      {/* Halo décoratif */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />

      {/* Message de bienvenue */}
      <div style={{ position: "relative", marginBottom: 28 }}>
        <p
          style={{
            color: "#E8C96D",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            margin: "0 0 6px",
          }}
        >
          Espace client
        </p>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "0 0 16px", fontFamily: "'Syne', serif" }}>
          Bonjour {greeting} 👋
        </h1>
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "20px 18px",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.7, margin: "0 0 12px" }}>
            Bienvenue dans votre espace personnel Taxi City Bordeaux. Ici, vous pouvez suivre vos courses en temps réel,
            gérer vos réservations et contacter José directement.
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            José est disponible 7j/7 pour vous accompagner à l'aéroport, en gare ou pour tout déplacement dans la région
            bordelaise. 🚕
          </p>
        </div>
      </div>

      {/* Course active */}
      {activeRide && (
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              color: "#E8C96D",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Course en cours
          </p>
          <div
            style={{
              background: "rgba(232,201,109,0.08)",
              border: "1px solid rgba(232,201,109,0.25)",
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 20,
                  background: STATUS_META[activeRide.status]?.bg,
                  color: STATUS_META[activeRide.status]?.fg,
                }}
              >
                {STATUS_META[activeRide.status]?.key === "cd_status_pending"
                  ? "En attente"
                  : STATUS_META[activeRide.status]?.key === "cd_status_accepted"
                    ? "Confirmée"
                    : STATUS_META[activeRide.status]?.key === "cd_status_en_route"
                      ? "En route"
                      : STATUS_META[activeRide.status]?.key === "cd_status_arrived"
                        ? "Arrivé"
                        : activeRide.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#fff", marginBottom: 4 }}>
              {activeRide.depart} <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>{" "}
              {activeRide.arrivee || activeRide.destination}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              {fmtDate(activeRide.pickup_datetime, "fr-FR")}
            </div>
            {activeRide.suivi_id && (
              <Link
                to={`/suivi/${activeRide.suivi_id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#E8C96D",
                  textDecoration: "none",
                }}
              >
                <Eye style={{ width: 13, height: 13 }} /> Suivre en temps réel
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          to="/reserver"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 16px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          <Plus style={{ width: 16, height: 16 }} /> Réserver une course
        </Link>
        <a
          href="tel:0673072322"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          <Phone style={{ width: 16, height: 16 }} /> Appeler José
        </a>
      </div>

      {/* Push opt-in */}
      <div style={{ marginTop: 20 }}>
        <ClientPushOptInCard />
      </div>
    </div>
  );
}

// ── Onglet Mes courses ───────────────────────────────────────────────────────
function TabRides({
  session,
  rows,
  loading,
  t,
  locale,
  openId,
  setOpenId,
  editingId,
  setEditingId,
  editTime,
  setEditTime,
  busy,
  onSubmitNewTime,
  onCancel,
  onConfirmPhoneCancel,
  setPhoneModalId,
  recommander,
}: any) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Mes réservations
        </p>
        <Link
          to="/reserver"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 700,
            color: "#E8C96D",
            textDecoration: "none",
          }}
        >
          <Plus style={{ width: 13, height: 13 }} /> Nouvelle
        </Link>
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            color: "rgba(255,255,255,0.4)",
            gap: 10,
          }}
        >
          <BrandLoader size={20} /> Chargement…
        </div>
      )}

      {!loading && rows?.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚕</div>
          Aucune réservation pour l'instant
          <div style={{ marginTop: 16 }}>
            <Link
              to="/reserver"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                borderRadius: 10,
                background: "#E8C96D",
                color: "#000",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Réserver maintenant
            </Link>
          </div>
        </div>
      )}

      {!loading && rows && rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r: ClientReservation) => {
            const meta = STATUS_META[r.status];
            const status = {
              label: meta ? t(meta.key) : r.status,
              bg: meta?.bg || "rgba(255,255,255,0.08)",
              fg: meta?.fg || "#fff",
            };
            const isOpen = openId === r.id;
            const isActive = ACTIVE_STATUSES.has(r.status);
            const isCompleted = r.status === "completed";
            const dest = r.arrivee || r.destination || "—";

            return (
              <li
                key={r.id}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: "14px 14px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      <Calendar style={{ width: 13, height: 13 }} /> {fmtDate(r.pickup_datetime, locale)}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {r.source === "recurring" && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: "rgba(232,201,109,0.14)",
                            color: "#E8C96D",
                            border: "1px solid rgba(232,201,109,0.3)",
                          }}
                        >
                          🔁 Récurrent
                        </span>
                      )}
                      {r.phone_cancel_requested_at && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: "rgba(249,115,22,0.18)",
                            color: "#fdba74",
                          }}
                        >
                          {t("cd_phone_cancel_requested")}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: status.bg,
                          color: status.fg,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 13, color: "#fff" }}>
                    <MapPin style={{ width: 14, height: 14, color: "#E8C96D", marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1, lineHeight: 1.4 }}>
                      <span style={{ color: "rgba(255,255,255,0.88)" }}>{r.depart}</span>
                      <ArrowRight
                        style={{
                          display: "inline",
                          width: 12,
                          height: 12,
                          color: "rgba(255,255,255,0.3)",
                          margin: "0 5px",
                        }}
                      />
                      <span style={{ color: "rgba(255,255,255,0.88)" }}>{dest}</span>
                    </div>
                  </div>
                  {r.prix_estime != null && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      {t("cd_price_estimated")} :{" "}
                      <span style={{ fontWeight: 700, color: "#E8C96D" }}>{Number(r.prix_estime).toFixed(2)} €</span>
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {/* Liens suivi / partage */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 0" }}>
                      {r.suivi_id && (
                        <Link
                          to={`/suivi/${r.suivi_id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            padding: "7px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#fff",
                            textDecoration: "none",
                          }}
                        >
                          <Eye style={{ width: 12, height: 12 }} /> {t("cd_track")}
                        </Link>
                      )}
                      {r.suivi_id && (
                        <button
                          type="button"
                          onClick={() => shareRideTracking(r)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            padding: "7px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <Share2 style={{ width: 12, height: 12 }} /> {t("cd_share")}
                        </button>
                      )}
                    </div>

                    {editingId === r.id && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <input
                          type="datetime-local"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          style={{
                            flex: 1,
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.05)",
                            padding: "8px 10px",
                            fontSize: 13,
                            color: "#fff",
                          }}
                        />
                        <button
                          onClick={() => onSubmitNewTime(r.id)}
                          disabled={busy === r.id}
                          style={{
                            borderRadius: 8,
                            background: "#E8C96D",
                            padding: "8px 12px",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#000",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          {busy === r.id ? <BrandLoader size={14} /> : "✓"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {isActive && CANCELLABLE.has(r.status) && editingId !== r.id && (
                        <button
                          onClick={() => {
                            setEditingId(r.id);
                            setEditTime(toLocalInput(r.pickup_datetime));
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <Clock style={{ width: 13, height: 13 }} /> {t("cd_change_time")}
                        </button>
                      )}
                      {isActive && CANCELLABLE.has(r.status) && (
                        <button
                          onClick={() => onCancel(r.id)}
                          disabled={busy === r.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: "rgba(239,68,68,0.08)",
                            color: "#fca5a5",
                            cursor: "pointer",
                          }}
                        >
                          <X style={{ width: 13, height: 13 }} /> {t("cd_cancel")}
                        </button>
                      )}
                      {isCompleted && (
                        <>
                          <button
                            onClick={() => recommander(r)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "linear-gradient(135deg,#C9A84C,#E8C96D)",
                              color: "#000",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <RotateCw style={{ width: 13, height: 13 }} /> {t("cd_recommend")}
                          </button>
                          <Link
                            to="/reserver"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.1)",
                              background: "rgba(255,255,255,0.04)",
                              color: "#fff",
                              textDecoration: "none",
                            }}
                          >
                            <Plus style={{ width: 13, height: 13 }} /> {t("cd_new_ride")}
                          </Link>
                        </>
                      )}
                      {isActive && !r.phone_cancel_requested_at && (
                        <button
                          onClick={() => setPhoneModalId(r.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <Phone style={{ width: 13, height: 13 }} /> {t("cd_cancel_phone")}
                        </button>
                      )}
                      {isActive && r.phone_cancel_requested_at && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.35)",
                          }}
                        >
                          <Phone style={{ width: 13, height: 13 }} /> {t("cd_request_sent")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Onglet Profil ────────────────────────────────────────────────────────────
function TabProfile({
  session,
  logout,
  t,
}: {
  session: ClientSession;
  logout: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div>
      <p
        style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 20,
        }}
      >
        Mon profil
      </p>
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "20px 18px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#C9A84C,#E8C96D)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "#000",
            }}
          >
            {(session.name || "C")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{session.name || "Client"}</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>{session.email}</div>
          </div>
        </div>
        {session.phone && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 0",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Phone style={{ width: 14, height: 14, color: "#E8C96D" }} />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{session.phone}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          to="/reserver"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px",
            borderRadius: 14,
            background: "linear-gradient(135deg,#C9A84C,#E8C96D)",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          <Plus style={{ width: 16, height: 16 }} /> Nouvelle réservation
        </Link>
        <button
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px",
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.07)",
            color: "#fca5a5",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <LogOut style={{ width: 16, height: 16 }} /> Se déconnecter
        </button>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
function ClientDashboard() {
  const navigate = useNavigate();
  const t = useT();
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

  const [session, setSession] = useState<ClientSession | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<ClientReservation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"home" | "rides" | "chat" | "profile">("home");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [phoneModalId, setPhoneModalId] = useState<string | null>(null);
  const [phoneModalBusy, setPhoneModalBusy] = useState(false);

  useEffect(() => {
    const s = getClientSession();
    if (!s) {
      navigate({ to: "/client/login" });
      return;
    }
    setSession(s);
    setReady(true);
  }, [navigate]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await listClientReservations({
        data: { account_id: session.id, phone: session.phone, email: session.email },
      });
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error(t("cd_toast_load_err"));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  // Récurrents toast
  useEffect(() => {
    if (!rows || !session) return;
    const key = `tc:recurring-seen:${session.id}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {}
    const fresh = rows.filter(
      (r) =>
        r.source === "recurring" &&
        !seen.includes(r.id) &&
        ["pending", "accepted", "confirmed", "en_route"].includes(r.status),
    );
    if (fresh.length > 0) {
      for (const r of fresh)
        toast.success("🔁 Nouveau trajet récurrent confirmé", {
          description: `${fmtDate(r.pickup_datetime, locale)} — ${r.depart} → ${r.arrivee || r.destination || ""}`,
          duration: 8000,
        });
      localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((r) => r.id)].slice(-100)));
    }
  }, [rows, session, locale]);

  // Realtime
  useEffect(() => {
    if (!session || !rows || rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    const channel = supabase
      .channel("client-dashboard-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations", filter: `id=in.(${ids.join(",")})` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, rows, refresh]);

  function logout() {
    clearClientSession();
    navigate({ to: "/" });
  }

  async function onSubmitNewTime(id: string) {
    if (!session || !editTime) return;
    setBusy(id);
    try {
      await updateReservationTime({
        data: {
          account_id: session.id,
          phone: session.phone,
          email: session.email,
          reservation_id: id,
          pickup_datetime: new Date(editTime).toISOString(),
        },
      });
      toast.success(t("cd_toast_time_changed"));
      setEditingId(null);
      setEditTime("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message === "STATUS_LOCKED" ? t("cd_toast_locked_edit") : t("cd_toast_edit_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function onCancel(id: string) {
    if (!session) return;
    if (!confirm(t("cd_confirm_cancel"))) return;
    setBusy(id);
    try {
      await cancelClientReservation({
        data: { account_id: session.id, phone: session.phone, email: session.email, reservation_id: id },
      });
      toast.success(t("cd_toast_cancelled"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message === "STATUS_LOCKED" ? t("cd_toast_locked_cancel") : t("cd_toast_cancel_failed"));
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmPhoneCancel(id: string) {
    if (!session) return;
    setPhoneModalBusy(true);
    try {
      await requestPhoneCancellation({
        data: { account_id: session.id, phone: session.phone, email: session.email, reservation_id: id },
      });
      toast.success(t("cd_toast_phone_recorded"));
      setPhoneModalId(null);
      refresh();
      window.location.href = "tel:0673072322";
    } catch {
      toast.error(t("cd_toast_phone_failed"));
    } finally {
      setPhoneModalBusy(false);
    }
  }

  function recommander(r: ClientReservation) {
    const params = new URLSearchParams();
    if (r.depart) params.set("depart", r.depart);
    const dest = r.arrivee || r.destination || "";
    if (dest) params.set("destination", dest);
    params.set("passagers", String(r.nb_passagers ?? r.passagers ?? 1));
    params.set("bagages", String(r.bagages ?? 0));
    window.location.href = `/reserver?${params.toString()}`;
  }

  if (!ready || !session) return null;

  const TABS = [
    { id: "home", icon: <Home />, label: "Accueil" },
    { id: "rides", icon: <Car />, label: "Courses" },
    { id: "chat", icon: <MessageCircle />, label: "José" },
    { id: "profile", icon: <UserCircle2 />, label: "Profil" },
  ] as const;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="cd-root">
        {/* Header léger */}
        <div className="cd-header">
          <a href="/" style={{ display: "flex", alignItems: "center" }}>
            <img src={logo} alt="Taxi City Bordeaux" style={{ height: 36, borderRadius: 6 }} />
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LanguageSwitcher />
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <ChevronLeft style={{ width: 13, height: 13 }} /> Site
            </a>
          </div>
        </div>

        {/* Contenu de l'onglet actif */}
        <div className="cd-content">
          {tab === "home" && <TabHome session={session} rows={rows} t={t} />}
          {tab === "rides" && (
            <TabRides
              session={session}
              rows={rows}
              loading={loading}
              t={t}
              locale={locale}
              openId={openId}
              setOpenId={setOpenId}
              editingId={editingId}
              setEditingId={setEditingId}
              editTime={editTime}
              setEditTime={setEditTime}
              busy={busy}
              onSubmitNewTime={onSubmitNewTime}
              onCancel={onCancel}
              onConfirmPhoneCancel={onConfirmPhoneCancel}
              setPhoneModalId={setPhoneModalId}
              recommander={recommander}
            />
          )}
          {tab === "chat" && session && (
            <div>
              <p
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Message à José
              </p>
              <div
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.08)",
                  height: "calc(100vh - 200px)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <DirectChatPanel accountId={session.id} role="client" peerName="José 🚖" />
              </div>
            </div>
          )}
          {tab === "profile" && <TabProfile session={session} logout={logout} t={t} />}
        </div>

        {/* Barre d'onglets */}
        <div className="cd-tabs">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              className={`cd-tab${tab === tb.id ? " active" : ""}`}
              onClick={() => setTab(tb.id)}
            >
              {tb.icon}
              {tb.label}
            </button>
          ))}
        </div>

        {/* Modal annulation téléphone */}
        <AlertDialog open={!!phoneModalId} onOpenChange={(open) => !open && setPhoneModalId(null)}>
          <AlertDialogContent className="border-white/10 bg-[#111827]/95 text-white backdrop-blur">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">{t("cd_modal_title")}</AlertDialogTitle>
              <AlertDialogDescription className="text-white/60">
                {t("cd_modal_desc_before")} <span className="font-semibold text-[#E8C96D]">06 73 07 23 22</span>{" "}
                {t("cd_modal_desc_after")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setPhoneModalId(null)}
                className="border-white/10 bg-transparent text-white hover:bg-white/5"
              >
                {t("cd_back")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => phoneModalId && onConfirmPhoneCancel(phoneModalId)}
                disabled={phoneModalBusy}
                className="text-black"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
              >
                {phoneModalBusy ? <BrandLoader size={16} /> : <Phone className="mr-1 h-3.5 w-3.5" />}
                {t("cd_confirm_and_call")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
