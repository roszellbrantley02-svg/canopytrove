# Favorite Deal Alerts

Updated: March 28, 2026

## What This Feature Does

Canopy Trove watches a user's saved storefronts and alerts them when one of those favorites gets a new deal.

The deal signal is currently the storefront `promotionText` value. If that text changes from the last known active deal fingerprint, Canopy Trove treats it as a new deal.

## How It Works Right Now

### Preview And Mock Builds

- The app checks saved storefronts locally.
- The first sync is silent.
- After that, Canopy Trove checks again:
  - on app startup
  - when the app returns to the foreground
  - every 15 minutes while the app stays open
- New deals trigger a local device notification.

Main files:

- `src/components/FavoriteDealNotificationBridge.tsx`
- `src/services/favoriteDealNotificationService.ts`
- `src/utils/favoriteDealAlerts.ts`

### API Mode With Authenticated Profiles

- The app calls the backend sync route:
  - `POST /profiles/:profileId/favorite-deal-alerts/sync`
- The backend compares the user's saved storefront ids against persisted deal fingerprints.
- The backend stores the last active deal fingerprint for each saved storefront.
- If a valid Expo push token is registered, the backend can send the alert through Expo's push API.
- If backend push is not available for that profile yet, the app falls back to local device notifications for any backend-reported matches.

Main files:

- `backend/src/routes/favoriteDealAlertRoutes.ts`
- `backend/src/services/favoriteDealAlertService.ts`
- `backend/src/services/expoPushService.ts`
- `src/services/storefrontBackendWriteApi.ts`

## Backend Storage

When backend Firestore is configured, favorite-deal alert state is stored in the Firestore collection:

- `favorite_deal_alerts`

If backend Firestore is not configured, the backend falls back to temporary in-memory storage.

## Current Limitation

This is now backend-aware and push-token aware, but it is not fully autonomous until a dispatcher runs on a schedule.

That means:

- The backend remembers deal fingerprints for authenticated API-mode profiles.
- The backend can send push alerts through Expo when it has a valid registered push token.
- The app can avoid duplicate notifications across backend syncs.
- To check for new deals while the app is completely idle, you still need to run the backend dispatcher on a timer.

## Dispatcher Paths

Manual backend dispatch is now available through:

- backend script:
  - `npm --prefix backend run favorite-deals:dispatch`
- dev/admin route:
  - `POST /admin/dispatch-favorite-deal-alerts`
  - this is only enabled when `ALLOW_DEV_SEED=true`

## For Full Always-On Push

To make it truly always-on while the app is fully idle, schedule the dispatcher to run on your host:

1. Register and persist device push tokens.
2. Run the backend dispatcher from a scheduler or worker without waiting for the app to open.
3. Keep Firestore active so the backend can compare saved storefront deals over time.
