import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_TILE_OPTIONS = { attribution: "© OpenStreetMap contributors", maxZoom: 19 };
import { getRouteGeoCoords } from "@/lib/osrm";

export const Route = createFileRoute("/course/$id")({
  head: () => ({ meta: [{ title: "Course en cours — Taxi City Bordeaux" }] }),
  component: CoursePage,
});

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

async function getRoute(from: [number, number], to: [number, number]) {
  try {
    // incoming coords are [lat, lng] in this file; OSRM helper expects [lng, lat]
    const res = await getRouteGeoCoords([from[1], from[0]], [to[1], to[0]]);
    if (!res) return null;
    return {
      coords: res.coords,
      dureeMin: Math.round(res.durationSec / 60),
      distanceKm: res.distanceKm.toFixed(1),
    };
  } catch {
    return null;
  }
}

import { geocodeAddress } from "@/lib/geocode";

// Géocode une adresse → coordonnées via geocode helper (retourne [lat, lng])
async function geocode(adresse: string): Promise<[number, number] | null> {
  try {
    const c = await geocodeAddress(adresse);
    if (!c) return null;
    return [c.lat, c.lng];
  } catch {
    return null;
  }
}

interface Reservation {
  id: string;
  depart: string;
  destination: string;
  status: string;
  chauffeur_id: string | null;
  prenom: string;
  nom: string;
  telephone: string;
}

interface TaxiPos {
  lat: number;
  lng: number;
  heading: number;
}

function CoursePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [resa, setResa] = useState<Reservation | null>(null);
  const [taxiPos, setTaxiPos] = useState<TaxiPos | null>(null);
  const [destCoord, setDestCoord] = useState<[number, number] | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distanceRestante, setDistanceRestante] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareMsg, setShareMsg] = useState("");
  const [tempsEcoule, setTempsEcoule] = useState(0); // secondes depuis début course
  const [suiviActif, setSuiviActif] = useState(false); // partage position passager

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const taxiMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const progressLayer = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // ── Charger la réservation ─────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: r } = await (supabase as any)
        .from("reservations")
        .select("id,depart,destination,status,chauffeur_id,prenom,nom,telephone")
        .eq("id", id)
        .single();
      if (!r) {
        setLoading(false);
        return;
      }

      // Redirections
      if (r.status === "completed") {
        navigate({ to: `/fin/${id}` });
        return;
      }
      if (r.status !== "en_route") {
        navigate({ to: `/suivi/${id}` });
        return;
      }

      setResa(r as Reservation);

      // Géocoder destination
      const coord = await geocode(r.destination);
      if (coord) setDestCoord(coord);

      setLoading(false);
    };
    load();
  }, [id, navigate]);

  // ── Timer chrono ────────────────────────────────────────────
  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTempsEcoule(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuree = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Init carte ──────────────────────────────────────────────
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
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    };
    init();
    return () => {
      mounted = false;
      mapInst.current?.remove();
      mapInst.current = null;
    };
  }, []);

  // ── Marqueur destination ────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L || !destCoord) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:40px;height:40px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(245,200,66,0.15);animation:destPulse 2s ease-in-out infinite;"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;">📍</div>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    if (destMarker.current) destMarker.current.remove();
    destMarker.current = L.marker(destCoord, { icon }).addTo(map);
  }, [destCoord]);

  // ── Position taxi realtime ──────────────────────────────────
  useEffect(() => {
    // Charger position initiale
    const loadInitial = async () => {
      const { data } = await (supabase as any)
        .from("taxi_positions")
        .select("lat,lng,heading")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .single();
      if (data?.lat) setTaxiPos({ lat: data.lat, lng: data.lng, heading: data.heading ?? 0 });
    };
    loadInitial();

    const channel = (supabase as any)
      .channel("course-taxi-pos")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "taxi_positions" }, (payload: any) => {
        const d = payload.new;
        if (d?.lat) setTaxiPos({ lat: d.lat, lng: d.lng, heading: d.heading ?? 0 });
      })
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  // ── Mettre à jour carte + ETA quand taxi bouge ─────────────
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L || !taxiPos) return;

    // Marqueur taxi
    const icon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:52px;height:52px;">
        <img src="/taxi-icon.png" alt="Taxi City Bordeaux" style="width:100%;height:100%;object-fit:contain;border-radius:16px;" onload="this.nextElementSibling.style.display='none'" onerror="this.style.display='none'" />
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px;transform:rotate(${taxiPos.heading}deg);transition:transform 0.6s ease;">🚕</div>
      </div>`,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });

    if (taxiMarker.current) {
      taxiMarker.current.setLatLng([taxiPos.lat, taxiPos.lng]);
      taxiMarker.current.setIcon(icon);
    } else {
      taxiMarker.current = L.marker([taxiPos.lat, taxiPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    }

    // Tracer route taxi → destination
    if (destCoord) {
      getRoute([taxiPos.lat, taxiPos.lng], destCoord).then((route) => {
        if (!route) return;
        setEta(route.dureeMin);
        setDistanceRestante(route.distanceKm);

        // Ligne de route restante
        if (routeLayer.current) {
          routeLayer.current.remove();
          routeLayer.current = null;
        }
        routeLayer.current = L.polyline(route.coords, {
          color: "#000000",
          weight: 6,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        // Centrer carte : englobe taxi + destination + toute la polyline
        const bounds = L.latLngBounds([[taxiPos.lat, taxiPos.lng], destCoord, ...route.coords]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
      });
    } else {
      map.setView([taxiPos.lat, taxiPos.lng], 15, { animate: true });
    }
  }, [taxiPos, destCoord]);

  // ── Écouter changement de statut → terminée ─────────────────
  useEffect(() => {
    if (!resa) return;
    const channel = (supabase as any)
      .channel("course-statut")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          if (payload.new.status === "completed") navigate({ to: `/fin/${id}` });
        },
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [resa, id, navigate]);

  // ── Partage trajet ──────────────────────────────────────────
  const partagerTrajet = useCallback(async () => {
    const url = `${window.location.origin}/suivi/${id}`;
    try {
      await navigator.share({
        title: "Je suis en taxi !",
        text: `Suivez ma course en direct`,
        url,
      });
    } catch {
      await navigator.clipboard.writeText(url);
      setShareMsg("Lien copié !");
      setTimeout(() => setShareMsg(""), 2500);
    }
  }, [id]);

  // ── Activer suivi position passager ─────────────────────────
  const toggleSuivi = useCallback(() => {
    if (suiviActif) {
      setSuiviActif(false);
      return;
    }
    navigator.geolocation?.getCurrentPosition(
      () => setSuiviActif(true),
      () => alert("Impossible d'accéder à votre position."),
    );
  }, [suiviActif]);

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
          <div
            style={{ fontSize: 52, marginBottom: 16, animation: "spin 1s linear infinite", display: "inline-block" }}
          >
            🚕
          </div>
          <div style={{ color: "#64748b" }}>Chargement de la course…</div>
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a14",
        fontFamily: "'DM Sans',sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes taxiPulse { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.2); } }
        @keyframes destPulse { 0%,100% { opacity:0.4; transform:scale(1); } 50% { opacity:1; transform:scale(1.3); } }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes courseGlow { 0%,100% { box-shadow:0 0 20px rgba(245,200,66,0.2); } 50% { box-shadow:0 0 40px rgba(245,200,66,0.5); } }
      `}</style>

      {/* ── Carte ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Badge "EN COURS" flottant */}
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 100 }}>
          <div
            style={{
              background: "rgba(10,10,20,0.92)",
              backdropFilter: "blur(14px)",
              borderRadius: 18,
              padding: "12px 18px",
              border: "1px solid rgba(245,200,66,0.35)",
              animation: "courseGlow 3s ease-in-out infinite",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 0 3px rgba(34,197,94,0.3)",
                  animation: "taxiPulse 1.5s ease-in-out infinite",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#22c55e",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Course en cours
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                  Chrono : <span style={{ color: "#f5c842", fontWeight: 700 }}>{formatDuree(tempsEcoule)}</span>
                </div>
              </div>
            </div>
            {eta !== null && (
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 22, fontWeight: 700, color: "#f5c842" }}
                >
                  {eta} min
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>avant arrivée</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom sheet ── */}
      <div
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg,#111120,#0d0d1a)",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 -1px 0 rgba(245,200,66,0.1)",
          padding: "16px 20px calc(24px + env(safe-area-inset-bottom,0px))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "slideUp 0.4s ease",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9 }} />
        </div>

        {/* Destination */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(245,200,66,0.12)",
              border: "1px solid rgba(245,200,66,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            📍
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Destination
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#f5f5f5",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 2,
              }}
            >
              {resa.destination}
            </div>
          </div>
          {distanceRestante && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{ fontFamily: "'Clash Display',sans-serif", fontSize: 18, fontWeight: 700, color: "#f5c842" }}
              >
                {distanceRestante} km
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>restants</div>
            </div>
          )}
        </div>

        {/* Barre de progression ETA */}
        {eta !== null && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>En route</span>
              <span style={{ fontSize: 12, color: "#f5c842", fontWeight: 700 }}>Arrivée dans ~{eta} min</span>
            </div>
            <div style={{ height: 6, background: "#1a1a2e", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background: "linear-gradient(90deg, #22c55e, #f5c842)",
                  width: `${Math.max(5, Math.min(95, 100 - (eta / 60) * 100))}%`,
                  transition: "width 1s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            onClick={partagerTrajet}
            style={{
              padding: "14px 10px",
              background: "#1a1a2e",
              border: "2px solid #2a2a4a",
              borderRadius: 14,
              color: "#f5f5f5",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              minHeight: 64,
            }}
          >
            <span style={{ fontSize: 20 }}>🔗</span>
            {shareMsg || "Partager ma course"}
          </button>

          <button
            onClick={toggleSuivi}
            style={{
              padding: "14px 10px",
              background: suiviActif ? "rgba(34,197,94,0.12)" : "#1a1a2e",
              border: `2px solid ${suiviActif ? "rgba(34,197,94,0.4)" : "#2a2a4a"}`,
              borderRadius: 14,
              color: suiviActif ? "#22c55e" : "#f5f5f5",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              minHeight: 64,
            }}
          >
            <span style={{ fontSize: 20 }}>{suiviActif ? "📡" : "📍"}</span>
            {suiviActif ? "Position active" : "Partager ma position"}
          </button>
        </div>

        {/* Info passager */}
        <div
          style={{
            padding: "12px 14px",
            background: "#1a1a2e",
            borderRadius: 14,
            border: "1px solid #2a2a4a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Passager
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginTop: 2 }}>
              {resa.prenom} {resa.nom}
            </div>
          </div>
          <a
            href={`tel:${resa.telephone}`}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              textDecoration: "none",
            }}
          >
            📞
          </a>
        </div>
      </div>
    </div>
  );
}
