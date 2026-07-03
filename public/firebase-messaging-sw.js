/* Firebase Cloud Messaging — Service Worker (notifications en arrière-plan) */
/* eslint-disable */

// ─────────────────────────────────────────────────────────────────────────────
// VERSIONING
// Bump SW_VERSION quand tu changes la logique de notif/click.
// Le navigateur considère le fichier modifié → install/activate immédiats
// grâce à skipWaiting()/clients.claim(). Pas besoin de purge manuelle.
// ─────────────────────────────────────────────────────────────────────────────
const SW_VERSION = "2026-07-03.ios-single-display";
console.log("[FCM SW] boot version =", SW_VERSION);

// Deep links autorisés. Toute URL qui pointe vers /admin/* est REFUSÉE
// (ancien comportement bugué : des notifs chauffeur ouvraient /admin/dashboard).
const DRIVER_URL = "/driver?token=DSF234";
const FORBIDDEN_PATH_PREFIXES = ["/admin"];

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

// ─── Verrou anti-double-affichage ───────────────────────────────────────────
// messaging.onBackgroundMessage (interne au SDK Firebase, qui s'abonne
// lui-même à l'event "push") ET notre propre self.addEventListener("push",…)
// réagissent TOUS LES DEUX au même push physique entrant — ce ne sont pas
// des chemins alternatifs, ce sont deux listeners sur le même événement.
// L'ancien garde-fou (getNotifications({tag}) avant showNotification) est
// asynchrone : les deux handlers peuvent lancer leur vérification avant que
// l'un des deux ait fini d'afficher sa notif → race condition → doublon.
// Ce verrou est vérifié de façon SYNCHRONE (avant tout await) donc il ferme
// la race : le premier handler à s'exécuter marque la clé, le second la
// trouve déjà posée et sort immédiatement.
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

// ─── Lifecycle : prise de contrôle immédiate ────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[FCM SW] install", SW_VERSION);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[FCM SW] activate", SW_VERSION);
  event.waitUntil(
    (async () => {
      // Purge des notifications encore affichées par l'ancienne version
      // (elles portent l'ancien data.url et ouvriraient /admin/dashboard).
      try {
        const old = await self.registration.getNotifications();
        old.forEach((n) => n.close());
      } catch (_) {}
      await self.clients.claim();
    })(),
  );
});

// Permet à la page de demander la version active (ou de forcer skipWaiting).
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "FCM_SW_VERSION") {
    event.ports?.[0]?.postMessage({ version: SW_VERSION });
  } else if (event.data.type === "FCM_SW_SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── Résolution d'URL sécurisée ─────────────────────────────────────────────
// - Refuse toute URL externe (autre origine)
// - Refuse les chemins interdits (/admin/*)
// - Pour /driver, garantit la présence du token (DSF234)
// - Fallback : DRIVER_URL pour audience=chauffeur, /suivi/<id> pour client
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

  // Bloque toute URL hors de notre origine
  if (url.origin !== self.location.origin) {
    url = new URL(fallback, self.location.origin);
  }

  // Bloque /admin/* — un payload qui essaie d'y rediriger est forcé sur le bon deep link
  if (FORBIDDEN_PATH_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
    console.warn("[FCM SW] forbidden path blocked:", url.pathname, "→", fallback);
    url = new URL(fallback, self.location.origin);
  }

  // Pour audience chauffeur ou route /driver, garantir le token
  if (audience === "chauffeur" || url.pathname === "/driver") {
    if (url.pathname !== "/driver") url.pathname = "/driver";
    if (!url.searchParams.get("token")) url.searchParams.set("token", "DSF234");
  }

  return url.pathname + url.search + url.hash;
}

// ─── Réception background (Android/desktop via FCM) ─────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Message background reçu :", JSON.stringify(payload));

  // Firebase SDK remonte webpush.data dans payload.data — on fusionne les deux
  // pour être sûr d'avoir audience, url, tag peu importe la source.
  const data = Object.assign({}, payload.webpush?.data || {}, payload.data || {});
  const notif = payload.webpush?.notification || payload.notification || {};
  const title = notif.title || data.title || "🚖 Taxi City Bordeaux";
  const body = notif.body || data.body || "";

  console.log("[FCM SW] data:", JSON.stringify(data), "audience:", data.audience, "url:", data.url);

  // Si le payload contient `notification`/`webpush.notification`, le SDK
  // Firebase affiche déjà la notification (obligatoire pour iOS Safari PWA).
  // Ne pas appeler showNotification ici, sinon iOS affiche 2 notifs.
  if (payload.notification || payload.webpush?.notification) {
    claimOnce(dedupeKey(data, notif));
    console.log("[FCM SW] onBackgroundMessage: affichage laissé au SDK Firebase");
    return;
  }

  // Verrou synchrone AVANT tout await — ferme la race avec le listener push natif.
  if (!claimOnce(dedupeKey(data, notif))) {
    console.log("[FCM SW] onBackgroundMessage: doublon détecté, skip");
    return;
  }

  const url = sanitizeDeepLink(data.url || data.click_action, data.audience, data.reservation_id);
  const tag = data.tag || "taxi-fcm";

  return self.registration.getNotifications({ tag }).then((existing) => {
    existing.forEach((n) => n.close());
    return self.registration.showNotification(title, {
      body,
      icon: notif.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag,
      data: { ...data, url, audience: data.audience, reservation_id: data.reservation_id, sw_version: SW_VERSION },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    });
  });
});

// ─── Fallback push natif ────────────────────────────────────────────────────
// Le SDK Firebase affiche AUTOMATIQUEMENT la notification dès que le payload
// contient un champ `notification` (racine) ou `webpush.notification`. Si on
// affiche AUSSI ici, on obtient un doublon systématique.
// → On ne prend le relais que pour les messages 100% "data-only" (sans
// aucun champ notification), cas où le SDK ne fait rien.
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
  if (hasNotifPayload) {
    // Le SDK Firebase s'en occupe. On ne fait RIEN pour éviter le doublon.
    return;
  }

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



// ─── Click sur notification ─────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const notifData = event.notification.data || {};
  const firebasePayload = firebasePayloadFromNotificationData(notifData);
  const mergedData = mergedDataFromPayload(firebasePayload, notifData);
  // Re-sanitize au moment du clic : même si une vieille notif a survécu en
  // background avec un mauvais data.url, on garantit ici qu'on n'ouvre JAMAIS
  // /admin/dashboard ni une URL externe.
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
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const target = new URL(url, self.location.origin);
      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          if (u.pathname === target.pathname && "focus" in client) {
            // Navigate pour rafraîchir l'URL complète (token, query, etc.)
            if ("navigate" in client) client.navigate(url).catch(() => {});
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
