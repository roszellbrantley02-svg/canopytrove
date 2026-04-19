# Frontend Production Readiness for Canopy Trove

Research-backed best practices (2025-2026) for React Native/Expo.

## 1. Bundle Optimization

- **Hermes V1** (RN 0.84+): default engine, 7-9% real-world perf gain, AOT bytecode
- Hermes bytecode diffing in EAS Update: 75% smaller OTA diffs
- `inlineRequires: true` in metro.config.js (critical for Hermes)
- Do NOT use RAM bundles with Hermes (incompatible)
- `@react-native/babel-plugin-transform-remove-console` in production
- Lazy loading: `const Screen = lazy(() => import('./screens/Heavy'))` + Suspense
- Target: <3MB production bundle (after bytecode)

## 2. Image Optimization (expo-image)

- expo-image: cross-platform, BlurHash/ThumbHash placeholders, priority loading
- Cache hierarchy: `memory-disk` (hero images) → `disk` (default) → `memory` (temp) → `none`
- `recyclingKey={item.id}` CRITICAL in FlatList to prevent memory leaks
- `priority="high"` for viewport images, `"low"` for offscreen
- `Image.prefetch(heroUri)` during splash phase
- WebP format: 25-35% smaller than JPEG, both platforms supported
- CDN dynamic resizing: `?w=${width}&quality=80&fmt=webp`

## 3. Offline Support

- NetInfo + Zustand store for online/offline state management
- Firestore offline persistence NOT fully supported in RN — use polyfill or manual AsyncStorage caching
- Queue-and-retry pattern: AsyncStorage queue with `type`, `collectionPath`, `docId`, `data`, `retryCount`
- Process queue on reconnection with exponential backoff
- **Critical gotcha**: Don't `await` Firestore offline writes — use fire-and-forget to prevent UI freeze
- `useOfflineData` hook: load from AsyncStorage cache first, then Firestore snapshot when online

## 4. Deep Linking

- iOS: `associatedDomains: ["applinks:canopytrove.com"]` in app.json
- `.well-known/apple-app-site-association` on Firebase Hosting
- Android: `intentFilters` with `autoVerify: true`
- `.well-known/assetlinks.json` with SHA-256 fingerprint
- Expo Router: file-based deep linking automatic (`app/products/[id].tsx` → `myapp://products/123`)
- Validate incoming links: parse URL, verify structure before navigation
- Deferred deep linking: redirect to app or app store based on User-Agent

## 5. Push Notifications

- expo-notifications + FCM (Android) + APNs (iOS)
- Permission flow: check status → if undetermined, request → if denied, show settings prompt
- Best practice: request after first interaction (delay 3s), not on first launch
- Background handling: `TaskManager.defineTask()` for processing when app killed
- Android channels: default + high-priority with different vibration patterns
- Store FCM tokens in backend, handle token refresh

## 6. Crash Reporting (Sentry)

- `@sentry/react-native` with `withSentryConfig(metroConfig)`
- `tracesSampleRate: 0.1` (10% in production)
- `replayOnErrorSampleRate: 1.0` — capture replay on every error
- Release format: `${appVersion}+${buildNumber}`, dist: `ios` or `android`
- Breadcrumbs: navigation events, API requests, offline/online changes
- Performance monitoring: `Sentry.startTransaction()` for custom operations
- Source maps: auto-uploaded with EAS Build

## 7. App Store Optimization (ASO)

- First 3 description sentences = preview (critical for conversion)
- Keyword strategy: long-tail, intent-based, competitor, regional
- Screenshot sequence: hero shot → feature → social proof → CTA
- A/B testing: iOS Custom Product Pages, Google Play Store Listing Experiments
- Update cadence: keywords biweekly, screenshots every 6 weeks, full audit quarterly

## 8. OTA Updates (EAS Update)

- Channels: production, staging/preview, development
- Progressive rollout: 10% → 50% → 100% (monitor 24hrs between steps)
- Rollback: `eas update:rollback --branch production`
- Check for updates on app launch: `Updates.checkForUpdateAsync()` → prompt user to restart
- Never publish directly to production — always: dev → staging → production
- Include breaking change info in update message

## 9. Startup Performance

- TTI targets: iOS flagship ≤1.5s, iOS mid-tier ≤2s, Android flagship ≤2s, Android mid-tier ≤2.5s
- Splash screen: preload hero images, critical fonts, Firebase init
- Defer non-critical: analytics, A/B testing, social SDKs → `setTimeout(init, 2000)` after TTI
- `inlineRequires: true` + remove console.log in production
- Measure TTI: `Date.now() - startTimeRef.current` → report to Sentry if >2000ms

## 10. Memory Management

- FlatList: `removeClippedSubviews={true}` (50% memory reduction, but may flicker images)
- expo-image `recyclingKey` for FlatList items
- Monitor memory: alert if >300MB, reduce image quality
- Navigation cleanup: unsubscribe Firestore, cancel requests on `beforeRemove`
- useEffect cleanup: `isMounted` flag prevents setState after unmount
- Always clean up: timers, event listeners, subscriptions, WebSockets

## 11. Testing Strategy

- **Unit**: Vitest/Jest for utils, hooks (renderHook + waitFor)
- **Integration**: React Native Testing Library for screens (render + fireEvent + waitFor)
- **E2E**: Maestro (YAML, zero-config, 2025 favorite) > Detox
- Maestro: declarative YAML, cross-platform, 2-5% flakiness, fast team adoption
- `maestro test ./e2e/flows --app-file ./build/app.apk`

## 12. CI/CD Pipeline

- EAS Workflows: build iOS+Android → E2E tests → submit
- eas.json: development (APK/internal), preview (APK/internal), production (AAB/auto-submit)
- GitHub Actions: `expo/expo-github-action@v8` with `secrets.EXPO_TOKEN`
- Build → Test (Maestro) → Submit (auto on main branch)

## 13. Localization Readiness

- Even for English-only: set up i18next structure to avoid future refactoring
- `t('screens.home.welcome')` instead of hardcoded strings
- RTL support: `I18nManager.forceRTL()` based on locale
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat` for locale-aware formatting

## 14. Privacy Compliance

- iOS Privacy Manifest: declare NSUserDefaultsAPI, NSFileModificationDateAPI, NSSystemBootTimeAPI
- ATT: request after 5th app launch (not first), show custom prompt before system prompt
- GDPR for EU users: locale-based detection, right-to-deletion implementation
- Account deletion must be accessible and clear per App Store requirements

## Production Checklist

- [ ] Hermes enabled (jsEngine: hermes)
- [ ] Inline requires configured
- [ ] Source maps uploaded to Sentry
- [ ] iOS Privacy Manifest
- [ ] ATT permission flow
- [ ] Push notification channels
- [ ] Offline data strategy
- [ ] Deep linking (Universal Links / App Links)
- [ ] Error boundaries on all major routes
- [ ] FlatList memory optimization
- [ ] Image caching strategy
- [ ] TTI <2.5s on mid-tier devices
- [ ] OTA rollout policy (10% → 50% → 100%)
- [ ] E2E tests in CI/CD
- [ ] Sentry release tracking
- [ ] EAS Update channels configured
- [ ] Splash screen preloads critical assets
- [ ] Analytics deferred to post-TTI
