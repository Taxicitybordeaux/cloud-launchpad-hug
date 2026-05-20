// Service worker for web push notifications (Taxi City Bordeaux)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Taxi City Bordeaux', body: 'Nouvelle notification', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: payload.tag,
    renotify: !!payload.tag,
    data: { url: payload.url || '/' },
    requireInteraction: payload.requireInteraction === true,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const url = new URL(client.url);
          if (url.pathname === targetUrl || client.url.endsWith(targetUrl)) {
            return client.focus();
          }
        } catch (_) {}
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
