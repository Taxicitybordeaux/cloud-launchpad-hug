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

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Message background reçu :", payload);

  // Évite le doublon si le navigateur affiche déjà la notif automatiquement
  const title = (payload.notification && payload.notification.title) || "🚖 Taxi City Bordeaux";
  const body = (payload.notification && payload.notification.body) || "";
  const url = (payload.data && (payload.data.url || payload.data.click_action)) || "/admin/dashboard";

  return self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: (payload.data && payload.data.tag) || "taxi-fcm",
    data: { url, ...(payload.data || {}) },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
});

self.addEventListener("notificationclick", (event) => {
  const url = (event.notification.data && event.notification.data.url) || "/admin/dashboard";
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
