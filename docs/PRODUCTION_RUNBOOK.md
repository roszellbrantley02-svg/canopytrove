# Canopy Trove Production Runbook

## Pre-release checks

From `C:\Users\eleve\Documents\New project\canopy-trove-3-restored`:

1. App compile
   - `npx tsc --noEmit`
2. Backend compile
   - `cd backend`
   - `npm run check`
3. Backend tests
   - `npm run test`
4. Backend smoke checks against the running environment
   - `BACKEND_BASE_URL=http://127.0.0.1:4100 npm run smoke`

## Backend readiness

Health checks:

- `GET /health`
- expected:
  - `ok: true`
  - `source.activeMode: firestore` for production
  - `authVerification: firebase-admin`
  - `requestLoggingEnabled: true`
  - `runtimeMonitoring.configured: true` when ops sweeps are set up
  - `runtimeMonitoring.overallOk: true` after a clean sweep

## Data readiness

1. Verify Firestore backend mode is active.
2. Verify OCM-based seed counts are present:
   - `GET /admin/seed-status`
3. If the seed must be refreshed in a controlled environment:
   - `POST /admin/seed-firestore`

## Smoke paths

Run these before promoting a build:

1. Nearby first load
   - device location granted
   - first three cards appear
2. Browse first page
   - first page returns verified storefronts
3. Detail load
   - one storefront detail opens
4. Profile state write
   - saved storefront toggle persists

## Owner Billing Readiness

Before enabling live owner billing:

1. Set Stripe env on the backend host:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_OWNER_MONTHLY_PRICE_ID`
   - `STRIPE_OWNER_ANNUAL_PRICE_ID`
   - `OWNER_BILLING_SUCCESS_URL`
   - `OWNER_BILLING_CANCEL_URL`
   - `OWNER_BILLING_PORTAL_RETURN_URL`
2. Point Stripe webhook delivery to:
   - `POST /owner-billing/stripe/webhook`
3. Confirm a test owner checkout updates:
   - `subscriptions/{ownerUid}`
   - `ownerProfiles/{ownerUid}`
4. Confirm billing-portal sessions open for an active owner account.

## Admin Review Readiness

Before launch moderation:

1. Set `ADMIN_API_KEY` on the hosted backend.
2. Validate:
   - `GET /admin/reviews/queue`
   - `POST /admin/reviews/claims/:claimId`
   - `POST /admin/reviews/business-verifications/:ownerUid`
   - `POST /admin/reviews/identity-verifications/:ownerUid`
   - `POST /admin/reviews/storefront-reports/:reportId`

## Rollback

If a deployment regresses:

1. Roll back the backend deployment first.
2. Confirm `/health` and `npm run smoke` are green on the rolled-back backend.
3. Roll back the mobile build only if the regression is client-side.
4. If the issue is data-related, restore the last known-good Firestore seed snapshot before reseeding.

## Logging

The backend now emits one JSON log line per request with:

- `requestId`
- `method`
- `path`
- `statusCode`
- `responseTimeMs`
- `ip`
- `sourceMode`

Use `requestId` to correlate user-reported failures with backend logs.

## Uptime Alerts

Recommended hosted env:

- `OPS_HEALTHCHECK_ENABLED=true`
- `OPS_HEALTHCHECK_API_URL=https://api.canopytrove.com/health`
- `OPS_HEALTHCHECK_SITE_URL=https://canopytrove.com`
- `OPS_ALERT_WEBHOOK_URL`

Operator path:

1. verify the webhook target receives failure and recovery payloads
2. use `GET /health` to confirm `runtimeMonitoring`
3. use the internal admin runtime panel for manual sweeps during incident response
