// src/hooks/usePushNotifications.ts

// Hook pour gérer l'abonnement aux notifications push Web

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ⚠️ Remplacer par votre clé publique VAPID générée via :
// npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

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
    return () => { mounted = false; };
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

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn("VAPID_PUBLIC_KEY manquante — push désactivé");
      return false;
    }
    setStatus("loading");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      const reg = await registerSW();
      if (!reg) { setStatus("unsupported"); return false; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });

      setSubscription(sub);
      setStatus("granted");

      const sid = sessionStorage.getItem("sid");
      const json = sub.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };

      const pushRecord = {
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        session_id: sid,
      } as any;

      await supabase.from("push_subscriptions").upsert(pushRecord, { onConflict: "endpoint" });

      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      setStatus("denied");
      return false;
    }
  }, [registerSW]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    await subscription.unsubscribe();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", subscription.endpoint);
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
