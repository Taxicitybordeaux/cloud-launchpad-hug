import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_TILE_OPTIONS = { attribution: "© OpenStreetMap contributors", maxZoom: 19 };

export const Route = createFileRoute("/fin/$id")({
  head: () => ({ meta: [{ title: "Course terminée — Taxi City Bordeaux" }] }),
  component: FinPage,
});

// ── jsPDF loader (CDN, gratuit, 0 backend) ────────────────────
function loadJsPDF(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).jspdf?.jsPDF) {
      resolve();
      return;
    }
    const existing = document.getElementById("jspdf-js");
    if (existing) {
      const poll = setInterval(() => {
        if ((window as any).jspdf?.jsPDF) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        reject(new Error("jsPDF timeout"));
      }, 8000);
      return;
    }
    const s = document.createElement("script");
    s.id = "jspdf-js";
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("jsPDF load error"));
    document.head.appendChild(s);
  });
}

// ── Leaflet loader ────────────────────────────────────────────
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
      l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    const existing = document.getElementById("leaflet-js");
    if (existing) {
      const poll = setInterval(() => {
        if ((window as any).L) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        (window as any).L ? resolve() : reject();
      }, 8000);
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

import { geocodeAddress } from "@/lib/geocode";
import { getRouteGeoCoords } from "@/lib/osrm";

async function geocode(adresse: string): Promise<[number, number] | null> {
  try {
    const c = await geocodeAddress(adresse);
    if (!c) return null;
    return [c.lat, c.lng];
  } catch {
    return null;
  }
}

async function getPolyline(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const result = await getRouteGeoCoords(from, to);
    return result?.coords ?? [];
  } catch {
    return [];
  }
}

interface Reservation {
  id: string;
  depart: string;
  destination: string;
  status: string;
  prix_final: number | null;
  prix_estime?: number | null;
  distance_reelle_km: number | null;
  distance_km?: number | null;
  duree_reelle_min: number | null;
  chauffeur_id: string | null;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  paiement: string;
  date_course?: string;
  heure_course?: string;
}

interface Chauffeur {
  id: string;
  prenom: string;
  photo_url: string | null;
  vehicule: string;
  plaque: string;
  note_moyenne: number;
  nb_avis: number;
}

const STAR_LABELS = ["", "Mauvais", "Passable", "Bien", "Très bien", "Excellent !"];

// ── Générer le PDF du reçu côté client ───────────────────────
async function genererRecuPDF(resa: Reservation, chauffeur: Chauffeur | null): Promise<void> {
  await loadJsPDF();
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const W = 210;
  const gold = [245, 200, 66] as [number, number, number];
  const dark = [15, 15, 25] as [number, number, number];
  const gray = [100, 116, 139] as [number, number, number];
  const white = [245, 245, 245] as [number, number, number];
  const green = [34, 197, 94] as [number, number, number];

  // ── Fond dark ──
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, 297, "F");

  // ── Bande header dorée ──
  doc.setFillColor(...gold);
  doc.rect(0, 0, W, 38, "F");

  // ── Logo / titre ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...dark);
  doc.text("🚕 Taxi City Bordeaux", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("REÇU DE COURSE", 14, 28);
  doc.text(`Réf : ${resa.id.slice(0, 8).toUpperCase()}`, W - 14, 28, { align: "right" });

  // ── Date émission ──
  doc.setTextColor(...gray);
  doc.setFontSize(9);
  const now = new Date();
  const dateEmission = now.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Émis le ${dateEmission}`, W - 14, 34, { align: "right" });

  let y = 52;

  // ── Bloc récap course ──
  doc.setFillColor(26, 26, 46);
  doc.roundedRect(12, y, W - 24, 52, 4, 4, "F");

  // Prix
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...gold);
  const prixTotal = resa.prix_final != null ? resa.prix_final : (resa.prix_estime ?? null);
  doc.text(prixTotal != null ? `${prixTotal.toFixed(2)} EUR` : "Prix non renseigné", 14, y + 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(resa.paiement === "cb" ? "Paiement par carte bancaire" : "Paiement en espèces", 14, y + 24);

  // Stats ligne
  const stats = [
    {
      label: "Distance",
      value:
        resa.distance_reelle_km != null
          ? `${resa.distance_reelle_km} km`
          : resa.distance_km != null
            ? `${resa.distance_km} km`
            : "—",
    },
    { label: "Durée", value: resa.duree_reelle_min != null ? formatDureePDF(resa.duree_reelle_min) : "—" },
    { label: "Date", value: resa.date_course ?? now.toLocaleDateString("fr-FR") },
    {
      label: "Heure",
      value: resa.heure_course ?? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    },
  ];
  const colW = (W - 28) / stats.length;
  stats.forEach(({ label, value }, i) => {
    const x = 14 + i * colW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...white);
    doc.text(value, x, y + 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(label, x, y + 44);
  });

  y += 62;

  // ── Trajet ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("TRAJET", 14, y);
  y += 6;

  doc.setFillColor(26, 26, 46);
  doc.roundedRect(12, y, W - 24, 38, 4, 4, "F");

  // Point départ vert
  doc.setFillColor(...green);
  doc.circle(20, y + 11, 2.5, "F");
  doc.setFillColor(...gray);
  doc.rect(19.5, y + 13.5, 1, 10, "F");
  // Point arrivée doré
  doc.setFillColor(...gold);
  doc.circle(20, y + 27, 2.5, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Départ", 26, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...white);
  doc.text(doc.splitTextToSize(resa.depart, W - 50)[0], 26, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Arrivée", 26, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...white);
  doc.text(doc.splitTextToSize(resa.destination, W - 50)[0], 26, y + 28);

  y += 48;

  // ── Chauffeur ──
  if (chauffeur) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...gold);
    doc.text("CHAUFFEUR", 14, y);
    y += 6;

    doc.setFillColor(26, 26, 46);
    doc.roundedRect(12, y, W - 24, 30, 4, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...white);
    doc.text(chauffeur.prenom, 14, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text(`${chauffeur.vehicule}  •  Plaque : ${chauffeur.plaque}`, 14, y + 20);

    const stars = "★".repeat(Math.round(chauffeur.note_moyenne)) + "☆".repeat(5 - Math.round(chauffeur.note_moyenne));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...gold);
    doc.text(stars, W - 14, y + 12, { align: "right" });
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(`${chauffeur.note_moyenne.toFixed(1)} / 5  (${chauffeur.nb_avis} avis)`, W - 14, y + 20, {
      align: "right",
    });

    y += 40;
  }

  // ── Passager ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("PASSAGER", 14, y);
  y += 6;

  doc.setFillColor(26, 26, 46);
  doc.roundedRect(12, y, W - 24, 24, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...white);
  doc.text(`${resa.prenom} ${resa.nom}`, 14, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`${resa.email}  •  ${resa.telephone}`, 14, y + 18);

  y += 34;

  // ── Séparateur ──
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.3);
  doc.line(14, y, W - 14, y);
  y += 8;

  // ── Footer ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Taxi City Bordeaux — SIRET 000 000 000 00000", W / 2, y, { align: "center" });
  doc.text("Ce document tient lieu de reçu officiel.", W / 2, y + 6, { align: "center" });
  doc.text("Merci de votre confiance 🚕", W / 2, y + 12, { align: "center" });

  // ── Téléchargement ──
  const dateStr = now.toISOString().slice(0, 10);
  doc.save(`recu-taxi-${resa.id.slice(0, 8)}-${dateStr}.pdf`);
}

function formatDureePDF(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, "0")}`;
}

// ══════════════════════════════════════════════════════════════
function FinPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [resa, setResa] = useState<Reservation | null>(null);
  const [chauffeur, setChauffeur] = useState<Chauffeur | null>(null);
  const [loading, setLoading] = useState(true);

  // Notation
  const [note, setNote] = useState(0);
  const [hoverNote, setHoverNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [avisEnvoye, setAvisEnvoye] = useState(false);
  const [avisLoading, setAvisLoading] = useState(false);

  // Reçu PDF
  const [recuLoading, setRecuLoading] = useState(false);
  const [recuMsg, setRecuMsg] = useState("");

  // Replay carte
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const routeDrawn = useRef(false);

  // ── Charger données ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: r } = await (supabase as any)
        .from("reservations")
        .select(
          "id,depart,destination,status,prix_final,prix_estime,distance_reelle_km,distance_km,duree_reelle_min,chauffeur_id,prenom,nom,email,telephone,paiement,date_course,heure_course",
        )
        .eq("id", id)
        .single();

      if (!r) {
        setLoading(false);
        return;
      }
      if (r.status !== "completed") {
        navigate({ to: `/suivi/${id}` });
        return;
      }
      setResa(r as Reservation);

      if (r.chauffeur_id) {
        const { data: c } = await (supabase as any).from("chauffeurs").select("*").eq("id", r.chauffeur_id).single();
        if (c) setChauffeur(c as Chauffeur);
      }

      // Vérifier si avis déjà posté
      const { data: av } = await (supabase as any).from("avis").select("id,note").eq("reservation_id", id).single();
      if (av) {
        setNote(av.note);
        setAvisEnvoye(true);
      }

      setLoading(false);
    };
    load();
  }, [id, navigate]);

  // ── Soumettre avis ─────────────────────────────────────────
  const soumettreAvis = useCallback(async () => {
    if (!note || avisLoading || avisEnvoye) return;
    setAvisLoading(true);
    try {
      await (supabase as any).from("avis").insert({
        reservation_id: id,
        note,
        commentaire: commentaire.trim() || null,
      });

      if (chauffeur) {
        const newNb = chauffeur.nb_avis + 1;
        const newNote = (chauffeur.note_moyenne * chauffeur.nb_avis + note) / newNb;
        await (supabase as any)
          .from("chauffeurs")
          .update({
            note_moyenne: Math.round(newNote * 100) / 100,
            nb_avis: newNb,
          })
          .eq("id", chauffeur.id);
      }

      setAvisEnvoye(true);
    } catch (e) {
      console.error(e);
    }
    setAvisLoading(false);
  }, [note, commentaire, id, chauffeur, avisEnvoye, avisLoading]);

  // ── Télécharger le reçu PDF ────────────────────────────────
  const telechargerRecu = useCallback(async () => {
    if (!resa || recuLoading) return;
    setRecuLoading(true);
    setRecuMsg("");
    try {
      await genererRecuPDF(resa, chauffeur);
      setRecuMsg("✅ PDF téléchargé !");
    } catch (e) {
      console.error(e);
      setRecuMsg("❌ Erreur lors de la génération du PDF");
    }
    setRecuLoading(false);
    setTimeout(() => setRecuMsg(""), 4000);
  }, [resa, chauffeur, recuLoading]);

  // ── Replay carte ───────────────────────────────────────────
  useEffect(() => {
    if (!showMap || !resa || routeDrawn.current) return;
    let mounted = true;

    const drawMap = async () => {
      try {
        await loadLeaflet();
      } catch {
        return;
      }
      if (!mounted || !mapRef.current) return;
      const L = (window as any).L;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }

      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false });
      L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;

      const [fromCoord, toCoord] = await Promise.all([geocode(resa.depart), geocode(resa.destination)]);

      if (!fromCoord || !toCoord) return;

      const mkIcon = (emoji: string, color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 12px rgba(0,0,0,0.4);">${emoji}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

      L.marker(fromCoord, { icon: mkIcon("🟢", "rgba(34,197,94,0.85)") })
        .addTo(map)
        .bindPopup(`<b>Départ</b><br>${resa.depart}`);
      L.marker(toCoord, { icon: mkIcon("📍", "rgba(245,200,66,0.85)") })
        .addTo(map)
        .bindPopup(`<b>Arrivée</b><br>${resa.destination}`);

      const coords = await getPolyline(fromCoord, toCoord);
      if (coords.length > 0) {
        L.polyline(coords, { color: "#000000", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);
        L.polyline(coords, { color: "#111111", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);
        map.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 16, animate: true });
      } else {
        map.fitBounds(L.latLngBounds([fromCoord, toCoord]), { padding: [60, 60], maxZoom: 16, animate: true });
      }
      setTimeout(() => map.invalidateSize(), 150);
      routeDrawn.current = true;
    };

    drawMap();
    return () => {
      mounted = false;
    };
  }, [showMap, resa]);

  // ── Navigation ─────────────────────────────────────────────
  const nouvelleResa = () => navigate({ to: "/reserver" });
  const memeTrajet = () => {
    if (!resa) return;
    navigate({
      to: `/reserver?depart=${encodeURIComponent(resa.depart)}&destination=${encodeURIComponent(resa.destination)}`,
    });
  };

  const formatDuree = (min: number) => {
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, "0")}`;
  };

  // ── États de chargement / erreur ───────────────────────────
  if (loading)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏁</div>
          <div style={{ color: "#64748b" }}>Chargement du récapitulatif…</div>
        </div>
      </div>
    );

  if (!resa)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", color: "#f5f5f5", fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Course introuvable</div>
        </div>
      </div>
    );

  const displayNote = hoverNote || note;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a14",
        fontFamily: "'DM Sans',sans-serif",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes checkPop { 0% { transform:scale(0); } 70% { transform:scale(1.2); } 100% { transform:scale(1); } }
        @keyframes pdfPulse { 0%,100% { box-shadow:0 0 0 0 rgba(245,200,66,0.4); } 50% { box-shadow:0 0 0 8px rgba(245,200,66,0); } }
        .star-btn { background:none; border:none; cursor:pointer; padding:4px; font-size:36px; transition:transform 0.15s ease; line-height:1; }
        .star-btn:active { transform:scale(0.85); }
        textarea { resize:none; font-family:'DM Sans',sans-serif; }
        textarea:focus { outline:none; border-color:#f5c842 !important; box-shadow:0 0 0 3px rgba(245,200,66,0.15) !important; }
        button:active { transform:scale(0.97); }
      `}</style>

      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "24px 20px calc(40px + env(safe-area-inset-bottom,0px))",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          animation: "fadeIn 0.4s ease",
        }}
      >
        {/* ── Header ── */}
        <div style={{ textAlign: "center", paddingTop: 12 }}>
          <div style={{ fontSize: 64, marginBottom: 12, animation: "checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
            🏁
          </div>
          <h1
            style={{
              fontFamily: "'Clash Display',sans-serif",
              fontWeight: 700,
              fontSize: 28,
              color: "#f5f5f5",
              margin: "0 0 6px",
            }}
          >
            Course terminée !
          </h1>
          <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Merci d'avoir voyagé avec Taxi City Bordeaux</p>
        </div>

        {/* ── Récap course ── */}
        <div
          style={{
            background: "linear-gradient(135deg,#1a1408,#211808)",
            border: "1px solid rgba(245,200,66,0.25)",
            borderRadius: 20,
            padding: 20,
            boxShadow: "0 4px 24px rgba(245,200,66,0.08)",
          }}
        >
          {/* Prix */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(245,200,66,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                }}
              >
                Prix final
              </div>
              <div
                style={{
                  fontFamily: "'Clash Display',sans-serif",
                  fontSize: 40,
                  fontWeight: 700,
                  color: "#f5c842",
                  lineHeight: 1.1,
                }}
              >
                {(resa.prix_final != null ? resa.prix_final : resa.prix_estime) != null
                  ? `${(resa.prix_final != null ? resa.prix_final : resa.prix_estime)!.toFixed(2)} €`
                  : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                {resa.paiement === "cb" ? "💳 Carte bancaire" : "💵 Espèces"}
              </div>
            </div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                overflow: "hidden",
                background: "rgba(245,200,66,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/taxi-icon.png"
                alt="Taxi City Bordeaux"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(event) => {
                  const target = event.currentTarget as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
              <span style={{ fontSize: 28, position: "absolute" }}>🚕</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              {
                icon: "📏",
                label: "Distance",
                value: resa.distance_reelle_km != null ? `${resa.distance_reelle_km} km` : "—",
              },
              {
                icon: "⏱",
                label: "Durée",
                value: resa.duree_reelle_min != null ? formatDuree(resa.duree_reelle_min) : "—",
              },
              { icon: "🛣️", label: "Trajet", value: "Terminé" },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                style={{ background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{value}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Trajet */}
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4, flexShrink: 0 }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              <div style={{ width: 2, height: 20, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f5c842" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>Départ</div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f5f5f5",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 8,
                }}
              >
                {resa.depart}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>Arrivée</div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f5f5f5",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {resa.destination}
              </div>
            </div>
          </div>
        </div>

        {/* ── Reçu PDF ── */}
        <div style={{ background: "#111120", borderRadius: 20, border: "1px solid #2a2a4a", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(245,200,66,0.1)",
                border: "1px solid rgba(245,200,66,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              📄
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f5f5f5" }}>Reçu de course</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                PDF généré instantanément sur votre appareil
              </div>
            </div>
          </div>

          {recuMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: recuMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${recuMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                borderRadius: 12,
                color: recuMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {recuMsg}
            </div>
          )}

          <button
            onClick={telechargerRecu}
            disabled={recuLoading}
            style={{
              width: "100%",
              height: 52,
              background: recuLoading ? "rgba(245,200,66,0.15)" : "linear-gradient(135deg,#f5c842,#e6a800)",
              color: recuLoading ? "rgba(245,200,66,0.5)" : "#0a0a14",
              border: "none",
              borderRadius: 14,
              fontFamily: "'Clash Display',sans-serif",
              fontWeight: 700,
              fontSize: 16,
              cursor: recuLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "all 0.2s",
              animation: !recuLoading ? "pdfPulse 2s ease-in-out infinite" : "none",
            }}
          >
            {recuLoading ? <>⏳ Génération en cours…</> : <>⬇️ Télécharger le reçu PDF</>}
          </button>

          <div style={{ marginTop: 10, fontSize: 11, color: "#475569", textAlign: "center" }}>
            Gratuit · Généré sur votre appareil · Aucune donnée envoyée
          </div>
        </div>

        {/* ── Replay itinéraire ── */}
        <div style={{ background: "#111120", borderRadius: 20, border: "1px solid #2a2a4a", overflow: "hidden" }}>
          <button
            onClick={() => setShowMap((v) => !v)}
            style={{
              width: "100%",
              padding: "16px 18px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#f5f5f5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🗺️</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Revoir l'itinéraire</span>
            </div>
            <span
              style={{
                fontSize: 18,
                color: "#64748b",
                transition: "transform 0.2s",
                transform: showMap ? "rotate(180deg)" : "rotate(0)",
              }}
            >
              ▾
            </span>
          </button>
          {showMap && <div ref={mapRef} style={{ height: 240, borderTop: "1px solid #2a2a4a" }} />}
        </div>

        {/* ── Notation chauffeur ── */}
        {chauffeur && (
          <div style={{ background: "#111120", borderRadius: 20, border: "1px solid #2a2a4a", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(245,200,66,0.12)",
                  border: "2px solid rgba(245,200,66,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {chauffeur.photo_url ? (
                  <img
                    src={chauffeur.photo_url}
                    alt={chauffeur.prenom}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  "👤"
                )}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#f5f5f5" }}>{chauffeur.prenom}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{chauffeur.vehicule}</div>
                <div style={{ fontSize: 12, color: "#f5c842", marginTop: 2 }}>
                  {"★".repeat(Math.round(chauffeur.note_moyenne))}{" "}
                  <span style={{ color: "#64748b" }}>{chauffeur.note_moyenne.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {avisEnvoye ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🙏</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e", marginBottom: 4 }}>
                  Merci pour votre avis !
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Vous avez noté {chauffeur.prenom} {"★".repeat(note)}
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#f5f5f5", marginBottom: 4, textAlign: "center" }}>
                  Comment s'est passée votre course ?
                </div>
                <div style={{ textAlign: "center", marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: displayNote ? "#f5c842" : "#64748b",
                      fontWeight: 600,
                      minHeight: 20,
                      display: "inline-block",
                    }}
                  >
                    {displayNote ? STAR_LABELS[displayNote] : "Touchez une étoile"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className="star-btn"
                      onMouseEnter={() => setHoverNote(n)}
                      onMouseLeave={() => setHoverNote(0)}
                      onClick={() => setNote(n)}
                      style={{
                        fontSize: 36,
                        opacity: n <= displayNote ? 1 : 0.25,
                        filter: n <= displayNote ? "none" : "grayscale(1)",
                        transform: n === displayNote ? "scale(1.2)" : "scale(1)",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Un commentaire ? (optionnel)"
                  maxLength={300}
                  rows={3}
                  style={{
                    width: "100%",
                    background: "#1a1a2e",
                    border: "2px solid #2a2a4a",
                    borderRadius: 14,
                    padding: "12px 14px",
                    color: "#f5f5f5",
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                />

                <button
                  onClick={soumettreAvis}
                  disabled={!note || avisLoading}
                  style={{
                    width: "100%",
                    height: 52,
                    background: note ? "linear-gradient(135deg,#f5c842,#e6a800)" : "rgba(245,200,66,0.2)",
                    color: note ? "#0a0a14" : "rgba(245,200,66,0.4)",
                    border: "none",
                    borderRadius: 14,
                    fontFamily: "'Clash Display',sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: note ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {avisLoading ? "Envoi…" : "Envoyer mon avis"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Actions rapides ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            onClick={memeTrajet}
            style={{
              padding: "16px 12px",
              background: "linear-gradient(135deg,#f5c842,#e6a800)",
              border: "none",
              borderRadius: 16,
              color: "#0a0a14",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              minHeight: 72,
            }}
          >
            <span style={{ fontSize: 22 }}>🔁</span>
            Même trajet
          </button>
          <button
            onClick={nouvelleResa}
            style={{
              padding: "16px 12px",
              background: "#1a1a2e",
              border: "2px solid #2a2a4a",
              borderRadius: 16,
              color: "#f5f5f5",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              minHeight: 72,
            }}
          >
            <span style={{ fontSize: 22 }}>➕</span>
            Nouvelle course
          </button>
        </div>

        {/* ── Lien historique ── */}
        <button
          onClick={() => navigate({ to: "/mes-courses" })}
          style={{
            width: "100%",
            padding: "14px",
            background: "none",
            border: "1px solid #2a2a4a",
            borderRadius: 14,
            color: "#64748b",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          📋 Voir toutes mes courses
        </button>
      </div>
    </div>
  );
}
