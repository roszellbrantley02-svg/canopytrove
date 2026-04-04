# React Hooks & Secrets Management for Canopy Trove

Research-backed best practices (2025-2026).

## REACT HOOKS PATTERNS

### 1. Custom Hook Architecture
- Extract when logic used in 2+ components or component >100 lines
- Compose simpler hooks into complex ones (useFetch → useUserData)
- ESLint plugin `eslint-plugin-react-hooks` validates dependency arrays
- AbortController in useEffect for cleanup of async requests

### 2. Data Fetching: SWR vs TanStack Query
- **SWR**: ~1KB, simple API, stale-while-revalidate strategy. Best for: simple apps, bundle-critical
- **TanStack Query**: ~15KB, granular cache, official DevTools, infinite queries. Best for: complex apps
- TanStack Query `useInfiniteQuery` for paginated FlatLists
- Optimistic updates via `onMutate` + `queryClient.setQueryData()`
- Cache invalidation: `queryClient.invalidateQueries({ queryKey: ['user', userId] })`

### 3. State Management Hierarchy (2025)
1. `useState` — component-level
2. `useContext + useReducer` — shared subtree
3. **Zustand** — global app state (recommended)
4. Redux — only for very large teams needing time-travel debugging

- Zustand with `persist` middleware + AsyncStorage for device persistence
- Selector pattern prevents unnecessary re-renders: `useStore(s => s.specificValue)`
- Split Context into separate providers per state domain

### 4. Memoization
- **React 19 Compiler** (production-ready Oct 2025): auto-memoizes ~90% of cases
- Still need manual `useMemo`/`useCallback` for: gesture handlers, animation refs, external lib identity requirements
- Don't memoize: primitives, props that change every render, inline callbacks with changing deps

### 5. Effect Management
- AbortController for fetch cleanup — prevents state updates after unmount
- Event listener cleanup: `addEventListener('focus', handler, { signal: controller.signal })`
- Timer cleanup: `return () => clearInterval(interval)`
- WebSocket cleanup: `return () => ws.close()`
- Subscription cleanup: `return () => subscription.unsubscribe()`

### 6. Ref Patterns
- `useRef` for mutable values that persist across renders without triggering re-render
- `forwardRef` for exposing child DOM access (TextInput focus)
- `useImperativeHandle` for custom imperative APIs (expose only specific methods)
- `useLayoutEffect` for measuring layouts before paint

### 7. Navigation Hooks (React Navigation)
- `useFocusEffect`: runs on focus, cleans up on blur — use for data refresh, audio pause/resume
- `useIsFocused`: boolean for conditional rendering
- `useFocusEffect` vs `useEffect`: screen lifecycle vs component lifecycle
- Always wrap `useFocusEffect` callback in `useCallback`

### 8. Animation Hooks (Reanimated 3)
- `useSharedValue`: lives on UI thread, no bridge delay
- `useAnimatedStyle`: derives styles from shared values
- `useAnimatedGestureHandler`: pan/pinch/tap gesture response
- `runOnUI` / `runOnJS`: cross-thread communication
- `'worklet'` marker: function runs on UI thread

### 9. Performance Hooks
- `useTransition`: wrap deferred state updates (search results, filters)
- `useDeferredValue`: defer prop-based values (search term from parent)
- When to use which: `useTransition` = you control setState, `useDeferredValue` = value from prop

### 10. Testing Hooks
- `renderHook` from `@testing-library/react`
- Use `waitFor` (not deprecated `waitForNextUpdate`)
- Test with wrapper for Context/Provider
- `act()` for synchronous state updates

---

## SECRETS MANAGEMENT

### 1. Expo Environment Variables
- `EXPO_PUBLIC_` prefix: visible in compiled app, accessible via `process.env.EXPO_PUBLIC_*`
- Non-prefixed vars: NOT accessible to JS (backend only)
- **Safe to expose**: API endpoints, Firebase config (with security rules), restricted Maps keys, analytics keys
- **NOT safe**: private API keys, DB credentials, OAuth secrets, service account keys, admin tokens

### 2. API Keys in Mobile Apps — Hard Truth
- Any key compiled into APK/IPA is extractable (JADX, Frida, binary inspection)
- **Strategy 1 (Recommended): Backend Gateway** — mobile calls your backend, which holds real keys
- **Strategy 2**: Short-lived tokens — backend generates temp tokens, mobile uses for 1hr
- **Strategy 3**: Key restrictions — iOS bundle ID, Android package+SHA-1, API-specific restrictions
- **Strategy 4**: Certificate pinning — react-native-ssl-pinning for MITM defense
- **Strategy 5**: App Attestation — Firebase App Check verifies legitimate app instance

### 3. Firebase Config Safety
- Firebase config (apiKey, projectId, etc.) is safe to expose IF proper security rules exist
- CRITICAL: Firestore Security Rules must deny all by default, then whitelist per-collection
- Users should only read/write their own data (`request.auth.uid == userId`)
- NEVER expose: service account private key, admin SDK credentials

### 4. Google Maps/Places API Key Restrictions
- Create SEPARATE keys for iOS and Android (one restriction type per key)
- iOS: restrict by bundle ID (`com.rezell.canopytrove`)
- Android: restrict by package name + SHA-1 certificate fingerprint
- Bundle ID restrictions can be bypassed — add App Check on top
- Monitor quota alerts for unusual spikes (indicates compromise)

### 5. Cloud Run Secrets
- Use Google Secret Manager: `gcloud secrets create <name> --data-file=-`
- Mount as env var: `--set-secrets=DB_PASSWORD=db-password:latest`
- Cloud Run fetches latest secret value automatically
- Rotation: Cloud Scheduler + Cloud Function adds new secret version
- Best practice: pin to specific version, update with deployment

### 6. Auth Token Storage
- **expo-secure-store** (encrypted, Keychain/Keystore) — ALWAYS use for tokens
- **AsyncStorage is NOT secure** — unencrypted, never store tokens there
- Token refresh: axios interceptor catches 401, refreshes token, retries original request
- Biometric gating: expo-local-authentication for extra security on sensitive operations

### 7. Code Obfuscation
- Hermes bytecode: basic obfuscation (not human-readable) but tools exist to decompile
- ProGuard/R8 for Android native code: `minifyEnabled true, shrinkResources true`
- Combined strategy: Hermes + javascript-obfuscator + ProGuard
- Obfuscation is defense-in-depth, NOT a security boundary

### 8. Certificate Pinning
- When: high-security (financial/medical), high-risk regions
- Pin 2-3 certs: current + next + backup (rotation protection)
- Plan rotations 3-6 months ahead
- react-native-ssl-pinning for implementation

### 9. Firebase App Check
- iOS: App Attest provider, auto-refresh every ~30min
- Backend verifies: `AppCheckTokenVerifier.verifyToken(token)`
- Gradual rollout: monitor 2 weeks → enforce new installs → enforce all
- Protects against: cloned apps, jailbroken devices, modified binaries, replay attacks

### 10. CI/CD Secrets
- EAS Secrets: `eas secret:create`, stored encrypted, injected at build time
- GitHub Actions: `${{ secrets.EXPO_TOKEN }}` — never echo secrets in logs
- Separate keys for public vs internal builds
- Best: keep sensitive data as env vars (not echoed), never in build output
