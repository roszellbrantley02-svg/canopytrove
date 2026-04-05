# Canopy Trove Full Codebase Audit

**Date:** April 5, 2026
**Scope:** Backend, Frontend, Firebase/Infrastructure, Security
**Total findings:** 45

---

## Summary by Severity

| Severity | Backend | Frontend | Infra/Firebase | Total |
| -------- | ------- | -------- | -------------- | ----- |
| Critical | 2       | 4        | 1              | 7     |
| High     | 5       | 4        | 5              | 14    |
| Medium   | 6       | 5        | 5              | 16    |
| Low      | 6       | 0        | 4              | 10    |

---

## CRITICAL (Fix Immediately)

### C1. Sentry sends PII by default

- **Area:** Backend Security
- **File:** `backend/src/observability/sentry.ts` line 60
- **Issue:** `sendDefaultPii: true` causes Sentry to capture IP addresses, user IDs, and other personally identifiable information. Potential GDPR/CCPA violation.
- **Fix:** Set `sendDefaultPii: false`. Explicitly configure only necessary user context.

### C2. Test auth headers active on public routes

- **Area:** Backend Security
- **Files:** `backend/src/routes/storefrontRoutes.ts` lines 45, 64, 88; `memberEmailRoutes.ts` lines 56-73; `ownerWelcomeEmailRoutes.ts` lines 33-51
- **Issue:** Multiple routes accept test auth headers (`x-canopy-test-account-id`, `x-canopy-test-email`). While there's a `!process.env.K_SERVICE` guard in most places, `allowTestHeader: true` is set on some public storefront routes.
- **Fix:** Remove test header support from all public-facing routes. Centralize the test guard so it always checks both `NODE_ENV` and `K_SERVICE`.

### C3. Missing expo-image (performance)

- **Area:** Frontend Performance
- **Files:** MapGridPreview, review photo components, GIF components
- **Issue:** Using react-native `Image` instead of `expo-image` with caching. Architecture docs specify expo-image is required.
- **Fix:** Replace all `Image` imports with `expo-image` for built-in caching, progressive loading, and memory management.

### C4. Touch targets below 48dp minimum

- **Area:** Frontend Accessibility
- **Files:** BrowseFiltersBar (42dp, 40dp), MarketSelector (40dp), PostVisitPromptHost (44dp)
- **Issue:** Interactive elements below the 48dp minimum touch target specified in design tokens. Fails WCAG 2.5.8.
- **Fix:** Increase `minHeight`/`minWidth` to 48 on all interactive elements.

### C5. Component bloat (maintainability risk)

- **Area:** Frontend Code Quality
- **Files:** OwnerPortalPromotionsScreen (1,073 lines), OwnerPortalProfileToolsScreen (810 lines)
- **Issue:** Single files exceeding 800+ lines are hard to test, review, and maintain.
- **Fix:** Extract sub-components, custom hooks, and utility functions. Target <400 lines per file.

### C6. Incomplete deep linking

- **Area:** Frontend Navigation
- **Issue:** Only 8 screens have deep link routes. Missing: Owner Portal screens, Auth screens, storefront detail screens.
- **Fix:** Add deep link routes for all navigable screens, especially storefront detail (needed for SEO/sharing).

### C7. Storage rules hardcoded to (default) database

- **Area:** Firebase Security
- **File:** `firebase/storage.rules` lines 25, 29, 33, 37, 41, 46-47, 53
- **Issue:** All cross-service `firestore.get()` calls reference `/databases/(default)/` instead of using dynamic database parameter. NOTE: This was previously investigated and determined that Firebase Storage cross-service lookups ALWAYS use `(default)` — this is a Firebase platform limitation, not a bug. The named `canopytrove` database stores the actual data, but Storage rules can only query `(default)`.
- **Status:** KNOWN LIMITATION — if data is in the named DB, these rules may not be validating against the right data. Verify that the relevant security-critical documents (owner profiles, verified status) are replicated to `(default)` or that an alternative auth check is in place.

---

## HIGH (Fix This Sprint)

### H1. Admin routes lack granular authorization

- **Area:** Backend Security
- **File:** `backend/src/routes/adminRoutes.ts`
- **Issue:** All admin operations share a single API key. A compromised key gives access to everything, including the dangerous `POST /admin/seed-firestore` endpoint that wipes the database.
- **Fix:** Add role-based admin access or separate credentials for destructive operations.

### H2. Suspicious activity detection is in-memory only

- **Area:** Backend Security
- **File:** `backend/src/http/suspiciousActivityDetector.ts` lines 8-19
- **Issue:** Failed auth tracking uses in-memory Maps. On Cloud Run with autoscaling, each instance has separate state. Attackers can bypass blocks by distributing requests across instances.
- **Fix:** Persist failed auth counts to Firestore (like rate limiting already does for write operations).

### H3. Rate limiting not persistent for read operations

- **Area:** Backend Security
- **File:** `backend/src/http/rateLimit.ts` lines 52-62
- **Issue:** Read rate limiting uses in-memory buckets only. In distributed Cloud Run, clients bypass limits by hitting different instances.
- **Fix:** Enable Firestore-backed rate limiting for reads, or accept the risk with documentation.

### H4. Admin runtime access accepts API key OR Firebase token

- **Area:** Backend Security
- **File:** `backend/src/http/adminAccess.ts` lines 94-151
- **Issue:** Two separate auth mechanisms without clear separation. If Firebase Auth is compromised, any user with admin claims accesses runtime endpoints.
- **Fix:** Separate concerns: API key for service-to-service, Firebase for user-based with explicit role requirements.

### H5. Giphy API key in URL query parameters

- **Area:** Backend Security
- **File:** `backend/src/routes/giphyGatewayRoutes.ts` lines 21-26, 58-65
- **Issue:** API key sent as URL query parameter, visible in outbound request logs and potentially in referrer headers.
- **Fix:** Use header-based auth if Giphy supports it. Redact API keys from logs.

### H6. GIPHY API key committed to repository

- **Area:** Infrastructure Security
- **File:** `.env` line 10
- **Issue:** `EXPO_PUBLIC_GIPHY_API_KEY=rl8RV...` is a real API key in a committed file.
- **Fix:** Rotate the key immediately. Move to EAS secrets or Secret Manager.

### H7. CSP allows unsafe-inline scripts

- **Area:** Infrastructure Security
- **File:** `firebase.json` lines 43, 95
- **Issue:** Both hosting targets include `script-src 'self' 'unsafe-inline'` which defeats XSS protection.
- **Fix:** Remove `'unsafe-inline'`. Use nonce-based or hash-based script integrity for any inline scripts.

### H8. Form state using 14 separate useState calls

- **Area:** Frontend Code Quality
- **Issue:** Complex forms use many individual `useState` calls instead of `useReducer` or a form library.
- **Fix:** Consolidate form state with `useReducer` or a form management hook.

### H9. Duplicated prefetch logic

- **Area:** Frontend Code Quality
- **File:** BrowseScreen lines 162-176
- **Issue:** Same prefetch logic duplicated within the same component.
- **Fix:** Extract to a shared function or custom hook.

### H10. Missing accessibility labels on interactive components

- **Area:** Frontend Accessibility
- **Files:** HapticPressable, QuickActionsRow, filter chips
- **Issue:** Interactive elements missing `accessibilityLabel` and `accessibilityRole`.
- **Fix:** Add labels to all interactive elements.

### H11. Missing input validation/keyboard handling in forms

- **Area:** Frontend UX
- **Issue:** Forms don't properly handle keyboard dismissal, next-field focus, or input validation feedback.
- **Fix:** Add `returnKeyType`, `onSubmitEditing` chaining, and inline validation.

---

## MEDIUM (Fix This Month)

### M1. Test bearer token format allows ID spoofing

- **File:** `backend/src/services/profileAccessService.ts` lines 42-62
- **Issue:** Any token starting with `test-authenticated:` is accepted in test environments.

### M2. Missing input validation on URL path parameters

- **File:** `backend/src/routes/adminDiscoveryRoutes.ts` line 81
- **Issue:** `request.params.runId` used without validation.

### M3. Error responses may leak internal state

- **Files:** Multiple route files
- **Issue:** Status code selection based on error message string matching (`.includes('not found')`) is fragile.

### M4. No prototype pollution protection

- **File:** `backend/src/http/validationCore.ts` lines 27-41
- **Issue:** No check for `__proto__`, `constructor`, or `prototype` keys.

### M5. Test-only headers not uniformly guarded

- **File:** `backend/src/routes/ownerWelcomeEmailRoutes.ts` lines 33-51
- **Issue:** Individual route checks `NODE_ENV === 'test'` without also checking `!K_SERVICE`.

### M6. Unused validation code

- **File:** `backend/src/http/zodValidation.ts`
- **Issue:** File exists but doesn't appear to be imported anywhere.

### M7. Gamification state overly permissive reads

- **File:** `firebase/firestore.rules` line 285
- **Issue:** Any signed-in user can read ALL gamification state documents.

### M8. Storage rules ambiguous allPaths wildcard

- **File:** `firebase/storage.rules` multiple lines
- **Issue:** Heavy use of `{allPaths=**}` without explicit file type validation.

### M9. Hardcoded dimensions (not responsive)

- **Files:** AgeGateScreen and others
- **Issue:** Fixed pixel dimensions instead of responsive layouts.

### M10. Nested ScrollView anti-pattern

- **File:** AdminRuntimePanelScreen
- **Issue:** ScrollView nested inside another ScrollView causes touch conflicts.

### M11. Inconsistent memoization strategy

- **Issue:** Some expensive computations are memoized, others aren't. No consistent pattern.

### M12. Potential memory leaks in async operations

- **Issue:** Some useEffect hooks with async operations lack cleanup functions.

### M13. Missing HSTS header

- **File:** `firebase.json`
- **Issue:** Neither hosting target includes `Strict-Transport-Security` header.

### M14. Dispensary read without list status filter protection

- **File:** `firebase/firestore.rules` line 115
- **Issue:** Public read based on status field. Update validation exists but direct writes need monitoring.

### M15. Distributed suspicious activity detection needed

- **File:** `backend/src/http/suspiciousActivityDetector.ts`
- **Issue:** Same as H2. In-memory tracking defeated by Cloud Run autoscaling.

---

## LOW (Backlog)

### L1. Hardcoded rate limit bucket count (2048)

### L2. Weak rate limit bucket cleanup strategy (size-based only, no time-based)

### L3. Inconsistent error status code assignment patterns

### L4. Test coverage gaps (7+ route files without tests: analyticsRoutes, clientRuntimeRoutes, gamificationRoutes, leaderboardRoutes, locationRoutes, marketAreaRoutes, ownerPortalAiRoutes)

### L5. Owner portal error messages reveal tier information

### L6. Request timeout hardcoded to 30 seconds

### L7. EAS build: Sentry auto-upload disabled

### L8. Firebase rules missing audit logging enforcement

### L9. Missing HSTS preload directive

### L10. Source maps not automatically uploaded to Sentry

---

## Positive Findings

The codebase has strong fundamentals:

- No TODO/FIXME/HACK comments (excellent discipline)
- No `any` types in frontend TypeScript (strong typing)
- Proper error boundaries via `withScreenErrorBoundary` HOC
- Good context API usage for state management
- Proper animation optimization with `useNativeDriver`
- Security headers middleware with restrictive CSP defaults
- CORS explicitly restricted (not wildcard)
- Admin API key uses timing-safe SHA256 comparison
- Firestore rules have role-based access control
- Rate limiting with Firestore persistence fallback for writes
- Content-Type enforcement middleware
- Graceful shutdown with readiness probes
- Storage upload size limits enforced (10MB owner, 6MB community)
- Structured JSON logging (Pino) for Cloud Run

---

## Recommended Fix Order

**Week 1 — Security Critical:**

1. Set `sendDefaultPii: false` in Sentry config
2. Rotate the committed GIPHY API key
3. Remove test auth header support from public routes
4. Add HSTS header to Firebase Hosting

**Week 2 — Security High:** 5. Add separate credential/confirmation for admin seed endpoint 6. Make suspicious activity detection persistent (Firestore-backed) 7. Remove `unsafe-inline` from CSP (requires moving inline scripts to external files)

**Week 3 — Code Quality:** 8. Replace react-native `Image` with `expo-image` 9. Fix touch target sizes below 48dp 10. Split oversized component files (>800 lines) 11. Add accessibility labels to all interactive elements

**Week 4 — Architecture:** 12. Consolidate form state management 13. Add deep link routes for all navigable screens 14. Expand test coverage for untested route files 15. Fix nested ScrollView anti-patterns
