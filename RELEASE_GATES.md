# Release Gates

This document explains the difference between the two main verification commands and what each one covers.

## `npm run check:all` — Development Health Gate

This is the daily health check. Run it after any code change to confirm nothing is broken.

What it runs (in order):

1. `npx tsc --noEmit` — frontend TypeScript check
2. `npm run test:frontend-core` — core unit tests (15 files, ~51 tests)
3. `npm run test:frontend-integration` — integration tests (2 files, ~8 tests)
4. `npm run test:rules` — Firebase security rules tests
5. `npm --prefix backend test` — backend test suite (~132 tests)
6. `npm --prefix backend run check` — backend TypeScript check

What it does NOT check: environment configuration, API keys, release readiness, hosting probes, or Stripe/email/push setup.

A green `check:all` means the code compiles and tests pass. It does not mean the app is ready to ship.

## `npm run release:check` — Release Readiness Gate

This is the stricter pre-release check. Run it before submitting to the App Store or deploying the backend to production.

What it runs:

1. `node ./scripts/check-release-readiness.mjs` — app-side release checks
2. `npm --prefix backend run release:check` — backend release checks

### App-side checks (required)

These will block release if they fail:

- Production storefront source is set to `api`
- Public storefront API URL is a real non-local URL
- Firebase client config vars are all present
- EAS build profiles don't hardcode public env vars
- Support email is configured
- Privacy policy, terms, and community guidelines URLs are public
- Expo slug and iOS/Android bundle identifiers match production values
- iOS deployment target is pinned through `expo-build-properties`
- Android compile/target SDK are pinned to Play-compliant levels
- Android does not request broad photo access (`READ_MEDIA_IMAGES`)
- Android explicitly blocks inherited image-picker audio permission (`RECORD_AUDIO`)

### App-side checks (recommended, warnings only)

- Hosted API health and summary probes respond
- Sentry crash monitoring DSN and source map upload config
- Owner checkout/billing fallback URLs are live (not Stripe test)
- Owner price labels are set
- Owner preview mode is disabled for public release
- App metadata avoids sales-forward phrases like `hot deals`, `buy now`, and `shop now`

### Backend checks (required)

- Storefront source mode is `firestore` (not mock)
- Firestore source is actually active
- Published storefront summaries are available
- CORS origin is restricted (not `*`)
- Firebase admin access is configured
- Expo push access token (`EXPO_ACCESS_TOKEN`) is set
- Admin review readiness requirements are met
- Stripe billing env is fully configured (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- Stripe key is live (not test)

### Backend checks (recommended, warnings only)

- `GOOGLE_MAPS_API_KEY` for Places enrichment
- OpenAI key for owner AI assistant
- Sentry DSN for crash monitoring
- Email delivery (Resend) config
- Runtime health monitor targets and ops alert webhook
- Dev seed is disabled

## Classification of Backend Release Blockers

The backend `release:check` failures reported in recent audits fall into two categories:

### Environment-only blockers (need keys, not code changes)

These fail because the local `.env` file doesn't have production secrets. They will pass in the hosted environment once secrets are configured:

- `GOOGLE_MAPS_API_KEY` — Google Places API key for storefront enrichment
- `EXPO_ACCESS_TOKEN` — Expo push notification token
- `ADMIN_API_KEY` — Admin API authentication key
- `STRIPE_SECRET_KEY` — Stripe payment processing key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signature verification

### Infrastructure blockers (need hosted services running)

- Published storefront summary availability timeout — the hosted backend must be running with Firestore populated. This will pass once the backend is deployed and the discovery pipeline has run.

### No code-path blockers

There are currently no release blockers that require code changes. All failures are configuration or infrastructure setup.

## Google Play Caveat

Passing `npm run release:check` does not mean Google Play approval is likely.

Canopy Trove still sits in a restricted category. Google's current Developer Program Policy says it does not allow apps that facilitate the sale of marijuana or marijuana products, including arranging delivery or pickup. The Android build now hardens obvious review risks such as broad media permissions and sales-forward metadata, but Play review will still depend heavily on:

- store listing copy and screenshots
- whether Android reads as a directory/compliance app instead of a commerce app
- whether reviewer flows expose cannabis-product or seller-enablement behavior that looks like facilitation

## When to Run Each Command

- After every code change: `npm run check:all`
- Before submitting to App Store: `npm run release:check`
- Before deploying backend to production: `npm run release:check`
- For strict formatting (CI): `npm run precheck:strict`
