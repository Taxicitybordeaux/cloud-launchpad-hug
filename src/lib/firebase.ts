// Firebase Cloud Messaging — client integration
// Les credentials Web Firebase sont publics par design.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyB8wYcBq5-KVdPDAnXGcWzcCkTYmftTKdY",
  authDomain: "taxi-city-bordeaux.firebaseapp.com",
  projectId: "taxi-city-bordeaux",
  storageBucket: "taxi-city-bordeaux.firebasestorage.app",
  messagingSenderId: "702667833979",
  appId: "1:702667833979:web:653978ae325adfa06898de",
};

// Clé VAPID *Web Push* de Firebase (Console → Cloud Messaging → Web configuration)
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

export async function getFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  const msg = await initFirebase();
  if (!msg) return null;

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    const swReg =
      (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ||
      (await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }));
    await navigator.serviceWorker.ready;

    const token = await getToken(msg, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch (err) {
    console.error("[FCM] getFcmToken failed", err);
    return null;
  }
}

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
