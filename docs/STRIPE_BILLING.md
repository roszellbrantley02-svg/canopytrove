# Stripe Billing — Owner Subscriptions + Promo Codes

**Source of truth for promotional offers (free months, percent-off, etc.):
the Stripe Dashboard.** Effective 2026-05-04, no in-app trial logic
applies — every checkout uses the live Stripe price IDs and any discount
comes from a Stripe coupon redeemed via a Stripe promotion code.

## Live tier prices (from Cloud Run env)

| Tier     | Price ID                           | Monthly |
| -------- | ---------------------------------- | ------- |
| Verified | `STRIPE_VERIFIED_MONTHLY_PRICE_ID` | $49     |
| Growth   | `STRIPE_GROWTH_MONTHLY_PRICE_ID`   | $149    |
| Pro      | `STRIPE_PRO_MONTHLY_PRICE_ID`      | $249    |

Annual prices are configured but disabled at the application layer
(`ANNUAL_BILLING_DISABLED = true` in `ownerBillingService.ts`). Every
annual request is coerced to monthly before reaching Stripe.

## How promo codes flow

The owner-billing checkout session creator
(`backend/src/services/ownerBillingService.ts`) sets
`allow_promotion_codes: true` on every Stripe Checkout Session. Result:

1. Owner taps "Subscribe" in the app
2. Backend creates a Stripe Checkout Session and returns the URL
3. Owner lands on Stripe's hosted Checkout page
4. Owner sees a small **"Add promotion code"** link below the order summary
5. Owner enters their code (e.g. `WELCOME2026`)
6. Stripe validates the code, applies the coupon, updates the total
7. Owner enters card and confirms — billing follows the coupon's terms

No in-app code input UI exists today. Every promo lives on Stripe's hosted
page. Cleaner from a security + UX standpoint and zero code to maintain.

## Creating a "free first month" coupon

One-time setup:

1. Stripe Dashboard → **Products** → **Coupons** → **New**
2. Settings:
   - **Name:** `First Month Free` (internal label)
   - **Type:** Percentage discount
   - **Percent off:** `100`
   - **Duration:** `Once` — applies to the FIRST invoice only
   - **Apply to:** All products (or restrict to specific tier prices)
   - **Redemption limit:** blank for unlimited, or set a cap
   - **Expires after:** optional — set if the coupon itself should sunset

The coupon is the underlying discount rule. You don't share the coupon
ID with anyone.

## Creating user-facing promotion codes

Inside the coupon detail page, scroll to **Promotion codes** → **Create**:

- **Code:** the user-facing string (e.g. `WELCOME2026`, `FOUNDERS`,
  `BUDDA-FREE`). Memorable wins.
- **First-time customer only:** ON if you want only brand-new owners to
  redeem; OFF if existing paid owners should also be eligible.
- **Customer:** leave blank for "anyone with the code"; set a specific
  customer to restrict to one Stripe Customer.
- **Maximum redemptions:** `1` for single-use, blank for unlimited
- **Expires after:** set a date if the code itself should stop working
- **Min order amount:** typically blank

Save. The code is live immediately.

## Common recipes

**"First month free for the next 50 owners":** one promotion code, max
redemptions 50, expiration optional.

**"Personal code for one specific dispensary":** unique promotion code,
max redemptions 1, restrict to that owner's Stripe Customer ID.

**"Tier-specific promo (e.g. Verified only)":** restrict the underlying
coupon's "Apply to" to the Verified price ID. Promotion code attached
to that coupon only redeems on Verified subscriptions.

**"Free 3 months then full price":** coupon Duration = `Repeating`,
Months = 3.

**"50% off forever":** coupon Percent = 50, Duration = `Forever`.

## Tracking redemptions

- Stripe Dashboard → **Coupons** → click the coupon → **Redemptions** tab
- Or → **Promotion codes** → click the code → see each customer that used it

## Why we removed the in-app launch trial

Up through May 4 2026 the codebase had a `launchProgramService.ts` that
auto-applied a 60-day trial for the Growth tier during a 6-month launch
window (env-driven via `OWNER_LAUNCH_TRIAL_DAYS`, `LAUNCH_PROGRAM_*`).
Removed because:

- **Single source of truth:** managing promotions in two places (env vars
  - Stripe) created drift risk and made it harder to track what's active.
- **Granularity:** Stripe coupons + codes give per-tier, per-customer,
  expiring, and limited-redemption controls that env vars can't.
- **Visibility:** Stripe Dashboard shows redemption counts in real time;
  the in-app trial only logged Firestore counter docs.
- **Outreach attribution:** when you give a personal code to an owner you
  reached out to, Stripe records exactly who redeemed it.

The `resolveOwnerLaunchTrialOffer` function and `launch_program_*`
Firestore collections still exist in the codebase (no harm), but the
billing service no longer calls them and the env var is set to 0 on
Cloud Run. Re-enabling the in-app path is a single-block undo in
`backend/src/services/ownerBillingService.ts` if ever needed.

## What env vars to keep / drop

Keep on Cloud Run (still used or trivially harmless):

- `STRIPE_SECRET_KEY` — required
- `STRIPE_WEBHOOK_SECRET` — required for Stripe webhook signature verification
- `STRIPE_*_PRICE_ID` — required for tier mapping
- `OWNER_BILLING_SUCCESS_URL` / `OWNER_BILLING_CANCEL_URL` /
  `OWNER_BILLING_PORTAL_RETURN_URL` — required for checkout flow
- `STRIPE_ADDITIONAL_LOCATION_PRICE_ID` — required for per-location billing

Disabled but harmless to leave in place (defense in depth — the code
ignores them now):

- `OWNER_LAUNCH_TRIAL_DAYS=0`
- `LAUNCH_PROGRAM_START_AT`
- `LAUNCH_PROGRAM_DURATION_DAYS`
- `LAUNCH_EARLY_ADOPTER_LIMIT`

Safe to remove if you want a clean Cloud Run env page. Removing them
won't change behavior.
