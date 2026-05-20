// src/hooks/usePushNotifications.ts

import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getVapidPublicKey, subscribePush, type PushAudience } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const getKey = useServerFn(getVapidPublicKey);
  const subscribeFn = useServerFn(subscribePush);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const perm = Notification.permission;
    if (perm === "denied") setStatus("denied");
    else if (perm === "granted") setStatus("granted");

    let mounted = true;
    const loadSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg || !mounted) return;
        const sub = await reg.pushManager.getSubscription();
        if (sub && mounted) setSubscription(sub);
      } catch (error) {
        console.error("Push init error:", error);
      }
    };

    loadSubscription();
    return () => {
      mounted = false;
    };
  }, []);

  const registerSW = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const existing = await navigator.serviceWorker.getRegistration();
      if (existing) return existing;
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      return reg;
    } catch (err) {
      console.error("SW registration failed:", err);
      return null;
    }
  }, []);

  const subscribe = useCallback(
    async (audience: PushAudience = "client", reservationId?: string): Promise<boolean> => {
      setStatus("loading");

      try {
        const keyResult = await getKey();
        if (!keyResult?.key) {
          console.warn("VAPID key unavailable — push disabled");
          setStatus("unsupported");
          return false;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("denied");
          return false;
        }

        const reg = await registerSW();
        if (!reg) {
          setStatus("unsupported");
          return false;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyResult.key) as unknown as ArrayBuffer,
        });

        const json = sub.toJSON();
        const keys = json.keys as { p256dh: string; auth: string };

        await subscribeFn({
          data: {
            audience,
            endpoint: sub.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            reservation_id: reservationId ?? null,
            user_agent: navigator.userAgent.slice(0, 500),
          },
        });

        setSubscription(sub);
        setStatus("granted");
        return true;
      } catch (err) {
        console.error("Push subscribe error:", err);
        setStatus("denied");
        return false;
      }
    },
    [getKey, registerSW, subscribeFn],
  );

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    await subscription.unsubscribe();
    setSubscription(null);
    setStatus("idle");
  }, [subscription]);

  const testNotification = useCallback(async () => {
    if (status !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const options = {
      body: "Les notifications sont bien activées !",
      icon: "/logo-taxi.png",
      vibrate: [200, 100, 200],
    } as any;
    reg.showNotification("🚕 Test — Taxi City Bordeaux", options);
  }, [status]);

  return { status, subscription, subscribe, unsubscribe, testNotification };
}
