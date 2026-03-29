# Google Maps Key Hardening

Updated: March 28, 2026

## Current State

The app currently uses `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in:

- `src/services/storefrontOperationalDataService.ts`
- `eas.json` for the `preview` build profile

That key is used for the storefront-detail fallback that fetches:

- website
- phone
- hours
- `openNow`

The backend separately uses `GOOGLE_MAPS_API_KEY` in:

- `backend/src/services/googlePlacesService.ts`

Right now those two env vars are using the same key value in local development. That is acceptable as a recovery step, but it is not the long-term secure setup.

## Recommended Target Setup

Use two separate keys:

1. A backend-only key for `backend/src/services/googlePlacesService.ts`
2. A mobile client key for `src/services/storefrontOperationalDataService.ts`

## Important Constraint

The current mobile fallback is a direct client-side Places web-service call, not the native Places SDK for Android.

That means normal backend-style key handling does not apply cleanly, and a plain Android restriction is only safe if the app request path is set up correctly for direct mobile web-service calls. Google's guidance for this case is:

- use a separate key for the client app
- restrict the key
- prefer native SDKs or a secure proxy/backend when possible
- for direct mobile web-service calls on Android, use the `X-Android-Package` and `X-Android-Cert` headers

## Checklist

- [ ] Create a new Google Maps Platform key just for the mobile app.
- [ ] Do not reuse the backend key for the mobile app.
- [ ] Restrict the mobile key to only the API surface the app uses for the fallback.
- [ ] Review Metrics Explorer for the key before and after restrictions.
- [ ] If staying with direct mobile web-service calls, verify the Android request path is compatible with restricted-key requirements.
- [ ] If not, move the storefront operational fallback behind the backend or migrate it to a supported native SDK path.
- [ ] After the new client key is deployed and verified, rotate the older shared key out of the mobile app.

## Project Values To Use During Restriction

- Android package name: `com.rezell.canopytrove`
- Client env var: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Backend env var: `GOOGLE_MAPS_API_KEY`

## Official References

- [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)
- [Set up the Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Use App Check to secure your API key](https://developers.google.com/maps/documentation/places/android-sdk/app-check)

## Practical Recommendation

For the current preview recovery phase, keep the client fallback because it repairs the broken storefront detail experience and no longer depends on the dead LAN API URL.

For the hardening phase, the cleanest long-term option is to treat the current client-side Places fallback as temporary and move that enrichment behind the backend again once you have a stable hosted API target.
