# Canopy Trove Owner Portal Architecture

## Scope

This document defines the production Firebase architecture for the Canopy Trove dispensary owner portal. It is designed to sit on top of the current Canopy Trove mobile app and Firestore data model without creating a second source of truth.

The owner portal has four hard constraints:

1. Only verified dispensary owners can claim a dispensary.
2. Only verified and subscribed owners can publish hot deals.
3. Only verified and subscribed owners can upload premium storefront photos.
4. Sensitive verification documents are private by default and never publicly readable.

## Platform Layout

- Owner mobile app or owner section in the Expo app
- Admin web dashboard for Canopy Trove staff
- Firebase Authentication for identity
- Cloud Firestore for product state
- Firebase Storage for photos and private verification documents
- Cloud Functions for Firebase for orchestration, verification processing, Stripe webhooks, badge automation, and moderation
- Stripe for subscriptions
- Optional third-party identity verification provider for KYC and ID review

## Auth and Roles

### Authentication

- Email/password sign-up and sign-in
- Password reset through Firebase Auth
- Separate owner onboarding flow after base account creation
- Firestore `users/{uid}` document created on auth user creation
- Firebase custom claims:
  - `role=customer`
  - `role=owner`
  - `role=admin`
  - optional booleans:
    - `ownerVerified`
    - `subscriptionActive`

### Role model

- `customer`
  - can browse, review, save, and engage with storefronts
- `owner`
  - can begin onboarding and claim a dispensary
  - cannot publish premium content until verified and subscribed
- `admin`
  - can approve claims, documents, photos, deals, and badge overrides

## Firestore Collections

### users/{uid}

```json
{
  "uid": "uid_123",
  "email": "owner@example.com",
  "role": "owner",
  "displayName": "Avery Green",
  "createdAt": "2026-03-26T14:00:00.000Z",
  "lastLoginAt": "2026-03-26T14:10:00.000Z",
  "accountStatus": "active"
}
```

### ownerProfiles/{uid}

```json
{
  "uid": "uid_123",
  "legalName": "Avery Green",
  "phone": "+1-555-555-1000",
  "companyName": "Canopy Trove Holdings LLC",
  "identityVerificationStatus": "pending",
  "businessVerificationStatus": "pending",
  "dispensaryId": "disp_abc",
  "onboardingStep": "identity_verification",
  "subscriptionStatus": "inactive",
  "badgeLevel": 2,
  "earnedBadgeIds": ["verified-store", "photo-complete"],
  "selectedBadgeIds": ["verified-store"],
  "createdAt": "2026-03-26T14:00:00.000Z",
  "updatedAt": "2026-03-26T14:10:00.000Z"
}
```

### dispensaries/{dispensaryId}

This remains the public storefront source of truth for the mobile app.

```json
{
  "dispensaryId": "disp_abc",
  "legalBusinessName": "Canopy Trove Holdings LLC",
  "storefrontName": "The Coughie Shop",
  "licenseNumber": "OCM-12345",
  "licenseType": "adult-use-retail-dispensary",
  "state": "NY",
  "address": "12044 E Main St",
  "city": "Wolcott",
  "zip": "14590",
  "lat": 43.2202487,
  "lng": -76.8139293,
  "phone": "+1-555-555-1000",
  "website": "https://example.com",
  "description": "Public storefront description",
  "hours": ["Mon: 10am-8pm", "Tue: 10am-8pm"],
  "amenities": ["Parking", "Wheelchair accessible"],
  "socialLinks": {
    "instagram": "https://instagram.com/example"
  },
  "ownerUid": "uid_123",
  "claimStatus": "claimed",
  "listingStatus": "public",
  "averageRating": 4.7,
  "reviewCount": 215,
  "photoCount": 8,
  "selectedBadgeIds": ["verified-store", "top-rated"],
  "createdAt": "2026-03-26T14:00:00.000Z",
  "updatedAt": "2026-03-26T14:10:00.000Z"
}
```

### dispensaryClaims/{claimId}

```json
{
  "ownerUid": "uid_123",
  "dispensaryId": "disp_abc",
  "claimStatus": "pending",
  "submittedAt": "2026-03-26T14:00:00.000Z",
  "reviewedAt": null,
  "reviewNotes": null
}
```

### businessVerifications/{verificationId}

```json
{
  "ownerUid": "uid_123",
  "dispensaryId": "disp_abc",
  "legalBusinessName": "Canopy Trove Holdings LLC",
  "storefrontName": "The Coughie Shop",
  "licenseNumber": "OCM-12345",
  "licenseType": "adult-use-retail-dispensary",
  "state": "NY",
  "address": "12044 E Main St, Wolcott, NY 14590",
  "uploadedLicenseFilePath": "owner-private/uid_123/business/license.pdf",
  "uploadedBusinessDocPath": "owner-private/uid_123/business/registration.pdf",
  "verificationStatus": "pending",
  "verificationSource": "owner_upload",
  "matchedRecord": {
    "dispensaryId": "disp_abc",
    "matchScore": 0.94
  },
  "adminNotes": null,
  "submittedAt": "2026-03-26T14:00:00.000Z",
  "reviewedAt": null
}
```

### identityVerifications/{verificationId}

```json
{
  "ownerUid": "uid_123",
  "fullName": "Avery Green",
  "idType": "drivers_license",
  "idDocumentFrontPath": "owner-private/uid_123/identity/front.jpg",
  "idDocumentBackPath": "owner-private/uid_123/identity/back.jpg",
  "selfiePath": "owner-private/uid_123/identity/selfie.jpg",
  "verificationStatus": "pending",
  "provider": "manual_review",
  "providerReferenceId": null,
  "adminNotes": null,
  "submittedAt": "2026-03-26T14:00:00.000Z",
  "reviewedAt": null,
  "expiresAt": "2027-03-26T14:00:00.000Z"
}
```

### subscriptions/{subscriptionId}

```json
{
  "ownerUid": "uid_123",
  "dispensaryId": "disp_abc",
  "provider": "stripe",
  "externalSubscriptionId": "sub_123",
  "planId": "owner-pro-monthly",
  "status": "active",
  "billingCycle": "monthly",
  "currentPeriodStart": "2026-03-26T14:00:00.000Z",
  "currentPeriodEnd": "2026-04-26T14:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "createdAt": "2026-03-26T14:00:00.000Z",
  "updatedAt": "2026-03-26T14:00:00.000Z"
}
```

### deals/{dealId}

```json
{
  "dispensaryId": "disp_abc",
  "ownerUid": "uid_123",
  "title": "20% off first purchase",
  "description": "Valid for new customers only",
  "imagePath": "dispensary-media/disp_abc/pending/uid_123/deals/deal_1.jpg",
  "terms": "Must be 21+ and present valid ID",
  "startDate": "2026-03-27T00:00:00.000Z",
  "endDate": "2026-03-31T23:59:59.000Z",
  "status": "scheduled",
  "moderationStatus": "pending",
  "createdAt": "2026-03-26T14:00:00.000Z",
  "updatedAt": "2026-03-26T14:00:00.000Z"
}
```

### storefrontPhotos/{photoId}

```json
{
  "dispensaryId": "disp_abc",
  "ownerUid": "uid_123",
  "filePath": "dispensary-media/disp_abc/pending/uid_123/storefront/photo_1.jpg",
  "photoType": "storefront",
  "moderationStatus": "pending",
  "approved": false,
  "createdAt": "2026-03-26T14:00:00.000Z"
}
```

### badges/{badgeId}

```json
{
  "badgeId": "verified-store",
  "name": "Verified Store",
  "description": "Business and identity fully verified",
  "iconKey": "badge_verified_store",
  "category": "milestone",
  "unlockType": "rule",
  "criteria": {
    "businessVerificationStatus": "verified",
    "identityVerificationStatus": "verified"
  },
  "active": true
}
```

### badgeProgress/{ownerUid}

```json
{
  "ownerUid": "uid_123",
  "dispensaryId": "disp_abc",
  "unlockedBadgeIds": ["verified-store"],
  "progressMap": {
    "photo-complete": 3,
    "first-deal-published": 0
  },
  "currentLevel": 2,
  "completedTaskIds": ["complete-business-verification"],
  "updatedAt": "2026-03-26T14:00:00.000Z"
}
```

### ownerTasks/{taskId}

```json
{
  "taskId": "publish-first-deal",
  "title": "Publish your first deal",
  "description": "Create and publish one approved storefront deal",
  "category": "growth",
  "completionRule": {
    "eventType": "deal_published",
    "count": 1
  },
  "rewardBadgeId": "first-deal-published",
  "rewardXp": 250,
  "active": true
}
```

### auditLogs/{logId}

```json
{
  "actorUid": "uid_admin",
  "actorRole": "admin",
  "actionType": "business_verification_approved",
  "targetType": "businessVerification",
  "targetId": "verification_123",
  "metadata": {
    "ownerUid": "uid_123",
    "dispensaryId": "disp_abc"
  },
  "createdAt": "2026-03-26T14:00:00.000Z"
}
```

### adminActions/{actionId}

```json
{
  "adminUid": "uid_admin",
  "actionType": "deal_rejected",
  "targetId": "deal_123",
  "notes": "Terms missing",
  "createdAt": "2026-03-26T14:00:00.000Z"
}
```

## Storage Folder Strategy

```text
owner-private/{ownerUid}/business/{fileName}
owner-private/{ownerUid}/identity/{fileName}
dispensary-media/{dispensaryId}/pending/{ownerUid}/{photoType}/{fileName}
dispensary-media/{dispensaryId}/approved/{photoType}/{fileName}
dispensary-media/{dispensaryId}/approved/owner/{ownerUid}/{photoType}/{fileName}
community-review-media/pending/{profileId}/{storefrontId}/{draftId}/{fileName}
community-review-media/quarantine/{storefrontId}/{reviewId}/{mediaId}/{fileName}
community-review-media/approved/{storefrontId}/{reviewId}/{mediaId}/{fileName}
deals-media/{dispensaryId}/{ownerUid}/{dealId}/{fileName}
```

Rules:

- `owner-private/**` is readable only by the owning user and admins
- `dispensary-media/**/approved/**` is public read
- `dispensary-media/**/pending/**` is owner/admin only and still reserved for moderated submissions
- `dispensary-media/**/approved/owner/**` is for verified, subscribed storefront owners uploading live profile media
- `community-review-media/**/pending/**` is private until moderation approves or quarantines the upload
- `community-review-media/**/approved/**` is public read only after approval
- `community-review-media/**/quarantine/**` is admin-only hold space for unsafe or uncertain member uploads
- `deals-media/**` is now admin-only compatibility storage until a deal-media surface is added
- owner storefront media uploads are validated by Firebase rules against canonical ownership, verification, and subscription state

## Onboarding Flow

### Owner flow

1. Create owner account
2. Create `users/{uid}` and `ownerProfiles/{uid}`
3. Enter business details
4. Claim or match dispensary listing
5. Upload business verification docs
6. Upload identity docs and selfie
7. Wait for review
8. Activate subscription
9. Unlock dashboard

The `ownerProfiles/{uid}.onboardingStep` field is the source of truth for resume and gating.

## Cloud Functions Architecture

### Auth triggers

- `onAuthUserCreated`
  - create `users/{uid}`
  - create default `ownerProfiles/{uid}` when owner onboarding starts
- `onAuthUserDeleted`
  - mark owner profile inactive

### Callable / HTTPS functions

- `startOwnerOnboarding`
- `submitBusinessVerification`
- `submitIdentityVerification`
- `claimDispensary`
- `createStripeCheckoutSession`
- `portalSession`
- `publishDeal`
- `approveDeal`
- `approvePhoto`
- `selectStorefrontBadges`

### Firestore triggers

- `onBusinessVerificationWrite`
  - create admin review task
  - update owner verification state
- `onIdentityVerificationWrite`
  - update owner verification state
- `onSubscriptionWrite`
  - mirror `subscriptionStatus` into `ownerProfiles`
- `onDealWrite`
  - publish/expire deals based on status changes
- `onStorefrontPhotoWrite`
  - update `photoCount` on approved photos
- `onBadgeProgressWrite`
  - sync `selectedBadgeIds` into `dispensaries`

### Scheduled functions

- `expireDealsDaily`
- `syncBadgeProgressDaily`
- `cleanupExpiredIdentityArtifacts`
- `refreshOwnerListingCompleteness`
- `aggregateAnalyticsDaily`

## Verification Logic

### Business verification

Inputs:

- legal business name
- storefront name
- license number
- license type
- state
- business address
- uploaded license document
- uploaded registration document

Processing:

1. Validate required fields
2. Match against `dispensaries`
3. Match against internal OCM/license dataset
4. Score confidence and flag mismatches
5. Create review task for admin when confidence is low
6. Update `businessVerificationStatus`

Statuses:

- `unverified`
- `pending`
- `verified`
- `rejected`
- `needs_resubmission`

### Identity verification

Inputs:

- ID front
- ID back
- selfie

Processing:

1. Upload to private Storage path
2. Write metadata doc
3. Call third-party provider if enabled, otherwise queue manual review
4. Store provider reference ID
5. Update `identityVerificationStatus`

Statuses:

- `unverified`
- `pending`
- `verified`
- `failed`
- `expired`

## Subscription Model

Premium features unlocked by `ownerProfiles.subscriptionStatus in ['trial', 'active']`:

- hot deals publishing
- premium photo uploads
- badge display customization
- enhanced listing management

Stripe flow:

1. Owner starts checkout from app or owner portal
2. Cloud Function creates Checkout Session
3. Stripe webhook writes `subscriptions/{subscriptionId}`
4. Firestore trigger mirrors `status` into `ownerProfiles`
5. UI gates features off `businessVerificationStatus`, `identityVerificationStatus`, and `subscriptionStatus`

Statuses:

- `inactive`
- `trial`
- `active`
- `past_due`
- `canceled`
- `suspended`

## Owner Dashboard Sections

- home overview
- business verification status
- identity verification status
- subscription status
- storefront editor
- deals manager
- photo manager
- badges and progress
- analytics and engagement

## Admin Dashboard Sections

- claim review queue
- business verification queue
- identity verification queue
- photo moderation
- deal moderation
- subscription exceptions
- badge overrides
- audit history

## Badge and Progression Logic

Badge progress is event-driven.

Events that should advance progress:

- business verification completed
- identity verification completed
- subscription activated
- photo approved
- deal published
- review milestones crossed
- average rating threshold maintained
- listing completeness threshold reached

Cloud Functions write to:

- `badgeProgress/{ownerUid}`
- `ownerProfiles/{uid}.earnedBadgeIds`
- `dispensaries/{dispensaryId}.selectedBadgeIds`

## Analytics Tie-In

Owner portal analytics must use the same event and aggregation system as the consumer app.

Key owner metrics:

- storefront views
- storefront opens
- hot deal impressions and opens
- hot deal redemptions
- review prompt response rate
- review submission rate
- listing completeness
- badge unlock progression
- subscription conversion
- onboarding conversion

Recommended analytics collections:

- `analytics_events`
- `analytics_daily_app_metrics`
- `analytics_daily_storefront_metrics`
- `analytics_daily_deal_metrics`
- `analytics_daily_search_metrics`
- `analytics_daily_signup_metrics`

## Security Rules

The concrete rules files are:

- [firestore.rules](C:/Users/eleve/Documents/New%20project/canopy-trove-3/firebase/firestore.rules)
- [storage.rules](C:/Users/eleve/Documents/New%20project/canopy-trove-3/firebase/storage.rules)

Production rule strategy:

- direct public read only for approved public storefront documents and approved public photos
- owner writes constrained to owned records
- admin review state controlled by custom claims and server-side functions
- verification records and documents private by default
- subscription state written by server/webhooks, not trusted client writes
- analytics collections admin/server read only

## Phased Implementation Roadmap

### Phase 1

- owner auth
- owner profile docs
- dispensary claim flow
- business verification upload
- identity verification upload
- admin review queue
- private Storage rules

### Phase 2

- Stripe subscriptions
- premium photo uploads
- hot deals manager
- deal moderation
- owner analytics dashboard

### Phase 3

- badge progression automation
- owner task engine
- advanced admin tooling
- third-party identity verification
- subscription lifecycle automation and retention flows

### Phase 4

- multi-location owner organizations
- staff seats and delegated permissions
- deal redemption attribution
- payout and promo tooling
