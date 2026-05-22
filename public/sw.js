/**
 * sw.js — Service Worker pour les Web Push Notifications (Taxi City Bordeaux)
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push event ─────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Taxi City Bordeaux", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Taxi City Bordeaux";

  // FIX : le serveur envoie le payload à plat (title, body, url, tag…).
  // L'ancien code cherchait payload.data.url mais payload.data n'existe pas
  // → url était toujours "/" → en cliquant sur la notif on retombait sur l'accueil.
  // On lit url directement sur payload, avec payload.data.url en fallback
  // pour rester compatible si le format change côté serveur.
  const url = payload.url || (payload.data && payload.data.url) || "/";
  const notifData = {
    url,
    action_type: payload.action_type || (payload.data && payload.data.action_type) || null,
    accept_url: payload.accept_url || (payload.data && payload.data.accept_url) || null,
    refuse_url: payload.refuse_url || (payload.data && payload.data.refuse_url) || null,
  };

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "taxi-notif",
    renotify: !!payload.tag,
    vibrate: [200, 100, 200],
    data: notifData,
    requireInteraction: payload.requireInteraction === true,
  };

  // Boutons d'action pour le chauffeur (nouvelle course)
  if (notifData.action_type === "new_reservation") {
    options.actions = [
      { action: "accept", title: "✅ Accepter" },
      { action: "refuse", title: "❌ Refuser" },
    ];
    options.requireInteraction = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  notification.close();

  let targetUrl = data.url || "/";
  if (action === "accept" && data.accept_url) targetUrl = data.accept_url;
  else if (action === "refuse" && data.refuse_url) targetUrl = data.refuse_url;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname === target.pathname && "focus" in client) {
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});

// ─── Push subscription change ────────────────────────────────────────────────
// FIX : sur iOS/Chrome mobile, quand le navigateur révoque ou renouvelle
// l'abonnement push, il faut re-souscrire côté serveur.
// L'ancien code envoyait juste un message postMessage sans rien faire.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Tenter de se ré-abonner automatiquement avec les mêmes options
        const sub = await self.registration.pushManager.subscribe(
          event.oldSubscription
            ? { userVisibleOnly: true, applicationServerKey: event.oldSubscription.options.applicationServerKey }
            : { userVisibleOnly: true },
        );
        // Notifier les clients ouverts pour qu'ils enregistrent le nouvel endpoint
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) =>
          client.postMessage({
            type: "PUSH_SUBSCRIPTION_CHANGED",
            endpoint: sub.endpoint,
            p256dh: sub.toJSON().keys?.p256dh,
            auth: sub.toJSON().keys?.auth,
          }),
        );
      } catch (err) {
        // Si on ne peut pas re-souscrire, notifier quand même pour que l'UI
        // propose de réactiver les notifications
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) => client.postMessage({ type: "PUSH_SUBSCRIPTION_LOST" }));
      }
    })(),
  );
});
