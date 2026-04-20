# Apple App Review Notes

Updated: April 19, 2026

## Exact Review Notes To Paste

Canopy Trove is a New York-first mobile app for adults 21+ using the service where lawful. The product is for licensed dispensary discovery, storefront details, thoughtful reviews, saved favorites, optional alerts, and product scanning for lab results. It does not offer cannabis ordering, cannabis checkout, payments for cannabis products, or delivery brokering.

The current release is intentionally positioned around lawful discovery and product transparency:

- licensed dispensary storefront discovery only
- product scanning for lab test results (Certificate of Analysis data) from NY-licensed testing labs
- adults 21+ where lawful
- New York-first launch posture in the current release
- no in-app cannabis ordering or cannabis checkout flow

### Camera Usage and Product Scanning

The Verify tab now features a camera-first interface. The app requests camera permission via NSCameraUsageDescription: "Canopy Trove uses your camera to scan QR codes and barcodes on products and dispensary signs for verification and lab results."

Camera is used only for on-device QR and barcode scanning. No images are transmitted to Canopy Trove's servers or any third parties. The app detects codes locally, resolves them to either (1) NY OCM license records or (2) lab-issued Certificate of Analysis data hosted by NY-licensed testing labs, and surfaces the results in the app. No photos are stored or transmitted.

### Product Scan Privacy and Data

Every scan event is logged anonymously using only the device's install ID (never personal information or user identity). Scan data includes the code that was scanned, whether it resolved to a shop or product, an optional approximate location (only if the user grants permission during scan), and the brand/batch identifier if it resolved to a COA. This data is used to power features like "trending brands near you" and operator dashboards.

Users never need to sign in to scan. Location at time of scan is entirely optional and is only used to aggregate brand signal by market area — never linked to the user. Users can email askmehere@canopytrove.com to request scan-history deletion at any time; a Profile → Privacy in-app toggle to disable scan logging entirely is called out as planned in the privacy policy and will ship in a near-term release. All scan logging is install-anonymous by default and does not enable cross-app tracking.

---

## How Canopy Trove Verifies Storefronts Are Licensed

Every dispensary surfaced in the app is cross-referenced against the New York State Office of Cannabis Management (OCM) public adult-use license registry published at `https://data.ny.gov/resource/jskf-tt3q.json`. Listings without an active OCM license number are either held for owner verification or excluded from consumer discovery. When a dispensary owner claims a storefront, the backend automatically validates their submitted license number against the same OCM registry before granting publication rights. This is our primary compliance mechanism for Guideline 1.4.3.

In addition to backend cross-referencing, the Verify tab's **Scan shop QR** option is designed to read New York State's official "Scan to Verify" license placard — a state-mandated QR code that OCM-licensed dispensaries are required to display in public view at the storefront. Reference: `https://cannabis.ny.gov/dispensary-location-verification`. This means Canopy Trove's in-store scan flow surfaces a regulatory verification artifact that the state itself has deployed; the app is the consumer-facing interface for a state-issued compliance tool, not a private mechanism built on top of cannabis commerce.

### Pre-launch Reviewer Context (Expected Empty-Data Behavior)

The current build is the initial submission, so Canopy Trove has no consumer user base yet. Reviewers will see the following pre-launch conditions, which are expected behavior rather than broken UI:

- **Ratings read "Rating Pending" or "1 / 10 ratings"** on most storefront cards — the app requires a minimum review count before showing an aggregate score.
- **Storefront photos may be empty** on some listings — the app pulls photos from Google Places where available and shows a neutral placeholder otherwise. No consumer-submitted imagery is expected on day one.
- **Many storefronts will show "CLOSED"** depending on the time of day the review is performed. Hours come from Google Places and reflect the real operating hours of independent NY dispensaries, which are often more limited than national chains.
- **Community signals (saves, visits, reports)** will be sparse — these build up post-launch.

None of this affects the compliance flows (OCM verification, Scan shop QR, Scan product COA). Those are testable end-to-end regardless of user base.

Community moderation and safety controls are available in the product:

- storefront issues can be reported
- abusive reviews can be reported from the storefront detail screen
- review authors can be blocked from the same review surface
- legal, privacy, support, and deletion-help links are published and reachable

The owner workspace is a private business-management surface for licensed dispensary operators or approved staff managing a claimed storefront. It covers listing management, review follow-up, promotions, verification follow-up, and owner billing. It is not a consumer membership and not a way to purchase cannabis.

## Reviewer Handoff Checklist

- Provide one customer test account if Apple needs to test gated review posting or saved-member flows.
- Provide one owner test account only if Apple explicitly asks to inspect the private owner workspace.
- In reviewer notes, describe the owner side as a licensed business workspace rather than a consumer premium tier.
- Keep the public legal and support pages live during review:
  - `https://canopytrove.com/privacy`
  - `https://canopytrove.com/terms`
  - `https://canopytrove.com/community-guidelines`
  - `https://canopytrove.com/support`
  - `https://canopytrove.com/account-deletion`

## What To Avoid

- Do not describe Canopy Trove as a cannabis marketplace.
- Do not imply that cannabis products can be ordered, purchased, or delivered inside the app.
- Do not call the owner plan a premium consumer subscription.
- Do not submit without real reviewer credentials if any tested flow requires sign-in.
