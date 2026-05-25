// FCM-only hook — auto-subscribe au montage si autoAudience est fourni.
// Usage client  : usePushNotifications({ autoAudience: "client", reservationId })
// Usage chauffeur/admin : usePushNotifications({ autoAudience: "chauffeur" })
//                         (le dashboard gère "admin" ET "chauffeur" en parallèle via son propre useEffect)
// Usage manuel  : usePushNotifications() puis appeler subscribe(audience, reservationId)
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { subscribePush, type PushAudience } from "@/lib/push.functions";
import { getFcmToken } from "@/lib/firebase";

export type PushStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

interface UsePushOptions {
  /** Si fourni, souscrit automatiquement au montage avec cette audience. */
  autoAudience?: PushAudience;
  /** reservation_id à associer (pour audience "client"). */
  reservationId?: string;
}

export function usePushNotifications(opts: UsePushOptions = {}) {
  const { autoAudience, reservationId } = opts;
  const [status, setStatus] = useState<PushStatus>("idle");
  const [token, setToken] = useState<string | null>(null);

  const subscribeFn = useServerFn(subscribePush);

  // ── Détection support initial ──
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") setStatus("denied");
    else if (perm === "granted") setStatus("granted");
  }, []);

  // ── Auto-subscribe au montage ──
  useEffect(() => {
    if (!autoAudience) return;
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;

    let cancelled = false;
    const run = async () => {
      try {
        const fcm = await getFcmToken(); // demande la permission si nécessaire
        if (!fcm || cancelled) return;
        await subscribeFn({
          data: {
            audience: autoAudience,
            fcm_token: fcm,
            reservation_id: reservationId ?? null,
            user_agent: navigator.userAgent.slice(0, 500),
          },
        });
        if (!cancelled) {
          setToken(fcm);
          setStatus("granted");
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[push] auto-subscribe failed", autoAudience, e);
          setStatus(
            typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied"
              ? "denied"
              : "idle",
          );
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // reservationId volontairement exclu : on ne re-subscribe pas si l'id change après le montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAudience]);

  // ── Subscribe manuel (pour les appels explicites) ──
  const subscribe = useCallback(
    async (audience: PushAudience = "client", resId?: string): Promise<boolean> => {
      setStatus("loading");
      try {
        const fcm = await getFcmToken();
        if (!fcm) {
          setStatus(Notification.permission === "denied" ? "denied" : "unsupported");
          return false;
        }
        await subscribeFn({
          data: {
            audience,
            fcm_token: fcm,
            reservation_id: resId ?? reservationId ?? null,
            user_agent: navigator.userAgent.slice(0, 500),
          },
        });
        setToken(fcm);
        setStatus("granted");
        return true;
      } catch (err) {
        console.error("[push] subscribe error", err);
        setStatus("denied");
        return false;
      }
    },
    [subscribeFn, reservationId],
  );

  const testNotification = useCallback(async () => {
    if (status !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("🚕 Test — Taxi City Bordeaux", {
      body: "Les notifications sont bien activées !",
      icon: "/favicon.ico",
    });
  }, [status]);

  return { status, subscription: token, subscribe, testNotification };
}
