# Saves recovery receipt

Run at: 2026-05-02T18:25:08.727Z

## What this records

Recovery write for the saves-bug victims (audit: `docs/audits/saves-bug-affected-users.md`). For each affected account, we wrote the union of their `recentStorefrontIds` (across all profile docs) into their canonical (most-recently-updated) `route_state` doc as `savedStorefrontIds`. Set-union semantics: existing saves are preserved, no double-add on re-run.

## Summary

- **Accounts processed**: 5
- **Accounts written**: 5
- **Accounts skipped (already up to date)**: 0
- **Failed**: 0

## Per-account writes

### rozellbrantley@icloud.com

- accountId: `PTGZVrZuTxZDjst0ihiM079DmQi1`
- canonical route_state doc: `canopytrove-profile-moniixw3-9rnxekzg`
- existing saves before write: 0
- shops recovered (added): **4**
- result: ✓ verified on disk

Recovered shops:

- The Coughie Shop (Wolcott) [`ocm-14590-wolcott-the-coughie-shop`]
- Victory Road Farm (Red Creek) [`ocm-13143-red-creek-victory-road-farm`]
- Leafy Wonders LLC (Fulton) [`ocm-13069-fulton-leafy-wonders-llc`]
- Haze and Harvest (Newark) [`ocm-14513-newark-haze-and-harvest`]

### danielletuper88@gmail.com — Daniellett

- accountId: `RU4CIU6AJ0PrMBmcyGQzIJ6N4Bg1`
- canonical route_state doc: `canopytrove-profile-mnm9oluu-ywx1s42g`
- existing saves before write: 0
- shops recovered (added): **9**
- result: ✓ verified on disk

Recovered shops:

- Victory Road Farm (Red Creek) [`ocm-13143-red-creek-victory-road-farm`]
- Haze and Harvest (Newark) [`ocm-14513-newark-haze-and-harvest`]
- The Coughie Shop (Wolcott) [`ocm-14590-wolcott-the-coughie-shop`]
- 48 Genesee St Dispensary (Auburn) [`ocm-13021-auburn-48-genesee-st-dispensary`]
- Leafy Wonders LLC (Fulton) [`ocm-13069-fulton-leafy-wonders-llc`]
- FlynnStoned Oswego (Oswego) [`ocm-13126-oswego-flynnstoned-oswego`]
- Poppin (New York) [`ocm-10001-new-york-poppin`]
- Housing Works Cannabis Co NoMad (New York) [`ocm-10001-new-york-housing-works-cannabis-co-nomad`]
- Just Breathe Fingerlakes (Seneca Falls) [`ocm-13148-seneca-falls-just-breathe-fingerlakes`]

### kabp24g38byfrvbith9@icloud.com — App

- accountId: `BL9b3X1fwSP5cZegiVWt3160ihw2`
- canonical route_state doc: `canopytrove-profile-mofx4h2j-jsic3w8m`
- existing saves before write: 0
- shops recovered (added): **2**
- result: ✓ verified on disk

Recovered shops:

- The Coughie Shop (Wolcott) [`ocm-14590-wolcott-the-coughie-shop`]
- Haze and Harvest (Newark) [`ocm-14513-newark-haze-and-harvest`]

### mb38p24g38bgfuekdeq@icloud.com — App

- accountId: `jznHId45XCdkyZrJoXUildHteKj1`
- canonical route_state doc: `canopytrove-profile-mofx5ekh-uo64l1zm`
- existing saves before write: 0
- shops recovered (added): **2**
- result: ✓ verified on disk

Recovered shops:

- The Coughie Shop (Wolcott) [`ocm-14590-wolcott-the-coughie-shop`]
- Haze and Harvest (Newark) [`ocm-14513-newark-haze-and-harvest`]

### smolinskialicia@yahoo.com — smolinskialicia@yahoo.com

- accountId: `wlOSCteTM6VwBrNGAcY6QwdZPLj2`
- canonical route_state doc: `canopytrove-profile-moiwa01w-2qps116p`
- existing saves before write: 0
- shops recovered (added): **2**
- result: ✓ verified on disk

Recovered shops:

- Twisted Cannabis FLX (Geneva) [`ocm-14456-geneva-twisted-cannabis-flx`]
- Haze and Harvest (Newark) [`ocm-14513-newark-haze-and-harvest`]

---

## What happens next

1. **Owner-portal follower counts** for the shops above will start showing real numbers immediately (the live-compute fix from PR #19 reads route_state on every detail request).
2. **When affected users next open the app**, the hydration code (PR #21) will load these saves into local state. Their device UI will show the saves restored.
3. **Deal-digest cron**, once `EMAIL_DEAL_DIGESTS_ENABLED=true` flips on Cloud Run, will treat these users as eligible. They'll get morning emails for any of their saved shops that post deals.
4. **Idempotent** — re-running this script won't double-add anything. Set-union semantics.
