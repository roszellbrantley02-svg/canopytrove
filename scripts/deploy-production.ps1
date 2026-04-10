# Canopy Trove — Production Deploy Script (PowerShell)
# Run this from the repo root on your local machine.
#
# Prerequisites:
#   gcloud auth login
#   firebase login
#   npm install (both root and backend)
#
# Usage:
#   .\scripts\deploy-production.ps1            # full deploy
#   .\scripts\deploy-production.ps1 hosting    # hosting only
#   .\scripts\deploy-production.ps1 backend    # backend only
#   .\scripts\deploy-production.ps1 verify     # post-deploy checks only

param(
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

$PROJECT = "canopy-trove"
$REGION  = "us-east4"
$SERVICE = "canopytrove-api"
$STORAGE_BUCKET = "canopy-trove.firebasestorage.app"
$IMAGE   = "$REGION-docker.pkg.dev/$PROJECT/$SERVICE/${SERVICE}:latest"

function Log($msg)  { Write-Host "[deploy] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[deploy] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[deploy] $msg" -ForegroundColor Red; exit 1 }
function Assert-LastExitCode($context) {
    if ($LASTEXITCODE -ne 0) {
        Fail "$context failed with exit code $LASTEXITCODE."
    }
}

# ---------------------------------------------------------------------------
# Step 0: preflight
# ---------------------------------------------------------------------------
function Preflight {
    Log "Running preflight checks..."

    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Fail "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
    }
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
        Fail "firebase CLI not found. Run: npm install -g firebase-tools"
    }

    $activeProject = gcloud config get-value project 2>$null
    if ($activeProject -ne $PROJECT) {
        Warn "Active gcloud project is '$activeProject', switching to '$PROJECT'..."
        gcloud config set project $PROJECT
        Assert-LastExitCode "gcloud config set project"
    }

    Log "Preflight passed."
}

# ---------------------------------------------------------------------------
# Step 1: deploy Firebase Hosting (legal pages + marketing site)
# ---------------------------------------------------------------------------
function Deploy-Hosting {
    Log "Deploying Firebase Hosting..."
    firebase deploy --only hosting --project $PROJECT
    Assert-LastExitCode "Firebase Hosting deploy"
    Log "Firebase Hosting deployed."

    Log "Verifying legal pages..."
    $pages = @("privacy", "terms", "community-guidelines", "account-deletion", "support")
    foreach ($page in $pages) {
        try {
            $response = Invoke-WebRequest -Uri "https://canopytrove.com/$page" -Method Head -UseBasicParsing -ErrorAction SilentlyContinue
            $status = $response.StatusCode
        } catch {
            $status = $_.Exception.Response.StatusCode.value__
            if (-not $status) { $status = "ERR" }
        }
        if ($status -eq 200) {
            Write-Host "  + /$page ($status)" -ForegroundColor Green
        } else {
            Write-Host "  x /$page ($status)" -ForegroundColor Red
        }
    }
}

# ---------------------------------------------------------------------------
# Step 2: build and deploy backend to Cloud Run
# ---------------------------------------------------------------------------
function Deploy-Backend {
    Log "Applying Cloud Storage bucket CORS config..."
    if (Test-Path "cors.json") {
        try {
            gcloud storage buckets update "gs://$STORAGE_BUCKET" `
                --cors-file=cors.json `
                --project $PROJECT
            Log "Bucket CORS applied."
        } catch {
            Warn "Could not apply bucket CORS. Apply manually: gcloud storage buckets update gs://$STORAGE_BUCKET --cors-file=cors.json"
        }
    } else {
        Warn "cors.json not found in repo root - skipping bucket CORS."
    }

    Log "Building Docker image..."
    gcloud builds submit `
        --tag $IMAGE `
        --project $PROJECT `
        --quiet
    Assert-LastExitCode "Docker image build"

    Log "Deploying to Cloud Run ($SERVICE in $REGION)..."

    # Use ^::^ as delimiter so commas inside CORS_ORIGIN are preserved
    $envVars = @(
        "STOREFRONT_BACKEND_SOURCE=firestore",
        "CORS_ORIGIN=https://canopytrove.com,https://app.canopytrove.com,https://canopytrove-webapp.web.app",
        "ALLOW_DEV_SEED=false",
        "REQUEST_LOGGING_ENABLED=true",
        "READ_RATE_LIMIT_PER_MINUTE=600",
        "WRITE_RATE_LIMIT_PER_MINUTE=180",
        "ADMIN_RATE_LIMIT_PER_TEN_MINUTES=30",
        "OWNER_AI_USER_RATE_LIMIT_PER_MINUTE=12",
        "OWNER_AI_DAILY_REQUEST_LIMIT=120",
        "OWNER_AI_MAX_COMPLETION_TOKENS=350",
        "OWNER_AI_INPUT_MODERATION_ENABLED=true",
        "FIREBASE_PROJECT_ID=canopy-trove",
        "FIREBASE_DATABASE_ID=canopytrove",
        "FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET",
        "OPENAI_MODEL=gpt-4o-mini",
        "PHOTO_MODERATION_MODE=auto_approve",
        "OWNER_PORTAL_PRELAUNCH_ENABLED=false",
        "RUNTIME_AUTO_MITIGATION_ENABLED=true",
        "RUNTIME_INCIDENT_THRESHOLD=3",
        "SENTRY_ENVIRONMENT=production",
        "SENTRY_TRACES_SAMPLE_RATE=0.15",
        "OPS_HEALTHCHECK_ENABLED=true",
        "OPS_HEALTHCHECK_INTERVAL_MINUTES=5",
        "OPS_HEALTHCHECK_TIMEOUT_MS=8000",
        "OPS_HEALTHCHECK_FAILURE_CONFIRMATION_SWEEPS=2",
        "OPS_ALERT_COOLDOWN_MINUTES=30",
        "WELCOME_EMAILS_ENABLED=true",
        "EMAIL_DELIVERY_PROVIDER=resend",
        "EMAIL_FROM_ADDRESS=askmehere@canopytrove.com",
        "EMAIL_REPLY_TO_ADDRESS=askmehere@canopytrove.com",
        "OWNER_BILLING_SUCCESS_URL=https://canopytrove.com/owner/billing/success",
        "OWNER_BILLING_CANCEL_URL=https://canopytrove.com/owner/billing/cancel",
        "OWNER_BILLING_PORTAL_RETURN_URL=https://canopytrove.com/owner/billing",
        "STRIPE_OWNER_MONTHLY_PRICE_ID=price_1TJiSyLR2Wj4bkt4L02wmKh8",
        "STRIPE_OWNER_ANNUAL_PRICE_ID=price_1TJiUFLR2Wj4bkt4rFYMK6kP",
        "STRIPE_VERIFIED_MONTHLY_PRICE_ID=price_1TJiSyLR2Wj4bkt4L02wmKh8",
        "STRIPE_VERIFIED_ANNUAL_PRICE_ID=price_1TJiUFLR2Wj4bkt4rFYMK6kP",
        "STRIPE_GROWTH_MONTHLY_PRICE_ID=price_1TJiVqLR2Wj4bkt41RPSuFUY",
        "STRIPE_GROWTH_ANNUAL_PRICE_ID=price_1TJiWJLR2Wj4bkt4b1HTs3YQ",
        "STRIPE_PRO_MONTHLY_PRICE_ID=price_1TJiX0LR2Wj4bkt439RyQVDg",
        "STRIPE_PRO_ANNUAL_PRICE_ID=price_1TJiXVLR2Wj4bkt48YbISvZC",
        "OWNER_LAUNCH_TRIAL_DAYS=60",
        "LAUNCH_PROGRAM_START_AT=2026-04-07T00:00:00.000Z",
        "LAUNCH_PROGRAM_DURATION_DAYS=183",
        "LAUNCH_EARLY_ADOPTER_LIMIT=500",
        "GOOGLE_PLACES_DAILY_BUDGET=20",
        "OPS_HEALTHCHECK_API_URL=https://api.canopytrove.com/health",
        "OPS_HEALTHCHECK_API_RAW_URL=https://canopytrove-api-948351810374.us-east4.run.app/readyz",
        "OPS_ALERT_WEBHOOK_URL=https://discordapp.com/api/webhooks/1490105384680296663/5ZlA1P4oUQrCmB-sxulAr9Guy-F5lsAz9ng3pjeJ4Iwgzoqf8g_WDD_A0Xdf8eJqJfDH"
    ) -join "::"
    $envVars = "^::^$envVars"

    $secrets = @(
        "GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest",
        "ADMIN_API_KEY=ADMIN_API_KEY:latest",
        "STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest",
        "STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest",
        "EXPO_ACCESS_TOKEN=EXPO_ACCESS_TOKEN:latest",
        "SENTRY_DSN=SENTRY_DSN:latest",
        "OPENAI_API_KEY=OPENAI_API_KEY:latest",
        "RESEND_API_KEY=RESEND_API_KEY:latest",
        "RESEND_WEBHOOK_SECRET=RESEND_WEBHOOK_SECRET:latest"
    ) -join ","

    gcloud run deploy $SERVICE `
        --image $IMAGE `
        --region $REGION `
        --platform managed `
        --allow-unauthenticated `
        --port 8080 `
        --memory 512Mi `
        --cpu 1 `
        --min-instances 0 `
        --max-instances 10 `
        --timeout 300 `
        --set-env-vars $envVars `
        --set-secrets $secrets `
        --project $PROJECT
    Assert-LastExitCode "Cloud Run deploy"

    $script:SERVICE_URL = gcloud run services describe $SERVICE `
        --region $REGION `
        --project $PROJECT `
        --format='value(status.url)' 2>$null

    Log "Cloud Run deployed at: $script:SERVICE_URL"
    Write-Host ""
    Write-Host "  Next: set these env vars on the service to enable self-monitoring:"
    Write-Host "    OPS_HEALTHCHECK_API_URL=$script:SERVICE_URL/readyz"
    Write-Host "    OPS_HEALTHCHECK_API_RAW_URL=$script:SERVICE_URL/readyz"
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Step 3: post-deploy verification
# ---------------------------------------------------------------------------
function Verify {
    $serviceUrl = gcloud run services describe $SERVICE `
        --region $REGION `
        --project $PROJECT `
        --format='value(status.url)' 2>$null

    if (-not $serviceUrl) {
        Fail "Could not resolve service URL. Is $SERVICE deployed in $REGION?"
    }

    Log "Running post-deploy verification against $serviceUrl..."

    Write-Host ""
    Write-Host "--- Health ---"
    try { (Invoke-RestMethod -Uri "$serviceUrl/health") | ConvertTo-Json -Depth 5 } catch { Write-Host "  Could not reach /health" -ForegroundColor Red }
    Write-Host ""

    Write-Host "--- Readiness ---"
    try {
        $r = Invoke-WebRequest -Uri "$serviceUrl/readyz" -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "  + /readyz ($($r.StatusCode))" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "  x /readyz ($code)" -ForegroundColor Red
    }
    Write-Host ""

    Write-Host "--- Storefront summaries ---"
    try { (Invoke-RestMethod -Uri "$serviceUrl/storefront-summaries?limit=2").items.Count; Write-Host " items returned" } catch { Write-Host "  Could not reach /storefront-summaries" -ForegroundColor Red }
    Write-Host ""

    Write-Host "--- Legal pages ---"
    $pages = @("privacy", "terms", "community-guidelines", "account-deletion")
    foreach ($page in $pages) {
        try {
            $r = Invoke-WebRequest -Uri "https://canopytrove.com/$page" -Method Head -UseBasicParsing -ErrorAction SilentlyContinue
            Write-Host "  + canopytrove.com/$page" -ForegroundColor Green
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Write-Host "  x canopytrove.com/$page ($code)" -ForegroundColor Red
        }
    }
    Write-Host ""

    Log "Verification complete."
    $script:SERVICE_URL = $serviceUrl
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
Preflight

switch ($Target) {
    "hosting" { Deploy-Hosting }
    "backend" { Deploy-Backend; Verify }
    "verify"  { Verify }
    "all"     { Deploy-Hosting; Deploy-Backend; Verify }
    default   { Fail "Unknown target: $Target. Use: all, hosting, backend, verify" }
}

Write-Host ""
Log "Done. Next manual steps:"
Write-Host "  1. Create Stripe webhook at: $($script:SERVICE_URL)/owner-billing/stripe/webhook"
Write-Host "  2. Run: npm run release:check"
Write-Host "  3. Run: npm --prefix backend run release:check"
