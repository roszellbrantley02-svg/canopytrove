---
name: canopy-trove-dev
description: Canopy Trove app development skill. Use when writing, modifying, or extending React Native/Expo frontend code or Node.js/Express backend code for the Canopy Trove dispensary discovery app. Knows the full stack, file conventions, design tokens, and architectural patterns.
---

# Canopy Trove Development Skill

Use this skill when writing or modifying code for Canopy Trove — a licensed dispensary discovery app built with React Native/Expo (frontend) and Node.js/Express on Cloud Run (backend).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React Native, Expo SDK, TypeScript, Expo Router |
| Backend | Node.js/Express on Cloud Run (`canopytrove-api`, `us-east4`) |
| Database | Firestore named database `canopytrove` (NOT `(default)`) |
| Auth | Firebase Auth |
| Maps | Google Places API (backend gateway pattern — keys never on client) |
| Build | EAS Build (development, preview, production profiles) |
| Monitoring | Sentry (frontend + backend), Cloud Logging |
| Bundle ID | `com.rezell.canopytrove` |

## Design Tokens (ALWAYS use these)

```typescript
// Colors — dark theme first, always
background: '#121614'
surface: '#1A1F1C'
surfaceElevated: '#232A26'
surfaceHighest: '#2E3631'
textPrimary: '#FFFBF7'    // 13.2:1 contrast
textSecondary: '#C4B8B0'  // 7.1:1 contrast
textMuted: '#9CC5B4'
accent: '#8FFFD1'          // primary green in tokens.ts
accentGreen: '#2ECC71'     // action green
accentGold: '#E8A000'      // upgrade/premium gold
danger: '#E74C3C'
warning: '#F39C12'
borderSoft: '#2E3631'
borderStrong: '#3A4238'

// Typography
heading: 'SpaceGrotesk'    // Bold, Medium weights
body: 'DM Sans'            // Regular, Medium weights
// Scale: display1:48, h1:32, h2:28, h3:24, h4:20, bodyLarge:18, body:16, bodySmall:14, caption:12

// Spacing
xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48

// Border radius
sm: 4, md: 8, lg: 12, xl: 16

// Touch targets: minimum 48dp always
```

## Frontend Code Conventions

### File Structure
- Screens: `src/screens/OwnerPortal*.tsx`, `src/screens/ownerPortal/*.ts` (hooks, utils, sections)
- Components: `src/components/*.tsx` (shared), screen-specific sections in screen folders
- Services: `src/services/*.ts` (API calls, business logic)
- Types: `src/types/*.ts` (shared type definitions)
- Theme: `src/theme/tokens.ts` (import `colors`, `spacing`, `textStyles` from here)
- Icons: `src/icons/AppUiIcon.tsx` (Ionicons-based, use `AppUiIconName` type)

### Component Patterns
- Use `StyleSheet.create()` for styles, defined at bottom of file as `localStyles` or descriptive name
- Functional components only, no class components
- Import colors/spacing/textStyles from `../theme/tokens` — never hardcode token values
- Use `HapticPressable` for interactive elements (wraps Pressable with haptic feedback)
- Use `ScreenShell` for screen containers (handles safe area, header, scroll)
- Use `SectionCard` for content sections (title, body, children)
- Use `MotionInView` for staggered entrance animations (pass `delay` prop)
- Use `InlineFeedbackPanel` for error/info/success states
- Cap font scaling: `maxFontSizeMultiplier={1.3}` on Text, `1.2` on labels

### Hook Patterns
- Custom hooks in `use*.ts` files next to their screen
- `useOwnerPortalWorkspace(preview)` is the main workspace hook — returns workspace data + mutation functions
- Always clean up with AbortController in useEffect
- Use `useFocusEffect` (not useEffect) for screen-level data refresh
- Wrap `useFocusEffect` callback in `useCallback`

### API Service Pattern
```typescript
// Frontend services call requestJson or requestOwnerPortalJson
export function doSomething(input: InputType, locationId?: string | null) {
  return requestOwnerPortalJson<ResponseType>('/owner-portal/endpoint', {
    method: 'POST',
    body: { ...input, ...(locationId ? { locationId } : {}) },
  });
}
```

### Error Handling
- `BackendTierAccessError` for tier-gated features (detected automatically in HTTP layer)
- `getWorkspaceErrorMessage(error, fallback)` for user-facing error strings
- `isBackendTierAccessError(error)` type guard for tier errors

## Backend Code Conventions

### File Structure
- Routes: `backend/src/routes/ownerPortal*.ts`
- Services: `backend/src/services/*.ts` (business logic, one service per domain)
- Collections: `backend/src/services/*Collections.ts` (Firestore collection accessors)
- Validation: `backend/src/http/validation.ts` (Zod schemas)
- Config: `backend/src/config.ts`

### Route Pattern
```typescript
// All owner routes use createOwnerPortalJsonRoute wrapper
router.post('/owner-portal/endpoint',
  rateLimiter,
  createOwnerPortalJsonRoute('Fallback error message', async ({ ownerUid, request }) => {
    // Extract locationId from body for multi-location support
    const locationId = typeof request.body?.locationId === 'string'
      ? request.body.locationId.trim() || null : null;
    // Tier gating if needed
    await requireTierAccess(ownerUid, 'growth', 'Feature Name');
    // Runtime policy check
    await assertRuntimePolicyAllowsOwnerAction('action_name');
    // Call service
    return serviceFunction(ownerUid, parsedInput, locationId);
  }),
);
```

### Service Pattern
```typescript
export async function serviceFunction(
  ownerUid: string,
  input: InputType,
  locationId?: string | null,
) {
  // 1. Assert authorization
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });
  // 2. Resolve active location (multi-location support)
  const targetStorefrontId = await resolveOwnerActiveLocation(ownerUid, locationId)
    ?? ownerState.storefrontId!;
  // 3. Resolve tier and enforce limits
  const ownerTier = await resolveOwnerTier(ownerUid);
  const tierLimits = getTierLimits(ownerTier);
  // 4. Business logic using targetStorefrontId
}
```

### Tier System
- Three tiers: `verified` ($79), `growth` ($149), `pro` ($249)
- `resolveOwnerTier(ownerUid)` reads from Firestore subscriptions collection
- `getTierLimits(tier)` returns feature flags and numeric limits
- `requireTierAccess(ownerUid, tier, label)` throws `TierAccessError` if insufficient
- `TierAccessError` → 403 with `{ code: 'TIER_ACCESS_DENIED', requiredTier, currentTier }`

### Firestore Patterns
- Always use `getBackendFirebaseDb()` — returns null if DB unavailable
- Named database: `canopytrove` (set via `FIREBASE_DATABASE_ID` env var)
- Use `Promise.allSettled` for parallel reads where partial failure is acceptable
- Use `{ merge: true }` for Firestore set operations to avoid overwriting
- Collection helpers in `*Collections.ts` files return `CollectionReference | null`

### Error Handling
- `TierAccessError` for tier violations (auto-serialized by route utils)
- Standard `Error` for business logic violations
- `getOwnerPortalRouteErrorPayload` handles error → JSON response mapping
- Never expose stack traces — only error messages and codes

## Key Terms
- **storefront**: A dispensary listing (627 in DB)
- **discovery run**: Backend sweep enriching storefronts via Google Places API
- **routeMode**: `preview` vs `verified` — affects navigation URL generation
- **profileTools**: Owner's storefront customization (badges, photos, hours, menu URL)
- **promotion**: Time-limited deal/special created by owner
- **OCM**: Office of Cannabis Management (NY regulator)

## Important Rules
1. ALWAYS use design tokens — never hardcode colors, spacing, or font values
2. ALWAYS support multi-location by passing `locationId` through mutations
3. ALWAYS check tier access before gated features
4. ALWAYS use `assertAuthorizedOwnerStorefront` before storefront mutations
5. ALWAYS use `Promise.allSettled` for parallel reads that can partially fail
6. NEVER expose API keys on the client — use backend gateway pattern
7. NEVER use `(default)` Firestore database — always target `canopytrove`
8. NEVER skip runtime policy checks (`assertRuntimePolicyAllowsOwnerAction`)
9. Frontend icon names must exist in `AppUiIcon` — grep for available names before using
10. Test compilation with `npx tsc --noEmit` after every change
