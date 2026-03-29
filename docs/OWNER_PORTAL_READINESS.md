# Owner Portal Readiness

Updated: March 28, 2026

## Current State

The owner portal now reads like a production-facing Canopy Trove owner workspace on the main screens:

- owner access
- owner sign in
- owner sign up
- owner dashboard
- owner onboarding steps
- owner plan access

The guided demo still exists, but it now sits beside the real owner flow instead of reading like the primary product.

## What Is Finished In The Surface

- Production-facing copy replaced most internal and preview wording on the real owner path.
- The owner dashboard now presents profile, listing, verification, and plan states in user-friendly labels.
- The owner dashboard now surfaces a premium ROI funnel with impressions, opens, saved followers, reviews, route starts, website taps, menu taps, phone taps, and conversion rates.
- The guided demo still allows safe review of every owner page and live-looking badge tools without touching production data.
- The guided demo is now build-gated through `EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED`, so it can stay available in preview/testing builds while remaining hidden in production builds.
- The subscription screen now uses a real hosted billing path instead of an internal-only activation button.
- Stripe-backed owner billing, Stripe webhooks, and billing-portal session endpoints now exist on the backend when production env is configured.
- Admin-review queue endpoints now exist for claims, business verification, identity verification, and storefront reports.
- Promotion planning now supports paid priority placement by surface (`Nearby`, `Browse`, `Hot Deals`) and scope (`My Area`, `Statewide`).
- Promotion results now show action attribution beyond CTR, including website taps, menu taps, phone taps, route starts, and total tracked action rate per offer.

## Remaining Product Gaps

- Owner access is still invite-only in code.
  - `src/services/ownerPortalShared.ts` still uses the prelaunch flag and optional allowlist.
- Billing still needs production configuration.
  - `backend/.env.example` now defines the Stripe env set, but the live keys, price ids, webhook endpoint, and return URLs still need to be configured on the hosted backend.
- Review tooling is backend-complete but not yet surfaced as a dedicated admin UI.
  - Manual review is currently documented and available through secured backend endpoints.
- The guided demo should be hidden or gated before a public consumer release if it is not meant for normal users.
  - This is now handled at the build layer for the current release path: `preview` enables it, `production` disables it.

## Files Leading The Finished Surface

- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalSignInScreen.tsx`
- `src/screens/OwnerPortalSignUpScreen.tsx`
- `src/screens/OwnerPortalForgotPasswordScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`
- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/ownerPortal/ownerPortalHomeShared.ts`
- `src/screens/storefrontDetail/useStorefrontDetailActions.ts`
- `backend/src/services/ownerBillingService.ts`
- `backend/src/routes/ownerBillingRoutes.ts`
- `backend/src/services/analyticsEventService.ts`
- `backend/src/services/ownerPortalWorkspaceService.ts`

## Next Build Phase

1. Configure hosted Stripe env and webhook delivery.
2. Decide whether owner access stays invite-only or opens more broadly.
3. Gate or remove the guided demo for the public release build.
4. Build or document the internal admin console that will sit on top of the review endpoints.
