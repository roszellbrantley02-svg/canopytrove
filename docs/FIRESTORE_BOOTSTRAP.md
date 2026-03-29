# Firestore Bootstrap

## Goal

Populate the two storefront collections used by Canopy Trove:

- `storefront_summaries`
- `storefront_details`

These collections are the expected input for the Firebase source adapter.

## Required environment

Set these values in your local `.env` file:

- `EXPO_PUBLIC_STOREFRONT_SOURCE=firebase`
- `EXPO_PUBLIC_FIREBASE_API_KEY=...`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID=...`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...`
- `EXPO_PUBLIC_FIREBASE_APP_ID=...`

If these values are incomplete, the app falls back to `mock`.

## Seed payload

The Firestore seed payload is derived from the current New York OCM dispensary verification list plus curated rich storefront overrides for matching official storefronts in:

- [C:\Users\eleve\Documents\New project\canopy-trove-3\src\data\ocmVerifiedStorefrontRecords.generated.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/data/ocmVerifiedStorefrontRecords.generated.ts)
- [C:\Users\eleve\Documents\New project\canopy-trove-3\src\data\storefrontSeedRecords.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/data/storefrontSeedRecords.ts)

The generated Firestore-ready document maps live in:

- [C:\Users\eleve\Documents\New project\canopy-trove-3\src\data\mockFirestoreSeed.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/data/mockFirestoreSeed.ts)

The generated official OCM source file is produced by:

- `npm run generate:ocm-verified-seed`

## Seed service

The write helpers live in:

- [C:\Users\eleve\Documents\New project\canopy-trove-3\src\services\firestoreSeedService.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/services/firestoreSeedService.ts)
- [C:\Users\eleve\Documents\New project\canopy-trove-3\src\services\storefrontSeedService.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/services/storefrontSeedService.ts)

Available functions:

- `getMockFirestoreSeedCounts()`
- `getMockFirestoreSeedPayload()`
- `seedMockStorefrontCollections(db)`

## Recommended bootstrap order

1. Create the Firebase project and Firestore database.
2. Add the Firebase env values.
3. Run or call `seedMockStorefrontCollections(db)` from a one-off bootstrap path.
4. Restart the app.
5. Confirm Profile shows `Data source: firebase`.

## Batch write note

The OCM-derived storefront seed path is larger than the Firestore 500-write limit for a single batch.

Canopy Trove now writes seed data in multiple batches automatically. Do not collapse that back to a single `writeBatch()` call.

## Important rule

Do not seed one combined storefront collection for both list and detail screens.

Keep the split:

- summaries for Nearby and Browse
- details for Storefront Detail

That split is part of the performance model for Canopy Trove.
