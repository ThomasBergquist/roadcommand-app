// RoadCommand Service Worker
// Handles push notifications and app shell caching

const CACHE_NAME = 'rc-v5';
const APP_SHELL = ['/style.css', '/app.js', '/auth.js', '/manifest.json'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push Notification ─────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'RoadCommand', body: event.data ? event.data.text() : 'New load alert' };
  }

  const title   = data.title || 'RoadCommand — New Load';
  const options = {
    body:    data.body || 'A load matching your parameters is available.',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-96.png',
    tag:     data.tag || 'rc-load-alert',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url:        data.url    || '/',
      loadId:     data.loadId || null,
      rate:       data.rate   || null,
      route:      data.route  || null,
      notifyType: data.url && data.url.includes('loadback') ? 'loadback' : 'load',
    },
    actions: [
      { action: 'view',    title: 'View Load' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // If app is already open, focus and send message
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'LOAD_ALERT_CLICKED',
              data: notifData,
            });
            return;
          }
        }
        // App not open — open it with URL params so it knows what to show
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
