/**
 * Canopy Trove — Service Worker (Workbox-free, lightweight)
 *
 * Cache strategies:
 * - Cache-First for static assets (JS, CSS, images, fonts)  → 2-3x faster repeat loads
 * - Network-First for API calls                              → fresh data with offline fallback
 * - Stale-While-Revalidate for HTML shell                    → instant loads + background updates
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
const PRECACHE_URLS = ['/', '/manifest.json', '/favicon.ico', '/icon-192.png', '/icon-512.png'];

// ── Install: precache shell assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
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
  if (url.hostname === 'api.canopytrove.com') {
    // Never cache authenticated API requests — they contain user-specific data
    // that must not leak across sessions, logouts, or account switches.
    if (request.headers.get('Authorization')) {
      return; // Let the browser handle it without SW interception
    }
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // ── Strategy 2: Stale-While-Revalidate for navigation (HTML shell) ──
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  // ── Strategy 3: Cache-First for static assets ──
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
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached — return a basic offline response
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// ── Network-First: try network, fall back to cache ──
async function networkFirst(request, cacheName, timeoutMs) {
  try {
    const response = await promiseWithTimeout(fetch(request), timeoutMs);
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

// ── Stale-While-Revalidate: serve cache immediately, refresh in background ──
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fire off a background update regardless
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached version immediately if available; otherwise wait for network
  return cached || (await networkPromise) || new Response('Offline', { status: 503 });
}

// ── Helpers ──

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|ico|map)(\?.*)?$/.test(url.pathname);
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
