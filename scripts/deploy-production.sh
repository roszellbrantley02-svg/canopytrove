#!/usr/bin/env bash
set -euo pipefail

# Canopy Trove — Production Deploy Script
# Run this from the repo root on your local machine.
#
# Prerequisites:
#   gcloud auth login
#   firebase login
#   npm install (both root and backend)
#
# Usage:
#   bash scripts/deploy-production.sh          # full deploy
#   bash scripts/deploy-production.sh hosting  # hosting only
#   bash scripts/deploy-production.sh backend  # backend only
#   bash scripts/deploy-production.sh verify   # post-deploy checks only

PROJECT="canopy-trove"
REGION="us-east4"
SERVICE="canopytrove-api"
IMAGE="gcr.io/${PROJECT}/${SERVICE}:latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
fail() { echo -e "${RED}[deploy]${NC} $1"; exit 1; }

# ---------------------------------------------------------------------------
# Step 0: preflight
# ---------------------------------------------------------------------------
preflight() {
  log "Running preflight checks..."

  command -v gcloud >/dev/null 2>&1 || fail "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  command -v firebase >/dev/null 2>&1 || fail "firebase CLI not found. Run: npm install -g firebase-tools"
  command -v jq >/dev/null 2>&1 || warn "jq not found — post-deploy verification will show raw JSON"

  ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)
  if [ "$ACTIVE_PROJECT" != "$PROJECT" ]; then
    warn "Active gcloud project is '${ACTIVE_PROJECT}', switching to '${PROJECT}'..."
    gcloud config set project "$PROJECT"
  fi

  log "Preflight passed."
}

# ---------------------------------------------------------------------------
# Step 1: deploy Firebase Hosting (legal pages + marketing site)
# ---------------------------------------------------------------------------
deploy_hosting() {
  log "Deploying Firebase Hosting..."
  firebase deploy --only hosting --project "$PROJECT"
  log "Firebase Hosting deployed."

  log "Verifying legal pages..."
  for PAGE in privacy terms community-guidelines account-deletion support; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://canopytrove.com/${PAGE}")
    if [ "$STATUS" = "200" ]; then
      echo -e "  ${GREEN}✓${NC} /${PAGE} (${STATUS})"
    else
      echo -e "  ${RED}✗${NC} /${PAGE} (${STATUS})"
    fi
  done
}

# ---------------------------------------------------------------------------
# Step 2: build and deploy backend to Cloud Run
# ---------------------------------------------------------------------------
deploy_backend() {
  log "Building Docker image..."
  gcloud builds submit \
    --tag "$IMAGE" \
    --project "$PROJECT" \
    --quiet

  log "Deploying to Cloud Run (${SERVICE} in ${REGION})..."
  gcloud run deploy "$SERVICE" \
    --image "$IMAGE" \
    --region "$REGION" \
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
OWNER_PORTAL_PRELAUNCH_ENABLED=false,\
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
    --project "$PROJECT"

  SERVICE_URL=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT" \
    --format='value(status.url)' 2>/dev/null)

  log "Cloud Run deployed at: ${SERVICE_URL}"
  echo ""
  echo "  Next: set these env vars on the service to enable self-monitoring:"
  echo "    OPS_HEALTHCHECK_API_URL=${SERVICE_URL}/readyz"
  echo "    OPS_HEALTHCHECK_API_RAW_URL=${SERVICE_URL}/readyz"
  echo ""
}

# ---------------------------------------------------------------------------
# Step 3: post-deploy verification
# ---------------------------------------------------------------------------
verify() {
  SERVICE_URL=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT" \
    --format='value(status.url)' 2>/dev/null)

  if [ -z "$SERVICE_URL" ]; then
    fail "Could not resolve service URL. Is ${SERVICE} deployed in ${REGION}?"
  fi

  log "Running post-deploy verification against ${SERVICE_URL}..."

  echo ""
  echo "--- Health ---"
  curl -s "${SERVICE_URL}/health" | jq . 2>/dev/null || curl -s "${SERVICE_URL}/health"
  echo ""

  echo "--- Readiness ---"
  READYZ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/readyz")
  if [ "$READYZ_STATUS" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} /readyz (${READYZ_STATUS})"
  else
    echo -e "  ${RED}✗${NC} /readyz (${READYZ_STATUS})"
  fi
  echo ""

  echo "--- Storefront summaries ---"
  curl -s "${SERVICE_URL}/storefront-summaries?limit=2" | jq '.items | length' 2>/dev/null || \
    curl -s "${SERVICE_URL}/storefront-summaries?limit=2"
  echo ""

  echo "--- Legal pages ---"
  for PAGE in privacy terms community-guidelines account-deletion; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://canopytrove.com/${PAGE}")
    if [ "$STATUS" = "200" ]; then
      echo -e "  ${GREEN}✓${NC} canopytrove.com/${PAGE}"
    else
      echo -e "  ${RED}✗${NC} canopytrove.com/${PAGE} (${STATUS})"
    fi
  done
  echo ""

  log "Verification complete."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
TARGET="${1:-all}"

preflight

case "$TARGET" in
  hosting)
    deploy_hosting
    ;;
  backend)
    deploy_backend
    verify
    ;;
  verify)
    verify
    ;;
  all)
    deploy_hosting
    deploy_backend
    verify
    ;;
  *)
    fail "Unknown target: ${TARGET}. Use: all, hosting, backend, verify"
    ;;
esac

echo ""
log "Done. Next manual steps:"
echo "  1. Create Stripe webhook at: ${SERVICE_URL:-<service-url>}/owner-billing/stripe/webhook"
echo "  2. Run: npm run release:check"
echo "  3. Run: npm --prefix backend run release:check"
