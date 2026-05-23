import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getDistanceAndDurationKm } from "@/lib/osrm";
import { geocodeAddress } from "@/lib/geocode";
import { OSM_TILE_URL, OSM_TILE_OPTIONS } from "@/lib/map";

export const Route = createFileRoute("/suivi/$id")({
  head: () => ({ meta: [{ title: "Suivi de votre taxi — Taxi City Bordeaux" }] }),
  component: SuiviPage,
});

// ── Infos chauffeur (fixes) ───────────────────────────────────────────────────
const CHAUFFEUR = {
  nom: "José",
  vehicule: "Mercedes",
  plaque: "HF 450 JG",
  phone: "0673072322",
};

// ── Leaflet loader ────────────────────────────────────────────────────────────
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
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
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

// ── OSRM : chemin le plus long avec polyline ──────────────────────────────────
async function getOsrmLongestPolyline(
  from: [number, number], // [lng, lat]
  to: [number, number], // [lng, lat]
): Promise<{ coords: [number, number][]; distanceKm: number; dureeS: number } | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=full&geometries=geojson&alternatives=3&steps=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.routes?.length) return null;
    const longest = json.routes.reduce((b: any, r: any) => (r.distance > b.distance ? r : b));
    return {
      coords: (longest.geometry?.coordinates ?? []) as [number, number][],
      distanceKm: Math.round((longest.distance / 1000) * 10) / 10,
      dureeS: Math.round(longest.duration),
    };
  } catch {
    return null;
  }
}

interface Reservation {
  id: string;
  depart: string;
  arrivee?: string;
  destination?: string;
  pickup_datetime?: string;
  date_course?: string;
  heure_course?: string;
  status: string;
  client_name?: string;
  nom?: string;
  client_phone?: string;
  telephone?: string;
  prix_estime?: string | number;
  nb_passagers?: number;
  passagers?: number;
  tracking_id?: string;
  distance_km?: number;
}

interface TaxiPos {
  lat: number;
  lng: number;
  heading: number;
}

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

// Distance en mètres entre deux coords GPS
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Seuil (mètres) pour considérer que le taxi est arrivé à destination
const ARRIVAL_THRESHOLD_M = 120;

function SuiviPage() {
  const { id } = Route.useParams();
  const [resa, setResa] = useState<Reservation | null>(null);
  const [taxiPos, setTaxiPos] = useState<TaxiPos | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareMsg, setShareMsg] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [courseTerminee, setCourseTerminee] = useState(false);
  const { status: pushStatus, subscribe } = usePushNotifications();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const taxiMarker = useRef<any>(null);
  const routeLayer = useRef<any>(null); // tracé taxi → point de RDV / destination
  const tripLayer = useRef<any>(null); // tracé départ → destination (pointillés)
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);
  // Coords géocodées en cache pour éviter les appels répétés
  const depGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  const arrGeoRef = useRef<{ lat: number; lng: number } | null>(null);
  // Interpolation fluide du marqueur taxi
  const taxiAnimRef = useRef<{ from: [number,number]; to: [number,number]; startTs: number; rafId: number } | null>(null);

  // ── Chargement réservation ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      let r: Reservation | null = null;
      const { data: byTracking } = await (supabase as any)
        .from("reservations")
        .select(
          "id,depart,arrivee,destination,pickup_datetime,date_course,heure_course,status,client_name,nom,client_phone,telephone,prix_estime,nb_passagers,passagers,tracking_id,distance_km",
        )
        .eq("tracking_id", id)
        .maybeSingle();
      if (byTracking) {
        r = byTracking;
      } else {
        const { data: byId } = await (supabase as any)
          .from("reservations")
          .select(
            "id,depart,arrivee,destination,pickup_datetime,date_course,heure_course,status,client_name,nom,client_phone,telephone,prix_estime,nb_passagers,passagers,tracking_id,distance_km",
          )
          .eq("id", id)
          .maybeSingle();
        r = byId;
      }
      if (r && ["completed", "terminee", "terminée"].includes(r.status)) setCourseTerminee(true);
      setResa(r);
      setLoading(false);
    };
    load();
  }, [id]);

  // ── Init carte + drawTrip ────────────────────────────────────────────────
  // On fusionne init et drawTrip : dès que la carte est prête ET resa chargée,
  // on dessine immédiatement sans passer par un state intermédiaire mapReady
  // qui causait des race conditions (resa arrivait avant mapReady).
  const resaRef = useRef<Reservation | null>(null);
  resaRef.current = resa;

  const drawTripOnMap = useCallback(async (map: any, L: any, r: Reservation) => {
    const depAddr = r.depart;
    const arrAddr = r.arrivee || r.destination;
    if (!depAddr || !arrAddr) return;

    const [depGeo, arrGeo] = await Promise.all([
      geocodeAddress(depAddr + ", Bordeaux, France").catch(() => null),
      geocodeAddress(arrAddr + ", Bordeaux, France").catch(() => null),
    ]);
    if (!depGeo || !arrGeo) return;

    depGeoRef.current = depGeo;
    arrGeoRef.current = arrGeo;

    const fromLngLat: [number, number] = [depGeo.lng, depGeo.lat];
    const toLngLat: [number, number] = [arrGeo.lng, arrGeo.lat];

    // Marqueur départ (vert)
    const depIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(34,197,94,0.25)"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    if (fromMarker.current) fromMarker.current.remove();
    fromMarker.current = L.marker([depGeo.lat, depGeo.lng], { icon: depIcon })
      .bindTooltip("Départ", { permanent: false, direction: "top" }).addTo(map);

    // Marqueur destination (jaune)
    const arrIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;background:#f97316;border-radius:3px;border:3px solid #1a1a2e;box-shadow:0 0 0 4px rgba(249,115,22,0.3)"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    if (toMarker.current) toMarker.current.remove();
    toMarker.current = L.marker([arrGeo.lat, arrGeo.lng], { icon: arrIcon })
      .bindTooltip("Destination", { permanent: false, direction: "top" }).addTo(map);

    // Tracé pointillé jaune départ → destination
    const route = await getOsrmLongestPolyline(fromLngLat, toLngLat);
    if (route && route.coords.length > 1) {
      if (tripLayer.current) { tripLayer.current.remove(); tripLayer.current = null; }
      tripLayer.current = L.polyline(
        route.coords.map((c: [number, number]) => [c[1], c[0]]),
        { color: "#f97316", weight: 6, opacity: 1, dashArray: "10 7" },
      ).addTo(map);

      map.invalidateSize();
      map.fitBounds(
        L.latLngBounds([[depGeo.lat, depGeo.lng], [arrGeo.lat, arrGeo.lng]]).pad(0.25),
        { animate: false },
      );
      setMapReady(true);
    } else {
      // Pas de route OSRM — centrer quand même sur les deux points
      map.fitBounds(
        L.latLngBounds([[depGeo.lat, depGeo.lng], [arrGeo.lat, arrGeo.lng]]).pad(0.3),
        { animate: false },
      );
      setMapReady(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initMap = async (container: HTMLDivElement) => {
      try { await loadLeaflet(); } catch { return; }
      if (!mounted) return;
      const L = (window as any).L;
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }

      const map = L.map(container, {
        center: [44.8378, -0.5792],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;

      // invalidateSize immédiat puis différé
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 300);

      // Dessiner le trajet dès que resa est disponible
      const tryDraw = () => {
        if (!mounted) return;
        const r = resaRef.current;
        if (r) {
          drawTripOnMap(map, L, r);
        } else {
          // resa pas encore là — retry dans 200ms
          setTimeout(tryDraw, 200);
        }
      };
      tryDraw();
    };

    if (mapRef.current) {
      initMap(mapRef.current);
    } else {
      const observer = new MutationObserver(() => {
        if (mapRef.current) { observer.disconnect(); initMap(mapRef.current); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => { mounted = false; observer.disconnect(); mapInst.current?.remove(); mapInst.current = null; };
    }

    return () => { mounted = false; mapInst.current?.remove(); mapInst.current = null; };
  }, [drawTripOnMap]);

  // Re-dessiner si resa change après que la carte soit déjà prête
  useEffect(() => {
    if (!resa || !mapReady || !mapInst.current) return;
    const L = (window as any).L;
    if (!L) return;
    drawTripOnMap(mapInst.current, L, resa);
  }, [resa, mapReady, drawTripOnMap]);

  // ── Position GPS temps réel du taxi ──────────────────────────────────────
  useEffect(() => {
    const loadInitial = async () => {
      const { data } = await (supabase as any)
        .from("driver_gps")
        .select("latitude,longitude,heading,is_active")
        .eq("id", "driver")
        .maybeSingle();
      if (data?.is_active && data.latitude) {
        setTaxiPos({ lat: data.latitude, lng: data.longitude, heading: data.heading ?? 0 });
      }
    };
    loadInitial();

    const channel = (supabase as any)
      .channel("taxi-gps-suivi")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "driver_gps",
          filter: "id=eq.driver",
        },
        (payload: any) => {
          const d = payload.new;
          if (d?.is_active && d.latitude) {
            setTaxiPos({ lat: d.latitude, lng: d.longitude, heading: d.heading ?? 0 });
          }
        },
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  // ── Mise à jour marqueur taxi + tracé + ETA + détection fin de course ─────
  // Le marqueur se déplace en douceur via requestAnimationFrame (lerp 2s)
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L || !taxiPos || !mapReady || !resa) return;

    const heading = taxiPos.heading ?? 0;

    const makeTaxiIcon = (h: number) => L.divIcon({
      className: "",
      html: `<div style="position:relative;width:56px;height:56px;">
        <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(245,200,66,0.15);animation:gpsRing 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(245,200,66,0.1);animation:gpsRing 2s ease-out 0.6s infinite;"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(10,10,20,0.9);border:2.5px solid rgba(245,200,66,0.7);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:26px;display:block;transform:rotate(${h}deg);transition:transform 0.8s cubic-bezier(.4,0,.2,1);">🚕</span>
        </div>
      </div>`,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });

    // ── Interpolation fluide du marqueur ──────────────────────────────────
    const ANIM_DURATION = 2000; // ms — durée du glissement vers la nouvelle pos
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    if (taxiAnimRef.current) {
      cancelAnimationFrame(taxiAnimRef.current.rafId);
      taxiAnimRef.current = null;
    }

    const currentLatLng = taxiMarker.current
      ? taxiMarker.current.getLatLng()
      : null;

    const fromPos: [number, number] = currentLatLng
      ? [currentLatLng.lat, currentLatLng.lng]
      : [taxiPos.lat, taxiPos.lng];

    const toPos: [number, number] = [taxiPos.lat, taxiPos.lng];

    if (!taxiMarker.current) {
      taxiMarker.current = L.marker(fromPos, {
        icon: makeTaxiIcon(heading),
        zIndexOffset: 1000,
      }).addTo(map);
    }

    const startTs = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTs) / ANIM_DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out quad
      const lat = lerp(fromPos[0], toPos[0], ease);
      const lng = lerp(fromPos[1], toPos[1], ease);
      taxiMarker.current?.setLatLng([lat, lng]);
      if (t < 1) {
        taxiAnimRef.current!.rafId = requestAnimationFrame(animate);
      } else {
        taxiMarker.current?.setIcon(makeTaxiIcon(heading));
        taxiAnimRef.current = null;
      }
    };

    const rafId = requestAnimationFrame(animate);
    taxiAnimRef.current = { from: fromPos, to: toPos, startTs, rafId };

    // ── Tracés couleur par statut ──────────────────────────────────────────
    const isEnRoute = ["en_route", "accepted", "arrived"].includes(resa.status);
    const isEnAttente = ["nouvelle", "pending"].includes(resa.status);

    const updateRoute = async () => {
      const taxiLngLat: [number, number] = [taxiPos.lng, taxiPos.lat];

      if (isEnRoute && arrGeoRef.current) {
        // 🔵 EN ROUTE : taxi → destination
        const arrGeo = arrGeoRef.current;
        const arrLngLat: [number, number] = [arrGeo.lng, arrGeo.lat];

        // Détection fin de course
        const distToArr = distanceMeters(taxiPos.lat, taxiPos.lng, arrGeo.lat, arrGeo.lng);
        if (distToArr < ARRIVAL_THRESHOLD_M && !courseTerminee) {
          setCourseTerminee(true);
          await (supabase as any).from("reservations").update({ status: "completed" }).eq("id", resa.id);
          setResa((prev) => (prev ? { ...prev, status: "completed" } : prev));
        }

        const route = await getOsrmLongestPolyline(taxiLngLat, arrLngLat);
        if (route && route.coords.length > 1) {
          if (routeLayer.current) { routeLayer.current.remove(); routeLayer.current = null; }
          routeLayer.current = L.polyline(
            route.coords.map((c: [number, number]) => [c[1], c[0]]),
            { color: "#38bdf8", weight: 6, opacity: 1 },
          ).addTo(map);
        }
        if (route) setEta(Math.round(route.dureeS / 60));

        map.fitBounds(
          L.latLngBounds([[taxiPos.lat, taxiPos.lng], [arrGeo.lat, arrGeo.lng]]).pad(0.3),
          { animate: true, duration: 0.8 },
        );

      } else if (isEnAttente && depGeoRef.current) {
        // 🟢 EN ATTENTE : taxi → point de prise en charge
        const depGeo = depGeoRef.current;
        const depLngLat: [number, number] = [depGeo.lng, depGeo.lat];

        const route = await getOsrmLongestPolyline(taxiLngLat, depLngLat);
        if (route && route.coords.length > 1) {
          if (routeLayer.current) { routeLayer.current.remove(); routeLayer.current = null; }
          routeLayer.current = L.polyline(
            route.coords.map((c: [number, number]) => [c[1], c[0]]),
            { color: "#4ade80", weight: 6, opacity: 1 },
          ).addTo(map);
        }
        if (route) setEta(Math.round(route.dureeS / 60));
        else {
          getDistanceAndDurationKm(taxiLngLat, depLngLat).then((r) => {
            if (r) setEta(Math.round(r.durationSec / 60));
          });
        }

        map.fitBounds(
          L.latLngBounds([[taxiPos.lat, taxiPos.lng], [depGeo.lat, depGeo.lng]]).pad(0.3),
          { animate: true, duration: 0.8 },
        );

      } else if (courseTerminee) {
        // 🔴 TERMINÉE : supprimer le tracé dynamique, laisser le pointillé
        if (routeLayer.current) { routeLayer.current.remove(); routeLayer.current = null; }
      }
    };

    updateRoute();

    return () => {
      if (taxiAnimRef.current) {
        cancelAnimationFrame(taxiAnimRef.current.rafId);
        taxiAnimRef.current = null;
      }
    };
  }, [taxiPos, mapReady, resa, courseTerminee]);

  // ── Écoute changement de statut ───────────────────────────────────────────
  useEffect(() => {
    if (!resa) return;
    const channel = (supabase as any)
      .channel("resa-statut-suivi")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `id=eq.${resa.id}`,
        },
        (payload: any) => {
          const updated = { ...resa, ...payload.new };
          if (["completed", "terminee", "terminée"].includes(updated.status)) setCourseTerminee(true);
          setResa((prev) => (prev ? { ...prev, ...payload.new } : prev));
        },
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [resa?.id]);

  // ── Abonnement push auto client ───────────────────────────────────────────
  useEffect(() => {
    if (!resa || pushStatus !== "idle") return;
    subscribe("client", resa.id).catch(() => {});
  }, [resa, pushStatus, subscribe]);

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
  const prix = resa?.prix_estime ? `${Number(resa.prix_estime).toFixed(2)} €` : null;
  const distanceKm = resa?.distance_km ?? null;

  // ── NOTE : on ne fait plus de return anticipé pour loading/!resa
  // La carte doit toujours être dans le DOM dès le premier rendu
  // pour que mapRef.current soit disponible quand Leaflet se charge.
  // Les overlays loading/erreur sont affichés par-dessus la carte.

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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Syne:wght@700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        /* ── Système typographique ──────────────────────────────────────────
           • Titres / noms propres  → Syne 700-800  (identité, premium)
           • Chiffres / codes       → Space Grotesk 600-700  (lisibilité numérique)
           • Corps / labels         → DM Sans 400-600  (clarté)
        ──────────────────────────────────────────────────────────────────── */
        .typo-title   { font-family: 'Syne', sans-serif; font-weight: 800; letter-spacing: -0.025em; }
        .typo-num     { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        .typo-label   { font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; }
        .typo-body    { font-family: 'DM Sans', sans-serif; font-weight: 500; }
        @keyframes gpsRing { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideUp { from{transform:translateY(32px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .sheet-btn:active { transform:scale(0.96); }
        .leaflet-container { background:#0d1117 !important; }
        .leaflet-tooltip { background: rgba(10,10,20,0.9) !important; border: 1px solid rgba(245,200,66,0.3) !important; color: #f5c842 !important; font-weight: 700 !important; border-radius: 8px !important; }
        .leaflet-tooltip-top::before { border-top-color: rgba(245,200,66,0.3) !important; }
      `}</style>

      {/* ── MAP ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {/* La div carte est TOUJOURS dans le DOM dès le premier rendu */}
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Overlay chargement — par-dessus la carte */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#08080f",
              zIndex: 9000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 52,
                  marginBottom: 16,
                  display: "inline-block",
                  animation: "floatTaxi 1.4s ease-in-out infinite",
                }}
              >
                🚕
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>Chargement du suivi…</div>
            </div>
          </div>
        )}

        {/* Overlay réservation introuvable */}
        {!loading && !resa && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#08080f",
              zIndex: 9000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                Réservation introuvable
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>Ce lien de suivi n'est pas valide ou a expiré.</div>
            </div>
          </div>
        )}

        {/* Gradient bas */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: "linear-gradient(transparent, #08080f)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

                    {courseTerminee && (
                      <div className="typo-body" style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        Destination atteinte ✓
                      </div>
                    )}
                    {!taxiPos && !courseTerminee && (
                      <div className="typo-body" style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        Le chauffeur n'a pas encore activé son GPS
                      </div>
                    )}
                  </div>
                  {taxiPos && !courseTerminee && (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#22c55e", flexShrink: 0,
                      boxShadow: "0 0 0 3px rgba(34,197,94,0.25)",
                      animation: "pulse 2s ease-in-out infinite",
                    }} />
                  )}
                </div>

                {/* Barre de progression en 5 étapes */}
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  {steps.map((s, i) => {
                    const done = i <= idx;
                    const active = i === idx;
                    const colors = ["#f59e0b","#22c55e","#3b82f6","#f5c842","#94a3b8"];
                    const c = colors[Math.min(idx, colors.length-1)];
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 4 ? 1 : "none" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{
                            width: active ? 10 : 8,
                            height: active ? 10 : 8,
                            borderRadius: "50%",
                            background: done ? c : "rgba(255,255,255,0.12)",
                            border: active ? `2px solid ${c}` : "none",
                            boxShadow: active ? `0 0 0 3px ${c}25` : "none",
                            transition: "all 0.4s ease",
                            flexShrink: 0,
                          }} />
                          <div style={{
                            fontSize: 8,
                            color: done ? c : "#334155",
                            fontFamily: "'DM Sans',sans-serif",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            letterSpacing: "0.02em",
                          }}>
                            {stepLabels[i]}
                          </div>
                        </div>
                        {i < 4 && (
                          <div style={{
                            flex: 1,
                            height: 2,
                            background: i < idx ? c : "rgba(255,255,255,0.08)",
                            marginBottom: 14,
                            transition: "background 0.5s ease",
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
        )}


      </div>

      {/* ── BOTTOM SHEET ── */}
      {resa && (
      <div
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg, #0e0e1c 0%, #080810 100%)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -1px 0 rgba(245,200,66,0.08), 0 -20px 60px rgba(0,0,0,0.6)",
          padding: "0 0 calc(20px + env(safe-area-inset-bottom,0px)) 0",
          animation: "slideUp 0.5s cubic-bezier(.2,.8,.2,1)",
          maxHeight: "58vh",
          overflowY: "auto",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 10px" }}>
          <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 9 }} />
        </div>

        <div style={{ padding: "0 20px 4px" }}>

          {/* ── STATUT + PROGRESSION ── */}
          {(() => {
            const steps = ["pending","accepted","en_route","arrived","completed"];
            const stepLabels = ["Confirmé","Taxi parti","En route","Arrivé","Terminé"];
            const normalize = (s: string) =>
              s === "nouvelle" ? "pending"
              : (s === "terminee" || s === "terminée") ? "completed"
              : s;
            const idx = courseTerminee ? 4 : Math.max(0, steps.indexOf(normalize(effectiveStatus)));
            const stepColor = ["#f59e0b","#22c55e","#3b82f6","#f97316","#94a3b8"][Math.min(idx, 4)];

            return (
              <div style={{
                background: `linear-gradient(135deg, ${stepColor}12, rgba(255,255,255,0.02))`,
                border: `1.5px solid ${stepColor}35`,
                borderRadius: 18,
                padding: "14px 16px",
                marginBottom: 14,
              }}>
                {/* Ligne icône + label + ETA */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 13,
                    background: `${stepColor}20`,
                    border: `1.5px solid ${stepColor}50`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, flexShrink: 0,
                    animation: statut.pulse ? "pulse 2s ease-in-out infinite" : "none",
                  }}>
                    {statut.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="typo-title" style={{ fontSize: 15, color: stepColor, lineHeight: 1.2 }}>
                      {statut.label}
                    </div>
                    {eta !== null && taxiPos && !courseTerminee &&
                      ["nouvelle","pending","accepted","en_route","arrived"].includes(effectiveStatus) && (
                      <div className="typo-body" style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>
                        {["en_route","arrived","accepted"].includes(effectiveStatus)
                          ? "Arrivée dans" : "Prise en charge dans"}{" "}
                        <span className="typo-num" style={{ color: stepColor, fontSize: 16, fontWeight: 700 }}>
                          {eta}
                          <span style={{ fontSize: 11, marginLeft: 2, fontWeight: 500 }}>min</span>
                        </span>
                      </div>
                    )}
                    {courseTerminee && (
                      <div className="typo-body" style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                        Destination atteinte ✓
                      </div>
                    )}
                    {!taxiPos && !courseTerminee && (
                      <div className="typo-body" style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
                        GPS chauffeur non encore actif
                      </div>
                    )}
                  </div>
                  {taxiPos && !courseTerminee && (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: "#22c55e",
                      boxShadow: "0 0 0 4px rgba(34,197,94,0.2)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }} />
                  )}
                </div>

                {/* Barre de progression 5 étapes */}
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  {steps.map((s, i) => {
                    const done = i <= idx;
                    const active = i === idx;
                    const c = stepColor;
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "flex-start", flex: i < 4 ? 1 : "none" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{
                            width: active ? 12 : 9,
                            height: active ? 12 : 9,
                            borderRadius: "50%",
                            background: done ? c : "rgba(255,255,255,0.1)",
                            border: active ? `2px solid ${c}` : "none",
                            boxShadow: active ? `0 0 0 4px ${c}30` : "none",
                            transition: "all 0.4s ease",
                            flexShrink: 0,
                          }} />
                          <div style={{
                            fontSize: 9, fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
                            color: done ? c : "#334155", whiteSpace: "nowrap",
                          }}>
                            {stepLabels[i]}
                          </div>
                        </div>
                        {i < 4 && (
                          <div style={{
                            flex: 1, height: 2, marginTop: 5,
                            background: i < idx ? c : "rgba(255,255,255,0.07)",
                            transition: "background 0.5s ease",
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Légende tracés */}
                <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 22, height: 4, background: "#f97316", borderRadius: 2, opacity: 0.9 }} />
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans',sans-serif" }}>Trajet complet</span>
                  </div>
                  {taxiPos && !courseTerminee && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 22, height: 4, borderRadius: 2, opacity: 0.9,
                        background: ["en_route","arrived","accepted"].includes(effectiveStatus) ? "#3b82f6" : "#22c55e",
                      }} />
                      <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans',sans-serif" }}>
                        {["en_route","arrived","accepted"].includes(effectiveStatus) ? "Taxi → Destination" : "Taxi → Départ"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
                background: "rgba(245,200,66,0.1)",
                border: "1.5px solid rgba(245,200,66,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
              }}
            >
              👤
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
            {/* Trajet */}
            <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 14 }}>
              {/* Timeline */}
              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3, flexShrink: 0 }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 0 3px rgba(34,197,94,0.15)",
                  }}
                />
                <div
                  style={{
                    width: 1.5,
                    flex: 1,
                    background: "linear-gradient(#22c55e, #f5c842)",
                    margin: "4px 0",
                    opacity: 0.4,
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
              {/* Adresses */}
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
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  flex: 1,
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
                    Prix
                  </div>
                  <div className="typo-num" style={{ fontSize: 17, color: "#f5c842" }}>
                    {prix}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
        </div>
      </div>
      )} {/* fin {resa && ...} bottom sheet */}
    </div>
  );
}