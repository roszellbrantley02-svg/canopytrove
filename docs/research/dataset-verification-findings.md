# Dataset verification — findings (May 2 2026)

Empirical SODA queries against `data.ny.gov` to verify the design assumptions in `multi-claim-and-verification-synthesis.md`. **One assumption falsified, design revised below.**

## Findings

### ✓ Finding 1 — `entity_name` IS the cluster rollup (confirmed)

20 distinct entities have ≥2 retail dispensary licenses (across `OCMRETL` + `OCMCAURD22`). Top of the list:

| Entity                           | License count |
| -------------------------------- | ------------- |
| Twisted Cannabis FLX LLC         | 3             |
| FLYNNSTONED CORPORATION          | 2             |
| DUTCHMEN OF CENTRAL LLC          | 2             |
| Green Heights BK Inc.            | 2             |
| Liberty NY Cannabis, LLC         | 2             |
| Rosedale Cannabis Dispensary LLC | 2             |
| ...14 more with 2 each           |               |

The multi-location universe today is small (20 entities, ~42 cluster-claimable storefronts) but real. The pattern works.

### ✓ Finding 2 — `entity_name` is consistent within a cluster (confirmed)

All 3 records for "Twisted Cannabis FLX LLC" return the EXACT same string. **Intra-dataset cluster lookup is exact-match — no fuzzy matching needed.** Saves an entire layer of normalization complexity.

### ⚠ Finding 3 — Cross-dataset normalization IS needed (revision)

- `jskf-tt3q` (OCM): "Twisted Cannabis FLX LLC" (mixed case)
- `gttd-5u6y` (Tax): "TWISTED CANNABIS FLX LLC" (all caps)
- `jskf-tt3q`: "100 North 3rd Ltd"
- `gttd-5u6y`: "100 NORTH 3RD LTD."

For any join across the two datasets, must `uppercase().trim().replace(/[.,]/g, '')` both sides. Pure intra-`jskf-tt3q` cluster discovery does NOT need this.

### ✗ Finding 4 — `gttd-5u6y` is SPARSER than synthesis assumed (FALSIFICATION — design impact)

Twisted Cannabis FLX LLC has **3 retail licenses** in `jskf-tt3q` (Geneva, Manchester, Bloomfield) but only **1 entry** in `gttd-5u6y` (the original 2024 Geneva location). The two newer 2026-issued sibling licenses (`OCM-RETL-26-000485`, `OCM-RETL-26-000495`) haven't registered for tax collection yet.

This means **`gttd-5u6y` covers established operators, not newly-licensed sibling locations** — exactly the population we want to bulk-claim. The synthesis assumed `external_tpid` would be the cluster rollup; in practice it only works for the _first_ shop in a cluster.

**Confirmed by:** Tax-side query for TPID `933834798` returned exactly one record (Geneva). No sibling rows exist in the tax dataset for this entity.

### ✗ Finding 5 — TPID collisions are RARE (FALSIFICATION — design impact)

Only **6 TPIDs** in `gttd-5u6y` have 2 OCM licenses each. Most chains operate as separate per-location LLCs, each with its own TPID. So even when an entire chain IS registered for tax, each location typically has a unique TPID — not a shared parent TPID.

**Combined with Finding 4:** TPID match cannot serve as the multi-location cluster rollup. It can only serve as a per-location verification booster.

### Field shape note

`gttd-5u6y` does NOT have a `dba_name` field (the synthesis claimed it did — error on my part, corrected here). Confirmed fields: `external_tpid`, `legal_name`, `ocm_license_number`, `physical_address`, `physical_city`, `physical_state`, `physical_zip`, `physical_county`, `georeference` (lat/long Point). That's it.

## Revised design

### What changes from the original synthesis

| Original                                                                           | Revised                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax ID match against `external_tpid` is the killer signal that unlocks the cluster | Tax ID match is a **Tier-2 trust booster** for established operators; it does not unlock the cluster                                                           |
| `external_tpid` rolls up multi-location entities                                   | `entity_name` (in `jskf-tt3q`) is the cluster rollup. `external_tpid` is per-location for most operators.                                                      |
| Owner enters tax ID + we auto-claim N siblings                                     | Owner verifies one shop via OTP + we look up siblings via `entity_name` + for 3+ siblings we require a SECOND OTP to a different shop phone (defense in depth) |
| Pluggable verification chain with tax-id as a primary gate                         | Pluggable verification chain with tax-id as an OPTIONAL gate that adds a "Tax-verified" badge when matched                                                     |

### Verification chain (revised)

```
For single-location claim (1 storefront):
  1. shop-phone OTP (required)
  2. ocm-license-confidence ≠ 'none' (required)
  → auto-approve

For 2-shop cluster claim (1 sibling):
  1. shop-phone OTP on primary (required)
  2. entity_name match between primary and sibling (required, exact string)
  3. ocm-license-confidence ≠ 'none' on both (required)
  → auto-approve both
  → optional: tax-id match → adds "Tax-verified" badge

For 3+ shop cluster claim (2+ siblings):
  1. shop-phone OTP on primary (required)
  2. shop-phone OTP on a DIFFERENT shop in the cluster (required — fraud defense)
  3. entity_name match across all siblings (required)
  4. ocm-license-confidence ≠ 'none' on all (required)
  → auto-approve all
  → optional: tax-id match → adds "Tax-verified" badge
```

### Why this is honest

- **Doesn't promise what the data can't deliver.** TPID match isn't available for the very chains (newly licensed) that benefit most from cluster claim.
- **Cluster size scales the security bar.** A 2-shop add is low-risk; a 6-shop grab needs more proof than one phone control.
- **Backward-compatible with the existing flow.** Single-claim path is unchanged. Cluster path is purely additive.
- **Doesn't depend on `gttd-5u6y` for the critical path.** Uses the dataset where we have it, falls back gracefully when we don't.

### Build implication

The Tax-ID Verification Service moves from **Phase 2 (required)** to **Phase 2.5 (additive trust booster)**. Phase 2 ships without it; tax-ID match becomes a follow-up enhancement that adds a verified badge but doesn't gate the auto-approval.

## Numbers worth remembering

- **611** — OCMRETL licenses in jskf-tt3q
- **437** — OCMCAURD22 licenses (the legacy CAURD set)
- **609** — total rows in gttd-5u6y (registered tax retailers)
- **20** — distinct entities with ≥2 retail licenses (the cluster-claim addressable market today)
- **6** — TPID collisions in gttd-5u6y (tiny — TPID is per-location for most chains)
- **3** — license types per cluster on the average (Twisted Cannabis FLX LLC is the upper bound)
