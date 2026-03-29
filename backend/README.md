# Canopy Trove Backend

This workspace is the first backend scaffold for the `api` storefront source mode.

Current behavior:

- serves `GET /health`
- serves `GET /market-areas`
- serves `GET /resolve-location`
- serves `GET /profiles/:profileId`
- serves `PUT /profiles/:profileId`
- serves `POST /gamification/:profileId/events`
- serves `GET /leaderboard`
- serves `GET /leaderboard/:profileId/rank`
- serves `GET /profile-state/:profileId`
- serves `PUT /profile-state/:profileId`
- serves `GET /storefront-summaries`
- serves `GET /storefront-summaries/by-ids`
- serves `GET /storefront-details/:storefrontId`
- serves `POST /storefront-details/:storefrontId/reviews`
- serves `POST /storefront-details/:storefrontId/reviews/:reviewId/helpful`
- serves `POST /storefront-details/:storefrontId/reports`
- serves `GET /route-state/:profileId`
- serves `PUT /route-state/:profileId`
- serves `GET /admin/seed-status`
- serves `POST /admin/seed-firestore` when dev seed is enabled
- supports `mock` and `firestore` backend source modes
- falls back to mock if Firestore mode is requested but not configured or if source reads fail
- enforces backend ownership for claimed profiles when Firebase Admin auth verification is available
- validates request params, query strings, and JSON bodies on read/write routes
- applies in-memory fixed-window rate limiting to public reads, writes, and admin endpoints
- can enrich storefront detail responses with Google Places `phone`, `hours`, and `review count` when `GOOGLE_MAPS_API_KEY` is configured

This is intentionally a bridge step.

It proves the API contract and lets the mobile app switch to `api` mode without waiting for the full Firestore or Cloud Function implementation.

## Run

1. Install dependencies
   - `npm install`
2. Start the dev server
   - `npm run dev`
3. Point the app at it
   - `EXPO_PUBLIC_STOREFRONT_SOURCE=api`
   - `EXPO_PUBLIC_STOREFRONT_API_BASE_URL=http://<your-machine-ip>:4100`
4. Run backend integration tests
   - `npm run test`
5. Run a backend smoke pass against the active environment
   - `npm run smoke`

## Hardening defaults

- JSON body size is capped at `128kb`
- `GET` routes are rate-limited per IP
- `POST` and `PUT` routes are rate-limited per IP
- `/admin/*` routes have a stricter limit than standard writes
- malformed query params or bodies return `400` with a validation error message
- each response carries `X-Canopy Trove-Request-Id` and `X-Canopy Trove-Response-Time-Ms`
- backend request logs are emitted as JSON lines when request logging is enabled

Env overrides:

- `READ_RATE_LIMIT_PER_MINUTE`
- `WRITE_RATE_LIMIT_PER_MINUTE`
- `ADMIN_RATE_LIMIT_PER_TEN_MINUTES`
- `REQUEST_LOGGING_ENABLED`
- `CORS_ORIGIN`
  - use `*` for local development only
  - use a comma-separated allowlist for production origins

Local env pattern:

- `backend/.env`
  - release-safe backend defaults
- `backend/.env.local`
  - machine-specific local overrides such as:
    - `CORS_ORIGIN=*`
    - `ALLOW_DEV_SEED=true`
    - `GOOGLE_APPLICATION_CREDENTIALS=C:/Users/<you>/.canopytrove/secrets/firebase/canopy-trove-firebase-adminsdk.json`
    - local-only Stripe or Google Maps keys

## Source modes

### Mock mode

Use:

- `STOREFRONT_BACKEND_SOURCE=mock`

Behavior:

- reads the OCM-verified storefront seed from the app workspace
- useful for validating the API contract and runtime behavior against a larger summary dataset

### Firestore mode

Use:

- `STOREFRONT_BACKEND_SOURCE=firestore`
- `ALLOW_DEV_SEED=true` if you want to use the local seed endpoint
- provide backend Firebase admin credentials in the backend environment

Behavior:

- reads `storefront_summaries` and `storefront_details`
- persists route state to `route_state`
- persists gamification state to `gamification_state`
- persists app profile metadata to `profiles`
- supports combined profile + route-state + gamification bootstrap through `profile-state`
- applies origin/radius narrowing server-side
- applies summary search, sort, and pagination server-side
- resolves typed NY locations from known areas and storefront summary data
- falls back to mock if Firestore config is missing or if source reads fail

Credential options:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
  - raw service account JSON string
- `GOOGLE_APPLICATION_CREDENTIALS`
  - path to a service account file on disk
- `FIREBASE_PROJECT_ID`
  - optional explicit project id override
- `GOOGLE_MAPS_API_KEY`
  - optional Google Maps Platform key for live Places detail enrichment on storefront detail responses
  - used for `place_id` lookup and live `phone` / `hours` / `review count`
  - `place_id` may be persisted; Google Places content itself is fetched live rather than stored as seed data

Health output:

- `GET /health` returns the backend source status so you can see whether it is using Firestore or mock
- `authVerification` indicates whether Firebase Admin token verification is active

Seed endpoints:

- `GET /admin/seed-status`
  - shows whether the seed endpoint is enabled and how many documents are available
- `POST /admin/seed-firestore`
  - writes the OCM-based summary/detail payload into Firestore
  - only works when `ALLOW_DEV_SEED=true`

Auth notes:

- send Firebase ID tokens as `Authorization: Bearer <token>` on profile-scoped API requests
- only real authenticated users should send tokens for backend ownership; anonymous guest sessions stay anonymous
- authenticated writes can claim an anonymous profile and bind it to `accountId`
- once claimed, that profile requires a matching authenticated token for reads and writes

## Notes

- The backend source boundary is now in place.
- The backend now uses Firebase Admin SDK instead of client-style Firebase config.
- After that, the next step is pushing summary generation and verification into scheduled backend jobs instead of reading raw collections directly.
