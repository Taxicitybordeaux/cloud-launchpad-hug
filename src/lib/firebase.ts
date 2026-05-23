// Firebase Cloud Messaging client integration
// Credentials Web Firebase sont publics par design — OK en clair côté client.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

export const firebaseConfig = {
  apiKey: "AIzaSyB8wYcBq5-KVdPDAnXGcWzcCkTYmftTKdY",
  authDomain: "taxi-city-bordeaux.firebaseapp.com",
  projectId: "taxi-city-bordeaux",
  storageBucket: "taxi-city-bordeaux.firebasestorage.app",
  messagingSenderId: "702667833979",
  appId: "1:702667833979:web:653978ae325adfa06898de",
};

export const FCM_VAPID_KEY =
  "BPCVh_FRLBkhOWLLxdaKnD29L6HRNS44w4wHX_AE2DV0a0-Uc6OoofT8SldZ-V4_yMWInXt4xqbvkhGiFW-_N20";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export async function initFirebase(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCM] Not supported in this browser");
      return null;
    }
    if (!app) app = initializeApp(firebaseConfig);
    if (!messaging) messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error("[FCM] init failed", err);
    return null;
  }
}

/**
 * Demande la permission, récupère le token FCM, et enregistre dans push_subscriptions.
 * Idempotent : on upsert sur (endpoint = token) pour éviter les doublons.
 */
export async function requestAndSaveFCMToken(audience: "admin" | "chauffeur" | "client" = "client"): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;

  const msg = await initFirebase();
  if (!msg) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Permission denied");
      return null;
    }

    // Le SW Firebase doit être enregistré
    let swReg: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      try {
        swReg =
          (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ||
          (await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
      } catch (err) {
        console.warn("[FCM] SW registration failed", err);
      }
    }

    const token = await getToken(msg, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      console.warn("[FCM] No token returned");
      return null;
    }

    // Sauvegarder le token dans push_subscriptions
    // On utilise l'endpoint = token FCM pour rester unique
    const fakeP256dh = "fcm";
    const fakeAuth = "fcm";
    try {
      await supabase.from("push_subscriptions").insert({
        audience,
        endpoint: `fcm://${token}`,
        p256dh: fakeP256dh,
        auth: fakeAuth,
        fcm_token: token,
        user_agent: navigator.userAgent.slice(0, 500),
      });
    } catch (err) {
      // Ignore les conflits d'unicité — l'utilisateur a juste déjà ce token enregistré
      console.warn("[FCM] save token (probable duplicate):", err);
    }

    return token;
  } catch (err) {
    console.error("[FCM] requestAndSaveFCMToken failed", err);
    return null;
  }
}

/**
 * Écoute les messages reçus en premier plan (app ouverte).
 * Les messages en arrière-plan sont gérés par firebase-messaging-sw.js
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  let unsub: (() => void) | null = null;
  initFirebase().then((msg) => {
    if (!msg) return;
    unsub = onMessage(msg, (payload) => {
      try {
        callback(payload);
      } catch (err) {
        console.error("[FCM] onForegroundMessage callback error", err);
      }
    });
  });
  return () => {
    if (unsub) unsub();
  };
}
