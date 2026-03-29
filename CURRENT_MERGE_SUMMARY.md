# Canopy Trove Current Merge Summary

Updated: March 29, 2026

This is the top lead file for the current Canopy Trove working state.

If you come back later, start here first, then use the current recovery thread as the live running context behind this file.

## Working Goal

Bring `canopy-trove-3-restored` back to a stable, premium-feeling Canopy Trove product with:

- a working customer app
- a working owner portal
- live owner billing and promotion flows
- release-readiness documentation
- durable recovery memory so the project can survive another crash

## Main Decisions

- The canonical working repo is `canopy-trove-3-restored`.
- `Canopy Trove` is the product name across the app surface.
- The active rename workstream now uses `docs/CANOPY_TROVE_REBRAND_HANDOFF.md` as the source of truth for the `Canopy Trove` -> `Canopy Trove` rebrand split and logging.
- The canonical phone build path is:

```powershell
cd "C:\Users\eleve\Documents\New project\canopy-trove-3-restored"
eas build --platform android --profile preview
```

- `preview` is the primary install/test build for phone QA.
- Storefront detail rendering was repaired to recover critical data on-device instead of depending on the dead local LAN backend path.
- Post-visit reminders were shifted to a foreground-only flow instead of background location tracking.
- Owner pricing is set at `$79/month` and `$790/year`.
- Owner promotions now support paid priority placement across `Nearby`, `Browse`, and `Hot Deals`.
- Owner analytics now track visibility and action, not just surface-level promotion CTR.
- Owner demo access is now explicitly build-gated so it stays available in preview builds and off in production builds.
- Legal and support URLs now flow through one central config, and the in-app legal center shows whether the required public store-review links are actually configured.
- Owner billing readiness now reports exact missing public or backend env vars instead of only generic "not configured" failures.
- Account deletion now distinguishes between full deletion and partial deletion when login removal still needs a recent sign-in.
- Admin review readiness now reports exact missing setup requirements instead of generic backend failures.
- A strict phone QA checklist now exists for repeatable launch validation.
- Recovery memory is now part of the product workflow and must be kept current whenever major fixes land.

## Major Areas Completed

- Recovery baseline restored and stabilized
- Product rename cleaned to `Canopy Trove`
- Preview builds repaired and verified again
- Storefront hours / website / open-closed logic repaired
- Ratings threshold and report flow clarified
- Favorite-store deal alerts added on app and backend paths
- Owner portal polished into a production-facing workspace
- Owner billing wired to Stripe sandbox flow
- Release-readiness and legal/compliance docs added
- Priority placement for owner deals implemented
- Owner ROI dashboard expanded with attribution metrics
- Premium customer-facing visual polish pass applied across shared chrome, browse discovery, storefront cards, and profile surfaces
- Premium owner-portal visual polish pass applied across owner home, promotions, review inbox, subscription, and profile tools
- Owner-portal hierarchy refinement pass applied with clearer planner sections, calmer empty states, stronger CTA framing, and faster analytics scanability
- Premium storefront-detail visual polish pass applied across detail hero, operational/info sections, community reviews, write-review flow, and report flow
- Premium owner access and onboarding visual polish pass applied across owner entry, auth, claim, and verification screens
- Premium customer entry-flow visual polish pass applied across member auth, age gate, and app boot surfaces
- Premium motion, transition, and haptics polish pass applied across shared customer chrome and navigation timing
- Premium loading, empty-state, and error-state polish pass applied across shared customer state surfaces and support flows
- Premium owner analytics visualization polish pass applied across owner ROI, offer performance, and review-inbox health surfaces
- Production gating added for owner demo/preview flows
- Legal-center release wiring hardened with live URL-status visibility and delete-account support paths
- Owner-billing release wiring hardened with explicit app/backend env readiness checks
- Account-deletion flow hardened with explicit partial-delete messaging and sign-out fallback
- Admin-review route readiness hardened with explicit missing-setup errors
- Real-device phone QA checklist added for pass/fail release validation
- App-side and backend-side release-check commands added for named production blocker validation
- Production env template files added for app and backend release setup
- Public legal, support, and account-deletion pages published both on `canopytrove.com` through an earlier Netlify wrapper deploy and on a separate standalone static Netlify site that now includes a branded Canopy Trove homepage
- Expo SDK dependency drift was corrected again by aligning `react-native` to `0.83.4`, and `expo doctor` is back to `17/17` passing

## Thread 2 Status

Thread `2` completed the owner-portal premium polish pass on:

- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalReviewInboxScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`
- `src/screens/OwnerPortalProfileToolsScreen.tsx`
- `src/screens/ownerPortal/ownerPortalStyles.ts`

That pass already improved:

- owner dashboard hierarchy
- promotion planner readability
- review-inbox prioritization
- subscription-screen premium framing
- profile-tools card rhythm and spacing

Thread `2` then completed the storefront-detail premium polish pass on:

- `src/screens/storefrontDetail/StorefrontDetailHeroSections.tsx`
- `src/screens/storefrontDetail/StorefrontDetailCommunitySections.tsx`
- `src/screens/storefrontDetail/StorefrontDetailInfoSections.tsx`
- `src/screens/storefrontDetail/storefrontDetailStyles.ts`
- `src/screens/WriteReviewScreen.tsx`
- `src/screens/writeReview/writeReviewStyles.ts`
- `src/screens/ReportStorefrontScreen.tsx`

That storefront-detail pass improved:

- detail-hero hierarchy and premium summary framing
- hours / website / rating readability
- review-card rhythm and reply presentation
- write-review CTA clarity and readiness framing
- report-flow calmness and moderation clarity
- empty states and premium card feel across storefront-detail surfaces

Thread `2` then completed the owner access and onboarding premium polish pass on:

- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalSignInScreen.tsx`
- `src/screens/OwnerPortalSignUpScreen.tsx`
- `src/screens/OwnerPortalForgotPasswordScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/ownerPortal/ownerPortalStyles.ts`

That owner-access/onboarding pass improved:

- owner access hierarchy and premium entry framing
- sign-in / sign-up / forgot-password CTA emphasis
- onboarding step rhythm across business details and claim listing
- business / identity verification clarity and document-card feel
- calmer helper states, empty states, and onboarding submit framing

Thread `2` then completed the customer entry-flow premium polish pass on:

- `src/screens/CanopyTroveSignInScreen.tsx`
- `src/screens/CanopyTroveSignUpScreen.tsx`
- `src/screens/CanopyTroveForgotPasswordScreen.tsx`
- `src/screens/AgeGateScreen.tsx`
- `src/components/AppBootScreen.tsx`
- `src/components/appBoot/AppBootSections.tsx`
- `src/components/appBoot/appBootStyles.ts`
- `src/screens/customerEntry/customerEntryStyles.ts`

That customer-entry pass improved:

- member sign-in / sign-up premium framing
- forgot-password clarity and calmer helper states
- age-gate hierarchy and trust signals
- app boot / entry feel and loading composition
- CTA rhythm across customer entry surfaces

Thread `2` then completed the premium motion, transition, and haptics polish pass on:

- `src/theme/tokens.ts`
- `src/components/HapticPressable.tsx`
- `src/components/MotionInView.tsx`
- `src/components/ScreenShell.tsx`
- `src/components/CanopyTroveTabBar.tsx`
- `src/navigation/RootNavigator.tsx`
- `src/navigation/rootNavigatorConfig.tsx`

That shared-motion pass improved:

- page-transition feel across customer stack and tab navigation
- section reveal timing and loading-to-content rhythm
- tab interaction polish with subtler focus animation and entry motion
- shared chrome haptics on repeated customer interactions
- motion consistency while keeping transitions fast and non-blocking

Thread `2` then completed the premium loading, empty-state, and error-state polish pass on:

- `src/components/CustomerStateCard.tsx`
- `src/components/GifPickerModal.tsx`
- `src/screens/browse/BrowseSections.tsx`
- `src/screens/nearby/NearbySections.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileStorefrontList.tsx`
- `src/screens/storefrontDetail/StorefrontDetailHeroSections.tsx`
- `src/screens/storefrontDetail/StorefrontDetailInfoSections.tsx`
- `src/screens/storefrontDetail/StorefrontDetailCommunitySections.tsx`
- `src/screens/WriteReviewScreen.tsx`
- `src/screens/ReportStorefrontScreen.tsx`
- `src/screens/LegalCenterScreen.tsx`
- `src/screens/DeleteAccountScreen.tsx`
- `src/screens/customerSupport/customerSupportStyles.ts`

That customer-state pass improved:

- clearer, calmer empty and unavailable messaging across Browse and Nearby
- more premium loading and collection-empty states on Profile
- better storefront-detail fallback, loading, and no-review framing
- stronger review/report error and fallback reassurance
- cleaner legal-center and delete-account support-state presentation

Thread `2` then completed the premium owner analytics visualization polish pass on:

- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/OwnerPortalReviewInboxScreen.tsx`
- `src/screens/ownerPortal/OwnerPortalAnalyticsCard.tsx`
- `src/screens/ownerPortal/ownerPortalStyles.ts`

That analytics pass improved:

- owner ROI hierarchy and premium KPI storytelling
- promotion performance comparison cards and top-offer spotlight
- review-inbox health scanability and premium summary visualization
- paid-side analytics emphasis without changing logic
- shared owner metric-card presentation for future owner analytics surfaces

Thread `2` is now clear for the next non-overlapping UI task.

Most recent analytics-focused files for thread `2`:

- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/OwnerPortalReviewInboxScreen.tsx`
- `src/screens/ownerPortal/OwnerPortalAnalyticsCard.tsx`
- `src/screens/ownerPortal/ownerPortalStyles.ts`

Thread `2` should not touch:

- backend files
- billing logic
- analytics logic
- legal / release docs
- `app.json`
- `eas.json`
- owner-portal files
- production config

Until redirected, thread `2` should stay scoped to:

- UI / polish implementation
- short handoff updates to this file
- no backend or release-work ownership

Thread `2` should not touch:

- backend files
- billing logic
- analytics logic
- legal / release docs
- `app.json`
- `eas.json`
- production config
- release-gating logic

## Files Changed

The repo has broad project-wide changes. The highest-signal files controlling the current merged state are:

### Root And Build

- `README.md`
- `MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md`
- `CURRENT_MERGE_SUMMARY.md`
- `app.json`
- `eas.json`
- `package.json`
- `.env.production.example`
- `backend/package.json`
- `backend/.env.production.example`

### Recovery / Release Memory

- `docs/RECOVERY_CHECKLIST.md`
- `docs/OWNER_PORTAL_PREVIEW.md`
- `docs/OWNER_PORTAL_READINESS.md`
- `docs/RELEASE_READINESS.md`
- `docs/PRODUCTION_RELEASE_SETUP.md`
- `docs/ADMIN_REVIEW_WORKFLOW.md`
- `docs/FAVORITE_DEAL_ALERTS.md`
- `docs/PRIVACY_POLICY.md`
- `docs/TERMS_OF_USE.md`
- `docs/COMMUNITY_GUIDELINES.md`
- `docs/SUPPORT.md`
- `docs/ACCOUNT_DELETION_HELP.md`
- `docs/STORE_METADATA.md`
- `docs/PHONE_QA_CHECKLIST.md`

### Public Release Pages

- `netlify.toml`
- `public-release-pages/_redirects`
- `public-release-pages/index.html`
- `public-release-pages/netlify.toml`
- `public-release-pages/styles.css`
- `public-release-pages/favicon.png`
- `public-release-pages/media/logo-mark-tight.png`
- `public-release-pages/media/logo-master-cutout.png`
- `public-release-pages/privacy/index.html`
- `public-release-pages/terms/index.html`
- `public-release-pages/community-guidelines/index.html`
- `public-release-pages/support/index.html`
- `public-release-pages/account-deletion/index.html`

### Customer App

- `App.tsx`
- `src/theme/tokens.ts`
- `src/components/HapticPressable.tsx`
- `src/components/MotionInView.tsx`
- `src/components/ScreenShell.tsx`
- `src/components/SectionCard.tsx`
- `src/components/CustomerStateCard.tsx`
- `src/components/CanopyTroveTabBar.tsx`
- `src/components/AppBootScreen.tsx`
- `src/components/appBoot/AppBootSections.tsx`
- `src/components/appBoot/appBootStyles.ts`
- `src/components/SearchField.tsx`
- `src/components/GifPickerModal.tsx`
- `src/components/BrowseFiltersBar.tsx`
- `src/components/AppIconStatCard.tsx`
- `src/components/FavoriteDealNotificationBridge.tsx`
- `src/components/PostVisitPromptHost.tsx`
- `src/components/storefrontRouteCard/StorefrontRouteCardSections.tsx`
- `src/components/storefrontRouteCard/storefrontRouteCardStyles.ts`
- `src/screens/NearbyScreen.tsx`
- `src/screens/BrowseScreen.tsx`
- `src/screens/browse/BrowseSections.tsx`
- `src/screens/browse/browseStyles.ts`
- `src/screens/nearby/NearbySections.tsx`
- `src/screens/ProfileScreen.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`
- `src/screens/profile/profileStyles.ts`
- `src/screens/profile/ProfileStorefrontList.tsx`
- `src/screens/CanopyTroveSignInScreen.tsx`
- `src/screens/CanopyTroveSignUpScreen.tsx`
- `src/screens/CanopyTroveForgotPasswordScreen.tsx`
- `src/screens/AgeGateScreen.tsx`
- `src/screens/customerEntry/customerEntryStyles.ts`
- `src/screens/WriteReviewScreen.tsx`
- `src/screens/writeReview/writeReviewStyles.ts`
- `src/screens/ReportStorefrontScreen.tsx`
- `src/screens/storefrontDetail/StorefrontDetailHeroSections.tsx`
- `src/screens/storefrontDetail/StorefrontDetailCommunitySections.tsx`
- `src/screens/storefrontDetail/StorefrontDetailInfoSections.tsx`
- `src/screens/storefrontDetail/storefrontDetailStyles.ts`
- `src/screens/storefrontDetail/useStorefrontDetailActions.ts`
- `src/screens/storefrontDetail/useStorefrontDetailDerivedState.ts`
- `src/services/analyticsService.ts`
- `src/services/storefrontOperationalDataService.ts`
- `src/services/postVisitPromptService.ts`
- `src/services/favoriteDealNotificationService.ts`
- `src/config/legal.ts`
- `src/config/ownerBilling.ts`
- `src/navigation/RootNavigator.tsx`
- `src/navigation/rootNavigatorConfig.tsx`
- `src/screens/LegalCenterScreen.tsx`
- `src/screens/DeleteAccountScreen.tsx`
- `src/screens/customerSupport/customerSupportStyles.ts`
- `src/services/accountDeletionSummary.ts`

### Owner Portal

- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`
- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/OwnerPortalReviewInboxScreen.tsx`
- `src/screens/OwnerPortalProfileToolsScreen.tsx`
- `src/screens/ownerPortal/OwnerPortalAnalyticsCard.tsx`
- `src/screens/OwnerPortalSignInScreen.tsx`
- `src/screens/OwnerPortalSignUpScreen.tsx`
- `src/screens/OwnerPortalForgotPasswordScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/ownerPortal/ownerPortalStyles.ts`
- `src/screens/ownerPortal/ownerPortalPreviewData.ts`
- `src/screens/ownerPortal/OwnerPortalDealBadgeEditor.tsx`
- `src/screens/ownerPortal/OwnerPortalDealOverridePanel.tsx`
- `src/services/ownerPortalWorkspaceService.ts`
- `src/types/ownerPortal.ts`
- `src/utils/ownerPromotionPlacement.ts`

### Backend

- `backend/src/routes/ownerPortalWorkspaceRoutes.ts`
- `backend/src/routes/ownerBillingRoutes.ts`
- `backend/src/routes/favoriteDealAlertRoutes.ts`
- `backend/src/routes/adminRoutes.ts`
- `backend/src/services/analyticsEventService.ts`
- `backend/src/services/ownerPortalWorkspaceService.ts`
- `backend/src/services/ownerBillingService.ts`
- `backend/src/services/adminReviewService.ts`
- `backend/src/routes/adminRoutes.ts`
- `backend/src/config.ts`
- `backend/src/services/favoriteDealAlertService.ts`
- `backend/src/services/expoPushService.ts`
- `backend/src/services/storefrontService.ts`

## Commands Run

The main verification and operational commands used in this merged state were:

```powershell
npm run check:all
npm run release:check
npm --prefix backend run release:check
npm test -- src/repositories/storefrontRepository.test.ts src/utils/ownerPromotionPlacement.test.ts src/utils/storefrontRatings.test.ts src/utils/favoriteDealAlerts.test.ts
npm --prefix backend run test
eas build --platform android --profile preview
& .\node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit
git -C "C:\Users\eleve\Documents\New project\canopy-trove-3-restored" status --short
```

## Verification Status

- Root TypeScript: passing
- Backend TypeScript: passing
- Frontend tests used in recent merge checks: passing
- Backend tests: passing
- Preview Android build path: working
- Phone install: working enough for active QA
- Premium customer UI polish pass: root TypeScript passing after shared customer-surface visual updates
- Premium owner portal UI polish pass: root TypeScript passing after owner-only visual updates
- Owner portal hierarchy refinement pass: root TypeScript passing after second-pass visual hierarchy updates
- Premium storefront-detail UI polish pass: root TypeScript passing after detail-surface visual updates
- Premium owner access/onboarding UI polish pass: root TypeScript passing after auth and verification-surface visual updates
- Premium customer entry-flow UI polish pass: root TypeScript passing after auth, age-gate, and app-boot visual updates
- Premium motion / transition / haptics polish pass: root TypeScript passing after shared reveal, navigation, and tab-interaction timing updates
- Premium customer loading / empty / error-state polish pass: root TypeScript passing after shared state-card and support-state visual updates
- Premium owner analytics visualization polish pass: root TypeScript passing after shared owner analytics-card and KPI layout updates
- Netlify public release pages deploy: live `canopytrove.com` legal/support routes returning `200` while `/` still returns the existing `Canopy Trove` homepage title through the wrapper proxy
- Standalone Netlify Canopy Trove website deploy: live `https://resonant-monstera-02c25.netlify.app/` now serves a branded homepage plus `/privacy`, `/terms`, `/community-guidelines`, `/support`, and `/account-deletion`, all returning `200`
- Standalone website homepage copy was republished successfully on March 29, 2026 after switching the deploy source to `public-release-pages/` with its own local Netlify config

## Open Issues

### Product / QA

- More real-phone QA is still needed on storefront hours, open-closed badges, route launch behavior, billing flow, and promotion boost visibility.
- More real-phone QA is still needed on the refreshed owner home, promotions, review inbox, subscription, and profile tools surfaces.
- Owner analytics are built as aggregated dashboard metrics, not a raw live event feed.

### Release

- Public release compliance still needs final hardening.
- Public legal/support pages are now hosted at:
  - `https://canopytrove.com/privacy`
  - `https://canopytrove.com/terms`
  - `https://canopytrove.com/community-guidelines`
  - `https://canopytrove.com/support`
  - `https://canopytrove.com/account-deletion`
- A separate plain static website is also live at:
  - `https://resonant-monstera-02c25.netlify.app/`
  - `https://resonant-monstera-02c25.netlify.app/privacy`
  - `https://resonant-monstera-02c25.netlify.app/terms`
  - `https://resonant-monstera-02c25.netlify.app/community-guidelines`
  - `https://resonant-monstera-02c25.netlify.app/support`
  - `https://resonant-monstera-02c25.netlify.app/account-deletion`
- That separate site is no longer just a release-pages index. It now serves a branded Canopy Trove website homepage with product, owner, trust, support, and legal sections.
- App-side public env values still need to be wired to those hosted URLs outside the repo before store release.
- Owner preview/demo is now build-gated, but public production builds still need to be verified after that gating is applied.
- Store metadata and final listing assets still need a final launch pass.
- `npm run release:check` now names the current release blockers directly.
- Current app-side blockers include the missing public API base URL and any still-unset public legal/support env wiring.
- Current backend-side blockers include `CORS_ORIGIN=*`, missing `EXPO_ACCESS_TOKEN`, missing `ADMIN_API_KEY`, and incomplete live Stripe backend env.
- The `production` EAS profile now explicitly locks app release posture to `EXPO_PUBLIC_STOREFRONT_SOURCE=api`, `EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED=true`, and `EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED=false`.

### Backend / Production Setup

- Live Stripe production keys, prices, webhook config, and return URLs still need to be configured on the hosted backend.
- Google Maps key hardening is still not complete.
- Some live owner behavior depends on the app using the hosted API/backend, not preview/demo paths.

### Tooling

- Netlify tooling status has been inconsistent across threads and should not be treated as part of the current phone-merge workflow.
- Thread `2` should avoid deploy or web-surface tooling unless the user explicitly redirects it there.
- The separate static site deploy was recovered by publishing from `public-release-pages/` directly after repo-root MCP upload handoffs started failing.

## Read Order

If you need to recover or merge again, use this order:

1. `CURRENT_MERGE_SUMMARY.md`
2. the current Canopy Trove recovery thread
3. `MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md`
4. `docs/RECOVERY_CHECKLIST.md`
5. `docs/OWNER_PORTAL_READINESS.md`
6. `docs/RELEASE_READINESS.md`

## Rule Going Forward

After any major feature, recovery step, release step, or infrastructure change:

- update this file
- update `MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md` if the canonical path/process changed
- update `docs/RECOVERY_CHECKLIST.md` if the project state changed

