# Glossary

Workplace shorthand, acronyms, technical terms, and patterns for Canopy Trove.

## Project Terms
| Term | Meaning | Context |
|------|---------|---------|
| discovery run | Backend sweep enriching storefronts via Google Places API | storefrontDiscoveryOrchestrationService.ts |
| storefront | A dispensary listing in the app | 627 total sources in Firestore |
| routeMode | `preview` vs `verified` — affects navigation URL generation | navigationService.ts |
| zombie run | A stuck discovery run record (status "running" forever) | Fixed with recoverStaleDiscoveryRun() |
| source mode | `mock` vs `firestore` — controlled by STOREFRONT_BACKEND_SOURCE | backend/src/sources/index.ts |
| named database | Firestore DB with explicit ID (`canopytrove`) vs default | Requires FIREBASE_DATABASE_ID env var |
| owner portal | Storefront owner management interface | Gated by prelaunch/preview flags |
| arrival prompt | In-app prompt triggered when user arrives at a dispensary | Uses foreground location |
| enrichment | Process of adding Google Places data to a storefront source | storefrontDiscoveryEnrichmentService.ts |
| auth backoff | 60s pause on Google Places API after 401/403 error | googlePlacesShared.ts |

## Acronyms
| Term | Meaning | Context |
|------|---------|---------|
| OCM | Office of Cannabis Management | NY state regulator |
| EAS | Expo Application Services | Build, submit, update pipeline |
| OTA | Over-the-air update | Via EAS Update |
| TTI | Time to Interactive | Startup performance metric |
| ASO | App Store Optimization | Metadata, keywords, screenshots |
| ATT | App Tracking Transparency | iOS privacy requirement |
| AASA | Apple App Site Association | Deep linking config file |
| CSP | Content Security Policy | Security header |
| HSTS | HTTP Strict Transport Security | Security header |
| LRU | Least Recently Used | Cache eviction strategy |
| PII | Personally Identifiable Information | Must be redacted from logs |
| WCAG | Web Content Accessibility Guidelines | AA compliance target |
| FCM | Firebase Cloud Messaging | Push notifications (Android) |
| APNs | Apple Push Notification service | Push notifications (iOS) |

## Tech Stack Terms
| Term | Meaning |
|------|---------|
| Hermes V1 | React Native JS engine — AOT bytecode compilation, 7-9% perf gain |
| Reanimated 3 | Animation library running on UI thread via worklets |
| Zustand | Lightweight global state management (recommended over Redux) |
| TanStack Query | Data fetching/caching library (formerly React Query) |
| Pino | High-throughput JSON logger for Node.js |
| Zod | TypeScript-first schema validation |
| Helmet.js | Express middleware adding 15 security headers |
| expo-image | Cross-platform image component with BlurHash, caching |
| expo-secure-store | Encrypted storage for tokens (NOT AsyncStorage) |
| Maestro | YAML-based E2E testing framework |
| Metro | React Native bundler |

## Design System Terms
| Term | Meaning |
|------|---------|
| design tokens | Centralized constants for colors, spacing, typography |
| 8-point grid | Spacing scale where all values are multiples of 8 (4 for micro) |
| skeleton screen | Loading placeholder matching content layout (better than spinners) |
| shimmer | Animated gradient overlay on skeleton screens |
| hitSlop | Invisible touch area expansion beyond visible element bounds |
| worklet | JavaScript function marked with 'worklet' that runs on UI thread |

## Backend Patterns
| Term | Meaning |
|------|---------|
| operational error | Expected failure (validation, auth) vs programmer error (bug) |
| correlation ID | UUID propagated via X-Correlation-ID for request tracing |
| graceful shutdown | SIGTERM handler closing connections before Cloud Run kills process |
| liveness probe | `/livez` — is the process alive? (fast, no DB check) |
| readiness probe | `/readyz` — can serve traffic? (checks Firestore connectivity) |
| idempotency key | Client-generated UUID preventing duplicate operations on retry |
| sliding window | Rate limiting approach tracking requests in rolling time window |

## Security Patterns
| Term | Meaning |
|------|---------|
| backend gateway | Mobile app calls your backend, which holds real API keys |
| App Check | Firebase device attestation — proves request comes from legitimate app |
| App Attest | iOS-specific device verification for App Check |
| certificate pinning | Validating server certificate fingerprint to prevent MITM |
| Hermes bytecode | Basic obfuscation — bytecode not human-readable but tools exist |
| ProGuard/R8 | Android native code obfuscation and minification |
