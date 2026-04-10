/**
 * Canopy Trove — Service Worker (Workbox-free, lightweight)
 *
 * Cache strategies:
 * - Cache-First for immutable media assets (images, fonts)
 * - Network-First for JS/CSS bundles                         → prevents stale UI after deploys
 * - Network-First for API calls                              → fresh data with offline fallback
 * - Network-First for HTML shell                             → fresh app shell after deploys
 *
 * NOTE: This is a hand-rolled SW to avoid a Workbox build step.
 * It follows the same proven patterns Workbox uses internally.
 */

// Cache names with build-time hash injection
// During build, __BUILD_HASH__ is replaced with git short SHA or timestamp
// This invalidates all caches on deployment, ensuring fresh content
const CACHE_NAME = 'ct-__BUILD_HASH__';
const API_CACHE = 'ct-api-__BUILD_HASH__';

// Static assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html',
];

// ── Install: precache shell assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── Fetch: route requests to the right strategy ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions, analytics, etc.
  if (!url.protocol.startsWith('http')) return;

  // ── Strategy 1: Network-First for API (public, unauthenticated GET only) ──
  // __CT_API_HOSTNAME__ is replaced at build time by post-export.js
  if (url.hostname === '__CT_API_HOSTNAME__') {
    // Never cache authenticated API requests — they contain user-specific data
    // that must not leak across sessions, logouts, or account switches.
    if (request.headers.get('Authorization')) {
      return; // Let the browser handle it without SW interception
    }
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // ── Strategy 2: Network-First for navigation (HTML shell) ──
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CACHE_NAME, 4000, { cache: 'no-store' }));
    return;
  }

  // ── Strategy 3: Network-First for JS/CSS bundles ──
  if (isCodeAsset(url)) {
    event.respondWith(networkFirst(request, CACHE_NAME, 4000, { cache: 'no-store' }));
    return;
  }

  // ── Strategy 4: Cache-First for immutable media assets ──
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Everything else: network with no caching
  return;
});

// ── Cache-First: serve from cache, fall back to network ──
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Guard: if we requested a JS/CSS file but got HTML back, the asset is
      // missing and the server returned its SPA fallback. Do NOT cache it —
      // that would permanently break the app for this user.
      const ct = response.headers.get('content-type') || '';
      const url = new URL(request.url);
      const expectsCode = /\.(js|css)(\?.*)?$/.test(url.pathname);
      if (expectsCode && ct.includes('text/html')) {
        // Asset gone — force a full reload so the browser picks up fresh HTML
        // with the correct bundle hash.
        self.clients.matchAll().then((clients) => {
          clients.forEach((c) => c.navigate(c.url));
        });
        return response;
      }

      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached — return the styled offline page if available
    const offlineFallback = await caches.match('/offline.html');
    return offlineFallback || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// ── Network-First: try network, fall back to cache ──
async function networkFirst(request, cacheName, timeoutMs, fetchOptions) {
  try {
    const response = await promiseWithTimeout(fetch(request, fetchOptions), timeoutMs);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return (
      cached ||
      new Response('{"error":"offline"}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
}

// ── Push Notifications ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Canopy Trove',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'Canopy Trove';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'ct-notification',
    data: {
      url: payload.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Open the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url);
    }),
  );
});

// ── Helpers ──

function isStaticAsset(url) {
  return /\.(woff2?|ttf|otf|png|jpe?g|svg|webp|avif|ico|map)(\?.*)?$/.test(url.pathname);
}

function isCodeAsset(url) {
  return /\.(js|css)(\?.*)?$/.test(url.pathname);
}

function promiseWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
