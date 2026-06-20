/* Firebase Cloud Messaging — Service Worker (notifications en arrière-plan) */
/* eslint-disable */
// Version fixée à 10.13.2 (dernière stable compat) — à mettre à jour si Firebase déprécie
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

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Message background reçu :", payload);

  // push.server.ts envoie uniquement via webpush.notification (pas de champ "notification"
  // au niveau racine du message FCM) → le navigateur ne crée PAS de notif automatique.
  // On affiche donc toujours la notif ici.
  // Si un jour le payload contient une notification racine ET que le navigateur
  // l'affiche déjà, onBackgroundMessage n'est pas appelé → pas de doublon.

  const data = payload.data || payload.webpush?.data || {};
  const notif = payload.notification || payload.webpush?.notification || {};
  const title = notif.title || "🚖 Taxi City Bordeaux";
  const body = notif.body || "";

  const reservationId = data.reservation_id;
  const audience = data.audience;
  let defaultUrl = "/";
  if (audience === "chauffeur") {
    defaultUrl = "/driver?token=DSF234";
  } else if (reservationId) {
    defaultUrl = "/suivi/" + reservationId;
  }
  const url = data.url || data.click_action || defaultUrl;

  // Ferme les éventuelles notifs avec le même tag avant d'en créer une nouvelle
  // pour éviter l'empilement en cas de retry
  const tag = data.tag || "taxi-fcm";
  return self.registration.getNotifications({ tag }).then((existing) => {
    existing.forEach((n) => n.close());
    return self.registration.showNotification(title, {
      body,
      icon: notif.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag,
      data: { url, ...data },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    });
  });
});

self.addEventListener("notificationclick", (event) => {
  const notifData = event.notification.data || {};
  let clickDefault = "/";
  if (notifData.audience === "chauffeur") {
    clickDefault = "/driver?token=DSF234";
  } else if (notifData.reservation_id) {
    clickDefault = "/suivi/" + notifData.reservation_id;
  }
  const url = notifData.url || clickDefault;
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
