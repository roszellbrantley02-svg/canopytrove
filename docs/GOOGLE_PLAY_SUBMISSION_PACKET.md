# Google Play Submission Packet

Updated: April 4, 2026

This file is the single handoff packet for Google Play Console copy, screenshot
specs, content rating guidance, and the remaining non-code blockers.

## Status

Ready now:

- public site live at `https://canopytrove.com`
- privacy, terms, community guidelines, account deletion pages live
- Android adaptive icon, monochrome icon, and intent filters configured in app.json
- EAS production build profile configured for Android
- Age gate (21+) integrated at app entry
- Deep linking with Android App Links verified via `.well-known/assetlinks.json`

Still needed:

- Google Play developer account ($25 one-time enrollment)
- Android screenshot set rendered at Play Store required dimensions
- IARC content rating questionnaire completed in Play Console
- Real Play Console store listing entered

## Play Console Store Listing Copy

### App name

`Canopy Trove`

### Short description (max 80 chars)

`Find licensed dispensaries near you. Adults 21+ where lawful.`

### Full description (max 4000 chars)

Canopy Trove helps adults discover licensed dispensaries with a calmer, more
trusted experience. Browse storefronts, check the details that matter, save
favorites, and read thoughtful community feedback before you choose where to go.

The current release is New York-first and built around lawful discovery for
adults 21+ where applicable. Storefront pages bring together hours, links,
ratings, photos, and useful community context in one place so the experience
feels considered instead of crowded.

Key features:

- Browse licensed dispensaries by location, distance, or category
- View hours, contact info, photos, and verified licensing details
- Save favorites and get notified about new deals at saved storefronts
- Read and write thoughtful community reviews with photo support
- Private tools for verified dispensary operators (claim listing, manage
  promotions, respond to reviews)

Canopy Trove is not an ordering, checkout, or delivery platform. The product is
positioned around licensed storefront discovery, trusted details, favorites,
alerts, and community reviews. No in-app purchasing of cannabis products occurs.

Canopy Trove includes private tools for verified dispensary operators managing a
claimed storefront. Those owner tools cover listing management, review follow-up,
promotions, verification, and billing for the business workspace.

### Category

`Maps & Navigation` (primary) or `Lifestyle` (secondary)

### Tags

`dispensary`, `cannabis`, `licensed`, `discovery`, `storefront`, `reviews`

## Content Rating (IARC Questionnaire)

Answer these questions in the Google Play Console IARC questionnaire:

| Question                                                            | Answer                                      | Rationale                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Does the app contain references to drugs or drug use?               | Yes — cannabis/marijuana references         | The app is a licensed dispensary directory. It references cannabis by nature but does not sell, order, or facilitate transactions. |
| Does the app facilitate the sale of drugs or controlled substances? | No                                          | The app is discovery-only. No cart, no ordering, no delivery. Users navigate to dispensary websites externally.                    |
| Does the app contain user-generated content?                        | Yes                                         | Community reviews with photos (moderated before publishing).                                                                       |
| Does the app share the user's location?                             | Yes — approximate and precise, with consent | Used to find nearby dispensaries. Standard location permission flow.                                                               |
| Does the app contain in-app purchases?                              | Yes                                         | Owner portal subscription ($49/month or $490/year) for dispensary operators. Consumer use is free.                                 |

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

1. **Discovery** — Map/list view showing nearby licensed dispensaries
2. **Confidence** — Licensing verification badges and trust signals
3. **Detail** — Full storefront detail page (hours, photos, ratings)
4. **Profile** — Saved favorites, visit history, and personalization
5. **Reviews** — Community review thread with photos
6. **Owner tools** — Operator dashboard (optional, differentiator)

The existing HTML screenshot templates at `public-release-pages/store-screenshots/`
can be re-rendered at the Android dimensions above. Adjust the device frame from
iPhone to a Pixel 8 or generic Android frame.

## Google Play Policy Compliance

Canopy Trove is compliant with Google Play's cannabis app restrictions because:

1. **No in-app transactions for cannabis products.** The app does not have a
   shopping cart, product catalog with "add to cart" buttons, or any checkout
   flow for cannabis. Users discover dispensaries and navigate externally.

2. **No delivery arrangement.** The app provides directions to dispensaries via
   Google Maps deep links. It does not coordinate delivery, pickup scheduling,
   or courier services.

3. **Discovery and information only.** The app shows dispensary name, location,
   hours, reviews, and licensing status. This is the same category as Weedmaps
   and Leafly, both of which are live on Google Play.

4. **Age gate enforced.** A 21+ age verification screen appears on first launch
   before any content is accessible. Acceptance is persisted locally.

5. **Licensed storefronts only.** All listed dispensaries come from the New York
   Office of Cannabis Management (OCM) licensed dispensary registry. The app
   does not list unlicensed or gray-market operations.

If the app is rejected, appeal with:

- Reference to Weedmaps (com.weedmaps.app.android) and Leafly (leafly.android)
  as precedent for discovery-only cannabis apps on Google Play
- Point to the age gate, absence of any cart/checkout/delivery, and OCM
  licensing data as differentiators from prohibited transaction-facilitating apps

## Privacy Policy and Data Safety

Google Play requires a Data Safety section. Here is the declaration:

### Data collected

| Data type            | Collected                 | Shared | Purpose                               |
| -------------------- | ------------------------- | ------ | ------------------------------------- |
| Approximate location | Yes                       | No     | Find nearby dispensaries              |
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
- Tagline: "Licensed dispensary discovery"
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
7. Run `eas build --platform android --profile production` to generate the AAB.
8. Upload the AAB to the production track.
9. Submit for review.
