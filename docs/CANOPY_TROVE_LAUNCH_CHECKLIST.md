# Canopy Trove Launch Checklist

Updated: March 29, 2026

## Public-Site Readiness

- [x] Homepage, support, privacy, terms, community guidelines, and account deletion pages are written for `Canopy Trove`
- [x] Public support contact is set to `support@canopytrove.com`
- [x] Canonical page URLs point at `https://canopytrove.com`
- [ ] `https://canopytrove.com` is live and serving the current public-release-pages build
- [ ] `support@canopytrove.com` mailbox is active and monitored
- [ ] Public homepage CTA paths are verified on the live site

## Store Copy Readiness

- [x] Launch-ready store metadata draft exists in `docs/STORE_METADATA.md`
- [x] Screenshot brief exists in `docs/CANOPY_TROVE_SCREENSHOT_BRIEF.md`
- [x] Tagline direction is aligned to `Where legal cannabis feels chosen.`
- [x] Store copy clearly positions the app as licensed discovery, not ordering or delivery
- [ ] Final screenshots are exported and matched to the Canopy Trove brand
- [ ] Reviewer credentials are prepared for any gated owner or admin surfaces

## Release Blocking Items

- [ ] App listing name, icon, and splash assets are fully aligned with `Canopy Trove`
- [ ] Public legal/support URLs are wired into release env values
- [ ] `https://canopytrove.com` resolves correctly over live DNS and HTTPS
- [ ] `support@canopytrove.com` is configured with inbox ownership and a tested reply path
- [ ] Production release checks pass with no missing support or legal URLs
- [ ] Account deletion help page matches the live app behavior end to end
- [ ] Real-phone QA is complete for launch-critical member flows

## Final Pre-Submission Checks

- [ ] Test every public page link and `mailto:` link from the live site
- [ ] Confirm privacy, terms, community guidelines, support, and deletion pages are reachable without redirects breaking
- [ ] Confirm store descriptions, subtitle, and screenshots use the same final brand language
- [ ] Confirm lawful-use and adult-use disclosure copy is present in the store listing
- [ ] Confirm support ownership for launch week

## Current Known Blockers

- Live hosting and DNS for `canopytrove.com` still need to be confirmed externally
- The `support@canopytrove.com` mailbox still needs external setup confirmation
- Public legal/support URLs still need final release-env confirmation in the app pipeline
- Native package identifiers remain `com.rezell.canopytrove`, which is acceptable for this doc pass but still a brand-alignment decision for release

