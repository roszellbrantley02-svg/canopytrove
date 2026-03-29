# Canopy Trove

Public-facing brand: Canopy Trove.

## Primary Baseline

Start here first:

- `CURRENT_MERGE_SUMMARY.md`

The canonical working recovery copy is:

- `C:\Users\eleve\Documents\New project\canopy-trove-3-restored`

Use this project folder as the main source of truth going forward.

If anything goes wrong again, start with:

- `CURRENT_MERGE_SUMMARY.md`
- `MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md`
- `docs/RECOVERY_CHECKLIST.md`
- `docs/GOOGLE_MAPS_KEY_HARDENING.md`
- `docs/OWNER_PORTAL_PREVIEW.md`
- `docs/OWNER_PORTAL_READINESS.md`
- `docs/RELEASE_READINESS.md`
- `docs/PRODUCTION_RELEASE_SETUP.md`
- `docs/ADMIN_REVIEW_WORKFLOW.md`
- `docs/PRIVACY_POLICY.md`
- `docs/TERMS_OF_USE.md`
- `docs/COMMUNITY_GUIDELINES.md`
- `docs/STORE_METADATA.md`
- `docs/CANOPY_TROVE_LAUNCH_CHECKLIST.md`
- `docs/CANOPY_TROVE_SCREENSHOT_BRIEF.md`
- `src/config/legal.ts`
- `src/screens/LegalCenterScreen.tsx`
- `src/screens/DeleteAccountScreen.tsx`

Canonical phone build path:

```powershell
cd "C:\Users\eleve\Documents\New project\canopy-trove-3-restored"
eas build --platform android --profile preview
```

Planning-first reset of Canopy Trove with a live Phase 1 shell.

This project starts from product and system design, not from patching the current app.

The goal is to keep the same core idea:

- help people find legal cannabis dispensaries
- make discovery feel chosen and trustworthy
- keep licensing and location data trustworthy
- make the app feel fast on first paint

This folder now contains:

- planning documents
- a clean Expo + TypeScript app shell
- a reusable theme system
- a first app shell structure
- source modes for `mock`, `firebase`, and `api`
- a separate `backend/` workspace for the API contract scaffold
- an official NY storefront seed path generated from the OCM dispensary verification list

Key files:

- `docs/PRODUCT_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/API_CONTRACT.md`
- `docs/LOCAL_API_MODE.md`
- `docs/RECOVERY_CHECKLIST.md`
- `docs/GOOGLE_MAPS_KEY_HARDENING.md`
- `docs/RELEASE_READINESS.md`
- `docs/PRODUCTION_RELEASE_SETUP.md`
- `docs/ADMIN_REVIEW_WORKFLOW.md`
- `docs/PRIVACY_POLICY.md`
- `docs/TERMS_OF_USE.md`
- `docs/COMMUNITY_GUIDELINES.md`
- `docs/STORE_METADATA.md`
- `docs/CANOPY_TROVE_LAUNCH_CHECKLIST.md`
- `docs/CANOPY_TROVE_SCREENSHOT_BRIEF.md`
- `src/navigation/RootNavigator.tsx`
- `src/screens/NearbyScreen.tsx`
- `src/screens/BrowseScreen.tsx`
- `src/screens/TravelScreen.tsx`
- `src/screens/ProfileScreen.tsx`

Run:

- `npm start`
- `npm run android`
- `npm run web`
- `npm run backend`
- `npm run dev:api`
- `npm run generate:ocm-verified-seed`

Core principles:

1. Official data decides identity.
2. Google data enriches, but does not define truth.
3. Summary data loads first.
4. Detail data loads only when needed.
5. Matching and enrichment should be precomputed, not improvised on-device.
6. UI should never wait on work the user did not ask for.

Source modes:

- `mock`
  - default local development mode
  - now backed by the OCM dispensary verification list plus curated rich overrides for matching official storefronts
- `firebase`
  - direct Firestore summary/detail reads
- `api`
  - production-facing backend contract for summary/detail endpoints
  - now also supplies market areas and location resolution for the app shell

Production notes:

- profile-scoped API routes now accept Firebase ID tokens through `Authorization: Bearer <token>`
- authenticated requests can claim and own a Canopy Trove profile on the backend
- once a profile is claimed, unauthenticated or mismatched access to that profile is rejected
