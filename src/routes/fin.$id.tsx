import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getReservationForFinPublic } from "@/lib/reservation.functions";
import { useLang } from "@/hooks/useLang";
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
  // Nominatim échoue souvent sur des adresses complexes type
  // "Aéroport Bordeaux-Mérignac — Hall A (Départs), 33700 Mérignac".
  // On tente plusieurs variantes, de la plus précise à la plus générale,
  // et on garde le premier résultat valide.
  const candidates = buildGeocodeCandidates(adresse);

  for (const candidate of candidates) {
    try {
      const c = await geocodeAddress(candidate);
      if (c) {
        // eslint-disable-next-line no-console
        console.info("[geocode] success", { original: adresse, candidate, result: c });
        return [c.lat, c.lng];
      }
    } catch {
      // on continue avec la variante suivante
    }
  }
  // eslint-disable-next-line no-console
  console.warn("[geocode] all candidates failed", { adresse, candidates });
  return null;
}

// Construit une liste de variantes d'adresse à essayer, sans perdre
// d'information à la première tentative : on retire progressivement
// les précisions les moins géocodables (parenthèses, puis détails après
// un tiret long), tout en gardant la ville/code postal.
function buildGeocodeCandidates(adresse: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.replace(/\s{2,}/g, " ").trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  // 1) Adresse complète telle que saisie
  add(adresse);

  // 2) Sans les précisions entre parenthèses (ex: "(Départs)")
  const noParens = adresse.replace(/\([^)]*\)/g, "");
  add(noParens);

  // 3) En coupant après le dernier tiret long "—" (garde nom de lieu + ville/CP)
  //    ex: "Aéroport Bordeaux-Mérignac — Hall A, 33700 Mérignac"
  //     →  "Aéroport Bordeaux-Mérignac, 33700 Mérignac"
  const parts = noParens.split("—").map((p) => p.trim());
  if (parts.length > 1) {
    const lieu = parts[0];
    const reste = parts[parts.length - 1];
    // garde le code postal/ville s'il est présent dans la dernière partie
    const cpVille = reste.match(/\d{5}\s*[A-Za-zÀ-ÿ\-' ]+/);
    add(cpVille ? `${lieu}, ${cpVille[0]}` : lieu);
    add(lieu);
  }

  // 4) Juste le nom du lieu + code postal/ville extrait de l'adresse complète
  const cpVilleGlobal = adresse.match(/\d{5}\s*[A-Za-zÀ-ÿ\-' ]+/);
  if (cpVilleGlobal) {
    const avantCp = adresse.slice(0, adresse.indexOf(cpVilleGlobal[0]));
    const nomLieu = avantCp.split(/[—,]/)[0].trim();
    if (nomLieu) add(`${nomLieu}, ${cpVilleGlobal[0]}`);
    add(cpVilleGlobal[0]);
  }

  return out;
}

// from/to en [lat, lng] ; getRouteGeoCoords (osrm.ts) attend [lng, lat]
async function getPolyline(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const result = await getRouteGeoCoords([from[1], from[0]], [to[1], to[0]]);
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

// STAR_LABELS est maintenant dynamique via t() dans FinPage

// ── Générer le PDF du reçu côté client ───────────────────────
async function genererRecuPDF(
  resa: Reservation,
  chauffeur: Chauffeur | null,
  fallback?: { distanceKm?: number | null; dureeMin?: number | null },
): Promise<void> {
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
            : fallback?.distanceKm != null
              ? `${fallback.distanceKm} km`
              : "—",
    },
    {
      label: "Durée",
      value:
        resa.duree_reelle_min != null
          ? formatDureePDF(resa.duree_reelle_min)
          : fallback?.dureeMin != null
            ? formatDureePDF(fallback.dureeMin)
            : "—",
    },
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
  doc.text("Taxi City Bordeaux — SIRET XXX XXX XXX XXXXX", W / 2, y, { align: "center" });
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
  const fetchReservationForFin = useServerFn(getReservationForFinPublic);
  const { t } = useLang();

  const STAR_LABELS = [
    "",
    t("fin.star.bad"),
    t("fin.star.ok"),
    t("fin.star.good"),
    t("fin.star.great"),
    t("fin.star.excellent"),
  ];

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

  // Fallback distance/durée calculées via OSRM si absentes en base
  const [fallbackDistanceKm, setFallbackDistanceKm] = useState<number | null>(null);
  const [fallbackDureeMin, setFallbackDureeMin] = useState<number | null>(null);

  // ── Charger données ────────────────────────────────────────
  useEffect(() => {
    // Trace id unique pour corréler tous les logs d'un même chargement /fin/$id
    const trace = `fin-${Math.random().toString(36).slice(2, 8)}`;
    const t0 = performance.now();
    const log = (step: string, extra: Record<string, unknown> = {}) => {
      // eslint-disable-next-line no-console
      console.info(`[fin.$id ${trace}] ${step}`, {
        param_id: id,
        elapsed_ms: Math.round(performance.now() - t0),
        ...extra,
      });
    };

    log("start", { is_uuid: /^[0-9a-fA-F-]{36}$/.test(id) });

    const load = async (attempt = 0) => {
      log("attempt", { attempt });
      let r: any = null;
      let lastError: any = null;

      try {
        r = await fetchReservationForFin({ data: { key: id } });
        log("server_lookup", { found: !!r });
      } catch (error: any) {
        lastError = error;
        log("server_lookup error", { message: error?.message });
      }

      if (!r) {
        if (attempt < 4) {
          log("not_found_retry", { next_attempt: attempt + 1, lastError: lastError?.message ?? null });
          setTimeout(() => load(attempt + 1), 700);
          return;
        }
        log("give_up_not_found", { lastError: lastError?.message ?? null });
        setLoading(false);
        return;
      }

      log("loaded", {
        reservation_id: r.id,
        status: r.status,
        suivi_id: r.suivi_id ?? null,
        tracking_id: r.tracking_id ?? null,
      });

      if (r.status !== "completed") {
        if (attempt < 6) {
          log("status_not_completed_retry", { status: r.status, next_attempt: attempt + 1 });
          setTimeout(() => load(attempt + 1), 700);
          return;
        }
        log("status_not_completed_redirect_suivi", { status: r.status });
        navigate({ to: "/suivi/$id", params: { id: r.suivi_id || r.tracking_id || r.id } });
        return;
      }

      setResa(r as Reservation);

      try {
        const { data: av, error: avErr } = await (supabase as any)
          .from("avis")
          .select("id,note")
          .eq("reservation_id", r.id)
          .maybeSingle();
        if (avErr) log("avis_lookup_error", { code: avErr.code, message: avErr.message });
        if (av) {
          setNote(av.note);
          setAvisEnvoye(true);
          log("avis_found", { note: av.note });
        }
      } catch (e: any) {
        log("avis_exception", { message: e?.message });
      }

      log("done");
      setLoading(false);
    };
    load();
  }, [id, navigate, fetchReservationForFin]);

  // ── Fallback distance/durée via OSRM si non renseignées ─────
  useEffect(() => {
    if (!resa) return;
    const hasDistance = resa.distance_reelle_km != null || resa.distance_km != null;
    const hasDuree = resa.duree_reelle_min != null;
    // eslint-disable-next-line no-console
    console.info("[fin.$id] fallback check", {
      hasDistance,
      hasDuree,
      distance_reelle_km: resa.distance_reelle_km,
      distance_km: resa.distance_km,
      duree_reelle_min: resa.duree_reelle_min,
    });
    if (hasDistance && hasDuree) return;

    let mounted = true;
    (async () => {
      try {
        const [fromCoord, toCoord] = await Promise.all([geocode(resa.depart), geocode(resa.destination)]);
        // eslint-disable-next-line no-console
        console.info("[fin.$id] fallback geocode", { fromCoord, toCoord });
        if (!mounted || !fromCoord || !toCoord) return;
        // getRouteGeoCoords attend [lng, lat] ; geocode() renvoie [lat, lng]
        const result = await getRouteGeoCoords([fromCoord[1], fromCoord[0]], [toCoord[1], toCoord[0]]);
        if (!mounted || !result) return;
        // eslint-disable-next-line no-console
        console.info("[fin.$id] fallback OSRM result", result);
        if (!hasDistance && typeof result.distanceKm === "number" && result.distanceKm > 0) {
          setFallbackDistanceKm(Math.round(result.distanceKm * 10) / 10);
        }
        if (!hasDuree) {
          if (typeof result.durationSec === "number" && result.durationSec > 0) {
            setFallbackDureeMin(Math.round(result.durationSec / 60));
          } else if (typeof result.distanceKm === "number" && result.distanceKm > 0) {
            // OSRM n'a pas renvoyé de durée exploitable : estimation à ~35 km/h moyen (ville/rocade)
            setFallbackDureeMin(Math.round((result.distanceKm / 35) * 60));
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[fin.$id] fallback error", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [resa]);

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
      await genererRecuPDF(resa, chauffeur, { distanceKm: fallbackDistanceKm, dureeMin: fallbackDureeMin });
      setRecuMsg(t("fin.pdf.success"));
    } catch (e) {
      console.error(e);
      setRecuMsg(t("fin.pdf.error"));
    }
    setRecuLoading(false);
    setTimeout(() => setRecuMsg(""), 4000);
  }, [resa, chauffeur, recuLoading, fallbackDistanceKm, fallbackDureeMin]);

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
      }

      const bounds = L.latLngBounds([fromCoord, toCoord]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
      setTimeout(() => map.invalidateSize(), 150);
      routeDrawn.current = true;

      const onResize = () => map.invalidateSize();
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      (map as any)._finResizeHandler = onResize;
    };

    drawMap();
    return () => {
      mounted = false;
      if (mapInst.current?._finResizeHandler) {
        window.removeEventListener("resize", mapInst.current._finResizeHandler);
        window.removeEventListener("orientationchange", mapInst.current._finResizeHandler);
      }
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
          <div style={{ color: "#64748b" }}>{t("fin.loading")}</div>
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>{t("fin.notfound")}</div>
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

        /* ── Mobile (≤480px déjà ciblé par maxWidth, ajustements ≤360px) ── */
        @media (max-width: 360px) {
          .fin-price-val { font-size: 32px !important; }
          .fin-stats-grid { gap: 6px !important; }
          .fin-stats-grid > div { padding: 10px 6px !important; }
          .fin-stats-grid .fin-stat-icon { font-size: 17px !important; }
          .fin-stats-grid .fin-stat-val { font-size: 12px !important; }
          .fin-recap-header { gap: 10px; }
          .fin-recap-logo { width: 46px !important; height: 46px !important; }
          .star-btn { font-size: 30px !important; padding: 2px !important; }
        }

        /* ── Très petits écrans : récap empile prix/logo ── */
        @media (max-width: 320px) {
          .fin-recap-header { flex-wrap: wrap; }
          .fin-recap-logo { margin-left: auto; }
        }

        /* ── Hauteur de carte adaptée aux petits écrans / paysage ── */
        .fin-map { height: 240px; }
        @media (max-height: 700px) {
          .fin-map { height: 180px !important; }
        }
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
            {t("fin.title")}
          </h1>
          <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>{t("fin.subtitle")}</p>
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
          <div
            className="fin-recap-header"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}
          >
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
                {t("fin.price_label")}
              </div>
              <div
                className="fin-price-val"
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
                {resa.paiement === "cb" ? t("fin.payment.cb") : t("fin.payment.cash")}
              </div>
            </div>
            <div
              className="fin-recap-logo"
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                overflow: "hidden",
                background: "rgba(245,200,66,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                flexShrink: 0,
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
          <div className="fin-stats-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              {
                icon: "📏",
                label: t("fin.stat.distance"),
                value:
                  resa.distance_reelle_km != null
                    ? `${resa.distance_reelle_km} km`
                    : resa.distance_km != null
                      ? `${resa.distance_km} km`
                      : fallbackDistanceKm != null
                        ? `${fallbackDistanceKm} km`
                        : "—",
              },
              {
                icon: "⏱",
                label: t("fin.stat.duration"),
                value:
                  resa.duree_reelle_min != null
                    ? formatDuree(resa.duree_reelle_min)
                    : fallbackDureeMin != null
                      ? formatDuree(fallbackDureeMin)
                      : "—",
              },
              { icon: "🛣️", label: t("fin.stat.trip"), value: t("fin.stat.trip_done") },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                style={{ background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}
              >
                <div className="fin-stat-icon" style={{ fontSize: 20, marginBottom: 4 }}>
                  {icon}
                </div>
                <div className="fin-stat-val" style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>
                  {value}
                </div>
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
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>{t("fin.route.from")}</div>
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
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>{t("fin.route.to")}</div>
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
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f5f5f5" }}>{t("fin.pdf.title")}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t("fin.pdf.subtitle")}</div>
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
            {recuLoading ? <>{t("fin.pdf.loading")}</> : <>{t("fin.pdf.download")}</>}
          </button>

          <div style={{ marginTop: 10, fontSize: 11, color: "#475569", textAlign: "center" }}>{t("fin.pdf.note")}</div>
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
              <span style={{ fontWeight: 700, fontSize: 15 }}>{t("fin.map.toggle")}</span>
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
          {showMap && <div ref={mapRef} className="fin-map" style={{ borderTop: "1px solid #2a2a4a" }} />}
        </div>

        {/* ── Notation chauffeur ── */}
        <div style={{ background: "#111120", borderRadius: 20, border: "1px solid #2a2a4a", padding: 20 }}>
          {chauffeur && (
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
          )}

          {avisEnvoye ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🙏</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e", marginBottom: 4 }}>
                {t("fin.rating.thanks")}
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {t("fin.rating.rated")} {chauffeur ? chauffeur.prenom : ""} {"★".repeat(note)}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f5f5f5", marginBottom: 4, textAlign: "center" }}>
                {t("fin.rating.title")}
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
                  {displayNote ? STAR_LABELS[displayNote] : t("fin.rating.tap")}
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
                placeholder={t("fin.rating.comment")}
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
                {avisLoading ? t("fin.rating.sending") : t("fin.rating.submit")}
              </button>
            </>
          )}
        </div>

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
            {t("fin.action.same")}
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
            {t("fin.action.new")}
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
          {t("fin.action.history")}
        </button>
      </div>
    </div>
  );
}
