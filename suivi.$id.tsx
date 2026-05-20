import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const Route = createFileRoute("/suivi/$id")({
  head: () => ({ meta: [{ title: "Suivi de votre taxi — Taxi City Bordeaux" }] }),
  component: SuiviPage,
});

// ── Leaflet loader ────────────────────────────────────────────
function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) { resolve(); return; }
    if (!document.getElementById("leaflet-css")) {
      const l = document.createElement("link");
      l.id = "leaflet-css"; l.rel = "stylesheet";
      l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(l);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      const poll = setInterval(() => { if ((window as any).L) { clearInterval(poll); resolve(); } }, 50);
      setTimeout(() => { clearInterval(poll); (window as any).L ? resolve() : reject(); }, 8000);
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js"; s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve(); s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

async function getOsrmEta(from: [number, number], to: [number, number]): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    return data.routes?.[0] ? Math.round(data.routes[0].duration / 60) : null;
  } catch { return null; }
}

async function getOsrmPolyline(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    return (data?.routes?.[0]?.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  } catch { return []; }
}

interface Reservation {
  id: string;
  depart: string;
  destination: string;
  date_course: string;
  heure_course: string;
  statut_course: string;
  chauffeur_id: string | null;
  client_name: string;
  client_phone: string;
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

interface TaxiPosition {
  lat: number;
  lng: number;
  heading: number;
}

function SuiviPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { status: pushStatus, subscribe } = usePushNotifications();

  const [resa, setResa] = useState<Reservation | null>(null);
  const [chauffeur, setChauffeur] = useState<Chauffeur | null>(null);
  const [taxiPos, setTaxiPos] = useState<TaxiPosition | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareMsg, setShareMsg] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const taxiMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const routeLayer = useRef<any>(null);

  // ── Charger la réservation ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: r } = await supabase
        .from("reservations")
        .select("id,depart,destination,date_course,heure_course,statut_course,chauffeur_id,client_name,client_phone")
        .eq("id", id)
        .single();
      if (!r) { setLoading(false); return; }
      setResa(r as Reservation);

      if (r.chauffeur_id) {
        const { data: c } = await supabase
          .from("chauffeurs")
          .select("*")
          .eq("id", r.chauffeur_id)
          .single();
        if (c) setChauffeur(c as Chauffeur);
      }

      // Redirection auto selon statut
      if (r.statut_course === "terminee") navigate({ to: `/fin/${id}` });
      if (r.statut_course === "en_cours") navigate({ to: `/course/${id}` });

      setLoading(false);
    };
    load();
  }, [id, navigate]);

  // ── Init carte ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try { await loadLeaflet(); } catch { return; }
      if (!mounted || !mapRef.current) return;
      const L = (window as any).L;
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
      const map = L.map(mapRef.current, { center: [44.8378, -0.5792], zoom: 13, zoomControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OSM © CARTO", maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    };
    init();
    return () => { mounted = false; mapInst.current?.remove(); mapInst.current = null; };
  }, []);

  // ── Position taxi en temps réel ────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;

    const getTaxiIcon = (heading: number) => {
      if (!L) return null;
      return L.divIcon({
        className: "",
        html: `<div style="position:relative;width:48px;height:48px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(245,200,66,0.2);animation:taxiPulse 2s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;transform:rotate(${heading}deg);transition:transform 0.6s ease;">🚕</div>
        </div>`,
        iconSize: [48, 48], iconAnchor: [24, 24],
      });
    };

    const loadInitial = async () => {
      const { data } = await (supabase as any)
        .from("taxi_positions").select("lat,lng,heading")
        .eq("id", "00000000-0000-0000-0000-000000000001").single();
      if (data?.lat) {
        setTaxiPos({ lat: data.lat, lng: data.lng, heading: data.heading ?? 0 });
      }
    };
    loadInitial();

    const channel = (supabase as any)
      .channel("taxi-suivi")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "taxi_positions" }, (payload: any) => {
        const d = payload.new;
        if (d?.lat) setTaxiPos({ lat: d.lat, lng: d.lng, heading: d.heading ?? 0 });
      })
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
  }, []);

  // ── Mettre à jour la carte quand taxiPos change ────────────────
  useEffect(() => {
    const map = mapInst.current;
    const L = (window as any).L;
    if (!map || !L || !taxiPos) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:48px;height:48px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(245,200,66,0.2);animation:taxiPulse 2s ease-in-out infinite;"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;transform:rotate(${taxiPos.heading}deg);transition:transform 0.6s ease;">🚕</div>
      </div>`,
      iconSize: [48, 48], iconAnchor: [24, 24],
    });

    if (taxiMarker.current) {
      taxiMarker.current.setLatLng([taxiPos.lat, taxiPos.lng]);
      taxiMarker.current.setIcon(icon);
    } else {
      taxiMarker.current = L.marker([taxiPos.lat, taxiPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    }

    // Calcul ETA
    if (resa) {
      getOsrmEta([taxiPos.lat, taxiPos.lng], [44.8378, -0.5792]).then(setEta);
    }

    map.setView([taxiPos.lat, taxiPos.lng], 14, { animate: true });
  }, [taxiPos, resa]);

  // ── Écouter changement de statut ──────────────────────────────
  useEffect(() => {
    if (!resa) return;
    const channel = (supabase as any)
      .channel("resa-statut")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "reservations",
        filter: `id=eq.${id}`,
      }, (payload: any) => {
        const s = payload.new.statut_course;
        if (s === "en_cours") navigate({ to: `/course/${id}` });
        if (s === "terminee") navigate({ to: `/fin/${id}` });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [resa, id, navigate]);

  const partagerTrajet = async () => {
    const url = `${window.location.origin}/suivi/${id}`;
    try {
      await navigator.share({ title: "Suivi de mon taxi", text: "Suivez mon taxi en temps réel", url });
    } catch {
      await navigator.clipboard.writeText(url);
      setShareMsg("Lien copié !");
      setTimeout(() => setShareMsg(""), 2000);
    }
  };

  const appelChauffeur = () => {
    if (resa?.client_phone) window.location.href = `tel:${resa.client_phone}`;
  };

  const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
    attente:   { label: "En attente de confirmation", color: "#f59e0b", icon: "⏳" },
    confirme:  { label: "Course confirmée", color: "#22c55e", icon: "✅" },
    en_route:  { label: "Chauffeur en route", color: "#3b82f6", icon: "🚕" },
    arrive:    { label: "Chauffeur arrivé", color: "#22c55e", icon: "📍" },
    en_cours:  { label: "Course en cours", color: "#f5c842", icon: "▶️" },
  };

  const statut = resa ? (statusLabels[resa.statut_course] ?? statusLabels.attente) : statusLabels.attente;

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "spin 1s linear infinite", display: "inline-block" }}>🚕</div>
          <div style={{ color: "#64748b", fontFamily: "'DM Sans',sans-serif" }}>Chargement du suivi…</div>
        </div>
      </div>
    );
  }

  if (!resa) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", color: "#f5f5f5", fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Réservation introuvable</div>
          <div style={{ color: "#64748b" }}>Ce lien de suivi n'est pas valide.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a14", fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes taxiPulse { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.15); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>

      {/* Carte */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

        {/* Badge statut flottant */}
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 100, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, background: "rgba(10,10,20,0.9)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "12px 16px", border: `1px solid ${statut.color}40`, display: "flex", alignItems: "center", gap: 10, animation: "slideUp 0.3s ease" }}>
            <span style={{ fontSize: 20 }}>{statut.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: statut.color }}>{statut.label}</div>
              {eta !== null && resa.statut_course === "en_route" && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Arrivée estimée dans <strong style={{ color: "#f5c842" }}>{eta} min</strong></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div style={{ flexShrink: 0, background: "linear-gradient(180deg,#111120,#0d0d1a)", borderRadius: "24px 24px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 -1px 0 rgba(245,200,66,0.1)", padding: "16px 20px calc(24px + env(safe-area-inset-bottom,0px))", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp 0.4s ease" }}>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, background: "rgba(245,200,66,0.25)", borderRadius: 9 }} />
        </div>

        {/* Infos trajet */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4, flexShrink: 0 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
            <div style={{ width: 2, height: 24, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f5c842", boxShadow: "0 0 0 3px rgba(245,200,66,0.2)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 2 }}>Départ</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resa.depart}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 2 }}>Destination</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resa.destination}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>{resa.date_course}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f5c842", fontFamily: "'Clash Display',sans-serif" }}>{resa.heure_course}</div>
          </div>
        </div>

        {/* Chauffeur */}
        {chauffeur ? (
          <div style={{ background: "#1a1a2e", borderRadius: 16, padding: "14px 16px", border: "1px solid #2a2a4a", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(245,200,66,0.15)", border: "2px solid rgba(245,200,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, overflow: "hidden" }}>
              {chauffeur.photo_url ? <img src={chauffeur.photo_url} alt={chauffeur.prenom} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{chauffeur.prenom}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{chauffeur.vehicule}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 13, color: "#f5c842" }}>{"★".repeat(Math.round(chauffeur.note_moyenne))}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{chauffeur.note_moyenne.toFixed(1)} ({chauffeur.nb_avis} avis)</span>
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Plaque</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c842", background: "rgba(245,200,66,0.1)", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(245,200,66,0.2)" }}>{chauffeur.plaque}</div>
            </div>
          </div>
        ) : (
          <div style={{ background: "#1a1a2e", borderRadius: 16, padding: "14px 16px", border: "1px solid #2a2a4a", display: "flex", alignItems: "center", gap: 12, color: "#64748b", fontSize: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "blink 1.5s ease-in-out infinite" }} />
            Attribution d'un chauffeur en cours…
          </div>
        )}

        {/* Notifications push */}
        {pushStatus === "idle" && (
          <button onClick={subscribe} style={{ padding: "12px 16px", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.25)", borderRadius: 14, color: "#f5c842", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            🔔 Activer les notifications de suivi
          </button>
        )}
        {pushStatus === "granted" && (
          <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, color: "#22c55e", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            ✅ Notifications activées — vous serez prévenu à chaque étape
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={appelChauffeur} style={{ padding: "14px", background: "#1a1a2e", border: "2px solid #2a2a4a", borderRadius: 14, color: "#f5f5f5", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52 }}>
            📞 Appeler
          </button>
          <button onClick={partagerTrajet} style={{ padding: "14px", background: "#1a1a2e", border: "2px solid #2a2a4a", borderRadius: 14, color: "#f5f5f5", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52 }}>
            {shareMsg || "🔗 Partager"}
          </button>
        </div>
      </div>
    </div>
  );
}
