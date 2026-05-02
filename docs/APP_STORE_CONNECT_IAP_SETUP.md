# App Store Connect — IAP Setup Checklist

Two new auto-renewable subscription products to create tonight. Apple takes 24-48 hours to approve each, so submitting them tonight starts the clock immediately.

---

## Before you start

1. Open **App Store Connect** → log in with your developer account
2. Apps → **Canopy Trove** → **Subscriptions** (left sidebar, under "In-App Purchases")
3. Confirm you have an existing subscription group called "Owner Subscriptions" (or similar) — that's where the new Pro v4 goes
4. You'll be creating ONE NEW subscription group for the Additional Location add-on (it has to be in its own group so owners can have BOTH Pro AND Additional Location active simultaneously)

---

## Product 1 — Pro tier (new $499.99 price)

### Subscription Group

**Existing group** — the one your current Verified / Growth / Pro v3 products live in. Don't create a new group.

### Reference Name (internal — only you see this)

```
Owner Pro Monthly v4
```

### Product ID (must match exactly — I'll wire this into code)

```
com.rezell.canopytrove.owner.pro.monthly.v4
```

### Subscription Duration

**1 Month**

### Subscription Price

**$499.99 USD**

When Apple asks "Which territories?" — pick **United States only** for now. (You can expand later. Cannabis listings + 18+ rating means most other markets are complicated.)

### Localizations

App Store Connect lets you add display name + description translations for every language your app supports. Tonight you're US-only, so only **English (U.S.)** is required. Apple will ask for it whether you add other languages or not.

When you click "Add Localization" → pick **English (U.S.)** → fill in the two fields below. Don't add other languages yet — wait until you expand to other markets.

#### English (U.S.)

**Subscription Display Name** (30 char max — what owners see in the IAP sheet)

```
Pro
```

**Description** (45 char max — short summary line under the name)

```
AI tools, multi-location, full analytics
```

> Apple's "Description" field has a hard 45-character limit (it's a one-liner under the product name in the purchase sheet). If they let you type longer somewhere, it's a different field — but for the standard auto-renewable subscription localization, 45 is the cap. The version above is 41 characters.

### Promotional Image (optional — skip unless you want a featured promo)

Skip.

### Review Information

**Notes for Reviewer:**

```
Pro tier subscription for licensed NY dispensary owners managing their listing on Canopy Trove. Replaces existing Pro v3 product (com.rezell.canopytrove.owner.pro.monthly.v3) at the new $499.99 monthly price.

To test:
1. Sign in as an owner (test account credentials in app review notes)
2. Profile → Owner Portal → Subscription
3. Tap Pro tier — purchase sheet appears
4. Confirm purchase — Pro features unlock immediately

Subscription auto-renews monthly until canceled.
```

**Screenshot:** Take a screenshot of your `OwnerPortalSubscriptionScreen` showing the Pro tier card. Apple wants to see WHERE in the app the user encounters this product. Required size: at least 640×920.

### After saving — submit for review

Apple will review it. 24-48 hours typical.

---

## Product 2 — Additional Location add-on ($99.99/mo)

### Subscription Group

**CREATE A NEW GROUP** called:

```
Owner Add-ons
```

This must be its OWN group, separate from the Pro/Growth/Verified group. Apple's rule: a user can only have one active subscription per group at a time. If Additional Location is in the same group as Pro, subscribing to Additional Location would CANCEL their Pro subscription. Putting it in its own group lets a Pro owner have both Pro AND multiple Additional Location subscriptions active simultaneously.

### Reference Name (internal)

```
Additional Location Monthly v3
```

### Product ID (must match exactly)

```
com.rezell.canopytrove.owner.location.monthly.v3
```

### Subscription Duration

**1 Month**

### Subscription Price

**$99.99 USD**

Same territory choice: **United States only**.

### Localizations

Same drill as Product 1: only **English (U.S.)** required tonight. Add more languages later when you expand markets.

#### English (U.S.)

**Subscription Display Name** (30 char max)

```
Additional Location
```

**Description** (45 char max)

```
Add one extra dispensary location
```

> 33 characters. Fits comfortably in the 45-char IAP sheet line.

### Promotional Image

Skip.

### Review Information

**Notes for Reviewer:**

```
Add-on subscription for Pro-tier dispensary owners who manage multiple locations. Each $99.99/mo subscription unlocks the ability to add one additional licensed storefront to the owner's account.

This is a per-location add-on:
- An owner with 1 location pays Pro ($499.99/mo) only.
- An owner with 2 locations pays Pro ($499.99/mo) + 1 Additional Location ($99.99/mo) = $599.98/mo.
- An owner with 3 locations pays Pro + 2 Additional Locations = $699.97/mo.

To test:
1. Sign in as a Pro-tier owner (test account credentials in app review notes)
2. Profile → Owner Portal → tap "Add another location"
3. Purchase Additional Location — sheet appears
4. Confirm purchase — owner can now claim a second storefront

Subscription auto-renews monthly until canceled. Canceling removes the additional location slot at the end of the billing period.
```

**Screenshot:** Take a screenshot of where in the app the "Add another location" button appears (the Owner Portal Home or wherever you wire the entry point). Required size: at least 640×920.

### After saving — submit for review

Apple reviews this separately from Product 1. Both 24-48h typical.

---

## What happens to the OLD $249 Pro v3 product?

**Don't delete it.** Apple doesn't really let you delete products that have ever had subscribers. Once Pro v4 is approved and live, do this in App Store Connect:

1. Go to the OLD product (`com.rezell.canopytrove.owner.pro.monthly.v3`)
2. Set its status to **"Removed from Sale"** (or similar — Apple's UI calls this different things in different places)
3. New purchases of Pro will go to v4 ($499.99). Existing subscribers on v3 stay at $249 until THEY cancel, and they don't see v3 in the IAP sheet anymore.

Don't touch v3 until v4 is approved and live. If you remove v3 first, there's a window where Pro can't be purchased at all.

---

## When Apple approves both products

Send me a message — something like "both approved." I'll:

1. Update `src/config/ownerBilling.ts` to point to the new product IDs (Pro v4 + Location v3)
2. Update `src/types/ownerTiers.ts` to bump `monthlyPrice: 249` → `monthlyPrice: 499.99` for the Pro tier
3. Open + merge a 5-line PR
4. OTA push

The new prices go live for owners within ~5 minutes of the merge.

---

## Common mistakes to avoid

- **Don't reuse product IDs.** Once a product ID has been used, it's tied to that product and price forever. The "v3 → v4" pattern handles this — every price change gets a new version suffix.
- **Don't put Additional Location in the same group as Pro.** Subscriptions in the same group are mutually exclusive. Pro + Additional Location need to be in DIFFERENT groups so a Pro owner can subscribe to both.
- **Don't forget the screenshot.** Apple rejects products without a clear screenshot showing where the IAP appears in the app. Use the existing `OwnerPortalSubscriptionScreen` for Pro v4. For Additional Location, you might need to add a placeholder screenshot of the Owner Portal Home if the "Add another location" button isn't visible yet — that's fine, just describe it in review notes.
- **United States only** for now. Don't enable other territories until you have geo-gating in the app for non-cannabis-legal regions.

---

## Quick reference summary

| Field          | Pro v4                                        | Additional Location v3                             |
| -------------- | --------------------------------------------- | -------------------------------------------------- |
| Group          | (existing) Owner Subscriptions                | (NEW) Owner Add-ons                                |
| Reference Name | Owner Pro Monthly v4                          | Additional Location Monthly v3                     |
| Product ID     | `com.rezell.canopytrove.owner.pro.monthly.v4` | `com.rezell.canopytrove.owner.location.monthly.v3` |
| Duration       | 1 Month                                       | 1 Month                                            |
| Price          | $499.99 USD                                   | $99.99 USD                                         |
| Territory      | United States                                 | United States                                      |
| Display Name   | Pro                                           | Additional Location                                |

Done. Submit both, get back to whatever else you need to do, and I'll wire the code while you're in App Store Connect.

---

## About localization (in plain English)

Apple lets you offer your IAP products in multiple languages. Each "localization" is a separate display-name + description in a specific language. The user's iPhone language setting decides which one they see.

**Tonight: just English (U.S.)** — that's enough for US-only sales.

**When you'd add more later:**

| If you expand to                                | Add localization for                            |
| ----------------------------------------------- | ----------------------------------------------- |
| Quebec / French Canada                          | French (Canada)                                 |
| Mexico (legal cannabis states like Mexico City) | Spanish (Mexico)                                |
| US Spanish-speaking owners                      | Spanish (U.S.) — optional, English usually fine |
| Other markets                                   | The local language(s)                           |

**Recommendation:** start English-only tonight. When you have demand from Spanish-speaking owners, take 5 minutes to add a Spanish (U.S.) localization. Don't pre-translate into 20 languages you'll never sell into — Apple will rotate stale translations into the IAP sheet and that's worse than no translation.

### How to add a localization later

In App Store Connect, on each subscription product:

1. Scroll to the **Localizations** section
2. Click **+ Add Localization**
3. Pick the language
4. Fill in the same two fields (display name + 45-char description) translated
5. Save

Apple doesn't re-review the product when you add a localization — it goes live immediately for users on that language.

### What the in-app text looks like

When you add a localization, the LANGUAGE OF THE iPhone is what decides which version shows. It is NOT based on country or App Store region. So a Spanish-speaking owner in NY sees the Spanish version IF you've added Spanish (U.S.) AND their phone is set to Spanish.

That's separate from the **App Store metadata localization** (the app name, description, screenshots on the App Store page) — that's a different localization system, configured per app, not per IAP. You probably already have English-only there too. Same logic: don't expand languages until you have demand.

---

## Summary of what to fill in tonight

For each of the two products, you're filling in:

1. Reference Name (internal)
2. Product ID (must match code exactly)
3. Subscription Group (Pro v4 → existing; Additional Location → NEW group)
4. Subscription Duration (1 Month)
5. Pricing (USD only, $499.99 / $99.99)
6. Territory (United States only)
7. **Localization → English (U.S.)** → Display Name + Description (the new section above)
8. Review Information → Notes for Reviewer + Screenshot
9. Submit

Done. ~10 minutes per product if you don't get distracted.
