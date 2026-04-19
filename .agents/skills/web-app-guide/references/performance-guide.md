# Performance Guide — Core Web Vitals and Optimization

## Core Web Vitals

Google's three UX metrics that affect both user experience and search ranking.

### LCP — Largest Contentful Paint

Measures how fast the main content loads. Target: under 2.5 seconds.

**Common causes of slow LCP:**

- Large unoptimized images
- Render-blocking JavaScript
- Slow server response (TTFB)
- Client-side rendering without SSR/SSG

**Fixes:**

- Preload the LCP image (`<link rel="preload" as="image">`)
- Do NOT lazy-load the hero/LCP image — this delays it further
- Optimize image format (WebP/AVIF) and dimensions
- Use CDN for static assets
- Minimize render-blocking resources

### INP — Interaction to Next Paint

Measures responsiveness — how fast the app reacts to user input. Target: under 200ms.

**Common causes of poor INP:**

- Heavy JavaScript execution blocking the main thread
- Too many animations running on the JS thread
- Large re-renders triggered by state changes
- Expensive synchronous operations in event handlers

**Fixes:**

- Move heavy computation off the main thread (Web Workers)
- Use `useNativeDriver: true` for animations on native
- Skip JS-driven animations on web entirely (Canopy Trove's MotionInView pattern)
- Debounce expensive handlers
- Use `React.memo`, `useMemo`, `useCallback` to prevent unnecessary re-renders
- Break long tasks with `requestIdleCallback` or `scheduler.yield()`

### CLS — Cumulative Layout Shift

Measures visual stability — how much the layout moves during load. Target: under 0.1.

**Common causes of CLS:**

- Images without explicit dimensions
- Fonts loading and causing text reflow (FOIT/FOUT)
- Dynamic content injected above existing content
- Ads or embeds without reserved space

**Fixes:**

- Always set explicit width/height or aspect-ratio on images
- Use `font-display: swap` with size-adjusted fallback fonts
- Reserve space for dynamic content with skeleton screens
- Avoid inserting content above the fold after initial render

## React Native Web Performance

### Animation on Web

The #1 performance killer in React Native Web apps is JS-driven animation.

`Animated.timing` with `useNativeDriver: false` runs every frame through JavaScript via
`requestAnimationFrame`. On a screen with many animated components, this overwhelms the
JS thread and causes visible jitter.

**The pattern Canopy Trove uses:**

```typescript
const isWeb = Platform.OS === 'web';

if (isWeb) {
  // Render children in a plain View, no animation
  return <View style={style}>{children}</View>;
}

// Native: full animation with useNativeDriver: true
```

This was the fix for 374 MotionInView instances causing severe jitter on Android web browsers.

### FlatList Optimization

For lists with many items:

```typescript
<FlatList
  initialNumToRender={6}      // render 6 items initially
  maxToRenderPerBatch={4}      // render 4 items per scroll batch
  windowSize={3}               // keep 3 viewports of items in memory
  removeClippedSubviews        // unmount items outside viewport (Android)
  getItemLayout={...}          // skip measurement if items are fixed height
/>
```

### Render Performance

- Use Set-based lookups (`Set.has()` is O(1)) instead of `Array.includes()` (O(n)) in render paths
- Memoize derived data with `useMemo`
- Stabilize callback references with `useCallback`
- Use `React.memo` for pure components that receive complex props

### Tab Navigation

- Enable `lazy: true` on tab navigators to prevent mounting all tabs on first load
- Simplify tab transitions — opacity-only crossfade (200ms) is smoother than multi-transform
- Reduce transition duration for web (browsers handle CSS transitions differently)

## Image Optimization

### Responsive Images

```html
<img
  src="image-800.webp"
  srcset="image-400.webp 400w, image-800.webp 800w, image-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, 800px"
  width="800"
  height="600"
  loading="lazy"
  alt="Description"
/>
```

**Rules:**

- Always include explicit width and height (prevents CLS)
- Use `loading="lazy"` for below-the-fold images
- Never lazy-load the LCP/hero image
- Use modern formats: WebP for broad support, AVIF for cutting-edge
- Serve multiple sizes via srcset
- Use `expo-image` with caching on React Native (faster than `react-native Image`)

### Image Caching Strategy

- Cache static assets aggressively (long Cache-Control max-age)
- Use content-hashed filenames for cache busting
- CDN for image delivery
- `expo-image` handles memory and disk caching automatically on native

## Bundle Size

- Code-split by route (dynamic imports)
- Tree-shake unused exports
- Analyze bundle with `source-map-explorer` or `webpack-bundle-analyzer`
- Avoid importing entire libraries when you only need one function
- Move heavy dependencies to CDN or lazy-load them

## Web-Specific Browser Concerns

### User Gesture Chain

Browsers require certain actions (file picker, clipboard, notifications) to happen within a
synchronous user gesture handler. If you `await` something between the user's tap and the action,
the browser will silently block it.

**Broken pattern:**

```typescript
onPress={async () => {
  await checkPermission();    // async — breaks gesture chain
  openFilePicker();           // blocked by browser
}}
```

**Fixed pattern:**

```typescript
onPress={async () => {
  if (Platform.OS !== 'web') {
    await checkPermission();  // only on native
  }
  openFilePicker();           // immediate on web
}}
```

This is exactly what broke the photo picker on Canopy Trove's web app and was fixed by
skipping the permission check on web.

### Service Workers and Caching

For PWA offline support:

- Cache-first for static assets (CSS, JS, images)
- Network-first for API responses
- Stale-while-revalidate for semi-dynamic content
- Always serve a fallback offline page
- Version your service worker cache names for clean updates

## Monitoring

- Core Web Vitals in Google Search Console (field data)
- Lighthouse CI in build pipeline (lab data)
- Sentry for runtime errors and performance traces
- Cloud Logging for backend performance
- Real User Monitoring (RUM) for actual user experience data
