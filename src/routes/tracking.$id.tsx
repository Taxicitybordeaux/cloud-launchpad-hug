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

const shownIncompleteToast = new Set<string>();
const TAXI_ICON_URI =
  "data:image/jpeg;base64,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";

function HelpPanel({ reservationId, onClose }: { reservationId: string; onClose: () => void }) {
  const [view, setView] = useState<"faq" | "contact">("faq");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const faqs = [
    {
      q: "Où est mon chauffeur ?",
      a: "La carte affiche sa position en temps réel dès qu'il active son GPS. Si elle est vide, il est encore en route vers vous.",
    },
    {
      q: "Le prix affiché est-il définitif ?",
      a: "Non, c'est une estimation. Le compteur homologué fait foi à l'arrivée.",
    },
    { q: "Mon chauffeur ne répond pas ?", a: "Appelez directement le 06 73 07 23 22 disponible 7j/7 · 24h/24." },
    {
      q: "Je ne vois pas les infos départ/destination ?",
      a: "Elles sont finalisées par notre équipe et apparaîtront automatiquement dès validation.",
    },
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f172a",
          borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "28px 20px 40px",
          width: "100%",
          maxWidth: 540,
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#f8fafc" }}>
            🆘 Besoin d'aide ?
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: 0,
              color: "#94a3b8",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["faq", "contact"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 12,
                border: `1px solid ${view === v ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.08)"}`,
                background: view === v ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
                color: view === v ? "#0ea5e9" : "#94a3b8",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {v === "faq" ? "❓ FAQ" : "💬 Nous contacter"}
            </button>
          ))}
        </div>

        {view === "faq" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((f, i) => (
              <details
                key={i}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <summary
                  style={{
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 700,
                    color: "#f1f5f9",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {f.q}
                </summary>
                <p
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13,
                    color: "#94a3b8",
                    margin: "10px 0 0",
                    lineHeight: 1.55,
                  }}
                >
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        )}

        {view === "contact" && (
          <div>
            {sent ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: "#22c55e",
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 700,
                }}
              >
                ✅ Message envoyé via WhatsApp !
              </div>
            ) : (
              <>
                <div
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#475569", marginBottom: 10 }}
                >
                  ID Réservation: {reservationId.slice(0, 12)}…
                </div>
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Décrivez votre problème…"
                  rows={4}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    color: "#f8fafc",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 14,
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={sendContact}
                  disabled={msg.trim().length < 5}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    height: 50,
                    background: msg.trim().length < 5 ? "rgba(37,211,102,0.3)" : "#25D366",
                    color: "#fff",
                    border: 0,
                    borderRadius: 14,
                    fontFamily: "'Syne',sans-serif",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: msg.trim().length < 5 ? "not-allowed" : "pointer",
                  }}
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
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<null | {
    code: "invalid" | "expired" | "notfound";
    title: string;
    message: string;
  }>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // FIX MOBILE: hauteur carte calculée dynamiquement
  const [mapHeight, setMapHeight] = useState(260);

  useEffect(() => {
    const updateMapHeight = () => {
      // Sur iPhone, window.innerHeight tient compte de la barre Safari
      // On alloue ~40% de la hauteur visible, min 220px, max 380px
      const h = Math.min(Math.max(Math.round(window.innerHeight * 0.4), 220), 380);
      setMapHeight(h);
    };
    updateMapHeight();
    window.addEventListener("resize", updateMapHeight);
    // Sur iOS, la barre Safari change de taille au scroll
    window.addEventListener("orientationchange", updateMapHeight);
    return () => {
      window.removeEventListener("resize", updateMapHeight);
      window.removeEventListener("orientationchange", updateMapHeight);
    };
  }, []);

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
  const destCoordsRef = useRef<[number, number] | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const pickupCoordsRef = useRef<[number, number] | null>(null);
  const approachLayerRef = useRef<any>(null);
  const lastAppliedPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const lastApproachAtRef = useRef<number>(0);

  // Distance approx en mètres entre 2 coords (formule équirectangulaire — suffisant pour anti-jitter)
  const distMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const x = (toRad(b.lng) - toRad(a.lng)) * Math.cos(toRad((a.lat + b.lat) / 2));
    const y = toRad(b.lat) - toRad(a.lat);
    return Math.sqrt(x * x + y * y) * R;
  };

  // Applique une position chauffeur sur la carte avec anti-jitter :
  // - ignore les déplacements < 8 m (bruit GPS) sauf si > 4 s écoulées
  // - throttle l'appel OSRM d'approche à une fois toutes les 15 s
  const applyDriverPosition = useCallback(async (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const map = mapInstanceRef.current;
    if (!map) {
      await initMap(lat, lng);
      lastAppliedPosRef.current = { lat, lng, t: Date.now() };
      return;
    }
    const now = Date.now();
    const last = lastAppliedPosRef.current;
    if (last) {
      const moved = distMeters(last, { lat, lng });
      const elapsed = now - last.t;
      if (moved < 8 && elapsed < 4000) return; // bruit GPS → on ignore
    }
    lastAppliedPosRef.current = { lat, lng, t: now };

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 1.5 });
    }
    if (pickupCoordsRef.current && now - lastApproachAtRef.current > 15000) {
      lastApproachAtRef.current = now;
      drawApproachLine(lat, lng, pickupCoordsRef.current);
    }
    await calculateETA(lat, lng, destCoordsRef.current ?? undefined);
  }, []);

  const notifScheduledRef = useRef(false);
  const schedulePickupNotification = useCallback((pickupDatetime: string) => {
    if (notifScheduledRef.current) return;
    notifScheduledRef.current = true;

    const pickupMs = new Date(pickupDatetime).getTime();
    const now = Date.now();
    const minutesBefore = 15;
    const notifMs = pickupMs - minutesBefore * 60_000;

    const diff = pickupMs - now;
    if (diff > 0 && diff <= 30 * 60_000) {
      const mins = Math.round(diff / 60_000);
      toast.warning(`⏰ Prise en charge dans ${mins} min`, {
        description: `Préparez-vous ! Le chauffeur arrive bientôt.`,
        duration: 8000,
      });
    }

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
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Bordeaux, France")}`,
        { headers: { Accept: "application/json" } },
      );
      const j = await r.json();
      if (Array.isArray(j) && j[0]) return [parseFloat(j[0].lat), parseFloat(j[0].lon)];
      return null;
    } catch {
      return null;
    }
  };

  const drawTripRoute = async (depart: string, destination: string) => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;
    const [a, b] = await Promise.all([geocode(depart), geocode(destination)]);
    if (!a || !b) return;
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`,
      );
      const data = await res.json();
      const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [
        c[1],
        c[0],
      ]) ?? [a, b];

      // Ligne grise = trajet total départ→destination
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      routeLayerRef.current = L.polyline(coords, {
        color: "rgba(255,255,255,0.2)",
        weight: 5,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "8 6",
      }).addTo(map);

      // Marqueur départ (prise en charge) 🟢
      const departIcon = L.divIcon({
        className: "",
        html: `<div style="width:34px;height:34px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(34,197,94,0.6);display:flex;align-items:center;justify-content:center;font-size:16px">🟢</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      // Marqueur destination 🏁
      const destIcon = L.divIcon({
        className: "",
        html: `<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(239,68,68,0.6);display:flex;align-items:center;justify-content:center;font-size:16px">🏁</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      if (departMarkerRef.current) departMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();
      departMarkerRef.current = L.marker(a, { icon: departIcon }).addTo(map).bindPopup("📍 Prise en charge");
      destMarkerRef.current = L.marker(b, { icon: destIcon }).addTo(map).bindPopup("🏁 Destination");

      // Stocker coords utiles
      destCoordsRef.current = b;
      pickupCoordsRef.current = a;
      const totalDist = data?.routes?.[0]?.distance;
      if (totalDist) setTotalKm(parseFloat((totalDist / 1000).toFixed(1)));

      // Dessiner la ligne d'approche chauffeur→prise en charge si on a déjà le GPS
      const driverPos = markerRef.current?.getLatLng();
      if (driverPos) {
        drawApproachLine(driverPos.lat, driverPos.lng, a);
      }

      const all = [...coords];
      if (markerRef.current) all.push(markerRef.current.getLatLng());
      map.fitBounds(L.latLngBounds(all).pad(0.2));
    } catch {
      /* noop */
    }
  };

  // Trace (ou met à jour) la ligne bleue chauffeur → point de prise en charge via OSRM
  const drawApproachLine = async (driverLat: number, driverLng: number, pickup: [number, number]) => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${pickup[1]},${pickup[0]}?overview=full&geometries=geojson`,
      );
      const data = await res.json();
      const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [
        c[1],
        c[0],
      ]) ?? [[driverLat, driverLng], pickup];

      if (approachLayerRef.current) {
        // Mise à jour fluide sans supprimer/recréer
        approachLayerRef.current.setLatLngs(coords);
      } else {
        approachLayerRef.current = L.polyline(coords, {
          color: "#0ea5e9",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }
    } catch {
      // Fallback ligne droite si OSRM échoue
      const fallback: [number, number][] = [[driverLat, driverLng], pickup];
      if (approachLayerRef.current) {
        approachLayerRef.current.setLatLngs(fallback);
      } else {
        approachLayerRef.current = L.polyline(fallback, {
          color: "#0ea5e9",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }
    }
  };

  const calculateETA = async (lat: number, lng: number, destCoords?: [number, number]) => {
    try {
      const [dLat, dLng] = destCoords ?? BORDEAUX_CENTER;
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dLng},${dLat}?overview=false`,
      );
      const data = await res.json();
      if (data.routes?.[0]) {
        setEta({ minutes: Math.ceil(data.routes[0].duration / 60), km: (data.routes[0].distance / 1000).toFixed(1) });
      }
    } catch {
      setEta({ minutes: null, km: null });
    }
  };

  const loadLeaflet = (): Promise<void> =>
    new Promise((resolve) => {
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
      if (!document.getElementById("leaflet-js")) {
        const s = document.createElement("script");
        s.id = "leaflet-js";
        s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        s.onload = () => resolve();
        document.head.appendChild(s);
      } else resolve();
    });

  const initMap = async (lat: number, lng: number) => {
    await loadLeaflet();
    const L = (window as any).L;
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [lat, lng], zoom: 14, zoomControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © CARTO",
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #0ea5e9;overflow:hidden;box-shadow:0 0 0 0 rgba(14,165,233,0);animation:driverPulse 2s infinite"><img src="${TAXI_ICON_URI}" style="width:100%;height:100%;object-fit:cover" /></div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    mapInstanceRef.current = map;

    // FIX MOBILE: forcer invalidateSize après init pour que Leaflet
    // recalcule ses dimensions réelles sur iPhone
    setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 300);
    // Second invalidate après la transition CSS (0.4s)
    setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 500);
  };

  // GPS automatique et permanent : démarre watchPosition dès le chargement
  const startGeoTracking = useCallback((gpsId: string) => {
    if (!navigator.geolocation) {
      toast.warning("GPS non disponible", { description: "Votre navigateur ne supporte pas la géolocalisation." });
      return;
    }
    if (geoWatchIdRef.current !== null) return; // déjà actif

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLastUpdate(new Date());

        // Mise à jour Supabase
        await supabase.from("driver_gps").upsert({
          id: gpsId,
          latitude,
          longitude,
          accuracy,
          is_active: true,
          updated_at: new Date().toISOString(),
        });

        // Mise à jour carte
        if (!mapInstanceRef.current) {
          await initMap(latitude, longitude);
        } else {
          markerRef.current?.setLatLng([latitude, longitude]);
          mapInstanceRef.current.panTo([latitude, longitude], { animate: true, duration: 1.5 });
        }
        if (pickupCoordsRef.current) {
          drawApproachLine(latitude, longitude, pickupCoordsRef.current);
        }
        await calculateETA(latitude, longitude, destCoordsRef.current ?? undefined);
        setDriverData((prev) => (prev ? { ...prev, latitude, longitude, accuracy, is_active: true } : null));
      },
      (err) => {
        console.warn("GPS error:", err.message);
        if (err.code === 1) {
          toast.error("GPS refusé", { description: "Autorisez la localisation pour le suivi en temps réel." });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
    geoWatchIdRef.current = watchId;
  }, []);

  const stopGeoTracking = useCallback(() => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  }, []);

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
            // Mettre à jour la ligne d'approche vers la prise en charge
            if (pickupCoordsRef.current) {
              drawApproachLine(data.latitude, data.longitude, pickupCoordsRef.current);
            }
          }
          await calculateETA(data.latitude, data.longitude, destCoordsRef.current ?? undefined);
        }
      }
      const resaId = resaIdRef.current;
      if (resaId) {
        const { data: r } = await supabase
          .from("reservations")
          .select("client_name,nom,depart,arrivee,destination,prix_estime,pickup_datetime,status")
          .eq("id", resaId)
          .maybeSingle();
        if (r) {
          setReservation((prev) => ({
            id: resaId,
            client_name: (r.client_name || r.nom || prev?.client_name || "").toString().trim(),
            depart: r.depart ?? prev?.depart ?? null,
            destination: r.destination ?? r.arrivee ?? prev?.destination ?? null,
            prix_estime: r.prix_estime != null ? `${r.prix_estime} €` : (prev?.prix_estime ?? null),
            pickup_datetime: r.pickup_datetime ?? prev?.pickup_datetime ?? null,
          }));
        }
      }
    }, 10_000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const subscribeRealtime = useCallback(
    (gpsId: string, resaId: string, resaData: any, mode: "single" | "multi") => {
      const filter = mode === "multi" ? `id=eq.${gpsId}` : undefined;

      const gpsChannel = supabase
        .channel(`tracking-live-${gpsId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "driver_gps", ...(filter ? { filter } : {}) },
          async (payload) => {
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
                // Mettre à jour la ligne d'approche vers la prise en charge
                if (pickupCoordsRef.current) {
                  drawApproachLine(d.latitude, d.longitude, pickupCoordsRef.current);
                }
              }
              await calculateETA(d.latitude, d.longitude, destCoordsRef.current ?? undefined);
            }
          },
        )
        .on("system", {}, (status: any) => {
          const s = (status?.status || "").toLowerCase();
          if (s === "subscribed") {
            connectionStateRef.current = "connected";
            stopPolling();
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
          } else if (s === "channel_error" || s === "timed_out" || s === "closed") {
            if (connectionStateRef.current === "connected") {
              connectionStateRef.current = "disconnected";
              toast.warning("⚡ Connexion interrompue", {
                description: "Passage en mode polling. Reconnexion en cours…",
                duration: 5000,
              });
              startPolling();
              reconnectTimerRef.current = setTimeout(() => {
                stopPolling();
                setRetryNonce((n) => n + 1);
              }, 8000);
            }
          }
        })
        .subscribe();

      const resaChannel = supabase
        .channel(`tracking-resa-${resaId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${resaId}` },
          (payload) => {
            const r = payload.new as any;
            const newStatus = (r.status || "").toLowerCase();
            if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(newStatus)) {
              toast.error("Course annulée", { description: "Cette réservation n'est plus active." });
              setError({
                code: "expired",
                title: "Course annulée ou refusée",
                message: "Cette course n'est plus active. Contactez-nous pour en créer une nouvelle.",
              });
              return;
            }
            if (["terminee", "terminée", "completed", "done"].includes(newStatus)) {
              toast.info("Course terminée", { description: "Merci d'avoir voyagé avec Taxi City Bordeaux." });
              setError({
                code: "expired",
                title: "Course terminée",
                message: "Cette course est déjà terminée. Merci d'avoir voyagé avec Taxi City Bordeaux.",
              });
              return;
            }
            setReservation((prev) => {
              const next = {
                id: resaId,
                client_name: (r.client_name || r.nom || prev?.client_name || "").toString().trim(),
                depart: r.depart ?? prev?.depart ?? null,
                destination: r.destination ?? r.arrivee ?? prev?.destination ?? null,
                prix_estime: r.prix_estime != null ? `${r.prix_estime} €` : (prev?.prix_estime ?? null),
                pickup_datetime: r.pickup_datetime ?? prev?.pickup_datetime ?? null,
              };
              if (prev) {
                if (prev.prix_estime !== next.prix_estime && next.prix_estime)
                  toast.info("💶 Prix mis à jour", { description: next.prix_estime });
                if (prev.destination !== next.destination && next.destination)
                  toast.info("📍 Destination mise à jour", { description: next.destination });
              }
              if (
                next.depart &&
                next.destination &&
                (prev?.depart !== next.depart || prev?.destination !== next.destination)
              ) {
                drawTripRoute(next.depart, next.destination);
              }
              return next;
            });
          },
        )
        .subscribe();

      channelRef.current = [gpsChannel, resaChannel];
    },
    [startPolling, stopPolling],
  );

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resaId = resaIdRef.current;
      const gpsId = gpsIdRef.current;
      if (resaId) {
        const { data: r } = await supabase
          .from("reservations")
          .select("client_name,nom,depart,arrivee,destination,prix_estime,pickup_datetime")
          .eq("id", resaId)
          .maybeSingle();
        if (r) {
          setReservation((prev) => ({
            id: resaId,
            client_name: (r.client_name || r.nom || prev?.client_name || "").toString().trim(),
            depart: r.depart ?? prev?.depart ?? null,
            destination: r.destination ?? r.arrivee ?? prev?.destination ?? null,
            prix_estime: r.prix_estime != null ? `${r.prix_estime} €` : (prev?.prix_estime ?? null),
            pickup_datetime: r.pickup_datetime ?? prev?.pickup_datetime ?? null,
          }));
        }
      }
      const { data } = await supabase.from("driver_gps").select("*").eq("id", gpsId).maybeSingle();
      if (data) {
        setDriverData(data as DriverData);
        setLastUpdate(new Date());
      }
      // FIX MOBILE: invalider la taille de la carte après refresh aussi
      if (mapInstanceRef.current) {
        setTimeout(() => mapInstanceRef.current?.invalidateSize({ animate: false }), 100);
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
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
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
        setError({
          code: "invalid",
          title: "QR code invalide",
          message: `${reason}. Le lien scanné ne correspond pas au format attendu (UUID).`,
        });
        setLoading(false);
        return;
      }
      const trackingId = parsed.data;

      setLoadStep(1);
      const { data: resa, error: resaErr } = await supabase
        .from("reservations")
        .select(
          "id, status, tracking_id, created_at, client_name, nom, depart, arrivee, destination, prix_estime, pickup_datetime",
        )
        .eq("tracking_id", trackingId)
        .maybeSingle();

      if (resaErr || !resa) {
        toast.error("Aucune course trouvée", { id: toastId });
        setError({
          code: "notfound",
          title: "Aucune course trouvée",
          message: "Ce QR code ne correspond à aucune course active.",
        });
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
        setError({
          code: "expired",
          title: "Course terminée",
          message: "Merci d'avoir voyagé avec Taxi City Bordeaux.",
        });
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

      setReservation({
        id: resa.id,
        client_name: clientName,
        depart: resa.depart ?? null,
        destination: resa.destination ?? resa.arrivee ?? null,
        prix_estime: resa.prix_estime != null ? `${resa.prix_estime} €` : null,
        pickup_datetime: resa.pickup_datetime ?? null,
      });

      if (resa.pickup_datetime) {
        schedulePickupNotification(resa.pickup_datetime);
      }

      const dep = resa.depart ?? null;
      const dest = resa.destination ?? resa.arrivee ?? null;
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
          await calculateETA(data.latitude, data.longitude, destCoordsRef.current ?? undefined);
          setLastUpdate(new Date());
        } else {
          await initMap(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
        }
      } else {
        await initMap(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
      }

      const destAddr = resa.destination ?? resa.arrivee ?? null;
      if (resa.depart && destAddr) drawTripRoute(resa.depart, destAddr);

      toast.success("✅ Course trouvée", {
        id: toastId,
        description: `${clientName ? clientName + " — " : ""}mode ${mode === "multi" ? "multi-courses" : "chauffeur unique"}`,
        duration: 4000,
      });
      setLoading(false);

      subscribeRealtime(gpsId, resa.id, resa, mode);

      // NE PAS démarrer le GPS ici : cette page est consultée par le client.
      // Le GPS chauffeur est envoyé depuis /chauffeur ou /admin/gps.
      // Démarrer watchPosition ici écraserait driver_gps avec la position du client.
    };

    init();
    return () => {
      const ch = channelRef.current;
      if (Array.isArray(ch)) ch.forEach((c) => c && supabase.removeChannel(c));
      else if (ch) supabase.removeChannel(ch);
      channelRef.current = null;
      stopPolling();
      stopGeoTracking();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (approachLayerRef.current) {
        approachLayerRef.current.remove();
        approachLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [id, retryNonce, subscribeRealtime, stopPolling, stopGeoTracking, startGeoTracking, schedulePickupNotification]);

  const styleTag = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
      @keyframes driverPulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,0)}50%{box-shadow:0 0 0 14px rgba(14,165,233,0.15)}}
      @keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
      @keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes spinTaxi{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      details summary::-webkit-details-marker { display: none; }
      /* FIX MOBILE: empêche le double-tap zoom sur iOS */
      button, a { touch-action: manipulation; }
      /* FIX MOBILE: Leaflet canvas pleine taille dans son conteneur */
      .leaflet-container { width: 100% !important; height: 100% !important; }
    `}</style>
  );

  const addToCalendar = (type: "google" | "apple") => {
    if (!reservation?.pickup_datetime) return;
    const start = new Date(reservation.pickup_datetime);
    const end = new Date(start.getTime() + 60 * 60_000);
    const title = encodeURIComponent("Course Taxi City Bordeaux");
    const details = encodeURIComponent(
      `Départ : ${reservation.depart || "—"}\nDestination : ${reservation.destination || "—"}\nChauffeur : 06 73 07 23 22`,
    );
    const loc = encodeURIComponent(reservation.depart || "Bordeaux");

    if (type === "google") {
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      window.open(
        `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${loc}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TaxiCityBordeaux//FR",
        "BEGIN:VEVENT",
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:Course Taxi City Bordeaux`,
        `DESCRIPTION:Départ : ${reservation.depart || "—"}\\nDestination : ${reservation.destination || "—"}`,
        `LOCATION:${reservation.depart || "Bordeaux"}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "course-taxi.ics";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    const steps = [
      { label: "Connexion sécurisée…", icon: "🔐" },
      { label: "Recherche du chauffeur…", icon: "🔎" },
      { label: "Récupération de la position GPS…", icon: "📡" },
      { label: "Calcul de l'itinéraire…", icon: "🗺️" },
    ];
    const pct = [20, 45, 70, 95][loadStep] ?? 20;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0f1e",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          padding: 24,
        }}
      >
        {styleTag}
        <div
          style={{
            position: "relative",
            width: 110,
            height: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="110" height="110" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx="55" cy="55" r="48" stroke="rgba(14,165,233,0.12)" strokeWidth="6" fill="none" />
            <circle
              cx="55"
              cy="55"
              r="48"
              stroke="#0ea5e9"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 48}
              strokeDashoffset={2 * Math.PI * 48 * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          </svg>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid #0ea5e9",
              animation: "spinTaxi 2s linear infinite",
              display: "inline-block",
            }}
          >
            <img src={TAXI_ICON_URI} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="taxi" />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: "#f8fafc",
              marginBottom: 6,
            }}
          >
            {steps[loadStep].icon} {steps[loadStep].label}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#0ea5e9" }}>
            {Math.round(pct)}% · {elapsed}s
          </div>
        </div>
        <div style={{ width: "min(320px,80vw)", display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: i <= loadStep ? 1 : 0.35,
                transition: "opacity 0.3s",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: i < loadStep ? "#22c55e" : i === loadStep ? "#0ea5e9" : "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "#fff",
                  fontWeight: 700,
                  animation: i === loadStep ? "liveDot 1.2s infinite" : "none",
                }}
              >
                {i < loadStep ? "✓" : ""}
              </span>
              <span
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  color: i <= loadStep ? "#cbd5e1" : "#475569",
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
        {elapsed > 12 && elapsed <= 30 && (
          <p style={{ fontSize: 12, color: "#64748b", maxWidth: 300, textAlign: "center", marginTop: 4 }}>
            La connexion prend plus de temps que prévu…
          </p>
        )}
        {elapsed > 30 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 6 }}>
            <p style={{ fontSize: 13, color: "#fbbf24", textAlign: "center", margin: 0 }}>
              ⏱️ Récupération trop longue. Vérifiez votre connexion.
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                setElapsed(0);
                setLoadStep(0);
                setRetryNonce((n) => n + 1);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              🔄 Réessayer
            </button>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    const icon = error.code === "invalid" ? "⚠️" : error.code === "expired" ? "⏱️" : "🔍";
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0f1e",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 28,
          textAlign: "center",
        }}
      >
        {styleTag}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.12)",
            border: "2px solid rgba(245,158,11,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
          }}
        >
          {icon}
        </div>
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 22, color: "#f8fafc", margin: 0 }}>
            {error.title}
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 14,
              color: "#94a3b8",
              marginTop: 10,
              lineHeight: 1.55,
            }}
          >
            {error.message}
          </p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#334155", marginTop: 12 }}>
            Code: {id?.slice(0, 12) || "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => setRetryNonce((n) => n + 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🔄 Réessayer
          </button>
          <a
            href="https://taxicitybordeaux.fr"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "rgba(255,255,255,0.06)",
              color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            🏠 Site
          </a>
          <a
            href="tel:0673072322"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "#22c55e",
              color: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            📞 Appeler
          </a>
        </div>
        <div
          style={{
            marginTop: 14,
            padding: "14px 18px",
            background: "rgba(14,165,233,0.06)",
            border: "1px solid rgba(14,165,233,0.2)",
            borderRadius: 14,
            maxWidth: 380,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "#cbd5e1",
              marginBottom: 8,
            }}
          >
            🆘 Besoin d'aide ?
          </div>
          <p
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12,
              color: "#94a3b8",
              margin: "0 0 10px",
              lineHeight: 1.5,
            }}
          >
            Notre équipe vous répond 7j/7.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href={`https://wa.me/33673072322?text=${encodeURIComponent(`Bonjour, j'obtiens l'erreur « ${error.title} ». Code : ${id?.slice(0, 12) || "—"}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "#25D366",
                color: "#fff",
                borderRadius: 10,
                textDecoration: "none",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              💬 WhatsApp
            </a>
            <a
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "rgba(255,255,255,0.08)",
                color: "#f1f5f9",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                textDecoration: "none",
                fontFamily: "'Syne',sans-serif",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ✉️ Assistance
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isIncomplete = reservation && !reservation.depart && !reservation.destination && !reservation.prix_estime;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      {styleTag}
      {showHelp && reservation && <HelpPanel reservationId={reservation.id} onClose={() => setShowHelp(false)} />}

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(10,15,30,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #0ea5e9",
              flexShrink: 0,
            }}
          >
            <img src={TAXI_ICON_URI} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="taxi" />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>
              Taxi City Bordeaux
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>Votre course en temps réel</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Bouton retour site */}
          <a
            href="https://taxicitybordeaux.fr"
            style={{
              width: 36,
              height: 36,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              textDecoration: "none",
            }}
            title="Retour au site"
          >
            🏠
          </a>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Rafraîchir"
            style={{
              width: 36,
              height: 36,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: refreshing ? "wait" : "pointer",
              color: "#94a3b8",
              fontSize: 16,
            }}
          >
            <span style={{ display: "inline-block", animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
              🔄
            </span>
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: driverData?.is_active ? "rgba(14,165,233,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${driverData?.is_active ? "rgba(14,165,233,0.3)" : "rgba(245,158,11,0.3)"}`,
              borderRadius: 99,
              padding: "5px 12px",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: driverData?.is_active ? "#0ea5e9" : "#f59e0b",
                display: "inline-block",
                animation: "liveDot 2s infinite",
              }}
            />
            <span
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 12,
                fontWeight: 700,
                color: driverData?.is_active ? "#0ea5e9" : "#f59e0b",
              }}
            >
              {driverData?.is_active ? "En route" : "En attente"}
            </span>
          </div>
          {geoWatchIdRef.current !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 99,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "inline-block",
                  animation: "liveDot 1.5s infinite",
                }}
              />
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, color: "#22c55e" }}>
                GPS
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(135deg,rgba(14,165,233,0.14),rgba(14,165,233,0.04))",
          borderBottom: "1px solid rgba(14,165,233,0.25)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>📲</span>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#cbd5e1", lineHeight: 1.45 }}>
          <strong style={{ color: "#f1f5f9", fontFamily: "'Syne',sans-serif" }}>Suivi en temps réel.</strong> Gardez
          cette page ouverte sur votre téléphone.
        </div>
      </div>

      {/* Carte : div toujours dans le DOM pour que Leaflet puisse s'initialiser */}
      <div
        style={{
          height: driverData?.is_active ? mapHeight : 0,
          minHeight: driverData?.is_active ? mapHeight : 0,
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
          transition: "height 0.4s ease, min-height 0.4s ease",
        }}
      >
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {/* Overlay quand GPS actif mais position pas encore reçue */}
        {driverData?.is_active && !driverData?.latitude && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(10,15,30,0.92)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 24,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 36 }}>📡</span>
            <p style={{ color: "#f8fafc", fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, margin: 0 }}>
              Acquisition de la position…
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
              Le GPS est actif. La carte s'affichera dans un instant.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#0ea5e9",
                    display: "inline-block",
                    animation: `liveDot 1.2s ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {lastUpdate && driverData?.is_active && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "rgba(10,15,30,0.8)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "5px 10px",
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#475569" }}>
              Mis à jour {lastUpdate.toLocaleTimeString("fr-FR")}
            </span>
          </div>
        )}
      </div>

      {/* Bandeau compact quand GPS inactif */}
      {!driverData?.is_active && (
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(10,15,30,0.6)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 28, flexShrink: 0 }}>🅿️</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#f8fafc", fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800, margin: 0 }}>
              Le chauffeur n'est pas encore en course
            </p>
            <p style={{ color: "#64748b", fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>
              Sa position s'affichera ici dès qu'il l'aura activée.
            </p>
          </div>
          <a
            href="tel:0673072322"
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#22c55e",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            📞 Appeler
          </a>
        </div>
      )}

      {/* Panneau bas */}
      <div
        style={{
          background: "#111827",
          borderRadius: "24px 24px 0 0",
          padding: "24px 20px 40px",
          animation: "slideUp 0.4s ease",
          flex: 1,
        }}
      >
        {/* ETA + Prix */}
        <div
          style={{
            background: "rgba(14,165,233,0.07)",
            border: "1px solid rgba(14,165,233,0.15)",
            borderRadius: 18,
            padding: 20,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10,
                color: "#334155",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              ARRIVÉE ESTIMÉE
            </div>
            <div
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 38,
                fontWeight: 900,
                color: "#f8fafc",
                lineHeight: 1,
              }}
            >
              {eta.minutes !== null ? `${eta.minutes} min` : "Calcul..."}
            </div>
            {eta.km && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{eta.km} km restants</div>}
          </div>
          {(reservation?.prix_estime || driverData?.prix_estime) && (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10,
                  color: "#334155",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                PRIX ESTIMÉ
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 900, color: "#f8fafc" }}>
                {reservation?.prix_estime || driverData?.prix_estime}
              </div>
            </div>
          )}
        </div>

        {/* ── Barre de trajet départ → destination ── */}
        {(reservation?.depart || reservation?.destination) &&
          (() => {
            const kmLeft = eta.km ? parseFloat(eta.km) : null;
            const pctDone =
              totalKm && kmLeft !== null
                ? Math.min(100, Math.max(0, Math.round(((totalKm - kmLeft) / totalKm) * 100)))
                : null;
            return (
              <div
                style={{
                  marginTop: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "16px 16px 14px",
                }}
              >
                {/* Marqueurs départ / destination */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🟢</span>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🏁</span>
                </div>

                {/* Barre bleue uniquement */}
                <div
                  style={{
                    position: "relative",
                    height: 6,
                    borderRadius: 3,
                    overflow: "visible",
                    background: "transparent",
                  }}
                >
                  {/* Fond transparent — pas de ligne grise */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: pctDone !== null ? `${pctDone}%` : "0%",
                      background: "#0ea5e9",
                      borderRadius: 3,
                      transition: "width 0.6s ease",
                    }}
                  />
                  {/* Icône taxi sur la barre */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: pctDone !== null ? `${pctDone}%` : "0%",
                      transform: "translate(-50%, -50%)",
                      transition: "left 0.6s ease",
                      zIndex: 2,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#0ea5e9",
                      border: "2px solid #fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      boxShadow: "0 2px 8px rgba(14,165,233,0.45)",
                    }}
                  >
                    <img
                      src={TAXI_ICON_URI}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                      alt="taxi"
                    />
                  </div>
                </div>

                {/* Labels départ / destination */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
                      color: "#475569",
                      maxWidth: "45%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {reservation?.depart || "—"}
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
                      color: "#475569",
                      maxWidth: "45%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                    }}
                  >
                    {reservation?.destination || driverData?.destination || "—"}
                  </span>
                </div>

                {/* Pourcentage parcouru */}
                {pctDone !== null && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11,
                        color: "#0ea5e9",
                      }}
                    >
                      {pctDone}% parcouru · {eta.km} km restants
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

        {reservation?.pickup_datetime &&
          (() => {
            const d = new Date(reservation.pickup_datetime);
            const formatted = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
            const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            return (
              <div
                style={{
                  marginTop: 12,
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🕒</span>
                  <div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 10,
                        color: "#334155",
                        letterSpacing: "0.08em",
                      }}
                    >
                      PRISE EN CHARGE
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#f1f5f9",
                        marginTop: 3,
                        textTransform: "capitalize",
                      }}
                    >
                      {formatted} · {time}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => addToCalendar("google")}
                    title="Ajouter à Google Calendar"
                    style={{
                      padding: "7px 12px",
                      background: "rgba(14,165,233,0.15)",
                      border: "1px solid rgba(14,165,233,0.3)",
                      color: "#0ea5e9",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    📅 Google
                  </button>
                  <button
                    onClick={() => addToCalendar("apple")}
                    title="Ajouter à Apple Calendar (.ics)"
                    style={{
                      padding: "7px 12px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#94a3b8",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    🍎 Apple
                  </button>
                </div>
              </div>
            );
          })()}

        {isIncomplete && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 22, lineHeight: 1, animation: "liveDot 2s infinite" }}>⏳</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800, color: "#fde68a" }}>
                  Détails en cours de finalisation
                </div>
                <p
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13,
                    color: "#cbd5e1",
                    margin: "4px 0 8px",
                    lineHeight: 1.5,
                  }}
                >
                  Le départ, la destination et le prix seront disponibles très prochainement.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: "rgba(14,165,233,0.15)",
                      border: "1px solid rgba(14,165,233,0.3)",
                      color: "#0ea5e9",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{ display: "inline-block", animation: refreshing ? "spin 0.8s linear infinite" : "none" }}
                    >
                      🔄
                    </span>{" "}
                    Rafraîchir
                  </button>
                  <button
                    onClick={() => setShowHelp(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      color: "#fde68a",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    🆘 Besoin d'aide ?
                  </button>
                  <a
                    href="tel:0673072322"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.25)",
                      color: "#22c55e",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    📞 Appeler
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {reservation?.client_name && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.18)",
              borderRadius: 14,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>👋</span>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10,
                  color: "#334155",
                  letterSpacing: "0.08em",
                }}
              >
                COURSE DE
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  marginTop: 3,
                }}
              >
                {reservation.client_name}
              </div>
            </div>
          </div>
        )}

        {reservation?.depart && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 22 }}>🟢</span>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10,
                  color: "#334155",
                  letterSpacing: "0.08em",
                }}
              >
                DÉPART
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  marginTop: 3,
                }}
              >
                {reservation.depart}
              </div>
            </div>
          </div>
        )}

        {(reservation?.destination || driverData?.destination) && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 22 }}>📍</span>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10,
                  color: "#334155",
                  letterSpacing: "0.08em",
                }}
              >
                DESTINATION
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  marginTop: 3,
                }}
              >
                {reservation?.destination || driverData?.destination}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 50,
              height: 50,
              flexShrink: 0,
              background: "rgba(14,165,233,0.12)",
              border: "2px solid rgba(14,165,233,0.3)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            👨‍✈️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
              Taxi City Bordeaux
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Conventionné · Toutes assurances</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 1 }}>Disponible 7j/7 · 24h/24</div>
          </div>
        </div>

        <a
          href="tel:0673072322"
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 52,
            background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
            borderRadius: 14,
            fontFamily: "'Syne',sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: "#fff",
            textDecoration: "none",
          }}
        >
          📞 Appeler mon taxi
        </a>

        <button
          onClick={() => setShowHelp(true)}
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 44,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#64748b",
            cursor: "pointer",
          }}
        >
          🆘 Besoin d'aide ?
        </button>

        {/* Bouton retour site — footer */}
        <a
          href="https://taxicitybordeaux.fr"
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            height: 44,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#475569",
            textDecoration: "none",
          }}
        >
          🏠 Retour sur taxicitybordeaux.fr
        </a>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#1e293b" }}>Position mise à jour en temps réel · Sans application</p>
        </div>
      </div>
    </div>
  );
}
