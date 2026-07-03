// Firebase Cloud Messaging — client integration
// Les credentials Web Firebase sont publics par design.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getInstallations, getToken as getInstallationToken } from "firebase/installations";
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

// FCM révoque les tokens après ~60 jours d'inactivité.
// On force un refresh silencieux tous les 50 jours pour garder le token vivant indéfiniment.
const TOKEN_MAX_AGE_MS = 50 * 24 * 60 * 60 * 1000; // 50 jours

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const SW_URL = "/firebase-messaging-sw.js";

function ensureFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getFirebaseMessagingSwRegistration(): Promise<ServiceWorkerRegistration> {
  const allRegs = await navigator.serviceWorker.getRegistrations();
  let swReg = allRegs.find(
    (r) =>
      r.active?.scriptURL.includes(SW_URL) ||
      r.installing?.scriptURL.includes(SW_URL) ||
      r.waiting?.scriptURL.includes(SW_URL),
  );

  if (!swReg) {
    swReg = await navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
  } else {
    await swReg.update().catch((err) => console.warn("[FCM] SW update check failed", err));
    if (swReg.waiting) swReg.waiting.postMessage({ type: "FCM_SW_SKIP_WAITING" });
  }

  try {
    const active = swReg.active;
    if (active) {
      const channel = new MessageChannel();
      channel.port1.onmessage = (ev) => console.log("[FCM] SW version active:", ev.data?.version);
      active.postMessage({ type: "FCM_SW_VERSION" }, [channel.port2]);
    }
  } catch (_) {}

  if (swReg.installing || swReg.waiting) {
    await new Promise<void>((resolve) => {
      const sw = swReg!.installing ?? swReg!.waiting!;
      const timeout = setTimeout(resolve, 10000);
      sw.addEventListener("statechange", function handler() {
        if (sw.state === "activated" || sw.state === "redundant") {
          clearTimeout(timeout);
          sw.removeEventListener("statechange", handler);
          resolve();
        }
      });
    });
  }

  if (!swReg.active) {
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration | null>((r) => setTimeout(() => r(null), 5000)),
    ]);
    if (readyReg?.active?.scriptURL.includes(SW_URL)) return readyReg;
    if (!readyReg) console.warn("[FCM] SW not ready after timeout, proceeding anyway");
  }

  return swReg;
}

function subscriptionUsesCurrentVapidKey(subscription: PushSubscription): boolean {
  const currentKey = base64UrlToUint8Array(FCM_VAPID_KEY);
  const existingKey = subscription.options?.applicationServerKey;
  if (!existingKey) return true;
  const existing = new Uint8Array(existingKey);
  if (existing.length !== currentKey.length) return false;
  return existing.every((value, index) => value === currentKey[index]);
}

async function getNativePushSubscription(swReg: ServiceWorkerRegistration, forceRefresh?: boolean): Promise<PushSubscription> {
  const pushManager = swReg.pushManager;
  if (!pushManager) throw new Error("missing-registration-push-manager");

  let subscription = await pushManager.getSubscription();
  if (subscription && (forceRefresh || !subscriptionUsesCurrentVapidKey(subscription))) {
    await subscription.unsubscribe().catch((err) => console.warn("[FCM] old native subscription unsubscribe skipped", err));
    subscription = null;
  }

  if (subscription) return subscription;

  return pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(FCM_VAPID_KEY),
  });
}

async function registerTokenWithFcm(subscription: PushSubscription): Promise<string> {
  const appInstance = ensureFirebaseApp();
  const installations = getInstallations(appInstance);
  const installationAuthToken = await getInstallationToken(installations);
  const auth = arrayBufferToBase64Url(subscription.getKey("auth"));
  const p256dh = arrayBufferToBase64Url(subscription.getKey("p256dh"));

  if (!auth || !p256dh || !subscription.endpoint) {
    throw new Error("invalid-native-push-subscription");
  }

  const response = await fetch(`https://fcmregistrations.googleapis.com/v1/projects/${firebaseConfig.projectId}/registrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-goog-api-key": firebaseConfig.apiKey,
      "x-goog-firebase-installations-auth": `FIS ${installationAuthToken}`,
    },
    body: JSON.stringify({
      web: {
        endpoint: subscription.endpoint,
        auth,
        p256dh,
        applicationPubKey: FCM_VAPID_KEY,
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `fcm-registration-${response.status}`);
  }
  if (!payload?.token) throw new Error("fcm-registration-no-token");
  return payload.token;
}

async function getFcmTokenViaNativePush(swReg: ServiceWorkerRegistration, forceRefresh?: boolean): Promise<string | null> {
  try {
    const subscription = await getNativePushSubscription(swReg, forceRefresh);
    const token = await registerTokenWithFcm(subscription);
    console.log("[FCM] Token obtenu via Push API native :", token.slice(-8));
    return token;
  } catch (err) {
    console.error("[FCM] native Push API fallback failed", err);
    return null;
  }
}

export function getPushSupportIssue(): string | null {
  if (typeof window === "undefined") return "server";
  if (!("Notification" in window)) return "no-notification-api";
  if (!("serviceWorker" in navigator)) return "no-service-worker";
  if (!("fetch" in window)) return "no-fetch";
  if (typeof ServiceWorkerRegistration !== "undefined" && !("showNotification" in ServiceWorkerRegistration.prototype)) {
    return "no-show-notification";
  }
  if (typeof PushSubscription !== "undefined" && !("getKey" in PushSubscription.prototype)) {
    return "no-push-subscription-keys";
  }
  return null;
}

function isIOSPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
  return isIOS && standalone;
}

export async function initFirebase(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    const supported = await isSupported();
    if (!supported) {
      if (!isIOSPwa()) {
        console.warn("[FCM] Not supported in this browser", getPushSupportIssue());
        return null;
      }
      console.warn("[FCM] SDK support check failed on iOS PWA — trying token flow anyway", getPushSupportIssue());
    }
    ensureFirebaseApp();
    if (!messaging) messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error("[FCM] init failed", err);
    return null;
  }
}

export async function getFcmToken(options: { forceRefresh?: boolean; requestPermission?: boolean } = {}): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  const currentPermission = Notification.permission;
  if (currentPermission === "denied") {
    console.warn("[FCM] Permission refusée :", currentPermission);
    return null;
  }

  if (currentPermission === "default") {
    if (options.requestPermission === false) {
      console.warn("[FCM] Permission non demandée dans ce contexte");
      return null;
    }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      console.warn("[FCM] Permission refusée :", perm);
      return null;
    }
  } else if (currentPermission !== "granted") {
    console.warn("[FCM] Permission inconnue :", currentPermission);
    return null;
  }

  try {
    // On cherche le SW Firebase par son scriptURL exact parmi tous les SW enregistrés.
    // getRegistration("/") retourne n'importe quel SW sur le scope "/" (ex: Vite HMR)
    // ce qui fait que FCM reçoit le mauvais SW → token OK sur desktop mais notifs silencieuses sur mobile.
    const swReg = await getFirebaseMessagingSwRegistration();

    // Retourner le token caché si valide et pas trop vieux (< 50 jours)
    const cachedToken = window.localStorage.getItem("fcm_token");
    const lastRefresh = parseInt(window.localStorage.getItem("fcm_token_last_refresh") ?? "0", 10);
    const tokenAge = Date.now() - lastRefresh;
    const tokenExpired = tokenAge > TOKEN_MAX_AGE_MS;

    if (!options.forceRefresh && cachedToken && !tokenExpired) {
      console.log("[FCM] Token en cache utilisé :", cachedToken.slice(-8), `(${Math.floor(tokenAge / 86400000)}j)`);
      return cachedToken;
    }

    const sdkSupported = await isSupported().catch(() => false);

    // iPad/iPhone PWA : certains WebKit exposent le PushManager uniquement sur
    // ServiceWorkerRegistration.pushManager, pas sur window.PushManager. Le SDK
    // Firebase déclare alors le navigateur “unsupported” et ne génère pas de
    // token, alors que la Push API native fonctionne. On enregistre donc nous-
    // mêmes la PushSubscription auprès de FCM dans ce cas.
    if (!sdkSupported && isIOSPwa()) {
      const token = await getFcmTokenViaNativePush(swReg, options.forceRefresh || tokenExpired);
      if (token) {
        window.localStorage.setItem("fcm_token", token);
        window.localStorage.setItem("fcm_token_last_refresh", String(Date.now()));
        return token;
      }
    }

    const msg = await initFirebase();
    if (!msg) return null;

    // Token absent, expiré (>50j) ou forceRefresh explicite → rotation silencieuse
    if (cachedToken) {
      await deleteToken(msg).catch((err) => console.warn("[FCM] old token delete skipped", err));
      window.localStorage.removeItem("fcm_token");
    }

    let token: string | null = null;
    try {
      token = await getToken(msg, {
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });
    } catch (sdkErr) {
      console.warn("[FCM] SDK getToken failed, trying native Push API fallback", sdkErr);
      token = await getFcmTokenViaNativePush(swReg, true);
    }

    if (token) {
      console.log("[FCM] Token obtenu :", token);
      window.localStorage.setItem("fcm_token", token);
      window.localStorage.setItem("fcm_token_last_refresh", String(Date.now()));
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
