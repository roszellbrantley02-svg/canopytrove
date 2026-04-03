# Google Maps Key Hardening

Updated: March 31, 2026

## Current State

Canopy Trove no longer ships a bundled Google Places REST key in the mobile app.

The app now relies on:

- backend storefront detail responses
- backend Google Places enrichment in `backend/src/services/googlePlacesService.ts`
- outbound map deep links only on device

The mobile build config no longer includes `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `eas.json`, and the client-side Places fallback has been retired from the active app path.

## What Changed

- Direct client-side Places enrichment was removed from:
  - `src/hooks/useStorefrontDetailData.ts`
  - `src/hooks/useStorefrontOperationalStatus.ts`
- The old client-only operational fallback service is no longer part of the live app path.
- Storefront detail screens now recheck the backend briefly while server-side enrichment finishes instead of calling Google from the device.

## Security Outcome

This is the safest code-level improvement available in the current architecture because:

- Google traffic is now backend-owned
- quota abuse risk from a public mobile key is removed
- Google request policy stays centralized on the server
- app builds no longer need a public Places web-service key

## Remaining Platform Tasks

- [ ] Keep only `GOOGLE_MAPS_API_KEY` on the backend and make sure it is restricted to the exact Google APIs the server uses.
- [ ] Rotate any older client key that was previously shipped in Expo build config.
- [ ] Monitor Google Cloud quota and error metrics after the rotation.

## Project Values

- Android package name: `com.rezell.canopytrove`
- Backend env var: `GOOGLE_MAPS_API_KEY`

## Official References

- [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)
- [Set up the Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Places Web Service FAQ](https://developers.google.com/maps/documentation/places/web-service/faq)

## Practical Recommendation

Do not reintroduce a generic mobile Google Places REST fallback.

If Canopy Trove needs richer map or place behavior later, use one of these:

1. keep the backend as the only Google caller
2. move to a supported native SDK path with platform-native protection

For the current launch posture, backend-only enrichment is the right security boundary.
