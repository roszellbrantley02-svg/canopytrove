/**
 * OCM Auto-Verification Orchestration
 *
 * Called after an owner submits business verification. Reads the pending
 * verification document from Firestore, queries the OCM public registry,
 * and auto-approves if the license is active and the business name matches.
 * Falls back to manual review for anything that isn't a high-confidence match.
 */

import { logger } from '../observability/logger';
import { getBackendFirebaseDb } from '../firebase';
import { verifyOwnerAgainstOcm, resolveAutoVerificationDecision } from './ocmLicenseLookupService';
import { reviewBusinessVerification } from './adminReviewService';

const BUSINESS_VERIFICATIONS_COLLECTION = 'businessVerifications';

type StoredBusinessVerification = {
  ownerUid: string;
  dispensaryId: string;
  legalBusinessName: string;
  storefrontName: string;
  licenseNumber: string;
  licenseType: string;
  verificationStatus: string;
};

/**
 * Auto-verify an owner's business verification submission against the OCM registry.
 * Called by the owner portal after they submit their business documents.
 */
export async function autoVerifyBusinessWithOcm(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return {
      ok: false,
      autoVerified: false,
      reason: 'Database not configured.',
    };
  }

  // Read the pending business verification
  const verificationRef = db.collection(BUSINESS_VERIFICATIONS_COLLECTION).doc(ownerUid);
  const snapshot = await verificationRef.get();

  if (!snapshot.exists) {
    return {
      ok: false,
      autoVerified: false,
      reason: 'No business verification submission found.',
    };
  }

  const verification = snapshot.data() as StoredBusinessVerification;

  // Only auto-verify pending submissions
  if (verification.verificationStatus !== 'pending') {
    return {
      ok: true,
      autoVerified: false,
      reason: `Verification is already ${verification.verificationStatus}.`,
    };
  }

  if (!verification.licenseNumber?.trim()) {
    return {
      ok: true,
      autoVerified: false,
      reason: 'No license number provided. Queued for manual review.',
    };
  }

  // Query the OCM public registry
  logger.info('Starting OCM auto-verification', {
    ownerUid,
    licenseNumber: verification.licenseNumber,
  });

  const ocmResult = await verifyOwnerAgainstOcm({
    licenseNumber: verification.licenseNumber,
    businessName: verification.legalBusinessName,
    storefrontName: verification.storefrontName,
  });

  const decision = resolveAutoVerificationDecision(ocmResult);

  // Store the OCM lookup result on the verification document for audit trail
  await verificationRef.set(
    {
      ocmLookupResult: {
        found: ocmResult.found,
        active: ocmResult.active,
        matchConfidence: ocmResult.matchScore?.confidence ?? null,
        licenseeName: ocmResult.record?.licensee_name ?? null,
        dbaName: ocmResult.record?.dba_name ?? null,
        licenseStatus: ocmResult.record?.license_status ?? null,
        decision: decision.autoApprove ? 'auto_approved' : 'manual_review',
        reason: decision.reason,
        checkedAt: new Date().toISOString(),
      },
    },
    { merge: true },
  );

  if (decision.autoApprove) {
    logger.info('OCM auto-verification approved', {
      ownerUid,
      confidence: ocmResult.matchScore?.confidence,
    });

    // Use the existing admin review function to approve
    await reviewBusinessVerification(ownerUid, {
      status: 'approved',
      reviewNotes: `Auto-verified via OCM registry. ${decision.reason}`,
    });

    return {
      ok: true,
      autoVerified: true,
      reason: decision.reason,
    };
  }

  logger.info('OCM auto-verification deferred to manual review', {
    ownerUid,
    reason: decision.reason,
    confidence: ocmResult.matchScore?.confidence,
  });

  return {
    ok: true,
    autoVerified: false,
    reason: decision.reason,
  };
}
