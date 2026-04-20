# Canopy Trove

**Status:** Pre-launch (Apple submission imminent)
**Type:** Licensed dispensary discovery app
**Platform:** iOS-first via React Native / Expo
**Owner:** Rozell (solo founder)

## What It Is

Canopy Trove helps users find licensed dispensaries nearby, navigate to them, read/write reviews, and discover deals. Owners can claim storefronts and manage listings via an owner portal with Stripe billing.

## Architecture

### Frontend

- React Native + Expo SDK + TypeScript
- Expo Router for file-based routing
- Firebase Auth for authentication
- SpaceGrotesk (headings) + DM Sans (body) typography
- Dark theme: `#121614` background, `#FFFBF7` text
- `com.rezell.canopytrove` bundle ID

### Backend

- Node.js / Express on Cloud Run
- Service: `canopytrove-api` in `us-east4`
- Current production revision: `canopytrove-api-00198-wlc` (deployed Apr 20 2026)
- Current production image: `us-east4-docker.pkg.dev/canopy-trove/canopytrove-api/canopytrove-api:047c8fb`
- GCP project: `canopy-trove`
- Firestore named database: `canopytrove`
- Google Places API enrichment pipeline for storefront discovery
- 627 storefront sources, 612 published, 15 hidden

### Key Backend Services

- **storefrontDiscoveryOrchestrationService.ts** — Discovery sweep scheduler + zombie run recovery
- **googlePlacesClient.ts** — HTTP client with timeout, error classification, degraded state
- **googlePlacesShared.ts** — Caching, in-flight deduplication, auth backoff (60s on 401/403)
- **storefrontDiscoveryEnrichmentService.ts** — Per-source Google Places enrichment
- **ocmLicenseCacheService.ts** — Hourly-cached bulk OCM license registry with address/name/license indexes (TTL 1h, stale-serve 6h)
- **storefrontOcmEnrichment.ts** — Attaches `ocmVerification` to every storefront summary/detail response (1500ms timeout, fails soft)
- **licenseVerifyRoutes.ts** — Public `GET /licenses/verify` endpoint powering the Verify tab (no auth, cache 5m + SWR 10m)
- **productCatalogService.ts** — COA metadata + 6 NY lab URL parsers (Kaycha, NY Green Analytics, ProVerde, Keystone, ACT, fallback)
- **scanIngestionService.ts** — Anonymous install-ID scan logging, optional location aggregation, brand counter updates
- **brandAnalyticsService.ts** — Regional brand trending, regional brand popularity aggregation, operator dashboard insights
- **scanIngestRoutes.ts** — `POST /scans/ingest` endpoint (App Check gated, 30 req/min)
- **productResolveRoutes.ts** — `GET /products/resolve` endpoint (cached 60s SWR 300s)

### Licensed Shop Verifier Feature

- **Dedicated Verify tab** (previously manual-entry-only, now camera-first) — users can scan a QR code or barcode for instant resolution, or paste a license number, shop name, or address to cross-check against OCM public records
- **Verified licensed badge** — every storefront listing (cards + detail) shows an inline "Verified licensed" pill when the OCM match is successful, updated hourly
- **Data source** — NY OCM public dispensary registry via data.ny.gov SODA API (`jskf-tt3q`)
- **Trust signal** — screenshot-friendly badge that tourists/first-time buyers can share; zero-cost since OCM data is free and public

### Product Scan Feature (new)

**Frontend screens:**

- **VerifyScreen.tsx** (rewritten) — Full-screen camera viewfinder with top-left "Can't scan? Enter info" pill for manual fallback; on-device QR/barcode detection powered by Vision API
- **ScanResultScreen.tsx** (new) — Shared result renderer for all three outcomes (license, product, unknown); displays full COA details including "View full COA" link to lab's hosted report and "Where to find it" section listing shops that stock the brand
- **VerifyManualEntryScreen.tsx** (new) — Modal/overlay for manual text entry fallback (license, name, or address)
- **scanResolutionService.ts** (new) — Frontend service resolving scan results to storefront or product detail

**Backend:**

- **Supported labs:** Kaycha Labs, NY Green Analytics, ProVerde Laboratories, Keystone State Testing, ACT Laboratories, plus generic fallback parser
- **Dual resolution paths:** (1) OCM license QR → existing "Verified licensed" shop flow, (2) COA URL QR from NY lab → product result with lab data (THC %, CBD %, terpenes, contaminant pass/fail)
- **Anonymous logging** — Every scan logged via install ID only (never PII), optional approximate location (aggregate-only), brand/batch identifiers for analytics; disableable in Profile → Privacy
- **Backend pipeline:** `POST /scans/ingest` ingests scan events, `productCatalogService.ts` parses COA URLs, `brandAnalyticsService.ts` aggregates to `brandCounters` collection for trending and operator dashboards
- **Use cases:** Trending brands near you, brand popularity by region, operator insights (which brands drive traffic), user-facing product quality context

### Navigation

- 4-tier fallback: placeId → address → search → raw coordinates
- `routeMode` of 'verified' uses placeId for Google Maps direction URLs
- All callers pass 'verified' as routeMode

### Legal Pages

- Built and deployed via Firebase Hosting (`public-release-pages/` directory)
- Privacy, Terms, Community Guidelines, Account Deletion, About, Support, Storefronts
- All URLs configured in `eas.json` for preview and production builds

### Build Pipeline

- EAS Build with 3 profiles: development, preview, production
- `eas.json` contains legal URLs and feature flags
- `app.config.js` dynamically adds Sentry plugin when org/project env vars set
- iOS deployment target pinned via `expo-build-properties` plugin (SDK 55 removed the top-level `ios.minimumOSVersion` field)
- `google-services.json` lives at repo root for Android Firebase wiring
- `npm install` must run locally — FUSE sandbox cannot mutate `node_modules`
- Full recipes + unblock triage → memory/context/build-and-release.md

## Critical Config

- `STOREFRONT_BACKEND_SOURCE=firestore` MUST be set on Cloud Run (defaults to mock)
- `FIREBASE_DATABASE_ID=canopytrove` MUST be set (connects to wrong DB otherwise)
- `GOOGLE_MAPS_API_KEY` and `ADMIN_API_KEY` via Secret Manager
- `EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED=true` for pre-launch gating
- `OWNER_PORTAL_PRELAUNCH_ENABLED=true` is set on Cloud Run as of Apr 20 2026.
- Backend Docker images push to Artifact Registry (`us-east4-docker.pkg.dev/...`), not the old runbook `gcr.io/...` path.

## Production Backend Deploy — Apr 20 2026

- Commit `9e041b0` fixed preview/production owner portal app gating and added a native-loop fallback for bundled background music. Existing Apple/TestFlight builds do not pick this up until a fresh iOS EAS build is created.
- Commit `047c8fb` added missing backend runtime dependency `zod`; Cloud Build failed without it because Docker installs from `backend/package.json` only.
- Cloud Run revision `canopytrove-api-00198-wlc` is live at 100% traffic on image `us-east4-docker.pkg.dev/canopy-trove/canopytrove-api/canopytrove-api:047c8fb`.
- `https://api.canopytrove.com/health` returns `{ "ok": true }`; `https://api.canopytrove.com/readyz` returns `{ "status": "ready" }`.
- Live storefront summary and detail responses now include `paymentMethods`. A 24-storefront sample returned `cash=true` for all 24, so the Cash badge should render on cards/details.
- Credit badges are intentionally not blanket-filled. `credit` appears only when Google, owner declarations, or community reports say credit is accepted, because cannabis credit-card acceptance can be legally/payment-network inaccurate.

## Custom Icon/Badge Art — Apr 20 2026

- The special icon pack was not lost. It lives in `assets/icons-v4c/` with 66 PNGs plus `asset_manifest.csv` and `asset_manifest.json`. `assets/icons-v4c/_contact_sheet_small.jpg` is the quick visual index.
- Bottom tabs and search were already wired to v4c assets through `src/icons/AppTabIconsV4c.tsx`, `src/icons/ProvidedGlyphIconsV4c.tsx`, and `src/components/SearchField.tsx`.
- The missing visible piece was badge rendering: profile trophy case, badge gallery, owner badge selector, and reward toast were still using generic `AppUiIcon` vector names.
- New bridge: `src/icons/BadgeArtIcon.tsx` maps existing badge icon IDs (for example `rocket-outline`, `shield-checkmark-outline`, `diamond-outline`) to the v4c trophy/badge PNG assets without changing badge IDs or gamification data.

## Known Issues (Resolved)

- Backend ran in mock mode due to missing `STOREFRONT_BACKEND_SOURCE` env var (fixed)
- 500 errors from missing `FIREBASE_DATABASE_ID` for named Firestore DB (fixed)
- Zombie discovery run cleanup — added `recoverStaleDiscoveryRun()` at startup
- Navigation accuracy was correct but user had stale dev build with cached mock data

## App Store Notes

- **Apple (9.5/10):** Legal URLs wired, 17+ age rating confirmed. OCM verification shipped (Verify tab + per-listing badges). Product scan feature shipped (camera-first Verify tab resolving lab COA URLs and shop licenses). Scan data anonymous-only (install ID, optional location aggregate). Camera permission required; NSCameraUsageDescription in place.
- **Google Play (4/10):** Blanket ban on marijuana-facilitating apps. Would need to avoid cannabis terminology, remove storefront details, focus on "business directory" framing — still high rejection risk.

## Known TODOs

- Owner portal self-report flow for brands they carry (for dashboard insights)
- Operator brand analytics widget showing scan trends by region
- App Store Privacy Nutrition Label update for Product Interaction data type
- App Store Privacy Nutrition Label addition for Coarse Location (optional, aggregate-only)
