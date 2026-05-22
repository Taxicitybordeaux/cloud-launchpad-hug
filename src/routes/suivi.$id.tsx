import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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

function SuiviPage() {
  const { id } = Route.useParams();
  const [resa, setResa] = useState<Reservation | null>(null);
  const [taxiPos, setTaxiPos] = useState<TaxiPos | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareMsg, setShareMsg] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const { status: pushStatus, subscribe } = usePushNotifications();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const taxiMarker = useRef<any>(null);
  const routeLayer = useRef<any>(null); // tracé taxi → point de RDV
  const tripLayer = useRef<any>(null); // tracé départ → destination de la course
  const fromMarker = useRef<any>(null);
  const toMarker = useRef<any>(null);

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
      setResa(r);
      setLoading(false);
    };
    load();
  }, [id]);

  // ── Init carte ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
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
      const map = L.map(mapRef.current, {
        center: [44.8378, -0.5792],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;
      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 200);
    };
    init();
    return () => {
      mounted = false;
      mapInst.current?.remove();
      mapInst.current = null;
    };
  }, []);

  // ── Afficher tracé de la course (départ → destination) ───────────────────
  useEffect(() => {
    if (!resa || !mapReady) return;
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L) return;

    const drawTrip = async () => {
      const depAddr = resa.depart;
      const arrAddr = resa.arrivee || resa.destination;
      if (!depAddr || !arrAddr) return;

      const [depGeo, arrGeo] = await Promise.all([
        geocodeAddress(depAddr + ", Bordeaux, France").catch(() => null),
        geocodeAddress(arrAddr + ", Bordeaux, France").catch(() => null),
      ]);
      if (!depGeo || !arrGeo) return;

      const fromLngLat: [number, number] = [depGeo.lng, depGeo.lat];
      const toLngLat: [number, number] = [arrGeo.lng, arrGeo.lat];

      // Marqueur départ
      const depIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(34,197,94,0.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      if (fromMarker.current) fromMarker.current.remove();
      fromMarker.current = L.marker([depGeo.lat, depGeo.lng], { icon: depIcon })
        .bindTooltip("Départ", { permanent: false, direction: "top" })
        .addTo(map);

      // Marqueur destination
      const arrIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#f5c842;border-radius:3px;border:3px solid #1a1a2e;box-shadow:0 0 0 4px rgba(245,200,66,0.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      if (toMarker.current) toMarker.current.remove();
      toMarker.current = L.marker([arrGeo.lat, arrGeo.lng], { icon: arrIcon })
        .bindTooltip("Destination", { permanent: false, direction: "top" })
        .addTo(map);

      // Tracé course (chemin le plus long)
      const route = await getOsrmLongestPolyline(fromLngLat, toLngLat);
      if (route && route.coords.length > 1) {
        if (tripLayer.current) {
          tripLayer.current.remove();
          tripLayer.current = null;
        }
        tripLayer.current = L.polyline(
          route.coords.map((c: [number, number]) => [c[1], c[0]]),
          { color: "#f5c842", weight: 4, opacity: 0.55, dashArray: "8 6" },
        ).addTo(map);
      }
    };

    drawTrip();
  }, [resa, mapReady]);

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

  // ── Mise à jour marqueur taxi + tracé taxi→point de RDV + ETA ────────────
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L || !taxiPos || !mapReady) return;

    const taxiIcon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:56px;height:56px;">
        <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(245,200,66,0.15);animation:gpsRing 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(245,200,66,0.1);animation:gpsRing 2s ease-out 0.6s infinite;"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(10,10,20,0.9);border:2.5px solid rgba(245,200,66,0.7);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:26px;display:block;transform:rotate(${taxiPos.heading}deg);transition:transform 0.8s cubic-bezier(.4,0,.2,1);">🚕</span>
        </div>
      </div>`,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });

    if (taxiMarker.current) {
      taxiMarker.current.setLatLng([taxiPos.lat, taxiPos.lng]);
      taxiMarker.current.setIcon(taxiIcon);
    } else {
      taxiMarker.current = L.marker([taxiPos.lat, taxiPos.lng], { icon: taxiIcon, zIndexOffset: 1000 }).addTo(map);
    }

    // Tracé taxi → point de prise en charge (départ client) en temps réel
    const drawRouteToPdv = async () => {
      if (!resa?.depart) return;
      const depGeo = await geocodeAddress(resa.depart + ", Bordeaux, France").catch(() => null);
      if (!depGeo) return;

      const taxiLngLat: [number, number] = [taxiPos.lng, taxiPos.lat];
      const depLngLat: [number, number] = [depGeo.lng, depGeo.lat];

      const route = await getOsrmLongestPolyline(taxiLngLat, depLngLat);

      if (route && route.coords.length > 1) {
        if (routeLayer.current) {
          routeLayer.current.remove();
          routeLayer.current = null;
        }
        routeLayer.current = L.polyline(
          route.coords.map((c: [number, number]) => [c[1], c[0]]),
          { color: "#22c55e", weight: 4, opacity: 0.9 },
        ).addTo(map);
      }

      // ETA taxi → point de RDV
      if (route) setEta(Math.round(route.dureeS / 60));
      else {
        // Fallback : distance à vol d'oiseau via OSRM simple
        getDistanceAndDurationKm(taxiLngLat, depLngLat).then((r) => {
          if (r) setEta(Math.round(r.durationSec / 60));
        });
      }

      // Centrer la carte sur taxi + point de RDV
      map.fitBounds(
        L.latLngBounds([
          [taxiPos.lat, taxiPos.lng],
          [depGeo.lat, depGeo.lng],
        ]).pad(0.3),
        { animate: true, duration: 0.8 },
      );
    };

    drawRouteToPdv();
  }, [taxiPos, mapReady, resa]);

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
    nouvelle: { label: "Réservation reçue", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "📋", pulse: true },
    pending: {
      label: "En attente de confirmation",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)",
      icon: "⏳",
      pulse: true,
    },
    accepted: { label: "Course confirmée", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: "✅", pulse: false },
    en_route: { label: "Chauffeur en route", color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: "🚕", pulse: true },
    arrived: { label: "Taxi à votre porte", color: "#f5c842", bg: "rgba(245,200,66,0.12)", icon: "📍", pulse: true },
    completed: { label: "Course terminée", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: "🏁", pulse: false },
    cancelled: { label: "Course annulée", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "❌", pulse: false },
    refused: { label: "Course refusée", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "🚫", pulse: false },
  };

  const statut = resa ? (statusConfig[resa.status] ?? statusConfig.pending) : statusConfig.pending;
  const arrivee = resa?.arrivee || resa?.destination || "—";
  const passagers = resa?.nb_passagers || resa?.passagers || 1;
  const prix = resa?.prix_estime ? `${Number(resa.prix_estime).toFixed(2)} €` : null;
  const distanceKm = resa?.distance_km ?? null;

  // ── Chargement ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#08080f",
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
        <style>{`@keyframes floatTaxi { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
      </div>
    );
  }

  if (!resa) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#08080f",
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
    );
  }

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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
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
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

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

        {/* Badge statut */}
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 100, animation: "fadeIn 0.4s ease" }}>
          <div
            style={{
              background: "rgba(8,8,15,0.88)",
              backdropFilter: "blur(16px)",
              borderRadius: 18,
              padding: "12px 16px",
              border: `1px solid ${statut.color}35`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
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
              <div style={{ fontSize: 13, fontWeight: 700, color: statut.color }}>{statut.label}</div>
              {eta !== null && (resa.status === "en_route" || resa.status === "arrived") && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Arrivée au point de RDV dans <span style={{ color: "#f5c842", fontWeight: 700 }}>{eta} min</span>
                </div>
              )}
              {taxiPos && resa.status === "nouvelle" && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Le chauffeur voit votre demande</div>
              )}
              {!taxiPos && (
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Position GPS non disponible</div>
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

        {/* Légende carte */}
        {(taxiPos || fromMarker.current) && (
          <div
            style={{
              position: "absolute",
              bottom: 90,
              right: 12,
              zIndex: 100,
              background: "rgba(8,8,15,0.85)",
              backdropFilter: "blur(10px)",
              borderRadius: 12,
              padding: "8px 12px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {taxiPos && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                  <div style={{ width: 18, height: 3, background: "#22c55e", borderRadius: 2 }} />
                  <span>Taxi → RDV</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
                <div style={{ width: 18, height: 3, background: "#f5c842", borderRadius: 2, opacity: 0.6 }} />
                <span>Trajet course</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM SHEET ── */}
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
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#f1f5f9",
                  fontFamily: "'Syne',sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {CHAUFFEUR.nom}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{CHAUFFEUR.vehicule}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <span style={{ color: "#f5c842", fontSize: 12 }}>★★★★★</span>
                <span style={{ color: "#475569", fontSize: 12 }}>5.0</span>
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
              <div
                style={{
                  fontSize: 10,
                  color: "#475569",
                  marginBottom: 3,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Plaque
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#f5c842",
                  letterSpacing: "0.05em",
                  fontFamily: "'Syne',sans-serif",
                }}
              >
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
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      marginBottom: 2,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Départ
                  </div>
                  <div
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
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      marginBottom: 2,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Destination
                  </div>
                  <div
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
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Prise en charge
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", lineHeight: 1.3 }}>
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
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginBottom: 3,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Distance
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>{distanceKm} km</div>
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
                <div
                  style={{
                    fontSize: 10,
                    color: "#475569",
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Pass.
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1" }}>👥 {passagers}</div>
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
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      marginBottom: 3,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Prix
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#f5c842", fontFamily: "'Syne',sans-serif" }}>
                    {prix}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              className="sheet-btn"
              onClick={() => (window.location.href = `tel:${CHAUFFEUR.phone}`)}
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#22c55e",
                fontSize: 14,
                fontWeight: 700,
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
              className="sheet-btn"
              onClick={partager}
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#94a3b8",
                fontSize: 14,
                fontWeight: 700,
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
    </div>
  );
}
