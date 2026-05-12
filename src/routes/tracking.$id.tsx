import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tracking/$id")({
  head: () => ({ meta: [{ title: "Suivi de votre course – Taxi City Bordeaux" }, { name: "description", content: "Suivez votre taxi en temps réel." }, { name: "robots", content: "noindex" }] }),
  component: TrackingPage,
});

type DriverData = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  is_active: boolean;
  destination: string | null;
  prix_estime: string | null;
  updated_at: string | null;
};
type ETA = { minutes: number | null; km: string | null };

const BORDEAUX_CENTER: [number, number] = [44.8378, -0.5792];

function TrackingPage() {
  const { id } = Route.useParams();
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [eta, setEta] = useState<ETA>({ minutes: null, km: null });
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<null | { code: "invalid" | "expired" | "notfound"; title: string; message: string }>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  const calculateETA = async (lat: number, lng: number) => {
    try {
      const [dLat, dLng] = BORDEAUX_CENTER;
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dLng},${dLat}?overview=false`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setEta({ minutes: Math.ceil(data.routes[0].duration / 60), km: (data.routes[0].distance / 1000).toFixed(1) });
      }
    } catch { setEta({ minutes: null, km: null }); }
  };

  const loadLeaflet = (): Promise<void> => new Promise(resolve => {
    if ((window as any).L) { resolve(); return; }
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link");
      l.id = "leaflet-css"; l.rel = "stylesheet";
      l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    if (!document.getElementById("leaflet-js")) {
      const s = document.createElement("script");
      s.id = "leaflet-js"; s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => resolve();
      document.head.appendChild(s);
    } else resolve();
  });

  const initMap = async (lat: number, lng: number) => {
    await loadLeaflet();
    const L = (window as any).L;
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 14, zoomControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap © CARTO", maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:48px;height:48px;background:#0ea5e9;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:22px;animation:driverPulse 2s infinite">🚕</div>`,
      iconSize: [48, 48], iconAnchor: [24, 24],
    });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    mapInstanceRef.current = map;
  };

  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setElapsed(s);
      setLoadStep(s < 2 ? 0 : s < 5 ? 1 : s < 9 ? 2 : 3);
    }, 200);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sessionId);
    supabase.from("site_analytics").insert({ event: "qr_click", session_id: sessionId });

    const init = async () => {
      const { data } = await supabase.from("driver_gps").select("*").eq("id", "driver").single();
      if (data) {
        setDriverData(data as DriverData);
        if (data.latitude && data.longitude) {
          await initMap(data.latitude, data.longitude);
          await calculateETA(data.latitude, data.longitude);
          setLastUpdate(new Date());
        } else {
          await initMap(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
        }
      } else {
        await initMap(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
      }
      setLoading(false);

      channelRef.current = supabase.channel("tracking-live").on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_gps" }, async (payload) => {
        const d = payload.new as DriverData;
        setDriverData(d);
        setLastUpdate(new Date());
        if (d.latitude && d.longitude) {
          if (!mapInstanceRef.current) await initMap(d.latitude, d.longitude);
          else {
            markerRef.current?.setLatLng([d.latitude, d.longitude]);
            mapInstanceRef.current.panTo([d.latitude, d.longitude], { animate: true, duration: 1.5 });
          }
          await calculateETA(d.latitude, d.longitude);
        }
      }).subscribe();
    };
    init();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; markerRef.current = null; }
    };
  }, []);

  const styleTag = (
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
@keyframes driverPulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,0)}50%{box-shadow:0 0 0 14px rgba(14,165,233,0.15)}}
@keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
@keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes spinTaxi{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
  );

  if (loading) {
    const steps = [
      { label: "Connexion sécurisée…", icon: "🔐" },
      { label: "Recherche du chauffeur…", icon: "🔎" },
      { label: "Récupération de la position GPS…", icon: "📡" },
      { label: "Calcul de l'itinéraire…", icon: "🗺️" },
    ];
    const pct = Math.min(95, (loadStep + 1) * 24 + Math.min(elapsed * 2, 10));
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 24 }}>
        {styleTag}
        <div style={{ position: "relative", width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="110" height="110" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="55" cy="55" r="48" stroke="rgba(14,165,233,0.12)" strokeWidth="6" fill="none" />
            <circle cx="55" cy="55" r="48" stroke="#0ea5e9" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 48} strokeDashoffset={2 * Math.PI * 48 * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 0.4s ease" }} />
          </svg>
          <span style={{ fontSize: 40, animation: "spinTaxi 2s linear infinite", display: "inline-block" }}>🚕</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: "#f8fafc", marginBottom: 6 }}>{steps[loadStep].icon} {steps[loadStep].label}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#0ea5e9" }}>{Math.round(pct)}% · {elapsed}s</div>
        </div>
        <div style={{ width: "min(320px, 80vw)", display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= loadStep ? 1 : 0.35, transition: "opacity 0.3s" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: i < loadStep ? "#22c55e" : i === loadStep ? "#0ea5e9" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, animation: i === loadStep ? "liveDot 1.2s infinite" : "none" }}>{i < loadStep ? "✓" : ""}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: i <= loadStep ? "#cbd5e1" : "#475569" }}>{s.label}</span>
            </div>
          ))}
        </div>
        {elapsed > 12 && (
          <p style={{ fontSize: 12, color: "#64748b", maxWidth: 300, textAlign: "center", marginTop: 4 }}>La connexion prend plus de temps que prévu, merci de patienter…</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif" }}>
      {styleTag}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,15,30,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚕</span>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>Taxi City Bordeaux</div>
            <div style={{ fontSize: 11, color: "#475569" }}>Votre course en temps réel</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: driverData?.is_active ? "rgba(14,165,233,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${driverData?.is_active ? "rgba(14,165,233,0.3)" : "rgba(245,158,11,0.3)"}`, borderRadius: 99, padding: "5px 12px" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: driverData?.is_active ? "#0ea5e9" : "#f59e0b", display: "inline-block", animation: "liveDot 2s infinite" }} />
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, color: driverData?.is_active ? "#0ea5e9" : "#f59e0b" }}>{driverData?.is_active ? "En route" : "En attente"}</span>
        </div>
      </div>

      <div style={{ height: "52vh", position: "relative" }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {!driverData?.latitude && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,15,30,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
            <span style={{ fontSize: 44 }}>{driverData?.is_active ? "📡" : "🅿️"}</span>
            <div>
              <p style={{ color: "#f8fafc", fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>
                {driverData?.is_active ? "Acquisition de la position…" : "Le chauffeur n'est pas encore en course"}
              </p>
              <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                {driverData?.is_active
                  ? "Le GPS est actif. La carte s'affichera dans un instant."
                  : "Sa position s'affichera ici dès qu'il l'aura activée. En attendant, appelez-le directement pour réserver votre course."}
              </p>
            </div>
            {!driverData?.is_active && (
              <a href="tel:0673072322" style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: "#22c55e", color: "#fff", borderRadius: 14, textDecoration: "none", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, boxShadow: "0 6px 18px rgba(34,197,94,0.35)" }}>
                📞 06 73 07 23 22
              </a>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", display: "inline-block", animation: `liveDot 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        {lastUpdate && (
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(10,15,30,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "5px 10px" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#475569" }}>Mis à jour {lastUpdate.toLocaleTimeString("fr-FR")}</span>
          </div>
        )}
      </div>

      <div style={{ background: "#111827", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", animation: "slideUp 0.4s ease", flex: 1 }}>
        <div style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 18, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em", marginBottom: 6 }}>ARRIVÉE ESTIMÉE</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 38, fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{eta.minutes !== null ? `${eta.minutes} min` : "Calcul..."}</div>
            {eta.km && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{eta.km} km restants</div>}
          </div>
          {driverData?.prix_estime && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em", marginBottom: 6 }}>PRIX ESTIMÉ</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 900, color: "#f8fafc" }}>{driverData.prix_estime}</div>
            </div>
          )}
        </div>

        {driverData?.destination && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📍</span>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>DESTINATION</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 3 }}>{driverData.destination}</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 50, height: 50, flexShrink: 0, background: "rgba(14,165,233,0.12)", border: "2px solid rgba(14,165,233,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👨‍✈️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Taxi City Bordeaux</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Conventionné · Toutes assurances</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 1 }}>Disponible 7j/7 · 24h/24</div>
          </div>
          <a href="tel:0673072322" style={{ width: 44, height: 44, flexShrink: 0, background: "#22c55e", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, textDecoration: "none", boxShadow: "0 4px 12px rgba(34,197,94,0.35)" }}>📞</a>
        </div>

        <a href="tel:0673072322" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 52, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 14, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", textDecoration: "none", boxShadow: "0 4px 16px rgba(14,165,233,0.3)" }}>
          📞 Appeler mon chauffeur
        </a>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#1e293b" }}>Position mise à jour en temps réel · Sans application</p>
          <a href="https://taxicitybordeaux.fr" style={{ fontSize: 11, color: "#334155", textDecoration: "none" }}>taxicitybordeaux.fr</a>
        </div>
      </div>
    </div>
  );
}
