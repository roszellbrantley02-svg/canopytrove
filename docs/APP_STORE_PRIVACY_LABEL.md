# App Store Privacy Nutrition Label

Updated: April 17, 2026

This document tracks the App Store Privacy Nutrition Label updates required for the product scan feature launch.

## Changes Required for Next Submission

### New Data Type: Product Interaction

**Classification:** Data Not Linked to You

**Section:** "Data Used to Track You"
- Status: **Set to "Not Tracked"**
- Rationale: Product scan events are logged at the install ID level, never at the user identity level. The install ID is a per-app device identifier. Scan data does not enable cross-app tracking and is not used to create profiles that link your identity across different apps or websites owned by other companies.

**Linked to purposes:**
- App Functionality (primary use: trending brands near you, operator dashboards)
- Analytics (secondary use: aggregating brand signal by region)

---

### New Data Type: Coarse Location

**Classification:** Data Not Linked to You (optional, aggregate-only)

**Section:** "Data Used to Track You"
- Status: **Set to "Not Tracked"** (users opt-in at scan time; location never persisted with scan records)
- Rationale: Coarse location (approximate region) is only collected when the user grants permission during a product scan. It is never linked to the user's identity and is only used to aggregate brand popularity by geographic area. Users can disable location sharing in Profile → Privacy settings.

**Linked to purposes:**
- App Functionality (powering "trending near you" features)

---

### Email to App Store Reviewer

**Subject:** Privacy Label Clarification — Product Scan Feature

**Body:**

Canopy Trove's new product scan feature logs data at the install-ID level, not the user-identity level. Here's the privacy posture:

1. **No User ID:** Scans are identified by the device's install ID alone (a per-app identifier). Canopy Trove does not link scan data to user accounts, emails, or any personal information.

2. **No Cross-App Tracking:** The install ID cannot be used to identify users across other apps or websites. Scan data never leaves Canopy Trove and is not shared with third-party data brokers or ad networks.

3. **Optional Location:** When users scan a product, they can optionally grant location permission. If granted, approximate location is recorded but never linked to the user's identity—it's only used to aggregate brand popularity by region. This is purely for showing which brands are trending in your area.

4. **Disableable:** Users can turn off scan logging entirely in the app's Profile → Privacy settings.

Because all of this data is collected and processed at the install-anonymous level (never at the user-identity level), it does not enable tracking as defined by App Tracking Transparency. There is no cross-app profiling, and the data is not used to create a user profile that links their identity across different apps or websites.

We have labeled "Product Interaction" and "Coarse Location" as **"Not Tracked"** to reflect that individual scans are not linked to a persistent user identity. The purposes are "App Functionality" (for trending features and operator dashboards) and "Analytics" (for aggregating brand signal).

---

## How to Fill in the Label in App Store Connect

1. Navigate to **App Store Connect → Your App → App Privacy**.

2. Under **"Data Used to Track You":**
   - Add a new data type: **Product Interaction**
   - Set to: **Not Tracked**
   - Purposes: App Functionality, Analytics

3. Under **"Data Not Linked to You":**
   - Add a new data type: **Product Interaction**
   - Purposes: App Functionality, Analytics

4. Under **"Data Not Linked to You":**
   - Add a new data type: **Coarse Location**
   - Purposes: App Functionality

5. Submit the app for review.

---

## Privacy Impact Summary

- **No new sensitive data types:** THC %, terpenes, and contaminant results are all public data hosted by NY-licensed labs. Canopy Trove is just surfacing what the labs have already published.
- **Install-anonymous only:** No user accounts, emails, or PII tied to any scan.
- **No third-party sharing:** Scan data stays within Canopy Trove; not shared with analytics vendors, ad networks, or data brokers.
- **User control:** Scanning is opt-in (users must allow camera), location is opt-in (users grant permission per scan), and logging is disableable in settings.

---

## References

- Apple Privacy and Data Security Details: https://developer.apple.com/app-store/app-privacy-details/
- App Tracking Transparency Overview: https://developer.apple.com/app-store/app-tracking-transparency/
- Install ID Documentation: Generated per app, per device; reset on app uninstall
