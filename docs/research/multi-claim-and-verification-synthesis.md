# Multi-claim + verification — synthesis & recommendation

Generated: May 2 2026. Synthesizes three parallel research streams:

- `multi-location-claim-patterns.md` — how Google/Yelp/Weedmaps/Yext let chains claim N locations
- `ocm-verification-innovations.md` — clever NY-OCM-specific verification angles beyond Twilio
- `current-claim-verification-audit.md` — what our current code already does and where the seams are

The three converge on a single coherent story. This doc is the build recommendation.

## TL;DR

**One primitive does most of the work: OCM `entity_name`.** It's the regulator's own legal-entity rollup — already populated on 100% of `jskf-tt3q` records, already cached server-side in `ocmLicenseCacheService.ts`, and groups multi-location operators correctly (Curaleaf NY LLC, Twisted Cannabis FLX LLC, Fiorello Pharmaceuticals each have 3 retail locations under one `entity_name`).

**Recommendation: ship in this order.**

1. **Week 1 (tactical UX)** — Parallelized per-location OTP. Drops 5-store onboarding from ~15 min to ~5 min. Pure frontend + queue endpoint. No new identity primitives.
2. **Weeks 2–3 (the unlock)** — OCM-license-cluster auto-claim + Tax ID (`external_tpid`) verification. One Twilio Voice OTP plus one tax-ID check unlocks the entire `entity_name` cluster. This is the headline feature.
3. **Week 4 (escape hatch)** — Admin batch-review path productized for weird corporate structures (holding-companies, recent acquisitions, license transfers in flight).
4. **Defer (next quarter)** — Tier-2 verified-badge (gov-ID selfie + `primary_contact_name` match), domain-control TXT records, METRC integrator partnership, Lob postal magic-link for disputed claims.

**Defer indefinitely:** Stripe-KYB tie-in (cannabis is excluded from Stripe ToS; only ~10% of NY dispensaries qualify) and per-POS OAuth (Dutchie/Treez/Flowhub — three multi-week vendor cycles for what `entity_name` already gives us free).

## Why this convergence is real

The three research streams independently landed on the same load-bearing field:

| Stream               | Headline finding                                                                                                 | Why `entity_name` matters                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Multi-claim patterns | "OCM-license-cluster auto-claim" — verify one shop, offer to add all sibling locations under same legal entity   | The cluster IS the `entity_name` group                                                              |
| OCM verification     | Tax ID (`external_tpid` from `gttd-5u6y`) plus parent-entity Twilio OTP — claim parent once, auto-grant children | `external_tpid` rolls up the same cluster as `entity_name` does, from the tax angle                 |
| Code audit           | New `siblingLocationDiscoveryService.ts` would query `entity_name` and return candidate sibling list             | Confirms one new service + one schema field (`bulkClaimBatchId`) is the entire backend surface area |

The **regulator already did the hard work of grouping locations under a legal entity.** We just have to surface that grouping in our UI and trust it as the verification rollup.

## What stays exactly as it is

- **Twilio Voice shop-phone OTP** — still the human-in-the-loop confirmation. Just done once at the parent-entity level, not N times.
- **Stripe Identity** — keep the existing selfie + ID flow as-is for Pro-tier upgrade. Don't try to make it the multi-location verifier.
- **`ownerMultiLocationService.ts`** — already exists and supports `addOwnerLocation()` / `getOwnerLocations()` keyed off `additionalLocationIds`. This is the right structural primitive; the new bulk endpoint just calls it N times in one transaction.
- **Existing `dispensaryClaims` collection + status flow** — unchanged. Bulk claim creates N docs and approves them in one batch via the same `claimStatus` lifecycle.
- **Pro-tier gating** — multi-location remains Pro. Bulk claim doesn't change pricing posture; it changes onboarding friction.

## The new code surface area (concrete)

### Backend additions

| File                                                          | Purpose                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/services/siblingLocationDiscoveryService.ts`     | Given a verified storefront, queries `ocmLicenseCacheService` for all other licenses with the same normalized `entity_name`. Returns candidate sibling list with confidence scores.                                                                              |
| `backend/src/services/ownerLicenseClusterService.ts`          | `getLicenseClusterForStorefront()`, `confirmClaimCluster(ownerUid, primaryStorefrontId)`. Wraps sibling discovery + bulk claim creation + per-claim auto-approval gating.                                                                                        |
| `backend/src/services/taxIdVerificationService.ts`            | Caches `gttd-5u6y` SODA dataset (TTL 1h, same pattern as `ocmLicenseCacheService.ts`). `verifyTaxIdAgainstLicense(ocmLicenseNumber, taxId)` returns `{match: true, externalTpid, entityName}` or `{match: false, reason}`. Hashes input TPID before persistence. |
| `backend/src/routes/ownerPortalClaimsRoutes.ts` (extend)      | New `POST /owner-portal/claims/bulk` accepting `{primaryStorefrontId, taxId?, dispensaryIds?}`. Rate-limited per owner.                                                                                                                                          |
| `backend/src/services/claimAutoApprovalService.ts` (refactor) | Add `tryAutoApproveClaimsBatch(ownerUid, claimIds[])`. Same per-claim gate logic, runs in parallel within one Firestore transaction. Backward-compatible with existing single-claim path.                                                                        |

### Schema additions (Firestore)

| Collection                          | Field                                                                  | Purpose                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `dispensaryClaims/{claimId}`        | `bulkClaimBatchId?: string`                                            | Groups related claims for admin queue                                                              |
| `taxIdVerifications/{ownerUid}`     | `tpidHash`, `verifiedAt`, `entityName`, `licenseCount`                 | Salted hash of TPID; entity match outcome                                                          |
| `bulkVerificationBatches/{batchId}` | `ownerUid`, `primaryStorefrontId`, `claimIds[]`, `status`, `createdAt` | Progress doc the UI polls during in-flight bulk submissions                                        |
| `ownerProfiles/{ownerUid}`          | (no change)                                                            | `additionalLocationIds[]` already exists and is the right place to store cluster-claimed locations |

### Frontend additions

| File                                                       | Purpose                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/OwnerPortalClaimListingScreen.tsx` (extend)   | After single-claim success, show "Verify all my locations" hero card pre-populated with sibling locations from cluster discovery |
| `src/hooks/useBulkClaimSubmission.ts` (new)                | Manages the queue, surfaces per-location verification status, debounces UI updates                                               |
| `src/screens/OwnerPortalTaxIdVerificationScreen.tsx` (new) | Single form field for TPID. Submit calls `/owner-portal/tax-id-verify`. On match, surface "Add all N sibling locations?"         |
| `src/services/ownerPortalClaimService.ts` (extend)         | `submitBulkOwnerDispensaryClaims(ownerUid, {dispensaryIds, taxId?})`                                                             |

## What changes in the auto-approval gate

Today (`claimAutoApprovalService.ts:104-135`):

```
if (shopOwnershipVerified === true && businessVerification.ocmLookupResult.confidence !== 'none') {
  approve();
} else {
  defer to manual review;
}
```

After:

```
verification chain (ordered):
  1. tax-id-match (required if entity has 2+ licenses; optional for single-location)
  2. shop-phone-otp (required, but reused across cluster — one OTP unlocks N claims)
  3. ocm-license-confidence (required, ≠ 'none')

all-required-passed → auto-approve all N claims in one transaction
any-required-failed → defer to manual review
```

This is the **pluggable verification chain** the OCM-verification research recommended (#3 + #1) and the code audit predicted (`verificationMethodRegistry.ts`). The chain is tax-id-first because tax-id is the cheapest, fastest, and most cluster-friendly. Twilio OTP becomes the human-in-the-loop confirmation, not the primary identity check.

**Migration safety:** the new chain logic is gated by a feature flag `VERIFICATION_CHAIN_ENABLED`. Existing in-flight claims drain through the old code path. New claims after flag flip use the chain. Backward-compatible reads on `additionalLocationIds` are preserved.

## What we're explicitly NOT building (and why)

| Pattern                                                             | Why deferred                                                                                                                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain-email verification (TXT record on `business_website`)        | Only 26.6% of OCM licensees have a `business_website` populated. Cheap-domain spoofing (`flynnstoned-cannabis.com` for $12/yr) needs WHOIS-age heuristics. Tax-ID match covers the same chains for free. |
| Stripe Connect KYB                                                  | Cannabis is excluded from Stripe ToS; ~10% of NY dispensaries qualify. Two weeks of work for a marginal slice.                                                                                           |
| POS integration (Dutchie / Treez / Flowhub)                         | Three vendor onboardings, each multi-week. Net-new attack surface. `entity_name` cluster covers same chains.                                                                                             |
| METRC integrator partnership                                        | Requires OCM authorization and is not a public API. Conversation worth having next quarter; not a v1 blocker.                                                                                            |
| Lob postal magic-link                                               | Highest-trust signal (mail interception is a federal felony), but 5–10 day latency. Reserve for _disputed_ claims and high-value owner-portal actions, not first-touch.                                  |
| Gov-ID selfie + `primary_contact_name` match (on-device Vision OCR) | Strong signal but `primary_contact_name` is "primary contact," not "owner" — could be a compliance attorney. Demoted to Tier-2 verified-badge for owners who want extra perks.                           |
| OCM Scan-to-Verify placard photo + GPS + selfie                     | Heaviest UX (3 photos + GPS), niche use case. Reserve for high-trust audits.                                                                                                                             |

## Concrete things to verify before shipping

These are the unknowns that would force a redesign if they came back negative:

1. **`external_tpid` collision shape.** Run `SELECT external_tpid, count(ocm_license_number) FROM gttd-5u6y GROUP BY external_tpid HAVING count > 1` against the live SODA endpoint. Expected: collisions exist and they ARE the multi-location rollup key (a feature, not a bug). Falsifies the design if no collisions exist or if they don't correlate with `entity_name` groups.

2. **`entity_name` normalization confidence threshold.** "FlynnStoned Cannabis Co LLC" vs "Flynnstoned Cannabis Co., LLC" vs "FlynnStoned Cannabis Co., L.L.C." — sample the top 50 multi-location entities in `jskf-tt3q` and quantify the fuzzy-match rate after lowercasing + punctuation strip + suffix normalization. Need ≥0.95 confidence for auto-add; below threshold goes to opt-in screen.

3. **`primary_contact_name` semantics.** Is this always a principal officer, or sometimes a compliance attorney or third-party agent? Ask OCM directly. Affects whether the Tier-2 selfie-match is "Very High" or "Medium-High" forgery resistance.

4. **Twilio Voice budget under bulk.** Today's per-claim 24h cooldown is enforced; bulk submission needs careful per-shop call rate limiting so we don't blow Twilio Voice budget on a 12-store chain. The cluster pattern actually _reduces_ call volume (1 call instead of 12), so this is a defensive check, not a blocker.

5. **License transfers leaving stale `additionalLocationIds`.** Daily reconciliation job comparing claimed locations against current OCM `entity_name` holder; flag drift to admin queue, don't auto-revoke. (Auto-revoke would be a 1.4.3 trip wire if we ever yanked a paying owner's locations without human review.)

## Risk table

| Risk                                                                                           | Mitigation                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuzzy `entity_name` false positives (claiming a sibling that isn't actually under same parent) | Confidence ≥0.95 for auto-add; below → opt-in screen with both names shown side-by-side. Log every cluster-claim with normalized name pair for audit.                                                                                  |
| Insider at one OCM-listed store uses cluster auto-claim to grab the whole chain                | For clusters of 3+ siblings, require **both** Tax ID match AND HQ Voice OTP confirmation as second factor. 1–2 location cases skip escalation.                                                                                         |
| OCM SODA outage during bulk claim                                                              | Existing `ocmLicenseCacheService` already serves stale-for-6h on cache miss. Bulk claim degrades gracefully to manual review path.                                                                                                     |
| Apple App Review concern about reduced verification friction                                   | Cluster pattern's identity story is _stronger_ than today — adds regulator-confirmed entity identity (via `entity_name`) plus tax-ID match (via `gttd-5u6y`) on top of phone control. Document in `docs/OWNER_PORTAL_ARCHITECTURE.md`. |
| Tax ID privacy posture                                                                         | Never display entered TPID after match. Store as salted hash. NY tax IDs are business-sensitive (federally an EIN is non-public for the same reason).                                                                                  |
| Bulk claim breaks existing single-location flow                                                | Feature-flag the new chain. Existing in-flight claims drain through old code. `additionalLocationIds` array reads are unchanged for downstream consumers (gating, billing, owner-portal-home).                                         |

## What to read next

- `multi-location-claim-patterns.md` for the full Google/Yelp/Weedmaps/Yext pattern analysis
- `ocm-verification-innovations.md` for the full NY-dataset survey including DOS, METRC, CCA 2.0
- `current-claim-verification-audit.md` for the exact files, functions, and line numbers the changes land in
- `backend/src/services/ownerMultiLocationService.ts` — the existing primitive the bulk endpoint wraps
- `backend/src/services/claimAutoApprovalService.ts:86-172` — the gate that gets refactored into a chain
- `backend/src/services/ocmLicenseCacheService.ts:388-448` — `bulkMatchStorefronts` is already there; `entity_name` cluster lookup is one new function next to it

## Decision the founder needs to make

**Three ship modes, pick one:**

- **Aggressive (recommended)** — Week 1 parallel OTP + Weeks 2–3 cluster auto-claim with tax-ID. Ships the headline feature in 3 weeks. ~$0 vendor cost. Requires the verification-chain refactor.
- **Conservative** — Week 1 parallel OTP only. Defer cluster work until owner sign-ups demand it. No backend refactor risk. But chains keep churning at the per-location verification step.
- **Wait-and-see** — Ship parallel OTP, then watch how many chain owners actually try to claim multi-location. Decide cluster work after 30 days of data.

**My read:** ship aggressive. Both research streams independently confirm `entity_name` + `external_tpid` are the right primitives, the code audit confirms it slots into existing services cleanly, and the alternative (every chain owner does N OTPs sequentially) is the kind of friction that loses chain owners to Weedmaps' enterprise sales path before they finish onboarding.
