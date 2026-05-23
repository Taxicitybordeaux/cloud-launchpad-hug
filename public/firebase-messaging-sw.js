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
  const title = (payload.notification && payload.notification.title) || "Taxi City Bordeaux";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: (payload.notification && payload.notification.icon) || "/favicon.ico",
    badge: "/favicon.ico",
    tag: (payload.data && payload.data.tag) || "taxi-fcm",
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };
  self.registration.showNotification(title, options);
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
    })
  );
});
