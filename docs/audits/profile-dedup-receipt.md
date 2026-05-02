# Profile-doc dedup receipt

Run at: 2026-05-02T18:32:52.054Z

## What this records

For each accountId that had multiple profile docs (the multi-profile leak — root cause: `useStorefrontProfileModel.ts:130` silently swallowed transient canonical-fetch errors and minted duplicate profiles instead of deferring), this script:

1. Picked canonical = oldest profile doc (preserves the most history)
2. Unioned savedStorefrontIds + recentStorefrontIds across ALL profile docs into the canonical
3. Hard-deleted every non-canonical profile doc and its corresponding route_state doc

Set-union semantics: no data lost. Re-runnable.

## Summary

- **Accounts processed**: 7
- **Profile docs deleted**: 51
- **All collapsed to a single canonical**: YES ✓

## Per-account

### rozellbrantley@icloud.com

- accountId: `PTGZVrZuTxZDjst0ihiM079DmQi1`
- canonical profile (kept): `canopytrove-profile-mnm574of-gl76qxy1`
- profile docs deleted: 29
- merged saves: 4
- merged recents: 4
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-mnm3jh0l-fpnsnqq7`
- `canopytrove-profile-mnm1hd81-5kupnsvz`
- `canopytrove-profile-mnor4moi-poy04uh9`
- `canopytrove-profile-mnqg2jke-epnqq375`
- `canopytrove-profile-mntgae6h-xhhlo42u`
- `canopytrove-profile-mntgahsr-n45e13q4`
- `canopytrove-profile-mntrzc6q-ac82nwbq`
- `canopytrove-profile-mo75rqnr-ucsvyfiq`
- `canopytrove-profile-mo7v1axh-g04k2f6w`
- `canopytrove-profile-mo9dei9t-4e5mcjc6`
- `canopytrove-profile-mo9djdo3-72lgesoc`
- `canopytrove-profile-mocc8j5s-exuyfd9h`
- `canopytrove-profile-mofwwb35-q70dox01`
- `canopytrove-profile-mofwyft1-c0yp2grc`
- `canopytrove-profile-mog5bdrv-s1wv6bq0`
- `canopytrove-profile-mog5ffd2-fqtyj0o9`
- `canopytrove-profile-mnufyjtn-h9mkiyfy`
- `canopytrove-profile-mojbtmf4-cqltndf6`
- `canopytrove-profile-mojvnh17-tyfkth6a`
- `canopytrove-profile-mojvvi3k-c9vty8x1`
- `canopytrove-profile-mojwq9jk-osfdh0sg`
- `canopytrove-profile-mojxx9mh-tmroix3b`
- `canopytrove-profile-mojz66i7-cp2fgu84`
- `canopytrove-profile-mok7u004-7poq7scf`
- `canopytrove-profile-mol8z4i7-eeaj83jp`
- `canopytrove-profile-molz3e7z-76rlcm9e`
- `canopytrove-profile-moniixw3-9rnxekzg`
- `canopytrove-profile-mooezk05-wp7q56zj`
- `canopytrove-profile-mooh0hyr-33wkn4uc`

### danielletuper88@gmail.com — Daniellett

- accountId: `RU4CIU6AJ0PrMBmcyGQzIJ6N4Bg1`
- canonical profile (kept): `canopytrove-profile-mnm9oluu-ywx1s42g`
- profile docs deleted: 15
- merged saves: 9
- merged recents: 9
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-mnm61tgx-jvrndbl6`
- `canopytrove-profile-mntg9c28-tjuvpnsv`
- `canopytrove-profile-mntgdkf3-xjs536tb`
- `canopytrove-profile-mntgjrfz-w4xd3vmi`
- `canopytrove-profile-mnwjgndy-mzd3wm6y`
- `canopytrove-profile-mo3roa9c-k64jfksb`
- `canopytrove-profile-mo6k4v9t-kj7y6uv1`
- `canopytrove-profile-mo6jxiep-2bquy6pz`
- `canopytrove-profile-mo7ehzj6-lmn7id7f`
- `canopytrove-profile-mo7efbc8-w1ieztv9`
- `canopytrove-profile-mo7ux0i0-wd5wz2u7`
- `canopytrove-profile-mo7uy3oe-ntxf1c7a`
- `canopytrove-profile-mo7v8dou-746pojgf`
- `canopytrove-profile-moje6re9-sbi83m1z`
- `canopytrove-profile-monilg9z-yu6chcqc`

### bookylove07@gmail.com — bookylove07@gmail.com

- accountId: `rDXdhMt7tNUFDykzo8RPbI7GLro1`
- canonical profile (kept): `canopytrove-profile-mnud3pe4-y1q9dv83`
- profile docs deleted: 1
- merged saves: 0
- merged recents: 0
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-mnud3qr1-qptqree5`

### (no email) accountId=8b7IOvGvm1gLqjy8CcJrnyoJCdj2

- accountId: `8b7IOvGvm1gLqjy8CcJrnyoJCdj2`
- canonical profile (kept): `canopytrove-profile-mo9eo8v1-iopiqxm0`
- profile docs deleted: 2
- merged saves: 0
- merged recents: 0
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-mo9eqqsc-udrxh4mz`
- `canopytrove-profile-mo9fqs5x-bgz600gy`

### kabp24g38byfrvbith9@icloud.com — App

- accountId: `BL9b3X1fwSP5cZegiVWt3160ihw2`
- canonical profile (kept): `canopytrove-profile-mofx2wq2-paggsfog`
- profile docs deleted: 1
- merged saves: 2
- merged recents: 2
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-mofx4h2j-jsic3w8m`

### smolinskialicia@yahoo.com — smolinskialicia@yahoo.com

- accountId: `wlOSCteTM6VwBrNGAcY6QwdZPLj2`
- canonical profile (kept): `canopytrove-profile-moiwa01w-2qps116p`
- profile docs deleted: 1
- merged saves: 2
- merged recents: 2
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-moiwdudm-egrs4iv7`

### roszellbrantley02@gmail.com — roszellbrantley02@gmail.com

- accountId: `FYvCkdxZscgHxTYsWqS7iaPJV5l2`
- canonical profile (kept): `canopytrove-profile-mojd9wsg-6max426r`
- profile docs deleted: 2
- merged saves: 0
- merged recents: 0
- profile docs remaining after dedup: 1 ✓

Deleted profile ids:

- `canopytrove-profile-mojdf3hl-42873f2q`
- `canopytrove-profile-mojdhf06-m7tlo46k`
