# Production Deploy Runbook

Updated: April 4, 2026

Step-by-step procedure for deploying Canopy Trove to production. Covers the
hosted backend (Cloud Run), Firebase Hosting (legal/marketing pages), and
mobile app builds (EAS).

## Prerequisites

- `gcloud` CLI authenticated to the `canopy-trove` GCP project
- `firebase` CLI authenticated to the `canopy-trove` Firebase project
- `eas` CLI authenticated to the `rezell` Expo account
- Stripe dashboard access (live mode keys)
- Sentry account with backend and app projects created

## 1. Backend — Cloud Run

### Build and push the Docker image

```bash
gcloud builds submit \
  --tag gcr.io/canopy-trove/canopytrove-api:latest \
  --project canopy-trove
```

### Create Secret Manager entries (first deploy only)

```bash
# Create each secret — paste the value when prompted
for SECRET in \
  GOOGLE_MAPS_API_KEY \
  ADMIN_API_KEY \
  STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET \
  EXPO_ACCESS_TOKEN \
  SENTRY_DSN \
  OPENAI_API_KEY \
  RESEND_API_KEY \
  RESEND_WEBHOOK_SECRET; do
  echo "Creating $SECRET..."
  printf "Enter value: " && read -s VALUE && echo
  printf "%s" "$VALUE" | gcloud secrets create "$SECRET" \
    --data-file=- \
    --replication-policy=automatic \
    --project=canopy-trove
done
```

### Deploy to Cloud Run

```bash
gcloud run deploy canopytrove-api \
  --image gcr.io/canopy-trove/canopytrove-api:latest \
  --region us-east4 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "\
STOREFRONT_BACKEND_SOURCE=firestore,\
CORS_ORIGIN=https://canopytrove.com,\
ALLOW_DEV_SEED=false,\
REQUEST_LOGGING_ENABLED=true,\
READ_RATE_LIMIT_PER_MINUTE=600,\
WRITE_RATE_LIMIT_PER_MINUTE=180,\
ADMIN_RATE_LIMIT_PER_TEN_MINUTES=30,\
FIREBASE_PROJECT_ID=canopy-trove,\
FIREBASE_DATABASE_ID=canopytrove,\
OPENAI_MODEL=gpt-4o-mini,\
OWNER_PORTAL_PRELAUNCH_ENABLED=true,\
RUNTIME_AUTO_MITIGATION_ENABLED=true,\
RUNTIME_INCIDENT_THRESHOLD=3,\
SENTRY_ENVIRONMENT=production,\
SENTRY_TRACES_SAMPLE_RATE=0.15,\
OPS_HEALTHCHECK_ENABLED=true,\
OPS_HEALTHCHECK_INTERVAL_MINUTES=5,\
OPS_HEALTHCHECK_TIMEOUT_MS=8000,\
OPS_HEALTHCHECK_FAILURE_CONFIRMATION_SWEEPS=2,\
OPS_ALERT_COOLDOWN_MINUTES=30,\
WELCOME_EMAILS_ENABLED=true,\
EMAIL_DELIVERY_PROVIDER=resend,\
EMAIL_REPLY_TO_ADDRESS=askmehere@canopytrove.com,\
OWNER_BILLING_SUCCESS_URL=https://canopytrove.com/owner/billing/success,\
OWNER_BILLING_CANCEL_URL=https://canopytrove.com/owner/billing/cancel,\
OWNER_BILLING_PORTAL_RETURN_URL=https://canopytrove.com/owner/billing" \
  --set-secrets "\
GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest,\
ADMIN_API_KEY=ADMIN_API_KEY:latest,\
STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,\
STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,\
EXPO_ACCESS_TOKEN=EXPO_ACCESS_TOKEN:latest,\
SENTRY_DSN=SENTRY_DSN:latest,\
OPENAI_API_KEY=OPENAI_API_KEY:latest,\
RESEND_API_KEY=RESEND_API_KEY:latest,\
RESEND_WEBHOOK_SECRET=RESEND_WEBHOOK_SECRET:latest" \
  --project canopy-trove
```

### Post-deploy verification

```bash
# Health check
curl -s https://canopytrove-api-XXXXX-ue.a.run.app/health | jq .

# Readiness probe
curl -s https://canopytrove-api-XXXXX-ue.a.run.app/readyz | jq .

# Storefront summaries (confirms Firestore connectivity)
curl -s "https://canopytrove-api-XXXXX-ue.a.run.app/storefront-summaries?limit=3" | jq .items[0].name
```

### Set uptime monitor targets (after deploy gives you the URL)

Update Cloud Run env with:

```
OPS_HEALTHCHECK_API_URL=https://canopytrove-api-XXXXX-ue.a.run.app/readyz
OPS_HEALTHCHECK_API_RAW_URL=https://canopytrove-api-XXXXX-ue.a.run.app/readyz
```

## 2. Firebase Hosting — Legal Pages

```bash
cd /path/to/canopytrove
firebase deploy --only hosting --project canopy-trove
```

Verify each page loads:

- https://canopytrove.com/privacy
- https://canopytrove.com/terms
- https://canopytrove.com/community-guidelines
- https://canopytrove.com/account-deletion
- https://canopytrove.com/support

## 3. Stripe — Live Billing

1. Switch Stripe dashboard to live mode.
2. Create products and prices:
   - Monthly plan: $49/month recurring
   - Annual plan: $490/year recurring
3. Copy the `price_xxx` IDs into Cloud Run env as
   `STRIPE_OWNER_MONTHLY_PRICE_ID` and `STRIPE_OWNER_ANNUAL_PRICE_ID`.
4. Register the webhook endpoint:
   - URL: `https://canopytrove-api-XXXXX-ue.a.run.app/owner-billing/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_succeeded`,
     `invoice.payment_failed`
5. Copy the webhook signing secret into Secret Manager as
   `STRIPE_WEBHOOK_SECRET`.

## 4. Mobile App — EAS Build

### iOS

```bash
eas build --platform ios --profile production
```

Then submit to App Store Connect:

```bash
eas submit --platform ios
```

Use the copy and screenshots from `docs/APPLE_SUBMISSION_PACKET.md`.

### Android

```bash
eas build --platform android --profile production
```

This produces an AAB file. Upload it to Google Play Console manually (first
release) or via:

```bash
eas submit --platform android
```

Use the copy and screenshots from `docs/GOOGLE_PLAY_SUBMISSION_PACKET.md`.

## 5. Release Gate Verification

Run both gate checks locally against the production env:

```bash
# Code health
npm run check:all

# Release readiness (app side — uses .env.production.example values)
APP_RELEASE_CHECK_PRODUCTION=1 npm run release:check

# Release readiness (backend side — needs production .env on backend)
npm --prefix backend run release:check
```

All required checks must pass. Recommended checks should pass or have
documented reasons for deferral.

## 6. Post-Launch Monitoring

After both stores approve and the app is live:

1. Confirm Sentry receives events from both backend and app.
2. Confirm Cloud Run alerting fires on a test 5xx (see
   `memory/context/ops-monitoring-setup.md`).
3. Confirm the runtime health monitor runs on schedule and the ops dashboard
   at `/admin/ops/status` shows green targets.
4. Monitor the first 48 hours of App Store and Play Store reviews for crash
   reports or policy flags.
