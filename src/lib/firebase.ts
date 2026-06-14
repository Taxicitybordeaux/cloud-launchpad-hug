// Firebase Cloud Messaging — client integration
// Les credentials Web Firebase sont publics par design.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

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
const FCM_TOKEN_VERSION = "taxi-city-bordeaux-auiagkpdpnfqxfngisfc-2026-06-14-v3";

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

export async function getFcmToken(options: { forceRefresh?: boolean } = {}): Promise<string | null> {
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
    } else {
      await swReg.update().catch((err) => console.warn("[FCM] SW update check failed", err));
    }

    // Attendre que le SW Firebase soit actif avant de demander le token
    // Timeout de 8s pour éviter de bloquer indéfiniment si gstatic.com est lent
    if (swReg.installing || swReg.waiting) {
      await new Promise<void>((resolve) => {
        const sw = swReg!.installing ?? swReg!.waiting!;
        const timeout = setTimeout(resolve, 8000); // résolution forcée si trop long
        sw.addEventListener("statechange", function handler() {
          if (sw.state === "activated" || sw.state === "redundant") {
            clearTimeout(timeout);
            sw.removeEventListener("statechange", handler);
            resolve();
          }
        });
      });
    }

    // Vérification finale : si le SW est toujours pas actif, on attend navigator.serviceWorker.ready
    if (!swReg.active) {
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 5000)),
      ]);
      if (!readyReg) {
        console.warn("[FCM] SW not ready after timeout, proceeding anyway");
      }
    }

    const mustRefreshToken =
      options.forceRefresh || window.localStorage.getItem("fcm_token_version") !== FCM_TOKEN_VERSION;
    if (mustRefreshToken) {
      await deleteToken(msg).catch((err) => console.warn("[FCM] old token delete skipped", err));
      window.localStorage.removeItem("fcm_token");
    }

    const token = await getToken(msg, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      console.log("[FCM] Token obtenu :", token);
      window.localStorage.setItem("fcm_token_version", FCM_TOKEN_VERSION);
      window.localStorage.setItem("fcm_token", token);
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
