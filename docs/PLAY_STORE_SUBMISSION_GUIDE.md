# Google Play Store Submission Guide

**App:** Canopy Trove
**Bundle ID:** com.rezell.canopytrove
**Last updated:** 2026-04-05

---

## 1. Data Safety Section Responses

Use these answers when filling out the Data Safety form in the Play Console.

### Data collected

| Data type              | Collected | Shared | Purpose                                                            |
| ---------------------- | --------- | ------ | ------------------------------------------------------------------ |
| Location (approximate) | Yes       | No     | App functionality — finding nearby licensed dispensaries           |
| Location (precise)     | Yes       | No     | App functionality — distance calculations, turn-by-turn directions |
| Name                   | Yes       | No     | Account functionality — display name for reviews and profiles      |
| Email address          | Yes       | No     | Account functionality — authentication via Firebase Auth           |
| App interactions       | Yes       | No     | Analytics — screen views, feature usage for product improvement    |
| Crash logs             | Yes       | No     | App diagnostics — Sentry crash reporting                           |
| Device or other IDs    | Yes       | No     | App functionality — push notification tokens via Expo              |

### Data NOT collected

| Data type         | Notes                                                        |
| ----------------- | ------------------------------------------------------------ |
| Financial info    | No payment processing, no transactions, no wallet            |
| Health info       | No health or medical data collected                          |
| Messages          | No in-app messaging between users                            |
| Photos and videos | User-uploaded review photos only, stored in Firebase Storage |
| Contacts          | Not accessed                                                 |
| Calendar          | Not accessed                                                 |
| Files and docs    | Not accessed                                                 |
| Web browsing      | Not tracked                                                  |

### Security practices

- Data encrypted in transit: **Yes** (HTTPS/TLS for all API calls)
- Data encrypted at rest: **Yes** (Firebase/GCP default encryption)
- Users can request data deletion: **Yes** (account deletion available in-app)
- Committed to Play Families Policy: **No** (app is 17+ content rating)

### Key disclaimers to include

- "Canopy Trove does not process financial transactions."
- "Canopy Trove does not facilitate cannabis purchases, ordering, pickup, or delivery."
- "Canopy Trove does not collect or store any payment information."
- "User-generated content (owner updates, reviews) is moderated for policy compliance."

---

## 2. App Review Submission Note

Paste this into the **"App content" > "Content rating" > "Additional information"** field or the review notes section when submitting for review.

> **What Canopy Trove does:**
>
> Canopy Trove is a licensed dispensary discovery and business-information platform for New York State. It helps users find state-licensed dispensaries, view business information (hours, location, amenities, reviews), and read community updates from verified dispensary owners.
>
> **What Canopy Trove does NOT do:**
>
> - It is not a marketplace.
> - It does not facilitate cannabis ordering, pickup, delivery, or reservations.
> - It does not process transactions of any kind.
> - It does not display product menus, prices, or inventory.
> - It does not contain cannabis product imagery in the Android experience.
> - It does not initiate owner billing or subscription management inside the Android app.
>
> **Content moderation system:**
>
> Dispensary owners can publish informational cards (announcements, events, hours changes, community updates). On Android, all owner-created content is classified by an automated moderation engine before publication:
>
> - **Green (auto-approved):** Informational content such as store hours, community events, educational sessions, and amenity updates.
> - **Yellow (manual review required):** Ambiguous content that could be informational or commercial. Held for human review before appearing on Android.
> - **Red (auto-blocked on Android):** Any content containing cannabis sales language, product-specific promotions, pricing, discounts, or ordering/delivery CTAs. This content is never served to Android clients.
>
> The moderation engine runs server-side. Android API responses never include blocked content — filtering is not client-side only.
>
> **Content rating:** We recommend a 17+ rating due to the cannabis-adjacent nature of the business directory.
>
> **UGC moderation:** User reviews are moderated. Owner-created content is classified and filtered as described above. Report and removal tools are available.

---

## 3. Content Rating Questionnaire Guidance

When completing the IARC content rating questionnaire:

| Question area            | Recommended answer                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| Violence                 | None                                                                                       |
| Sexuality                | None                                                                                       |
| Language                 | Mild (user reviews may contain informal language)                                          |
| Controlled substance     | Reference to controlled substances (the app lists licensed cannabis dispensaries)          |
| Gambling                 | None                                                                                       |
| User interaction         | Users can interact (reviews, following storefronts)                                        |
| Users can share location | Yes (for nearby dispensary discovery)                                                      |
| Digital purchases        | None in the Android build (no in-app purchases, no transactions, no billing checkout flow) |

This should result in a **17+ / Mature** rating, which is appropriate.

---

## 4. Store Listing Language Guidance

### App title

"Canopy Trove — Licensed Dispensary Finder"

### Short description (80 chars max)

"Find licensed dispensaries near you. Hours, reviews, events, and updates."

### Full description — key phrases to INCLUDE

- "licensed dispensary discovery"
- "business information platform"
- "community updates and events"
- "verified dispensary hours and locations"
- "owner-published announcements"
- "user reviews and ratings"

### Full description — phrases to AVOID

- "deals" / "specials" / "discounts"
- "order" / "pickup" / "delivery" / "reserve"
- "shop" / "menu" / "browse products"
- "cannabis deals near you"
- "best prices"
- "THC" / "CBD" / specific product terms
- Anything that implies the app facilitates a purchase

---

## 5. Screenshot Guidance

### What to show in Android screenshots

1. **Map view** — dispensary pins on a clean map with distance labels
2. **Storefront list** — sorted by distance or rating, showing name/address/hours/rating. No promotion badges or deal text visible.
3. **Storefront detail** — hours, amenities, reviews, community updates. No "active promotions" section.
4. **Owner update card** — an informational card like "Open late Friday" or "Community cleanup this Saturday"
5. **Review screen** — a user review with rating stars and reply from owner
6. **Profile/gamification** — badges, points, level progression

### What to NEVER show in Android screenshots

- Any card with "% off", "deal", "special", "BOGO"
- The iOS "Specials" filter chip or "Hot Deals" lane
- Any promotion with product-specific language
- Any card with "shop menu", "reserve", "pickup", "delivery"
- Price-led promotional badges

### Recommended screenshot flow

| Screenshot | Content                                | Purpose              |
| ---------- | -------------------------------------- | -------------------- |
| 1          | Map with dispensary pins               | Discovery            |
| 2          | List view sorted by distance           | Browsing             |
| 3          | Storefront detail with hours + reviews | Business info        |
| 4          | Owner "Community Event" update card    | Owner content (safe) |
| 5          | User review with owner reply           | Community            |
| 6          | Profile with badges and level          | Engagement           |

### Screenshot production notes

- Use a real Android device or Android emulator — not iOS screenshots
- The Android build should already show "Updates" not "Specials" in the filter bar
- Verify no deal/promo language appears anywhere in visible text
- If any promotion text leaks through, re-run the moderation classifier or use a test account with no active promotions

---

## 6. Category and Tags

| Field    | Recommended value                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Category | Maps & Navigation (primary) or Lifestyle                                                                   |
| Tags     | "dispensary finder", "licensed dispensary", "cannabis directory", "dispensary hours", "dispensary reviews" |

Avoid tags like "cannabis deals", "weed delivery", "marijuana shop".

---

## 7. Pre-Submission Checklist

- [ ] Data safety form completed with the responses above
- [ ] Content rating questionnaire completed (expecting 17+)
- [ ] Review note pasted into submission notes
- [ ] Store listing uses safe language (no deal/order/purchase terms)
- [ ] All 6 screenshots show the Android experience (not iOS)
- [ ] No screenshot contains deal, discount, or product language
- [ ] App bundle uses the Android moderation build (server-side filtering confirmed)
- [ ] Test on a real Android device: open 5 storefronts, verify no blocked promo text appears
- [ ] Updates surfaces say "Updates" and do not surface "Hot Deals" copy
- [ ] Notification channel shows "Favorite store updates" not "Favorite store deals" in Android settings
- [ ] Owner billing screen is read-only on Android and does not open external checkout or billing management
- [ ] External links labeled "Website" not "Menu" (if gating applied)
- [ ] Privacy policy URL works and is accessible
- [ ] Terms of service URL works and is accessible
