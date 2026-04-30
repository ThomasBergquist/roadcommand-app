// RoadCommand Service Worker
// Handles push notifications and app shell caching

const CACHE_NAME = 'rc-v1';
const APP_SHELL = ['/style.css', '/app.js', '/auth.js', '/manifest.json'];

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

// ── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch — network first, cache fallback for app shell ───────────────────
self.addEventListener('fetch', event => {
  // Only cache GET requests for same origin
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

  const title   = data.title   || 'RoadCommand — New Load';
  const options = {
    body:    data.body    || 'A load matching your parameters is available.',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-96.png',
    tag:     data.tag     || 'rc-load-alert',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url:     data.url     || '/',
      loadId:  data.loadId  || null,
      rate:    data.rate    || null,
      route:   data.route   || null,
      rpm:     data.rpm     || null,
    },
    actions: [
      { action: 'view',   title: '👀 View Load' },
      { action: 'dismiss', title: '✕ Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // If app is already open, focus it
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'LOAD_ALERT_CLICKED',
              data: event.notification.data,
            });
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Message from app ──────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
