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
export const FCM_VAPID_KEY = "BPCVh_FRLBkhOWLLxdaKnD29L6HRNS44w4wHX_AE2DV0a0-Uc6OoofT8SldZ-V4_yMWInXt4xqbvkhGiFW-_N20";

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
    if (perm !== "granted") {
      console.warn("[FCM] Permission refusée :", perm);
      return null;
    }

    // On cherche le SW Firebase par son scriptURL exact parmi tous les SW enregistrés.
    // getRegistration("/") retourne n'importe quel SW sur le scope "/" (ex: Vite HMR)
    // ce qui fait que FCM reçoit le mauvais SW → token OK sur desktop mais notifs silencieuses sur mobile.
    const SW_URL = "/firebase-messaging-sw.js";
    const allRegs = await navigator.serviceWorker.getRegistrations();
    let swReg = allRegs.find(
      (r) =>
        r.active?.scriptURL.includes(SW_URL) ||
        r.installing?.scriptURL.includes(SW_URL) ||
        r.waiting?.scriptURL.includes(SW_URL),
    );
    if (!swReg) {
      swReg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    }

    // Attendre que le SW Firebase soit actif avant de demander le token
    if (swReg.installing || swReg.waiting) {
      await new Promise<void>((resolve) => {
        const sw = swReg!.installing ?? swReg!.waiting!;
        sw.addEventListener("statechange", function handler() {
          if (sw.state === "activated") {
            sw.removeEventListener("statechange", handler);
            resolve();
          }
        });
      });
    }

    const token = await getToken(msg, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      console.log("[FCM] Token obtenu :", token);
    } else {
      console.warn("[FCM] Token vide — vérifier VAPID key et SW");
    }

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
      console.log("[FCM] Message foreground reçu :", payload);
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

/**
 * Affiche une notification native quand l'app est en foreground.
 * À appeler dans ton composant racine (App.tsx ou _app.tsx) :
 *
 *   useEffect(() => {
 *     return setupForegroundNotifications();
 *   }, []);
 */
export function setupForegroundNotifications(): () => void {
  return onForegroundMessage((payload) => {
    const title = payload.notification?.title ?? "Taxi City Bordeaux";
    const options = {
      body: payload.notification?.body ?? "",
      icon: payload.notification?.icon ?? "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.data?.tag ?? "taxi-fcm",
      data: payload.data ?? {},
      vibrate: [200, 100, 200],
      requireInteraction: true,
    } as NotificationOptions;

    // Afficher via le Service Worker pour garantir l'affichage même en foreground
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, options);
    });
  });
}
