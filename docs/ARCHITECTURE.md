# Architecture

## High-level direction

Canopy Trove should not rely on the mobile client to do all matching, verification, and enrichment live.

That is the main lesson from Canopy Trove 2.

The new system should separate:

- identity
- summary
- details
- routing
- enrichment

## Recommended stack

### Mobile

- Expo / React Native
- TypeScript
- React Navigation
- TanStack Query

### Backend

Stay on Firebase unless there is a strong reason to migrate.

- Firebase Auth
- Firestore
- Cloud Functions or scheduled backend jobs
- Storage for uploaded review media

Reason:

- current project already uses Firebase
- fastest path to a clean restart is reusing the auth/backend base, not changing the platform

## Core data model

### 1. `license_records`

Official source-of-truth import from New York OCM data.

Fields:

- `license_id`
- `license_type`
- `legal_name`
- `storefront_name`
- `address_1`
- `city`
- `state`
- `zip`
- `status`
- `is_retail_storefront`
- `source_updated_at`

Rules:

- Only retail storefront license types are eligible for consumer lists.
- Delivery-only or not-yet-public locations should be flagged and excluded.

### 2. `storefront_matches`

Precomputed match table between official storefronts and Google places.

Fields:

- `license_id`
- `google_place_id`
- `match_confidence`
- `match_method`
- `matched_name`
- `matched_address`
- `matched_latitude`
- `matched_longitude`
- `verified_destination_latitude`
- `verified_destination_longitude`
- `last_verified_at`

Rules:

- This is computed by backend jobs, not by the app at runtime.
- Address-first matching should be primary.
- Name scoring is secondary.

### 3. `storefront_summaries`

Data optimized for Home and Browse.

Fields:

- `storefront_id`
- `display_name`
- `address`
- `city`
- `state`
- `zip`
- `latitude`
- `longitude`
- `google_place_id`
- `rating`
- `review_count`
- `thumbnail_url`
- `open_now`
- `is_verified`
- `summary_updated_at`

Rules:

- This is the only list-screen payload.
- It must be cheap to fetch.
- No long review payloads here.

### 4. `storefront_details`

Data optimized for the detail screen.

Fields:

- `storefront_id`
- `photos`
- `hours`
- `phone`
- `website`
- `google_reviews`
- `editorial_summary`
- `amenities`
- `details_updated_at`

Rules:

- Details are loaded on demand.
- Missing detail data should not block summary screens.

## Request model

## Location model

The client should keep two separate location concepts:

- `deviceLocation`
  - what the phone reports
- `searchLocation`
  - what the user is intentionally browsing around

List queries should use one resolved query object:

- `storefrontQuery`
  - `areaId`
  - `searchQuery`
  - `origin`
  - `locationLabel`

Rules:

- the UI should not pass loose `areaId` and `searchQuery` pairs around screen-by-screen
- Nearby and Browse should both read the same resolved query shape
- distance and travel estimates should be derived from the active query origin, not baked into the source rows
- typed location search should resolve through a dedicated location service, not directly in screens
- geocoded search should be New York biased and reverse-geocode verified before becoming the active search origin
- resolved location labels should come from the geocoded result where possible, not only from raw user input
- in `api` mode, typed location search should prefer a backend `/resolve-location` contract before falling back to Expo geocoding

## Identity model

Canopy Trove should support two identity layers without forcing the storefront architecture to change later:

- `appProfile`
  - local-first Canopy Trove profile metadata
  - owns saved, recent, route, and planning state
- `authSession`
  - Firebase-backed identity when configured
  - can be `disabled`, `signed-out`, `anonymous`, or `authenticated`

Rules:

- the app must boot and function without forcing sign-in
- anonymous app profiles remain valid even when Firebase auth is unavailable
- when a Firebase session exists, the app profile should project that state into:
  - `kind`
  - `accountId`
  - `displayName`
- backend profile-state APIs should keep using the Canopy Trove profile ID today, but the model must be ready to resolve that profile to a real authenticated account later
- guest identity should be treated as an upgrade path, not a separate app architecture

## Source boundary

The mobile app repository layer should not import raw mock data, Firestore collections, or backend SDK calls directly.

Use a dedicated source boundary instead:

- `storefrontSource`
  - returns summary rows for list screens
  - returns detail payloads for detail screens
- `storefrontRepository`
  - applies search, sorting, limits, pagination, caching, and orchestration

Current source summary query shape:

- `areaId?`
- `searchQuery?`
- `origin?`
- `radiusMiles?`
- `sortKey?`
- `limit?`
- `offset?`

This keeps the screen and hook layer stable when the data source changes from:

- mock source
- Firebase source
- imported NY OCM snapshot
- backend API

The repository contract should stay the same while the source implementation changes underneath it.

Important rule:

- source list methods must not load detail documents
- source detail methods must not block on list queries
- source list methods may use `areaId` as a backend hint, but the repository should still derive the visible Nearby and Browse results from the resolved query origin and distance radius

That split is required to keep Nearby and Browse fast.

Current implementations:

- `mockStorefrontSource`
  - default development source
- `firebaseStorefrontSource`
  - enabled only when `EXPO_PUBLIC_STOREFRONT_SOURCE=firebase`
  - requires Firebase environment configuration
- `apiStorefrontSource`
  - enabled only when `EXPO_PUBLIC_STOREFRONT_SOURCE=api`
  - requires `EXPO_PUBLIC_STOREFRONT_API_BASE_URL`
  - should be the preferred production-facing integration once a backend summary/detail API exists

Runtime fallback rule:

- if `api` or `firebase` source requests fail at runtime, the app currently falls back to `mock`
- this keeps the shell usable during backend bring-up
- production mode should eventually replace this with explicit observability and controlled degraded states

Environment contract:

- `EXPO_PUBLIC_STOREFRONT_SOURCE`
  - `mock`, `firebase`, or `api`
- `EXPO_PUBLIC_STOREFRONT_API_BASE_URL`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

### Nearby / Browse list screens

Mobile app requests:

- `storefront_summaries` near location

Returned first:

- id
- name
- address
- lat/lng
- rating
- review count
- open state

Loaded later:

- optional route preview asset
- optional list-specific enrichment

### Detail screen

Mobile app requests:

- `storefront_details` by `storefront_id`

If stale:

- backend refreshes detail cache in background

## Matching strategy

### Do not do this on-device

- broad Google search
- full legal-name scoring against raw license list
- repeated store matching on every screen load

### Do this in backend jobs

1. Import official NY OCM data on a schedule.
2. Normalize addresses.
3. Find candidate Google places using address-first queries.
4. Score candidates.
5. Persist verified match results.
6. Generate summary and detail records.

## Performance rules

1. Nearby screen loads summaries only.
2. Browse screen loads summaries only.
3. Details screen loads detail payload only when opened.
4. Route previews must not block first card paint.
5. Storefront photos must not block list screens.
6. First paint should prefer cached summaries.
7. Matching should be precomputed and cached.

## UI data contract

The UI should work with two stable models:

### `StorefrontSummary`

- what list screens need

### `StorefrontDetails`

- what detail screen needs

If this separation is respected, the UI stays fast.

If it is broken, list screens will become slow again.

## Key technical decision

The single biggest architecture change for Canopy Trove is:

Move storefront identity and Google matching out of the hot client path.

That change matters more than any isolated UI optimization.
