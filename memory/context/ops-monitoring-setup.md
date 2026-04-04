# Ops Monitoring Setup

Status: code integrated, infrastructure not yet provisioned.

## What exists in code

The backend and frontend both have Sentry SDKs integrated with conditional
initialization. If SENTRY_DSN / EXPO_PUBLIC_SENTRY_DSN are set, crash
monitoring activates automatically. If absent, the app runs normally without it.

The backend has a full runtime ops layer:

- `/livez`, `/readyz`, `/health` — health probes, Cloud Run ready.
- `runtimeOpsService` — incident tracking, 15-min window counts, automatic safe
  mode (circuit breaker) when critical incidents exceed a threshold.
- `healthMonitorService` — scheduled uptime sweeps against configured targets,
  with failure counting, fingerprinted alert deduplication, and webhook
  notifications.
- `opsAlertSubscriptionService` — push alert delivery for runtime incidents.
- Structured JSON logging on stdout — Cloud Logging parses automatically.
- Request telemetry middleware — correlation IDs, response time measurement.
- Graceful shutdown on SIGTERM with 9 s drain window.

The release readiness check (`npm run release:check --prefix backend`) already
validates Sentry DSN, OPS_HEALTHCHECK_* targets, and alert webhook presence as
recommended (non-blocking) items.

## Step 1 — Sentry project

1. Create a Sentry org (or use an existing one) at sentry.io.
2. Create two projects: `canopytrove-backend` (Node) and `canopytrove-app`
   (React Native).
3. Copy each project's DSN.
4. Backend: add `SENTRY_DSN=<backend-dsn>` to the Cloud Run env (via Secret
   Manager or direct env). Optional: `SENTRY_TRACES_SAMPLE_RATE=0.15`.
5. Frontend: add `EXPO_PUBLIC_SENTRY_DSN=<app-dsn>` to EAS build secrets for
   the production profile.
6. Verify: deploy, trigger a test exception, confirm it shows in Sentry.

## Step 2 — Cloud Run alerting

These gcloud commands create basic alert policies for the `canopytrove-api`
service in `us-east4`. Adjust the notification channel ID to match your
email/Slack/PagerDuty channel.

### Create a notification channel (email)

```bash
gcloud alpha monitoring channels create \
  --display-name="Rozell Email" \
  --type=email \
  --channel-labels=email_address=roszellbrantley02@gmail.com \
  --project=canopy-trove
```

Note the returned channel ID (e.g. `projects/canopy-trove/notificationChannels/XXXX`).

### Error rate alert (>5% 5xx over 5 min)

```bash
gcloud alpha monitoring policies create \
  --display-name="canopytrove-api: elevated 5xx rate" \
  --condition-display-name="5xx rate > 5%" \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="canopytrove-api" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"' \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --combiner=OR \
  --notification-channels="projects/canopy-trove/notificationChannels/XXXX" \
  --project=canopy-trove
```

### Latency alert (p95 > 3 s over 5 min)

```bash
gcloud alpha monitoring policies create \
  --display-name="canopytrove-api: high p95 latency" \
  --condition-display-name="p95 latency > 3s" \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="canopytrove-api" AND metric.type="run.googleapis.com/request_latencies"' \
  --condition-threshold-value=3000 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --combiner=OR \
  --notification-channels="projects/canopy-trove/notificationChannels/XXXX" \
  --project=canopy-trove
```

### Instance count alert (>10 concurrent, cost guard)

```bash
gcloud alpha monitoring policies create \
  --display-name="canopytrove-api: high instance count" \
  --condition-display-name="instance count > 10" \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="canopytrove-api" AND metric.type="run.googleapis.com/container/instance_count"' \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --combiner=OR \
  --notification-channels="projects/canopy-trove/notificationChannels/XXXX" \
  --project=canopy-trove
```

## Step 3 — Uptime check

Option A: use the built-in runtime health monitor by setting env vars on
Cloud Run:

```
OPS_HEALTHCHECK_API_URL=https://canopytrove-api-XXXXX-ue.a.run.app/readyz
OPS_HEALTHCHECK_API_RAW_URL=https://canopytrove-api-XXXXX-ue.a.run.app/readyz
OPS_ALERT_WEBHOOK_URL=<slack-webhook-or-email-webhook>
```

This makes the backend self-monitor on a schedule and alert via webhook if
its own health check or the public URL fails.

Option B: use GCP Uptime Checks (external probe, more reliable for detecting
full outages):

```bash
gcloud monitoring uptime create \
  --display-name="canopytrove-api readyz" \
  --resource-type=uptime-url \
  --hostname="canopytrove-api-XXXXX-ue.a.run.app" \
  --path="/readyz" \
  --protocol=HTTPS \
  --period=5 \
  --timeout=10s \
  --project=canopy-trove
```

Both approaches are complementary: the GCP uptime check catches full outages
(service unreachable), while the built-in monitor catches degraded states
(storefront source down, Firestore unreachable).

## Step 4 — Verify end to end

1. Run `npm run release:check --prefix backend` — the Sentry DSN, health
   monitor target, and alert webhook checks should flip from WARN to PASS.
2. Trigger a test 5xx (e.g. POST to an invalid admin route) and confirm the
   Cloud Monitoring alert fires within 5 minutes.
3. Stop the Cloud Run service temporarily and confirm the uptime check alert
   fires.
4. Throw a test exception in both the app and backend and confirm Sentry
   receives both.

## Env var summary

| Var | Where | Required for launch |
|-----|-------|---------------------|
| `SENTRY_DSN` | Cloud Run | Recommended |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS secrets | Recommended |
| `SENTRY_TRACES_SAMPLE_RATE` | Cloud Run | Optional (default 0.15) |
| `OPS_HEALTHCHECK_API_URL` | Cloud Run | Recommended |
| `OPS_HEALTHCHECK_API_RAW_URL` | Cloud Run | Recommended |
| `OPS_HEALTHCHECK_SITE_URL` | Cloud Run | Optional |
| `OPS_ALERT_WEBHOOK_URL` | Cloud Run | Recommended |
