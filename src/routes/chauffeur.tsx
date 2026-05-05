import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Navigation, Power, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/chauffeur")({
  head: () => ({
    meta: [
      { title: "Chauffeur — Partage de position" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ChauffeurPage,
});

const KEY_STORAGE = "tcb_driver_key";

function ChauffeurPage() {
  const [driverKey, setDriverKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [sending, setSending] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const k = localStorage.getItem(KEY_STORAGE);
    if (k) { setSavedKey(k); setDriverKey(k); }
  }, []);

  const post = async (body: object, key: string) => {
    setSending(true);
    try {
      const res = await fetch("/api/public/driver-location", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-driver-key": key },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status === 401) setError("Clé chauffeur invalide");
        else setError(`Erreur ${res.status}`);
        return false;
      }
      setError(null);
      setLastSent(new Date());
      return true;
    } catch (e) {
      setError("Impossible de joindre le serveur");
      return false;
    } finally { setSending(false); }
  };

  const startTracking = async () => {
    if (!navigator.geolocation) { setError("Géolocalisation non supportée"); return; }
    if (!driverKey) { setError("Entrez votre clé chauffeur"); return; }
    localStorage.setItem(KEY_STORAGE, driverKey);
    setSavedKey(driverKey);
    setError(null);

    const id = navigator.geolocation.watchPosition(
      async (p) => {
        setPos(p);
        await post({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
          speed: p.coords.speed ?? null,
          heading: p.coords.heading ?? null,
          is_online: true,
        }, driverKey);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    watchIdRef.current = id;
    setOnline(true);
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setOnline(false);
    if (savedKey && pos) {
      await post({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        is_online: false,
      }, savedKey);
    }
  };

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Chauffeur — Partage de position</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Activez le partage GPS pour que vos clients suivent votre arrivée en temps réel.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Clé chauffeur</label>
          <input
            type="password"
            value={driverKey}
            onChange={(e) => setDriverKey(e.target.value)}
            disabled={online}
            placeholder="••••••••"
            className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
          />
        </div>

        {!online ? (
          <button
            onClick={startTracking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
          >
            <Navigation className="h-5 w-5" /> Activer le partage de position
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-5 py-3 font-semibold text-destructive-foreground"
          >
            <Power className="h-5 w-5" /> Arrêter le partage
          </button>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {online && (
          <div className="rounded-md border border-border bg-input/40 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-semibold">En ligne</span>
              {sending && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            {pos && (
              <>
                <p>Lat: {pos.coords.latitude.toFixed(5)}, Lon: {pos.coords.longitude.toFixed(5)}</p>
                <p>Précision: ±{Math.round(pos.coords.accuracy)} m</p>
              </>
            )}
            {lastSent && <p>Dernier envoi: {lastSent.toLocaleTimeString()}</p>}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Conseil : gardez l'écran allumé pendant les courses. Sur mobile, ajoutez cette page à l'écran d'accueil.
      </p>
    </div>
  );
}
