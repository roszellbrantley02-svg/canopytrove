/**
 * Claim Verification Chain — Phase 2 of the multi-location claim feature.
 *
 * Pure evaluation logic. Given a set of claim records the caller has already
 * loaded from Firestore (plus their OCM matches), returns a per-claim verdict
 * + global metadata. No Firestore reads or writes happen here — that's the
 * caller's job. This separation makes the chain testable in isolation with
 * plain inputs and keeps the read/write side (PR-C, PR-D) independent.
 *
 * Verification rules (from docs/research/dataset-verification-findings.md):
 *
 *   1 storefront (single claim):
 *     ✓ shopOwnershipVerified === true on the claim
 *     ✓ ocmConfidence !== 'none' on the storefront
 *     → approve
 *
 *   2 storefronts (primary + 1 sibling):
 *     ✓ shopOwnershipVerified === true on the primary claim
 *     ✓ ocmConfidence !== 'none' on BOTH storefronts
 *     ✓ Both storefronts' OCM records share the same `licensee_name`
 *     → approve both
 *
 *   3+ storefronts (primary + 2+ siblings) — security bar scales with cluster size:
 *     ✓ shopOwnershipVerified === true on the primary claim
 *     ✓ shopOwnershipVerified === true on AT LEAST one OTHER claim in the
 *       cluster (the "dual OTP" requirement — one phone control isn't
 *       enough to grab a 6-store chain)
 *     ✓ ocmConfidence !== 'none' on every storefront in the cluster
 *     ✓ All OCM records share the same `licensee_name`
 *     → approve all
 *
 * The `dualOtpThreshold` is configurable via env (BULK_CLAIM_DUAL_OTP_THRESHOLD,
 * default 3). Set to a higher number to relax the dual-OTP requirement, or 2
 * to enforce dual-OTP even for 2-shop clusters.
 *
 * Dead code in PR-B — PR-C wires this into claimAutoApprovalService and
 * PR-D into the bulk-claim endpoint. Both paths are flag-gated by
 * `verificationChainEnabled` (defaults false).
 */

import { normalizeLicenseeNameKey } from './ocmLicenseCacheService';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';

export type OcmMatchConfidence = 'exact' | 'address' | 'name' | 'fuzzy' | 'none';

export type ClaimEvaluationInput = {
  claimId: string;
  ownerUid: string;
  dispensaryId: string;
  /** Current claim status. Only 'pending' claims are eligible for auto-approval. */
  claimStatus: string;
  shopOwnershipVerified: boolean;
  /** The full OCM record for this storefront, or null if no match. */
  ocmRecord: OcmLicenseRecord | null;
  ocmConfidence: OcmMatchConfidence;
};

export type ClaimVerdictApproved = {
  approved: true;
  claimId: string;
  reason: 'single_claim_passed' | 'cluster_member_passed';
  /** Normalized licensee name shared across the cluster (single-claim verdicts include this too for consistency). */
  licenseeName: string | null;
  /** Total cluster size (1 for single claims). */
  clusterSize: number;
};

export type ClaimVerdictDeferred = {
  approved: false;
  claimId: string;
  reason:
    | 'claim_not_pending'
    | 'shop_phone_not_verified'
    | 'ocm_not_matched'
    | 'cluster_entity_mismatch'
    | 'cluster_dual_otp_required'
    | 'primary_not_in_input';
};

export type ClaimVerdict = ClaimVerdictApproved | ClaimVerdictDeferred;

export type ChainResult = {
  ownerUid: string;
  primaryClaimId: string;
  /** Always present — the licensee_name of the primary claim's OCM match, or null if primary didn't match. */
  primaryLicenseeName: string | null;
  /** True when the input has 2+ claims AND the chain treated them as one cluster. */
  isCluster: boolean;
  /** Total number of claims evaluated (>= 1). */
  clusterSize: number;
  /** Per-claim verdicts keyed by claimId. */
  verdicts: Map<string, ClaimVerdict>;
};

export type ChainEvaluationInput = {
  ownerUid: string;
  primaryClaimId: string;
  claims: ClaimEvaluationInput[];
  /** Cluster size at which a SECOND OTP is required. Default 3. */
  dualOtpThreshold?: number;
};

const DEFAULT_DUAL_OTP_THRESHOLD = 3;

function singleClaimVerdict(input: ClaimEvaluationInput): ClaimVerdict {
  if (input.claimStatus !== 'pending') {
    return { approved: false, claimId: input.claimId, reason: 'claim_not_pending' };
  }
  if (!input.shopOwnershipVerified) {
    return { approved: false, claimId: input.claimId, reason: 'shop_phone_not_verified' };
  }
  if (!input.ocmRecord || input.ocmConfidence === 'none') {
    return { approved: false, claimId: input.claimId, reason: 'ocm_not_matched' };
  }
  return {
    approved: true,
    claimId: input.claimId,
    reason: 'single_claim_passed',
    licenseeName: normalizeLicenseeNameKey(input.ocmRecord.licensee_name),
    clusterSize: 1,
  };
}

export function evaluateClaimChain(input: ChainEvaluationInput): ChainResult {
  const dualOtpThreshold = input.dualOtpThreshold ?? DEFAULT_DUAL_OTP_THRESHOLD;
  const verdicts = new Map<string, ClaimVerdict>();
  const primary = input.claims.find((claim) => claim.claimId === input.primaryClaimId);

  // Primary must be in the input set — otherwise we have no anchor for the cluster.
  if (!primary) {
    for (const claim of input.claims) {
      verdicts.set(claim.claimId, {
        approved: false,
        claimId: claim.claimId,
        reason: 'primary_not_in_input',
      });
    }
    return {
      ownerUid: input.ownerUid,
      primaryClaimId: input.primaryClaimId,
      primaryLicenseeName: null,
      isCluster: input.claims.length > 1,
      clusterSize: input.claims.length,
      verdicts,
    };
  }

  const primaryLicenseeName = primary.ocmRecord
    ? normalizeLicenseeNameKey(primary.ocmRecord.licensee_name)
    : null;

  // Single-claim path — apply the existing rules unchanged.
  if (input.claims.length === 1) {
    verdicts.set(primary.claimId, singleClaimVerdict(primary));
    return {
      ownerUid: input.ownerUid,
      primaryClaimId: input.primaryClaimId,
      primaryLicenseeName,
      isCluster: false,
      clusterSize: 1,
      verdicts,
    };
  }

  // Cluster path — start by scoring the primary on its own. If the primary
  // fails any single-claim check, the entire cluster collapses (cluster
  // semantics require a verified anchor).
  const primaryVerdict = singleClaimVerdict(primary);
  if (!primaryVerdict.approved) {
    // Mark every member with the primary's failure reason so the caller can
    // surface a coherent error to the owner.
    for (const claim of input.claims) {
      verdicts.set(claim.claimId, {
        approved: false,
        claimId: claim.claimId,
        reason: primaryVerdict.reason,
      });
    }
    return {
      ownerUid: input.ownerUid,
      primaryClaimId: input.primaryClaimId,
      primaryLicenseeName,
      isCluster: true,
      clusterSize: input.claims.length,
      verdicts,
    };
  }

  // Dual-OTP requirement — for 3+ shop clusters, at least one sibling must
  // also have shopOwnershipVerified=true. Otherwise the whole cluster is
  // deferred to manual review (don't approve the primary alone — that would
  // be confusing UX).
  const requiresDualOtp = input.claims.length >= dualOtpThreshold;
  if (requiresDualOtp) {
    const siblingsWithOtp = input.claims.filter(
      (claim) => claim.claimId !== primary.claimId && claim.shopOwnershipVerified,
    );
    if (siblingsWithOtp.length === 0) {
      for (const claim of input.claims) {
        verdicts.set(claim.claimId, {
          approved: false,
          claimId: claim.claimId,
          reason: 'cluster_dual_otp_required',
        });
      }
      return {
        ownerUid: input.ownerUid,
        primaryClaimId: input.primaryClaimId,
        primaryLicenseeName,
        isCluster: true,
        clusterSize: input.claims.length,
        verdicts,
      };
    }
  }

  // Score each claim. Siblings must:
  //   - be in 'pending' status
  //   - have an OCM match (any confidence except 'none')
  //   - share the primary's licensee_name
  // Per-claim shopOwnershipVerified is NOT required on every sibling — that's
  // the whole point of cluster auto-approval. The dual-OTP check above
  // ensures the cluster has at least one second-anchor when the size
  // warrants it.
  for (const claim of input.claims) {
    if (claim.claimId === primary.claimId) {
      verdicts.set(claim.claimId, {
        approved: true,
        claimId: claim.claimId,
        reason: 'cluster_member_passed',
        licenseeName: primaryLicenseeName,
        clusterSize: input.claims.length,
      });
      continue;
    }

    if (claim.claimStatus !== 'pending') {
      verdicts.set(claim.claimId, {
        approved: false,
        claimId: claim.claimId,
        reason: 'claim_not_pending',
      });
      continue;
    }
    if (!claim.ocmRecord || claim.ocmConfidence === 'none') {
      verdicts.set(claim.claimId, {
        approved: false,
        claimId: claim.claimId,
        reason: 'ocm_not_matched',
      });
      continue;
    }
    const siblingLicenseeName = normalizeLicenseeNameKey(claim.ocmRecord.licensee_name);
    if (!siblingLicenseeName || siblingLicenseeName !== primaryLicenseeName) {
      verdicts.set(claim.claimId, {
        approved: false,
        claimId: claim.claimId,
        reason: 'cluster_entity_mismatch',
      });
      continue;
    }
    verdicts.set(claim.claimId, {
      approved: true,
      claimId: claim.claimId,
      reason: 'cluster_member_passed',
      licenseeName: primaryLicenseeName,
      clusterSize: input.claims.length,
    });
  }

  return {
    ownerUid: input.ownerUid,
    primaryClaimId: input.primaryClaimId,
    primaryLicenseeName,
    isCluster: true,
    clusterSize: input.claims.length,
    verdicts,
  };
}
