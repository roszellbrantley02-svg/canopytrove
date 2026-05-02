# Pricing Promo Runbook — Pro tier launch deal

This file documents the Pro tier launch promo so future-you (or anyone working on this codebase later) knows what to do at each milestone without re-thinking the whole thing.

## The deal in one paragraph

For the launch window (now through **November 2, 2026** — 6 months from May 2, 2026), the Pro tier is priced at **$249.99/mo** instead of the regular **$499.99/mo**. Subscribers who sign up during this window keep the $249.99 rate **for 12 months** from their personal subscription start date, then convert to $499.99/mo at month 13. After November 2, 2026, new subscribers pay $499.99/mo from day 1.

## Why "12 months" not "forever"

We considered "lock in forever" as a stronger urgency hook but rejected it. A "forever" promise costs real long-tail revenue (5 years out, 200 grandfathered users at $249.99 = $100K+/year of foregone revenue). 12 months is enough urgency to convert and short enough to keep pricing flexibility intact.

## Why it's different on iOS vs web

- **iOS** uses Apple In-App Purchase. The $249.99 product (`com.rezell.canopytrove.owner.pro.monthly.v3`) IS the launch promo product. When the promo ends, we publish a NEW product `...v4` at $499.99 and switch the app's product ID. v3 subscribers keep paying $249.99 as long as their Apple subscription stays active. After 12 months, the backend cancels their old sub and prompts them to resubscribe at the new product.
- **Web** uses Stripe. Same dynamic: a Stripe Price ID at $249.99 for promo subscribers, separate Price ID at $499.99 for post-promo subscribers. Stripe's anchor billing date handles the 12-month lock natively.

## Single source of truth

`src/types/ownerTiers.ts` exports two constants used everywhere:

- `PRO_LAUNCH_PROMO_ENDS_AT = '2026-11-02'`
- `PRO_LAUNCH_PROMO_LOCK_MONTHS = 12`

If you change these, the in-app subscription screen and the marketing site auto-update. Don't hardcode the date elsewhere.

## What you have to do at each milestone

### Right now — promo is live

- ✅ `src/types/ownerTiers.ts` shows `monthlyPrice: 249.99`, `regularMonthlyPrice: 499.99`, `isPromoPricing: true`, `promoEndsAt: '2026-11-02'`, `promoLockMonths: 12`
- ✅ `OwnerPortalSubscriptionScreen` renders the strikethrough + "Lock in for 12 months" callout
- ✅ `public-release-pages/index.html` shows the dual-price treatment with deadline
- ✅ Backend tier-gating error messages reference the launch pricing
- ⚠️ Apple IAP product `com.rezell.canopytrove.owner.pro.monthly.v3` should be priced at **$249.99** in App Store Connect. Verify this in Stripe Dashboard before going live.
- ⚠️ Stripe Price ID for Pro monthly should be **$249.99** in Stripe Dashboard. Verify and update env var `STRIPE_OWNER_PRO_MONTHLY_PRICE_ID` if changed.

### When promo ends — November 2, 2026

Three things to do, in order:

1. **App Store Connect** — create new product `com.rezell.canopytrove.owner.pro.monthly.v4` at $499.99. Submit for review. (Takes 24-48h for Apple to approve.)
2. **Stripe Dashboard** — create new Price for the Pro product at $499.99. Capture the new Price ID.
3. **Code change** — once both are approved/created:
   - Update `src/config/ownerBilling.ts` to point the `pro` Apple product ID to the new `v4` product
   - Update Cloud Run env var `STRIPE_OWNER_PRO_MONTHLY_PRICE_ID` to the new Stripe Price ID
   - Update `src/types/ownerTiers.ts`:
     - Set `monthlyPrice: 499.99`
     - Remove `regularMonthlyPrice` (or set to undefined)
     - Set `isPromoPricing: false`
     - Remove `promoEndsAt` and `promoLockMonths`
   - Update `public-release-pages/index.html` Pro card — remove the strikethrough and promo banner, just show $499.99
   - Ship as a single PR + OTA push

### When the first 12-month locks expire — November 2, 2027 onward

Promo subscribers who joined on November 2, 2026 (the last day of the promo window) start expiring on November 2, 2027. The bulk of expiries cluster between May 2, 2027 and November 2, 2027.

**Apple side**: when their Apple subscription auto-renews after the 12th month, Apple keeps charging them the v3 price ($249.99). To convert them, the backend has to:

1. Track each subscriber's `subscriptionStartedAt` timestamp (already on `ownerProfiles.subscriptionStatus` records via the Apple ASSN webhook)
2. When `now - subscriptionStartedAt > 12 months`, send the user a 30-day notice email saying "your launch pricing is ending — your next renewal will be $499.99"
3. Either:
   - **Easy path**: leave them on v3 indefinitely (you eat the $250/mo difference for the long-tail of grandfathered users — same problem as "forever" but capped to subscribers who joined in the 6-month window)
   - **Harder path**: when they hit month 13, cancel their v3 subscription and prompt them to manually resubscribe at v4 ($499.99). High churn risk — many will drop instead of resubscribing at 2x the price.

**Stripe side**: easier — Stripe lets you schedule a price change on a subscription via the API. We can set it up so that exactly 12 months after their checkout session completed, their subscription auto-migrates to the new Price ID. No user action required.

**Recommendation**: go with the easy path on iOS (eat the long-tail) and the auto-migrate path on Stripe. Document the lifetime-revenue impact and accept it as a launch promo cost.

### The "auto-migrate at 12 months" engineering work

If we go with auto-migrate, here's the pseudo-spec for what to build (defer until ~September 2027):

- New Cloud Scheduler job, runs daily at 2am ET
- Queries Firestore for subscriptions where `subscriptionStartedAt + 12 months < now() AND tierConvertedAt is null`
- For each match:
  - Stripe: call `stripe.subscriptions.update(id, { items: [{ price: NEW_PRO_PRICE_ID }], proration_behavior: 'none' })` to swap the price
  - Apple: cannot programmatically migrate — instead send an email asking them to resubscribe
  - Mark `tierConvertedAt: now()` on the owner profile
- Send transactional email "Your Canopy Trove launch pricing has converted to standard pricing"

## Honest tradeoffs we accepted

1. **Apple side**: we cannot auto-migrate Apple subscribers at month 13. Either they keep paying $249.99 forever (lost revenue) or we cancel and force re-subscribe (high churn). Pick one consciously.
2. **Promo deadline is a hard cutoff**: someone who finds your app on November 3, 2026 cannot get the launch rate. No retroactive grandfathering. This is intentional — it preserves urgency and revenue.
3. **Pricing message tone**: the in-app + marketing language says "Lock in this rate for 12 months" — NOT "forever." Marketing copy must match. Do not let any salesperson, email, or social post promise "forever" pricing or you'll have a class-action wakeup call when you later try to migrate.

## Files this doc references

- `src/types/ownerTiers.ts` — single source of truth for pricing constants
- `src/screens/ownerPortal/ownerPortalSubscriptionSections.tsx` — in-app pricing UI
- `public-release-pages/index.html` — marketing site pricing section
- `backend/src/services/ownerTierGatingService.ts` — backend tier-gating error messages
- `backend/src/services/ownerMultiLocationService.ts` — multi-location upgrade-prompt
- `src/config/ownerBilling.ts` — Apple IAP product IDs
- Cloud Run env: `STRIPE_OWNER_PRO_MONTHLY_PRICE_ID` — Stripe Price ID for Pro monthly
- App Store Connect: `com.rezell.canopytrove.owner.pro.monthly.v3` (current promo) → `...v4` (post-promo)
