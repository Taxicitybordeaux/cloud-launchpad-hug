import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, MapPin, Clock, Navigation, Phone, PowerOff } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/suivi/$id")({
  head: () => ({
    meta: [
      { title: "Suivi du chauffeur — Taxi City Bordeaux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuiviPage,
});

type Reservation = {
  id: string; nom: string; depart: string; pickup_datetime: string;
  status: string;
};
type DriverLoc = {
  latitude: number; longitude: number; accuracy: number | null;
  speed: number | null; heading: number | null;
  is_online: boolean; updated_at: string;
};

// Average urban driving speed in km/h (used as fallback when GPS speed unavailable)
const AVG_SPEED_KMH = 35;

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function geocode(query: string): Promise<[number, number] | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query + ", Bordeaux, France")}`,
      { headers: { Accept: "application/json" } }
    );
    const j = await r.json();
    if (Array.isArray(j) && j.length > 0) return [parseFloat(j[0].lat), parseFloat(j[0].lon)];
    return null;
  } catch { return null; }
}

function SuiviPage() {
  const t = useT();
  const { id } = Route.useParams();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [driver, setDriver] = useState<DriverLoc | null>(null);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);

  // Load reservation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_reservation_public", { p_id: id });
      if (cancelled) return;
      if (error || !data || data.length === 0) { setError("not_found"); setLoading(false); return; }
      const r = data[0] as Reservation;
      setReservation(r);
      const c = await geocode(r.depart);
      if (!cancelled) setPickupCoords(c);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Load driver location + realtime subscribe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("driver_location")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setDriver(data as DriverLoc);
    })();

    const channel = supabase
      .channel("driver_location_changes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "driver_location" },
        (payload) => {
          const row = (payload.new ?? payload.old) as DriverLoc;
          if (row) setDriver(row);
        })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  // Init Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    let mounted = true;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (!mounted || !mapRef.current) return;
      const map = L.map(mapRef.current).setView([44.8378, -0.5792], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      leafletRef.current = { L, map };
    })();
    return () => {
      mounted = false;
      if (leafletRef.current?.map) { leafletRef.current.map.remove(); leafletRef.current = null; }
    };
  }, []);

  // Update markers
  useEffect(() => {
    const ctx = leafletRef.current;
    if (!ctx) return;
    const { L, map } = ctx;

    if (pickupCoords) {
      if (!pickupMarkerRef.current) {
        const icon = L.divIcon({
          html: '<div style="background:hsl(var(--primary,0 0% 50%));width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px rgba(0,0,0,0.3)"></div>',
          className: "", iconSize: [18, 18], iconAnchor: [9, 9],
        });
        pickupMarkerRef.current = L.marker(pickupCoords, { icon }).addTo(map).bindPopup("Point de prise en charge");
      } else {
        pickupMarkerRef.current.setLatLng(pickupCoords);
      }
    }

    if (driver) {
      const dCoords: [number, number] = [driver.latitude, driver.longitude];
      const opacity = driver.is_online ? 1 : 0.45;
      const icon = L.divIcon({
        html: `<div style="background:#22c55e;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(34,197,94,0.3);opacity:${opacity}">🚕</div>`,
        className: "", iconSize: [22, 22], iconAnchor: [11, 11],
      });
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker(dCoords, { icon }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng(dCoords);
        driverMarkerRef.current.setIcon(icon);
      }

      if (pickupCoords) {
        if (lineRef.current) lineRef.current.remove();
        lineRef.current = L.polyline([dCoords, pickupCoords], {
          color: "#22c55e", weight: 3, opacity: 0.6, dashArray: "8 6",
        }).addTo(map);
        const bounds = L.latLngBounds([dCoords, pickupCoords]).pad(0.3);
        map.fitBounds(bounds);
      } else {
        map.setView(dCoords, 14);
      }
    }
  }, [driver, pickupCoords]);

  const eta = useMemo(() => {
    if (!driver || !pickupCoords) return null;
    const km = haversineKm([driver.latitude, driver.longitude], pickupCoords);
    const speedKmh = driver.speed && driver.speed > 1 ? driver.speed * 3.6 : AVG_SPEED_KMH;
    const minutes = Math.max(1, Math.round((km / speedKmh) * 60));
    return { km, minutes };
  }, [driver, pickupCoords]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="mt-6 font-display text-3xl font-bold">{t("suivi.notfound.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("suivi.notfound.desc")}</p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">
          {t("suivi.back_home")}
        </Link>
      </div>
    );
  }

  const stale = driver && (Date.now() - new Date(driver.updated_at).getTime()) > 60_000;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{t("suivi.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("suivi.hello")} {reservation.nom} — {t("suivi.pickup_at")} {new Date(reservation.pickup_datetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          icon={driver?.is_online && !stale ? Navigation : PowerOff}
          label={t("suivi.status")}
          value={driver?.is_online && !stale ? t("suivi.online") : t("suivi.offline")}
          accent={!!driver?.is_online && !stale}
        />
        <Stat
          icon={Clock}
          label={t("suivi.eta")}
          value={eta && driver?.is_online && !stale ? `${eta.minutes} min` : "—"}
        />
        <Stat
          icon={MapPin}
          label={t("suivi.distance")}
          value={eta ? `${eta.km.toFixed(1)} km` : "—"}
        />
      </div>

      <div ref={mapRef} className="mt-6 h-[420px] w-full overflow-hidden rounded-2xl border border-border" />

      {stale && driver && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("suivi.last_update")}: {new Date(driver.updated_at).toLocaleTimeString()}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <a href="tel:0673072322" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-semibold transition hover:border-primary">
          <Phone className="h-4 w-4" /> 06 73 07 23 22
        </a>
        <Link to="/reservation/$id" params={{ id: reservation.id }} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 font-semibold transition hover:border-primary">
          {t("suivi.view_reservation")}
        </Link>
      </div>
    </div>
  );
}

function Power({ className }: { className?: string }) {
  return <span className={className}>●</span>;
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
