import { createFileRoute } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMapsWhenVisible } from "@/lib/googleMaps";
import { geocodeAddress } from "@/lib/googleGeocode";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useServerFn } from "@tanstack/react-start";
import { listPushFailures, notifyReservationStatus } from "@/lib/push.functions";
import { calculerPrixMixte, estTarifJourParis, parseAsParisTime, TARIFS } from "@/lib/tarif";
import { broadcastSuiviUpdate } from "@/lib/suivi-broadcast";
import { subscribeChatBadgeEvents, type ChatBadgeEvent } from "@/lib/chat-badge-sync";
import { ChatPanel } from "@/components/ChatPanel";
import { InlineDriverChat } from "@/components/InlineDriverChat";
import siteLogo from "@/assets/tcb-logo-badge.png";
import {
  listReservationsWithUnreadChauffeur,
  getUnreadCountsForReservations,
  type UnreadMap,
} from "@/lib/chat.functions";

// ── Token guard ────────────────────────────────────────────────────────────
const DRIVER_TOKEN = "DSF234";

// ── Types ─────────────────────────────────────────────────────────────────
type Tab = "courses" | "planning" | "avis" | "clients" | "stats" | "simulateur";
type Screen = "dashboard" | Tab;

// (ChatRealtimeStatusPill retiré : plus de canal Realtime global à surveiller.)

interface Resa {
  id: string;
  depart: string;
  destination: string;
  date_heure: string;
  pickup_datetime: string;
  status: string;
  prix_estime?: number | null;
  distance_km?: number | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  email?: string | null;
  suivi_id?: string | null;
  message?: string | null;
}

interface Avis {
  id: string;
  author_name: string;
  note: number;
  commentaire: string | null;
  created_at: string;
  status: string;
}

interface ClientAgg {
  id?: string;
  phone: string;
  email?: string | null;
  name: string;
  nbCourses: number;
  totalDepense: number;
  derniereCourse: string;
  derniereDepart: string;
  derniereDestination: string;
}

interface RouteOption {
  index: number;
  summary: string;
  distanceKm: number;
  dureeMin: number;
  prix_estime: number;
  tarifLabel: string;
  legs: any[];
  overview_polyline: string;
  dirResult: any;
  originLatLng: { lat: number; lng: number };
  destLatLng: { lat: number; lng: number };
  waypointLatLng: { lat: number; lng: number } | null;
}

// ── Route definition ───────────────────────────────────────────────────────
export const Route = createFileRoute("/driver")({
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s.token ?? "") }),
  head: () => ({
    meta: [
      { title: "Espace taxi — Taxi City Bordeaux" },
      { name: "description", content: "Espace taxi privé de Taxi City Bordeaux." },
      { property: "og:title", content: "Espace taxi — Taxi City Bordeaux" },
      { property: "og:description", content: "Espace taxi privé de Taxi City Bordeaux." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#03070d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Taxi City Bordeaux" },
    ],
    links: [{ rel: "manifest", href: "/api/manifest?role=driver" }],
  }),
  component: DriverPage,
});

// ── Styles : charte Taxi City Bordeaux (fond nuit, or, rangées du tableau de bord) ─────
const css = `
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  html, body {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
    overscroll-behavior-y: none; background: #03070d;
    font-family: 'DM Sans', sans-serif;
  }
  input, textarea, select { font-size: 16px; }

  /* ── Coque (même palette que Taxi City Bordeaux) ── */
  .drv-root {
    position: fixed; inset: 0;
    max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column;
    background: #03070d; color: #f6f0e5; overflow-x: hidden;
  }
  .drv-header {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; row-gap: 8px; flex-shrink: 0;
    padding: max(calc(env(safe-area-inset-top, 0px) + 10px), 54px) calc(env(safe-area-inset-right, 0px) + 14px) 10px calc(env(safe-area-inset-left, 0px) + 14px);
    background: linear-gradient(180deg, #0a1118, #050a10);
    border-bottom: 1px solid rgba(201,155,74,.35);
  }
  .drv-brand-mark {
    display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
    width: 48px; height: 48px; margin-right: 2px; overflow: hidden;
    border: 1px solid rgba(201,155,74,.42); border-radius: 8px;
    background: #050a10;
  }
  .drv-brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .drv-header-title { display: flex; flex-direction: column; min-width: 0; flex: 1; margin-right: 0; }
  .drv-header-title strong { color: #f6f0e5; font-size: 14px; font-weight: 700; line-height: 1.2; }
  .drv-header-title span { color: rgba(246,240,229,.55); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
  .drv-header-datetime {
    display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto;
    color: rgba(246,240,229,.55); font-size: 11px; line-height: 1.25;
  }
  .drv-header-datetime strong { color: #f6f0e5; font-size: 12px; font-weight: 700; text-transform: capitalize; }
  .drv-header-notif {
    display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto;
    border: 1px solid #c99b4a; border-radius: 999px; padding: 7px 12px;
    background: linear-gradient(180deg, #0a1118, #050a10); color: #e0b866;
    font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; font-family: inherit;
  }
  .drv-header-notif svg { width: 15px; height: 15px; }
  .drv-header-notif:disabled { opacity: .6; }
  .drv-header-back {
    display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; color: #e0b866; text-decoration: none;
    background: none; border: 1px solid rgba(201,155,74,.5); border-radius: 999px; padding: 7px 12px;
    font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .drv-header-back svg { width: 15px; height: 15px; }
  @media (max-width: 600px) { .drv-header-datetime { display: none !important; } }
  @media (max-width: 520px) {
    .drv-header-notif span.drv-header-notif-label { display: none; }
    .drv-header-notif { padding: 7px; }
    .drv-header-back span.drv-header-back-label { display: none; }
    .drv-header-back { padding: 7px; }
  }
  @media (max-width: 430px) { .drv-header-title { display: none !important; } }

  .drv-body {
    flex: 1; padding: 16px; max-width: 100%; overflow-x: hidden;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
    padding-left: calc(env(safe-area-inset-left, 0px) + 16px);
    padding-right: calc(env(safe-area-inset-right, 0px) + 16px);
    overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain;
  }

  /* ── Tableau de bord : rangées Taxi City Bordeaux ── */
  .drv-dash-title { margin: 8px 0 0; font-size: 24px; line-height: 32px; font-weight: 600; color: #f6f0e5; }
  .drv-dash-back {
    display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px;
    color: #e0b866; background: none; border: 1px solid rgba(201,155,74,.5); border-radius: 999px;
    padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  .drv-dash-back svg { width: 15px; height: 15px; }
  .drv-dash-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 20px; }
  .drv-dash-row {
    width: 100%; display: flex; align-items: center; gap: 14px; text-align: left; cursor: pointer;
    border: 1px solid rgba(246,240,229,.12); border-radius: 16px; background: rgba(255,255,255,.03);
    padding: 14px 16px; min-height: 64px; color: inherit; font-family: inherit;
  }
  .drv-dash-row:active { background: rgba(255,255,255,.06); }
  .drv-dash-ico {
    flex: 0 0 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    color: #0a1118;
  }
  .drv-dash-ico svg { width: 18px; height: 18px; }
  .drv-dash-txt { min-width: 0; flex: 1; }
  .drv-dash-txt strong { display: block; font-size: 14px; font-weight: 700; }
  .drv-dash-txt span { display: block; font-size: 12px; color: rgba(246,240,229,.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .drv-dash-plus { font-size: 20px; color: rgba(246,240,229,.45); }
  .drv-dash-badge {
    min-width: 20px; height: 20px; border-radius: 10px; background: #e11d48; color: #fff;
    font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 6px;
  }
  .drv-dash-map { margin-top: 14px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(246,240,229,.12); }

  /* ── Contenu des écrans (Courses, Calendrier, Avis…) : même charte que les rangées ── */
  .drv-root { color-scheme: dark; }
  .drv-sheet { color: #f6f0e5; }
  .drv-root input:not([type=checkbox]):not([type=radio]):not([type=range]), .drv-root textarea, .drv-root select {
    background: rgba(0,0,0,.28); color: #f6f0e5; border: 1px solid rgba(246,240,229,.2); border-radius: 10px; font-family: inherit;
  }
  .drv-root input::placeholder, .drv-root textarea::placeholder { color: rgba(246,240,229,.4); }
  .drv-section { font-size: 10px; font-weight: 700; color: #c99b4a; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 10px; }
  .drv-card { background: rgba(255,255,255,.03); border: 1px solid rgba(246,240,229,.12); border-radius: 16px; padding: 14px; margin-bottom: 10px; }
  .drv-card.pending { border-color: #e0b866; }
  .drv-card.new { border-color: #3b82f6; box-shadow: 0 0 0 3px #3b82f620; }
  .drv-card.done { opacity: 0.5; }
  .drv-card.accepted { border-color: #22c55e; }
  .drv-card.refused { border-color: #ef4444; opacity: 0.6; }
  .drv-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .drv-time { font-size: 22px; font-weight: 800; color: #f6f0e5; }
  .drv-name { font-size: 14px; font-weight: 600; color: #f6f0e5; }
  .drv-sub { font-size: 12px; color: rgba(246,240,229,.6); }
  .drv-route { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
  .drv-route span { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; color: rgba(246,240,229,.85); line-height: 1.4; }
  .drv-meta { display: flex; gap: 12px; font-size: 12px; color: rgba(246,240,229,.6); margin: 8px 0 12px; flex-wrap: wrap; }
  .drv-meta span { display: flex; align-items: center; gap: 4px; }
  .drv-btns { display: flex; gap: 8px; }
  .drv-btn-primary { flex: 1; min-height: 46px; background: linear-gradient(180deg,#e0b866,#c99b4a); color: #0a1118; border: 0; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 800; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .drv-btn-primary:active { filter: brightness(.94); }
  .drv-btn-secondary { flex: 1; min-height: 46px; background: transparent; color: rgba(246,240,229,.85); border: 1px solid rgba(246,240,229,.3); border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .drv-btn-secondary:active { background: rgba(255,255,255,.06); }
  .drv-btn-danger { flex: 1; min-height: 46px; background: rgba(239,68,68,.12); color: #fca5a5; border: 1px solid rgba(239,68,68,.4); border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .drv-btn-danger:active { background: rgba(239,68,68,.2); }
  .drv-badge-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 99px; }
  .drv-badge-blue { background: rgba(37,99,235,.18); color: #93c5fd; }
  .drv-badge-green { background: rgba(34,197,94,.16); color: #86efac; }
  .drv-badge-amber { background: rgba(245,158,11,.16); color: #fcd34d; }
  .drv-badge-red { background: rgba(239,68,68,.16); color: #fca5a5; }
  .drv-badge-gray { background: rgba(246,240,229,.08); color: rgba(246,240,229,.7); }
  .drv-stars { color: #f59e0b; font-size: 15px; letter-spacing: 1px; }
  .drv-stars-empty { color: rgba(246,240,229,.2); font-size: 15px; }
  .drv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .drv-stat { background: rgba(255,255,255,.03); border: 1px solid rgba(246,240,229,.12); border-radius: 16px; padding: 14px; }
  .drv-stat-lbl { font-size: 11px; color: rgba(246,240,229,.6); margin-bottom: 4px; }
  .drv-stat-val { font-size: 24px; font-weight: 800; color: #f6f0e5; }
  .drv-stat-sub { font-size: 11px; color: rgba(246,240,229,.5); margin-top: 2px; }
  .drv-empty { text-align: center; padding: 50px 20px; color: rgba(246,240,229,.5); }
  .drv-empty svg { width: 40px; height: 40px; margin-bottom: 10px; opacity: 0.4; }
  .drv-route-opt { border: 1.5px solid rgba(246,240,229,.12); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.15s; min-height: 44px; }
  .drv-route-opt:active { background: rgba(255,255,255,.05); }
  .drv-route-opt.selected { border-color: #e0b866; background: rgba(224,184,102,.08); }
  .drv-route-opt-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .drv-route-label { font-size: 13px; font-weight: 700; color: #f6f0e5; }
  .drv-route-price { font-size: 16px; font-weight: 800; color: #e0b866; }
  .drv-route-meta { display: flex; gap: 10px; font-size: 12px; color: rgba(246,240,229,.6); }
  .drv-map { width: 100%; height: 200px; border-radius: 16px; overflow: hidden; margin-bottom: 14px; border: 1px solid rgba(246,240,229,.12); touch-action: pan-x pan-y; }
  .drv-divider { border: none; border-top: 1px solid rgba(246,240,229,.1); margin: 16px 0; }
  .drv-planning-slot { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
  .drv-planning-time { font-size: 12px; color: rgba(246,240,229,.6); min-width: 40px; padding-top: 3px; }
  .drv-planning-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
  .drv-planning-card { flex: 1; background: rgba(255,255,255,.03); border: 1px solid rgba(246,240,229,.12); border-radius: 16px; padding: 10px 12px; }
  @media (max-width: 380px) {
    .drv-time { font-size: 18px; }
    .drv-stat-val { font-size: 20px; }
  }
  .drv-chat-thread { border: 1px solid rgba(246,240,229,.12); border-radius: 14px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; background: rgba(255,255,255,.03); display: flex; align-items: center; gap: 10; }
  .drv-chat-thread:active { background: rgba(255,255,255,.06); }
  .drv-chat-thread.unread { border-color: #3b82f6; background: rgba(37,99,235,.14); }
  .drv-chat-avatar { width: 38px; height: 38px; border-radius: 50%; background: #e0b866; color: #0a1118; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; flex-shrink: 0; }
  .drv-chat-bubble { max-width: 78%; border-radius: 14px; padding: 9px 12px; font-size: 13.5px; line-height: 1.45; }
  .drv-chat-bubble.me { background: #e0b866; color: #0a1118; border-radius: 14px 14px 4px 14px; margin-left: auto; }
  .drv-chat-bubble.them { background: rgba(255,255,255,.08); color: #f6f0e5; border-radius: 14px 14px 14px 4px; }
  @keyframes drv-fadein { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
  .drv-msg-in { animation: drv-fadein 0.25s ease both; }
  @keyframes drv-pulse { 0%, 100% { opacity:1; box-shadow: 0 0 0 3px rgba(34,197,94,0.3); } 50% { opacity:0.6; box-shadow: 0 0 0 6px rgba(34,197,94,0.1); } }
  .drv-visitor-dot-active { animation: drv-pulse 2s ease-in-out infinite; }
`;

// ── Icônes (mêmes tracés que Taxi City Bordeaux pour les rangées) ───────────────────
const svgIcon = (d: string) => () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
const IconBell = svgIcon("M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0");
const IconHome = svgIcon("M3 9.5 12 3l9 6.5M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10");
const IconCar = svgIcon(
  "M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 17V11l2-5h14l2 5v6M5 11h14",
);
const IconCalendar = svgIcon(
  "M7 3v4M17 3v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
);
const IconMessage = svgIcon("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
const IconStar = svgIcon(
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.38L7 14.14 2 9.27l6.91-1.01L12 2z",
);
const IconChart = svgIcon("M18 20V10M12 20V4M6 20v-6");
const IconUsers = svgIcon(
  "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
);
const IconCalc = svgIcon(
  "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01",
);
const IconPhone = svgIcon(
  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
);
const IconArrowLeft = svgIcon("M19 12H5M12 19l-7-7 7-7");

// ── Helpers ────────────────────────────────────────────────────────────────
function Stars({ n }: { n: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "drv-stars" : "drv-stars-empty"}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function eur(n: number) {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// ── Main component ─────────────────────────────────────────────────────────
function DriverPage() {
  const { token } = Route.useSearch();

  useEffect(() => {
    if (token === DRIVER_TOKEN) {
      localStorage.setItem("driver_token", token);
    }
  }, [token]);

  // ── Fix conflit manifest PWA ────────────────────────────────────────────
  // __root.tsx injecte inconditionnellement <link rel="manifest" href="/manifest.json">
  // sur TOUTES les routes, y compris /driver qui ajoute le sien
  // (/api/manifest?role=driver). iOS Safari retient le PREMIER <link
  // rel="manifest"> du DOM — donc le manifest global (start_url "/") gagne
  // et "Ajouter à l'écran d'accueil" installe la homepage au lieu du driver.
  // On supprime ici toute balise manifest autre que celle de /driver dès le
  // montage, pour qu'il n'en reste qu'une seule quand l'utilisateur ouvre le
  // menu de partage iOS.
  useEffect(() => {
    const links = Array.from(document.querySelectorAll('link[rel="manifest"]')) as HTMLLinkElement[];
    const keep = links.find((l) => l.href.includes("/api/manifest"));
    links.forEach((l) => {
      if (l !== keep) l.remove();
    });
  }, []);

  const savedToken = typeof window !== "undefined" ? localStorage.getItem("driver_token") : null;
  const validToken = token === DRIVER_TOKEN || savedToken === DRIVER_TOKEN;

  if (!validToken) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          fontFamily: "DM Sans,sans-serif",
          color: "#64748b",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Accès non autorisé</div>
        </div>
      </div>
    );
  }

  return <DriverApp />;
}

// ── Application chauffeur : tableau de bord unique (sans onglets) ──────────
const DRIVER_NAME = "José";

/** Bouton de notifications de l'en-tête (même rendu que Taxi City Bordeaux). */
function NotifButton({ status, onSubscribe }: { status: string; onSubscribe: () => void }) {
  const denied = status === "denied";
  const granted = status === "granted";
  const loading = status === "loading";
  const label = denied
    ? "Notifications bloquées"
    : granted
      ? "Notifications activées"
      : loading
        ? "…"
        : "Activer les notifications";
  return (
    <button
      type="button"
      className="drv-header-notif"
      style={granted ? { opacity: 0.65 } : undefined}
      disabled={loading}
      onClick={() => {
        if (denied) {
          toast.error("Notifications bloquées — active-les dans les réglages du téléphone.", { duration: 9000 });
          return;
        }
        onSubscribe();
      }}
    >
      <IconBell />
      <span className="drv-header-notif-label">{label}</span>
    </button>
  );
}

function DriverApp() {
  const [tab, setTab] = useState<Screen>("dashboard");
  const [newCount, setNewCount] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [pendingAvis, setPendingAvis] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const { status: pushStatus, subscribe: subscribePush } = usePushNotifications({ autoAudience: "chauffeur" });
  const bodyRef = useRef<HTMLDivElement>(null);
  const listUnreadResasFn = useServerFn(listReservationsWithUnreadChauffeur);
  const getUnreadFn = useServerFn(getUnreadCountsForReservations);

  // Capture le prompt d'installation PWA
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Force le manifest driver au runtime (remplace le manifest global)
  useEffect(() => {
    const existing = document.querySelector('link[rel="manifest"]');
    if (existing) existing.setAttribute("href", "/api/manifest?role=driver");
    else {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/api/manifest?role=driver";
      document.head.appendChild(link);
    }
    return () => {
      const el = document.querySelector('link[rel="manifest"]');
      if (el) el.setAttribute("href", "/manifest.json");
    };
  }, []);

  // Rafraîchit le token FCM à chaque reprise de la page.
  // getFcmToken retourne le cache immédiatement sauf si token > 50j → rotation silencieuse auto.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") subscribePush("chauffeur");
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [subscribePush]);

  // Rafraîchissement badge courses
  useEffect(() => {
    const load = async () => {
      const { count } = await (supabase as any)
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setNewCount(count ?? 0);
    };
    load();
    const ch = (supabase as any)
      .channel("drv-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Badge avis en attente + toast in-app à chaque nouvel avis
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/public/reviews?token=${encodeURIComponent(DRIVER_TOKEN)}`);
        if (!response.ok) return;
        const result = await response.json();
        setPendingAvis(result.pending.length);
      } catch {
        // Le badge se resynchronise au prochain passage/poll.
      }
    };
    load();
    const ch = (supabase as any)
      .channel("drv-avis-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "avis" }, (payload: any) => {
        const row = payload?.new ?? {};
        const stars = "★".repeat(Math.max(0, Math.min(5, Number(row.note) || 0)));
        const who = row.prenom || row.nom || "Client";
        const extract = (row.commentaire || "").toString().slice(0, 60);
        toast.success(`⭐ Nouvel avis de ${who} ${stars}`, {
          description: extract ? `"${extract}${extract.length >= 60 ? "…" : ""}"` : undefined,
          duration: 8000,
        });
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            (navigator as any).vibrate?.([80, 40, 80]);
          }
        } catch {}
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "avis" }, load)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "avis" }, load)
      .subscribe();
    // Filets de sécurité : rafraîchir le compteur au retour d'onglet et
    // au focus fenêtre (Realtime peut être coupé en arrière-plan sur iOS).
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // Refresh périodique de secours : les avis en attente ne sont pas lisibles publiquement en Realtime.
    const poll = setInterval(load, 15000);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(ch);
    };
  }, []);

  // Messages clients non lus (rangée « Messages » du tableau de bord).
  // Pendant que l'écran Courses est ouvert, c'est lui qui pilote ce compteur.
  useEffect(() => {
    if (tab !== "dashboard") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const ids = (await listUnreadResasFn()) as string[];
        if (ids.length === 0) {
          if (!cancelled) setUnreadChat(0);
          return;
        }
        const map = await getUnreadFn({ data: { reservation_ids: ids } });
        const total = Object.values(map).reduce((sum: number, v: any) => sum + (v?.unread_chauffeur ?? 0), 0);
        if (!cancelled) setUnreadChat(total);
      } catch {
        // non bloquant : le compteur se resynchronise au prochain passage
      }
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 400);
    };
    load();
    const unsub = subscribeChatBadgeEvents(() => schedule());
    const ch = (supabase as any)
      .channel("drv-dash-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservation_messages" }, schedule)
      .subscribe();
    const onVis = () => {
      if (!document.hidden) schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    const poll = setInterval(load, 30000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      supabase.removeChannel(ch);
    };
  }, [tab, listUnreadResasFn, getUnreadFn]);

  // Chaque changement d'écran repart en haut de page.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <>
      <style>{css}</style>
      <div className="drv-root">
        <header className="drv-header">
          <div className="drv-brand-mark" aria-label="Taxi City Bordeaux">
            <img src={siteLogo} alt="Logo Taxi City Bordeaux" />
          </div>
          <div className="drv-header-title">
            <strong>Bonjour {DRIVER_NAME}</strong>
            <span>Espace taxi · Taxi City Bordeaux</span>
          </div>
          <span className="drv-header-datetime">
            <strong>
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </strong>
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {installPrompt && (
            <button
              type="button"
              className="drv-header-back"
              onClick={async () => {
                installPrompt.prompt();
                const r = await installPrompt.userChoice;
                if (r.outcome === "accepted") setInstallPrompt(null);
              }}
            >
              <span>📲</span>
              <span className="drv-header-back-label">Installer</span>
            </button>
          )}
          <NotifButton status={pushStatus as string} onSubscribe={() => subscribePush("chauffeur")} />
          <a className="drv-header-back" href="/" aria-label="Retour au site">
            <IconHome />
            <span className="drv-header-back-label">Retour au site</span>
          </a>
        </header>

        <div className="drv-body" ref={bodyRef}>
          {tab === "dashboard" ? (
            <Dashboard newCount={newCount} unreadChat={unreadChat} pendingAvis={pendingAvis} onGo={setTab} />
          ) : (
            <>
              <button type="button" className="drv-dash-back" onClick={() => setTab("dashboard")}>
                <IconArrowLeft />
                <span>Tableau de bord</span>
              </button>
              <div className="drv-sheet">
                {tab === "courses" && <CoursesTab onBadgeChange={setNewCount} onChatBadge={setUnreadChat} />}
                {tab === "planning" && <PlanningTab />}
                {tab === "avis" && <AvisTab onBadgeChange={setPendingAvis} />}
                {tab === "clients" && <ClientsTab />}
                {tab === "stats" && <StatsTab />}
                {tab === "simulateur" && <SimulateurTab />}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Tableau de bord : rangées au format Taxi City Bordeaux ──────────────────────────
// ›  = ouvre un écran (bouton « Tableau de bord » pour revenir)
// ＋/− = se déplie sur place
type ClientCall = { id: string; name: string; phone: string; when: string };

function Dashboard({
  newCount,
  unreadChat,
  pendingAvis,
  onGo,
}: {
  newCount: number;
  unreadChat: number;
  pendingAvis: number;
  onGo: (t: Tab) => void;
}) {
  const [rows, setRows] = useState<Resa[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [calls, setCalls] = useState<ClientCall[]>([]);
  const [callsOpen, setCallsOpen] = useState(false);

  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    try {
      const [activeRes, todayRes, callsRes] = await Promise.all([
        (supabase as any)
          .from("reservations")
          .select("id,depart,destination,pickup_datetime,date_heure,status,prix_estime,client_name,client_phone")
          .in("status", ["pending", "accepted", "en_route", "arrived"])
          .order("pickup_datetime", { ascending: true })
          .limit(50),
        (supabase as any)
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .gte("pickup_datetime", start.toISOString())
          .lt("pickup_datetime", end.toISOString())
          .not("status", "eq", "cancelled"),
        (supabase as any)
          .from("reservations")
          .select("id,pickup_datetime,date_heure,client_name,client_phone,telephone")
          .order("pickup_datetime", { ascending: false })
          .limit(60),
      ]);
      setRows((activeRes?.data ?? []) as Resa[]);
      setTodayCount(todayRes?.count ?? 0);

      const seen = new Set<string>();
      const list: ClientCall[] = [];
      for (const r of callsRes?.data ?? []) {
        const phone = String(r.client_phone ?? r.telephone ?? "").trim();
        const key = phone.replace(/\D/g, "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        list.push({ id: r.id, name: r.client_name ?? "Client", phone, when: r.pickup_datetime ?? r.date_heure });
        if (list.length >= 6) break;
      }
      setCalls(list);
    } catch {
      // non bloquant : les rangées gardent leurs dernières valeurs
    }
  }, []);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    const poll = setInterval(load, 30000);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const whenOf = (r: Resa) => r.pickup_datetime ?? r.date_heure;
  const active = rows.find((r) => ["accepted", "en_route", "arrived"].includes(r.status));
  const nextRide = rows
    .filter((r) => r.status !== "pending" && new Date(whenOf(r)).getTime() >= Date.now())
    .sort((a, b) => +new Date(whenOf(a)) - +new Date(whenOf(b)))[0];
  const focus = active ?? nextRide;

  return (
    <div>
      <h2 className="drv-dash-title">Tableau de bord</h2>

      <div className="drv-dash-list">
        <button type="button" className="drv-dash-row" onClick={() => onGo("courses")}>
          <span className="drv-dash-ico" style={{ background: active ? "#e11d48" : "#3f3f46" }}>
            <IconCar />
          </span>
          <span className="drv-dash-txt">
            <strong>{active ? "En course" : "Aucune course en cours"}</strong>
            <span>
              {active
                ? `${active.depart} → ${active.destination}`
                : newCount > 0
                  ? `${newCount} nouvelle(s) demande(s) à traiter`
                  : "Appuyez pour voir vos courses"}
            </span>
          </span>
          {newCount > 0 ? <span className="drv-dash-badge">{newCount}</span> : <span className="drv-dash-plus">›</span>}
        </button>

        {focus ? (
          <button type="button" className="drv-dash-row" onClick={() => onGo("courses")}>
            <span className="drv-dash-ico" style={{ background: "#e0b866" }}>
              <IconCalendar />
            </span>
            <span className="drv-dash-txt">
              <strong>{active ? "Course en cours" : "Prochaine course"}</strong>
              <span>
                {new Date(whenOf(focus)).toLocaleString("fr-FR")} · {focus.client_name ?? "Client"}
                {focus.prix_estime != null ? ` · ${eur(Number(focus.prix_estime))}` : ""}
              </span>
            </span>
            <span className="drv-dash-plus">›</span>
          </button>
        ) : null}

        <button type="button" className="drv-dash-row" onClick={() => onGo("planning")}>
          <span className="drv-dash-ico" style={{ background: "#2563eb" }}>
            <IconCalendar />
          </span>
          <span className="drv-dash-txt">
            <strong>Calendrier</strong>
            <span>{todayCount > 0 ? `${todayCount} course(s) aujourd'hui` : "Aucune course aujourd'hui"}</span>
          </span>
          <span className="drv-dash-plus">›</span>
        </button>

        <button type="button" className="drv-dash-row" onClick={() => onGo("courses")}>
          <span className="drv-dash-ico" style={{ background: "#db2777" }}>
            <IconMessage />
          </span>
          <span className="drv-dash-txt">
            <strong>Messages</strong>
            <span>{unreadChat > 0 ? `${unreadChat} message(s) non lus` : "Aucun nouveau message"}</span>
          </span>
          {unreadChat > 0 ? (
            <span className="drv-dash-badge">{unreadChat}</span>
          ) : (
            <span className="drv-dash-plus">›</span>
          )}
        </button>

        <button type="button" className="drv-dash-row" onClick={() => setCallsOpen((v) => !v)}>
          <span className="drv-dash-ico" style={{ background: "#22c55e" }}>
            <IconPhone />
          </span>
          <span className="drv-dash-txt">
            <strong>Appels récents</strong>
            <span>{calls.length > 0 ? `${calls.length} client(s) à rappeler` : "Aucun numéro client récent"}</span>
          </span>
          <span className="drv-dash-plus">{callsOpen ? "−" : "＋"}</span>
        </button>

        {callsOpen ? (
          <div className="drv-dash-map" style={{ padding: 12, display: "grid", gap: 8 }}>
            {calls.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
                Les numéros apparaîtront dès votre prochaine course.
              </p>
            ) : (
              calls.map((c) => (
                <a
                  key={c.id}
                  href={`tel:${c.phone.replace(/\s/g, "")}`}
                  className="drv-dash-row"
                  style={{ textDecoration: "none" }}
                >
                  <span className="drv-dash-ico" style={{ background: "#16a34a" }}>
                    <IconPhone />
                  </span>
                  <span className="drv-dash-txt">
                    <strong>{c.name}</strong>
                    <span>
                      {c.phone} · {new Date(c.when).toLocaleString("fr-FR")}
                    </span>
                  </span>
                  <span className="drv-dash-plus">›</span>
                </a>
              ))
            )}
          </div>
        ) : null}

        <button type="button" className="drv-dash-row" onClick={() => onGo("avis")}>
          <span className="drv-dash-ico" style={{ background: "#f59e0b" }}>
            <IconStar />
          </span>
          <span className="drv-dash-txt">
            <strong>Avis</strong>
            <span>{pendingAvis > 0 ? `${pendingAvis} avis à valider` : "Aucun avis en attente"}</span>
          </span>
          {pendingAvis > 0 ? (
            <span className="drv-dash-badge">{pendingAvis}</span>
          ) : (
            <span className="drv-dash-plus">›</span>
          )}
        </button>

        <button type="button" className="drv-dash-row" onClick={() => onGo("clients")}>
          <span className="drv-dash-ico" style={{ background: "#0ea5e9" }}>
            <IconUsers />
          </span>
          <span className="drv-dash-txt">
            <strong>Clients</strong>
            <span>Fiches et historique de vos clients</span>
          </span>
          <span className="drv-dash-plus">›</span>
        </button>

        <button type="button" className="drv-dash-row" onClick={() => onGo("stats")}>
          <span className="drv-dash-ico" style={{ background: "#8b5cf6" }}>
            <IconChart />
          </span>
          <span className="drv-dash-txt">
            <strong>Stats</strong>
            <span>Revenus, courses et fréquentation de la semaine</span>
          </span>
          <span className="drv-dash-plus">›</span>
        </button>

        <button type="button" className="drv-dash-row" onClick={() => onGo("simulateur")}>
          <span className="drv-dash-ico" style={{ background: "#7c3aed" }}>
            <IconCalc />
          </span>
          <span className="drv-dash-txt">
            <strong>Simulateur</strong>
            <span>Estimer le prix d'une course</span>
          </span>
          <span className="drv-dash-plus">›</span>
        </button>
      </div>
    </div>
  );
}

// ── Onglet Courses ─────────────────────────────────────────────────────────
function CoursesTab({
  onBadgeChange,
  onChatBadge,
}: {
  onBadgeChange: (n: number) => void;
  onChatBadge?: (n: number) => void;
}) {
  const [courses, setCourses] = useState<Resa[]>([]);
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const listUnreadResasFn = useServerFn(listReservationsWithUnreadChauffeur);
  const getUnreadFn = useServerFn(getUnreadCountsForReservations);

  const load = useCallback(async () => {
    const activeStatuses = ["pending", "accepted", "en_route", "arrived"];
    const [activeRes, unreadIds] = await Promise.all([
      (supabase as any)
        .from("reservations")
        .select(
          "id,depart,destination,pickup_datetime,status,prix_estime,distance_km,client_name,client_phone,client_email,suivi_id,message",
        )
        .in("status", activeStatuses)
        .order("pickup_datetime", { ascending: true }),
      listUnreadResasFn().catch(() => [] as string[]),
    ]);
    const activeList: Resa[] = activeRes?.data ?? [];
    const activeIds = new Set(activeList.map((r) => r.id));
    const extraIds = (unreadIds as string[]).filter((id) => !activeIds.has(id));
    let extraList: Resa[] = [];
    if (extraIds.length > 0) {
      const { data: extra } = await (supabase as any)
        .from("reservations")
        .select(
          "id,depart,destination,pickup_datetime,status,prix_estime,distance_km,client_name,client_phone,client_email,suivi_id,message",
        )
        .in("id", extraIds);
      extraList = extra ?? [];
    }
    const list: Resa[] = [...activeList, ...extraList];
    setCourses(list);
    setLoading(false);
    onBadgeChange(list.filter((r) => r.status === "pending").length);

    // COUNT SQL agrégé pour prioriser les cartes + indicateurs
    try {
      const ids = list.map((r) => r.id);
      const map = await getUnreadFn({ data: { reservation_ids: ids } });
      setUnreadMap(map);
      const totalUnread = Object.values(map).reduce((sum: number, v: any) => sum + (v?.unread_chauffeur ?? 0), 0);
      onChatBadge?.(totalUnread);
    } catch {
      // pas bloquant : les cartes gardent leur ordre par défaut
    }
  }, [onBadgeChange, onChatBadge, listUnreadResasFn, getUnreadFn]);

  // Refresh debouncé : coalesce les bursts Realtime (INSERT + UPDATE
  // read_by_*) en un seul appel batch après 300 ms d'inactivité. Immédiat
  // au premier appel, immédiat aussi au retour d'onglet.
  const loadRef = useRef(load);
  loadRef.current = load;
  const scheduleRef = useRef<{ timer: any; last: number }>({ timer: null, last: 0 });
  const scheduleLoad = useCallback((immediate = false) => {
    const s = scheduleRef.current;
    if (s.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
    const run = () => {
      s.last = Date.now();
      s.timer = null;
      loadRef.current();
    };
    // Immédiat si demandé OU si dernière exécution > 2s (throttle plancher).
    // Sinon, on coalesce les bursts Realtime sur 600 ms d'inactivité.
    if (immediate || Date.now() - s.last > 2000) {
      run();
    } else {
      s.timer = setTimeout(run, 600);
    }
  }, []);

  // Realtime filtré : on ne s'abonne qu'aux réservations actuellement
  // visibles (max 50) au lieu de recevoir tous les INSERT globaux. On
  // (dés)abonne dynamiquement quand la liste change (nouvelle course,
  // completed, etc.).
  const visibleIds = courses.map((r) => r.id).slice(0, 50);
  const visibleKey = visibleIds.join(",");

  // Recalcul incrémental : appliquer les deltas d'unread localement au lieu
  // de refaire tourner getUnreadCountsForReservations à chaque event.
  const applyDelta = useCallback(
    (reservationId: string, delta: number, reset?: boolean) => {
      setUnreadMap((prev) => {
        const cur = prev[reservationId] ?? { unread_chauffeur: 0, unread_client: 0 };
        const nextUnread = reset ? 0 : Math.max(0, (cur.unread_chauffeur ?? 0) + delta);
        const next = { ...prev, [reservationId]: { ...cur, unread_chauffeur: nextUnread } };
        const total = Object.values(next).reduce((sum: number, v: any) => sum + (v?.unread_chauffeur ?? 0), 0);
        onChatBadge?.(total);
        return next;
      });
    },
    [onChatBadge],
  );

  useEffect(() => {
    scheduleLoad(true);

    // BroadcastChannel : un autre onglet a marqué une conversation comme lue
    // → on remet unread_chauffeur=0 pour cette réservation, sans requête.
    const unsubBc = subscribeChatBadgeEvents((e: ChatBadgeEvent) => {
      if (e.type === "read") applyDelta(e.reservationId, 0, true);
      else if (e.type === "delta") applyDelta(e.reservationId, e.delta);
    });

    const onVis = () => {
      if (!document.hidden) scheduleLoad(true);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    // Fallback storage pour navigateurs sans BroadcastChannel.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "drv-chat-read-bump") scheduleLoad(true);
    };
    window.addEventListener("storage", onStorage);
    // Reconciliation périodique (5 min) : filet de sécurité, plus rare
    // maintenant que le badge est mis à jour incrémentalement.
    const reconcile = setInterval(() => scheduleLoad(), 300000);
    return () => {
      unsubBc();
      clearInterval(reconcile);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("storage", onStorage);
      if (scheduleRef.current.timer) clearTimeout(scheduleRef.current.timer);
    };
  }, [scheduleLoad, applyDelta]);

  // Canal Realtime dédié aux réservations visibles — recréé quand la liste
  // change (visibleKey). Filtre `reservation_id=in.(...)` côté serveur.
  useEffect(() => {
    if (visibleIds.length === 0) return;
    const idFilter = `reservation_id=in.(${visibleIds.join(",")})`;
    const ch = (supabase as any)
      .channel(`drv-courses-${visibleIds.length}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `id=in.(${visibleIds.join(",")})` },
        () => scheduleLoad(),
      )
      // INSERT reservations (nouvelle course) → refresh liste complète
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, () => scheduleLoad())
      // INSERT message client sur une résa visible → increment ciblé du badge
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservation_messages", filter: idFilter },
        (payload: any) => {
          const row = payload?.new;
          if (row?.sender === "client" && row?.reservation_id) {
            applyDelta(row.reservation_id, 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [visibleKey, scheduleLoad, applyDelta]);

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  // Priorité d'affichage dans chaque section :
  //   1. Cartes avec messages client non lus (unread_chauffeur > 0)
  //   2. Cartes avec demande spéciale (message non vide)
  //   3. Ordre naturel (pickup_datetime croissant)
  const sortByPriority = (a: Resa, b: Resa) => {
    const aUnread = unreadMap[a.id]?.unread_chauffeur ?? 0;
    const bUnread = unreadMap[b.id]?.unread_chauffeur ?? 0;
    if (aUnread > 0 !== bUnread > 0) return aUnread > 0 ? -1 : 1;
    const aSpecial = !!(a.message && a.message.trim());
    const bSpecial = !!(b.message && b.message.trim());
    if (aSpecial !== bSpecial) return aSpecial ? -1 : 1;
    return String(a.pickup_datetime ?? "").localeCompare(String(b.pickup_datetime ?? ""));
  };

  const nouvelles = courses.filter((r) => r.status === "pending").sort(sortByPriority);
  const encours = courses
    .filter((r) => r.status === "accepted" || r.status === "en_route" || r.status === "arrived")
    .sort(sortByPriority);
  const followups = courses
    .filter((r) => !["pending", "accepted", "en_route", "arrived"].includes(r.status))
    .sort(sortByPriority);

  if (courses.length === 0)
    return (
      <div className="drv-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune course en attente</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Tout est à jour ✓</div>
      </div>
    );

  const renderCard = (r: Resa) => (
    <CourseCard
      key={r.id}
      resa={r}
      onRefresh={load}
      expanded={selected === r.id}
      onToggle={() => setSelected((s) => (s === r.id ? null : r.id))}
      unreadByChauffeur={unreadMap[r.id]?.unread_chauffeur ?? 0}
      unreadByClient={unreadMap[r.id]?.unread_client ?? 0}
    />
  );

  return (
    <>
      {nouvelles.length > 0 && (
        <>
          <p className="drv-section">Nouvelles demandes</p>
          {nouvelles.map(renderCard)}
          <hr className="drv-divider" />
        </>
      )}
      {encours.length > 0 && (
        <>
          <p className="drv-section">En cours</p>
          {encours.map(renderCard)}
        </>
      )}
      {followups.length > 0 && (
        <>
          {(nouvelles.length > 0 || encours.length > 0) && <hr className="drv-divider" />}
          <p className="drv-section">💬 Messages clients (courses passées)</p>
          {followups.map(renderCard)}
        </>
      )}
    </>
  );
}

// ── Course Card avec itinéraires Google Maps ───────────────────────────────
function CourseCard({
  resa,
  onRefresh,
  expanded,
  onToggle,
  unreadByChauffeur = 0,
  unreadByClient = 0,
}: {
  resa: Resa;
  onRefresh: () => void;
  expanded: boolean;
  onToggle: () => void;
  unreadByChauffeur?: number;
  unreadByClient?: number;
}) {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const routeStorageKey = `drv-selected-route:${resa.id}`;
  const [selectedRoute, setSelectedRoute] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(routeStorageKey);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const routeRestoredRef = useRef(false);
  // Sync cross-onglets : quand un onglet change la sélection d'itinéraire,
  // les autres onglets ouverts sur /driver s'alignent instantanément via
  // l'événement `storage` (localStorage). Idem au retour de visibilité.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const readAndApply = () => {
      const raw = window.localStorage.getItem(routeStorageKey);
      const n = raw == null ? NaN : Number(raw);
      if (Number.isFinite(n) && n >= 0) {
        setSelectedRoute((prev) => (prev === n ? prev : n));
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === routeStorageKey) readAndApply();
    };
    const onVis = () => {
      if (!document.hidden) readAndApply();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [routeStorageKey]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [busy, setBusy] = useState(false);
  const notifyStatus = useServerFn(notifyReservationStatus);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const actionLocks = useRef<Set<string>>(new Set());
  // Le chat est toujours visible → considéré "lu" à l'affichage.
  // On garde le compteur remonté par CoursesTab mais on le masque
  // localement pendant que l'InlineDriverChat marque read_by_chauffeur=true.
  const rawUnread = unreadByChauffeur;
  const unreadCount = rawUnread;
  const hasSpecialRequest = !!(resa.message && resa.message.trim());
  const unreadContext = hasSpecialRequest ? "demande spéciale" : "conversation en cours";
  const unreadTooltip =
    unreadCount > 0
      ? `${unreadCount} message${unreadCount > 1 ? "s" : ""} client non lu${unreadCount > 1 ? "s" : ""} · ${unreadContext}`
      : "Aucun message non lu";

  const claimAction = (key: string) => {
    if (actionLocks.current.has(key)) return false;
    actionLocks.current.add(key);
    return true;
  };

  const releaseAction = (key: string) => {
    actionLocks.current.delete(key);
  };

  // Charger les itinéraires quand on ouvre la carte
  useEffect(() => {
    if (!expanded || routes.length > 0) return;
    setLoadingRoutes(true);

    (async () => {
      try {
        const mapsApi = await loadGoogleMapsWhenVisible(mapRef.current!);
        const [geoA, geoB] = await Promise.all([geocodeAddress(resa.depart), geocodeAddress(resa.destination)]);
        if (!geoA || !geoB) {
          setLoadingRoutes(false);
          return;
        }

        const svc = new mapsApi.maps.DirectionsService();
        const result: any = await new Promise((res, rej) =>
          svc.route(
            {
              origin: { lat: geoA.lat, lng: geoA.lng },
              destination: { lat: geoB.lat, lng: geoB.lng },
              travelMode: mapsApi.maps.TravelMode.DRIVING,
              provideRouteAlternatives: true,
            },
            (r: any, s: any) => (s === "OK" && r ? res(r) : rej(s)),
          ),
        );

        const opts: RouteOption[] = result.routes.slice(0, 3).map((route: google.maps.DirectionsRoute, i: number) => {
          const leg = route.legs[0];
          const distKm = (leg.distance?.value ?? 0) / 1000;
          const dureeMin = Math.round((leg.duration?.value ?? 0) / 60);
          const dureeS = leg.duration?.value ?? 0;
          // Tarifs Bordeaux — calcul mixte avec durée réelle Google Maps
          const pickupIso = resa.pickup_datetime ?? resa.date_heure ?? "";
          const pickupMs = pickupIso ? new Date(pickupIso).getTime() : Date.now();
          const stepsCount = Math.max(Math.round(dureeS / 60), 1);
          const stepMs = (dureeS * 1000) / stepsCount;
          const frac = distKm / stepsCount;
          let jourKm = 0,
            nuitKm = 0;
          for (let s = 0; s < stepsCount; s++) {
            const t = new Date(pickupMs + s * stepMs).toISOString();
            if (estTarifJourParis(t)) jourKm += frac;
            else nuitKm += frac;
          }
          const prix_estime = parseFloat((2.83 + jourKm * 2.16 + nuitKm * 3.24).toFixed(2));
          const estJour = estTarifJourParis(pickupIso);
          const tarifLabel = jourKm > 0 && nuitKm > 0 ? "Tarif mixte 🌗" : estJour ? "Tarif jour ☀️" : "Tarif nuit 🌙";

          // Extraire un waypoint au milieu du trajet pour forcer cet itinéraire dans Maps
          const steps: any[] = route.legs.flatMap((l: any) => l.steps ?? []);
          const midStep = steps.length > 2 ? steps[Math.floor(steps.length / 2)] : null;
          const waypointLatLng = midStep?.start_location
            ? { lat: midStep.start_location.lat(), lng: midStep.start_location.lng() }
            : null;

          return {
            index: i,
            summary: route.summary || `Itinéraire ${i + 1}`,
            distanceKm: parseFloat(distKm.toFixed(1)),
            dureeMin,
            prix_estime,
            tarifLabel,
            legs: route.legs,
            overview_polyline:
              (route.overview_polyline as unknown as { points?: string })?.points ??
              (route.overview_polyline as unknown as string) ??
              "",
            dirResult: { ...result, routes: [route] },
            originLatLng: { lat: geoA.lat, lng: geoA.lng },
            destLatLng: { lat: geoB.lat, lng: geoB.lng },
            waypointLatLng,
          };
        });
        setRoutes(opts);
        // Restaure la sélection après chargement : match par distance/prix de
        // la DB (source de vérité) sinon localStorage. Évite la remise à 0 au
        // refresh signalée par le chauffeur.
        if (!routeRestoredRef.current && opts.length > 0) {
          routeRestoredRef.current = true;
          let idx = -1;
          if (resa.distance_km != null) {
            // Match par distance la plus proche (pas de seuil strict) : Google
            // Maps peut réordonner ou légèrement recalculer les alternatives
            // au rechargement, un seuil fixe (0.15 km) pouvait rater le bon
            // itinéraire et faire "reset" visuellement la sélection.
            let bestIdx = -1;
            let bestDiff = Infinity;
            opts.forEach((o, i) => {
              const diff = Math.abs(o.distanceKm - (resa.distance_km ?? 0));
              if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
              }
            });
            idx = bestIdx;
          }
          if (idx < 0) {
            const raw = typeof window !== "undefined" ? window.localStorage.getItem(routeStorageKey) : null;
            const n = raw == null ? NaN : Number(raw);
            if (Number.isFinite(n) && n >= 0 && n < opts.length) idx = n;
          }
          if (idx >= 0 && idx !== selectedRoute) setSelectedRoute(idx);
        }
        setLoadingRoutes(false);
      } catch (e) {
        console.error("[CourseCard] routes:", e);
        setLoadingRoutes(false);
      }
    })();
  }, [expanded, resa]);

  // Afficher la route sélectionnée sur la carte
  useEffect(() => {
    if (!expanded || routes.length === 0) return;
    (async () => {
      try {
        const mapsApi = await loadGoogleMapsWhenVisible(mapRef.current!);
        if (!mapInst.current) {
          mapInst.current = new mapsApi.maps.Map(mapRef.current!, {
            zoom: 13,
            disableDefaultUI: true,
            gestureHandling: "cooperative",
            styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
          });
        }
        if (!rendererRef.current) {
          rendererRef.current = new mapsApi.maps.DirectionsRenderer({
            suppressMarkers: false,
            polylineOptions: { strokeColor: "#0f172a", strokeWeight: 5 },
          });
          rendererRef.current.setMap(mapInst.current);
        }
        const chosen = routes[selectedRoute];
        if (chosen) rendererRef.current.setDirections(chosen.dirResult);
      } catch {}
    })();
  }, [expanded, routes, selectedRoute]);

  const statusLabel: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "drv-badge-blue" },
    accepted: { label: "Acceptée", cls: "drv-badge-green" },
    en_route: { label: "En route", cls: "drv-badge-amber" },
    arrived: { label: "Arrivé", cls: "drv-badge-amber" },
  };
  const st = statusLabel[resa.status] ?? { label: resa.status, cls: "drv-badge-gray" };

  const handleAccept = async () => {
    const actionKey = `${resa.id}:accepted`;
    if (!claimAction(actionKey)) return;
    setBusy(true);
    try {
      const chosen = routes[selectedRoute];
      const updates: any = { status: "accepted" };
      if (chosen) {
        updates.distance_km = chosen.distanceKm;
        updates.prix_estime = chosen.prix_estime;
      }
      const { data: updated, error } = await (supabase as any)
        .from("reservations")
        .update(updates)
        .eq("id", resa.id)
        .neq("status", "accepted")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        toast("Action déjà prise en compte");
        onRefresh();
        return;
      }
      broadcastSuiviUpdate(resa.id, "accepted");
      try {
        await notifyStatus({ data: { reservation_id: resa.id, status: "accepted" } });
      } catch (pushErr) {
        console.warn("[driver] client accepted push failed", pushErr);
      }
      toast.success("Course acceptée ✓");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(false);
      releaseAction(actionKey);
    }
  };

  const handleRefuse = async () => {
    if (!confirm("Refuser cette course ?")) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("reservations").update({ status: "cancelled" }).eq("id", resa.id);
      if (error) throw error;
      broadcastSuiviUpdate(resa.id, "cancelled");
      toast("Course refusée");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // ── Mettre à jour l'itinéraire d'une course déjà acceptée ──
  const [itinSaving, setItinSaving] = useState(false);
  const handleUpdateItineraire = async () => {
    const chosen = routes[selectedRoute];
    if (!chosen) {
      toast.error("Sélectionne d'abord un itinéraire ci-dessus");
      return;
    }
    setItinSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("reservations")
        .update({ distance_km: chosen.distanceKm, prix_estime: chosen.prix_estime })
        .eq("id", resa.id);
      if (error) throw error;
      broadcastSuiviUpdate(resa.id, "route");
      toast.success(`Itinéraire mis à jour — ${chosen.distanceKm} km · ${chosen.prix_estime.toFixed(2)} €`);
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setItinSaving(false);
    }
  };

  // ── Prix custom — SMS / WhatsApp / Email ──
  const [customPrix, setCustomPrix] = useState("");
  const [customPrixOpen, setCustomPrixOpen] = useState(false);
  const [customPrixSending, setCustomPrixSending] = useState(false);
  const handleSendCustomPrix = async (canal: "sms" | "whatsapp" | "email") => {
    const val = parseFloat((customPrix || "").trim().replace(",", "."));
    if (!customPrix || isNaN(val) || val <= 0) {
      toast.error("Prix invalide", { description: "Entrez un montant valide (ex: 18.50)" });
      return;
    }
    const name = resa.client_name || "Client";
    const phone = (resa.client_phone || "").replace(/\s/g, "");
    const email = resa.client_email || resa.email || "";
    const trajet = `${resa.depart} → ${resa.destination || "—"}`;
    const trackUrl = typeof window !== "undefined" ? `${window.location.origin}/reservation/${resa.id}` : "";
    const trackingLine = trackUrl ? `\nRetrouvez votre course ici : ${trackUrl}` : "";
    const msg = `Bonjour ${name}, le prix de votre course Taxi City Bordeaux (${trajet}) est de ${val.toFixed(2)} €. Merci.${trackingLine}`;

    if (canal === "sms") {
      if (!phone) {
        toast.error("Pas de téléphone");
        return;
      }
      window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, "_blank");
    } else if (canal === "whatsapp") {
      if (!phone) {
        toast.error("Pas de téléphone");
        return;
      }
      window.open(`https://wa.me/${phone.replace(/^0/, "33")}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      if (!email) {
        toast.error("Pas d'email");
        return;
      }
      setCustomPrixSending(true);
      try {
        const res = await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
          body: JSON.stringify({
            templateName: "custom-price",
            recipientEmail: email,
            idempotencyKey: `custom-price-${resa.id}-${Date.now()}`,
            templateData: {
              nom: name,
              depart: resa.depart,
              arrivee: resa.destination || "—",
              prix: `${val.toFixed(2)} €`,
              distance_km: resa.distance_km ? `${resa.distance_km} km` : undefined,
            },
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          toast.error(errBody?.error || "Échec envoi email");
        } else {
          toast.success(`✉️ Email envoyé à ${email}`);
        }
      } catch (e: any) {
        toast.error("Erreur réseau", { description: e?.message ?? "" });
      } finally {
        setCustomPrixSending(false);
      }
    }
    await (supabase as any).from("reservations").update({ prix_estime: val }).eq("id", resa.id);
    broadcastSuiviUpdate(resa.id, "price");
    onRefresh();
  };

  // ── Reprogrammer l'heure ──
  const [newDatetime, setNewDatetime] = useState("");
  const [changeHeureOpen, setChangeHeureOpen] = useState(false);
  const [changeHeureSending, setChangeHeureSending] = useState(false);
  const handleChangeHeure = async () => {
    if (!newDatetime) return;
    setChangeHeureSending(true);
    try {
      const { error } = await (supabase as any)
        .from("reservations")
        .update({ date_heure: newDatetime })
        .eq("id", resa.id);
      if (error) throw error;
      broadcastSuiviUpdate(resa.id, "reschedule");
      const email = resa.client_email || resa.email;
      const name = resa.client_name || "Client";
      if (email) {
        try {
          await fetch("/api/admin/send-course-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
            body: JSON.stringify({
              templateName: "reschedule",
              recipientEmail: email,
              idempotencyKey: `reschedule-${resa.id}-${Date.now()}`,
              templateData: {
                nom: name,
                depart: resa.depart,
                arrivee: resa.destination || "—",
                old_datetime:
                  formatDate(resa.pickup_datetime ?? resa.date_heure) +
                  " " +
                  formatHeure(resa.pickup_datetime ?? resa.date_heure),
                new_datetime: formatDate(newDatetime) + " " + formatHeure(newDatetime),
              },
            }),
          });
          toast.success("🕐 Heure modifiée · ✉️ Email envoyé");
        } catch {
          toast.success("🕐 Heure modifiée · ⚠️ Email non envoyé");
        }
      } else {
        toast.success("🕐 Heure modifiée");
      }
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setChangeHeureSending(false);
    }
  };

  // ── Terminer la course ──
  const [completing, setCompleting] = useState(false);
  const handleComplete = async () => {
    if (!confirm("Marquer cette course comme terminée ?")) return;
    const actionKey = `${resa.id}:completed`;
    if (!claimAction(actionKey)) return;
    setCompleting(true);
    try {
      const { data: updated, error } = await (supabase as any)
        .from("reservations")
        .update({ status: "completed" })
        .eq("id", resa.id)
        .neq("status", "completed")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        toast("Action déjà prise en compte");
        onRefresh();
        return;
      }
      broadcastSuiviUpdate(resa.id, "completed");
      try {
        await notifyStatus({ data: { reservation_id: resa.id, status: "completed" } });
      } catch (pushErr) {
        console.warn("[driver] client completed push failed", pushErr);
      }
      toast.success("🏁 Course terminée");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setCompleting(false);
      releaseAction(actionKey);
    }
  };

  // ── Progression de statut ──
  const [progressing, setProgressing] = useState(false);
  const handleProgressStatus = async (nextStatus: string, label: string) => {
    const actionKey = `${resa.id}:${nextStatus}`;
    if (!claimAction(actionKey)) return;
    setProgressing(true);
    try {
      const { data: updated, error } = await (supabase as any)
        .from("reservations")
        .update({ status: nextStatus })
        .eq("id", resa.id)
        .neq("status", nextStatus)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        toast("Action déjà prise en compte");
        onRefresh();
        return;
      }
      broadcastSuiviUpdate(resa.id, `status:${nextStatus}`);
      try {
        await notifyStatus({ data: { reservation_id: resa.id, status: nextStatus as any } });
      } catch (pushErr) {
        console.warn("[driver] client status push failed", pushErr);
      }
      toast.success(label);
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setProgressing(false);
      releaseAction(actionKey);
    }
  };

  // ── Prix rapide (haut de carte) : enregistre + email client avec lien suivi ──
  const [quickPrix, setQuickPrix] = useState("");
  const [quickMotif, setQuickMotif] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickSent, setQuickSent] = useState<{ ok: boolean; msg: string; at: string } | null>(null);
  const markQuickSent = (ok: boolean, msg: string) =>
    setQuickSent({ ok, msg, at: new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) });
  const handleQuickPrice = async () => {
    const val = parseFloat((quickPrix || "").trim().replace(",", "."));
    if (!quickPrix || isNaN(val) || val <= 0) {
      toast.error("Prix invalide", { description: "Entrez un montant valide (ex : 18,50)" });
      return;
    }
    setQuickSaving(true);
    try {
      const { error } = await (supabase as any).from("reservations").update({ prix_estime: val }).eq("id", resa.id);
      if (error) throw error;
      try {
        await (supabase as any).from("reservation_price_changes").insert({
          reservation_id: resa.id,
          old_price: resa.prix_estime ?? null,
          new_price: val,
          motif: quickMotif.trim() || null,
        });
      } catch (histErr) {
        console.warn("[driver] price history insert failed", histErr);
      }
      broadcastSuiviUpdate(resa.id, "price");

      const email = resa.client_email || (resa as any).email || "";
      const suiviUrl =
        typeof window !== "undefined" ? `${window.location.origin}/suivi/${resa.suivi_id || resa.id}` : "";
      if (email) {
        const res = await fetch("/api/admin/send-course-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Secret": "admin-pin-call" },
          body: JSON.stringify({
            templateName: "custom-price",
            recipientEmail: email,
            idempotencyKey: `custom-price-${resa.id}-${Date.now()}`,
            templateData: {
              nom: resa.client_name || "Client",
              depart: resa.depart,
              arrivee: resa.destination || "—",
              prix: val,
              motif: quickMotif.trim() || undefined,
              suivi_url: suiviUrl,
              reservation_id: resa.id,
              pickup_datetime: resa.pickup_datetime ?? (resa as any).date_heure,
            },
          }),
        });
        if (!res.ok) {
          toast.warning("Prix enregistré, mais email non envoyé");
          markQuickSent(
            false,
            `Prix ${val.toFixed(2)} € enregistré, mais l'email à ${email} n'est pas parti. Réessayez.`,
          );
        } else {
          toast.success(`Prix ${val.toFixed(2)} € envoyé à ${email}`);
          markQuickSent(true, `Email envoyé à ${email} — nouveau prix ${val.toFixed(2)} € + lien de suivi.`);
        }
      } else {
        toast.success(`Prix ${val.toFixed(2)} € enregistré (pas d'email client)`);
        markQuickSent(
          false,
          `Prix ${val.toFixed(2)} € enregistré — aucun email client renseigné, rien n'a été envoyé.`,
        );
      }
      setQuickPrix("");
      setQuickMotif("");
      onRefresh();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setQuickSaving(false);
    }
  };

  // ── Supprimer la course ──
  const [deleting, setDeleting] = useState(false);
  const handleDeleteResa = async () => {
    if (!confirm("Supprimer définitivement cette course ? Action irréversible.")) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from("reservations").delete().eq("id", resa.id);
      if (error) throw error;
      toast.success("Course supprimée");
      onRefresh();
    } catch (e: any) {
      toast.error("Suppression impossible : " + (e.message ?? e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`drv-card${resa.status === "pending" ? " new" : ""}`}>
      {/* En-tête */}
      <div className="drv-row" style={{ cursor: "pointer" }} onClick={onToggle}>
        <span className="drv-time">{formatHeure(resa.pickup_datetime ?? resa.date_heure)}</span>
        <span className={`drv-badge-pill ${st.cls}`}>{st.label}</span>
      </div>
      {resa.client_name && <div className="drv-name">{resa.client_name}</div>}
      <div className="drv-route">
        <span>📍 {resa.depart}</span>
        <span>🏁 {resa.destination}</span>
      </div>

      {/* Prix du taxi — champ rapide en haut de carte */}
      <div
        style={{
          marginTop: 10,
          padding: "10px 12px",
          background: "linear-gradient(180deg, rgba(232,201,109,.12), rgba(232,201,109,.05))",
          border: "1px solid #E8C96D",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#e0b866",
            marginBottom: 6,
          }}
        >
          💶 Prix à envoyer au client
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Prix € (ex : 18,50)"
            value={quickPrix}
            onChange={(e) => setQuickPrix(e.target.value)}
            style={{
              flex: "1 1 110px",
              minWidth: 100,
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid rgba(232,201,109,.45)",
              fontSize: 16,
              fontWeight: 700,
              background: "rgba(0,0,0,.28)",
              color: "#f6f0e5",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <input
            type="text"
            placeholder="Justificatif (facultatif)"
            value={quickMotif}
            onChange={(e) => setQuickMotif(e.target.value)}
            style={{
              flex: "2 1 150px",
              minWidth: 130,
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid rgba(232,201,109,.35)",
              fontSize: 14,
              background: "rgba(0,0,0,.28)",
              color: "#f6f0e5",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={handleQuickPrice}
          disabled={quickSaving}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            border: "none",
            background: quickSaving ? "#d1d5db" : "linear-gradient(180deg,#E8C96D 0%,#c9a34d 100%)",
            color: "#1a1a1a",
            fontSize: 14,
            fontWeight: 700,
            cursor: quickSaving ? "default" : "pointer",
          }}
        >
          {quickSaving ? "Envoi…" : "✉️ Valider & envoyer au client"}
        </button>
        {quickSent && (
          <div
            style={{
              marginTop: 8,
              padding: "9px 12px",
              borderRadius: 10,
              border: `1px solid ${quickSent.ok ? "#16a34a" : "#f59e0b"}`,
              background: quickSent.ok ? "rgba(22,163,74,.10)" : "rgba(245,158,11,.12)",
              color: quickSent.ok ? "#86efac" : "#fcd34d",
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {quickSent.ok ? "✅ " : "⚠️ "}
            {quickSent.msg}
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>{quickSent.at}</div>
          </div>
        )}
      </div>

      {/* Demande spéciale client — toujours visible pour que José la voie tout de suite */}
      {resa.message && resa.message.trim().length > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "linear-gradient(180deg, rgba(245,158,11,.18), rgba(245,158,11,.08))",
            border: "1px solid #f59e0b",
            borderRadius: 12,
            fontSize: 13,
            color: "#fcd34d",
            lineHeight: 1.45,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#fbbf24",
            }}
          >
            <span>✨ Demande spéciale</span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{resa.message}</div>
          {unreadByClient > 0 && (
            <div
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                borderRadius: 999,
                background: "rgba(239,68,68,.18)",
                color: "#fca5a5",
                fontSize: 11,
                fontWeight: 700,
              }}
              title={`${unreadByClient} message(s) chauffeur non lu(s) par le client`}
            >
              ⏳ Réponse envoyée — non lue par le client ({unreadByClient})
            </div>
          )}
        </div>
      )}

      {/* Chat client ↔ chauffeur — TOUJOURS visible, en haut de la carte,
          reste affiché même quand "Voir détail" / "Itinéraire" est ouvert. */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            background: "linear-gradient(180deg,#0a1118,#050a10)",
            border: "1px solid rgba(246,240,229,.12)",
            borderRadius: "10px 10px 0 0",
            color: "#E8C96D",
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 12px",
          }}
        >
          <span>💬 Chat avec {resa.client_name || "le client"}</span>
          {unreadCount > 0 ? (
            <span
              title={unreadTooltip}
              aria-label={unreadTooltip}
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
              }}
            >
              {unreadCount}
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                color: "#E8C96D99",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              ✓ à jour
            </span>
          )}
        </div>
        <div
          style={{
            borderLeft: "1px solid rgba(246,240,229,.12)",
            borderRight: "1px solid rgba(246,240,229,.12)",
            borderBottom: "1px solid rgba(246,240,229,.12)",
            borderRadius: "0 0 10px 10px",
            padding: 8,
            background: "rgba(0,0,0,.25)",
          }}
        >
          <InlineDriverChat reservationId={resa.id} theme="dark" />
        </div>
      </div>

      {/* Résumé km/prix — priorité à la route sélectionnée si chargée, sinon valeurs BDD */}

      {(() => {
        const previewPrix = (() => {
          const v = parseFloat((customPrix || "").trim().replace(",", "."));
          return !isNaN(v) && v > 0 ? v : null;
        })();
        const displayPrix = previewPrix ?? routes[selectedRoute]?.prix_estime ?? resa.prix_estime;
        const displayKm = routes[selectedRoute]?.distanceKm ?? resa.distance_km;
        if (!displayKm && displayPrix == null && routes.length === 0) return null;
        return (
          <div className="drv-meta">
            {displayKm != null && <span>🛣 {displayKm} km</span>}
            {displayPrix != null && (
              <span style={previewPrix != null ? { color: "#fbbf24", fontWeight: 700 } : undefined}>
                💶 {displayPrix.toFixed(2)} €{previewPrix != null ? " (perso)" : ""}
              </span>
            )}
            {previewPrix == null && routes[selectedRoute]?.tarifLabel && (
              <span style={{ color: routes[selectedRoute].tarifLabel.includes("nuit") ? "#93c5fd" : "#86efac" }}>
                {routes[selectedRoute].tarifLabel}
              </span>
            )}
          </div>
        );
      })()}

      {/* Détail expandable */}
      {expanded && (
        <>
          <hr className="drv-divider" />

          {/* Carte Google Maps */}
          <div className="drv-map" ref={mapRef} />

          {/* Itinéraires */}
          {loadingRoutes && (
            <div style={{ textAlign: "center", fontSize: 13, color: "rgba(246,240,229,.6)", padding: "10px 0" }}>
              Calcul des itinéraires…
            </div>
          )}

          {routes.length > 0 && (
            <>
              <p className="drv-section">Choisir un itinéraire</p>
              {routes.map((r, i) => (
                <div
                  key={i}
                  className={`drv-route-opt${selectedRoute === i ? " selected" : ""}`}
                  onClick={async () => {
                    setSelectedRoute(i);
                    try {
                      window.localStorage.setItem(routeStorageKey, String(i));
                    } catch {}
                    try {
                      const { error } = await (supabase as any)
                        .from("reservations")
                        .update({ distance_km: r.distanceKm, prix_estime: r.prix_estime })
                        .eq("id", resa.id);
                      if (error) throw error;
                      toast.success(`✓ ${r.distanceKm} km · ${r.prix_estime.toFixed(2)} €`);
                      onRefresh();
                    } catch (e: any) {
                      toast.error("Erreur mise à jour itinéraire : " + (e.message ?? e));
                    }
                  }}
                >
                  <div className="drv-route-opt-head">
                    <span className="drv-route-label">
                      {i === 0 ? "🏆 Recommandé" : i === 1 ? "🔀 Alternatif" : "⏱ Rapide"} — {r.summary}
                    </span>
                    <span className="drv-route-price">{r.prix_estime.toFixed(2)} €</span>
                  </div>
                  <div className="drv-route-meta">
                    <span>🛣 {r.distanceKm} km</span>
                    <span>⏱ {r.dureeMin} min</span>
                    <span style={{ color: r.tarifLabel === "Tarif jour" ? "#86efac" : "#93c5fd" }}>{r.tarifLabel}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Contact — tel / SMS / WhatsApp / Email, identique à l'admin */}
          {(resa.status === "accepted" || resa.status === "en_route" || resa.status === "arrived") &&
            (() => {
              const phone = resa.client_phone;
              const mail = resa.client_email || resa.email;
              const trackUrl = typeof window !== "undefined" ? `${window.location.origin}/reservation/${resa.id}` : "";
              const greet = `Bonjour ${resa.client_name || ""}, votre taxi Taxi City Bordeaux.`;
              const body = trackUrl ? `${greet}\nRetrouvez votre course ici : ${trackUrl}` : greet;
              const mailBody = trackUrl
                ? `Bonjour ${resa.client_name || ""},\n\nVoici le lien pour retrouver et suivre votre course en temps réel :\n${trackUrl}\n\nTaxi City Bordeaux`
                : `Bonjour ${resa.client_name || ""},\n\nTaxi City Bordeaux`;
              if (!phone && !mail) return null;
              const contactBtn: React.CSSProperties = {
                flex: "1 1 auto",
                minWidth: 78,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: "1px solid rgba(246,240,229,.12)",
                borderRadius: 12,
                padding: "10px",
                fontWeight: 700,
                fontSize: 12.5,
                textDecoration: "none",
                color: "#f6f0e5",
              };
              return (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {phone && (
                    <>
                      <a
                        href={`tel:${phone}`}
                        style={{
                          ...contactBtn,
                          background: "rgba(37,99,235,.16)",
                          borderColor: "rgba(96,165,250,.35)",
                          color: "#7dd3fc",
                        }}
                      >
                        📞 Appeler
                      </a>
                      <a
                        href={`sms:${phone}?body=${encodeURIComponent(body)}`}
                        style={{
                          ...contactBtn,
                          background: "rgba(168,85,247,.16)",
                          borderColor: "rgba(192,132,252,.35)",
                          color: "#d8b4fe",
                        }}
                      >
                        💬 SMS
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...contactBtn,
                          background: "rgba(34,197,94,.14)",
                          borderColor: "rgba(74,222,128,.35)",
                          color: "#86efac",
                        }}
                      >
                        🟢 WhatsApp
                      </a>
                    </>
                  )}
                  {mail && (
                    <a
                      href={`mailto:${mail}?subject=${encodeURIComponent("Votre course Taxi City Bordeaux")}&body=${encodeURIComponent(mailBody)}`}
                      style={{
                        ...contactBtn,
                        background: "rgba(245,158,11,.14)",
                        borderColor: "rgba(251,191,36,.35)",
                        color: "#fcd34d",
                      }}
                    >
                      ✉️ Email
                    </a>
                  )}
                </div>
              );
            })()}

          {/* Gestion avancée — visible une fois la course acceptée */}
          {(resa.status === "accepted" || resa.status === "en_route" || resa.status === "arrived") && (
            <>
              {/* Prix custom */}
              <button
                onClick={() => setCustomPrixOpen((o) => !o)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(246,240,229,.12)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f6f0e5",
                  cursor: "pointer",
                  marginBottom: customPrixOpen ? 8 : 10,
                }}
              >
                💶 {customPrixOpen ? "▲" : "▼"} Envoyer un prix personnalisé
              </button>
              {customPrixOpen && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Prix en € (ex : 18,50)"
                    value={customPrix}
                    onChange={(e) => setCustomPrix(e.target.value)}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#E8C96D";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,201,109,0.25)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(246,240,229,.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    className="drv-custom-prix-input"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(246,240,229,.2)",
                      fontSize: 16,
                      marginBottom: 8,
                      fontFamily: "'DM Sans', sans-serif",
                      background: "rgba(0,0,0,.28)",
                      color: "#f6f0e5",
                      fontWeight: 600,
                      outline: "none",
                      transition: "border-color 120ms ease, box-shadow 120ms ease",
                      WebkitAppearance: "none",
                      appearance: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleSendCustomPrix("sms")}
                      disabled={customPrixSending}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: "rgba(168,85,247,.16)",
                        border: "1px solid rgba(192,132,252,.35)",
                        color: "#d8b4fe",
                        borderRadius: 10,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      💬 SMS
                    </button>
                    <button
                      onClick={() => handleSendCustomPrix("whatsapp")}
                      disabled={customPrixSending}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: "rgba(34,197,94,.14)",
                        border: "1px solid rgba(74,222,128,.35)",
                        color: "#86efac",
                        borderRadius: 10,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🟢 WhatsApp
                    </button>
                    <button
                      onClick={() => handleSendCustomPrix("email")}
                      disabled={customPrixSending}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: "rgba(245,158,11,.14)",
                        border: "1px solid rgba(251,191,36,.35)",
                        color: "#fcd34d",
                        borderRadius: 10,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {customPrixSending ? "…" : "✉️ Email"}
                    </button>
                  </div>
                </div>
              )}

              {/* Reprogrammer l'heure */}
              <button
                onClick={() => setChangeHeureOpen((o) => !o)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(246,240,229,.12)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f6f0e5",
                  cursor: "pointer",
                  marginBottom: changeHeureOpen ? 8 : 10,
                }}
              >
                🕐 {changeHeureOpen ? "▲" : "▼"} Reprogrammer l'heure
              </button>
              {changeHeureOpen && (
                <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
                  <input
                    type="datetime-local"
                    value={newDatetime}
                    onChange={(e) => setNewDatetime(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(246,240,229,.12)",
                      fontSize: 16,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <button
                    onClick={handleChangeHeure}
                    disabled={changeHeureSending || !newDatetime}
                    className="drv-btn-primary"
                    style={{ flex: "0 0 auto", padding: "10px 16px" }}
                  >
                    {changeHeureSending ? "…" : "OK"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          {resa.status === "pending" && (
            <div className="drv-btns">
              <button className="drv-btn-danger" onClick={handleRefuse} disabled={busy}>
                Refuser
              </button>
              <button className="drv-btn-primary" onClick={handleAccept} disabled={busy}>
                {busy ? "…" : "Accepter"}
              </button>
            </div>
          )}
          {resa.status === "accepted" && (
            <>
              {(() => {
                // Utilise les coords géocodées si disponibles (plus précis que le texte brut)
                const chosen = routes[selectedRoute];
                const origCoord = chosen ? `${chosen.originLatLng.lat},${chosen.originLatLng.lng}` : resa.depart;
                const destCoord = chosen ? `${chosen.destLatLng.lat},${chosen.destLatLng.lng}` : resa.destination;
                // Waypoint milieu pour forcer le même itinéraire dans Maps
                const wp = chosen?.waypointLatLng;
                const waypointParam = wp ? `&waypoints=${wp.lat},${wp.lng}` : "";
                const waypointCoord = wp ? `${wp.lat},${wp.lng}` : null;
                // For web we percent-encode components; for native apps prefer encodeURI
                // so commas in lat,lng are preserved (Google Maps expects `lat,lng`).
                const originParam = encodeURIComponent(origCoord);
                const destinationParam = encodeURIComponent(destCoord);
                const originNative = encodeURI(origCoord);
                const destinationNative = encodeURI(destCoord);
                const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destinationParam}${waypointParam}&travelmode=driving&dir_action=navigate`;
                return (
                  <div style={{ marginBottom: 10 }}>
                    <button
                      onClick={() => {
                        const ua = navigator.userAgent;
                        const isIOS = /iPad|iPhone|iPod/.test(ua);
                        const isAndroid = /Android/.test(ua);
                        // Debug: log generated URLs to help testing
                        const debug_googleMapsWeb = googleMapsWeb;
                        const debug_wp = waypointParam || "";
                        const debug_origin = originNative;
                        const debug_destination = destinationNative;
                        const debug_android_waypoint = waypointCoord ? `${waypointCoord}` : "";
                        const debug_android_intent = `intent://maps.google.com/maps?api=1&origin=${originNative}&destination=${destinationNative}${waypointCoord ? `&waypoints=${debug_android_waypoint}` : ""}&travelmode=driving#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(googleMapsWeb)};end`;
                        const debug_android_navigation = `google.navigation:q=${destinationNative}&mode=d`;
                        console.debug("[Démarrer GPS] UA:", ua);
                        console.debug("[Démarrer GPS] origin:", debug_origin);
                        console.debug("[Démarrer GPS] destination:", debug_destination);
                        console.debug("[Démarrer GPS] waypoint:", debug_wp);
                        console.debug("[Démarrer GPS] android_intent:", debug_android_intent);
                        console.debug("[Démarrer GPS] android_navigation:", debug_android_navigation);
                        console.debug("[Démarrer GPS] web:", debug_googleMapsWeb);
                        if (isIOS) {
                          // iOS : open Google Maps app with explicit origin + waypoint + start navigation
                          const gmaps = waypointCoord
                            ? `comgooglemaps://?saddr=${originNative}&daddr=${waypointCoord}+to:${destinationNative}&directionsmode=driving&dir_action=navigate`
                            : `comgooglemaps://?saddr=${originNative}&daddr=${destinationNative}&directionsmode=driving&dir_action=navigate`;
                          window.location.href = gmaps;
                          setTimeout(() => {
                            window.location.href = googleMapsWeb;
                          }, 1200);
                        } else if (isAndroid) {
                          const androidNavigation = `google.navigation:q=${destinationNative}&mode=d`;
                          const gmapsAndroid = waypointCoord
                            ? `comgooglemaps://?saddr=${originNative}&daddr=${destinationNative}&waypoints=${waypointCoord}&directionsmode=driving&dir_action=navigate`
                            : androidNavigation;
                          const intent = `intent://maps.google.com/maps?api=1&origin=${originNative}&destination=${destinationNative}${waypointCoord ? `&waypoints=${waypointCoord}` : ""}&travelmode=driving#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(googleMapsWeb)};end`;
                          window.location.href = gmapsAndroid;
                          setTimeout(() => {
                            window.location.href = intent;
                          }, 1200);
                          setTimeout(() => {
                            window.location.href = androidNavigation;
                          }, 2400);
                          setTimeout(() => {
                            window.open(googleMapsWeb, "_blank");
                          }, 3600);
                        } else {
                          window.open(googleMapsWeb, "_blank");
                        }
                      }}
                      style={{
                        width: "100%",
                        display: "block",
                        textAlign: "center",
                        background: "linear-gradient(180deg,#e0b866,#c99b4a)",
                        color: "#0a1118",
                        border: "none",
                        borderRadius: 12,
                        padding: "13px 8px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      🗺 Lancer Google Maps
                    </button>
                  </div>
                );
              })()}
            </>
          )}

          {resa.status === "accepted" && (
            <button
              onClick={() => handleProgressStatus("en_route", "🚖 Statut : chauffeur en route vers le client")}
              disabled={progressing}
              style={{
                width: "100%",
                background: "rgba(37,99,235,.16)",
                border: "2px solid #2563eb",
                color: "#93c5fd",
                borderRadius: 12,
                padding: "12px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {progressing ? "…" : "🚖 Je pars vers le client"}
            </button>
          )}

          {(resa.status === "accepted" || resa.status === "en_route") && (
            <button
              onClick={() => handleProgressStatus("arrived", "📍 Statut : arrivé devant chez le client")}
              disabled={progressing}
              style={{
                width: "100%",
                background: "rgba(124,58,237,.16)",
                border: "2px solid #7c3aed",
                color: "#c4b5fd",
                borderRadius: 12,
                padding: "12px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {progressing ? "…" : "📍 Je suis devant chez vous"}
            </button>
          )}

          {(resa.status === "accepted" || resa.status === "en_route" || resa.status === "arrived") && (
            <button
              onClick={handleComplete}
              disabled={completing}
              style={{
                width: "100%",
                background: "rgba(34,197,94,.14)",
                border: "2px solid #16a34a",
                color: "#86efac",
                borderRadius: 12,
                padding: "12px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {completing ? "…" : "🏁 Course terminée"}
            </button>
          )}

          {/* Supprimer définitivement */}
          <button
            onClick={handleDeleteResa}
            disabled={deleting}
            style={{
              width: "100%",
              marginTop: 4,
              background: "none",
              border: "none",
              color: "#fca5a5",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              padding: "6px 0",
            }}
          >
            {deleting ? "Suppression…" : "🗑 Supprimer cette course"}
          </button>
        </>
      )}

      <button
        onClick={onToggle}
        style={{
          width: "100%",
          marginTop: 8,
          background: "none",
          border: "none",
          color: "rgba(246,240,229,.5)",
          fontSize: 12,
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        {expanded ? "▲ Réduire" : "▼ Voir détails & itinéraires"}
      </button>
    </div>
  );
}

// ── Onglet Planning ────────────────────────────────────────────────────────
function PlanningTab() {
  const [courses, setCourses] = useState<Resa[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data } = await (supabase as any)
      .from("reservations")
      .select("id,depart,destination,pickup_datetime,date_heure,status,prix_estime,distance_km")
      .gte("pickup_datetime", today.toISOString())
      .lt("pickup_datetime", tomorrow.toISOString())
      .not("status", "eq", "cancelled")
      .order("pickup_datetime", { ascending: true });
    setCourses(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-planning")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const dotColor: Record<string, string> = {
    terminee: "#94a3b8",
    completed: "#94a3b8",
    pending: "#f59e0b",
    accepted: "#22c55e",
    en_route: "#3b82f6",
    arrived: "#3b82f6",
  };

  return (
    <>
      <p className="drv-section">
        Aujourd'hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      {courses.length === 0 ? (
        <div className="drv-empty">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune course aujourd'hui</div>
        </div>
      ) : (
        courses.map((r) => (
          <div key={r.id} className="drv-planning-slot">
            <span className="drv-planning-time">{formatHeure(r.pickup_datetime ?? r.date_heure)}</span>
            <div className="drv-planning-dot" style={{ background: dotColor[r.status] ?? "#94a3b8" }} />
            <div
              className={`drv-planning-card${["terminee", "completed"].includes(r.status) ? " done" : ""}`}
              style={{ opacity: ["terminee", "completed"].includes(r.status) ? 0.5 : 1 }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f6f0e5" }}>
                <div>📍 {r.depart}</div>
                <div style={{ color: "#4ade80" }}>🏁 {r.destination}</div>
              </div>
              <div style={{ fontSize: 12, color: "rgba(246,240,229,.6)", marginTop: 2 }}>
                {r.distance_km ? `${r.distance_km} km · ` : ""}
                {r.prix_estime ? `${r.prix_estime.toFixed(2)} €` : ""}
                {["terminee", "completed"].includes(r.status) ? " · Terminée" : ""}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ── Onglet Avis ────────────────────────────────────────────────────────────
function AvisTab({ onBadgeChange }: { onBadgeChange: (n: number) => void }) {
  const [pending, setPending] = useState<Avis[]>([]);
  const [published, setPublished] = useState<Avis[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/reviews?token=${encodeURIComponent(DRIVER_TOKEN)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "chargement impossible");
      setPending(result.pending ?? []);
      setPublished(result.published ?? []);
      onBadgeChange((result.pending ?? []).length);
    } catch (e: any) {
      toast.error("Impossible de charger les avis : " + (e.message ?? e));
    }
  }, [onBadgeChange]);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-avis")
      .on("postgres_changes", { event: "*", schema: "public", table: "avis" }, load)
      .subscribe();
    const poll = setInterval(load, 15000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const moderate = async (id: string, action: "approved" | "refused") => {
    setBusy(id);
    try {
      const response = await fetch("/api/public/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-driver-token": DRIVER_TOKEN },
        body: JSON.stringify({ id, status: action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "modération impossible");
      toast.success(action === "approved" ? "Avis publié ✓" : "Avis refusé");
      load();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const removeAvis = async (id: string) => {
    if (!confirm("Supprimer définitivement cet avis ?")) return;
    setBusy(id);
    try {
      const response = await fetch("/api/public/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-driver-token": DRIVER_TOKEN },
        body: JSON.stringify({ id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "suppression impossible");
      toast.success("Avis supprimé");
      load();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const avgNote =
    published.length > 0 ? (published.reduce((s, a) => s + a.note, 0) / published.length).toFixed(1) : null;

  return (
    <>
      {pending.length > 0 && (
        <>
          <p className="drv-section">À modérer ({pending.length})</p>
          {pending.map((a) => (
            <div key={a.id} className="drv-card pending">
              <div className="drv-row">
                <span className="drv-name">{a.author_name || "Anonyme"}</span>
                <span className="drv-badge-pill drv-badge-amber">En attente</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <Stars n={a.note} />
              </div>
              <p style={{ fontSize: 13, color: "rgba(246,240,229,.8)", margin: "0 0 12px", lineHeight: 1.5 }}>
                "{a.commentaire}"
              </p>
              <div className="drv-btns">
                <button className="drv-btn-danger" disabled={!!busy} onClick={() => moderate(a.id, "refused")}>
                  {busy === a.id ? "…" : "Refuser"}
                </button>
                <button className="drv-btn-primary" disabled={!!busy} onClick={() => moderate(a.id, "approved")}>
                  {busy === a.id ? "…" : "Publier sur le site"}
                </button>
              </div>
            </div>
          ))}
          <hr className="drv-divider" />
        </>
      )}

      <p className="drv-section">Avis publiés</p>
      {published.length === 0 ? (
        <div className="drv-empty">
          <div style={{ fontSize: 13 }}>Aucun avis publié</div>
        </div>
      ) : (
        <>
          {published.map((a) => (
            <div key={a.id} className="drv-card" style={{ opacity: 0.75 }}>
              <div className="drv-row">
                <span className="drv-name">{a.author_name || "Anonyme"}</span>
                <span className="drv-badge-pill drv-badge-green">Publié</span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <Stars n={a.note} />
              </div>
              <p style={{ fontSize: 13, color: "rgba(246,240,229,.8)", margin: "0 0 8px", lineHeight: 1.5 }}>
                "{a.commentaire}"
              </p>
              <button
                onClick={() => removeAvis(a.id)}
                disabled={busy === a.id}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fca5a5",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {busy === a.id ? "…" : "🗑 Supprimer"}
              </button>
            </div>
          ))}
          {avgNote && (
            <div
              style={{
                textAlign: "center",
                marginTop: 20,
                padding: "16px 0",
                borderTop: "1px solid rgba(246,240,229,.08)",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(246,240,229,.5)", marginBottom: 4 }}>Note moyenne publiée</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#f6f0e5" }}>{avgNote}</div>
              <div style={{ fontSize: 22, color: "#f59e0b" }}>★★★★★</div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Onglet Clients ──────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<ClientAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [{ data }, { data: clientsRows }] = await Promise.all([
      (supabase as any)
        .from("reservations")
        .select("client_name,client_phone,depart,destination,prix_estime,pickup_datetime,date_heure,status")
        .not("client_phone", "is", null)
        .order("pickup_datetime", { ascending: false }),
      (supabase as any).from("clients").select("id,phone"),
    ]);

    const normalize = (p: string) => p.replace(/[^0-9]/g, "").replace(/^0/, "33");
    const idByPhone = new Map<string, string>();
    for (const c of (clientsRows ?? []) as any[]) {
      if (c.phone) idByPhone.set(normalize(c.phone), c.id);
    }

    const rows: any[] = data ?? [];
    const byPhone = new Map<string, ClientAgg>();
    for (const r of rows) {
      const phone = r.client_phone;
      if (!phone) continue;
      const existing = byPhone.get(phone);
      const isCompleted = ["terminee", "completed"].includes(r.status);
      if (!existing) {
        byPhone.set(phone, {
          id: idByPhone.get(normalize(phone)),
          phone,
          email: r.client_email ?? r.email ?? null,
          name: r.client_name || "Client",
          nbCourses: isCompleted ? 1 : 0,
          totalDepense: isCompleted ? (r.prix_estime ?? 0) : 0,
          derniereCourse: r.pickup_datetime ?? r.date_heure,
          derniereDepart: r.depart ?? "",
          derniereDestination: r.destination ?? "",
        });
      } else {
        if (isCompleted) {
          existing.nbCourses += 1;
          existing.totalDepense += r.prix_estime ?? 0;
        }
        if ((r.pickup_datetime ?? r.date_heure) > existing.derniereCourse) {
          existing.derniereCourse = r.pickup_datetime ?? r.date_heure;
          existing.derniereDepart = r.depart ?? existing.derniereDepart;
          existing.derniereDestination = r.destination ?? existing.derniereDestination;
        }
        if (!existing.name || existing.name === "Client") existing.name = r.client_name || existing.name;
        if (!existing.email && (r.client_email || r.email)) existing.email = r.client_email ?? r.email;
      }
    }

    setClients(Array.from(byPhone.values()).sort((a, b) => b.derniereCourse.localeCompare(a.derniereCourse)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("drv-clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);
  const removeClient = async (c: ClientAgg) => {
    if (!confirm(`Supprimer ${c.name} et toutes ses courses ? Action irréversible.`)) return;
    setDeletingPhone(c.phone);
    try {
      const normalize = (p: string) => p.replace(/[^0-9]/g, "").replace(/^0/, "33");
      const target = normalize(c.phone);
      const { data: allResas } = await (supabase as any).from("reservations").select("id,client_phone,telephone");
      const idsToDelete = (allResas ?? [])
        .filter((r: any) => {
          const p1 = r.client_phone ? normalize(r.client_phone) : "";
          const p2 = r.telephone ? normalize(r.telephone) : "";
          return p1 === target || p2 === target;
        })
        .map((r: any) => r.id);
      if (idsToDelete.length > 0) {
        await (supabase as any).from("avis").update({ reservation_id: null }).in("reservation_id", idsToDelete);
        const { error: delErr } = await (supabase as any).from("reservations").delete().in("id", idsToDelete);
        if (delErr) throw delErr;
      }
      if (c.id) {
        const { error } = await (supabase as any).from("clients").delete().eq("id", c.id);
        if (error) throw error;
      }
      toast.success("Client supprimé");
      load();
    } catch (e: any) {
      toast.error("Suppression impossible : " + (e.message ?? e));
    } finally {
      setDeletingPhone(null);
    }
  };

  const formatE164 = (phone: string) => {
    const normalized = phone.replace(/[^0-9]/g, "").replace(/^0/, "33");
    return normalized.startsWith("33") ? `+${normalized}` : `+${normalized}`;
  };

  const makeVcardHref = (name: string, phone: string, email?: string | null) => {
    const tel = formatE164(phone);
    const safeName = name || "Client";
    const lines = [`BEGIN:VCARD`, `VERSION:3.0`, `FN:${safeName}`, `TEL;TYPE=CELL:${tel}`];
    if (email) lines.push(`EMAIL;TYPE=INTERNET:${email}`);
    lines.push(`END:VCARD`);
    const vcard = lines.join(`\n`);
    return `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`;
  };

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const filtered = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.phone.includes(query) ||
          (c.email?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : clients;

  return (
    <>
      <input
        type="text"
        placeholder="Rechercher un client…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(246,240,229,.12)",
          fontSize: 16,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 14,
          outline: "none",
        }}
      />

      {filtered.length === 0 ? (
        <div className="drv-empty">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun client trouvé</div>
        </div>
      ) : (
        filtered.map((c) => (
          <div key={c.phone} className="drv-card">
            <div className="drv-row">
              <span className="drv-name">{c.name}</span>
              <span className="drv-badge-pill drv-badge-gray">
                {c.nbCourses} course{c.nbCourses > 1 ? "s" : ""}
              </span>
            </div>
            <div className="drv-sub" style={{ marginBottom: 6 }}>
              Dernière course : {formatDate(c.derniereCourse)}
              <br />
              <span>📍 {c.derniereDepart || "—"}</span>
              <br />
              <span>🏁 {c.derniereDestination || "—"}</span>
            </div>
            <div
              className="drv-meta"
              style={{ margin: "8px 0 12px", flexDirection: "column", display: "flex", gap: 6 }}
            >
              <span>📞 {c.phone}</span>
              {c.email ? <span>✉ {c.email}</span> : null}
              <span>💶 {c.totalDepense.toFixed(2)} € au total</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`tel:${c.phone}`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "rgba(34,197,94,.14)",
                  border: "1px solid rgba(74,222,128,.35)",
                  borderRadius: 12,
                  padding: "10px",
                  color: "#86efac",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                📞 Appeler
              </a>
              <a
                href={`sms:${c.phone}`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "rgba(37,99,235,.16)",
                  border: "1px solid rgba(96,165,250,.35)",
                  borderRadius: 12,
                  padding: "10px",
                  color: "#93c5fd",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                💬 SMS
              </a>
              <a
                href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "").replace(/^0/, "33")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "rgba(34,197,94,.14)",
                  border: "1px solid rgba(74,222,128,.35)",
                  borderRadius: 12,
                  padding: "10px",
                  color: "#86efac",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                🟢 WhatsApp
              </a>
            </div>
            <a
              href={makeVcardHref(c.name, c.phone, c.email)}
              download={`${c.name.replace(/[^a-zA-Z0-9]/g, "_") || "client"}.vcf`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                width: "100%",
                background: "rgba(37,99,235,.16)",
                border: "1px solid rgba(96,165,250,.35)",
                borderRadius: 12,
                padding: "10px",
                color: "#93c5fd",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                marginTop: 8,
              }}
            >
              📇 Enregistrer
            </a>
            <button
              onClick={() => removeClient(c)}
              disabled={deletingPhone === c.phone}
              style={{
                width: "100%",
                marginTop: 8,
                background: "none",
                border: "none",
                color: "#fca5a5",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              {deletingPhone === c.phone ? "Suppression…" : "🗑 Supprimer ce client"}
            </button>
          </div>
        ))
      )}
    </>
  );
}

// (ChatTab et DriverChatConversation retirés : le chat "haut de page" n'est
// plus affiché ; les échanges se font uniquement dans chaque carte de course.)

// ── Analytics : ouvertures du lien de suivi ────────────────────────────────
function TrackingAnalytics() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    totalOuvertures: number;
    coursesAvecSuivi: number;
    totalCourses: number;
    tauxOuverture: number;
    parJour: { jour: string; count: number }[];
    parSource: { source: string; count: number }[];
    dernierEvents: { reservation_id: string; client_name: string | null; created_at: string; source: string | null }[];
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const since30j = new Date();
      since30j.setDate(since30j.getDate() - 30);

      const [{ data: events }, { count: totalCourses }] = await Promise.all([
        (supabase as any)
          .from("tracking_events")
          .select("reservation_id, created_at, source, reservations(client_name)")
          .eq("event_type", "tracking_opened")
          .gte("created_at", since30j.toISOString())
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .in("status", ["accepted", "en_route", "arrived", "completed"])
          .gte("pickup_datetime", since30j.toISOString()),
      ]);

      const evts: any[] = events ?? [];

      const uniqueResas = new Set(evts.map((e: any) => e.reservation_id));

      const parJourMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        parJourMap.set(d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }), 0);
      }
      const sept = new Date();
      sept.setDate(sept.getDate() - 6);
      sept.setHours(0, 0, 0, 0);
      for (const e of evts) {
        const d = new Date(e.created_at);
        if (d >= sept) {
          const k = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
          parJourMap.set(k, (parJourMap.get(k) ?? 0) + 1);
        }
      }
      const parJour = Array.from(parJourMap.entries()).map(([jour, count]) => ({ jour, count }));

      const parSourceMap = new Map<string, number>();
      for (const e of evts) {
        const src = e.source ?? "direct";
        parSourceMap.set(src, (parSourceMap.get(src) ?? 0) + 1);
      }
      const parSource = Array.from(parSourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      const dernierEvents = evts.slice(0, 5).map((e: any) => ({
        reservation_id: e.reservation_id,
        client_name: e.reservations?.client_name ?? null,
        created_at: e.created_at,
        source: e.source ?? "direct",
      }));

      const tauxOuverture = totalCourses && totalCourses > 0 ? Math.round((uniqueResas.size / totalCourses) * 100) : 0;

      setData({
        totalOuvertures: evts.length,
        coursesAvecSuivi: uniqueResas.size,
        totalCourses: totalCourses ?? 0,
        tauxOuverture,
        parJour,
        parSource,
        dernierEvents,
      });
    } catch (e) {
      console.error("[TrackingAnalytics]", e);
    } finally {
      setLoading(false);
    }
  };

  const sourceEmoji: Record<string, string> = {
    push: "🔔",
    email: "✉️",
    sms: "💬",
    whatsapp: "🟢",
    direct: "🔗",
  };

  const maxJour = data ? Math.max(...data.parJour.map((d) => d.count), 1) : 1;

  return (
    <div style={{ marginTop: 4, marginBottom: 4 }}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !data) load();
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: open ? "rgba(224,184,102,.16)" : "rgba(255,255,255,.05)",
          border: `1px solid ${open ? "#c99b4a" : "rgba(246,240,229,.12)"}`,
          borderRadius: 14,
          padding: "12px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: open ? "#e0b866" : "#f6f0e5",
          cursor: "pointer",
          marginBottom: open ? 10 : 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span>📈 Analytics — Suivi client</span>
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>30 derniers jours {open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="drv-card" style={{ borderRadius: 14, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", fontSize: 13, color: "rgba(246,240,229,.6)", padding: "20px 0" }}>
              Chargement…
            </div>
          ) : !data ? (
            <div style={{ textAlign: "center", fontSize: 13, color: "rgba(246,240,229,.6)", padding: "20px 0" }}>
              Aucune donnée
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div
                  style={{
                    background: "rgba(255,255,255,.05)",
                    borderRadius: 12,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f6f0e5" }}>{data.totalOuvertures}</div>
                  <div style={{ fontSize: 10, color: "rgba(246,240,229,.6)", marginTop: 2 }}>Ouvertures</div>
                </div>
                <div
                  style={{
                    background: "rgba(34,197,94,.14)",
                    borderRadius: 12,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#86efac" }}>{data.tauxOuverture}%</div>
                  <div style={{ fontSize: 10, color: "rgba(246,240,229,.6)", marginTop: 2 }}>Taux suivi</div>
                </div>
                <div
                  style={{
                    background: "rgba(37,99,235,.16)",
                    borderRadius: 12,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#93c5fd" }}>
                    {data.coursesAvecSuivi}/{data.totalCourses}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(246,240,229,.6)", marginTop: 2 }}>Courses</div>
                </div>
              </div>

              {/* Graphique 7 jours */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(246,240,229,.5)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                7 derniers jours
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56, marginBottom: 4 }}>
                {data.parJour.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        width: "100%",
                        borderRadius: "4px 4px 0 0",
                        background: i === data.parJour.length - 1 ? "#e0b866" : "rgba(147,197,253,.35)",
                        height: `${Math.max(4, Math.round((d.count / maxJour) * 44))}px`,
                        transition: "height 0.3s ease",
                        position: "relative",
                      }}
                    >
                      {d.count > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: -16,
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#f6f0e5",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.count}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                {data.parJour.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 9,
                      color: i === data.parJour.length - 1 ? "#f6f0e5" : "rgba(246,240,229,.5)",
                      fontWeight: i === data.parJour.length - 1 ? 700 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.jour}
                  </div>
                ))}
              </div>

              {/* Par source */}
              {data.parSource.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(246,240,229,.5)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Provenance
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {data.parSource.map((s) => {
                      const total = data.parSource.reduce((acc, x) => acc + x.count, 0);
                      const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                      return (
                        <div key={s.source} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 70,
                              fontSize: 12,
                              color: "rgba(246,240,229,.8)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {sourceEmoji[s.source] ?? "🔗"} {s.source}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              background: "rgba(255,255,255,.05)",
                              borderRadius: 4,
                              overflow: "hidden",
                              height: 8,
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "#e0b866",
                                borderRadius: 4,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <span
                            style={{ fontSize: 11, fontWeight: 700, color: "#f6f0e5", width: 32, textAlign: "right" }}
                          >
                            {s.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Dernières ouvertures */}
              {data.dernierEvents.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(246,240,229,.5)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Dernières ouvertures
                  </div>
                  {data.dernierEvents.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: i < data.dernierEvents.length - 1 ? "1px solid rgba(246,240,229,.08)" : "none",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#f6f0e5" }}>
                          {e.client_name ?? "Client"}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(246,240,229,.5)" }}>
                          {sourceEmoji[e.source ?? "direct"] ?? "🔗"} {e.source ?? "direct"} · #
                          {e.reservation_id.slice(0, 6)}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(246,240,229,.5)", textAlign: "right" }}>
                        {new Date(e.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {data.totalOuvertures === 0 && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "rgba(246,240,229,.5)", fontSize: 12 }}>
                  Aucune ouverture enregistrée sur cette période.
                  <br />
                  <span style={{ fontSize: 11 }}>
                    Assure-toi que <code>suivi.$id.tsx</code> insère bien dans <code>tracking_events</code>.
                  </span>
                </div>
              )}

              <button
                onClick={load}
                disabled={loading}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(246,240,229,.12)",
                  borderRadius: 10,
                  padding: "8px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#f6f0e5",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                🔄 Rafraîchir
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Visiteurs actifs en temps réel ───────────────────────────────────────────
function VisitorCounter({
  scope,
  title,
  emptyLabel,
  singleLabel,
  pluralLabel,
  subtitle,
  emoji,
}: {
  scope: "site" | "suivi";
  title: string;
  emptyLabel: string;
  singleLabel: string;
  pluralLabel: (n: number) => string;
  subtitle: string;
  emoji: string;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const CUTOFF_MS = 90_000;

    const fetchCount = async () => {
      if (scope === "site") {
        const cutoff = new Date(Date.now() - CUTOFF_MS).toISOString();
        await (supabase as any).from("active_visitors").delete().lt("last_seen", cutoff);
      }
      const { data } = await (supabase as any).rpc("get_active_visitor_count", { p_scope: scope });
      setCount(typeof data === "number" ? data : 0);
    };

    fetchCount();
    const poll = setInterval(fetchCount, 15_000);

    return () => {
      clearInterval(poll);
    };
  }, [scope]);

  const isActive = count !== null && count > 0;

  return (
    <div
      className="drv-card"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", marginBottom: 4 }}
    >
      <span
        className={isActive ? "drv-visitor-dot-active" : undefined}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: count === null ? "#94a3b8" : isActive ? "#22c55e" : "rgba(246,240,229,.15)",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f6f0e5" }}>
          {count === null ? "…" : count === 0 ? emptyLabel : count === 1 ? singleLabel : pluralLabel(count)}
        </div>
        <div style={{ fontSize: 11, color: "rgba(246,240,229,.5)", marginTop: 1 }}>
          {title} · {subtitle}
        </div>
      </div>
      {isActive && <span style={{ fontSize: 20 }}>{emoji}</span>}
    </div>
  );
}

function ActiveVisitors() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <VisitorCounter
        scope="site"
        title="Site"
        subtitle="visiteurs sur le site"
        emptyLabel="Aucun visiteur sur le site"
        singleLabel="1 visiteur sur le site"
        pluralLabel={(n) => `${n} visiteurs sur le site`}
        emoji="🌐"
      />
      <VisitorCounter
        scope="suivi"
        title="Suivi"
        subtitle="pages /suivi actives"
        emptyLabel="Personne sur une page suivi"
        singleLabel="1 client consulte son suivi"
        pluralLabel={(n) => `${n} clients consultent leur suivi`}
        emoji="👁"
      />
    </div>
  );
}

// ── Onglet Stats ────────────────────────────────────────────────────────────
function SimulateurTab() {
  // Alias connus pour l'aéroport : "aéroport de bordeaux" seul est souvent mal
  // (ou pas) géocodé par Google, contrairement au nom officiel complet.
  // On normalise ici avant l'appel à geocodeAddress, quelle que soit la variante tapée.
  //
  // IMPORTANT : on ne matche jamais les accents sur le texte brut. Selon le
  // clavier/l'OS (iOS en particulier), un accent peut être saisi en forme
  // Unicode décomposée (e + accent combinant) plutôt que précomposée (é) —
  // une regex du type [ée] ne matche alors ni l'un ni l'autre de façon fiable.
  // On désaccentue donc d'abord tout le texte (comme dans reserver.tsx), puis
  // on matche sur des motifs ASCII purs.
  const stripAccents = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const normalizeAddress = (raw: string): string => {
    const trimmed = raw.trim();
    const n = stripAccents(trimmed);
    if (/aeroport.*(bordeaux|merignac)|(bordeaux|merignac).*aeroport/.test(n)) {
      return "Aéroport de Bordeaux-Mérignac, France";
    }
    return trimmed;
  };

  const [mode, setMode] = useState<"manuel" | "adresses">("manuel");
  const [pickupLocal, setPickupLocal] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [distanceKm, setDistanceKm] = useState("");
  const [depart, setDepart] = useState("");

  const [arrivee, setArrivee] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<{
    distanceKm: number;
    jourKm: number;
    nuitKm: number;
    prixJour: number;
    prixNuit: number;
    priseEnCharge: number;
    total: number;
    label: string;
  } | null>(null);

  // Découpage jour/nuit basé sur une durée interne uniquement — la durée
  // n'entre PAS dans le prix (tarif au km) et n'est jamais exposée dans l'UI
  // ni envoyée dans une requête.
  const computeBreakdown = (distKm: number, stepMinutes: number, pickupIso: string) => {
    const dureeS = Math.max(stepMinutes, 1) * 60;
    const pickupMs = parseAsParisTime(pickupIso).getTime();
    const stepsCount = Math.max(Math.round(dureeS / 60), 1);
    const stepMs = (dureeS * 1000) / stepsCount;
    const frac = distKm / stepsCount;
    let jourKm = 0;
    let nuitKm = 0;
    for (let s = 0; s < stepsCount; s++) {
      const t = new Date(pickupMs + s * stepMs).toISOString();
      if (estTarifJourParis(t)) jourKm += frac;
      else nuitKm += frac;
    }
    const prixJour = jourKm * TARIFS.TARIF_JOUR;
    const prixNuit = nuitKm * TARIFS.TARIF_NUIT;
    const total = Math.round((TARIFS.PRISE_EN_CHARGE + prixJour + prixNuit) * 100) / 100;
    const label = jourKm > 0.01 && nuitKm > 0.01 ? "Tarif mixte 🌗" : nuitKm > 0.01 ? "Tarif nuit 🌙" : "Tarif jour ☀️";
    return {
      distanceKm: distKm,
      jourKm,
      nuitKm,
      prixJour,
      prixNuit,
      priseEnCharge: TARIFS.PRISE_EN_CHARGE,
      total,
      label,
    };
  };

  const handleManualCompute = () => {
    const d = parseFloat(distanceKm.replace(",", "."));
    if (!d || d <= 0) {
      toast.error("Distance invalide");
      return;
    }
    // Durée masquée : on estime 2 min par km pour le calcul mixte jour/nuit.
    const t = Math.max(Math.round(d * 2), 1);
    setResult(computeBreakdown(d, t, pickupLocal));
  };

  const handleAdressesCompute = async () => {
    if (!depart.trim() || !arrivee.trim()) {
      toast.error("Renseigne le départ et la destination");
      return;
    }
    setLoadingRoute(true);
    setRouteError(null);
    try {
      const mapsApi = await loadGoogleMapsWhenVisible(mapRef.current!);
      const [geoA, geoB] = await Promise.all([
        geocodeAddress(normalizeAddress(depart)),
        geocodeAddress(normalizeAddress(arrivee)),
      ]);
      if (!geoA || !geoB) {
        setRouteError("Adresse introuvable");
        setLoadingRoute(false);
        return;
      }
      const svc = new mapsApi.maps.DirectionsService();
      const res: any = await new Promise((resolve, reject) =>
        svc.route(
          {
            origin: { lat: geoA.lat, lng: geoA.lng },
            destination: { lat: geoB.lat, lng: geoB.lng },
            travelMode: mapsApi.maps.TravelMode.DRIVING,
          },
          (r: any, s: any) => (s === "OK" && r ? resolve(r) : reject(s)),
        ),
      );
      const leg = res.routes[0].legs[0];
      // Arrondi à 1 décimale AVANT le calcul du prix, pour que l'affichage
      // ("5.2 km × 2.16 €") corresponde exactement au prix calculé et évite
      // toute impression d'erreur de calcul (ex: 5.153 km affiché "5.2" mais
      // facturé sur la valeur brute → 11.13 € au lieu de 11.23 € attendu).
      const distKm = Math.round(((leg.distance?.value ?? 0) / 1000) * 10) / 10;
      const stepMinutes = Math.max(Math.round((leg.duration?.value ?? distKm * 120) / 60), 1);
      setResult(computeBreakdown(distKm, stepMinutes, pickupLocal));
    } catch (e) {
      console.error("[SimulateurTab] route:", e);
      setRouteError("Impossible de calculer l'itinéraire — vérifie les adresses.");
    } finally {
      setLoadingRoute(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(246,240,229,.12)",
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    color: "#f6f0e5",
    background: "rgba(0,0,0,.28)",
    colorScheme: "dark",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(246,240,229,.8)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <>
      <p className="drv-section">Simulateur de tarif</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setMode("manuel")}
          style={{
            flex: 1,
            padding: "10px",
            minHeight: 44,
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            border: mode === "manuel" ? "2px solid #2563eb" : "1px solid rgba(246,240,229,.12)",
            background: mode === "manuel" ? "rgba(37,99,235,.16)" : "rgba(0,0,0,.28)",
            color: mode === "manuel" ? "#93c5fd" : "rgba(246,240,229,.8)",
          }}
        >
          🧮 Km
        </button>
        <button
          onClick={() => setMode("adresses")}
          style={{
            flex: 1,
            padding: "10px",
            minHeight: 44,
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            border: mode === "adresses" ? "2px solid #2563eb" : "1px solid rgba(246,240,229,.12)",
            background: mode === "adresses" ? "rgba(37,99,235,.16)" : "rgba(0,0,0,.28)",
            color: mode === "adresses" ? "#93c5fd" : "rgba(246,240,229,.8)",
          }}
        >
          📍 Adresses
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>📅 Heure de prise en charge</label>
        <input
          type="datetime-local"
          value={pickupLocal}
          onChange={(e) => setPickupLocal(e.target.value)}
          style={inputStyle}
        />
      </div>

      {mode === "manuel" ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>🛣 Distance (km)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 15.6"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            onClick={handleManualCompute}
            style={{
              width: "100%",
              background: "linear-gradient(180deg,#e0b866,#c99b4a)",
              color: "#0a1118",
              border: "none",
              borderRadius: 12,
              padding: "13px",
              minHeight: 46,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              marginBottom: 14,
            }}
          >
            💶 Calculer le prix
          </button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>📍 Départ</label>
            <input
              type="text"
              placeholder="Ex: 37 Rue Charles Domercq, Bordeaux"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>🏁 Destination</label>
            <input
              type="text"
              placeholder="Ex: Aéroport Bordeaux-Mérignac"
              value={arrivee}
              onChange={(e) => setArrivee(e.target.value)}
              style={inputStyle}
            />
          </div>
          {/* Élément requis (même caché) pour déclencher le chargement de Google Maps */}
          <div ref={mapRef} style={{ height: 1, overflow: "hidden" }} />
          <button
            onClick={handleAdressesCompute}
            disabled={loadingRoute}
            style={{
              width: "100%",
              background: "linear-gradient(180deg,#e0b866,#c99b4a)",
              color: "#0a1118",
              border: "none",
              borderRadius: 12,
              padding: "13px",
              minHeight: 46,
              fontSize: 14,
              fontWeight: 800,
              cursor: loadingRoute ? "default" : "pointer",
              marginBottom: 14,
              opacity: loadingRoute ? 0.7 : 1,
            }}
          >
            {loadingRoute ? "…" : "🗺 Calculer l'itinéraire et le prix"}
          </button>
          {routeError && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{routeError}</div>}
        </>
      )}

      {result && (
        <div
          style={{ border: "2px solid #c99b4a", borderRadius: 14, padding: 16, background: "rgba(255,255,255,.05)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "rgba(246,240,229,.6)" }}>🛣 {result.distanceKm.toFixed(1)} km</span>

            <span
              className="drv-badge-pill"
              style={{
                background: result.label.includes("mixte")
                  ? "rgba(217,70,239,.16)"
                  : result.label.includes("nuit")
                    ? "rgba(37,99,235,.16)"
                    : "rgba(34,197,94,.14)",
                color: result.label.includes("mixte")
                  ? "#f0abfc"
                  : result.label.includes("nuit")
                    ? "#93c5fd"
                    : "#86efac",
              }}
            >
              {result.label}
            </span>
          </div>

          <div style={{ fontSize: 13, color: "rgba(246,240,229,.8)", lineHeight: 1.9 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Prise en charge</span>
              <span>{result.priseEnCharge.toFixed(2)} €</span>
            </div>
            {result.jourKm > 0.01 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  Tarif jour ☀️ · {result.jourKm.toFixed(1)} km × {TARIFS.TARIF_JOUR.toFixed(2)} €
                </span>
                <span>{result.prixJour.toFixed(2)} €</span>
              </div>
            )}
            {result.nuitKm > 0.01 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  Tarif nuit 🌙 · {result.nuitKm.toFixed(1)} km × {TARIFS.TARIF_NUIT.toFixed(2)} €
                </span>
                <span>{result.prixNuit.toFixed(2)} €</span>
              </div>
            )}
          </div>

          <hr className="drv-divider" style={{ margin: "10px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f6f0e5" }}>Total estimé</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#f6f0e5" }}>{result.total.toFixed(2)} €</span>
          </div>
        </div>
      )}
    </>
  );
}

function StatsTab() {
  const [stats, setStats] = useState({ revenus: 0, courses: 0, km: 0, note: 0, semCourses: 0, semRevenus: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);
      monday.setHours(0, 0, 0, 0);

      const [{ data: semData }, { data: avisData }] = await Promise.all([
        (supabase as any)
          .from("reservations")
          .select("prix_estime,distance_km,pickup_datetime,date_heure")
          .gte("pickup_datetime", monday.toISOString())
          .in("status", ["terminee", "completed"]),
        (supabase as any).from("avis").select("note").eq("status", "approved"),
      ]);

      const sem: any[] = semData ?? [];
      const revenus = sem.reduce((s: number, r: any) => s + (r.prix_estime ?? 0), 0);
      const km = sem.reduce((s: number, r: any) => s + (r.distance_km ?? 0), 0);
      const note = avisData?.length ? avisData.reduce((s: number, a: any) => s + a.note, 0) / avisData.length : 0;

      setStats({
        revenus: Math.round(revenus),
        courses: sem.length,
        km: Math.round(km),
        note: Math.round(note * 10) / 10,
        semCourses: sem.length,
        semRevenus: Math.round(revenus),
      });
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="drv-empty">
        <div style={{ fontSize: 14 }}>Chargement…</div>
      </div>
    );

  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <>
      <p className="drv-section">Cette semaine</p>
      <div className="drv-stat-grid">
        <div className="drv-stat">
          <div className="drv-stat-lbl">Revenus</div>
          <div className="drv-stat-val">{stats.revenus} €</div>
          <div className="drv-stat-sub">semaine en cours</div>
        </div>
        <div className="drv-stat">
          <div className="drv-stat-lbl">Courses</div>
          <div className="drv-stat-val">{stats.courses}</div>
          <div className="drv-stat-sub">cette semaine</div>
        </div>
        <div className="drv-stat">
          <div className="drv-stat-lbl">Km parcourus</div>
          <div className="drv-stat-val">{stats.km}</div>
          <div className="drv-stat-sub">km cette semaine</div>
        </div>
        <div className="drv-stat">
          <div className="drv-stat-lbl">Note moyenne</div>
          <div className="drv-stat-val">{stats.note > 0 ? stats.note : "—"}</div>
          <div className="drv-stat-sub" style={{ color: "#f59e0b" }}>
            {stats.note > 0 ? "★ sur 5" : "Pas encore d'avis"}
          </div>
        </div>
      </div>

      {/* Barre jours de la semaine */}
      <p className="drv-section">Jours de la semaine</p>
      <div className="drv-card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, marginBottom: 6 }}>
          {days.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  flex: 1,
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  background: i === todayIdx ? "#e0b866" : "rgba(246,240,229,.15)",
                  minHeight: i === todayIdx ? 40 : 20,
                  alignSelf: "flex-end",
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {days.map((d, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 11,
                color: i === todayIdx ? "#f6f0e5" : "rgba(246,240,229,.5)",
                fontWeight: i === todayIdx ? 700 : 400,
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Visiteurs actifs */}
      <p className="drv-section">En ce moment</p>
      <ActiveVisitors />

      {/* Analytics suivi */}
      <TrackingAnalytics />

      {/* Diagnostic push */}
      <PushDiagnostic />
    </>
  );
}

// ── Mini diagnostic des échecs push (remplace l'ancien lien /admin/dashboard) ──
function PushDiagnostic() {
  const fetchFailures = useServerFn(listPushFailures);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFailures({ data: { pin: DRIVER_TOKEN, only_price_update: false, limit: 30 } });
      setRows((res as any)?.failures ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && rows.length === 0) load();
        }}
        style={{
          width: "100%",
          textAlign: "center",
          background: "none",
          border: "none",
          color: "rgba(246,240,229,.5)",
          fontSize: 12,
          cursor: "pointer",
          padding: "8px 0",
        }}
      >
        {open ? "▲ Masquer le diagnostic push" : "▼ Diagnostic notifications push"}
      </button>
      {open && (
        <div className="drv-card">
          {loading ? (
            <div style={{ fontSize: 13, color: "rgba(246,240,229,.6)", textAlign: "center" }}>Chargement…</div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(246,240,229,.6)", textAlign: "center" }}>
              Aucun échec récent ✨
            </div>
          ) : (
            rows.map((r: any) => (
              <div
                key={r.id}
                style={{ fontSize: 11.5, padding: "6px 0", borderBottom: "1px solid rgba(246,240,229,.08)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "#f6f0e5", fontWeight: 600 }}>
                  <span>
                    {r.audience} · {r.http_status ?? "—"} {r.error_code ?? ""}
                  </span>
                  <span style={{ color: "rgba(246,240,229,.5)" }}>
                    {new Date(r.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div style={{ color: "rgba(246,240,229,.6)" }}>{r.title ?? ""}</div>
              </div>
            ))
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              marginTop: 10,
              width: "100%",
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(246,240,229,.12)",
              borderRadius: 10,
              padding: "8px",
              fontSize: 12,
              fontWeight: 700,
              color: "#f6f0e5",
              cursor: "pointer",
            }}
          >
            🔄 Rafraîchir
          </button>
        </div>
      )}
    </div>
  );
}
