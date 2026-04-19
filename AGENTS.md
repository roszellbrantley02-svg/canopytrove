# Memory

## Me

Rozell (rozell), solo founder building Canopy Trove — a licensed dispensary discovery app for iOS (React Native/Expo). Handles frontend, backend, and deployment.

## Project

| Name             | What                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Canopy Trove** | Licensed dispensary discovery app. RN/Expo frontend + Node/Express Cloud Run backend + Firestore named DB |

→ Details: memory/projects/canopy-trove.md

## Stack Quick Ref

| Layer       | Tech                                                         |
| ----------- | ------------------------------------------------------------ |
| Frontend    | React Native, Expo SDK, TypeScript, Expo Router              |
| Backend     | Node.js/Express on Cloud Run (`canopytrove-api`, `us-east4`) |
| Database    | Firestore named database `canopytrove` (NOT `(default)`)     |
| Auth        | Firebase Auth                                                |
| Maps        | Google Places API (backend gateway pattern)                  |
| Build       | EAS Build (development, preview, production profiles)        |
| Hosting     | Firebase Hosting for legal pages                             |
| Monitoring  | Sentry (integrated, needs DSN), Cloud Logging, runtime ops   |
| GCP Project | `canopy-trove`                                               |
| Bundle ID   | `com.rezell.canopytrove`                                     |

## Key Env Vars

| Var                         | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `STOREFRONT_BACKEND_SOURCE` | `firestore` or defaults to `mock` — MUST be set on Cloud Run         |
| `FIREBASE_DATABASE_ID`      | `canopytrove` — required for named Firestore DB                      |
| `GOOGLE_MAPS_API_KEY`       | Via Secret Manager on Cloud Run                                      |
| `ADMIN_API_KEY`             | Via Secret Manager on Cloud Run                                      |
| `EXPO_PUBLIC_*`             | Client-visible env vars (legal URLs, Firebase config, feature flags) |
| `SENTRY_DSN`                | Backend crash monitoring — Sentry project DSN                        |
| `EXPO_PUBLIC_SENTRY_DSN`    | Frontend crash monitoring — Sentry project DSN                       |
| `OPS_HEALTHCHECK_API_URL`   | Runtime uptime monitor target (public API URL)                       |
| `OPS_ALERT_WEBHOOK_URL`     | Webhook for runtime health failure alerts                            |

## Design Tokens

| Token            | Value                    |
| ---------------- | ------------------------ |
| Background       | `#121614` (dark theme)   |
| Heading font     | SpaceGrotesk             |
| Body font        | DM Sans                  |
| Accent green     | `#2ECC71`                |
| Accent gold      | `#E8A000`                |
| Text primary     | `#FFFBF7`                |
| Text secondary   | `#C4B8B0`                |
| Min touch target | 48dp                     |
| Spacing scale    | 4, 8, 12, 16, 24, 32, 48 |
| Border radius    | sm:4, md:8, lg:12, xl:16 |

## Terms

| Term            | Meaning                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| discovery run   | Backend sweep that enriches storefronts via Google Places API                               |
| storefront      | A dispensary listing (627 sources in DB)                                                    |
| routeMode       | `preview` vs `verified` — affects navigation URL generation                                 |
| zombie run      | A stuck discovery run record (status "running" forever)                                     |
| OCM             | Office of Cannabis Management (NY regulator)                                                |
| placeId         | Google Place ID for precise navigation                                                      |
| EAS             | Expo Application Services (build + submit + update)                                         |
| OTA             | Over-the-air update via EAS Update                                                          |
| COA             | Certificate of Analysis; lab report with cannabinoid potency, terpenes, contaminant results |
| product scan    | User-initiated camera capture in Verify tab resolving to shop license or product COA        |
| brand counter   | Aggregated Firestore document counting scans per brand across regions and time              |
| scan resolution | Discriminated union result: `license`, `product`, or `unknown`                              |

→ Full glossary: memory/glossary.md

## App Store Status

| Store       | Readiness | Notes                                                                                                                            |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Apple       | 9.5/10    | Legal URLs wired, 17+ rating needed. Camera permission newly required. OCM verification + product scan **shipped** — Verify tab. |
| Google Play | 4/10      | Blanket ban on marijuana-facilitating apps                                                                                       |

## Licensed Shop Verifier (shipped)

| Layer              | Piece                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Data source        | NY OCM public dispensary registry via data.ny.gov SODA API (`jskf-tt3q`), refreshed hourly                                            |
| Backend cache      | `ocmLicenseCacheService.ts` — TTL 1h, stale-serve 6h, Maps indexed by license / address+zip / normalized name                         |
| Backend enrichment | `storefrontOcmEnrichment.ts` attaches `ocmVerification` to every summary & detail (fail-soft, 1500ms budget)                          |
| Public endpoint    | `GET /licenses/verify?license=&name=&address=&city=&zip=` — no auth, Cache-Control 5m + SWR 10m                                       |
| Frontend tab       | `Verify` tab sits between `HotDeals` and `Profile`; `src/screens/VerifyScreen.tsx` form + result + disclaimer                         |
| Listing badge      | `LicensedBadge` inline pill on `StorefrontRouteCard`, full card on `StorefrontDetailScreen` — "Per OCM public records, updated today" |

## Product Scan Pipeline (shipped)

| Layer            | Piece                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data source      | 6 NY lab COA URL parsers (Kaycha Labs, NY Green Analytics, ProVerde, Keystone State Testing, ACT Laboratories, generic fallback)                        |
| Backend services | `productCatalogService.ts` (lab metadata + parsing), `scanIngestionService.ts` (anonymous install-ID logging), `brandAnalyticsService.ts` (aggregation) |
| Endpoints        | `POST /scans/ingest` (App Check gated, 30 req/min), `GET /products/resolve` (cached 60s SWR 300s)                                                       |
| Firestore        | `productScans` collection (anonymous by install ID), `brandCounters` aggregation collection (regional brand trending)                                   |
| Frontend tab     | `VerifyScreen.tsx` — camera-first with full-bleed CameraView, top-left "Can't scan? Enter info" pill for manual fallback                                |
| Result screen    | `ScanResultScreen.tsx` — shared renderer handling license/product/unknown resolutions, displays lab results or shop verification                        |
| Privacy          | Anonymous by default (install ID only, never PII), optional location (aggregate-only), no cross-app tracking, disableable in Profile → Privacy          |

## Architecture Patterns (Research-Backed)

| Pattern                         | Where    | Reference                             |
| ------------------------------- | -------- | ------------------------------------- |
| Token-based design system       | Frontend | memory/context/ui-polish.md           |
| Reanimated 3 spring animations  | Frontend | memory/context/ui-polish.md           |
| Skeleton loading screens        | Frontend | memory/context/ui-polish.md           |
| Structured JSON logging (Pino)  | Backend  | memory/context/backend-hardening.md   |
| Zod request validation          | Backend  | memory/context/backend-hardening.md   |
| Graceful shutdown (SIGTERM)     | Backend  | memory/context/backend-hardening.md   |
| Health probes (/livez, /readyz) | Backend  | memory/context/backend-hardening.md   |
| Helmet.js security headers      | Backend  | memory/context/backend-hardening.md   |
| expo-secure-store for tokens    | Frontend | memory/context/hooks-and-secrets.md   |
| Backend gateway for API keys    | Both     | memory/context/hooks-and-secrets.md   |
| Firebase App Check              | Both     | memory/context/hooks-and-secrets.md   |
| Hermes V1 bytecode              | Frontend | memory/context/frontend-production.md |
| expo-image with caching         | Frontend | memory/context/frontend-production.md |
| EAS Update OTA rollouts         | Frontend | memory/context/frontend-production.md |
| Maestro E2E testing             | Frontend | memory/context/frontend-production.md |

## Preferences

- Solo developer — values speed and pragmatism
- Dark theme first
- iOS-first launch strategy
- Prefers concise explanations with actionable next steps
