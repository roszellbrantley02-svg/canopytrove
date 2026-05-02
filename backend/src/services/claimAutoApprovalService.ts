/**
 * Claim Auto-Approval Service — fast-path approval for high-confidence claims.
 *
 * Triggered automatically when an owner passes the merged shop-phone voice
 * OTP (shopOwnershipVerificationService.confirmShopOwnershipVerificationCode).
 *
 * Auto-approval criteria (ALL must hold; otherwise the claim stays in the
 * admin review queue for manual review):
 *
 *   1. shopOwnershipVerified === true on the claim doc.
 *      The OTP just succeeded — strongest signal we have, since the
 *      claimant physically answered the shop's published phone.
 *   2. OCM cross-reference confirms the shop is in the public NY OCM
 *      registry (licensed=true with confidence !== 'none').
 *      Belt-and-suspenders: even if the phone OTP is fraudulent, the
 *      shop must exist as a real licensed dispensary.
 *   3. The claim is currently in 'pending' status (defensive — never
 *      re-approve an already-decided claim).
 *
 * Why we don't gate on account age yet: shop-phone OTP is already an
 * extremely strong physical-presence signal. A throwaway-account attacker
 * can't fake answering a shop's phone, regardless of when their account
 * was created. We can add an account-age clamp later if we see the
 * pattern in real fraud data.
 *
 * The notification call to the shop's published phone (shopClaimNotification
 * via the merged service) ALWAYS fires on claim submission, before this
 * auto-approval runs. So the legitimate operator has been alerted no
 * matter what — even if auto-approval is wrong, they hear about it within
 * 60 seconds and can email askmehere@canopytrove.com to dispute.
 *
 * Fail-soft: any error here leaves the claim as 'pending' for manual
 * review. We never throw — auto-approval is opportunistic, not load-
 * bearing.
 */

import { logger } from '../observability/logger';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { bulkMatchStorefronts } from './ocmLicenseCacheService';
import { reviewOwnerClaim } from './adminReviewService';
import {
  evaluateClaimChain,
  type ClaimEvaluationInput,
  type ClaimVerdict,
} from './claimVerificationChainService';

const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const STOREFRONT_DETAILS_COLLECTION = 'storefront_details';

const AUTO_APPROVAL_REVIEWER_ID = 'auto_approval_service';

type ClaimRecord = {
  ownerUid?: string;
  dispensaryId?: string;
  claimStatus?: string;
  shopOwnershipVerified?: boolean;
  shopOwnershipVerifiedPhoneSuffix?: string | null;
};

type StorefrontDetailRecord = {
  displayName?: string | null;
  addressLine1?: string | null;
  zip?: string | null;
};

export type AutoApprovalOutcome =
  | { ok: true; approved: true; claimId: string }
  | {
      ok: true;
      approved: false;
      reason:
        | 'claim_not_found'
        | 'claim_not_pending'
        | 'shop_phone_not_verified'
        | 'storefront_not_found'
        | 'ocm_not_matched'
        | 'db_unavailable';
      claimId: string;
    }
  | { ok: false; error: string; claimId: string };

function buildClaimId(ownerUid: string, dispensaryId: string): string {
  return `${ownerUid}__${dispensaryId}`;
}

/**
 * Attempt to auto-approve a freshly-verified claim. Safe to call
 * fire-and-forget — never throws, returns a structured outcome for
 * logging.
 */
export async function tryAutoApproveClaim(input: {
  ownerUid: string;
  dispensaryId: string;
}): Promise<AutoApprovalOutcome> {
  const claimId = buildClaimId(input.ownerUid, input.dispensaryId);

  try {
    const db = getBackendFirebaseDb();
    if (!db) {
      return { ok: true, approved: false, reason: 'db_unavailable', claimId };
    }

    const claimSnap = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
    if (!claimSnap.exists) {
      return { ok: true, approved: false, reason: 'claim_not_found', claimId };
    }
    const claim = claimSnap.data() as ClaimRecord;

    if (claim.claimStatus !== 'pending') {
      // Already decided (approved/rejected). Don't touch.
      return { ok: true, approved: false, reason: 'claim_not_pending', claimId };
    }
    if (claim.shopOwnershipVerified !== true) {
      // Defensive: caller should only invoke us after OTP success, but
      // double-check the persisted state in case of a race.
      return { ok: true, approved: false, reason: 'shop_phone_not_verified', claimId };
    }

    // OCM cross-reference: the shop must be a real licensed dispensary
    // in the NY OCM registry. We look up the storefront's address +
    // name from storefront_details (same source the public listing
    // uses) and feed it through the same matcher that powers the
    // "Verified licensed" badge on customer-facing cards.
    const detailSnap = await db
      .collection(STOREFRONT_DETAILS_COLLECTION)
      .doc(input.dispensaryId)
      .get();
    if (!detailSnap.exists) {
      return { ok: true, approved: false, reason: 'storefront_not_found', claimId };
    }
    const detail = detailSnap.data() as StorefrontDetailRecord;
    const address = typeof detail.addressLine1 === 'string' ? detail.addressLine1 : '';
    const zip = typeof detail.zip === 'string' ? detail.zip : '';
    const name = typeof detail.displayName === 'string' ? detail.displayName : '';

    const matches = await bulkMatchStorefronts([{ id: input.dispensaryId, address, zip, name }]);
    const match = matches.get(input.dispensaryId);
    if (!match || !match.licensed || match.confidence === 'none') {
      return { ok: true, approved: false, reason: 'ocm_not_matched', claimId };
    }

    // All criteria met. Run through the same admin-review code path that
    // a human admin would, so the audit trail (reviewedAt, reviewedBy,
    // reviewNotes) is consistent with manual approvals and downstream
    // listeners (email, analytics) don't need to know about auto-approval.
    const reviewNotes = [
      `auto-approved: shop_phone_verified suffix=${claim.shopOwnershipVerifiedPhoneSuffix ?? 'unknown'}`,
      `ocm_match=${match.confidence} licensee=${match.record?.licensee_name ?? 'unknown'}`,
      `license=${match.record?.license_number ?? 'unknown'}`,
    ].join(' | ');

    await reviewOwnerClaim(claimId, {
      status: 'approved',
      reviewNotes,
    });

    logger.info('[claimAutoApproval] Claim auto-approved', {
      claimId,
      ownerUid: input.ownerUid,
      dispensaryId: input.dispensaryId,
      ocmConfidence: match.confidence,
      ocmLicense: match.record?.license_number,
      reviewerId: AUTO_APPROVAL_REVIEWER_ID,
    });

    return { ok: true, approved: true, claimId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[claimAutoApproval] Auto-approval failed — leaving claim pending', {
      claimId,
      ownerUid: input.ownerUid,
      dispensaryId: input.dispensaryId,
      error: message,
    });
    return { ok: false, error: message, claimId };
  }
}

// ============================================================================
// Bulk auto-approval (Phase 2 — flag-gated by VERIFICATION_CHAIN_ENABLED)
// ============================================================================

export type BatchAutoApprovalOutcome = {
  ownerUid: string;
  primaryClaimId: string;
  /** Total claims in the batch (>= 1). */
  clusterSize: number;
  /** True when the batch was treated as a cluster by the verification chain. */
  isCluster: boolean;
  /** Normalized licensee_name shared by the cluster, or null if no OCM match. */
  licenseeName: string | null;
  /** Per-claim outcomes keyed by claimId. Includes both approved + deferred. */
  perClaim: Map<string, AutoApprovalOutcome>;
};

/**
 * Bulk attempt to auto-approve a cluster of claims (typically the primary
 * claim plus N sibling locations). Loads each claim doc + storefront detail
 * + OCM match in parallel, runs the verification chain, then for each
 * "approved" verdict invokes the existing `reviewOwnerClaim` (atomic per
 * claim).
 *
 * Per-claim sequencing is intentional — each `reviewOwnerClaim` call is
 * already its own atomic write group (claim + ownerProfile + dispensary
 * doc), so partial-batch outcomes are safe: if shop 2 of 3 fails mid-flight,
 * shops 1 and 3 stay approved. UI groups them by `bulkClaimBatchId`.
 *
 * Flag-gated by `verificationChainEnabled`. When the flag is off this
 * function returns a structured "not enabled" outcome — useful so the
 * caller (PR-D) can ship dark and surface a "feature not enabled" error
 * to admins testing the endpoint before flag flip.
 *
 * Fail-soft: errors on individual claims don't bring down the batch. The
 * function never throws — every claimId in the input shows up in the
 * output map with either an outcome or an error.
 */
export async function tryAutoApproveClaimsBatch(input: {
  ownerUid: string;
  /** All claim IDs in the batch. The first one is treated as the primary. */
  claimIds: string[];
  /** Optional override of the dual-OTP threshold (mostly for tests). */
  dualOtpThreshold?: number;
}): Promise<BatchAutoApprovalOutcome> {
  if (!serverConfig.verificationChainEnabled) {
    const perClaim = new Map<string, AutoApprovalOutcome>();
    for (const claimId of input.claimIds) {
      perClaim.set(claimId, {
        ok: true,
        approved: false,
        reason: 'db_unavailable',
        claimId,
      });
    }
    return {
      ownerUid: input.ownerUid,
      primaryClaimId: input.claimIds[0] ?? '',
      clusterSize: input.claimIds.length,
      isCluster: input.claimIds.length > 1,
      licenseeName: null,
      perClaim,
    };
  }

  const perClaim = new Map<string, AutoApprovalOutcome>();
  const primaryClaimId = input.claimIds[0] ?? '';

  if (input.claimIds.length === 0) {
    return {
      ownerUid: input.ownerUid,
      primaryClaimId,
      clusterSize: 0,
      isCluster: false,
      licenseeName: null,
      perClaim,
    };
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    for (const claimId of input.claimIds) {
      perClaim.set(claimId, {
        ok: true,
        approved: false,
        reason: 'db_unavailable',
        claimId,
      });
    }
    return {
      ownerUid: input.ownerUid,
      primaryClaimId,
      clusterSize: input.claimIds.length,
      isCluster: input.claimIds.length > 1,
      licenseeName: null,
      perClaim,
    };
  }

  // Load every claim doc + storefront detail in parallel.
  const claimSnaps = await Promise.all(
    input.claimIds.map((claimId) => db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get()),
  );

  type LoadedClaim = {
    claimId: string;
    snap: (typeof claimSnaps)[number];
    record: ClaimRecord | null;
  };
  const loaded: LoadedClaim[] = claimSnaps.map((snap, i) => ({
    claimId: input.claimIds[i],
    snap,
    record: snap.exists ? (snap.data() as ClaimRecord) : null,
  }));

  // Mark missing claims and collect dispensary IDs for OCM lookup.
  const detailsToLoad: string[] = [];
  for (const item of loaded) {
    if (!item.record) {
      perClaim.set(item.claimId, {
        ok: true,
        approved: false,
        reason: 'claim_not_found',
        claimId: item.claimId,
      });
      continue;
    }
    if (item.record.dispensaryId) {
      detailsToLoad.push(item.record.dispensaryId);
    }
  }

  const detailSnaps = await Promise.all(
    detailsToLoad.map((dispensaryId) =>
      db.collection(STOREFRONT_DETAILS_COLLECTION).doc(dispensaryId).get(),
    ),
  );
  const detailsByDispensaryId = new Map<string, StorefrontDetailRecord>();
  detailSnaps.forEach((snap, i) => {
    if (snap.exists) {
      detailsByDispensaryId.set(detailsToLoad[i], snap.data() as StorefrontDetailRecord);
    }
  });

  // Bulk OCM match for every loaded storefront.
  const ocmInputs = loaded
    .filter((item) => item.record && detailsByDispensaryId.has(item.record.dispensaryId ?? ''))
    .map((item) => {
      const detail = detailsByDispensaryId.get(item.record!.dispensaryId!)!;
      return {
        id: item.record!.dispensaryId!,
        address: typeof detail.addressLine1 === 'string' ? detail.addressLine1 : '',
        zip: typeof detail.zip === 'string' ? detail.zip : '',
        name: typeof detail.displayName === 'string' ? detail.displayName : '',
      };
    });
  const ocmMatches = await bulkMatchStorefronts(ocmInputs);

  // Build chain inputs for items that have all the data.
  const chainInputs: ClaimEvaluationInput[] = [];
  for (const item of loaded) {
    if (!item.record) continue;
    if (!detailsByDispensaryId.has(item.record.dispensaryId ?? '')) {
      perClaim.set(item.claimId, {
        ok: true,
        approved: false,
        reason: 'storefront_not_found',
        claimId: item.claimId,
      });
      continue;
    }
    const match = ocmMatches.get(item.record.dispensaryId!);
    chainInputs.push({
      claimId: item.claimId,
      ownerUid: input.ownerUid,
      dispensaryId: item.record.dispensaryId!,
      claimStatus: item.record.claimStatus ?? '',
      shopOwnershipVerified: item.record.shopOwnershipVerified === true,
      ocmRecord: match?.record ?? null,
      ocmConfidence: match?.confidence ?? 'none',
    });
  }

  const chainResult = evaluateClaimChain({
    ownerUid: input.ownerUid,
    primaryClaimId,
    claims: chainInputs,
    dualOtpThreshold: input.dualOtpThreshold,
  });

  // Apply approvals. Sequential per-claim — `reviewOwnerClaim` is itself
  // atomic per claim, and partial success is the desired behavior.
  for (const [claimId, verdict] of chainResult.verdicts.entries()) {
    if (!verdict.approved) {
      perClaim.set(claimId, {
        ok: true,
        approved: false,
        reason: mapVerdictReasonToOutcomeReason(verdict),
        claimId,
      });
      continue;
    }
    try {
      const claimItem = loaded.find((item) => item.claimId === claimId);
      const matchForClaim = claimItem?.record?.dispensaryId
        ? ocmMatches.get(claimItem.record.dispensaryId)
        : undefined;
      const reviewNotes = buildBatchAutoApprovalNotes(verdict, matchForClaim);
      await reviewOwnerClaim(claimId, {
        status: 'approved',
        reviewNotes,
      });
      perClaim.set(claimId, { ok: true, approved: true, claimId });
      logger.info('[claimAutoApproval] Cluster claim auto-approved', {
        claimId,
        ownerUid: input.ownerUid,
        clusterSize: chainResult.clusterSize,
        licenseeName: chainResult.primaryLicenseeName,
        verdictReason: verdict.reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[claimAutoApproval] Cluster member apply failed', {
        claimId,
        ownerUid: input.ownerUid,
        error: message,
      });
      perClaim.set(claimId, { ok: false, error: message, claimId });
    }
  }

  return {
    ownerUid: input.ownerUid,
    primaryClaimId,
    clusterSize: chainResult.clusterSize,
    isCluster: chainResult.isCluster,
    licenseeName: chainResult.primaryLicenseeName,
    perClaim,
  };
}

function mapVerdictReasonToOutcomeReason(
  verdict: Extract<ClaimVerdict, { approved: false }>,
): Exclude<Extract<AutoApprovalOutcome, { ok: true; approved: false }>['reason'], never> {
  switch (verdict.reason) {
    case 'claim_not_pending':
      return 'claim_not_pending';
    case 'shop_phone_not_verified':
      return 'shop_phone_not_verified';
    case 'ocm_not_matched':
    case 'cluster_entity_mismatch':
    case 'cluster_dual_otp_required':
    case 'primary_not_in_input':
      return 'ocm_not_matched';
    default:
      return 'ocm_not_matched';
  }
}

function buildBatchAutoApprovalNotes(
  verdict: Extract<ClaimVerdict, { approved: true }>,
  match: { confidence?: string; record?: { license_number?: string } | null } | undefined,
): string {
  const parts = [
    `auto-approved (cluster): ${verdict.reason}`,
    `clusterSize=${verdict.clusterSize}`,
    `licensee=${verdict.licenseeName ?? 'unknown'}`,
  ];
  if (match?.confidence) parts.push(`ocm_match=${match.confidence}`);
  if (match?.record?.license_number) parts.push(`license=${match.record.license_number}`);
  return parts.join(' | ');
}
