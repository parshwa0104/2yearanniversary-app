// Service Worker v2 - Clean build, no calling features
const CACHE_VERSION = 'v2';

self.addEventListener('install', function(event) {
  // Force the new service worker to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/app-icon.jpg',
      badge: '/app-icon.jpg',
      vibrate: [200, 100, 200],
      tag: data.tag || 'anni-notification',
      renotify: true,
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
