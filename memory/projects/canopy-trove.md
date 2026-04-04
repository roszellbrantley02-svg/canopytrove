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
- GCP project: `canopy-trove`
- Firestore named database: `canopytrove`
- Google Places API enrichment pipeline for storefront discovery
- 627 storefront sources, 612 published, 15 hidden

### Key Backend Services
- **storefrontDiscoveryOrchestrationService.ts** — Discovery sweep scheduler + zombie run recovery
- **googlePlacesClient.ts** — HTTP client with timeout, error classification, degraded state
- **googlePlacesShared.ts** — Caching, in-flight deduplication, auth backoff (60s on 401/403)
- **storefrontDiscoveryEnrichmentService.ts** — Per-source Google Places enrichment

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

## Critical Config
- `STOREFRONT_BACKEND_SOURCE=firestore` MUST be set on Cloud Run (defaults to mock)
- `FIREBASE_DATABASE_ID=canopytrove` MUST be set (connects to wrong DB otherwise)
- `GOOGLE_MAPS_API_KEY` and `ADMIN_API_KEY` via Secret Manager
- `EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED=true` for pre-launch gating

## Known Issues (Resolved)
- Backend ran in mock mode due to missing `STOREFRONT_BACKEND_SOURCE` env var (fixed)
- 500 errors from missing `FIREBASE_DATABASE_ID` for named Firestore DB (fixed)
- Zombie discovery run cleanup — added `recoverStaleDiscoveryRun()` at startup
- Navigation accuracy was correct but user had stale dev build with cached mock data

## App Store Notes
- **Apple (8/10):** Legal URLs wired, need 17+ age rating, OCM verification, fresh preview build
- **Google Play (4/10):** Blanket ban on marijuana-facilitating apps. Would need to avoid cannabis terminology, remove storefront details, focus on "business directory" framing — still high rejection risk.
