/* Firebase Cloud Messaging — Service Worker (notifications en arrière-plan) */
/* eslint-disable */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB8wYcBq5-KVdPDAnXGcWzcCkTYmftTKdY",
  authDomain: "taxi-city-bordeaux.firebaseapp.com",
  projectId: "taxi-city-bordeaux",
  storageBucket: "taxi-city-bordeaux.firebasestorage.app",
  messagingSenderId: "702667833979",
  appId: "1:702667833979:web:653978ae325adfa06898de",
});

const messaging = firebase.messaging();

// CORRECTIF : Firebase envoie parfois des messages "notification-only" (sans champ data)
// qui sont gérés automatiquement par le navigateur — onBackgroundMessage ne se déclenche
// pas dans ce cas. Pour forcer le contrôle total, on intercepte tous les push events.
self.addEventListener("push", (event) => {
  // Si Firebase gère déjà le message (via onBackgroundMessage ci-dessous), on ne fait rien.
  // Ce listener sert de filet de sécurité pour les payloads non interceptés.
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return;
  }

  // Si le payload contient notification.title directement (format FCM legacy/v1 direct)
  // et qu'il n'est pas déjà pris en charge par onBackgroundMessage.
  const notification = payload.notification || {};
  const data = payload.data || {};

  if (!notification.title && !data.title) return; // rien à afficher

  const title = notification.title || data.title || "Taxi City Bordeaux";
  const options = {
    body: notification.body || data.body || "",
    icon: notification.icon || data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "taxi-fcm",
    data: { url: data.url || data.click_action || "/", ...data },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Gestion des messages background via Firebase SDK (format FCM standard)
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Message background reçu :", payload);

  const title = (payload.notification && payload.notification.title) || "Taxi City Bordeaux";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: (payload.notification && payload.notification.icon) || "/favicon.ico",
    badge: "/favicon.ico",
    tag: (payload.data && payload.data.tag) || "taxi-fcm",
    data: {
      url: (payload.data && (payload.data.url || payload.data.click_action)) || "/",
      ...(payload.data || {}),
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  self.registration.showNotification(title, options);
  // Pas de return ici — Firebase SDK gère le waitUntil en interne
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const url = data.url || data.click_action || "/";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          const target = new URL(url, self.location.origin);
          if (u.pathname === target.pathname && "focus" in client) return client.focus();
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
