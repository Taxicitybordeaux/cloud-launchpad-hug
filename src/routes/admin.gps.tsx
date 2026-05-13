import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
import { GpsCardSkeleton, SkeletonStyles } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/gps")({
  head: () => ({ meta: [{ title: "GPS — Admin" }, { name: "robots", content: "noindex" }] }),
  component: GpsPage,
});

function GpsPage() {
  const [isActive, setIsActive] = useState(false);
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(true);
  const [prixEstime, setPrixEstime] = useState("");
  const [calcKm, setCalcKm] = useState(5);
  const [calcJour, setCalcJour] = useState(true);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const initGPS = async () => {
      const { data, error } = await supabase.from("driver_gps").select("*").eq("id", "driver").single();

      if (error || !data) {
        await supabase.from("driver_gps").insert({
          id: "driver",
          is_active: false,
          latitude: 0,
          longitude: 0,
        });
        setLoading(false);
        return;
      }

      setIsActive(!!data.is_active);
      setDestination(data.destination ?? "");
      setPrixEstime(data.prix_estime ?? "");
      setLoading(false);
    };

    initGPS();
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined")
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const startGPS = async () => {
    if (!navigator.geolocation) return;
    await supabase
      .from("driver_gps")
      .update({
        is_active: true,
        destination: destination || null,
        prix_estime: prixEstime || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "driver");
    setIsActive(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
        setAccuracy(Math.round(acc));
        setUpdateCount((n) => n + 1);
        await supabase
          .from("driver_gps")
          .update({
            latitude,
            longitude,
            accuracy: acc,
            updated_at: new Date().toISOString(),
          })
          .eq("id", "driver");
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  };

  const stopGPS = async () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    await supabase
      .from("driver_gps")
      .update({
        is_active: false,
        destination: null,
        prix_estime: null,
      })
      .eq("id", "driver");
    setIsActive(false);
    setPosition(null);
    setAccuracy(null); // ✅ fix: reset accuracy
    setUpdateCount(0);
  };

  const calcPrix = calculerPrix(calcKm, calcJour);

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }}>
      <style>{`
        @keyframes pulseDot {
          0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,0); }
          50%      { box-shadow:0 0 0 14px rgba(34,197,94,0.2); }
        }
        .gps-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #fff;
          fontSize: 14px;
          outline: none;
        }
        .gps-input:focus { border-color: rgba(14,165,233,0.5); }
      `}</style>

      <h1
        style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 26,
          fontWeight: 800,
          color: "#f8fafc",
          margin: "0 0 20px",
        }}
      >
        GPS Chauffeur
      </h1>

      <SkeletonStyles />

      {loading ? (
        <GpsCardSkeleton />
      ) : (
        <div
          style={{
            maxWidth: 540,
            margin: "0 auto",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          {!isActive ? (
            <>
              <div style={{ fontSize: 52 }}>📡</div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", color: "#f8fafc", marginTop: 10, fontSize: 20 }}>
                Votre position est inactive
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Les clients ne peuvent pas vous suivre</p>

              <div style={{ marginTop: 20, textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  className="gps-input"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Destination du prochain client"
                />
                <input
                  className="gps-input"
                  value={prixEstime}
                  onChange={(e) => setPrixEstime(e.target.value)}
                  placeholder='Prix estimé ex: "12.50 €"'
                />

                {/* Calcul rapide */}
                <div
                  style={{
                    background: "rgba(14,165,233,0.07)",
                    border: "1px solid rgba(14,165,233,0.15)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Calcul rapide</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="number"
                      value={calcKm}
                      onChange={(e) => setCalcKm(Number(e.target.value))}
                      step="0.1"
                      style={{
                        width: 80,
                        padding: "6px 8px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                        borderRadius: 8,
                        fontSize: 14,
                        boxSizing: "border-box",
                      }}
                    />
                    <span style={{ color: "#cbd5e1", fontSize: 13 }}>km</span>
                    <label style={{ color: "#cbd5e1", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={calcJour} onChange={(e) => setCalcJour(e.target.checked)} />
                      Jour
                    </label>
                    <button
                      type="button"
                      onClick={() => setPrixEstime(`${calcPrix} €`)}
                      style={{
                        marginLeft: "auto",
                        background: "#0ea5e9",
                        color: "#fff",
                        border: 0,
                        padding: "7px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      = {calcPrix} €
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={startGPS}
                style={{
                  marginTop: 20,
                  width: "100%",
                  height: 56,
                  background: "#22c55e",
                  color: "#fff",
                  border: 0,
                  borderRadius: 14,
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
                }}
              >
                📡 Activer mon GPS
              </button>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: "#22c55e",
                  borderRadius: "50%",
                  margin: "0 auto",
                  animation: "pulseDot 2s infinite",
                }}
              />
              <h2 style={{ fontFamily: "'Syne',sans-serif", color: "#f8fafc", marginTop: 16, fontSize: 20 }}>
                Position active
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Vos clients vous voient</p>

              {position && (
                <div
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 12,
                    color: "#cbd5e1",
                    marginTop: 14,
                    wordBreak: "break-all",
                  }}
                >
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </div>
              )}
              {accuracy !== null && (
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                  Précision : ±{accuracy} m · {updateCount} mises à jour
                </div>
              )}
              {destination && <div style={{ marginTop: 14, color: "#cbd5e1", fontSize: 14 }}>📍 {destination}</div>}
              {prixEstime && (
                <div
                  style={{
                    color: "#0ea5e9",
                    fontFamily: "'Syne',sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    marginTop: 4,
                  }}
                >
                  {prixEstime}
                </div>
              )}

              <button
                onClick={stopGPS}
                style={{
                  marginTop: 24,
                  width: "100%",
                  height: 52,
                  background: "#ef4444",
                  color: "#fff",
                  border: 0,
                  borderRadius: 14,
                  fontFamily: "'Syne',sans-serif",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                ⏹ Terminer la course
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
