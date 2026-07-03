/* Firebase Cloud Messaging — Service Worker (notifications en arrière-plan) */
/* eslint-disable */

const SW_VERSION = "2026-07-03.push-click-open-client";
console.log("[FCM SW] boot version =", SW_VERSION);

const DRIVER_URL = "/driver?token=DSF234";
const FORBIDDEN_PATH_PREFIXES = ["/admin"];

// Important : ce listener doit être enregistré AVANT importScripts(Firebase).
// Le SDK Firebase ajoute son propre notificationclick et peut stopper les
// listeners suivants quand aucun fcm_options.link n'est présent.
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation?.();
  event.notification.close();

  const notifData = event.notification.data || {};
  const firebasePayload = firebasePayloadFromNotificationData(notifData);
  const mergedData = mergedDataFromPayload(firebasePayload, notifData);
  const url = sanitizeDeepLink(
    clickUrlFromPayload(firebasePayload, notifData, mergedData),
    mergedData.audience,
    mergedData.reservation_id,
  );

  console.log(
    "[FCM SW v" + SW_VERSION + "] notificationclick → url:",
    url,
    "| audience:",
    mergedData.audience,
    "| raw data.url:",
    notifData.url || mergedData.url,
  );

  event.waitUntil(
    (async () => {
      const target = new URL(url, self.location.origin);
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            if ("navigate" in client) {
              const navigated = await client.navigate(target.href).catch(() => null);
              if (navigated && "focus" in navigated) return navigated.focus();
            }
            if ("focus" in client) return client.focus();
          }
        } catch (_) {}
      }

      if (self.clients.openWindow) return self.clients.openWindow(target.href);
    })(),
  );
});

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB8wYcBq5-KVdPDAnXGcWzcCkTYmftTKdY",
  authDomain: "taxi-city-bordeaux.firebaseapp.com",
  projectId: "taxi-city-bordeaux",
  storageBucket: "taxi-city-bordeaux.firebasestorage.app",
  messagingSenderId: "702667833979",
  appId: "1:702667833979:web:653978ae325adfa06898de",
});

const messaging = firebase.messaging();
const recentlyHandled = new Map();

function claimOnce(key) {
  const now = Date.now();
  for (const [k, ts] of recentlyHandled) if (now - ts > 15000) recentlyHandled.delete(k);
  if (recentlyHandled.has(key)) return false;
  recentlyHandled.set(key, now);
  return true;
}

function dedupeKey(data, notif) {
  return [data.tag || notif.tag || "taxi-fcm", data.reservation_id || "", notif.title || data.title || ""].join("|");
}

function firebasePayloadFromNotificationData(notifData) {
  return notifData?.FCM_MSG || notifData?.fcmMessage || notifData?.firebaseMessagingPayload || null;
}

function mergedDataFromPayload(payload, notifData) {
  return Object.assign({}, payload?.webpush?.data || {}, payload?.data || {}, notifData || {});
}

function clickUrlFromPayload(payload, notifData, data) {
  return (
    notifData?.url ||
    notifData?.click_action ||
    data?.url ||
    data?.click_action ||
    payload?.webpush?.fcm_options?.link ||
    payload?.fcmOptions?.link ||
    payload?.notification?.click_action ||
    payload?.webpush?.notification?.click_action
  );
}

function sanitizeDeepLink(rawUrl, audience, reservationId) {
  let fallback = "/";
  if (audience === "chauffeur") fallback = DRIVER_URL;
  else if (reservationId) fallback = "/suivi/" + reservationId;

  let url;
  try {
    url = new URL(rawUrl || fallback, self.location.origin);
  } catch (_) {
    url = new URL(fallback, self.location.origin);
  }

  if (url.origin !== self.location.origin) url = new URL(fallback, self.location.origin);
  if (FORBIDDEN_PATH_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
    console.warn("[FCM SW] forbidden path blocked:", url.pathname, "→", fallback);
    url = new URL(fallback, self.location.origin);
  }
  if (audience === "chauffeur" || url.pathname === "/driver") {
    if (url.pathname !== "/driver") url.pathname = "/driver";
    if (!url.searchParams.get("token")) url.searchParams.set("token", "DSF234");
  }

  return url.pathname + url.search + url.hash;
}

function closeExistingNotifications(tag) {
  return self.registration.getNotifications({ tag }).then((existing) => existing.forEach((n) => n.close()));
}

self.addEventListener("install", () => {
  console.log("[FCM SW] install", SW_VERSION);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[FCM SW] activate", SW_VERSION);
  event.waitUntil(
    (async () => {
      try {
        const old = await self.registration.getNotifications();
        old.forEach((n) => n.close());
      } catch (_) {}
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "FCM_SW_VERSION") {
    event.ports?.[0]?.postMessage({ version: SW_VERSION });
  } else if (event.data.type === "FCM_SW_SKIP_WAITING") {
    self.skipWaiting();
  }
});

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Message background reçu :", JSON.stringify(payload));
  const data = Object.assign({}, payload.webpush?.data || {}, payload.data || {});
  const notif = payload.webpush?.notification || payload.notification || {};
  const title = notif.title || data.title || "🚖 Taxi City Bordeaux";
  const body = notif.body || data.body || "";

  console.log("[FCM SW] data:", JSON.stringify(data), "audience:", data.audience, "url:", data.url);

  if (payload.notification || payload.webpush?.notification) {
    claimOnce(dedupeKey(data, notif));
    console.log("[FCM SW] onBackgroundMessage: affichage laissé au SDK Firebase");
    return;
  }

  if (!claimOnce(dedupeKey(data, notif))) {
    console.log("[FCM SW] onBackgroundMessage: doublon détecté, skip");
    return;
  }

  const url = sanitizeDeepLink(data.url || data.click_action, data.audience, data.reservation_id);
  const tag = data.tag || "taxi-fcm";

  return closeExistingNotifications(tag).then(() =>
    self.registration.showNotification(title, {
      body,
      icon: notif.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag,
      data: { ...data, url, audience: data.audience, reservation_id: data.reservation_id, sw_version: SW_VERSION },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { notification: { title: event.data?.text() } };
    } catch (_2) {}
  }

  const hasNotifPayload = !!(payload.notification || payload.webpush?.notification);
  if (hasNotifPayload) return;

  const notif = {};
  const data = payload.data || {};
  const title = data.title || "🚖 Taxi City Bordeaux";
  const body = data.body || "";
  if (!title && !body) return;
  if (!claimOnce(dedupeKey(data, notif))) return;

  const url = sanitizeDeepLink(data.url || data.click_action, data.audience, data.reservation_id);
  const tag = data.tag || "taxi-fcm";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag,
      data: { ...data, url, audience: data.audience, reservation_id: data.reservation_id, sw_version: SW_VERSION },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    }),
  );
});
