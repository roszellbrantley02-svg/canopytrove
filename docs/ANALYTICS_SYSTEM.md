# Canopy Trove Analytics System

## Goal

Track real product usage for Canopy Trove across:

- app opens
- session duration
- screen views
- location behavior
- search behavior
- storefront engagement
- deal engagement
- review funnel behavior
- signup conversion

This analytics system is event-based and Firestore-backed.

## Event Pipeline

### Client side

The mobile app now emits analytics events through:

- [analyticsService.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/services/analyticsService.ts)

Current instrumentation points:

- app/session lifecycle
- screen views
- location changes
- Browse sort and hot deals filter changes
- storefront impressions
- storefront opens
- `Go Now` taps
- review prompt shown
- review started
- review submitted

### Backend side

The backend ingests event batches through:

- [analyticsRoutes.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/backend/src/routes/analyticsRoutes.ts)
- [analyticsEventService.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/backend/src/services/analyticsEventService.ts)

## Raw Event Storage

### analytics_events/{eventId}

```json
{
  "eventId": "uuid",
  "eventType": "storefront_opened",
  "installId": "install-abc",
  "sessionId": "session-xyz",
  "profileId": "profile_123",
  "accountId": "firebase_uid",
  "profileKind": "anonymous",
  "screen": "StorefrontDetail",
  "storefrontId": "disp_abc",
  "dealId": null,
  "metadata": {
    "sourceScreen": "Nearby"
  },
  "occurredAt": "2026-03-26T14:00:00.000Z",
  "receivedAt": "2026-03-26T14:00:01.000Z",
  "platform": "android",
  "appVersion": null,
  "ipAddress": "::ffff:127.0.0.1",
  "userAgent": "Expo"
}
```

## Aggregated Collections

### analytics_daily_app_metrics/{yyyy-mm-dd}

Use for:

- app opens per day
- sessions started/ended
- total session duration
- screen views
- signup starts/completions
- sign-ins
- password reset requests
- review starts/submissions

### analytics_daily_storefront_metrics/{yyyy-mm-dd_storefrontId}

Use for:

- storefront impression count
- storefront open count
- `Go Now` taps
- review prompt shown count
- review start count
- review submit count

### analytics_daily_deal_metrics/{yyyy-mm-dd_dealId}

Use for:

- deal impressions
- deal opens
- saves
- redemption starts
- redemptions

### analytics_daily_search_metrics/{yyyy-mm-dd}

Use for:

- search submissions
- search clears
- location prompts shown
- location granted/denied
- location changes
- Browse sort changes
- hot deals toggles

### analytics_daily_signup_metrics/{yyyy-mm-dd}

Use for:

- signup starts
- signup completions

### analytics_daily_query_metrics/{yyyy-mm-dd_hash}

Use for:

- top normalized search terms
- daily search distribution

## Current Questions This System Can Answer

### User activity

- how many times the app was opened
- how many sessions started
- how long sessions lasted
- which screens were viewed most often

### Store engagement

- which storefronts were seen in Nearby/Browse
- which storefronts were opened
- which storefronts received `Go Now` taps

### Deal engagement

Current app state:

- deal toggles and hot-deals browse behavior can be tracked
- full deal analytics by `dealId` is ready in schema but depends on the owner deal system

### Location and search behavior

- how often users grant or deny location
- how often they change location
- whether they use device, ZIP, city, or address-style input
- top normalized search queries once search submission events are enabled

### Review behavior

- how often review prompts are shown
- how often users start a review
- how often they submit a review
- review prompt to review submit conversion

### Signup behavior

- signup started
- signup completed
- sign-in events
- password reset requests

## Owner Portal Tie-In

The owner portal should reuse the same event pipeline, with owner-specific events added:

- `owner_onboarding_started`
- `owner_onboarding_step_completed`
- `business_verification_submitted`
- `business_verification_approved`
- `identity_verification_submitted`
- `identity_verification_approved`
- `subscription_checkout_started`
- `subscription_activated`
- `deal_created`
- `deal_published`
- `deal_expired`
- `photo_uploaded`
- `photo_approved`
- `badge_unlocked`
- `badge_selected`

Those events should update the same analytics collections plus owner-facing reporting documents.

## Privacy Rules

Production constraints:

- do not store raw government ID data in analytics
- do not store full verification documents in analytics
- avoid storing raw user-entered home addresses in analytics metadata
- for location behavior, store source and coarse classification, not sensitive exact input
- restrict analytics collections to server/admin access

## Recommended Next Steps

1. Add admin-only analytics read endpoints or an admin dashboard.
2. Add owner portal event instrumentation when owner flows ship.
3. Add deal-level analytics when real `deals/{dealId}` documents become public-facing.
4. Add BigQuery export once event volume outgrows Firestore-only reporting.
