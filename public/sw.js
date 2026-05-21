/**
 * sw.js — Service Worker pour les Web Push Notifications (Taxi City Bordeaux)
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Push event ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Taxi City Bordeaux', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Taxi City Bordeaux';
  const data = { ...(payload.data || {}), url: payload.url || '/' };

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: payload.tag || 'taxi-notif',
    renotify: !!payload.tag,
    vibrate: [200, 100, 200],
    data,
    requireInteraction: payload.requireInteraction === true,
  };

  // Boutons d'action pour le chauffeur (nouvelle course)
  if (data.action_type === 'new_reservation') {
    options.actions = [
      { action: 'accept', title: '✅ Accepter' },
      { action: 'refuse', title: '❌ Refuser' },
    ];
    options.requireInteraction = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  notification.close();

  let targetUrl = data.url || '/';
  if (action === 'accept' && data.accept_url) targetUrl = data.accept_url;
  else if (action === 'refuse' && data.refuse_url) targetUrl = data.refuse_url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname === target.pathname && 'focus' in client) {
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});

// ─── Push subscription change ───────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    }),
  );
});
