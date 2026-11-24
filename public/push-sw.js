/* Dedicated W3C Web Push Service Worker for Al-Boob Martial Arts Academy */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'أكاديمية البوب للفنون القتالية',
    body: 'لديك إشعار جديد من الأكاديمية',
    url: '/',
    tag: 'alboob-push',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          title: typeof parsed.title === 'string' && parsed.title ? parsed.title : payload.title,
          body: typeof parsed.body === 'string' && parsed.body ? parsed.body : payload.body,
          url: typeof parsed.url === 'string' && parsed.url ? parsed.url : payload.url,
          tag: typeof parsed.tag === 'string' && parsed.tag ? parsed.tag : payload.tag,
        };
      }
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : '';
      if (text) payload.body = text;
    } catch {
      // keep fallback payload
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 80, 200],
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
