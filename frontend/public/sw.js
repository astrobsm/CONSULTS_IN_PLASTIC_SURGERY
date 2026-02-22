/**
 * PS Consult – UNTH: Service Worker
 *
 * Fully offline-first PWA service worker:
 * - Precaches app shell (HTML, manifest, icons)
 * - Cache-first for static assets (JS, CSS, images)
 * - Stale-while-revalidate for hashed build assets
 * - Network-first for API GET requests with cache fallback
 * - SPA navigation fallback to cached index.html
 * - Background sync messaging to client
 */
const CACHE_VERSION = 'v4';
const STATIC_CACHE = `ps-consult-static-${CACHE_VERSION}`;
const API_CACHE = `ps-consult-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `ps-consult-images-${CACHE_VERSION}`;

// App shell to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/unth-favicon.png',
  '/unth-icon-192.png',
  '/unth-logo.png',
];

// ── INSTALL ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── ACTIVATE ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const allowedCaches = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !allowedCaches.includes(k)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Non-GET → pass through (offline POST handled by app via IndexedDB)
  if (request.method !== 'GET') return;

  // API GET → network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Images → cache-first
  if (/\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Hashed build assets (JS/CSS) → stale-while-revalidate
  if (/\.(js|css|woff2?|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Navigation → network-first (always get fresh index.html with correct asset hashes)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cache = caches.open(STATIC_CACHE).then((c) => { c.put('/index.html', response.clone()); });
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default → cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Strategies ──────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ detail: 'You are offline. Showing cached data.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// ── Background Sync ─────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-consults') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_CONSULTS' });
  }
}

// ── Push Notifications (future) ─────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'PS Consult – UNTH', {
      body: data.body || 'You have a new notification',
      icon: '/unth-icon-192.png',
      badge: '/unth-favicon.png',
      tag: data.tag || 'ps-consult',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
