# Canopy Trove Recovery Checklist

Updated: March 29, 2026

## Completed Recovery Changes

- [x] Restored the `canopy-trove-3` codebase into a stable working copy.
- [x] Renamed the product surface to `Canopy Trove`.
- [x] Recovered the profile, report, review, age-gate, and post-visit prompt flows.
- [x] Rebuilt the post-visit notification and visit-tracking behavior.
- [x] Fixed EAS project linkage for the `canopytrove` slug.
- [x] Fixed `expo doctor` blockers so preview builds could run again.
- [x] Fixed the later `expo doctor` build failure caused by Expo SDK 55 expecting `react-native@0.83.4` and aligned the app back to that patch version.
- [x] Restored storefront detail operational fallback so `website`, `hours`, and `openNow` can be recovered while the backend warms missing storefront details.
- [x] Updated the storefront detail hero badge to show `Open Now` / `Closed` / `Checking` instead of saved-state labels.
- [x] Updated storefront cards to show live `Open Now` / `Closed` status instead of saved-state labels.
- [x] Added backend support for `openNow` on storefront detail responses.
- [x] Normalized placeholder `Hours not published yet` seed values so the app no longer marks missing hours as live published hours.
- [x] Locked the `preview` EAS profile to the hosted API path instead of the dead LAN API path.
- [x] Created `docs/audits/2026-04/MOVE_OFF_COMPUTER_CANOPYTROVE_BASELINE.md` as the canonical exportable recovery baseline file.
- [x] Repaired the review composer so submit state is explicit and the GIF picker still works without a live GIPHY API key.
- [x] Added a storefront rating waiting-state with a `10`-rating threshold before public averages appear.
- [x] Clarified the report-review destination in-app so preview builds show local-device storage and API mode shows the backend moderation path.
- [x] Added favorite-store deal alerts that watch saved storefronts and notify on newly detected deals after the initial silent sync.
- [x] Removed the custom top-edge highlight line from the bottom toolbar.
- [x] Added the backend favorite-deal alert sync path for authenticated API-mode profiles.
- [x] Documented the favorite-deal alert system and backend collection in `docs/FAVORITE_DEAL_ALERTS.md`.
- [x] Added Expo push-token support for backend favorite-deal alerts.
- [x] Added backend favorite-deal dispatch paths for scheduled delivery.
- [x] Added a safe owner-portal preview path so the paid dispensary-owner section can be browsed without real owner auth, uploads, or subscription writes.
- [x] Documented the owner preview entry and file map in `docs/OWNER_PORTAL_PREVIEW.md`.
- [x] Polished the owner portal surface into a production-facing owner workspace while keeping the guided demo and badge-review tools separate.
- [x] Documented remaining owner-portal launch gaps in `docs/OWNER_PORTAL_READINESS.md`.
- [x] Added a release-readiness assessment and blocker list in `docs/RELEASE_READINESS.md`.
- [x] Enlarged the launcher icon assets so the Canopy Trove logo reads more prominently in install builds.
- [x] Added owner-preview hot-deal badge editing with timed live badges that flow through Nearby, Browse, and Hot Deals cards.
- [x] Added storefront-card badge chips with a red hot-deal treatment and a five-badge cap.
- [x] Added a fallback for storefront hours using Google `currentOpeningHours.weekdayDescriptions` when regular hours are missing.
- [x] Added a tab-focus scroll reset on Nearby and Browse to avoid reopening those screens at a stuck bottom position.
- [x] Restored the original single-store owner badge editor and added a separate temporary override lab so any preview storefront card or every preview card can be tested without deleting the owner flow.
- [x] Replaced the small in-app GPS/navigation glyphs with a cropped Canopy Trove brand mark in the shared header and storefront travel UI.
- [x] Restored `Go Now` buttons to arrow icons while keeping the brand mark in the shared location UI.
- [x] Added custom owner deal-duration input up to 720 hours in both preview deal editors.
- [x] Switched the visit follow-up flow to a foreground-only arrival prompt that says `Tell us how your visit was.` and removed background-location requirements from app config.
- [x] Added an in-app legal center with privacy, moderation, and community-guidelines coverage.
- [x] Added an in-app account deletion flow from Profile.
- [x] Added one-time community-guidelines acceptance before review submission.
- [x] Added local author-blocking controls on storefront reviews.
- [x] Added secured backend admin-review endpoints for owner claims, owner verification, and storefront reports.
- [x] Added live owner billing code paths using hosted Stripe checkout, webhook syncing, and billing-portal sessions when production env is configured.
- [x] Created Stripe sandbox owner-plan resources at `$49/month` and `$490/year` and wired hosted checkout-link fallback env into the project.
- [x] Fixed the iOS release identity to `com.rezell.canopytrove` and added the `canopytrove` URL scheme.
- [x] Added production release docs for privacy policy, terms, community guidelines, admin review, store metadata, and production setup.
- [x] Added owner promotion priority placement so active paid deals can be boosted in Nearby, Browse, and Hot Deals.
- [x] Added owner controls for choosing placement surfaces and whether a promotion boost is storefront-area-only or statewide.
- [x] Moved boosted placement ranking ahead of pagination on the storefront summary path so featured owner deals surface correctly in live lists.
- [x] Expanded the owner dashboard with premium ROI metrics for impressions, opens, follower count, reviews, website taps, menu taps, phone taps, and total tracked actions.
- [x] Added owner conversion-rate views for open-to-route, open-to-website, open-to-menu, and open-to-phone.
- [x] Added top-promotion attribution on the owner dashboard so the best live offer shows impressions, opens, and tracked actions in one summary.
- [x] Expanded promotion performance cards to show action rate plus website, menu, and phone taps for each offer.
- [x] Added explicit owner-demo build gating so preview/demo owner flows stay available in `preview` builds but are disabled in `production` builds.
- [x] Hardened legal-center release wiring so the app now shows required public legal URL status, support contact, and account-deletion help paths from one central env-driven config.
- [x] Hardened owner-billing release wiring so app and backend billing paths now report the exact missing Stripe/public env vars by name.
- [x] Hardened account deletion so partial login-removal failures are explicit and the user is signed out before retrying.
- [x] Hardened admin-review readiness so `/admin/reviews/*` returns explicit missing setup requirements instead of generic backend failures.

## Verified So Far

- [x] Root TypeScript check passes.
- [x] Backend TypeScript check passes.
- [x] `expo doctor` now passes `17/17` again.
- [x] Android `:app:compileDebugKotlin` passed during recovery.
- [x] Preview install on phone is mostly functional.

## Still Needing Runtime QA

- [ ] Confirm at least three storefronts show correct `website`.
- [ ] Confirm at least three storefronts show correct `hours`.
- [ ] Confirm storefront hero badge matches real `Open Now` / `Closed` state.
- [ ] Confirm the detail fallback still works when the laptop backend is offline.
- [ ] Confirm route launch and post-visit notifications still work after the storefront-detail fix.
- [ ] Confirm legal-center links and account-deletion flow behave correctly on device.
- [ ] Confirm owner billing screen handles checkout, refresh, and billing management cleanly once Stripe pricing is configured.
- [ ] Confirm a live owner promotion with Nearby/Browse/Hot Deals placement boosts correctly on phone while active.
- [ ] Run the full pass/fail device checklist in `docs/PHONE_QA_CHECKLIST.md`.

## Known Architecture Notes

- The mobile app no longer bundles a public Google Places key.
- Storefront operational enrichment now stays behind `backend/src/storefrontService.ts` and `backend/src/services/googlePlacesService.ts`.
- The local API URL in `.env` is still a LAN address, so preview builds should not depend on it for critical detail rendering.
- The storefront hours, website, and open/closed behavior are now functionally repaired through backend-owned enrichment; the remaining hardening work is about server key restriction and long-term hosting architecture.
- Owner billing is now code-complete, but real Stripe env configuration and price ids still need to be supplied on the hosted backend or via hosted payment-link fallback env.
- Priority placement is now driven by owner promotion metadata:
  - `placementSurfaces` controls which surfaces get the boost
  - `placementScope` controls whether the boost is local to the storefront area or statewide
- Owner ROI now also tracks storefront tap outcomes:
  - `website_tapped`
  - `phone_tapped`
  - `menu_tapped`
  - these feed the owner dashboard and promotion performance screens
- Owner preview/demo exposure is now controlled by `EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED`.
- `preview` builds explicitly enable the owner demo, and `production` builds explicitly disable it in `eas.json`.
- Public legal-link readiness is now controlled from `src/config/legal.ts`, and the legal center explicitly surfaces any missing required Expo public env vars.
- Owner billing readiness is now controlled from `src/config/ownerBilling.ts` and `backend/src/config.ts`, with explicit missing-env reporting for checkout, portal, and webhook setup.
- Account deletion now distinguishes between full deletion and partial deletion where backend/profile data was cleared but the login still requires a recent sign-in to remove.
- Admin review readiness now depends on both `ADMIN_API_KEY` and backend Firebase admin access, and setup errors are surfaced directly from the route layer.

## Next Hardening Tasks

- [ ] Restrict the backend Google Maps key to only the Google Maps Platform API surface actually used by the server.
- [ ] Rotate any older Google Places key that was previously shipped in mobile build config.
- [ ] Verify Google Cloud quota and abuse monitoring after the key rotation.

## Release Blockers To Remember

- [x] Remove or hard-gate the internal owner preview from public release builds.
- [ ] Configure hosted Stripe env and webhook delivery.
- [ ] Publish live public legal URLs and wire them into Expo env.
- [ ] Decide whether owner access remains invite-only or opens more broadly.
- [ ] Hide or hard-gate the owner demo for public release builds.
- [ ] Finish phone QA and store-listing metadata.
