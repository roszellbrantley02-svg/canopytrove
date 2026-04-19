---
name: canopy-trove-troubleshoot
description: Canopy Trove troubleshooting skill. Use when debugging build failures, deployment issues, runtime errors, tier gating problems, Firestore connection issues, or any unexpected behavior in the React Native/Expo frontend or Node.js/Express backend.
---

# Canopy Trove Troubleshooting Skill

Use this skill when diagnosing and fixing issues in Canopy Trove — a React Native/Expo + Node.js/Express app deployed on Cloud Run with Firestore.

## Diagnostic Checklist (Start Here)

Before diving into code, identify which layer is failing:

1. **Build-time** → TypeScript, Metro bundler, EAS Build
2. **Deploy-time** → Cloud Run, env vars, Secret Manager
3. **Runtime backend** → Express routes, Firestore, Google Places API
4. **Runtime frontend** → React Native screens, navigation, API calls
5. **Tier/auth** → Subscription gating, Firebase Auth, owner authorization

## Cloud Run Deployment Issues

### Missing or Wrong Env Vars

The #1 cause of "works locally, breaks on Cloud Run."

| Env Var | Required Value | What Breaks Without It |
|---------|---------------|----------------------|
| `STOREFRONT_BACKEND_SOURCE` | `firestore` | Defaults to `mock` — all storefront data is fake |
| `FIREBASE_DATABASE_ID` | `canopytrove` | Reads from `(default)` database — empty collections |
| `GOOGLE_MAPS_API_KEY` | Via Secret Manager | All Places API calls return 403 |
| `ADMIN_API_KEY` | Via Secret Manager | Admin endpoints reject all requests |
| `SENTRY_DSN` | Sentry project DSN | Backend errors silently lost |

**Debug steps:**
```bash
# List current env vars on Cloud Run
gcloud run services describe canopytrove-api --region=us-east4 --format='yaml(spec.template.spec.containers[0].env)'

# Check Secret Manager versions
gcloud secrets versions list GOOGLE_MAPS_API_KEY --project=canopy-trove

# Verify the service is using the right revision
gcloud run revisions list --service=canopytrove-api --region=us-east4 --limit=3
```

### Health Probe Failures

Cloud Run uses `/livez` and `/readyz` endpoints.

- `/livez` fails → process crashed or never started (check startup logs)
- `/readyz` fails → Firestore connection or dependency not ready

```bash
# Check Cloud Run logs for startup errors
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="canopytrove-api" AND severity>=ERROR' --limit=20 --format=json
```

### Cold Start / Timeout

Cloud Run has a 300s request timeout default. Discovery runs can exceed this.

- If a discovery run times out, it leaves a **zombie run** (status: `running` forever)
- Recovery: manually set the run document's status to `failed` in Firestore

## Firestore Named Database Issues

**Critical**: Canopy Trove uses the named database `canopytrove`, NOT `(default)`.

### Common Mistakes

1. **Using Firebase console without selecting the database** — the console defaults to `(default)`. Always switch to `canopytrove` in the database picker.
2. **`getBackendFirebaseDb()` returns null** — the backend Firebase app isn't initialized or `FIREBASE_DATABASE_ID` env var is missing.
3. **Collection reads return empty** — almost always means you're hitting `(default)` instead of `canopytrove`.

### Debug Steps

```typescript
// In backend code, verify which database you're hitting
const db = getBackendFirebaseDb();
if (!db) {
  console.error('Firestore DB handle is null — check FIREBASE_DATABASE_ID env var');
}
// The db object's _databaseId should show 'canopytrove'
```

```bash
# Verify data exists in the named database (not default)
gcloud firestore documents list --database=canopytrove --collection-ids=storefronts --limit=3
```

## React Native / Expo Build Issues

### EAS Build Failures

Three build profiles: `development`, `preview`, `production`.

| Profile | Use | Common Issue |
|---------|-----|-------------|
| `development` | Local dev client | Missing `EXPO_PUBLIC_*` vars in `.env` |
| `preview` | TestFlight/internal | Provisioning profile mismatch |
| `production` | App Store | Bundle ID must be `com.rezell.canopytrove` |

**Debug steps:**
```bash
# Check recent build status
eas build:list --limit=5

# View build logs for a specific build
eas build:view <build-id>

# Verify app.json/app.config.js has correct bundle ID
grep -r "com.rezell.canopytrove" app.json app.config.*
```

### Metro Bundler Errors

- `Unable to resolve module` → check import paths, especially after moving files
- `Duplicate module` → clear Metro cache: `npx expo start --clear`
- Hermes compilation errors → usually a syntax issue Hermes V1 doesn't support

### TypeScript Compilation

Always verify after changes:
```bash
npx tsc --noEmit
```

Common issues in this codebase:
- Missing fields in object literals (e.g., `OwnerPromotionPerformanceSnapshot` requires all metric fields)
- `colors.primary` vs `colors.accent` — check `src/theme/tokens.ts` for actual exported names
- Icon names must exist in `AppUiIcon` — grep `src/icons/AppUiIcon.tsx` before using

## Tier System Debugging

### Tier Resolution Flow

```
User action → Frontend mutation call
  → Backend route extracts ownerUid from Firebase Auth
  → resolveOwnerTier(ownerUid) reads Firestore subscriptions collection
  → getTierLimits(tier) returns feature flags
  → requireTierAccess(ownerUid, requiredTier, label) throws TierAccessError if insufficient
  → TierAccessError → 403 { code: 'TIER_ACCESS_DENIED', requiredTier, currentTier }
  → Frontend throwBackendError() detects code, throws BackendTierAccessError
  → useOwnerPortalWorkspace sets tierUpgradePrompt state
  → UI shows upgrade banner
```

### Common Tier Bugs

1. **Tier reads as `undefined`** → Owner has no subscription document in Firestore. Check `subscriptions` collection for the owner's UID.
2. **Stripe webhook not updating Firestore** → Verify the webhook endpoint is deployed and the signing secret matches.
3. **Feature works in preview but not verified mode** → Preview mode bypasses some tier checks. Ensure `routeMode` is correctly set.
4. **BackendTierAccessError not caught on frontend** → Check that `throwBackendError()` is being called in the HTTP layer (not the old `getBackendErrorMessage()`).
5. **tierUpgradePrompt not showing** → Verify `isBackendTierAccessError(error)` type guard works — the error must be an instance of `BackendTierAccessError`, not a plain object.

### Verifying Tier in Firestore

```bash
# Check an owner's subscription document
gcloud firestore documents get --database=canopytrove \
  projects/canopy-trove/databases/canopytrove/documents/subscriptions/<ownerUid>
```

## Multi-Location Debugging

### Resolution Flow

```
Frontend passes locationId in request body
  → Backend route extracts: typeof request.body?.locationId === 'string' ? trim() || null : null
  → resolveOwnerActiveLocation(ownerUid, locationId) checks owner's location list
  → Returns locationId if valid, null if not found
  → Falls back to ownerState.storefrontId (primary location)
```

### Common Issues

1. **locationId silently ignored** → The route might not be extracting it from `request.body`. Check `ownerPortalWorkspaceRoutes.ts`.
2. **Wrong storefront updated** → `resolveOwnerActiveLocation` returned null (invalid locationId), so it fell back to primary. Check that the locationId exists in the owner's `additionalLocationIds` array.
3. **Frontend not sending locationId** → Check that the service function includes `...(locationId ? { locationId } : {})` in the body.

## Frontend Error Patterns

### BackendTierAccessError

```typescript
// Detection in useOwnerPortalWorkspace:
if (isBackendTierAccessError(error)) {
  setTierUpgradePrompt({
    message: error.message,
    requiredTier: error.requiredTier,
    currentTier: error.currentTier,
  });
} else {
  setErrorText(getWorkspaceErrorMessage(error, fallback));
}
```

### Navigation Fallback Issues

- `routeMode` determines URL generation (preview vs verified)
- If a screen loads blank, check that the route is registered in `RootNavigator`
- Owner portal screens require auth — if Firebase Auth token expires, API calls return 401

### Slow Renders

- Check for missing `useMemo`/`useCallback` on expensive operations
- `useFocusEffect` fires every time a screen is focused — avoid heavy work without guards
- `MotionInView` delays stack up — keep `delay` values reasonable (70ms increments)

## Discovery Run Issues

### Zombie Runs

A discovery run stuck in `running` status forever:

1. Check Cloud Run logs for timeout errors around the run's start time
2. Manually update the run document in Firestore: `status: 'failed'`, `endedAt: now`
3. Investigate whether the Google Places API key hit quota limits

### Google Places API Errors

- 403 → API key invalid or restricted. Check Secret Manager value and API key restrictions in GCP console.
- 429 → Rate limit exceeded. The backend should have retry logic with exponential backoff.
- `ZERO_RESULTS` → The search query didn't match. Not an error — log and skip.

## Quick Reference: Where to Look

| Symptom | First Place to Check |
|---------|---------------------|
| Blank screen on load | `useFocusEffect` in the screen, network tab for failed API calls |
| "Could not load workspace" | Backend `/owner-portal/workspace` endpoint, check auth token |
| 403 on mutation | `requireTierAccess` — owner's tier vs required tier |
| Firestore reads empty | Database name — must be `canopytrove` not `(default)` |
| Build fails on EAS | `eas build:view` logs, check `app.json` config |
| TypeScript errors | `npx tsc --noEmit`, read the full error chain |
| Cloud Run 502/503 | Health probe failing, check `/readyz` and startup logs |
| Promotions not saving | Check tier limits (`maxPromotions`), locationId resolution |
| Badges not toggling | Check `badgeCustomizationEnabled` for current tier |
| AI insights locked | Pro-only feature — verify `isProTier` check |

## Sentry Integration

- Backend: errors auto-captured, check Sentry dashboard for stack traces
- Frontend: `EXPO_PUBLIC_SENTRY_DSN` must be set in `.env` for local dev and in EAS build secrets for production
- Navigation breadcrumbs help trace user path to error

## Nuclear Options (Last Resort)

1. **Full backend redeploy**: `gcloud run deploy canopytrove-api --source=./backend --region=us-east4`
2. **Clear Metro cache**: `npx expo start --clear`
3. **Fresh EAS build**: `eas build --platform ios --profile development --clear-cache`
4. **Firestore index rebuild**: Check Firestore console for index build errors after schema changes
