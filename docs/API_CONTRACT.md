# Storefront API Contract

## Purpose

Canopy Trove can now run in three source modes:

- `mock`
- `firebase`
- `api`

`api` mode is the forward-looking production path.

The mobile app should not know whether the backend uses Firestore, Cloud Functions, or another service behind that API. It should only know the contract.

Environment:

- `EXPO_PUBLIC_STOREFRONT_SOURCE=api`
- `EXPO_PUBLIC_STOREFRONT_API_BASE_URL=https://your-api-base`

Auth:

- profile-scoped endpoints may accept `Authorization: Bearer <firebase-id-token>`
- only authenticated non-anonymous Firebase sessions should send this token
- when a valid token is present, the backend can bind the profile to `accountId = <firebase uid>`
- once a profile is claimed, that same account token is required for future profile-scoped reads and writes

## Endpoints

### `GET /resolve-location`

Resolves a typed New York location query into a location origin the app can browse around.

Query params:

- `query: string`

Response:

```json
{
  "coordinates": {
    "latitude": 43.1566,
    "longitude": -77.6088
  },
  "label": "Rochester, NY",
  "source": "summary"
}
```

Rules:

- should prefer known NY market-area matches first
- should otherwise resolve from backend storefront summary data
- should return `unavailable` when the backend cannot confidently resolve the query

### `GET /market-areas`

Returns the market areas the client should expose in the location selector.

Response:

```json
[
  {
    "id": "rochester",
    "label": "Rochester",
    "subtitle": "Rochester metro",
    "center": {
      "latitude": 43.1566,
      "longitude": -77.6088
    }
  }
]
```

### `GET /profiles/:profileId`

Returns the Canopy Trove app profile metadata for a client/profile scope.

Response:

```json
{
  "id": "canopytrove-profile-demo",
  "kind": "anonymous",
  "accountId": null,
  "displayName": null,
  "createdAt": "2026-03-25T09:00:00.000Z",
  "updatedAt": "2026-03-25T09:30:00.000Z"
}
```

### `PUT /profiles/:profileId`

Creates or updates the Canopy Trove app profile metadata for a client/profile scope.

### `GET /leaderboard`

Returns the Canopy Trove all-time rewards leaderboard built from persisted gamification state.

Query params:

- `limit?: number`
- `offset?: number`

Response:

```json
{
  "items": [
    {
      "profileId": "canopytrove-profile-demo",
      "displayName": null,
      "profileKind": "anonymous",
      "totalPoints": 85,
      "level": 1,
      "badgeCount": 1,
      "totalReviews": 0,
      "totalPhotos": 0,
      "dispensariesVisited": 1,
      "totalRoutesStarted": 1,
      "rank": 1,
      "updatedAt": "2026-03-25T09:30:00.000Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

### `GET /leaderboard/:profileId/rank`

Returns the current all-time leaderboard rank for one Canopy Trove profile.

Response:

```json
{
  "profileId": "canopytrove-profile-demo",
  "rank": 1,
  "total": 1
}
```

### `POST /gamification/:profileId/events`

Applies one gamification activity event for the profile and returns the resulting reward outcome plus updated progression state.

Request body examples:

```json
{
  "activityType": "route_started",
  "payload": {
    "storefrontId": "storefront-1",
    "routeMode": "verified"
  }
}
```

```json
{
  "activityType": "review_submitted",
  "payload": {
    "rating": 5,
    "textLength": 180,
    "photoCount": 2
  }
}
```

Response:

```json
{
  "activityType": "route_started",
  "pointsEarned": 35,
  "badgesEarned": [
    {
      "id": "visitor_1",
      "name": "First Stop",
      "description": "Visit your first dispensary",
      "icon": "location-outline",
      "color": "#00F58C",
      "category": "explorer",
      "points": 25,
      "requirement": 1,
      "hidden": false,
      "tier": "bronze"
    }
  ],
  "levelBefore": 1,
  "levelAfter": 1,
  "updatedState": {
    "profileId": "canopytrove-profile-demo",
    "totalPoints": 35,
    "totalReviews": 0,
    "totalPhotos": 0,
    "totalHelpfulVotes": 0,
    "currentStreak": 1,
    "longestStreak": 1,
    "lastReviewDate": null,
    "lastActiveDate": "2026-03-25T09:30:00.000Z",
    "dispensariesVisited": 1,
    "visitedStorefrontIds": ["storefront-1"],
    "badges": ["visitor_1"],
    "joinedDate": "2026-03-25T09:00:00.000Z",
    "level": 1,
    "nextLevelPoints": 100,
    "reviewsWithPhotos": 0,
    "detailedReviews": 0,
    "fiveStarReviews": 0,
    "oneStarReviews": 0,
    "commentsWritten": 0,
    "reportsSubmitted": 0,
    "friendsInvited": 0,
    "followersCount": 0,
    "totalRoutesStarted": 1
  }
}
```

### `GET /profile-state/:profileId`

Returns the profile metadata, storefront route-state payload, and gamification state in one request for app bootstrap and refresh.

Response:

```json
{
  "profile": {
    "id": "canopytrove-profile-demo",
    "kind": "anonymous",
    "accountId": null,
    "displayName": null,
    "createdAt": "2026-03-25T09:00:00.000Z",
    "updatedAt": "2026-03-25T09:30:00.000Z"
  },
  "routeState": {
    "profileId": "canopytrove-profile-demo",
    "savedStorefrontIds": ["storefront-9"],
    "recentStorefrontIds": ["storefront-4"],
    "activeRouteSession": null,
    "routeSessions": [],
    "plannedRouteStorefrontIds": ["storefront-2"]
  },
  "gamificationState": {
    "profileId": "canopytrove-profile-demo",
    "totalPoints": 85,
    "totalReviews": 0,
    "totalPhotos": 0,
    "totalHelpfulVotes": 0,
    "currentStreak": 1,
    "longestStreak": 1,
    "lastReviewDate": null,
    "lastActiveDate": "2026-03-25T09:30:00.000Z",
    "dispensariesVisited": 1,
    "visitedStorefrontIds": ["storefront-1"],
    "badges": ["visitor_1"],
    "joinedDate": "2026-03-25T09:00:00.000Z",
    "level": 1,
    "nextLevelPoints": 100,
    "reviewsWithPhotos": 0,
    "detailedReviews": 0,
    "fiveStarReviews": 0,
    "oneStarReviews": 0,
    "commentsWritten": 0,
    "reportsSubmitted": 0,
    "friendsInvited": 0,
    "followersCount": 0,
    "totalRoutesStarted": 1
  }
}
```

### `PUT /profile-state/:profileId`

Stores the Canopy Trove profile metadata, storefront route-state payload, and gamification state together in one request.

Request body:

```json
{
  "profile": {
    "id": "canopytrove-profile-demo",
    "kind": "anonymous",
    "accountId": null,
    "displayName": null,
    "createdAt": "2026-03-25T09:00:00.000Z",
    "updatedAt": "2026-03-25T09:30:00.000Z"
  },
  "routeState": {
    "profileId": "canopytrove-profile-demo",
    "savedStorefrontIds": ["storefront-9"],
    "recentStorefrontIds": ["storefront-4"],
    "activeRouteSession": null,
    "routeSessions": [],
    "plannedRouteStorefrontIds": ["storefront-2"]
  },
  "gamificationState": {
    "profileId": "canopytrove-profile-demo",
    "totalPoints": 85,
    "totalReviews": 0,
    "totalPhotos": 0,
    "totalHelpfulVotes": 0,
    "currentStreak": 1,
    "longestStreak": 1,
    "lastReviewDate": null,
    "lastActiveDate": "2026-03-25T09:30:00.000Z",
    "dispensariesVisited": 1,
    "visitedStorefrontIds": ["storefront-1"],
    "badges": ["visitor_1"],
    "joinedDate": "2026-03-25T09:00:00.000Z",
    "level": 1,
    "nextLevelPoints": 100,
    "reviewsWithPhotos": 0,
    "detailedReviews": 0,
    "fiveStarReviews": 0,
    "oneStarReviews": 0,
    "commentsWritten": 0,
    "reportsSubmitted": 0,
    "friendsInvited": 0,
    "followersCount": 0,
    "totalRoutesStarted": 1
  }
}
```

### `GET /storefront-summaries`

Returns summary rows for Nearby and Browse.

Query params:

- `areaId?: string`
- `searchQuery?: string`
- `originLat?: number`
- `originLng?: number`
- `radiusMiles?: number`
- `sortKey?: 'distance' | 'rating' | 'reviews' | 'name'`
- `limit?: number`
- `offset?: number`

Rules:

- `areaId` is optional and should be treated as a narrowing hint, not the final result authority
- `searchQuery` should filter storefront identity fields like name, address, city, and ZIP
- `originLat`, `originLng`, and `radiusMiles` should drive the actual geographic result set
- `sortKey` should be applied server-side
- `limit` and `offset` should page the already-filtered summary result set
- response items should already be summary-safe and cheap to render

Response:

```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": "storefront-1",
      "licenseId": "OCM-001",
      "marketId": "central-ny",
      "displayName": "Example Storefront",
      "legalName": "Example LLC",
      "addressLine1": "123 Main St",
      "city": "Syracuse",
      "state": "NY",
      "zip": "13202",
      "latitude": 43.0481,
      "longitude": -76.1474,
      "distanceMiles": 4.2,
      "travelMinutes": 9,
      "rating": 4.8,
      "reviewCount": 124,
      "openNow": true,
      "isVerified": true,
      "mapPreviewLabel": "4.2 mi route preview",
      "placeId": "google-place-id",
      "thumbnailUrl": null
    }
  ]
}
```

### `GET /storefront-summaries/by-ids`

Returns summary rows for saved storefronts or any targeted list rehydrate.

Query params:

- `ids=storefront-1,storefront-2,...`

Response shape:

- same as `GET /storefront-summaries`

### `GET /storefront-details/:storefrontId`

Returns the detail payload for the storefront detail screen.

Response:

```json
{
  "storefrontId": "storefront-1",
  "phone": "(315) 555-0101",
  "website": "https://example.com",
  "hours": ["Mon-Fri 9a-8p"],
  "googleReviews": [],
  "appReviewCount": 0,
  "appReviews": [],
  "photoUrls": [],
  "amenities": [],
  "editorialSummary": null,
  "routeMode": "verified"
}
```

### `POST /storefront-details/:storefrontId/reviews`

Submits one Canopy Trove app review for the storefront, returns the updated detail payload, and applies review rewards.

Request body:

```json
{
  "profileId": "canopytrove-profile-demo",
  "authorName": "Canopy Trove user",
  "rating": 5,
  "text": "Helpful staff and easy parking. Found the spot without any trouble.",
  "tags": ["Helpful staff", "Good parking"],
  "photoCount": 0
}
```

Response:

```json
{
  "detail": {
    "storefrontId": "storefront-1",
    "phone": "(315) 555-0101",
    "website": "https://example.com",
    "hours": ["Mon-Fri 9a-8p"],
    "googleReviews": [],
    "appReviewCount": 1,
    "appReviews": [
      {
        "id": "review-abc123",
        "authorName": "Canopy Trove user",
        "authorProfileId": "canopytrove-profile-demo",
        "rating": 5,
        "relativeTime": "Just now",
        "text": "Helpful staff and easy parking. Found the spot without any trouble.",
        "tags": ["Helpful staff", "Good parking"],
        "helpfulCount": 0
      }
    ],
    "photoUrls": [],
    "amenities": [],
    "editorialSummary": null,
    "routeMode": "verified"
  },
  "rewardResult": {
    "activityType": "review_submitted",
    "pointsEarned": 75,
    "badgesEarned": [],
    "levelBefore": 1,
    "levelAfter": 1,
    "updatedState": {}
  }
}
```

### `POST /storefront-details/:storefrontId/reviews/:reviewId/helpful`

Marks one in-app storefront review as helpful. This updates the detail payload immediately and, when possible, advances the helpful-vote reward path for the review author.

Request body:

```json
{
  "profileId": "canopytrove-profile-viewer"
}
```

Response:

```json
{
  "detail": {
    "storefrontId": "storefront-1",
    "phone": "(315) 555-0101",
    "website": "https://example.com",
    "hours": ["Mon-Fri 9a-8p"],
    "googleReviews": [],
    "appReviewCount": 1,
    "appReviews": [
      {
        "id": "review-abc123",
        "authorName": "Canopy Trove user",
        "authorProfileId": "canopytrove-profile-demo",
        "rating": 5,
        "relativeTime": "Just now",
        "text": "Helpful staff and easy parking. Found the spot without any trouble.",
        "tags": ["Helpful staff", "Good parking"],
        "helpfulCount": 1
      }
    ],
    "photoUrls": [],
    "amenities": [],
    "editorialSummary": null,
    "routeMode": "verified"
  },
  "didApply": true,
  "reviewAuthorProfileId": "canopytrove-profile-demo"
}
```

### `POST /storefront-details/:storefrontId/reports`

Submits one storefront report for moderation/data review and applies the report reward path.

Request body:

```json
{
  "profileId": "canopytrove-profile-demo",
  "authorName": "Canopy Trove user",
  "reason": "Address issue",
  "description": "The storefront pin is slightly off from the actual entrance."
}
```

Response:

```json
{
  "ok": true,
  "rewardResult": {
    "activityType": "report_submitted",
    "pointsEarned": 15,
    "badgesEarned": [],
    "levelBefore": 1,
    "levelAfter": 1,
    "updatedState": {}
  }
}
```

### `GET /route-state/:profileId`

Returns the persisted storefront profile state for a client/profile scope.

Response:

```json
{
  "profileId": "canopytrove-profile-demo",
  "savedStorefrontIds": ["storefront-9"],
  "recentStorefrontIds": ["storefront-4"],
  "activeRouteSession": {
    "storefrontId": "storefront-1",
    "routeMode": "verified",
    "startedAt": "2026-03-25T09:30:00.000Z"
  },
  "routeSessions": [],
  "plannedRouteStorefrontIds": ["storefront-2"]
}
```

### `PUT /route-state/:profileId`

Stores the saved storefront deck, active route, recent route sessions, and planned route deck for a client/profile scope.

Request body:

```json
{
  "savedStorefrontIds": ["storefront-9"],
  "recentStorefrontIds": ["storefront-4"],
  "activeRouteSession": {
    "storefrontId": "storefront-1",
    "routeMode": "verified",
    "startedAt": "2026-03-25T09:30:00.000Z"
  },
  "routeSessions": [],
  "plannedRouteStorefrontIds": ["storefront-2"]
}
```

## Backend expectations

- Summary endpoints must not fetch or return full detail payloads.
- Detail endpoints should be storefront-specific and on-demand.
- Storefront identity and Google matching should be precomputed before summary rows are served.
- The API should own geo narrowing over time, so the client stops compensating for backend query limits.
- Route state should be profile-scoped. The current `profileId` is a Canopy Trove app-profile identifier and should later resolve to a real authenticated user or account identifier.
- Gamification state should move with the same profile scope as saved storefronts and route history so trophies, badges, and levels are not device-only.
- Leaderboard reads should be derived from persisted gamification state, not reconstructed on the client.
- Gamification events should be applied through the backend in production mode so reward logic stays consistent across devices.

## Recommended implementation path

1. Start with a Cloud Function or lightweight Node API that reads `storefront_summaries` and `storefront_details`.
2. Add geo narrowing and summary projection there.
3. Point the app at `api` mode.
4. Remove direct mobile Firestore querying from production mode once the API is stable.
