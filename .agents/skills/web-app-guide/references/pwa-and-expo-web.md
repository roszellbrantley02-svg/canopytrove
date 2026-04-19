# PWA, Service Workers, and Expo Web Optimization

Research compiled April 2026 from Expo docs, Chrome DevRel, MDN, and Workbox documentation.

## PWA on iOS (2025-2026 Status)

### What Works

- Add to Home Screen (manual — no automatic install prompt)
- Service Worker and Cache API
- Web Push Notifications (since iOS 16.4, but only when installed to Home Screen)
- Declarative Web Push (Safari 18.4+)
- Screen Wake Lock (Safari 18.4+)
- iOS 26: Sites added to Home Screen default to opening as a web app

### What Doesn't Work

- Automatic install prompts (beforeinstallprompt) — Safari doesn't fire this event
- Background Sync — not available on iOS
- Badging API — limited support
- Push without Home Screen installation — notifications require "Add to Home Screen" first

### Push Notification Requirements on iOS

1. PWA must be installed to Home Screen
2. Permission prompt must be triggered by user gesture (tap a "Subscribe" button)
3. Service Worker must be registered
4. HTTPS required

## Service Worker Strategies

### Workbox (Recommended)

Workbox is the standard library for service workers, used by 54% of mobile sites. It provides
production-ready caching strategies with minimal configuration.

### Caching Strategy by Resource Type

| Resource                        | Strategy               | Reason                                            |
| ------------------------------- | ---------------------- | ------------------------------------------------- |
| Static assets (CSS, JS, images) | Cache-First            | Immutable once deployed, content-hashed filenames |
| API responses                   | Network-First          | Data freshness matters                            |
| Font files                      | Cache-First            | Rarely change                                     |
| HTML shell                      | Stale-While-Revalidate | Quick loads with background updates               |
| Dynamic content                 | Network-First          | Real-time accuracy required                       |
| Offline fallback                | Cache-Only             | Pre-cached offline page                           |

### Basic Workbox Setup for Expo Web

```javascript
// public/sw.js (or generate with workbox-build)
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache static assets (injected by build tool)
precacheAndRoute(self.__WB_MANIFEST);

// API calls: network-first with 3-second timeout
registerRoute(
  ({ url }) => url.hostname === 'api.canopytrove.com',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
  }),
);

// Images: cache-first with expiration
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  }),
);
```

### Registration in web/index.html

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

### Update Strategy

- Don't delay render while checking for SW updates
- Use `skipWaiting()` + `clients.claim()` for immediate activation
- Show a "New version available" toast with a refresh button
- Version your cache names for clean cache invalidation

## Expo Web Bundle Optimization

### Metro Bundler (Default for Expo Web)

Expo CLI uses Metro for all platforms including web. Key features:

- Platform shaking: Separate bundles per platform, removing platform-specific dead code
- Tree shaking: Experimental (`EXPO_UNSTABLE_TREE_SHAKING=1`), removes unused exports
- Minification: Terser for web (with optional ESBuild support)

### Tree Shaking

```bash
# Enable experimental tree shaking for production builds
EXPO_UNSTABLE_TREE_SHAKING=1 npx expo export --platform web
```

Caveats (as of late 2025):

- Very experimental — changes fundamental bundle structure
- Some libraries have compatibility issues (notably react-native-reanimated)
- Test thoroughly before enabling in production

### Bundle Analysis with Expo Atlas

```bash
# Enable Atlas for bundle visualization
EXPO_UNSTABLE_ATLAS=1 npx expo start
```

Atlas hooks into Metro to serialize the dependency tree, showing which modules consume the most
space. Use during development to identify optimization targets.

### React Compiler

Expo SDK 55+ supports the React Compiler (enabled by default in new projects). It automatically:

- Memoizes components and hooks
- Reduces unnecessary re-renders
- Eliminates manual `useMemo`, `useCallback`, `React.memo` in many cases

For existing projects, enable in babel.config.js:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['babel-plugin-react-compiler']],
  };
};
```

### Hermes v1 for Native

Hermes v1 delivers up to 60% better synthetic benchmark performance and 7-9% real-world
improvement. Native-level features (class fields, async functions, top-level await) eliminate
Babel transforms and polyfills, reducing bundle size.

Not applicable to web (web uses standard JS engines), but relevant for React Native bundle
optimization on iOS/Android.

## Canopy Trove PWA Checklist

| Item             | Status          | Notes                                      |
| ---------------- | --------------- | ------------------------------------------ |
| manifest.json    | Present         | Properly configured                        |
| HTTPS            | Present         | Firebase Hosting + Cloud Run               |
| Service Worker   | Missing         | No SW file or Workbox config               |
| Offline fallback | Missing         | No offline page                            |
| Install prompt   | N/A             | Safari doesn't support beforeinstallprompt |
| Web Push         | Not implemented | Possible via Firebase Cloud Messaging      |
| Cache strategy   | Missing         | No caching layer                           |
| App shell        | Present         | Splash screen + static HTML shell          |
| Theme color      | Present         | #121614 in HTML head                       |
| Icons            | Present         | apple-touch-icon, favicon                  |
| Tree shaking     | Not enabled     | Experimental, test before production       |
| Bundle analysis  | Not enabled     | Use Expo Atlas for development             |
| React Compiler   | Not enabled     | Consider for performance boost             |

### Recommended PWA Implementation Order

1. **Service Worker with offline fallback** — Catch network errors gracefully
2. **Cache-first for static assets** — Faster repeat loads (2-3x improvement)
3. **Network-first for API** — Show cached storefronts when offline
4. **Web Push setup** — Notify users about deals and favorites
5. **Install prompt UX** — Custom "Add to Home Screen" banner for iOS/Android

Sources: Expo Documentation, Chrome Developers (Workbox), MDN Service Workers, web.dev PWA guides,
Mobiloud PWA iOS Guide, React Conf 2025 Expo updates
