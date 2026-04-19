# Canopy Trove Launch Checklist

Updated: April 19, 2026

## Public-Site Readiness

- [x] Homepage, support, privacy, terms, community guidelines, and account deletion pages are written for `Canopy Trove`
- [x] Public support contact is set (see Open Item: support email alignment)
- [x] Launch-week support owner is recorded as `danielletuper@canopytrove.com`
- [x] Canonical page URLs point at `https://canopytrove.com`
- [x] `https://canopytrove.com` is live and serving the current public-release-pages build
- [x] Support mailbox is active and monitored (confirmed by founder, April 19 2026)
- [x] Public homepage CTA paths are verified on the live site
- [x] Human-only launch checks are documented in `docs/LAUNCH_OPERATIONS_VERIFICATION.md`

## Store Copy Readiness

- [x] Launch-ready store metadata draft exists in `docs/STORE_METADATA.md`
- [x] Screenshot brief exists in `docs/CANOPY_TROVE_SCREENSHOT_BRIEF.md`
- [x] Tagline direction is aligned to `Where legal cannabis feels chosen.`
- [x] Store copy clearly positions the app as licensed discovery, not ordering or delivery
- [x] Final screenshots are exported and matched to the Canopy Trove brand
- [x] Apple submission packet exists in `docs/APPLE_SUBMISSION_PACKET.md`
- [x] Apple review notes are written in `docs/APPLE_APP_REVIEW_NOTES.md` (covers Verify tab, camera permission, scan privacy, OCM)
- [x] Reviewer credentials are prepared for gated owner/admin surfaces (confirmed by founder, April 19 2026)

## Release Blocking Items

- [x] App listing name, icon, and splash assets are aligned with `Canopy Trove` (icons repainted in commit 13c3a14)
- [x] Public legal/support URLs are wired into release env values
- [x] `https://canopytrove.com` resolves correctly over live DNS and HTTPS
- [x] Support mailbox configured with inbox ownership and tested reply path
- [x] Production release checks pass with no missing support or legal URLs
- [x] Account deletion help page matches live app behavior end-to-end (verified April 19 2026: Profile → deletion screen → type DELETE → confirm; recent-sign-in branch handled in DeleteAccountScreen)
- [x] Real-phone QA in active rotation (founder testing on real iPhone — driving the recent fix stream)
- [ ] Production EAS iOS build cut on top of commit `a6ee24e` or later (NSLocationWhenInUseUsageDescription is a native plist change; previous preview build predates it)

## Final Pre-Submission Checks

- [ ] Test every public page link and `mailto:` link from the live site
- [x] Confirm privacy, terms, community guidelines, support, and deletion pages are reachable without redirects breaking
- [x] Confirm store descriptions, subtitle, and screenshots use the same final brand language
- [x] Confirm lawful-use and adult-use disclosure copy is present in the store listing
- [x] Confirm support ownership for launch week
- [ ] Apple privacy nutrition label entered in App Store Connect to match `docs/APP_STORE_PRIVACY_LABEL.md`
- [ ] Final screenshots uploaded to App Store Connect (founder taking after the next preview-build install)
- [ ] 17+ age rating declared via App Store Connect questionnaire (the app has a hard age gate on first launch — there is no in-app sale, just discovery)

## Open Items Going Into Submission

- **Support email alignment** — the in-app default (`src/config/legal.ts`) is `askmehere@canopytrove.com`, while the public site (15 HTML pages, 34 occurrences) uses `support@canopytrove.com`. Both are nominally Canopy Trove inboxes, but Apple compares them. Pick one as the canonical address and align the other side to match.
- **OCM verifier smoke check** — confirmed working by founder; spot-check 2–3 fresh license numbers right before submit so the reviewer doesn't catch a stale-cache miss.
- **Cloud Run health (`/livez`, `/readyz`)** — confirmed green by founder; re-check immediately before flipping the App Store status to "Submit for Review".

## Stretch / Post-Launch

- Per-lab COA HTML/PDF parsing so product scans surface THC/CBD/terpenes/pass-fail (factual data, no IP risk; current resolver only pulls labName + batchId from the URL).
- Profile → Privacy opt-out toggle for scan logging (privacy policy already says this is planned for an upcoming release; no UI yet).
- Brand opt-in portal for product catalog uploads (deferred — keeps Canopy Trove out of brand-photo IP territory).
- See `docs/LAUNCH_OPERATIONS_VERIFICATION.md` for the exact human drill sequence.
