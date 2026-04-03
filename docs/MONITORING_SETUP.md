# Canopy Trove Monitoring Setup

Canopy Trove now supports optional Sentry monitoring on both the Expo app and the Node backend.
The repo-side release checks now also call out two distinct production states:

- hosted monitoring missing
- owner AI still running in fallback-only mode because `OPENAI_API_KEY` is not configured

## What is wired already

- Mobile runtime monitoring:
  - `EXPO_PUBLIC_SENTRY_DSN`
  - `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
  - `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
- Backend monitoring:
  - `SENTRY_DSN`
  - `SENTRY_ENVIRONMENT`
  - `SENTRY_TRACES_SAMPLE_RATE`
- Existing runtime incident reporting remains active and still drives protected mode.

If the DSNs are blank, monitoring stays disabled and the app/backend continue to use the current internal runtime reporting only.

## Mobile setup

1. Create a Sentry React Native project.
2. Copy the public DSN into:
   - `.env.local` for local testing
   - EAS env for preview/production
3. Set:
   - `EXPO_PUBLIC_SENTRY_DSN`
   - `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
   - `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`

If you want native release crash stacks to resolve back to source lines, also set these in hosted build env:

- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

## Backend setup

1. Create a Sentry Node/Express project.
2. Add the DSN to the hosted backend env:
   - `SENTRY_DSN`
   - `SENTRY_ENVIRONMENT`
   - `SENTRY_TRACES_SAMPLE_RATE`

## Owner AI setup

The owner AI assistant is always wired in the app and backend routes.
Without a live provider key, the backend intentionally falls back to local copy templates.

For live model-backed owner AI on the hosted backend, set:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)

If `OPENAI_API_KEY` is blank, owner AI still works, but it runs in fallback mode only.

## Runtime sweeps and alerts

The backend also includes a scheduled health monitor for the public API and website.

Set these backend env vars when you want uptime sweeps and outbound alerts:

- `OPS_HEALTHCHECK_ENABLED=true`
- `OPS_HEALTHCHECK_API_URL=https://api.canopytrove.com/health`
- `OPS_HEALTHCHECK_SITE_URL=https://canopytrove.com`
- `OPS_HEALTHCHECK_TIMEOUT_MS=8000`
- `OPS_HEALTHCHECK_INTERVAL_MINUTES=5`
- `OPS_ALERT_WEBHOOK_URL=<your webhook>`
- `OPS_ALERT_COOLDOWN_MINUTES=30`

The scheduler only runs when at least one target URL is configured. Failures and recoveries can emit webhook alerts and also feed the runtime incident stream.

## Optional mobile source maps

`app.config.js` will add the Sentry Expo config plugin automatically when these env vars exist:

- `SENTRY_ORG`
- `SENTRY_PROJECT`

For native/EAS source map upload, also provide:

- `SENTRY_AUTH_TOKEN`

Do not commit the auth token. Set these in hosted build env instead of hardcoding them into `eas.json`.

## Verify

App:

1. Set `EXPO_PUBLIC_SENTRY_DSN`
2. Restart Expo or rebuild the dev client
3. Trigger a handled error path or temporary test exception

Backend:

1. Set `SENTRY_DSN`
2. Restart the backend
3. Trigger a server-side error and confirm it appears in Sentry

Health monitor:

1. Set the `OPS_HEALTHCHECK_*` env vars
2. Restart the backend
3. Open the internal admin runtime panel and run a manual health sweep
4. Confirm `/health` now includes `runtimeMonitoring`

## Current behavior

- Mobile runtime errors still post to `/client-errors`
- Backend incidents still feed the runtime mitigation system
- Sentry is an external monitoring layer on top of the existing fail-safe logic, not a replacement for it
- scheduled health sweeps and webhook alerts are backend-driven, not mobile-driven
