/* Firebase Cloud Messaging Service Worker — أكاديمية البوب للفنون القتالية */
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCFm6T3DA1t3XqeIoYy-06xiQr0OCTtIqg',
  authDomain: 'massive-xylopolist-q53bd.firebaseapp.com',
  projectId: 'massive-xylopolist-q53bd',
  storageBucket: 'massive-xylopolist-q53bd.firebasestorage.app',
  messagingSenderId: '1032812690813',
  appId: '1:1032812690813:web:e7b2a9cff8a4bd72a0a014',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    (payload && payload.notification && payload.notification.title) ||
    (payload && payload.data && payload.data.title) ||
    'أكاديمية البوب للفنون القتالية';
  const body =
    (payload && payload.notification && payload.notification.body) ||
    (payload && payload.data && payload.data.body) ||
    'لديك إشعار جديد من كابتن باهر مراد';

  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [180, 80, 180],
    tag: (payload && payload.data && payload.data.tag) || 'alboob-academy-notif',
    renotify: true,
    data: (payload && payload.data) || { url: '/' },
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
