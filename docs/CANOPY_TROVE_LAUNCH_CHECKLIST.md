# Canopy Trove Launch Checklist

Updated: April 1, 2026

## Public-Site Readiness

- [x] Homepage, support, privacy, terms, community guidelines, and account deletion pages are written for `Canopy Trove`
- [x] Public support contact is set to `askmehere@canopytrove.com`
- [x] Launch-week support owner is recorded as `danielletuper@canopytrove.com`
- [x] Canonical page URLs point at `https://canopytrove.com`
- [x] `https://canopytrove.com` is live and serving the current public-release-pages build
- [ ] `askmehere@canopytrove.com` mailbox is active and monitored
- [x] Public homepage CTA paths are verified on the live site
- [x] Human-only launch checks are documented in `docs/LAUNCH_OPERATIONS_VERIFICATION.md`

## Store Copy Readiness

- [x] Launch-ready store metadata draft exists in `docs/STORE_METADATA.md`
- [x] Screenshot brief exists in `docs/CANOPY_TROVE_SCREENSHOT_BRIEF.md`
- [x] Tagline direction is aligned to `Where legal cannabis feels chosen.`
- [x] Store copy clearly positions the app as licensed discovery, not ordering or delivery
- [x] Final screenshots are exported and matched to the Canopy Trove brand
- [x] Apple submission packet exists in `docs/APPLE_SUBMISSION_PACKET.md`
- [x] Apple review notes are written in `docs/APPLE_APP_REVIEW_NOTES.md`
- [ ] Reviewer credentials are prepared for any gated owner or admin surfaces

## Release Blocking Items

- [ ] App listing name, icon, and splash assets are fully aligned with `Canopy Trove`
- [x] Public legal/support URLs are wired into release env values
- [x] `https://canopytrove.com` resolves correctly over live DNS and HTTPS
- [ ] `askmehere@canopytrove.com` is configured with inbox ownership and a tested reply path
- [x] Production release checks pass with no missing support or legal URLs
- [ ] Account deletion help page matches the live app behavior end to end
- [ ] Real-phone QA is complete for launch-critical member flows

## Final Pre-Submission Checks

- [ ] Test every public page link and `mailto:` link from the live site
- [x] Confirm privacy, terms, community guidelines, support, and deletion pages are reachable without redirects breaking
- [x] Confirm store descriptions, subtitle, and screenshots use the same final brand language
- [x] Confirm lawful-use and adult-use disclosure copy is present in the store listing
- [ ] Confirm support ownership for launch week

## Current Known Blockers

- The `askmehere@canopytrove.com` mailbox still needs external setup confirmation
- `danielletuper@canopytrove.com` is the recorded launch-week support owner, but inbox receipt and reply still need a real-world test
- Account deletion help and real-phone QA still need final human verification
- Apple organization seller-name setup still depends on the D-U-N-S / organization-enrollment path
- Native package identifiers remain `com.rezell.canopytrove`, which is acceptable for this doc pass but still a brand-alignment decision for release
- See `docs/LAUNCH_OPERATIONS_VERIFICATION.md` for the exact human drill sequence

