# Google Play Submission Packet

Updated: April 20, 2026

This file is the single handoff packet for Google Play Console copy, screenshot
specs, content rating guidance, and the remaining non-code blockers.

## Status

Ready now:

- public site live at `https://canopytrove.com`
- privacy, terms, community guidelines, account deletion pages live
- Android adaptive icon, monochrome icon, and intent filters configured in app.json
- EAS production build profile configured for Android
- Age gate (21+) integrated at app entry
- Android App Links file published at `.well-known/assetlinks.json`

Still needed:

- Google Play developer account ($25 one-time enrollment)
- Replace the placeholder SHA-256 fingerprint in `.well-known/assetlinks.json` with the real Android release signing fingerprint, then verify App Links
- Android screenshot set rendered at Play Store required dimensions
- IARC content rating questionnaire completed in Play Console
- Real Play Console store listing entered

## Play Console Store Listing Copy

### App name

`Canopy Trove`

### Short description (max 80 chars)

`Verify licensed storefronts nearby. Adults 21+ where lawful.`

### Full description (max 4000 chars)

Canopy Trove helps adults verify and browse licensed storefronts with a calmer,
more trusted experience. Check official-license context, storefront details,
hours, ratings, and community feedback before deciding whether a location is
worth visiting.

The Android release is New York-first and built around official license checks
and business information for adults 21+ where applicable. Storefront pages bring
together hours, contact details, ratings, photos, and useful community context in
one place so the experience feels considered instead of crowded.

Key features:

- Browse licensed storefronts by location, distance, or category
- View hours, contact info, photos, and verified licensing details
- Save favorite storefronts
- Read and write thoughtful community reviews with photo support
- Verify storefront license information against official public records

Canopy Trove is not an ordering, checkout, or delivery platform. The product is
positioned around licensed storefront discovery, official verification, trusted
details, favorites, and community reviews. The Android app does not include
product catalogs, product menus, product reviews, owner business tools, checkout,
pickup scheduling, delivery coordination, or cannabis-product purchasing.

### Category

`Maps & Navigation` (primary) or `Lifestyle` (secondary)

### Tags

`licensed storefront`, `license verifier`, `business directory`, `reviews`

## Content Rating (IARC Questionnaire)

Answer these questions in the Google Play Console IARC questionnaire:

| Question                                                            | Answer                                      | Rationale                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Does the app contain references to drugs or drug use?               | Yes — adult-use storefront references       | The app lists licensed adult-use storefronts by nature but does not sell, order, or facilitate transactions.                     |
| Does the app facilitate the sale of drugs or controlled substances? | No                                          | The Android app is directory and verification-only. No cart, no ordering, no pickup scheduling, no delivery, no product catalog. |
| Does the app contain user-generated content?                        | Yes                                         | Community reviews with photos (moderated before publishing).                                                                     |
| Does the app share the user's location?                             | Yes — approximate and precise, with consent | Used to find nearby dispensaries. Standard location permission flow.                                                             |
| Does the app contain in-app purchases?                              | No                                          | The Android build does not initiate owner-plan checkout or billing management inside the app. Consumer use stays free.           |

Expected IARC rating: **Mature 17+** or equivalent (varies by region).

## Screenshot Specifications

Google Play requires screenshots for at least one device type. Recommended:

### Phone screenshots (required)

- Minimum: 2 screenshots, maximum: 8
- Size: `1080 x 1920` (portrait, 16:9) or `1080 x 2340` (portrait, 19.5:9)
- Format: JPEG or 24-bit PNG, no alpha

### 7-inch tablet (recommended)

- Size: `1200 x 1920`

### 10-inch tablet (recommended)

- Size: `1600 x 2560`

### Suggested screenshot sequence (reuse Apple set, re-render at Android sizes)

1. **Discovery** — Map/list view showing nearby licensed storefronts
2. **Confidence** — Licensing verification badges and trust signals
3. **Detail** — Full storefront detail page (hours, photos, ratings)
4. **Profile** — Saved favorites, visit history, and personalization
5. **Reviews** — Community review thread with photos

The existing HTML screenshot templates at `public-release-pages/store-screenshots/`
can be re-rendered at the Android dimensions above. Adjust the device frame from
iPhone to a Pixel 8 or generic Android frame.

## Google Play Policy Compliance

Canopy Trove is prepared for Google Play review around a narrow
directory-and-verification Android experience:

1. **No in-app transactions for cannabis products.** The Android app does not
   have a shopping cart, product catalog, product reviews, "add to cart" buttons,
   or any checkout flow for cannabis.

2. **No delivery arrangement.** The app provides directions to dispensaries via
   Google Maps deep links. It does not coordinate delivery, pickup scheduling,
   or courier services.

3. **Discovery and information only.** The Android app shows storefront name,
   location, hours, reviews, and licensing status. It does not expose product
   menus, product brands, pricing, discounts, or owner promotion tools.

4. **Age gate enforced.** A 21+ age verification screen appears on first launch
   before any content is accessible. Acceptance is persisted locally.

5. **Licensed storefronts only.** All listed dispensaries come from the New York
   Office of Cannabis Management (OCM) licensed dispensary registry. The app
   does not list unlicensed or gray-market operations.

If the app is rejected, appeal by pointing to the age gate, absence of any
cart/checkout/delivery/pickup/product-catalog functionality, OCM licensing data,
and the Android-specific policy gates that remove owner, product, brand, and
promotion surfaces.

## Privacy Policy and Data Safety

Google Play requires a Data Safety section. Here is the declaration:

### Data collected

| Data type            | Collected                 | Shared | Purpose                               |
| -------------------- | ------------------------- | ------ | ------------------------------------- |
| Approximate location | Yes                       | No     | Find nearby licensed storefronts      |
| Precise location     | Yes                       | No     | Distance calculation, visit detection |
| Email address        | Yes (if signed in)        | No     | Account, owner portal auth            |
| Photos               | Yes (if uploading review) | No     | Review attachments (moderated)        |
| App interactions     | Yes                       | No     | Analytics, screen views               |
| Crash logs           | Yes                       | No     | Sentry crash reporting                |

### Data handling

- Data is encrypted in transit (HTTPS)
- Users can request account deletion via in-app flow or canopytrove.com/account-deletion
- Data is not sold to third parties
- Data is not used for advertising

## Feature Graphic

Google Play requires a 1024 x 500 feature graphic. Create one with:

- Dark background (#0A1117 or #121614)
- Canopy Trove logo centered
- Tagline: "Licensed storefront verification"
- Clean, minimal — no screenshots in the feature graphic

## Public URLs (same as Apple)

- Website: `https://canopytrove.com`
- Support: `https://canopytrove.com/support`
- Privacy Policy: `https://canopytrove.com/privacy`
- Terms: `https://canopytrove.com/terms`

## Remaining Manual Google Play Steps

1. Create a Google Play developer account at https://play.google.com/console
2. Create the app listing using the copy above.
3. Render Android phone screenshots at 1080x2340 from the existing HTML templates.
4. Create the 1024x500 feature graphic.
5. Complete the IARC content rating questionnaire using the answers above.
6. Fill in the Data Safety section using the table above.
7. Insert the real Android release signing SHA-256 fingerprint into `.well-known/assetlinks.json`.
8. Run `eas build --platform android --profile production` to generate the AAB.
9. Upload the AAB to the production track.
10. Submit for review.
