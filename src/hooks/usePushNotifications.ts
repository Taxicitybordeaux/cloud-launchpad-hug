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

  // ─── FIX 1 : enregistrer le SW dès le montage ─────────────────────────────
  // L'ancien code appelait getRegistration() sans jamais avoir register() au préalable.
  // Sur Lovable/Vite, le SW n'est jamais actif au premier chargement → null → pas de push.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const perm = Notification.permission;
    if (perm === "denied") setStatus("denied");
    else if (perm === "granted") setStatus("granted");

    let mounted = true;

    const initSW = async () => {
      try {
        // Enregistre le SW s'il ne l'est pas encore
        let reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) {
          reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        }
        // Attendre activité complète (obligatoire sur certains navigateurs mobile)
        await navigator.serviceWorker.ready;
        if (!mounted) return;

        // Récupérer l'abonnement existant s'il y en a un
        const sub = await reg.pushManager.getSubscription();
        if (sub && mounted) {
          setSubscription(sub);
          if (Notification.permission === "granted") setStatus("granted");
        }
      } catch (error) {
        console.error("Push init error:", error);
      }
    };

    initSW();
    return () => {
      mounted = false;
    };
  }, []);

  // ─── FIX 2 : registerSW retourne le SW existant sans le recréer ───────────
  // L'ancien code avait une race condition : register() pouvait être appelé
  // alors qu'un SW activating était déjà en cours, ce qui lève une erreur silencieuse.
  const registerSW = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      // Utiliser getRegistration("/") avec le scope explicite
      let reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
      // navigator.serviceWorker.ready attend que le SW soit "activated"
      // (pas juste "installing" ou "waiting") — critique sur mobile
      const readyReg = await navigator.serviceWorker.ready;
      return readyReg;
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

        // ─── FIX 3 : vérifier si un abonnement existe déjà avant d'en créer un ──
        // Sans ce check, chaque appel à subscribe() crée un nouvel endpoint différent.
        // L'ancien endpoint en base devient invalide → 410 Gone → supprimé → plus de push.
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyResult.key) as unknown as ArrayBuffer,
          });
        }

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
    // FIX 4 : utiliser navigator.serviceWorker.ready plutôt que getRegistration()
    // pour être sûr d'avoir un SW actif (pas juste registered)
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return;
    reg.showNotification("🚕 Test — Taxi City Bordeaux", {
      body: "Les notifications sont bien activées !",
      icon: "/logo-taxi.png",
      vibrate: [200, 100, 200],
    } as any);
  }, [status]);

  return { status, subscription, subscribe, unsubscribe, testNotification };
}
