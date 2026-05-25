// FCM-only hook. Conserve l'ancienne API (subscribe / status) pour les pages clients.
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { subscribePush, type PushAudience } from "@/lib/push.functions";
import { getFcmToken } from "@/lib/firebase";

export type PushStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [token, setToken] = useState<string | null>(null);

  const subscribeFn = useServerFn(subscribePush);

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

  const subscribe = useCallback(
    async (audience: PushAudience = "client", reservationId?: string): Promise<boolean> => {
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
            reservation_id: reservationId ?? null,
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
    [subscribeFn],
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
