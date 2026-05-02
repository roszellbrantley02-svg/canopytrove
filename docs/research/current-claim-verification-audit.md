# Current claim + verification audit

Generated: May 2 2026. Read-only audit of the owner-claim and OCM-verification code paths in this codebase. Source for the multi-location-claim and verification-innovation research streams.

## Summary

- Claims flow linearly: claim submission → shop phone OTP (Twilio voice) → auto-approval check → business verification (OCM registry + Stripe Identity) → manual admin review.
- Each phase is fire-and-forget; errors at any stage defer to manual review.
- Data model ties one owner to one primary location (`ownerProfile.dispensaryId`), with multi-location only as a Pro-tier feature for pre-approved claims.
- Auto-approval gate: shop phone OTP **AND** OCM match confidence ≠ 'none' → auto-approve. Either fails → manual review.
- Three core external integrations: Twilio Voice (shop OTP), Stripe Identity (selfie + ID), OCM SODA API (data.ny.gov license registry).

## 1. Owner claim flow — frontend

| Screen / hook                                | File                                                         | Purpose                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `OwnerPortalAccessScreen`                    | `src/screens/OwnerPortalAccessScreen.tsx`                    | Entry point, gates access by `ownerPortalConfig` allowlist + `prelaunchEnabled` flag                        |
| `OwnerPortalClaimListingScreen`              | `src/screens/OwnerPortalClaimListingScreen.tsx`              | Search & select a shop to claim. Today: single-shop submit only.                                            |
| `OwnerPortalShopOwnershipVerificationScreen` | `src/screens/OwnerPortalShopOwnershipVerificationScreen.tsx` | Triggers Twilio Voice OTP to the shop phone, accepts 6-digit code.                                          |
| `OwnerPortalPhoneVerificationScreen`         | `src/screens/OwnerPortalPhoneVerificationScreen.tsx`         | Personal phone verification (separate from shop phone).                                                     |
| `OwnerPortalIdentityVerificationScreen`      | `src/screens/OwnerPortalIdentityVerificationScreen.tsx`      | Stripe Identity session start; webhook updates verification doc.                                            |
| `OwnerPortalBusinessVerificationScreen`      | `src/screens/OwnerPortalBusinessVerificationScreen.tsx`      | Business doc submission (license number, business name); triggers backend OCM lookup.                       |
| Frontend service                             | `src/services/ownerPortalClaimService.ts:29-64`              | `submitOwnerDispensaryClaim(ownerUid, {id, displayName})` → `POST /owner-portal/claims`                     |
| Frontend service                             | `src/services/ownerPortalShopVerificationService.ts`         | `sendShopVerificationCode()`, `confirmShopVerificationCode()` — bridge to backend with typed error handling |

## 2. Owner claim flow — backend

| Component               | File                                                        | Function                                                      | Purpose                                                  |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Auto-approval gate      | `backend/src/services/claimAutoApprovalService.ts:86-172`   | `tryAutoApproveClaim({ownerUid, dispensaryId})`               | Decides if shop-phone + OCM verify triggers auto-approve |
| OCM business check      | `backend/src/services/ocmAutoVerificationService.ts:31-134` | `autoVerifyBusinessWithOcm(ownerUid)`                         | Runs after business doc submission; queries OCM          |
| OCM lookup (live)       | `backend/src/services/ocmLicenseLookupService.ts:123-157`   | `verifyOwnerAgainstOcm({licenseNumber, businessName})`        | Queries SODA API for license; returns match confidence   |
| OCM cache (bulk)        | `backend/src/services/ocmLicenseCacheService.ts:388-448`    | `bulkMatchStorefronts(inputs)`                                | Bulk address/name match in 1h cache                      |
| Shop phone OTP          | `backend/src/services/shopOwnershipVerificationService.ts`  | `sendShopVerificationCode()`, `confirmShopVerificationCode()` | Twilio voice call + code verification                    |
| Multi-location (exists) | `backend/src/services/ownerMultiLocationService.ts:50-190`  | `addOwnerLocation()`, `getOwnerLocations()`                   | Links pre-approved claims to owner; Pro-tier gated       |

## 3. Data model

| Collection              | Doc ID                       | Key fields                                                       | Lifetime                                                            |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `dispensaryClaims`      | `{ownerUid}__{dispensaryId}` | `claimStatus`, `shopOwnershipVerified`, OCM match result         | Created on submit; persists until approved/rejected                 |
| `businessVerifications` | `{ownerUid}`                 | `licenseNumber`, `ocmLookupResult`, `verificationStatus`         | Created on business doc submit; updated by OCM check + admin review |
| `identityVerifications` | `{ownerUid}`                 | `verificationSessionId`, `status`, `verifiedAt`                  | Created on Stripe Identity start; updated by webhook                |
| `shopVerificationCodes` | `{claimId}`                  | `code`, `codeExpiresAt`, `callsRemainingToday`, `cooldownEndsAt` | Created on first call; expires 15m (OTP) or tracks 24h cooldown     |
| `ownerProfiles`         | `{ownerUid}`                 | `dispensaryId`, `additionalLocationIds`, `subscriptionTier`      | Immutable primary; `additionalLocationIds` array for Pro tier       |

## 4. Existing multi-location code

`backend/src/services/ownerMultiLocationService.ts` already exists. It supports:

- `addOwnerLocation(ownerUid, dispensaryId)` — links a pre-approved claim to the owner's `additionalLocationIds`
- `getOwnerLocations(ownerUid)` — returns the owner's primary + additional locations
- **Tier-gated to Pro** via `requireTierAccess(ownerUid, 'pro', 'Multi-location management')` (per `backend/src/services/ownerMultiLocationService.ts` import of `requireTierAccess`)

Each additional location is added ONE-AT-A-TIME via this service. Each requires its own pre-approved `dispensaryClaims` doc. There's no "claim N at once" pathway today — the owner has to:

1. Get one location auto-approved or manually approved
2. Become a Pro subscriber
3. Then `addOwnerLocation()` per additional storefront, after each one's individual claim is also separately approved

This is the load-bearing pain point. The Pro-tier multi-location feature exists but doesn't reduce per-location verification friction.

## 5. OCM verification integration

Two distinct OCM integration paths:

**Path A — owner business verification** (`ocmAutoVerificationService.ts:31-134`):

- Triggered after business document submission via `autoVerifyBusinessWithOcm(ownerUid)`
- Calls `verifyOwnerAgainstOcm({licenseNumber, businessName, storefrontName})` from `ocmLicenseLookupService.ts:123-157`
- Returns `OcmLookupResult` with `confidence: 'high' | 'medium' | 'low' | 'none'`
- Result written to `businessVerifications` collection

**Path B — claim auto-approval gate** (`claimAutoApprovalService.ts:86-172`):

- Triggered after shop phone OTP succeeds
- Reads the latest `businessVerifications` doc for this owner
- If `shopOwnershipVerified === true && businessVerification.ocmLookupResult.confidence !== 'none'` → auto-approve
- Otherwise → defer to manual admin review

**Path C — storefront listing OCM badge** (`storefrontOcmEnrichment.ts`):

- On every `/storefront-details/<id>` request, looks up the storefront in the OCM cache via `bulkMatchStorefronts` and attaches `ocmVerification: { licensed, confidence, ... }` to the response
- Customer-facing: the badge on the storefront detail page
- Was broken until today (PR #27 — SODA schema field rename) — now working again

## 6. External service integrations

| Service                             | Used for                                                                   | File anchor                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Twilio Voice**                    | Shop-phone OTP (single voice call delivers the 6-digit code)               | `backend/src/services/shopOwnershipVerificationService.ts`                     |
| **Twilio Verify**                   | Personal phone verification (separate from shop phone)                     | `backend/src/services/phoneVerificationService.ts`                             |
| **Firebase Auth**                   | Email+password signup, anonymous, ID token verification                    | `backend/src/firebase.ts`                                                      |
| **Resend**                          | Transactional email (welcome, owner-welcome, deal-digest, verification)    | `backend/src/services/emailDeliveryService.ts`                                 |
| **Stripe Identity**                 | ID document scan + biometric selfie verification                           | `backend/src/services/identityVerificationService.ts` (likely path)            |
| **Stripe Checkout / Subscriptions** | Owner subscription billing                                                 | `backend/src/services/ownerBillingService.ts`                                  |
| **OCM SODA API**                    | NY public license registry (`https://data.ny.gov/resource/jskf-tt3q.json`) | `backend/src/services/ocmLicenseCacheService.ts`, `ocmLicenseLookupService.ts` |

**Not present** (verified by absence in `backend/package.json` and grep):

- Plaid Identity / Plaid Link
- Persona
- ID.me
- Onfido
- Veriff
- Lob (mail-postcard delivery)

## 7. What would need to change for bulk multi-location claim

**Frontend**:

- `OwnerPortalClaimListingScreen.tsx` — add multi-select checkboxes; track a candidate set, not a single selection
- New hook: `useBulkClaimSubmission` — manages a queue of claims, surfaces per-location verification status, debounces UI updates
- New "Verify all my locations" hero card on the post-OTP success screen — pre-populated with sibling locations from OCM `entity_name` rollup

**Backend**:

- New endpoint: `POST /owner-portal/claims/bulk` accepting `{ dispensaryIds: string[] }` body
- Refactor `claimAutoApprovalService.tryAutoApproveClaim()` → add `tryAutoApproveClaimsBatch(ownerUid, claimIds[])` that runs the per-claim gate in parallel within one Firestore transaction
- New service: `siblingLocationDiscoveryService.ts` — given a verified storefront, looks up its OCM `entity_name`, queries the cache for all other licenses with the same entity name, returns the candidate sibling list
- Schema: add `bulkClaimBatchId?: string` to `dispensaryClaims` so the admin queue can group related claims

**New collections**:

- `claimAttempts/{ownerUid}__{timestamp}` — log of bulk submissions and per-location outcomes (audit trail for fraud investigation)
- `bulkVerificationBatches/{batchId}` — progress tracking doc for in-flight batches the UI polls

## 8. What would need to change for pluggable verification

**Architecture shift**:

- Create `backend/src/services/verificationMethodRegistry.ts` — registry pattern for pluggable verifiers (`shop-phone`, `ocm-cache`, `stripe-identity`, future: `tax-id-match`, `lob-postcard`, `persona-kyc`)
- Each verifier exposes `{ id, name, execute(input): Promise<VerificationResult>, requiredInputs: string[] }`
- New `verificationConfig/{ownerUid}` collection — admin-controllable per-owner override of which verifier chain applies

**Refactoring `claimAutoApprovalService.ts:104-135`**:

- Replace the hardcoded `if (shopOwnershipVerified && ocmMatch !== 'none')` logic with a configurable verification chain
- Each chain is an ordered list of `(methodId, required: boolean)` pairs; first failed `required` short-circuits the chain

**New backend endpoints**:

- `GET /admin/verification-methods` — list available verifiers with their config
- `PUT /admin/verification-config/{ownerUid}` — override default verifier chain for one owner (e.g., grant skip-OTP to a chain operator who proved identity once)
- `GET /admin/verification-attempts/{claimId}` — detailed per-verifier audit trail for the admin review queue

**New collections**:

- `verificationAttempts/{ownerUid}__{methodId}__{timestamp}` — every individual verifier execution with input + output + duration

## 9. Migration risk notes

- Existing claims must continue working through any refactor — auto-approval gate logic must be backward compatible until all in-flight claims drain
- The Pro tier `additionalLocationIds` array structure is referenced in 6+ places (gating, billing, owner-portal-home, etc.) — bulk claim must populate it correctly so existing read paths don't break
- `shopVerificationCodes` doc TTL (24h cooldown) is enforced per-claim today — bulk submission needs careful per-shop call rate limiting so we don't blow Twilio Voice budget on a 12-store chain
