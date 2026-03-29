# Canopy Trove Primary Baseline

Updated: March 28, 2026

Top lead file:

- `CURRENT_MERGE_SUMMARY.md`

## Canonical Working Copy

This is the number-one working recovery baseline for Canopy Trove.

Use this folder as the main project going forward:

`C:\Users\eleve\Documents\New project\canopy-trove-3-restored`

Do not treat older folders such as `canopy-trove-3`, `canopy-trove-3-temp`, `canopy-trove-2`, or backup extracts as the main app anymore.

## Canonical Phone Build Path

Build from this folder:

```powershell
cd "C:\Users\eleve\Documents\New project\canopy-trove-3-restored"
eas build --platform android --profile preview
```

The `preview` profile is the current canonical install/test build for phone QA.

Why:

- it no longer depends on the dead LAN API URL from local `.env`
- it is configured in `eas.json` to use the storefront recovery path that works on-device
- it is the path that successfully built again after the recovery work

## Canonical Setup Rules

Use these rules going forward:

1. Build the installable phone app from `canopy-trove-3-restored`.
2. Use `preview` for testing on a real phone.
3. Do not rely on the local LAN API URL for preview builds.
4. Keep `eas.json`, `app.json`, and the recovery docs in sync when changing build behavior.
5. Treat this file and `docs/RECOVERY_CHECKLIST.md` as the source of truth after any major fix.
6. Treat `CURRENT_MERGE_SUMMARY.md` as the first handoff and merge document.
7. Before any public release attempt, run `npm run release:check`.
8. Use `.env.production.example` and `backend/.env.production.example` as the canonical production env templates.

## Exact Recovered Features In This Baseline

- Product naming cleaned to `Canopy Trove`.
- Profile flow recovered and repaired.
- Report storefront flow recovered and repaired.
- Review flow recovered and repaired, including recovered review-composer work.
- Age gate restored.
- Post-visit prompt and notification flow rebuilt.
- Visit tracking and follow-up reminder logic rebuilt.
- Storefront detail fallback repaired so website, phone, hours, and open/closed state can recover on-device.
- Storefront detail badge repaired to show `Open Now` / `Closed` / `Checking`.
- Storefront cards repaired to show `Open Now` / `Closed`.
- Ratings now stay in a waiting state until a storefront reaches the public threshold.
- Favorite-store deal alerts now exist in both the local app path and the backend API path.
- Backend favorite-deal alerts now support Expo push-token delivery and a dispatch command.
- The bottom toolbar top highlight line was removed.
- Placeholder seed hours are now normalized so the app no longer claims fake hours are live published hours.
- `preview` EAS build path repaired so the phone build no longer depends on the broken local API path.
- The paid dispensary-owner section now has a safe preview entry so pages can be reviewed without live owner auth or writes.
- The live owner portal surface now reads like a finished owner workspace while the guided demo stays separate for review and testing.
- Owner preview now includes timed hot-deal badge editing that updates storefront cards across the app in this build.
- Owner preview now also includes a separate temporary override lab for opening any preview storefront card or applying one test deal to every preview card without replacing the original editor.
- Browse and Nearby now reset their scroll position on focus to avoid the stuck bottom-state tab bug.
- The launcher icon assets were regenerated with a larger crop so the logo reads bigger in installed builds.
- The small in-app location and travel icons now use a tight-cropped Canopy Trove brand mark instead of the generic pin glyph.
- `Go Now` buttons now use arrow icons again.
- Owner preview deal editors now support custom durations up to 720 hours.
- Post-visit follow-up now runs as a foreground-only arrival prompt instead of a background location / leave-area system.
- The app now includes an in-app legal center, account deletion flow, community-guidelines acceptance gate, and local author-blocking controls.
- The backend now includes secured admin-review endpoints for owner claims, owner verification, and storefront reports.
- The owner billing flow now supports hosted Stripe checkout, Stripe webhook syncing, and billing-portal sessions when production env is configured.
- Owner promotions now support paid priority placement across Nearby, Browse, and Hot Deals with either storefront-area or statewide boosting.
- The owner dashboard now includes a full premium ROI funnel with impressions, opens, followers, reviews, route starts, website taps, menu taps, phone taps, conversion rates, and a top-promotion summary.
- Owner promotion results now show per-offer website taps, menu taps, phone taps, action rate, and tracked action totals in addition to CTR.
- The owner guided demo is now controlled by `EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED`, with `preview` builds on and `production` builds off.
- The iOS release identity is now `com.rezell.canopytrove`, and the app also declares the `canopytrove` URL scheme.
- The legal center now reads public legal/support URLs from one env-driven config and shows a release-status card so missing store-submission links are visible inside the app.
- Owner billing now reads readiness from shared app/backend config helpers and surfaces missing env names directly when Stripe or public checkout setup is incomplete.
- Account deletion now reports partial-vs-complete removal clearly and signs the user out if login removal still requires a recent sign-in.
- Admin review now reports missing setup requirements directly instead of failing as a generic backend error.
- Real-device release validation now also lives in `docs/PHONE_QA_CHECKLIST.md`.
- Release-memory docs now include privacy policy, terms, community guidelines, admin review workflow, store metadata, and production release setup.

## Critical Files That Define This Working State

- `README.md`
- `eas.json`
- `app.json`
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
- `docs/PHONE_QA_CHECKLIST.md`
- `src/config/legal.ts`
- `src/config/ownerBilling.ts`
- `src/screens/LegalCenterScreen.tsx`
- `src/screens/DeleteAccountScreen.tsx`
- `src/services/accountDeletionSummary.ts`
- `src/services/postVisitPromptService.ts`
- `src/services/postVisitNotificationService.ts`
- `src/components/FavoriteDealNotificationBridge.tsx`
- `src/services/favoriteDealNotificationService.ts`
- `src/services/storefrontOperationalDataService.ts`
- `src/utils/storefrontRatings.ts`
- `src/utils/favoriteDealAlerts.ts`
- `src/utils/storefrontHours.ts`
- `src/screens/storefrontDetail/useStorefrontDetailDerivedState.ts`
- `src/screens/ownerPortal/ownerPortalPreviewData.ts`
- `src/screens/ownerPortal/OwnerPortalDealBadgeEditor.tsx`
- `src/screens/ownerPortal/OwnerPortalDealOverridePanel.tsx`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`
- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/storefrontDetail/useStorefrontDetailActions.ts`
- `src/utils/ownerPromotionPlacement.ts`
- `backend/src/routes/favoriteDealAlertRoutes.ts`
- `backend/src/services/favoriteDealAlertService.ts`
- `backend/src/services/expoPushService.ts`
- `backend/src/scripts/dispatchFavoriteDealAlerts.ts`
- `backend/src/services/ownerBillingService.ts`
- `backend/src/config.ts`
- `backend/src/services/adminReviewService.ts`
- `backend/src/routes/adminRoutes.ts`
- `backend/src/routes/ownerBillingRoutes.ts`
- `backend/src/services/analyticsEventService.ts`
- `backend/src/services/ownerPortalWorkspaceService.ts`
- `src/services/storefrontPromotionOverrideService.ts`
- `src/utils/storefrontPromotions.ts`
- `src/icons/BrandMarkIcon.tsx`
- `src/services/postVisitPromptService.ts`
- `docs/FAVORITE_DEAL_ALERTS.md`

## Minimum Backup To Save Off This Computer

Copy these items somewhere else:

1. The entire folder:
   `C:\Users\eleve\Documents\New project\canopy-trove-3-restored`
2. This file:
   `C:\Users\eleve\Documents\New project\canopy-trove-3-restored\MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md`
3. If you want the exact local environment too, also copy:
   `C:\Users\eleve\Documents\New project\canopy-trove-3-restored\.env`
4. If backend environment values matter for later recovery, also copy:
   `C:\Users\eleve\Documents\New project\canopy-trove-3-restored\backend\.env`

## Restore Notes

If this app ever has to be recovered again, start here first:

1. Restore `canopy-trove-3-restored`.
2. Read `CURRENT_MERGE_SUMMARY.md`.
3. Read this file.
4. Read `docs/RECOVERY_CHECKLIST.md`.
5. Read `docs/FAVORITE_DEAL_ALERTS.md`.
6. Read `docs/OWNER_PORTAL_PREVIEW.md`.
7. Read `docs/OWNER_PORTAL_READINESS.md`.
8. Read `docs/RELEASE_READINESS.md`.
9. Read `docs/PRODUCTION_RELEASE_SETUP.md`.
10. Build `preview`.
11. Verify storefront detail hours, website, open/closed state, ratings waiting state, favorite deal alerts, owner demo entry, legal center, and account deletion entry on phone.

## Verification Status At Time Of Writing

- Root TypeScript passed.
- Backend TypeScript passed.
- Android compile passed during recovery.
- `preview` build path was repaired and validated.
