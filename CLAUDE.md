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
| Monitoring  | Sentry (planned), Cloud Logging                              |
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

| Term          | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| discovery run | Backend sweep that enriches storefronts via Google Places API |
| storefront    | A dispensary listing (627 sources in DB)                      |
| routeMode     | `preview` vs `verified` — affects navigation URL generation   |
| zombie run    | A stuck discovery run record (status "running" forever)       |
| OCM           | Office of Cannabis Management (NY regulator)                  |
| placeId       | Google Place ID for precise navigation                        |
| EAS           | Expo Application Services (build + submit + update)           |
| OTA           | Over-the-air update via EAS Update                            |

→ Full glossary: memory/glossary.md

## App Store Status

| Store       | Readiness | Notes                                                          |
| ----------- | --------- | -------------------------------------------------------------- |
| Apple       | 8/10      | Legal URLs wired, 17+ rating needed, OCM verification required |
| Google Play | 4/10      | Blanket ban on marijuana-facilitating apps                     |

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
