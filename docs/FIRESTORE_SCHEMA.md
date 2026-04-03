# Firestore Schema

## Purpose

Canopy Trove uses storefront-facing collections:

- `profiles`
- `storefront_summaries`
- `storefront_details`
- `route_state`
- `gamification_state`
- `storefront_app_reviews`
- `storefront_reports`

The split is deliberate.

- Nearby and Browse read `storefront_summaries`
- Detail screens read `storefront_details`

Do not merge these back into one hot-path collection for list screens.

## Collection: `storefront_summaries`

Document id:

- `storefront_id`

Fields:

- `licenseId: string`
- `marketId: string`
- `displayName: string`
- `legalName: string`
- `addressLine1: string`
- `city: string`
- `state: "NY"`
- `zip: string`
- `latitude: number`
- `longitude: number`
- `distanceMiles: number`
- `travelMinutes: number`
- `rating: number`
- `reviewCount: number`
- `openNow: boolean`
- `isVerified: boolean`
- `mapPreviewLabel: string`
- `placeId?: string`
- `thumbnailUrl?: string | null`

Rules:

- list screens should not require any fields outside this document
- no long review arrays here
- no photo galleries here
- no business-hour arrays here
- the current Firebase source uses `latitude` range queries plus longitude and exact-distance filtering after read

Recommended indexes:

- `marketId ASC, latitude ASC`
- `latitude ASC`
- `zip ASC, latitude ASC`
- `city ASC, latitude ASC`

Reason:

- Nearby and Browse now resolve from the active origin, not only from `marketId`
- the source uses `marketId` as a narrowing hint and `latitude` as the primary Firestore range filter
- for common search patterns, the source may opportunistically narrow by exact `zip` or normalized `city` before the client-side substring filter runs

## Collection: `storefront_details`

Document id:

- `storefront_id`

Fields:

- `phone: string | null`
- `website: string | null`
- `hours: string[]`
- `googleReviews: GoogleReview[]`
- `appReviewCount: number`
- `appReviews: AppReview[]`
- `photoUrls: string[]`
- `amenities: string[]`
- `editorialSummary: string | null`
- `routeMode: "preview" | "verified"`

Review object shapes:

### `googleReviews[]`

- `id: string`
- `authorName: string`
- `rating: number`
- `relativeTime: string`
- `text: string`

### `appReviews[]`

- `id: string`
- `authorName: string`
- `authorProfileId: string | null`
- `rating: number`
- `relativeTime: string`
- `text: string`
- `tags: string[]`
- `helpfulCount: number`

## Seed source

The mock canonical records are converted into these Firestore documents in:

- [C:\Users\eleve\Documents\New project\canopy-trove-3\src\data\mockFirestoreSeed.ts](C:/Users/eleve/Documents/New%20project/canopy-trove-3/src/data/mockFirestoreSeed.ts)

That file exists so future seed/import scripts can write a real Firestore shape without inventing a second schema.

## Collection: `route_state`

Document id:

- `profile_id`

Fields:

- `profileId: string`
- `savedStorefrontIds: string[]`
- `recentStorefrontIds: string[]`
- `activeRouteSession: { storefrontId: string; routeMode: "preview" | "verified"; startedAt: string } | null`
- `routeSessions: ActiveRouteSession[]`
- `plannedRouteStorefrontIds: string[]`

Rules:

- this is profile-scoped navigation state, not storefront content
- the current profile id is a local app identifier and should later be replaced by a real authenticated user/account identifier
- when backend Firestore mode is active, route-state API reads and writes should persist to this collection
- the combined `profile-state` API should keep route-state and profile reads aligned during bootstrap

## Collection: `gamification_state`

Document id:

- `profile_id`

Fields:

- `profileId: string`
- `totalPoints: number`
- `totalReviews: number`
- `totalPhotos: number`
- `totalHelpfulVotes: number`
- `currentStreak: number`
- `longestStreak: number`
- `lastReviewDate: string | null`
- `lastActiveDate: string | null`
- `dispensariesVisited: number`
- `visitedStorefrontIds: string[]`
- `badges: string[]`
- `joinedDate: string`
- `level: number`
- `nextLevelPoints: number`
- `reviewsWithPhotos: number`
- `detailedReviews: number`
- `fiveStarReviews: number`
- `oneStarReviews: number`
- `commentsWritten: number`
- `reportsSubmitted: number`
- `friendsInvited: number`
- `followersCount: number`
- `totalRoutesStarted: number`

Rules:

- this is profile-scoped rewards and progression state
- it should persist independently of route-state so badges, trophies, and levels survive app reinstalls and backend restarts
- explorer-style progress should only advance on strong storefront interactions, not loose search/browse activity
- the combined `profile-state` API should read and write this collection alongside `profiles` and `route_state`

## Collection: `storefront_app_reviews`

Document id:

- generated review id

Fields:

- `id: string`
- `storefrontId: string`
- `profileId: string`
- `authorName: string`
- `rating: number`
- `text: string`
- `tags: string[]`
- `photoCount: number`
- `helpfulCount: number`
- `helpfulVoterIds: string[]`
- `createdAt: string`

Rules:

- these are Canopy Trove community reviews, not Google reviews
- detail reads should overlay these onto the base storefront detail payload
- review submission should also trigger the review reward path
- helpful votes should update these records and feed the helpful-vote reward path for the review author
- `photoCount` is a summary count only; actual member review photos live in the moderated review-media pipeline and only become public after approval

## Collection: `storefront_review_photos`

Document id:

- generated media id

Fields:

- `id: string`
- `storefrontId: string`
- `profileId: string`
- `reviewId: string`
- `storagePath: string`
- `approvedStoragePath?: string | null`
- `fileName: string`
- `mimeType: string | null`
- `size: number | null`
- `moderationStatus: "pending" | "needs_manual_review" | "approved" | "rejected"`
- `createdAt: string`
- `reviewedAt: string | null`
- `reviewNotes: string | null`

Rules:

- pending review photos must remain private until moderation approves them
- the public storefront detail surface should only receive approved photo URLs
- the moderation queue should be readable by the uploader and admins, but writable only by the uploader on create and by admins during review

## Collection: `storefront_reports`

Document id:

- generated report id

Fields:

- `id: string`
- `storefrontId: string`
- `profileId: string`
- `authorName: string`
- `reason: string`
- `description: string`
- `createdAt: string`

Rules:

- reports are moderation/data-quality inputs, not storefront-facing content
- report submission should trigger the report reward path

## Collection: `profiles`

Document id:

- `profile_id`

Fields:

- `id: string`
- `kind: "anonymous" | "authenticated"`
- `accountId: string | null`
- `displayName: string | null`
- `createdAt: string`
- `updatedAt: string`

Rules:

- this is the Canopy Trove app-profile layer
- it exists so route state can attach to a formal profile concept before full account enforcement is added
- when Firebase auth is active, `accountId` should carry the auth user id
- `displayName` should remain nullable because anonymous and guest identities may not have a user-facing name
