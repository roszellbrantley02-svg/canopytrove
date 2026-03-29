# Canopy Trove Phone QA Checklist

Updated: March 28, 2026

Use this on a real Android phone with the canonical build:

```powershell
cd "C:\Users\eleve\Documents\New project\canopy-trove-3-restored"
eas build --platform android --profile preview
```

## 1. Install And Launch

- [ ] Install the latest `preview` build cleanly.
- [ ] Confirm the launcher icon is readable and sized correctly.
- [ ] Confirm the splash / front logo renders large and centered on black.
- [ ] Confirm the app opens without a red screen or immediate crash.

## 2. Nearby And Browse

- [ ] Nearby loads storefront cards without getting stuck at the bottom.
- [ ] Browse loads more storefronts correctly beyond the initial batch.
- [ ] Nearby and Browse cards show the expected open/closed badge.
- [ ] Nearby and Browse route-arrow actions launch navigation correctly.
- [ ] Favorite toggles still work from card and detail surfaces.

## 3. Storefront Detail

- [ ] Test at least 3 storefronts with real published hours.
- [ ] Confirm the website button opens the correct website.
- [ ] Confirm hours render when the place has real published hours.
- [ ] Confirm `Open Now` / `Closed` matches the real storefront state.
- [ ] Confirm at least 1 storefront with no published hours shows the fallback state instead of fake hours.

## 4. Reviews And Reports

- [ ] Open write review and confirm the submit button works end to end.
- [ ] Confirm GIF search loads and a selected GIF appears in the review flow.
- [ ] Confirm a submitted review appears correctly on the storefront.
- [ ] Confirm rating waiting-state copy appears below the public threshold.
- [ ] Confirm report submission still works and shows the correct destination/explanation.

## 5. Visit Prompt And Notifications

- [ ] Start navigation to a storefront and confirm the arrival prompt can appear while the app is active.
- [ ] Confirm the arrival copy says `Tell us how your visit was.`
- [ ] Confirm favorite-store deal notifications still register and fire in the expected flow.
- [ ] If testing owner deals, confirm a new active deal can trigger the saved-store alert path.

## 6. Profile, Legal, And Account

- [ ] Open Profile and confirm the polished profile surfaces render correctly.
- [ ] Open the legal center and confirm the release-status card renders.
- [ ] Confirm support email opens correctly.
- [ ] If public legal URLs are configured, confirm each external legal link opens.
- [ ] Open Delete Account and confirm the warning/help text renders correctly.
- [ ] If testing deletion, confirm success and partial-failure messaging match the actual result.

## 7. Owner Portal

- [ ] Confirm owner access behaves correctly for the current build type.
- [ ] In `preview`, confirm the guided owner demo is available.
- [ ] In `production`, confirm the guided owner demo is hidden.
- [ ] Confirm owner promotions can be viewed and their card effects appear correctly on the consumer app.
- [ ] Confirm owner billing screen renders with the expected readiness state.

## 8. Launch Readiness Call

Mark each item:

- `PASS`
- `FAIL`
- `NEEDS FOLLOW-UP`

Do not call the app public-release ready until all `FAIL` items are cleared and all `NEEDS FOLLOW-UP` items have an owner.
