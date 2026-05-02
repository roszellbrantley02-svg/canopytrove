# Platform usage — three reports

Generated: 2026-05-02T18:50:57.956Z

## 1. Signup funnel

Total registered Firebase Auth users: **17**

| Stage                             | Count | % of created |
| --------------------------------- | ----: | -----------: |
| Created (Firebase Auth)           |    17 |         100% |
| Has email on file                 |    11 |          65% |
| Email verified                    |     0 |           0% |
| Has display name                  |    10 |          59% |
| Activated (signed in last 7 days) |     7 |          41% |
| Has subscribed to emails          |     5 |          29% |
| Has saved ≥1 shop (post-recovery) |     5 |          29% |
| Has visited ≥1 shop (recents)     |     5 |          29% |
| Has submitted ≥1 review           |     0 |           0% |

### Auth method breakdown

- Password auth: 11
- OAuth (Apple/Google): 0
- Anonymous-only: 6

### Honest read of the funnel

- **Zero users have a verified email.** Either no email-verification flow is shipping verification emails, or users are skipping it. If you wanted to require verified email before they can leave reviews / save shops, that gate isn't enforced today and the funnel shows 0% completion.
- Of 17 signups, **7 signed in this week** — that's your real weekly-active. Everyone else either tried it once and bounced, or signed up but hasn't returned.
- **0 of 17** users have actually contributed content (reviewed). The product mostly serves passive browsers right now.

## 2. Per-day session volume

Daily app-metric docs found: 34

| Metric           | 30-day total | Daily avg |
| ---------------- | -----------: | --------: |
| appOpens         |          704 |      23.5 |
| sessionStarts    |         1524 |      50.8 |
| signIns          |           50 |       1.7 |
| signupsStarted   |           14 |       0.5 |
| signupsCompleted |            6 |       0.2 |

### Per-day breakdown (newest first)

| Date       | Opens | Sess Start | Sign Ins | Signups Started | Signups Completed |
| :--------- | ----: | ---------: | -------: | --------------: | ----------------: |
| 2026-05-02 |    16 |         37 |        4 |               0 |                 0 |
| 2026-05-01 |    12 |         25 |        1 |               0 |                 0 |
| 2026-04-30 |    10 |         25 |        1 |               0 |                 0 |
| 2026-04-29 |    32 |        112 |        9 |               5 |                 1 |
| 2026-04-28 |    11 |         14 |        1 |               1 |                 1 |
| 2026-04-27 |    12 |         24 |        1 |               0 |                 0 |
| 2026-04-26 |     8 |         21 |        3 |               4 |                 0 |
| 2026-04-25 |     8 |         13 |        0 |               0 |                 0 |
| 2026-04-24 |     9 |         14 |        1 |               0 |                 0 |
| 2026-04-23 |     4 |          6 |        0 |               0 |                 0 |
| 2026-04-22 |    10 |         15 |        4 |               1 |                 1 |
| 2026-04-21 |    12 |         45 |        3 |               0 |                 0 |
| 2026-04-20 |    10 |         25 |        3 |               0 |                 0 |
| 2026-04-19 |    11 |         31 |        0 |               0 |                 0 |
| 2026-04-18 |    10 |         31 |        1 |               0 |                 0 |
| 2026-04-17 |    14 |         27 |        0 |               0 |                 0 |
| 2026-04-16 |     4 |          7 |        0 |               0 |                 0 |
| 2026-04-15 |     8 |         18 |        0 |               0 |                 0 |
| 2026-04-14 |    10 |         15 |        0 |               0 |                 0 |
| 2026-04-13 |    28 |         41 |        0 |               0 |                 0 |
| 2026-04-12 |     9 |         31 |        0 |               0 |                 0 |
| 2026-04-11 |    40 |        102 |        0 |               0 |                 0 |
| 2026-04-10 |    75 |        130 |        5 |               1 |                 1 |
| 2026-04-09 |    27 |         55 |        0 |               0 |                 0 |
| 2026-04-08 |    71 |        143 |        0 |               0 |                 0 |
| 2026-04-07 |    68 |        149 |        5 |               0 |                 0 |
| 2026-04-06 |   103 |        199 |        7 |               1 |                 1 |
| 2026-04-05 |    62 |        121 |        1 |               1 |                 1 |
| 2026-04-04 |     3 |         13 |        0 |               0 |                 0 |
| 2026-04-03 |     7 |         35 |        0 |               0 |                 0 |

## 3. Shop coverage gap

**Total storefronts in directory**: 613
**With ≥1 impression in last 30 days**: 291
**Dormant (zero impressions)**: 323
**Coverage rate**: 47.3%

### Why this matters

Every dormant shop is an OCM-licensed storefront in your directory that **no user has scrolled past in the last 30 days**. The directory is invisible to your users at the long tail. Two interpretations:

1. **Discovery feed isn't surfacing them** — the algorithm is heavily distance-weighted toward the user's location, so shops far from any active user never appear. With 17 users mostly upstate, downstate shops sit in the dataset with zero exposure.
2. **Sales lead opportunity** — these are owners you could call/email cold (they don't even know you exist) and offer a free claim. The pitch is different from the high-engagement-shop calls (Coughie, Haze, etc.) — for dormant shops, the angle is "we have you in the directory but no one in your area is looking through us yet, so let's build engagement together."

### Dormant shops by city (top 25 by dormant count)

| Dormant | Total | With imp | City             |
| ------: | ----: | -------: | :--------------- |
|      70 |    70 |        0 | Brooklyn         |
|      62 |    91 |       29 | New York         |
|      20 |    20 |        0 | Bronx            |
|      12 |    12 |        0 | Staten Island    |
|      10 |    10 |        0 | Newburgh         |
|       7 |     7 |        0 | Yonkers          |
|       7 |     7 |        0 | Kingston         |
|       5 |     5 |        0 | White Plains     |
|       5 |     5 |        0 | Jamaica          |
|       4 |     4 |        0 | Long Island City |
|       4 |     4 |        0 | Astoria          |
|       4 |     4 |        0 | Bayside          |
|       4 |     4 |        0 | Ridgewood        |
|       4 |     4 |        0 | Poughkeepsie     |
|       3 |     3 |        0 | Queens           |
|       3 |     3 |        0 | Flushing         |
|       3 |     3 |        0 | Rego Park        |
|       3 |     3 |        0 | Ozone Park       |
|       3 |     3 |        0 | Farmingdale      |
|       3 |     3 |        0 | Hudson           |
|       3 |     3 |        0 | Beacon           |
|       2 |     2 |        0 | Mt Vernon        |
|       2 |     2 |        0 | Peekskill        |
|       2 |     2 |        0 | New Rochelle     |
|       2 |     2 |        0 | Middletown       |

### Sample dormant shops near you (Wolcott NY area)

Dormant shops in NY-145xx / 141xx / 130xx / 131xx zip ranges: **0**
