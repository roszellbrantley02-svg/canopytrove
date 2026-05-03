# Owner Portal Web Push — Setup & Smoke Test

**Goal:** when a member writes a review on a storefront, the owner who claimed
that storefront gets a browser notification on every device where they
opted in via the owner portal.

This doc covers (1) the one-time VAPID key + env-var setup needed to enable
the feature in any environment, and (2) the manual smoke test to verify the
pipeline end-to-end.

If `WEB_PUSH_VAPID_*` env vars are unset, the backend short-circuits the
web push fan-out (logs nothing, sends nothing) and only the existing native
Expo push path continues to flow. So you can ship code without keys and
turn the feature on later.

---

## 1. One-time VAPID key setup

VAPID keys identify your server to push services (FCM, Mozilla autopush,
Edge Push) when sending notifications. Generate **one** keypair per
environment. Rotation invalidates every browser subscription registered
under the previous key — owners would need to re-opt-in — so don't rotate
without a reason.

### Generate a keypair

```bash
cd backend
npm install        # ensures web-push is present
node -e "const k = require('web-push').generateVAPIDKeys(); console.log(k);"
```

Output:

```
{ publicKey: 'B...', privateKey: '...' }
```

### Persist the keys

Three env vars across two surfaces:

| Var                                     | Where                                  | Notes                                                          |
| --------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `WEB_PUSH_VAPID_PUBLIC_KEY`             | Cloud Run env (backend)                | Same value also published as the public key below              |
| `WEB_PUSH_VAPID_PRIVATE_KEY`            | Cloud Run via Secret Manager (backend) | Server-only. Never log, never expose client-side               |
| `WEB_PUSH_VAPID_SUBJECT`                | Cloud Run env (backend)                | `mailto:askmehere@canopytrove.com` (must be mailto: or https:) |
| `EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Expo env (frontend) + EAS profile env  | Same value as `WEB_PUSH_VAPID_PUBLIC_KEY` above                |

The frontend variant has the `EXPO_PUBLIC_` prefix because the public key
must be embedded in the web bundle so `pushManager.subscribe()` can pass
it to the browser. The private key never leaves the server.

### Cloud Run apply (production)

```bash
# Public key + subject as plain env vars (rotatable without code change)
gcloud run services update canopytrove-api \
  --region=us-east4 \
  --project=canopy-trove \
  --update-env-vars="WEB_PUSH_VAPID_PUBLIC_KEY=BB...your-public-key...,WEB_PUSH_VAPID_SUBJECT=mailto:askmehere@canopytrove.com"

# Private key via Secret Manager
echo -n "your-private-key" | gcloud secrets create WEB_PUSH_VAPID_PRIVATE_KEY \
  --project=canopy-trove --replication-policy=automatic --data-file=-

gcloud run services update canopytrove-api \
  --region=us-east4 \
  --project=canopy-trove \
  --update-secrets="WEB_PUSH_VAPID_PRIVATE_KEY=WEB_PUSH_VAPID_PRIVATE_KEY:latest"
```

### Frontend env (web build)

Add to `.env` and to the `extra` block in EAS profiles for any web build:

```ini
EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=BB...your-public-key...
```

---

## 2. What got added (architecture map)

### Backend

| File                                                 | Purpose                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/src/services/webPushService.ts`             | Wraps the `web-push` npm package; lazy-loads VAPID config, sends payloads, classifies expired vs error responses                     |
| `backend/src/services/webPushSubscriptionService.ts` | CRUD for browser subscriptions per owner (Firestore subcollection `owner_web_push_subscriptions/{uid}/subscriptions/{endpointHash}`) |
| `backend/src/services/ownerPortalAlertService.ts`    | Existing fan-out function `notifyOwnersOfStorefrontActivity()` now also dispatches Web Push, prunes 410/expired                      |
| `backend/src/routes/ownerPortalWebPushRoutes.ts`     | `GET/POST/DELETE /owner-portal/web-push/subscriptions` (rate-limited)                                                                |

### Frontend

| File                                                   | Purpose                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/services/ownerPortalWebPushService.ts`            | Web-only browser-side helpers — checks support, requests permission, subscribes, POSTs to backend |
| `src/screens/ownerPortal/OwnerPortalWebPushToggle.tsx` | Reusable opt-in UI component; renders nothing on native                                           |
| `src/screens/OwnerPortalReviewInboxScreen.tsx`         | Web branch now mounts `OwnerPortalWebPushToggle` instead of the "requires native app" placeholder |

### Service worker

The push event listener already exists at `web/service-worker.js`
(unchanged in this work). It accepts payload shape:

```json
{ "title": "string", "body": "string", "url": "/optional-deep-link", "tag": "optional-dedupe-tag", "data": { ... } }
```

Click on a notification opens `data.url` in a focused tab if one is open,
or a new tab otherwise.

### Storage shape

```
owner_web_push_subscriptions/
  {ownerUid}/
    subscriptions/
      {sha256(endpoint).slice(0,32)} → {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        p256dh: 'base64url',
        auth: 'base64url',
        createdAt, lastSeenAt, userAgent, lastError
      }
```

One subdoc per browser/device endpoint. An owner with both a laptop browser
and a phone PWA gets two subdocs. 410/404/401/403 from the push service
prunes the dead subdoc automatically on the next fan-out attempt.

---

## 3. Manual smoke test

Run after a deploy with VAPID env vars set on Cloud Run.

### Step 1 — confirm backend reports configured

```bash
# Auth as an owner first; this endpoint is owner-portal-gated
curl -H "Authorization: Bearer $(your owner ID token)" \
     https://api.canopytrove.com/owner-portal/web-push/subscriptions
```

Expected `configured: true` in response. If `configured: false`, env vars
on Cloud Run are missing — recheck Step 1.

### Step 2 — opt in from a browser

1. Open `https://app.canopytrove.com/` in Chrome or Edge (desktop) — sign in
   as an owner who has at least one approved storefront claim.
2. Navigate to the owner portal → Reviews tab.
3. Find the "Push alerts" panel → click **Enable browser alerts**.
4. Browser shows a permission prompt → click **Allow**.
5. Panel re-renders to "Browser alerts are on for this device."

Behind the scenes:

- `Notification.requestPermission()` resolves `granted`
- `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` returns a `PushSubscription`
- POST `/owner-portal/web-push/subscriptions` registers the endpoint
- Firestore now has `owner_web_push_subscriptions/{ownerUid}/subscriptions/{hash}`

### Step 3 — trigger a review, see the notification

1. In a different browser window, sign in as a member account.
2. Open any storefront the test owner has claimed.
3. Submit a review.
4. Within ~2 seconds, the owner browser shows a notification:
   _"New review on {storefront}" / "{rating}★ — {snippet}"_
5. Click the notification → focuses the owner-portal tab.

### Step 4 — verify expiry handling (optional)

To confirm dead-subscription cleanup:

1. As the owner, opt in (Step 2)
2. Open browser DevTools → Application → Service Workers → **Unregister**
3. Submit another review as the member
4. Check Cloud Logging for `[webPushService] sendNotification failed` with
   `statusCode: 410` — this is the push service saying the subscription is dead
5. Verify the corresponding subdoc under
   `owner_web_push_subscriptions/{uid}/subscriptions/{hash}` is gone

### Browser support matrix

| Browser                 | Web Push       | Notes                                         |
| ----------------------- | -------------- | --------------------------------------------- |
| Chrome (desktop)        | ✅ Full        | Works without install                         |
| Edge (desktop)          | ✅ Full        | Works without install                         |
| Firefox (desktop)       | ✅ Full        | Works without install                         |
| Safari (macOS)          | ✅ Full        | Requires "Add to Dock" install since macOS 13 |
| Safari (iOS 16.4+)      | ✅ PWA only    | Owner must "Add to Home Screen" first         |
| Chrome / Edge (Android) | ✅ Full        | PWA install boosts reliability                |
| Safari (iOS < 16.4)     | ❌ Unsupported | Toggle hides itself                           |

---

## 4. Rollback

Two safe rollback paths:

**Soft rollback (kill switch):** unset any one of the three
`WEB_PUSH_VAPID_*` env vars on Cloud Run. The send pipeline short-circuits
to a no-op; existing subscriptions remain in Firestore but no pushes go
out. Re-setting the same keys re-enables instantly.

**Hard rollback (full uninstall):**

```bash
# Clear all subscriptions across all owners (manual; no admin endpoint)
# Use sparingly. Owners would need to opt back in.
gcloud firestore databases delete \
  --project=canopy-trove \
  --collection-group=subscriptions \
  --collection-path=owner_web_push_subscriptions
```

---

## 5. Operational notes

- **Daily volume:** at current traffic (~0 reviews/day pre-launch) the
  feature is free. At 100 reviews/day across all owners with web push
  enabled it's still well below FCM's 10k/day free quota.
- **Latency:** push delivery typically lands within 2–5 seconds of the
  POST to the upstream service.
- **No backend deploy required** to add a new owner — opt-in is fully
  client-driven and writes straight to Firestore.
- **Privacy:** the subscription endpoint contains a per-browser opaque
  token. We never log the endpoint, p256dh, or auth — only the truncated
  hash and the host (e.g. `fcm.googleapis.com`).
