# Canopy Trove Cloud Run Backend Setup

Use this when you want the Express backend on Google Cloud Run.

## What changed in the repo

- Root `Dockerfile` now packages the backend for Cloud Run.
- Root `.dockerignore` trims the deploy context down to what the backend needs.
- `backend/package.json` now starts the compiled server from the correct output path.

## Before you deploy

You need a Cloud Run service for the backend, not just Firebase Hosting for the website.

Recommended region for this app:

- `us-east4`

Good alternative:

- `us-east1`

Both are Tier 1 regions and closer to your U.S. users than Belgium.

## Easiest deploy path

From the repo root:

```powershell
cd <repo-root>
gcloud config set project canopy-trove
gcloud run deploy canopytrove-api --source . --region us-east4 --allow-unauthenticated
```

Cloud Run will build from the root `Dockerfile`.

## Env vars to add on the service

In Cloud Run:

1. Open the service
2. Click `Edit and deploy new revision`
3. Open `Variables & Secrets`
4. Add the backend env vars

Minimum owner-AI settings:

```env
OPENAI_API_KEY=your_real_key
OPENAI_MODEL=gpt-5-mini
```

Recommended backend production env:

```env
STOREFRONT_BACKEND_SOURCE=firestore
CORS_ORIGIN=https://canopytrove.com
FIREBASE_PROJECT_ID=canopy-trove
FIREBASE_DATABASE_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=...
GOOGLE_MAPS_API_KEY=...
EXPO_ACCESS_TOKEN=...
ADMIN_API_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
OWNER_PORTAL_PRELAUNCH_ENABLED=false
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.15
OPS_HEALTHCHECK_ENABLED=true
OPS_HEALTHCHECK_API_URL=https://api.canopytrove.com/health
OPS_HEALTHCHECK_SITE_URL=https://canopytrove.com
OPS_HEALTHCHECK_TIMEOUT_MS=8000
OPS_HEALTHCHECK_INTERVAL_MINUTES=5
OPS_ALERT_COOLDOWN_MINUTES=30
```

If you still want a controlled owner rollout, keep the app bundle neutral and add these privately on the backend only:

```env
OWNER_PORTAL_PRELAUNCH_ENABLED=true
OWNER_PORTAL_ALLOWLIST=approved-owner@example.com
```

If you created a Firestore database with a custom name instead of `(default)`, set:

```env
FIREBASE_DATABASE_ID=your_database_name
```

If you want owner billing live too, also add:

```env
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_OWNER_MONTHLY_PRICE_ID=...
STRIPE_OWNER_ANNUAL_PRICE_ID=...
OWNER_BILLING_SUCCESS_URL=https://canopytrove.com/owner/billing/success
OWNER_BILLING_CANCEL_URL=https://canopytrove.com/owner/billing/cancel
OWNER_BILLING_PORTAL_RETURN_URL=https://canopytrove.com/owner/billing
```

## How to verify AI is live

After deploy, open:

- `https://<your-cloud-run-url>/health`

Look for:

- `aiOperatorMode: "openai"`

If it still says:

- `aiOperatorMode: "fallback"`

then the hosted backend still does not have `OPENAI_API_KEY`.
