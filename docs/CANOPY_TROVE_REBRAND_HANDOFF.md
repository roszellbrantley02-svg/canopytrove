# Canopy Trove Rebrand Handoff

Updated: March 29, 2026

This file is the source of truth for the `Canopy Trove` -> `Canopy Trove` rebrand.

Use this file to prevent overlap, broken copy changes, and mixed-brand commits.

## Locked Brand Decisions

- New product name: `Canopy Trove`
- Owner-facing name: `Canopy Trove for Owners`
- Primary icon direction: `Canopy Arc`
- Core tagline: `Where legal cannabis feels chosen.`
- App subtitle direction: `Dispensaries, deals, reviews`

## Coordination Rules

- Main thread and thread `2` must not edit the same files in the same pass.
- Every completed pass must be logged in the `Change Log` section before handoff.
- Public-facing rename work comes before deep internal file/class rename work.
- Do not rename native package identifiers yet unless explicitly planned as a separate pass.

## Ownership Split

### Main Thread Ownership

Main thread owns the app-facing brand layer and asset wiring:

- `app.json`
- `eas.json`
- `src/config/brand.ts`
- visible app-surface copy inside `src/**`
- app icon / splash integration under `assets/**`
- user-facing brand strings in app config and release env templates

Main thread should avoid touching:

- `public-release-pages/**`
- store-listing copy docs assigned to thread `2`

### Thread 2 Ownership

Thread `2` owns the public-site and marketing/docs rebrand lane:

- `public-release-pages/index.html`
- `public-release-pages/styles.css`
- `public-release-pages/privacy/index.html`
- `public-release-pages/terms/index.html`
- `public-release-pages/community-guidelines/index.html`
- `public-release-pages/support/index.html`
- `public-release-pages/account-deletion/index.html`
- `docs/STORE_METADATA.md`
- `README.md`

Thread `2` should avoid touching:

- `src/**`
- `assets/icon*`
- `assets/android-icon*`
- `assets/ios-icon*`
- `assets/splash-icon*`
- `app.json`
- `eas.json`
- `backend/**`
- `CURRENT_MERGE_SUMMARY.md`
- release-check scripts or env wiring

## Start Points

### Main Thread Starts Here

- update [brand.ts](/Users/eleve/Documents/New%20project/canopy-trove-3-restored/src/config/brand.ts)
- update [app.json](/Users/eleve/Documents/New%20project/canopy-trove-3-restored/app.json)
- decide how `Canopy Arc` maps into app icon and splash assets
- replace the highest-visibility `Canopy Trove` strings in app UI first

### Thread 2 Starts Here

- rewrite the public homepage in [index.html](/Users/eleve/Documents/New%20project/canopy-trove-3-restored/public-release-pages/index.html)
- align public legal/support pages to `Canopy Trove`
- rewrite store-metadata/marketing copy in [STORE_METADATA.md](/Users/eleve/Documents/New%20project/canopy-trove-3-restored/docs/STORE_METADATA.md)
- update [README.md](/Users/eleve/Documents/New%20project/canopy-trove-3-restored/README.md) brand references only

## Thread 2 Prompt

```text
Work only in C:\Users\eleve\Documents\New project\canopy-trove-3-restored.

We are now rebranding Canopy Trove to Canopy Trove. Your lane is public-site and marketing/docs copy only.

Own only:
- public-release-pages/index.html
- public-release-pages/styles.css
- public-release-pages/privacy/index.html
- public-release-pages/terms/index.html
- public-release-pages/community-guidelines/index.html
- public-release-pages/support/index.html
- public-release-pages/account-deletion/index.html
- docs/STORE_METADATA.md
- README.md

Do not touch:
- src/**
- assets app icon files
- app.json
- eas.json
- backend/**
- CURRENT_MERGE_SUMMARY.md
- release env or release-check scripts

Brand rules:
- New name: Canopy Trove
- Tagline direction: Where legal cannabis feels chosen.
- Tone: trusted, elevated, welcoming, slightly celebratory
- Avoid route/map language, delivery-app language, weed clichés, and cold luxury tone

When finished, append a short file summary to docs/CANOPY_TROVE_REBRAND_HANDOFF.md under Change Log.
```

## Change Log

### 2026-03-29 - Setup

- Created this handoff file to coordinate the rebrand safely.
- Locked `Canopy Trove` as the working rebrand target.
- Locked `Canopy Arc` as the primary icon direction.
- Created brand assets and concept files:
  - `assets/brand/canopy-trove/canopy-arc.svg`
  - `assets/brand/canopy-trove/shelter-mark.svg`
  - `assets/brand/canopy-trove/crest-icon.svg`
  - `docs/CANOPY_TROVE_BRAND_PACKAGE.md`
  - `docs/brand-canopy-trove-moodboard.html`
  - `docs/brand-canopy-trove-presentation.html`

### 2026-03-29 - Thread 2 Public Site And Docs Copy Pass

- Owner: `thread 2`
- Files changed:
  - `public-release-pages/index.html`
  - `public-release-pages/styles.css`
  - `public-release-pages/privacy/index.html`
  - `public-release-pages/terms/index.html`
  - `public-release-pages/community-guidelines/index.html`
  - `public-release-pages/support/index.html`
  - `public-release-pages/account-deletion/index.html`
  - `docs/STORE_METADATA.md`
  - `README.md`
- Summary:
  - Rebranded the public homepage and legal/support pages from `Canopy Trove` to `Canopy Trove`.
  - Rewrote the homepage around the new tagline direction, a warmer public tone, and copy that avoids route/map and delivery-app framing.
  - Updated store-metadata and README brand references to `Canopy Trove` without changing technical paths or package identifiers.
  - Warmed the shared public-site styling to better fit the new brand tone.
- Verification:
  - Audited the owned files for leftover `Canopy Trove` copy and reduced remaining hits to expected domains, canonical URLs, package identifiers, and file-path references only.

### 2026-03-29 - Main Thread App Rebrand Pass

- Owner: `main thread`
- Files changed:
  - `app.json`
  - `src/config/brand.ts`
  - `src/config/legal.ts`
  - `src/components/appBoot/AppBootSections.tsx`
  - `src/components/GifPickerModal.tsx`
  - `src/components/PostVisitPromptHost.tsx`
  - `src/screens/AgeGateScreen.tsx`
  - `src/screens/DeleteAccountScreen.tsx`
  - `src/screens/CanopyTroveSignInScreen.tsx`
  - `src/screens/CanopyTroveSignUpScreen.tsx`
  - `src/screens/CanopyTroveForgotPasswordScreen.tsx`
  - `src/screens/LegalCenterScreen.tsx`
  - `src/screens/NearbyScreen.tsx`
  - `src/screens/nearby/NearbySections.tsx`
  - `src/screens/LeaderboardScreen.tsx`
  - `src/screens/leaderboard/LeaderboardSections.tsx`
  - `src/screens/profile/ProfileBadgeSections.tsx`
  - `src/screens/profile/ProfileDataSections.tsx`
  - `src/screens/profile/profileUtils.ts`
  - `src/screens/storefrontDetail/StorefrontDetailCommunitySections.tsx`
  - `src/screens/storefrontDetail/StorefrontDetailHeroSections.tsx`
  - `src/screens/storefrontDetail/StorefrontDetailInfoSections.tsx`
  - `src/screens/storefrontDetail/useStorefrontDetailDerivedState.ts`
  - `src/screens/WriteReviewScreen.tsx`
  - `src/screens/writeReview/useWriteReviewScreenModel.ts`
  - `src/screens/ReportStorefrontScreen.tsx`
  - `src/screens/OwnerPortalAccessScreen.tsx`
  - `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
  - `src/screens/OwnerPortalClaimListingScreen.tsx`
  - `src/screens/OwnerPortalHomeScreen.tsx`
  - `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
  - `src/screens/OwnerPortalProfileToolsScreen.tsx`
  - `src/screens/OwnerPortalReviewInboxScreen.tsx`
  - `src/screens/ownerPortal/ownerPortalHomeShared.ts`
  - `src/screens/ownerPortal/ownerPortalPreviewData.ts`
  - `src/context/useStorefrontControllerProviderModel.ts`
  - `src/services/accountDeletionSummary.ts`
  - `src/services/accountDeletionSummary.test.ts`
  - `src/services/postVisitNotificationService.ts`
  - `src/services/storefrontCommunityLocalService.ts`
  - `src/adapters/firestoreDocumentAdapter.ts`
  - `backend/src/routes/communityRoutes.ts`
  - `backend/src/services/storefrontCommunityService.ts`
- Summary:
  - Rebranded the highest-visibility app copy from `Canopy Trove` to `Canopy Trove` across auth, legal, nearby, profile, storefront detail, report, review, leaderboard, and owner portal screens.
  - Updated Expo display metadata to `Canopy Trove` while intentionally keeping the existing slug, scheme, package identifiers, and storage namespace stable for this pass.
  - Rebranded user-visible fallback author names and post-visit notification copy in both app and backend community flows.
  - Updated preview/demo owner content and static preview contact values to the new brand.
- Verification:
  - `npm run check:all`

### 2026-03-29 - Thread 2 Launch Copy And Public Page Polish Pass

- Owner: `thread 2`
- Files changed:
  - `public-release-pages/index.html`
  - `public-release-pages/styles.css`
  - `public-release-pages/privacy/index.html`
  - `public-release-pages/terms/index.html`
  - `public-release-pages/community-guidelines/index.html`
  - `public-release-pages/support/index.html`
  - `public-release-pages/account-deletion/index.html`
  - `docs/STORE_METADATA.md`
  - `docs/CANOPY_TROVE_LAUNCH_CHECKLIST.md`
  - `README.md`
- Summary:
  - Finalized launch-facing store copy, support URLs, and public-site titles for the Canopy Trove rebrand.
  - Tightened homepage hero and CTA language so the public site reads like a launch-ready release surface instead of a placeholder.
  - Added a dedicated Canopy Trove launch checklist covering public-site readiness, store copy readiness, and remaining blockers.
- Verification:
  - Copy-only and static-doc pass; no app runtime, backend, config, or release-check files were touched.

### 2026-03-29 - Thread 2 Final Public QA And Screenshot Brief Pass

- Owner: `thread 2`
- Files changed:
  - `public-release-pages/index.html`
  - `public-release-pages/privacy/index.html`
  - `docs/STORE_METADATA.md`
  - `README.md`
  - `docs/CANOPY_TROVE_LAUNCH_CHECKLIST.md`
  - `docs/CANOPY_TROVE_SCREENSHOT_BRIEF.md`
- Summary:
  - Ran a final consistency pass across the public pages for tagline, CTA phrasing, operator wording, and support/contact language.
  - Tightened the store metadata and README so the launch docs point at the screenshot brief and current launch materials.
  - Added a dedicated screenshot brief with ordered slots, titles, captions, and capture guidance for app-store assets.
  - Tightened the launch checklist around the remaining external blockers: live domain, support mailbox, and release-env confirmation.
- Verification:
  - QA and doc-only pass; no app runtime, backend, asset, or release-check files were touched.

### 2026-03-29 - Main Thread Asset And Runtime Default Pass

- Owner: `main thread`
- Files changed:
  - `app.json`
  - `src/config/legal.ts`
  - `src/config/legal.test.ts`
  - `.env.production.example`
  - `backend/.env.production.example`
  - `assets/icon.png`
  - `assets/ios-icon.png`
  - `assets/android-icon.png`
  - `assets/android-icon-background.png`
  - `assets/android-icon-foreground.png`
  - `assets/android-icon-monochrome.png`
  - `assets/favicon.png`
  - `assets/splash-icon.png`
- Summary:
  - Replaced the shipped app art with the `Canopy Arc` icon system for Expo, iOS, Android adaptive icons, monochrome theming, web favicon, and splash branding.
  - Aligned the Expo splash and adaptive-icon background color with the new `Canopy Arc` near-black brand background.
  - Updated the app runtime legal fallback email and the app/backend production env templates to the `canopytrove.com` public brand URLs.
- Verification:
  - Validated the generated PNG assets as readable images at the expected dimensions.
  - `npm run check:all`

### 2026-03-29 - Main Thread Internal Identifier And Native Config Rename Pass

- Owner: `main thread`
- Files changed:
  - `app.json`
  - `package.json`
  - `package-lock.json`
  - `backend/package.json`
  - `backend/package-lock.json`
  - `android/settings.gradle`
  - `android/app/build.gradle`
  - `android/app/src/main/res/values/strings.xml`
  - `android/app/src/main/java/com/rezell/canopytrove/MainActivity.kt`
  - `android/app/src/main/java/com/rezell/canopytrove/MainApplication.kt`
  - `src/**` remaining `CanopyTrove*`, `canopyTrove*`, and `canopytrove` identifiers
  - `backend/src/**` remaining `CanopyTrove*`, `canopyTrove*`, and `canopytrove` identifiers
  - `scripts/**`
  - `backend/scripts/**`
  - renamed internal files and folders that still carried `GreenRoutes`, `greenRoutes`, `greenroutes`, or `green-routes`
  - `MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md`
- Summary:
  - Renamed the remaining internal auth, route, tab-bar, gamification, identity, and service identifiers from `GreenRoutes`/`greenRoutes` to `CanopyTrove`/`canopyTrove`.
  - Updated Expo slug and scheme, package names, Android namespace/application id, Android app label, and storage namespace so the shipped config no longer carries the old brand.
  - Renamed the matching source files and folders so imports, route names, and native package paths align with the new brand.
  - Cleaned up the remaining historical root filename that still carried the old brand token.
  - Left the Firebase resource ids in `.env`, `backend/.env`, and `eas.json` unchanged because those values point at live external infrastructure and are not safe to rewrite without a real Firebase migration.
- Verification:
  - `npm run check:all`

### 2026-03-29 - Thread 2 Canopy Arc Website Branding

- Owner: `thread 2`
- Files changed:
  - `public-release-pages/styles.css`
  - `public-release-pages/index.html`
  - `public-release-pages/privacy/index.html`
  - `public-release-pages/terms/index.html`
  - `public-release-pages/community-guidelines/index.html`
  - `public-release-pages/support/index.html`
  - `public-release-pages/account-deletion/index.html`
  - `public-release-pages/media/canopy-arc.svg`
- Summary:
  - Replaced the old public-site emblem usage with the `Canopy Arc` mark in the header, homepage hero, and page icon references.
  - Republished the static website after the asset swap.
- Verification:
  - Verified the live homepage HTML references `/media/canopy-arc.svg`.
  - Verified the live homepage no longer references `/media/logo-master-cutout.png` or `/media/logo-mark-tight.png`.
  - Verified the live `Canopy Arc` asset returns `200`.

### Add Future Entries Below

- Date:
- Owner:
- Files changed:
- Summary:
- Verification:

