/* RoadCommand — sw.js v4 */
const CACHE_NAME = 'roadcommand-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/auth.js',
  '/style.css',
  '/manifest.json',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('eia.gov') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net')
  ) return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => {
      return cached || caches.match('/index.html');
    }))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
