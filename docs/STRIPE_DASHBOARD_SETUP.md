# Stripe Dashboard — Setup & Repair Checklist

This file walks you through fixing what's broken right now in your live Stripe account, getting it set up correctly for the launch promo, and configuring the webhook + customer portal so checkout actually works on the web.

> **Last reviewed:** May 2, 2026
> **Stripe account mode:** LIVE (sk*live*...)
> **Current state:** Monthly checkout fixed (env vars repointed). Annual checkout is BROKEN and DANGEROUS — see Section 1 first.

---

## ⚠️ SECTION 1 — URGENT: fix the broken "annual" prices

Your Stripe account currently has 6 active prices. Three are correctly configured monthly prices ($49, $149, $249). **Three are catastrophically misconfigured "annual" prices** that would charge customers MONTHLY at the annual dollar amount:

| Price ID                         | What it is        | What it'd actually charge                |
| -------------------------------- | ----------------- | ---------------------------------------- |
| `price_1TQ8vMQ1auAoHN6gvjC8nCYO` | "Annual" Verified | **$490/month** (intended: $490/year)     |
| `price_1TQ8vKQ1auAoHN6gY4fb0iPL` | "Annual" Growth   | **$1,490/month** (intended: $1,490/year) |
| `price_1TQ8vFQ1auAoHN6gZCI6l2g3` | "Annual" Pro      | **$2,490/month** (intended: $2,490/year) |

The Stripe field `recurring.interval` is set to `month` on these, not `year`. **Stripe doesn't let you edit the interval on an existing price** — you have to archive the old one and create a new one.

### What to do RIGHT NOW

1. Go to: **dashboard.stripe.com → Products** (make sure you're in **Live mode**, not Test, top-right toggle)
2. For EACH of the three products (Verified, Growth, Pro):
   a. Click the product
   b. Find the price labeled "$X.00 monthly" that's actually intended to be the annual price (it'll have an oddly large amount like $490, $1,490, $2,490)
   c. Click the `…` menu → **Archive price**
   d. Confirm. (Archiving doesn't break existing subscribers — they keep paying. It just hides the price from new checkouts.)

3. Then create new annual prices correctly (Section 2 below covers this).

### Until you archive these

Don't let the "annual" toggle on the subscription screen route to these prices. The safest interim move: in the Owner Portal subscription screen, **disable the annual toggle** until new annual prices are correctly configured. Or just tell yourself "don't pick annual" until this is fixed.

---

## SECTION 2 — Create the missing prices for the launch promo

Two new prices to create on the Pro product to support the launch deal:

| Price                   | Amount  | Interval | Used for                                   |
| ----------------------- | ------- | -------- | ------------------------------------------ |
| **Pro promo monthly**   | $249.99 | Monthly  | New Pro subscribers from now → Nov 2, 2026 |
| **Pro regular monthly** | $499.99 | Monthly  | New Pro subscribers AFTER Nov 2, 2026      |

Plus the new annual prices to replace what we just archived:

| Price                  | Amount | Interval | Used for                                                     |
| ---------------------- | ------ | -------- | ------------------------------------------------------------ |
| **Verified annual**    | $490   | YEARLY   | Replaces broken price                                        |
| **Growth annual**      | $1,490 | YEARLY   | Replaces broken price                                        |
| **Pro promo annual**   | $2,499 | YEARLY   | Annual promo (10× the $249.99 monthly minus a tiny rounding) |
| **Pro regular annual** | $4,999 | YEARLY   | Post-promo annual                                            |

### How to create each one in Stripe Dashboard

For **Pro promo monthly ($249.99)** — repeat the same process for each price below:

1. Go to **Products** → click **Canopy Trove Pro**
2. Click the **+ Add another price** button
3. Fill in:
   - **Pricing model:** Standard pricing
   - **Price:** $249.99 USD
   - **Billing period:** Monthly (every 1 month)
   - **Description (internal):** "Pro Monthly — Launch Promo $249.99 (active through Nov 2, 2026)"
   - Leave currency as USD
4. Click **Add price**
5. **Copy the new price ID** (starts with `price_…`) — you need it for env vars

Repeat for the other 5 new prices listed in the table above. Each goes on the matching product (Verified / Growth / Pro).

---

## SECTION 3 — Update Cloud Run env vars after creating new prices

Once you have new price IDs from Section 2, update the env vars on Cloud Run.

I already updated the env vars to point at your existing valid (monthly) prices in revision `canopytrove-api-00222-5n8` — but they're pointing at the OLD $249 price, not the new $249.99 promo. After you create the new prices, tell me which price IDs they have and I'll update the env vars again. Or you can do it yourself:

```
gcloud run services update canopytrove-api --region=us-east4 --project=canopy-trove \
  --update-env-vars=\
STRIPE_PRO_MONTHLY_PRICE_ID=<new $249.99 price ID>,\
STRIPE_PRO_ANNUAL_PRICE_ID=<new $2,499 price ID>,\
STRIPE_VERIFIED_ANNUAL_PRICE_ID=<new $490 price ID>,\
STRIPE_GROWTH_ANNUAL_PRICE_ID=<new $1,490 price ID>
```

The Verified monthly ($49) and Growth monthly ($149) prices are correctly configured, no change needed.

---

## SECTION 4 — Verify the webhook endpoint

Stripe needs to send your backend events when subscriptions change (created, paid, canceled, etc.). Without this, owners can pay but the backend doesn't know they paid.

### Check whether the webhook is registered

1. Go to **Developers → Webhooks** in the Stripe Dashboard
2. Look for an endpoint that starts with `https://api.canopytrove.com/`

If you see one for `/owner-billing/stripe/webhook` (or similar), it's set up. Skip to Section 5.

If there's nothing, do this:

1. Click **+ Add endpoint**
2. **Endpoint URL:** `https://api.canopytrove.com/owner-billing/stripe/webhook`
   _(verify this path against `backend/src/routes/ownerBillingRoutes.ts` — search for "stripe/webhook" or similar; the agent audit said this endpoint exists but I haven't double-checked the exact path)_
3. **Events to listen to** — select these (use search):
   - `checkout.session.completed` ← critical, fires when an owner completes Stripe Checkout
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. **Copy the Signing Secret** (starts with `whsec_…`) — Stripe shows it once, then you have to reveal it again later
6. Update Cloud Run secret: `STRIPE_WEBHOOK_SECRET` should be set to this value

### Test the webhook

In the same Webhooks page → click your endpoint → **Send test webhook** → pick `checkout.session.completed` → Send. The "Recent deliveries" section should show a 2xx response within a few seconds. If you get a 400/500, the endpoint URL or signing secret is wrong.

---

## SECTION 5 — Enable the Customer Portal

Owners who subscribe via Stripe need a way to:

- Update their card
- Cancel
- View past invoices
- Switch between monthly/annual

Stripe provides a hosted "Customer Portal" for all this. It's free, but you have to enable + configure it.

1. Go to **Settings → Billing → Customer Portal** (or search "customer portal" in the Dashboard)
2. Click **Enable test mode portal** if you want to try first; otherwise toggle the LIVE portal on
3. Configure these settings:
   - **Functionality**:
     - ✅ Allow customers to update their payment method
     - ✅ Allow customers to view invoices
     - ✅ Allow customers to update their billing address
     - ✅ Allow customers to cancel subscriptions (set cancellation policy: "Cancel immediately" or "Cancel at end of period" — pick "end of period" so they keep what they paid for)
     - ⚠️ Allow plan changes — pick which products + prices customers can switch between. For now, allow them to switch within: Verified, Growth, Pro (all current monthly + annual prices)
   - **Business information**:
     - **Business name:** Canopy Trove
     - **Privacy policy URL:** `https://canopytrove.com/privacy`
     - **Terms of service URL:** `https://canopytrove.com/terms` (or wherever yours lives)
     - **Logo:** upload your Canopy Trove logo if you have one ready
   - **Branding** (optional but nice):
     - Brand color: `#2ECC71` (Canopy Trove green)
     - Accent color: `#E8A000` (Canopy Trove gold)
4. Click **Save**

The backend already has a `/owner-billing/portal-session` endpoint that creates portal links for signed-in owners. Once the portal is enabled, that endpoint Just Works.

---

## SECTION 6 — Test the full flow

After Sections 1-5 are done:

1. **Verify env vars on Cloud Run** are pointing at valid price IDs (not the old broken ones):

   ```
   gcloud run services describe canopytrove-api --region=us-east4 --project=canopy-trove --format=json | grep STRIPE
   ```

2. **Hit the checkout endpoint** to make sure it returns a Stripe Checkout URL:

   ```
   curl -sS -X POST "https://api.canopytrove.com/owner-billing/checkout-session" \
     -H "Authorization: Bearer <your-firebase-id-token>" \
     -H "Content-Type: application/json" \
     --data '{"tier":"pro","billingCycle":"monthly"}'
   ```

   Expected: a JSON response with `url: https://checkout.stripe.com/c/pay/...`

3. **Open that URL in a browser** → confirm you see the Pro tier ($249.99) checkout page → fill in test card `4242 4242 4242 4242` → confirm

4. **Check the webhook fired:** Stripe Dashboard → Developers → Webhooks → click your endpoint → "Recent deliveries" should show the `checkout.session.completed` event with a 2xx response

5. **Check Firestore** — `subscriptions/{ownerUid}` document should now have `status: 'active'`, `tier: 'pro'`, `stripeCustomerId: 'cus_...'`, `stripeSubscriptionId: 'sub_...'`

6. **Test the customer portal:** hit `/owner-billing/portal-session` to get a portal URL → open it → confirm you can see the subscription, update card, cancel

If any step fails, check the Cloud Run logs — most issues are env var typos or a missing webhook secret.

---

## SECTION 7 — What's already correct

Stuff you don't need to touch:

- ✅ **Stripe secret key** is set on Cloud Run (in Secret Manager as `STRIPE_SECRET_KEY`)
- ✅ **Three Stripe products exist** (Verified / Growth / Pro) and are active
- ✅ **Three monthly prices are correctly configured** ($49 / $149 / $249) — though the Pro $249 needs to be replaced by $249.99 to match the launch promo
- ✅ **Backend Stripe code is fully built** — checkout sessions, webhook handlers, customer portal session creation, signature verification all wired up. Just needs the env vars + dashboard config to be correct.
- ✅ **Backend success/cancel/portal-return URLs** are set to:
  - Success: `https://canopytrove.com/owner/billing/success`
  - Cancel: `https://canopytrove.com/owner/billing/cancel`
  - Portal return: `https://canopytrove.com/owner/billing`

You may want to actually CREATE those success/cancel/billing pages on `public-release-pages/` if they don't exist yet — otherwise owners get redirected to a 404 after paying.

---

## QUICK CHECKLIST (print this part)

- [ ] **URGENT** — Archive the 3 broken "annual" prices in Stripe Dashboard (Section 1)
- [ ] Create new Pro promo monthly price at $249.99 (Section 2)
- [ ] Create new Pro regular monthly price at $499.99 (for after Nov 2, 2026)
- [ ] Create correctly-configured annual prices for all 3 tiers (Section 2)
- [ ] Send me the new price IDs so I can update Cloud Run env vars (Section 3) — or do it yourself with the gcloud command
- [ ] Confirm webhook endpoint is registered + signing secret is set (Section 4)
- [ ] Enable Customer Portal with branding (Section 5)
- [ ] Run end-to-end test with test card (Section 6)
- [ ] Verify the success/cancel/billing redirect pages exist on canopytrove.com (Section 7)

---

## APPENDIX — Current state snapshot (May 2, 2026)

**Cloud Run env vars (after my fix today):**

```
STRIPE_OWNER_MONTHLY_PRICE_ID    = price_1TQ8vMQ1auAoHN6gBPOqu6GJ  ($49 Verified)
STRIPE_OWNER_ANNUAL_PRICE_ID     = price_1TQ8vMQ1auAoHN6gvjC8nCYO  (BROKEN - Verified "annual")
STRIPE_VERIFIED_MONTHLY_PRICE_ID = price_1TQ8vMQ1auAoHN6gBPOqu6GJ  ($49 Verified)
STRIPE_VERIFIED_ANNUAL_PRICE_ID  = price_1TQ8vMQ1auAoHN6gvjC8nCYO  (BROKEN - Verified "annual")
STRIPE_GROWTH_MONTHLY_PRICE_ID   = price_1TQ8vKQ1auAoHN6g8J5SRpmN  ($149 Growth)
STRIPE_GROWTH_ANNUAL_PRICE_ID    = price_1TQ8vKQ1auAoHN6gY4fb0iPL  (BROKEN - Growth "annual")
STRIPE_PRO_MONTHLY_PRICE_ID      = price_1TQ8vFQ1auAoHN6gbhQiFRQg  ($249 Pro - need to migrate to $249.99)
STRIPE_PRO_ANNUAL_PRICE_ID       = price_1TQ8vFQ1auAoHN6gZCI6l2g3  (BROKEN - Pro "annual")
```

**Stripe products in live mode:**

- `prod_UOwprMFGtc0JZ9` — Canopy Trove Verified
- `prod_UOwoBo76JplPVz` — Canopy Trove Growth
- `prod_UOwo0JPRLZ21kX` — Canopy Trove Pro
