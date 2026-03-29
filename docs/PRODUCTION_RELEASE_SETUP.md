# Canopy Trove Production Release Setup

Updated: March 28, 2026

## 0. Run The Release Checks First

Before a public release pass, run:

```powershell
cd "C:\Users\eleve\Documents\New project\canopy-trove-3-restored"
npm run release:check
```

This now runs both:

- the app-side release check
- the backend-side release check

The command fails fast and names the exact missing env vars or production blockers instead of leaving them buried across docs.

Production env templates now live at:

- `.env.production.example`
- `backend/.env.production.example`

Use those as the canonical fill-in templates for app and backend production env.

Local-only overrides should live outside those release templates:

- app local overrides: `.env.local`
- backend local overrides: `backend/.env.local`

Do not point the tracked/release-safe env templates at local LAN URLs or local secret file paths.

Recommended local secret location:

- `C:/Users/<you>/.canopytrove/secrets/firebase/canopy-trove-firebase-adminsdk.json`

That keeps Firebase admin credentials out of `Downloads` and out of the repo while still giving the local backend a stable private path.

## 1. Hosted Backend

Canopy Trove production billing, moderation, and authenticated profile writes require a hosted backend.

Minimum backend env:

- `STOREFRONT_BACKEND_SOURCE=firestore`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_MAPS_API_KEY`
- `ADMIN_API_KEY`
- `EXPO_ACCESS_TOKEN`

Console-side items that are still outside the repo:

- Firebase Auth project display / branding should say `Canopy Trove`
- Firebase Auth authorized domains should include `canopytrove.com`
- if Google sign-in is used, the Google OAuth consent screen should also say `Canopy Trove`

## 2. Owner Billing

Live owner billing now expects Stripe-backed backend setup.

Required backend env:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_OWNER_MONTHLY_PRICE_ID`
- `STRIPE_OWNER_ANNUAL_PRICE_ID`
- `OWNER_BILLING_SUCCESS_URL`
- `OWNER_BILLING_CANCEL_URL`
- `OWNER_BILLING_PORTAL_RETURN_URL`

The app and backend now report missing owner-billing env vars by name instead of only saying "not configured". If a checkout or portal flow fails due to missing setup, use the exact env names surfaced by the app/backend error text.

Webhook endpoint:

```text
POST /owner-billing/stripe/webhook
```

If a hosted backend is not ready, the app can fall back to hosted payment links using public Expo env vars:

- `EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL`
- `EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL`
- `EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL`

For public-link fallback, treat both checkout URLs as one required pair. If either monthly or annual is missing, the app now considers the public checkout fallback incomplete.

Current Stripe sandbox resources created on March 28, 2026:

- Product: `prod_UEXcDI30TQyNFz` (`Canopy Trove Owner Plan`)
- Monthly price: `price_1TG4X0R7rapv2vOiB5blvh2d`
- Annual price: `price_1TG4X3R7rapv2vOiFZiaQFGq`

## 3. Public Legal URLs

These public env vars should point at live hosted pages before store submission:

- `EXPO_PUBLIC_SUPPORT_EMAIL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL`

Recommended companion env vars:

- `EXPO_PUBLIC_APP_WEBSITE_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_HELP_URL`

Note:

- `npm run release:check` now reads release-safe app defaults from `.env` and ignores `.env.local` unless you explicitly set `APP_RELEASE_CHECK_INCLUDE_LOCAL_OVERRIDES=true`.
- Keep local machine API overrides in `.env.local` so release checks continue to validate the public app posture.

The in-app legal center now shows a release-status card that reads directly from these public env vars. If a required URL is missing, the app will surface the missing env name instead of silently looking compliant.

## 3.5. Owner Portal Release Access

Dev builds stay open for developer access, but preview/release builds do not silently open the owner portal anymore.

If you want specific real owner emails to access the owner portal outside dev mode, set:

- `EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST`

Use a comma-separated list of the exact allowed email addresses.

## 4. Mobile App Identity

Release identity is now:

- iOS: `com.rezell.canopytrove`
- Android: `com.rezell.canopytrove`
- URL scheme: `canopytrove`

## 5. Billing And Moderation Ops

Before launch:

1. confirm admin review queue access using `ADMIN_API_KEY`
2. confirm Stripe webhook delivery is green
3. confirm an owner subscription updates both:
   - `subscriptions/{ownerUid}`
   - `ownerProfiles/{ownerUid}`
4. confirm storefront reports move through the admin queue

## 6. Release Docs To Publish

Publish these repo drafts somewhere public:

- `docs/PRIVACY_POLICY.md`
- `docs/TERMS_OF_USE.md`
- `docs/COMMUNITY_GUIDELINES.md`

## 7. Final Submission Prep

- `npm run release:check` passes on both app and backend
- production env values copied from `.env.production.example` and `backend/.env.production.example`
- EAS project link exists (`@rezell/canopytrove`)
- EAS production env vars configured outside the repo where needed
- store listing text and screenshots prepared
- phone QA completed on at least one Android device
- TestFlight / App Store Connect metadata prepared
