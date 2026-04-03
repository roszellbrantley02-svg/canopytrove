# Release Readiness

Updated: March 30, 2026

## Current Rating

As of March 28, 2026:

- Google Play internal or closed testing: `8/10`
- Google Play public release: `6/10`
- Apple TestFlight: `5/10`
- Apple App Store public release: `4/10`

## Current Call

Do not submit a public store build yet.

The app is now much closer to release-complete, but it still has production-hosting, legal-URL, and public-surface gating work left before a real public launch.

## Fastest Truth Check

Run:

```powershell
cd "C:\Users\eleve\Documents\New project\canopy-trove-3-restored"
npm run release:check
```

This now verifies both:

- app-side public release configuration
- backend-side public release configuration

As of the current repo state, the release check is flagging these concrete blockers or warnings:

- incomplete live Stripe backend env
- missing hosted mobile Sentry DSN
- missing hosted backend Sentry DSN
- missing hosted runtime health monitor targets and/or alert webhook
- owner AI will stay in fallback-only mode unless hosted `OPENAI_API_KEY` is set

The repo now includes production env templates to fill these in:

- `.env.production.example`
- `backend/.env.production.example`

## Highest-Priority Blockers

1. Remove or hard-gate the internal owner demo from the public app surface.
   Current public entry points exist in:
   - `src/screens/profile/ProfileDataSections.tsx`
   - `src/screens/OwnerPortalAccessScreen.tsx`

2. Configure the live hosted backend and Stripe env set before release.
   Current code is ready, but production env still needs:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_OWNER_MONTHLY_PRICE_ID`
   - `STRIPE_OWNER_ANNUAL_PRICE_ID`
   - `OWNER_BILLING_SUCCESS_URL`
   - `OWNER_BILLING_CANCEL_URL`
   - `OWNER_BILLING_PORTAL_RETURN_URL`
   The billing code now reports any missing env vars explicitly on both app and backend paths.

3. Publish the legal documents and point the public app env at them.
   Current code expects:
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
   - `EXPO_PUBLIC_TERMS_URL`
   - `EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL`
   - `EXPO_PUBLIC_SUPPORT_EMAIL`
   Recommended companion links:
   - `EXPO_PUBLIC_APP_WEBSITE_URL`
   - `EXPO_PUBLIC_ACCOUNT_DELETION_HELP_URL`

4. Finish hosted monitoring and live owner AI env.
   Current hosted/runtime env still needs:
   - `EXPO_PUBLIC_SENTRY_DSN`
   - `SENTRY_DSN`
   - `OPS_HEALTHCHECK_API_URL`
   - `OPS_HEALTHCHECK_SITE_URL`
   - `OPS_ALERT_WEBHOOK_URL`
   - `OPENAI_API_KEY` if owner AI should run live

5. Finish store metadata and review-note packaging.
   The repo now has draft source docs, but store listings still need real copy, URLs, screenshots, and test credentials.

6. Decide whether the owner demo remains in the consumer app build.
   Demo access is useful for review and product iteration but should not leak into a public release unintentionally.

The release path should now treat `eas.json` as build metadata only:

- configure preview and production app env in hosted EAS environments
- keep `EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED=false` for public release builds
- keep `EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED=false` for public release builds
- keep `EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST` blank in the public bundle
- if owner onboarding still needs a controlled rollout, enforce the allowlist privately on the backend

## Current Compliance Progress

- In-app account deletion now exists.
- In-app legal center now exists.
- The legal center now shows a release-status card for missing or ready public legal URLs.
- Account deletion now surfaces partial-deletion states clearly when login removal needs a recent sign-in.
- Community-guidelines acceptance exists before review submission.
- Review-level reporting and local block-author controls now exist on storefront reviews.
- Backend admin-review queue endpoints now exist.
- Admin-review routes now return explicit missing-setup requirements for `ADMIN_API_KEY` and backend Firebase admin access.
- iOS bundle identifier is now set to `com.rezell.canopytrove`.

## Apple Risk Notes

- Apple requires in-app account deletion when apps support account creation.
- Apple also treats legal-cannabis apps as a regulated category.
- If the app facilitates legal cannabis use or discovery, it should be submitted by the correct legal entity and geo-restricted to legal jurisdictions.

## Product/Policy Positioning To Keep

Keep the public app positioned as:

- licensed dispensary discovery
- navigation
- storefront information
- community reviews

Avoid drifting into:

- direct cannabis sales
- purchase flow
- ordering flow
- anything that looks like facilitating illegal drug sales

## Recommended Next Release Sequence

1. Configure the hosted backend Stripe env set.
2. Configure hosted monitoring env and owner AI env.
3. Publish the legal documents and verify the public URLs.
4. Run `npm run release:check` until it passes without required failures.
5. Ship another `preview` build and finish phone QA.
6. Hide the owner demo from public release builds if needed.
7. Finish App Store / Play listing text, screenshots, and review credentials.
8. Prepare Apple and Google review notes for the regulated-category positioning.
9. Run the pass/fail matrix in `docs/PHONE_QA_CHECKLIST.md`.

## Reference Files

- `app.json`
- `eas.json`
- `docs/PRIVACY_POLICY.md`
- `docs/TERMS_OF_USE.md`
- `docs/COMMUNITY_GUIDELINES.md`
- `docs/ADMIN_REVIEW_WORKFLOW.md`
- `docs/PRODUCTION_RELEASE_SETUP.md`
- `docs/PHONE_QA_CHECKLIST.md`
- `docs/OWNER_PORTAL_PREVIEW.md`
- `docs/GOOGLE_MAPS_KEY_HARDENING.md`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/OwnerPortalAccessScreen.tsx`
