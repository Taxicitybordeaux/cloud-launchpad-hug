Tracking $id · TSX
Copier

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackingIdSchema } from "@/lib/tracking-id";
 
export const Route = createFileRoute("/tracking/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de votre course – Taxi City Bordeaux" },
      { name: "description", content: "Suivez votre taxi en temps réel." },
      { name: "robots", content: "noindex" },
    ],
  }),
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
 
// ─── Point 12 : toast "détails incomplets" affiché une seule fois par réservation ───
const shownIncompleteToast = new Set<string>();
 
// ─── Point 11 : FAQ / aide ───────────────────────────────────────────────────
function HelpPanel({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const [view, setView] = useState<"faq" | "contact">("faq");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
 
  const faqs = [
    { q: "Où est mon chauffeur ?", a: "La carte affiche sa position en temps réel dès qu'il active son GPS. Si elle est vide, il est encore en route vers vous." },
    { q: "Le prix affiché est-il définitif ?", a: "Non, c'est une estimation. Le compteur homologué fait foi à l'arrivée." },
    { q: "Mon chauffeur ne répond pas ?", a: "Appelez directement le 06 73 07 23 22 disponible 7j/7 · 24h/24." },
    { q: "Je ne vois pas les infos départ/destination ?", a: "Elles sont finalisées par notre équipe et apparaîtront automatiquement dès validation." },
    { q: "Comment annuler ma course ?", a: "Contactez-nous au 06 73 07 23 22 ou via WhatsApp ci-dessous." },
  ];
 
  const sendContact = async () => {
    if (msg.trim().length < 5) return;
    const waText = encodeURIComponent(`[Support] Réservation ${reservationId.slice(0, 8)}\n\n${msg}`);
    window.open(`https://wa.me/33673072322?text=${waText}`, "_blank", "noopener,noreferrer");
    setSent(true);
  };
 
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0f172a", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,0.1)", padding: "28px 20px 40px", width: "100%", maxWidth: 540, maxHeight: "80vh", overflow: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#f8fafc" }}>🆘 Besoin d'aide ?</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: 0, color: "#94a3b8", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
 
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["faq", "contact"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${view === v ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.08)"}`, background: view === v ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)", color: view === v ? "#0ea5e9" : "#94a3b8", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              {v === "faq" ? "❓ FAQ" : "💬 Nous contacter"}
            </button>
          ))}
        </div>
 
        {view === "faq" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((f, i) => (
              <details key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                <summary style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#f1f5f9", cursor: "pointer", fontSize: 14 }}>{f.q}</summary>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#94a3b8", margin: "10px 0 0", lineHeight: 1.55 }}>{f.a}</p>
              </details>
            ))}
          </div>
        )}
 
        {view === "contact" && (
          <div>
            {sent ? (
              <div style={{ textAlign: "center", padding: 24, color: "#22c55e", fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>✅ Message envoyé via WhatsApp !</div>
            ) : (
              <>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#475569", marginBottom: 10 }}>ID Réservation: {reservationId.slice(0, 12)}…</div>
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Décrivez votre problème…"
                  rows={4}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", color: "#f8fafc", fontFamily: "'DM Sans',sans-serif", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
                <button
                  onClick={sendContact}
                  disabled={msg.trim().length < 5}
                  style={{ marginTop: 12, width: "100%", height: 50, background: msg.trim().length < 5 ? "rgba(37,211,102,0.3)" : "#25D366", color: "#fff", border: 0, borderRadius: 14, fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, cursor: msg.trim().length < 5 ? "not-allowed" : "pointer" }}
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
 
function TrackingPage() {
  const { id } = Route.useParams();
 
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [reservation, setReservation] = useState<{
    id: string;
    client_name: string;
    depart: string | null;
    destination: string | null;
    prix_estime: string | null;
    pickup_datetime: string | null;
  } | null>(null);
  const [eta, setEta] = useState<ETA>({ minutes: null, km: null });
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<null | { code: "invalid" | "expired" | "notfound"; title: string; message: string }>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
 
  // ─── Point 11 : panneau d'aide ───────────────────────────────────────────
  const [showHelp, setShowHelp] = useState(false);
 
  // ─── Point 10 : refresh manuel ──────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
 
  // ─── Point 7 : reconnexion automatique ───────────────────────────────────
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionStateRef = useRef<"connected" | "disconnected">("disconnected");
 
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const departMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const resaIdRef = useRef<string>("");
  const gpsIdRef = useRef<string>("driver");
  const modeRef = useRef<"single" | "multi">("single");
 
  // ─── Point 5 : notification avant prise en charge ────────────────────────
  const notifScheduledRef = useRef(false);
  const schedulePickupNotification = useCallback((pickupDatetime: string) => {
    if (notifScheduledRef.current) return;
    notifScheduledRef.current = true;
 
    const pickupMs = new Date(pickupDatetime).getTime();
    const now = Date.now();
    const minutesBefore = 15;
    const notifMs = pickupMs - minutesBefore * 60_000;
 
    // Toast immédiat si la prise en charge est dans moins de 30 min
    const diff = pickupMs - now;
    if (diff > 0 && diff <= 30 * 60_000) {
      const mins = Math.round(diff / 60_000);
      toast.warning(`⏰ Prise en charge dans ${mins} min`, {
        description: `Préparez-vous ! Le chauffeur arrive bientôt.`,
        duration: 8000,
      });
    }
 
    // Notification navigateur 15 min avant
    if (notifMs > now) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
      setTimeout(() => {
        const formatted = new Date(pickupDatetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        toast.warning(`🚕 Prise en charge dans ${minutesBefore} min`, {
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
 
  const geocode = async (q: string): Promise<[number, number] | null> => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Bordeaux, France")}`, { headers: { Accept: "application/json" } });
      const j = await r.json();
      if (Array.isArray(j) && j[0]) return [parseFloat(j[0].lat), parseFloat(j[0].lon)];
      return null;
    } catch { return null; }
  };
 
  const drawTripRoute = async (depart: string, destination: string) => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;
    const [a, b] = await Promise.all([geocode(depart), geocode(destination)]);
    if (!a || !b) return;
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`);
      const data = await res.json();
      const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]) ?? [a, b];
      if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
      routeLayerRef.current = L.polyline(coords, { color: "#0ea5e9", weight: 5, opacity: 0.85, lineCap: "round", lineJoin: "round" }).addTo(map);
      const departIcon = L.divIcon({ className: "", html: `<div style="width:30px;height:30px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px">🟢</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      const destIcon = L.divIcon({ className: "", html: `<div style="width:30px;height:30px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px">📍</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      if (departMarkerRef.current) departMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();
      departMarkerRef.current = L.marker(a, { icon: departIcon }).addTo(map).bindPopup("Départ");
      destMarkerRef.current = L.marker(b, { icon: destIcon }).addTo(map).bindPopup("Destination");
      const all = [...coords];
      if (markerRef.current) all.push(markerRef.current.getLatLng());
      map.fitBounds(L.latLngBounds(all).pad(0.2));
    } catch { /* noop */ }
  };
 
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
 
  // ─── Point 7 : polling fallback ───────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(async () => {
      const gpsId = gpsIdRef.current;
      const { data } = await supabase.from("driver_gps").select("*").eq("id", gpsId).maybeSingle();
      if (data) {
        setDriverData(data as DriverData);
        setLastUpdate(new Date());
        if (data.latitude && data.longitude) {
          if (!mapInstanceRef.current) await initMap(data.latitude, data.longitude);
          else {
            markerRef.current?.setLatLng([data.latitude, data.longitude]);
            mapInstanceRef.current.panTo([data.latitude, data.longitude], { animate: true, duration: 1.5 });
          }
          await calculateETA(data.latitude, data.longitude);
        }
      }
      // Réservation
      const resaId = resaIdRef.current;
      if (resaId) {
        const { data: r } = await supabase.from("reservations").select("client_name,nom,depart,arrivee,destination,prix_estime,pickup_datetime,status").eq("id", resaId).maybeSingle();
        if (r) {
          setReservation((prev) => ({
            id: resaId,
            client_name: (r.client_name || r.nom || prev?.client_name || "").toString().trim(),
            depart: r.depart ?? prev?.depart ?? null,
            destination: (r.destination ?? r.arrivee) ?? prev?.destination ?? null,
            prix_estime: r.prix_estime != null ? `${r.prix_estime} €` : prev?.prix_estime ?? null,
            pickup_datetime: r.pickup_datetime ?? prev?.pickup_datetime ?? null,
          }));
        }
      }
    }, 10_000); // poll toutes les 10s
  }, []);
 
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) { clearInterval(pollingTimerRef.current); pollingTimerRef.current = null; }
  }, []);
 
  const subscribeRealtime = useCallback((gpsId: string, resaId: string, resaData: any, mode: "single" | "multi") => {
    const filter = mode === "multi" ? `id=eq.${gpsId}` : undefined;
 
    const gpsChannel = supabase.channel(`tracking-live-${gpsId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_gps", ...(filter ? { filter } : {}) }, async (payload) => {
        const d = payload.new as DriverData;
        if (mode === "multi" && d.id !== gpsId) return;
        if (mode === "single" && d.id !== "driver") return;
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
      })
      // ─── Point 7 : détection de déconnexion ───────────────────────────
      .on("system", {}, (status: any) => {
        const s = (status?.status || "").toLowerCase();
        if (s === "subscribed") {
          connectionStateRef.current = "connected";
          stopPolling();
          if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        } else if (s === "channel_error" || s === "timed_out" || s === "closed") {
          if (connectionStateRef.current === "connected") {
            connectionStateRef.current = "disconnected";
            toast.warning("⚡ Connexion interrompue", { description: "Passage en mode polling. Reconnexion en cours…", duration: 5000 });
            startPolling();
            // Tentative de reconnexion dans 8s
            reconnectTimerRef.current = setTimeout(() => {
              stopPolling();
              setRetryNonce((n) => n + 1);
            }, 8000);
          }
        }
      })
      .subscribe();
 
    const resaChannel = supabase.channel(`tracking-resa-${resaId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${resaId}` }, (payload) => {
        const r = payload.new as any;
        const newStatus = (r.status || "").toLowerCase();
        if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(newStatus)) {
          toast.error("Course annulée", { description: "Cette réservation n'est plus active." });
          setError({ code: "expired", title: "Course annulée ou refusée", message: "Cette course n'est plus active. Contactez-nous pour en créer une nouvelle." });
          return;
        }
        if (["terminee", "terminée", "completed", "done"].includes(newStatus)) {
          toast.info("Course terminée", { description: "Merci d'avoir voyagé avec Taxi City Bordeaux." });
          setError({ code: "expired", title: "Course terminée", message: "Cette course est déjà terminée. Merci d'avoir voyagé avec Taxi City Bordeaux." });
          return;
        }
        setReservation((prev) => {
          const next = {
            id: resaId,
            client_name: (r.client_name || r.nom || prev?.client_name || "").toString().trim(),
            depart: r.depart ?? prev?.depart ?? null,
            destination: (r.destination ?? r.arrivee) ?? prev?.destination ?? null,
            prix_estime: r.prix_estime != null ? `${r.prix_estime} €` : prev?.prix_estime ?? null,
            pickup_datetime: r.pickup_datetime ?? prev?.pickup_datetime ?? null,
          };
          if (prev) {
            if (prev.prix_estime !== next.prix_estime && next.prix_estime) toast.info("💶 Prix mis à jour", { description: next.prix_estime });
            if (prev.destination !== next.destination && next.destination) toast.info("📍 Destination mise à jour", { description: next.destination });
          }
          if (next.depart && next.destination && (prev?.depart !== next.depart || prev?.destination !== next.destination)) {
            drawTripRoute(next.depart, next.destination);
          }
          return next;
        });
      })
      .subscribe();
 
    channelRef.current = [gpsChannel, resaChannel];
  }, [startPolling, stopPolling]);
 
  // ─── Point 10 : refresh manuel ──────────────────────────────────────────
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resaId = resaIdRef.current;
      const gpsId = gpsIdRef.current;
      if (resaId) {
        const { data: r } = await supabase.from("reservations").select("client_name,nom,depart,arrivee,destination,prix_estime,pickup_datetime").eq("id", resaId).maybeSingle();
        if (r) {
          setReservation((prev) => ({
            id: resaId,
            client_name: (r.client_name || r.nom || prev?.client_name || "").toString().trim(),
            depart: r.depart ?? prev?.depart ?? null,
            destination: (r.destination ?? r.arrivee) ?? prev?.destination ?? null,
            prix_estime: r.prix_estime != null ? `${r.prix_estime} €` : prev?.prix_estime ?? null,
            pickup_datetime: r.pickup_datetime ?? prev?.pickup_datetime ?? null,
          }));
        }
      }
      const { data } = await supabase.from("driver_gps").select("*").eq("id", gpsId).maybeSingle();
      if (data) {
        setDriverData(data as DriverData);
        setLastUpdate(new Date());
      }
      toast.success("✅ Informations mises à jour");
    } catch {
      toast.error("Échec du rafraîchissement");
    } finally {
      setRefreshing(false);
    }
  }, []);
 
  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    const t = setInterval(() => { setElapsed(Math.floor((Date.now() - start) / 1000)); }, 250);
    return () => clearInterval(t);
  }, [loading]);
 
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLoading(true);
    setError(null);
    setLoadStep(0);
    const sessionId = sessionStorage.getItem("sid") || Math.random().toString(36).slice(2);
    sessionStorage.setItem("sid", sessionId);
    supabase.from("site_analytics").insert({ event: "qr_click", session_id: sessionId });
 
    const toastId = "qr-scan";
    toast.loading("📷 QR code détecté", { id: toastId, description: "Lecture du code et connexion sécurisée…" });
 
    const init = async () => {
      const parsed = trackingIdSchema.safeParse(id);
      if (!parsed.success) {
        const reason = parsed.error.issues[0]?.message ?? "Identifiant de course invalide";
        toast.error("QR code invalide", { id: toastId, description: reason });
        setError({ code: "invalid", title: "QR code invalide", message: `${reason}. Le lien scanné ne correspond pas au format attendu (UUID).` });
        setLoading(false);
        return;
      }
      const trackingId = parsed.data;
 
      setLoadStep(1);
      const { data: resa, error: resaErr } = await supabase
        .from("reservations")
        .select("id, status, tracking_id, created_at, client_name, nom, depart, arrivee, destination, prix_estime, pickup_datetime")
        .eq("tracking_id", trackingId)
        .maybeSingle();
 
      if (resaErr || !resa) {
        toast.error("Aucune course trouvée", { id: toastId });
        setError({ code: "notfound", title: "Aucune course trouvée", message: "Ce QR code ne correspond à aucune course active." });
        setLoading(false);
        return;
      }
      const status = (resa.status || "").toLowerCase();
      if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(status)) {
        toast.error("Course annulée", { id: toastId });
        setError({ code: "expired", title: "Course annulée ou refusée", message: "Cette course n'est plus active." });
        setLoading(false);
        return;
      }
      if (["terminee", "terminée", "completed", "done"].includes(status)) {
        toast.info("Course terminée", { id: toastId });
        setError({ code: "expired", title: "Course terminée", message: "Merci d'avoir voyagé avec Taxi City Bordeaux." });
        setLoading(false);
        return;
      }
      const createdAt = resa.created_at ? new Date(resa.created_at).getTime() : 0;
      if (createdAt && Date.now() - createdAt > 24 * 60 * 60 * 1000) {
        toast.error("QR code expiré", { id: toastId });
        setError({ code: "expired", title: "QR code expiré", message: "Ce lien de suivi a expiré (plus de 24h)." });
        setLoading(false);
        return;
      }
 
      const clientName = (resa.client_name || resa.nom || "").toString().trim();
      resaIdRef.current = resa.id;
 
      // ─── Point 8 : pickup_datetime toujours affiché ───────────────────
      setReservation({
        id: resa.id,
        client_name: clientName,
        depart: resa.depart ?? null,
        destination: (resa.destination ?? resa.arrivee) ?? null,
        prix_estime: resa.prix_estime != null ? `${resa.prix_estime} €` : null,
        pickup_datetime: resa.pickup_datetime ?? null,
      });
 
      // ─── Point 5 : planifier notification prise en charge ────────────
      if (resa.pickup_datetime) {
        schedulePickupNotification(resa.pickup_datetime);
      }
 
      // ─── Point 12 : toast incomplet affiché une seule fois ────────────
      const dep = resa.depart ?? null;
      const dest = (resa.destination ?? resa.arrivee) ?? null;
      const prix = resa.prix_estime;
      if (!dep && !dest && prix == null && !shownIncompleteToast.has(resa.id)) {
        shownIncompleteToast.add(resa.id);
        toast.warning("ℹ️ Détails de la course incomplets", {
          description: "Le départ, la destination et le prix seront disponibles très prochainement.",
          duration: 7000,
        });
      }
 
      setLoadStep(2);
      const { data: settings } = await supabase.from("app_settings").select("tracking_mode").eq("id", 1).maybeSingle();
      const mode = (settings?.tracking_mode === "multi" ? "multi" : "single") as "single" | "multi";
      const gpsId = mode === "multi" ? trackingId : "driver";
      gpsIdRef.current = gpsId;
      modeRef.current = mode;
 
      const { data } = await supabase.from("driver_gps").select("*").eq("id", gpsId).maybeSingle();
 
      setLoadStep(3);
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
 
      const destAddr = (resa.destination ?? resa.arrivee) ?? null;
      if (resa.depart && destAddr) drawTripRoute(resa.depart, destAddr);
 
      toast.success("✅ Course trouvée", { id: toastId, description: `${clientName ? clientName + " — " : ""}mode ${mode === "multi" ? "multi-courses" : "chauffeur unique"}`, duration: 4000 });
      setLoading(false);
 
      subscribeRealtime(gpsId, resa.id, resa, mode);
    };
 
    init();
    return () => {
      const ch = channelRef.current;
      if (Array.isArray(ch)) ch.forEach((c) => c && supabase.removeChannel(c));
      else if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      stopPolling();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; markerRef.current = null; }
    };
  }, [id, retryNonce, subscribeRealtime, stopPolling, schedulePickupNotification]);
 
  const styleTag = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
      @keyframes driverPulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,0)}50%{box-shadow:0 0 0 14px rgba(14,165,233,0.15)}}
      @keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
      @keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes spinTaxi{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      details summary::-webkit-details-marker { display: none; }
    `}</style>
  );
 
  // ─── Point 6 : helper calendrier ─────────────────────────────────────────
  const addToCalendar = (type: "google" | "apple") => {
    if (!reservation?.pickup_datetime) return;
    const start = new Date(reservation.pickup_datetime);
    const end = new Date(start.getTime() + 60 * 60_000); // +1h
    const title = encodeURIComponent("Course Taxi City Bordeaux");
    const details = encodeURIComponent(`Départ : ${reservation.depart || "—"}\nDestination : ${reservation.destination || "—"}\nChauffeur : 06 73 07 23 22`);
    const loc = encodeURIComponent(reservation.depart || "Bordeaux");
 
    if (type === "google") {
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${loc}`, "_blank", "noopener,noreferrer");
    } else {
      // Apple / iCal — génère un fichier .ics
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const ics = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TaxiCityBordeaux//FR",
        "BEGIN:VEVENT",
        `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
        `SUMMARY:Course Taxi City Bordeaux`,
        `DESCRIPTION:Départ : ${reservation.depart || "—"}\\nDestination : ${reservation.destination || "—"}`,
        `LOCATION:${reservation.depart || "Bordeaux"}`,
        "END:VEVENT", "END:VCALENDAR"
      ].join("\r\n");
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "course-taxi.ics"; a.click();
      URL.revokeObjectURL(url);
    }
  };
 
  // ─── LOADING STATE ────────────────────────────────────────────────────────
  if (loading) {
    const steps = [
      { label: "Connexion sécurisée…", icon: "🔐" },
      { label: "Recherche du chauffeur…", icon: "🔎" },
      { label: "Récupération de la position GPS…", icon: "📡" },
      { label: "Calcul de l'itinéraire…", icon: "🗺️" },
    ];
    const pct = [20, 45, 70, 95][loadStep] ?? 20;
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
        <div style={{ width: "min(320px,80vw)", display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= loadStep ? 1 : 0.35, transition: "opacity 0.3s" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: i < loadStep ? "#22c55e" : i === loadStep ? "#0ea5e9" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, animation: i === loadStep ? "liveDot 1.2s infinite" : "none" }}>{i < loadStep ? "✓" : ""}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: i <= loadStep ? "#cbd5e1" : "#475569" }}>{s.label}</span>
            </div>
          ))}
        </div>
        {elapsed > 12 && elapsed <= 30 && <p style={{ fontSize: 12, color: "#64748b", maxWidth: 300, textAlign: "center", marginTop: 4 }}>La connexion prend plus de temps que prévu…</p>}
        {elapsed > 30 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 6 }}>
            <p style={{ fontSize: 13, color: "#fbbf24", textAlign: "center", margin: 0 }}>⏱️ Récupération trop longue. Vérifiez votre connexion.</p>
            <button onClick={() => { setError(null); setLoading(true); setElapsed(0); setLoadStep(0); setRetryNonce((n) => n + 1); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🔄 Réessayer</button>
          </div>
        )}
      </div>
    );
  }
 
  // ─── ERROR STATE ─────────────────────────────────────────────────────────
  if (error) {
    const icon = error.code === "invalid" ? "⚠️" : error.code === "expired" ? "⏱️" : "🔍";
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 28, textAlign: "center" }}>
        {styleTag}
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(245,158,11,0.12)", border: "2px solid rgba(245,158,11,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42 }}>{icon}</div>
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 22, color: "#f8fafc", margin: 0 }}>{error.title}</h1>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#94a3b8", marginTop: 10, lineHeight: 1.55 }}>{error.message}</p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#334155", marginTop: 12 }}>Code: {id?.slice(0, 12) || "—"}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => setRetryNonce((n) => n + 1)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🔄 Réessayer</button>
          <button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/"; }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Retour</button>
          <a href="tel:0673072322" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", background: "#22c55e", color: "#fff", borderRadius: 12, textDecoration: "none", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>📞 Appeler</a>
        </div>
        {/* Point 11 : aide sur erreur */}
        <div style={{ marginTop: 14, padding: "14px 18px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 14, maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>🆘 Besoin d'aide ?</div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.5 }}>Notre équipe vous répond 7j/7.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <a href={`https://wa.me/33673072322?text=${encodeURIComponent(`Bonjour, j'obtiens l'erreur « ${error.title} ». Code : ${id?.slice(0, 12) || "—"}`)}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "#25D366", color: "#fff", borderRadius: 10, textDecoration: "none", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>💬 WhatsApp</a>
            <a href="/contact" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "rgba(255,255,255,0.08)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, textDecoration: "none", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>✉️ Assistance</a>
          </div>
        </div>
      </div>
    );
  }
 
  // ─── Helpers UI ──────────────────────────────────────────────────────────
  const isIncomplete = reservation && !reservation.depart && !reservation.destination && !reservation.prix_estime;
 
  // ─── MAIN TRACKING VIEW ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif" }}>
      {styleTag}
      {showHelp && reservation && <HelpPanel reservationId={reservation.id} onClose={() => setShowHelp(false)} />}
 
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,15,30,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚕</span>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>Taxi City Bordeaux</div>
            <div style={{ fontSize: 11, color: "#475569" }}>Votre course en temps réel</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Point 10 : bouton refresh */}
          <button onClick={handleManualRefresh} disabled={refreshing} title="Rafraîchir" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: refreshing ? "wait" : "pointer", color: "#94a3b8", fontSize: 16 }}>
            <span style={{ display: "inline-block", animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>🔄</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: driverData?.is_active ? "rgba(14,165,233,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${driverData?.is_active ? "rgba(14,165,233,0.3)" : "rgba(245,158,11,0.3)"}`, borderRadius: 99, padding: "5px 12px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: driverData?.is_active ? "#0ea5e9" : "#f59e0b", display: "inline-block", animation: "liveDot 2s infinite" }} />
            <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, color: driverData?.is_active ? "#0ea5e9" : "#f59e0b" }}>{driverData?.is_active ? "En route" : "En attente"}</span>
          </div>
        </div>
      </div>
 
      <div style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.14),rgba(14,165,233,0.04))", borderBottom: "1px solid rgba(14,165,233,0.25)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>📲</span>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#cbd5e1", lineHeight: 1.45 }}>
          <strong style={{ color: "#f1f5f9", fontFamily: "'Syne',sans-serif" }}>Suivi en temps réel.</strong> Gardez cette page ouverte sur votre téléphone.
        </div>
      </div>
 
      {/* Carte */}
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
                  : "Sa position s'affichera ici dès qu'il l'aura activée."}
              </p>
            </div>
            {!driverData?.is_active && (
              <a href="tel:0673072322" style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: "#22c55e", color: "#fff", borderRadius: 14, textDecoration: "none", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>📞 06 73 07 23 22</a>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", display: "inline-block", animation: `liveDot 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        {lastUpdate && (
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(10,15,30,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "5px 10px" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#475569" }}>Mis à jour {lastUpdate.toLocaleTimeString("fr-FR")}</span>
          </div>
        )}
      </div>
 
      {/* Panneau bas */}
      <div style={{ background: "#111827", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", animation: "slideUp 0.4s ease", flex: 1 }}>
 
        {/* ETA + Prix */}
        <div style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 18, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em", marginBottom: 6 }}>ARRIVÉE ESTIMÉE</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 38, fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{eta.minutes !== null ? `${eta.minutes} min` : "Calcul..."}</div>
            {eta.km && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{eta.km} km restants</div>}
          </div>
          {(reservation?.prix_estime || driverData?.prix_estime) && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em", marginBottom: 6 }}>PRIX ESTIMÉ</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 900, color: "#f8fafc" }}>{reservation?.prix_estime || driverData?.prix_estime}</div>
            </div>
          )}
        </div>
 
        {/* ─── Point 8 : heure de prise en charge toujours visible ──────────── */}
        {reservation?.pickup_datetime && (() => {
          const d = new Date(reservation.pickup_datetime);
          const formatted = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
          const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div style={{ marginTop: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>🕒</span>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>PRISE EN CHARGE</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 3, textTransform: "capitalize" }}>{formatted} · {time}</div>
                </div>
              </div>
              {/* ─── Point 6 : bouton ajouter au calendrier ──── */}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => addToCalendar("google")} title="Ajouter à Google Calendar" style={{ padding: "7px 12px", background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", color: "#0ea5e9", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>📅 Google</button>
                <button onClick={() => addToCalendar("apple")} title="Ajouter à Apple Calendar (.ics)" style={{ padding: "7px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🍎 Apple</button>
              </div>
            </div>
          );
        })()}
 
        {/* ─── Points 9 + 11 : encart attente avec bouton aide ──────────────── */}
        {isIncomplete && (
          <div style={{ marginTop: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {/* ─── Point 9 : indicateur de chargement ───── */}
              <span style={{ fontSize: 22, lineHeight: 1, animation: "liveDot 2s infinite" }}>⏳</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800, color: "#fde68a" }}>Détails en cours de finalisation</div>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#cbd5e1", margin: "4px 0 8px", lineHeight: 1.5 }}>
                  Le départ, la destination et le prix seront disponibles très prochainement — les infos s'affichent automatiquement dès validation.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* Point 10 : refresh manuel */}
                  <button onClick={handleManualRefresh} disabled={refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", color: "#0ea5e9", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    <span style={{ display: "inline-block", animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>🔄</span> Rafraîchir
                  </button>
                  {/* Point 11 : bouton aide */}
                  <button onClick={() => setShowHelp(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fde68a", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🆘 Besoin d'aide ?</button>
                  <a href="tel:0673072322" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>📞 Appeler</a>
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* Client */}
        {reservation?.client_name && (
          <div style={{ marginTop: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>👋</span>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>COURSE DE</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 3 }}>{reservation.client_name}</div>
            </div>
          </div>
        )}
 
        {/* Départ */}
        {reservation?.depart && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>🟢</span>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>DÉPART</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 3 }}>{reservation.depart}</div>
            </div>
          </div>
        )}
 
        {/* Destination */}
        {(reservation?.destination || driverData?.destination) && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📍</span>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>DESTINATION</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 3 }}>{reservation?.destination || driverData?.destination}</div>
            </div>
          </div>
        )}
 
        {/* Chauffeur */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 50, height: 50, flexShrink: 0, background: "rgba(14,165,233,0.12)", border: "2px solid rgba(14,165,233,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👨‍✈️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Taxi City Bordeaux</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Conventionné · Toutes assurances</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 1 }}>Disponible 7j/7 · 24h/24</div>
          </div>
          <a href="tel:0673072322" style={{ width: 44, height: 44, flexShrink: 0, background: "#22c55e", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, textDecoration: "none" }}>📞</a>
        </div>
 
        <a href="tel:0673072322" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 52, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 14, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", textDecoration: "none" }}>
          📞 Appeler mon chauffeur
        </a>
 
        {/* Point 11 : bouton aide permanent */}
        <button onClick={() => setShowHelp(true)} style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 44, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14, color: "#64748b", cursor: "pointer" }}>
          🆘 Besoin d'aide ?
        </button>
 
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#1e293b" }}>Position mise à jour en temps réel · Sans application</p>
          <a href="https://taxicitybordeaux.fr" style={{ fontSize: 11, color: "#334155", textDecoration: "none" }}>taxicitybordeaux.fr</a>
        </div>
      </div>
    </div>
  );
}