# Owner Portal Demo

Updated: March 28, 2026

## Purpose

This guided demo opens the paid dispensary-owner section for product review without requiring real owner sign-in, live file uploads, or subscription writes.

Use it when you want to inspect the owner pages and decide what to add, remove, or redesign before launch.

## How To Open It

Primary app path:

1. Open the `Profile` tab.
2. Find the owner preview card.
3. Tap `Open Owner Demo`.

Secondary path:

1. Open the owner access screen.
2. Tap `Open Owner Demo`.

## What Demo Mode Does

- Opens the owner dashboard with preview data.
- Lets you move between the paid owner pages with direct buttons.
- Keeps the real owner auth flow in the codebase.
- Prevents real claim, verification, upload, or subscription writes.

## Demo Pages Included

- Business Details
- Claim Listing
- Business Verification
- Identity Verification
- Subscription

## Demo Tools Included

- A timed hot-deal badge editor on the owner home screen
- A temporary override lab that can open any preview storefront card without replacing the original single-store editor
- A batch override action that can apply one temporary test deal across every preview storefront card in the current install
- Live storefront-card preview using the current badge stack
- Badge limits capped to five items so cards stay contained in the layout

## Files That Control This Demo

- `src/screens/ProfileScreen.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/useProfileActions.ts`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`
- `src/screens/ownerPortal/useOwnerPortalHomeScreenModel.ts`
- `src/screens/ownerPortal/ownerPortalPreviewData.ts`
- `src/screens/ownerPortal/OwnerPortalDealBadgeEditor.tsx`
- `src/screens/ownerPortal/OwnerPortalDealOverridePanel.tsx`
- `src/services/storefrontPromotionOverrideService.ts`
- `src/navigation/rootNavigatorConfig.tsx`

## Important Rule

Keep the real owner portal files and live owner-auth routes intact.

Demo mode is a safe browsing layer on top of those files, not a replacement for the real owner workflow.
