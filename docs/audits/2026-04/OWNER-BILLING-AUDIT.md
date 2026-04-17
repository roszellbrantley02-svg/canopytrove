# Canopy Trove: Owner Billing & Stripe Audit Report

**Date:** April 5, 2026
**Auditor:** Claude (automated)
**Scope:** Full end-to-end audit of the owner billing flow, Stripe integration, and production readiness

---

## Executive Summary

The owner billing code is well-architected with proper auth verification, eligibility gating, rate limiting, and webhook signature verification. However, **billing is currently non-functional in production** because 5 required environment variables are missing on Cloud Run. The Stripe secret key IS configured, but the price IDs and redirect URLs are not, causing all billing endpoints to return HTTP 503.

**Overall Status: NOT READY for live billing**

---

## Critical Finding: Missing Environment Variables

All three billing endpoints (`checkout-session`, `portal-session`, `stripe/webhook`) return **HTTP 503** with:

```
Stripe billing is not fully configured on the backend.
Missing env: STRIPE_OWNER_MONTHLY_PRICE_ID, STRIPE_OWNER_ANNUAL_PRICE_ID,
OWNER_BILLING_SUCCESS_URL, OWNER_BILLING_CANCEL_URL, OWNER_BILLING_PORTAL_RETURN_URL.
```

### What IS Configured

| Variable                                     | Status                                   |
| -------------------------------------------- | ---------------------------------------- |
| `STRIPE_SECRET_KEY`                          | Set                                      |
| `EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED` | Set (owner portal visible in production) |

### What IS NOT Configured

| Variable                          | Purpose                            | Action Required                                                                         |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `STRIPE_OWNER_MONTHLY_PRICE_ID`   | Stripe Price ID for monthly plan   | Create in Stripe Dashboard, add to Cloud Run                                            |
| `STRIPE_OWNER_ANNUAL_PRICE_ID`    | Stripe Price ID for annual plan    | Create in Stripe Dashboard, add to Cloud Run                                            |
| `OWNER_BILLING_SUCCESS_URL`       | Redirect after successful checkout | Set to `https://app.canopytrove.com/OwnerPortalSubscription?billing=success` or similar |
| `OWNER_BILLING_CANCEL_URL`        | Redirect after cancelled checkout  | Set to `https://app.canopytrove.com/OwnerPortalSubscription?billing=cancelled`          |
| `OWNER_BILLING_PORTAL_RETURN_URL` | Return URL from billing portal     | Set to `https://app.canopytrove.com/OwnerPortalSubscription`                            |
| `STRIPE_WEBHOOK_SECRET`           | Webhook signature verification     | Create webhook endpoint in Stripe Dashboard, add secret                                 |

### Optional Tier-Specific Price IDs (Not Required)

The backend supports tier-specific pricing with fallback to the generic IDs above. These are optional until you want distinct Stripe products per tier:

- `STRIPE_VERIFIED_MONTHLY_PRICE_ID` / `STRIPE_VERIFIED_ANNUAL_PRICE_ID`
- `STRIPE_GROWTH_MONTHLY_PRICE_ID` / `STRIPE_GROWTH_ANNUAL_PRICE_ID`
- `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_ANNUAL_PRICE_ID`

---

## Setup Steps to Enable Billing

### 1. Create Stripe Products and Prices

In Stripe Dashboard (or via API), create subscription products:

- **Verified Plan**: $49/month or $490/year
- **Growth Plan**: $149/month or $1,490/year
- **Pro Plan**: $249/month or $2,490/year

Note the Price IDs (format: `price_xxxxx`).

### 2. Create Stripe Webhook Endpoint

In Stripe Dashboard > Developers > Webhooks:

- **URL:** `https://api.canopytrove.com/owner-billing/stripe/webhook`
- **Events to listen for:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Note the Webhook Signing Secret (format: `whsec_xxxxx`).

### 3. Set Environment Variables on Cloud Run

```bash
gcloud run services update canopytrove-api \
  --region us-east4 \
  --update-env-vars "\
STRIPE_OWNER_MONTHLY_PRICE_ID=price_xxxxx,\
STRIPE_OWNER_ANNUAL_PRICE_ID=price_xxxxx,\
OWNER_BILLING_SUCCESS_URL=https://app.canopytrove.com/OwnerPortalSubscription,\
OWNER_BILLING_CANCEL_URL=https://app.canopytrove.com/OwnerPortalSubscription,\
OWNER_BILLING_PORTAL_RETURN_URL=https://app.canopytrove.com/OwnerPortalSubscription,\
STRIPE_WEBHOOK_SECRET=whsec_xxxxx"
```

### 4. (Optional) Set Frontend Fallback Links

If you want the frontend to have fallback public payment links (in case backend API is unreachable), set these in your Expo build config:

- `EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL` (Stripe Payment Link URL)
- `EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL` (Stripe Payment Link URL)
- `EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL` (Stripe Customer Portal URL)

---

## Code Architecture Assessment

### Strengths

**Authentication & Authorization:**

- Firebase Auth ID token verification on every billing request (`getVerifiedOwnerContext`)
- Eligibility gating: claimed storefront + business verification + identity verification required before checkout
- Owner UID resolved from Firebase custom claims

**Stripe Integration:**

- Raw `fetch` to Stripe API (no SDK dependency) — clean and auditable
- HMAC-SHA256 webhook signature verification with timing-safe comparison and 300-second tolerance
- Idempotency keys on checkout sessions (`owner-billing:{ownerUid}:{cycle}`)
- Subscription metadata stored in Firestore with full audit trail
- Status mapping: trialing, active, past_due, canceled, suspended

**Error Handling:**

- Custom `OwnerBillingError` class with proper HTTP status codes
- Rate limiting: 6 requests/min on checkout and portal sessions, 120/min on webhooks
- Graceful 503 responses when backend isn't configured (vs. crashing)
- Frontend dual-path: backend API first, falls back to public payment links

**Resilience:**

- Webhook handler registered before JSON body parser (raw body for signature verification)
- Runtime safe mode protection that pauses billing operations
- Billing readiness checklist with 5 checkpoints displayed to owner

**Launch Program:**

- Configurable trial period (`OWNER_LAUNCH_TRIAL_DAYS`, default 30 days)
- Launch window tracking (`LAUNCH_PROGRAM_START_AT`, `LAUNCH_PROGRAM_DURATION_DAYS`)
- Early adopter claim tracking with limit (`LAUNCH_EARLY_ADOPTER_LIMIT`, default 500)

### Areas for Improvement

**1. Frontend `hasConfiguredOwnerBillingFlow()` is misleading:**

```typescript
export function hasConfiguredOwnerBillingFlow() {
  return Boolean(storefrontApiBaseUrl || hasConfiguredOwnerBillingPublicCheckoutLinks());
}
```

This returns `true` if the API base URL exists (which it does), even though the backend billing isn't actually configured. The subscription screen's "Billing Flow: Ready" metric would show "Ready" to owners, but clicking checkout would fail with a 503. Consider adding a health check that actually pings the billing endpoint.

**2. No web deep-linking for Owner Portal screens:**

The `linkingConfig.ts` has no entries for `OwnerPortalAccess`, `OwnerPortalSubscription`, or any owner screens. This means the success/cancel URLs from Stripe checkout cannot deep-link back to the subscription screen on web. Users would land on the default route (Nearby) after checkout. Either add linking config entries or use a different return URL pattern.

**3. Webhook endpoint is fully blocked when billing isn't configured:**

The `getMissingOwnerBillingBackendEnvVars()` check gates the webhook endpoint too. This means even if you set the webhook secret, Stripe webhooks would still get 503'd until ALL billing env vars are set. Consider allowing the webhook endpoint to work independently (it only needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`).

---

## Live Testing Results

| Test                                        | Result | Notes                                                  |
| ------------------------------------------- | ------ | ------------------------------------------------------ |
| Owner Portal Access screen renders on web   | PASS   | No console errors                                      |
| "Own a dispensary?" card visible on Profile | PASS   | `ownerPortalAccessAvailable` is true in prod           |
| Onboarding steps displayed correctly        | PASS   | 4-step checklist renders                               |
| Sign In / Create Account buttons render     | PASS   | Auth gating works                                      |
| POST /owner-billing/checkout-session        | 503    | Missing env vars                                       |
| POST /owner-billing/portal-session          | 503    | Missing env vars                                       |
| POST /owner-billing/stripe/webhook          | 503    | Missing env vars                                       |
| GET /readyz (API health)                    | 200    | Backend is healthy                                     |
| Tier card pricing (code review)             | PASS   | Verified $49/$490, Growth $149/$1,490, Pro $249/$2,490 |

---

## Recommended Deployment Order

1. **Create Stripe products and prices** in Dashboard (test mode first)
2. **Create webhook endpoint** in Stripe pointing to `api.canopytrove.com/owner-billing/stripe/webhook`
3. **Set all 6 env vars** on Cloud Run (see command above)
4. **Add linking config** for `OwnerPortalSubscription` screen in `src/navigation/linkingConfig.ts`
5. **Test with a real owner account** — sign in, navigate to subscription, select tier, complete checkout
6. **Verify webhook delivery** in Stripe Dashboard > Webhooks > Recent events
7. **Switch to live mode** when ready (swap test keys for live keys)

---

## Files Reviewed

- `src/screens/OwnerPortalSubscriptionScreen.tsx` (401 lines)
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/services/ownerPortalBillingService.ts` (93 lines)
- `src/config/ownerBilling.ts` (68 lines)
- `src/config/ownerPortalConfig.ts` (33 lines)
- `src/types/ownerTiers.ts`
- `backend/src/services/ownerBillingService.ts` (888 lines)
- `backend/src/routes/ownerBillingRoutes.ts` (98 lines)
- `backend/src/config.ts` (249 lines)
- `src/navigation/linkingConfig.ts`
- `src/screens/ownerPortal/ownerPortalSubscriptionSections.tsx`
