# Saves-bug affected-users audit

Generated: 2026-05-02T18:20:56.780Z

## What this is

Until May 2 2026 a sync bug was wiping authenticated users' saved-shop data before it reached the backend. When the bug was found, route_state had ZERO saves platform-wide. The closest signal we have to "shops a user actually cared about" is `recentStorefrontIds`, which is populated by a separate screen-mount path that the bug did NOT affect.

This audit aggregates **per accountId** (not per profile, since the canonical-profile leak means one user has many profile docs).

## Top-line numbers

- **Total profile docs**: 61
- **Authenticated profile docs**: 61
- **Distinct accountIds**: 10
- **Accounts with at least one recent shop**: 5 ← potentially affected
- **Accounts with subscribed: true email**: 1 ← reachable today
- **Distinct shops with at least one recent-visitor**: 10

### Multi-profile-per-account leak (separate bug, related symptom)

- **Max profile docs per account**: 30
- **Avg profile docs per account**: 6.10
- **Accounts with >2 profile docs**: 4
- **Accounts with >5 profile docs**: 2

## Top 30 shops by distinct-account reach

Each row is a shop a real user opened recently. The `accounts` column = how many distinct accountIds had this shop in their recents. These are the shops where the bug most likely ate saves.

| Rank | Accounts | Owner claim | Shop                                       |
| ---: | -------: | :---------: | :----------------------------------------- |
|    1 |        5 |      –      | Haze and Harvest (Newark)                  |
|    2 |        4 |      –      | The Coughie Shop (Wolcott)                 |
|    3 |        2 |      –      | Victory Road Farm (Red Creek)              |
|    4 |        2 |      –      | Leafy Wonders LLC (Fulton)                 |
|    5 |        1 |      –      | 48 Genesee St Dispensary (Auburn)          |
|    6 |        1 |      –      | FlynnStoned Oswego (Oswego)                |
|    7 |        1 |      –      | Poppin (New York)                          |
|    8 |        1 |      –      | Housing Works Cannabis Co NoMad (New York) |
|    9 |        1 |      –      | Just Breathe Fingerlakes (Seneca Falls)    |
|   10 |        1 |      –      | Twisted Cannabis FLX (Geneva)              |

## Per-account detail (subscribed users only — easiest to reach)

Sorted by recent-shop count descending. Email shown only for accounts with `subscribed: true` AND `dealDigestOptOut: false`. These are users you can email today to suggest re-saving their favorites.

Reachable subscribers: **1**

### danielletuper88@gmail.com (Daniellett)

- accountId: `RU4CIU6AJ0PrMBmcyGQzIJ6N4Bg1`
- recent shops (likely saves they lost): **9**
  - Victory Road Farm (Red Creek) [`ocm-13143-red-creek-victory-road-farm`]
  - Haze and Harvest (Newark) [`ocm-14513-newark-haze-and-harvest`]
  - The Coughie Shop (Wolcott) [`ocm-14590-wolcott-the-coughie-shop`]
  - 48 Genesee St Dispensary (Auburn) [`ocm-13021-auburn-48-genesee-st-dispensary`]
  - Leafy Wonders LLC (Fulton) [`ocm-13069-fulton-leafy-wonders-llc`]
  - FlynnStoned Oswego (Oswego) [`ocm-13126-oswego-flynnstoned-oswego`]
  - Poppin (New York) [`ocm-10001-new-york-poppin`]
  - Housing Works Cannabis Co NoMad (New York) [`ocm-10001-new-york-housing-works-cannabis-co-nomad`]
  - Just Breathe Fingerlakes (Seneca Falls) [`ocm-13148-seneca-falls-just-breathe-fingerlakes`]

## All affected accounts (including non-email-reachable)

Total: **5**. Of these, **1** are email-reachable (above). The rest either have no email subscription record (anonymous-only auth flow) or have unsubscribed.

| accountId                      | recents | email                     | subscribed | dealDigestOptOut |
| :----------------------------- | ------: | :------------------------ | :--------: | :--------------: |
| `RU4CIU6AJ0PrMBmcyGQzIJ6N4Bg1` |       9 | danielletuper88@gmail.com |     ✓      |        –         |
| `PTGZVrZuTxZDjst0ihiM079DmQi1` |       4 | (none)                    |     –      |        –         |
| `BL9b3X1fwSP5cZegiVWt3160ihw2` |       2 | (none)                    |     –      |        –         |
| `jznHId45XCdkyZrJoXUildHteKj1` |       2 | (none)                    |     –      |        –         |
| `wlOSCteTM6VwBrNGAcY6QwdZPLj2` |       2 | (none)                    |     –      |        –         |

---

## Suggested actions (your call)

1. **Top-shop owner outreach** — the top 10 shops by distinct-account reach are where the highest concentration of probable lost saves were. If you're calling owners (Coughie, Victory, Haze, Leafy, etc.), this number is leverage.
2. **Reachable-subscriber re-save nudge** — you have a list of email addresses above with their probable lost saves. A friendly email ("Hey, we found a bug — please re-save your favorites in the app so the shops know you care") is now possible. We have the deal-digest pipeline ready; this would be a separate one-off send.
3. **Ignore everyone else** — accounts without email subscriptions can't be reached today. They'll either re-save organically or not. The fix is shipped, so going forward saves persist correctly for everyone.
