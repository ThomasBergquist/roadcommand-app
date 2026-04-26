/* ═══════════════════════════════════════════════════════════════
   RoadCommand — sw.js (Service Worker)
   Cache strategy: Network first, cache fallback
   Version bump this string to force cache refresh on all clients
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'roadcommand-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/auth.js',
  '/style.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Force this SW to activate immediately without waiting
  self.skipWaiting();
});

// Activate — delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests and external APIs
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  // Always fetch live for API calls (EIA, Nominatim, Supabase)
  if (
    url.hostname.includes('eia.gov') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    return; // Let browser handle these normally
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Ultimate fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Message — force update when app sends 'SKIP_WAITING'
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
