/**
 * Bulk Claim Service — Phase 2 of multi-location claim feature.
 *
 * Lets a chain owner submit N claims (typically 2–6 sibling locations under
 * the same OCM legal entity) in one request. Creates a bulk-verification
 * batch doc + N dispensary-claim docs sharing a `bulkClaimBatchId`.
 *
 * Each individual claim still flows through the existing per-claim
 * shop-OTP + auto-approval path — bulk doesn't bypass any verification, it
 * just groups the docs so the admin queue and the frontend status UI can
 * treat them as one cluster.
 *
 * Flag-gated by `bulkClaimEnabled` (defaults false). When the flag is off,
 * the route returns 404 from the upstream router (caller's responsibility).
 *
 * Hard cap: 6 dispensary IDs per batch. Largest known cluster today is 3
 * (Twisted Cannabis FLX LLC); 6 leaves 2x headroom and is well under the
 * Firestore 500-doc transaction limit.
 *
 * NOT auto-firing OTPs server-side — the frontend uses Phase 1's bulk
 * queue UX (`useBulkClaimSubmission`) which fires per-shop OTPs from the
 * client. Each OTP success then runs the existing single-claim auto-approval.
 * Cluster-level auto-approval (one OTP unlocks N siblings) is a follow-up
 * commit that wires `tryAutoApproveClaimsBatch` into the OTP-success path.
 */

import { logger } from '../observability/logger';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import {
  BULK_VERIFICATION_BATCHES_COLLECTION,
  DISPENSARY_CLAIMS_COLLECTION,
} from '../constants/collections';
import {
  discoverSiblingLocations,
  type SiblingDiscoveryResult,
} from './siblingLocationDiscoveryService';

const MAX_BULK_CLAIM_SIZE = 6;

export type BulkClaimSubmissionResult = {
  ok: true;
  batchId: string;
  ownerUid: string;
  primaryDispensaryId: string;
  primaryClaimId: string;
  /** Sibling claim IDs that were freshly created as part of this batch. */
  siblingClaimIds: string[];
  /** Combined cluster — primary + siblings. Used by cluster-trigger evaluation. */
  claimIds: string[];
  /** ISO timestamp when the batch was created. */
  createdAt: string;
};

export type BulkClaimSubmissionError = {
  ok: false;
  code:
    | 'feature_disabled'
    | 'invalid_input'
    | 'too_many_locations'
    | 'duplicate_locations'
    | 'primary_not_found'
    | 'db_unavailable';
  message: string;
};

export type BulkClaimBatchStatus = {
  ok: true;
  batchId: string;
  ownerUid: string;
  primaryDispensaryId: string;
  claimIds: string[];
  createdAt: string;
  /** Per-claim summary keyed by claimId. */
  claims: Array<{
    claimId: string;
    dispensaryId: string;
    claimStatus: string;
    shopOwnershipVerified: boolean;
    reviewedAt: string | null;
  }>;
};

function buildClaimId(ownerUid: string, dispensaryId: string): string {
  return `${ownerUid}__${dispensaryId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createBatchId(): string {
  // Short, URL-safe, monotonic-ish. Enough entropy for our scale.
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `batch_${ts}_${rnd}`;
}

export async function submitBulkClaim(input: {
  ownerUid: string;
  /**
   * The storefront the owner has already claimed (and typically already
   * verified via OTP). Its existing claim doc is tagged with the new
   * batchId via merge — its claimStatus / shopOwnershipVerified are NOT
   * touched.
   */
  primaryDispensaryId: string;
  /**
   * Sibling locations to add to the cluster. New claim docs are created
   * for each. Empty array is allowed (degenerate case — caller should
   * just no-op, but we don't error).
   */
  siblingDispensaryIds: string[];
}): Promise<BulkClaimSubmissionResult | BulkClaimSubmissionError> {
  if (!serverConfig.bulkClaimEnabled) {
    return {
      ok: false,
      code: 'feature_disabled',
      message: 'Bulk claim is not enabled.',
    };
  }

  if (!input.ownerUid || typeof input.ownerUid !== 'string') {
    return { ok: false, code: 'invalid_input', message: 'ownerUid is required.' };
  }

  const primaryDispensaryId =
    typeof input.primaryDispensaryId === 'string' ? input.primaryDispensaryId.trim() : '';
  if (!primaryDispensaryId) {
    return { ok: false, code: 'invalid_input', message: 'primaryDispensaryId is required.' };
  }

  const siblingIds = (input.siblingDispensaryIds ?? [])
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0 && value !== primaryDispensaryId);

  // Cluster size = primary + siblings. Hard cap MAX_BULK_CLAIM_SIZE.
  if (siblingIds.length + 1 > MAX_BULK_CLAIM_SIZE) {
    return {
      ok: false,
      code: 'too_many_locations',
      message: `Bulk claim is capped at ${MAX_BULK_CLAIM_SIZE} locations per cluster (primary + siblings).`,
    };
  }

  const distinctSiblings = Array.from(new Set(siblingIds));
  if (distinctSiblings.length !== siblingIds.length) {
    return {
      ok: false,
      code: 'duplicate_locations',
      message: 'Duplicate sibling dispensaryIds in input.',
    };
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, code: 'db_unavailable', message: 'Backend database is unavailable.' };
  }

  // Verify the primary claim exists (owner must have already submitted it).
  const primaryClaimId = buildClaimId(input.ownerUid, primaryDispensaryId);
  const primaryClaimSnap = await db
    .collection(DISPENSARY_CLAIMS_COLLECTION)
    .doc(primaryClaimId)
    .get();
  if (!primaryClaimSnap.exists) {
    return {
      ok: false,
      code: 'primary_not_found',
      message: 'The primary storefront has not been claimed yet.',
    };
  }

  const batchId = createBatchId();
  const createdAt = nowIso();
  const siblingClaimIds = distinctSiblings.map((dispensaryId) =>
    buildClaimId(input.ownerUid, dispensaryId),
  );
  const claimIds = [primaryClaimId, ...siblingClaimIds];

  const writeBatch = db.batch();
  const batchRef = db.collection(BULK_VERIFICATION_BATCHES_COLLECTION).doc(batchId);
  writeBatch.set(batchRef, {
    batchId,
    ownerUid: input.ownerUid,
    primaryDispensaryId,
    primaryClaimId,
    siblingDispensaryIds: distinctSiblings,
    siblingClaimIds,
    claimIds,
    createdAt,
    status: 'pending',
  });

  // Tag the primary claim with the batchId (single-field merge — does NOT
  // touch claimStatus, shopOwnershipVerified, or any other field).
  writeBatch.set(
    db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(primaryClaimId),
    { bulkClaimBatchId: batchId, bulkClaimRole: 'primary' },
    { merge: true },
  );

  // Create new sibling claim docs.
  for (let i = 0; i < distinctSiblings.length; i += 1) {
    const dispensaryId = distinctSiblings[i];
    const claimRef = db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(siblingClaimIds[i]);
    writeBatch.set(
      claimRef,
      {
        ownerUid: input.ownerUid,
        dispensaryId,
        claimStatus: 'pending',
        submittedAt: createdAt,
        reviewedAt: null,
        reviewNotes: null,
        bulkClaimBatchId: batchId,
        bulkClaimRole: 'sibling',
      },
      { merge: true },
    );
  }

  await writeBatch.commit();

  logger.info('[bulkClaimService] Bulk claim batch created', {
    batchId,
    ownerUid: input.ownerUid,
    primaryDispensaryId,
    clusterSize: claimIds.length,
    siblingsCreated: distinctSiblings.length,
  });

  return {
    ok: true,
    batchId,
    ownerUid: input.ownerUid,
    primaryDispensaryId,
    primaryClaimId,
    siblingClaimIds,
    claimIds,
    createdAt,
  };
}

export async function getBulkClaimBatchStatus(input: {
  ownerUid: string;
  batchId: string;
}): Promise<BulkClaimBatchStatus | null> {
  if (!serverConfig.bulkClaimEnabled) return null;

  const db = getBackendFirebaseDb();
  if (!db) return null;

  const batchRef = db.collection(BULK_VERIFICATION_BATCHES_COLLECTION).doc(input.batchId);
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) return null;

  const batch = batchSnap.data() as {
    batchId: string;
    ownerUid: string;
    primaryDispensaryId: string;
    claimIds: string[];
    createdAt: string;
  };

  // Owners can only see their own batches.
  if (batch.ownerUid !== input.ownerUid) return null;

  const claimSnaps = await Promise.all(
    batch.claimIds.map((claimId) => db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get()),
  );

  const claims = claimSnaps.map((snap, i) => {
    const data = snap.exists
      ? (snap.data() as {
          dispensaryId?: string;
          claimStatus?: string;
          shopOwnershipVerified?: boolean;
          reviewedAt?: string | null;
        })
      : null;
    return {
      claimId: batch.claimIds[i],
      dispensaryId: data?.dispensaryId ?? '',
      claimStatus: data?.claimStatus ?? 'unknown',
      shopOwnershipVerified: data?.shopOwnershipVerified === true,
      reviewedAt: data?.reviewedAt ?? null,
    };
  });

  return {
    ok: true,
    batchId: batch.batchId,
    ownerUid: batch.ownerUid,
    primaryDispensaryId: batch.primaryDispensaryId,
    claimIds: batch.claimIds,
    createdAt: batch.createdAt,
    claims,
  };
}

/**
 * Wraps siblingLocationDiscoveryService for the GET /siblings/:id endpoint.
 * The owner must already be authenticated (route caller's responsibility).
 * Currently doesn't enforce that the owner has a claim on `dispensaryId` —
 * sibling discovery is read-only and the OCM data is public, so leaking it
 * is no worse than scraping data.ny.gov directly.
 */
export async function getSiblingsForOwnerStorefront(input: {
  ownerUid: string;
  dispensaryId: string;
}): Promise<SiblingDiscoveryResult | null> {
  if (!serverConfig.bulkClaimEnabled) return null;
  if (!input.dispensaryId) return null;
  return discoverSiblingLocations(input.dispensaryId);
}

export const BULK_CLAIM_MAX_SIZE = MAX_BULK_CLAIM_SIZE;
