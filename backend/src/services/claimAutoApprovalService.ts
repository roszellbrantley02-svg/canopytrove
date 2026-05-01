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
import { getBackendFirebaseDb } from '../firebase';
import { bulkMatchStorefronts } from './ocmLicenseCacheService';
import { reviewOwnerClaim } from './adminReviewService';

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
