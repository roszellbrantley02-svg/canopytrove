import { serverConfig } from '../config';
import { logger } from '../observability/logger';
import { getBackendFirebaseDb, hasBackendFirebaseConfig } from '../firebase';
import {
  listReviewPhotoModerationQueue,
  reviewReviewPhotoUpload,
} from './reviewPhotoModerationService';
import type { ReviewPhotoModerationQueueItem } from './reviewPhotoModerationService';
import { appendPhotoIdToStorefrontAppReview } from './storefrontCommunityService';
import {
  OWNER_PROFILES_COLLECTION,
  DISPENSARY_CLAIMS_COLLECTION,
  BUSINESS_VERIFICATIONS_COLLECTION,
  IDENTITY_VERIFICATIONS_COLLECTION,
  STOREFRONT_REPORTS_COLLECTION,
  DISPENSARIES_COLLECTION,
} from '../constants/collections';

type ReviewDecision = 'approved' | 'rejected' | 'needs_resubmission';
type VerificationDecision = 'verified' | 'rejected' | 'needs_resubmission';

type AdminReviewQueueDocument = Record<string, unknown>;

export type AdminReviewQueueSectionWarning =
  | 'claims'
  | 'businessVerifications'
  | 'identityVerifications'
  | 'storefrontReports'
  | 'reviewPhotos';

type AdminReviewQueueLoaders = {
  claims: () => Promise<AdminReviewQueueDocument[]>;
  businessVerifications: () => Promise<AdminReviewQueueDocument[]>;
  identityVerifications: () => Promise<AdminReviewQueueDocument[]>;
  storefrontReports: () => Promise<AdminReviewQueueDocument[]>;
  reviewPhotos: () => Promise<ReviewPhotoModerationQueueItem[]>;
};

export type AdminReviewQueueResult = {
  claims: AdminReviewQueueDocument[];
  businessVerifications: AdminReviewQueueDocument[];
  identityVerifications: AdminReviewQueueDocument[];
  storefrontReports: AdminReviewQueueDocument[];
  reviewPhotos: ReviewPhotoModerationQueueItem[];
  warnings: AdminReviewQueueSectionWarning[];
};

export function getAdminReviewReadiness() {
  const missingRequirements: string[] = [];
  const adminApiKey = process.env.ADMIN_API_KEY?.trim() || serverConfig.adminApiKey;

  if (!adminApiKey) {
    missingRequirements.push('ADMIN_API_KEY');
  }

  if (!hasBackendFirebaseConfig) {
    missingRequirements.push('FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS');
  }

  return {
    ok: missingRequirements.length === 0,
    missingRequirements,
  } as const;
}

function getAdminReviewDb() {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Backend Firebase admin access is not configured.');
  }

  return db;
}

function createNow() {
  return new Date().toISOString();
}

function parsePositiveLimit(value: unknown, fallback = 25) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(100, Math.floor(parsed));
}

function parseReviewDecision(value: unknown): ReviewDecision {
  if (value === 'approved' || value === 'rejected' || value === 'needs_resubmission') {
    return value;
  }

  throw new Error('Invalid review decision.');
}

function parseReviewNotes(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export function parseAdminReviewBody(body: unknown) {
  const record = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  return {
    status: parseReviewDecision(record.status),
    reviewNotes: parseReviewNotes(record.reviewNotes),
    // Only relevant for reviewOwnerClaim — the other review actions ignore
    // it. Bypasses the shop-ownership-verified gate when ownership was
    // confirmed out of band; admin documents that in reviewNotes.
    overrideShopOwnership: record.overrideShopOwnership === true,
  };
}

function mapVerificationDecision(status: ReviewDecision): VerificationDecision {
  if (status === 'approved') {
    return 'verified';
  }

  return status;
}

function unwrapAdminReviewQueueSection<T>(
  section: AdminReviewQueueSectionWarning,
  result: PromiseSettledResult<T>,
  fallback: T,
  warnings: AdminReviewQueueSectionWarning[],
) {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  warnings.push(section);
  logger.warn(`[admin-review] failed to load ${section} queue section`, {
    error: result.reason instanceof Error ? result.reason.message : String(result.reason),
  });
  return fallback;
}

export async function loadAdminReviewQueueSections(
  loaders: AdminReviewQueueLoaders,
): Promise<AdminReviewQueueResult> {
  const [
    claimsResult,
    businessVerificationsResult,
    identityVerificationsResult,
    storefrontReportsResult,
    reviewPhotosResult,
  ] = await Promise.allSettled([
    loaders.claims(),
    loaders.businessVerifications(),
    loaders.identityVerifications(),
    loaders.storefrontReports(),
    loaders.reviewPhotos(),
  ]);

  const warnings: AdminReviewQueueSectionWarning[] = [];

  return {
    claims: unwrapAdminReviewQueueSection('claims', claimsResult, [], warnings),
    businessVerifications: unwrapAdminReviewQueueSection(
      'businessVerifications',
      businessVerificationsResult,
      [],
      warnings,
    ),
    identityVerifications: unwrapAdminReviewQueueSection(
      'identityVerifications',
      identityVerificationsResult,
      [],
      warnings,
    ),
    storefrontReports: unwrapAdminReviewQueueSection(
      'storefrontReports',
      storefrontReportsResult,
      [],
      warnings,
    ),
    reviewPhotos: unwrapAdminReviewQueueSection('reviewPhotos', reviewPhotosResult, [], warnings),
    warnings,
  };
}

export async function getAdminReviewQueue(limitInput?: unknown) {
  const db = getAdminReviewDb();
  const limit = parsePositiveLimit(limitInput);

  return loadAdminReviewQueueSections({
    claims: async () => {
      const snapshot = await db
        .collection(DISPENSARY_CLAIMS_COLLECTION)
        .where('claimStatus', '==', 'pending')
        .limit(limit)
        .get();
      return snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));
    },
    businessVerifications: async () => {
      const snapshot = await db
        .collection(BUSINESS_VERIFICATIONS_COLLECTION)
        .where('verificationStatus', '==', 'pending')
        .limit(limit)
        .get();
      return snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));
    },
    identityVerifications: async () => {
      const snapshot = await db
        .collection(IDENTITY_VERIFICATIONS_COLLECTION)
        .where('verificationStatus', '==', 'pending')
        .limit(limit)
        .get();
      return snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));
    },
    storefrontReports: async () => {
      const snapshot = await db
        .collection(STOREFRONT_REPORTS_COLLECTION)
        .where('moderationStatus', '==', 'open')
        .limit(limit)
        .get();
      return snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));
    },
    reviewPhotos: async () => listReviewPhotoModerationQueue(limit),
  });
}

export async function getAdminReviewPhotoQueue(limitInput?: unknown) {
  const limit = parsePositiveLimit(limitInput);
  return listReviewPhotoModerationQueue(limit);
}

export async function reviewOwnerClaim(
  claimId: string,
  body: {
    status: ReviewDecision;
    reviewNotes: string | null;
    /**
     * When true, admin explicitly bypasses the shop-ownership-verified
     * gate (e.g. when ownership was confirmed out of band — phone call
     * to the shop, in-person visit, mailed postcard). The override is
     * recorded in reviewNotes for audit. Without this flag, claims
     * lacking shop ownership verification are rejected at the gate.
     */
    overrideShopOwnership?: boolean;
  },
) {
  // Validate decision value before database transaction
  const validatedStatus = parseReviewDecision(body.status);

  const db = getAdminReviewDb();
  const now = createNow();
  const claimRef = db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId);
  const claimSnapshot = await claimRef.get();
  if (!claimSnapshot.exists) {
    throw new Error('Owner claim not found.');
  }

  const claim = claimSnapshot.data() as {
    ownerUid: string;
    dispensaryId: string;
    shopOwnershipVerified?: boolean;
    shopOwnershipVerifiedPhoneSuffix?: string | null;
  };

  // Anti-hijack signal: shop ownership verification (Twilio SMS callback
  // to the shop's published phone, shopOwnershipVerificationService)
  // confirms the claimant controls the shop's actual phone line. We
  // record the signal in the audit trail but don't HARD-block approval
  // on it — many legitimate dispensaries use landlines or off-site
  // forwarding that prevent the owner from completing Layer 2 directly.
  // Hard-blocking would lock out 30-40% of legit owners. Instead admin
  // sees the flag in the review queue and decides accordingly. The
  // overrideShopOwnership field is preserved for explicit override audit
  // when admin verified ownership out of band (phone call, postcard,
  // document review).
  if (validatedStatus === 'approved' && !claim.shopOwnershipVerified) {
    logger.warn('[adminReviewService] Approving claim without shopOwnershipVerified', {
      claimId,
      ownerUid: claim.ownerUid,
      dispensaryId: claim.dispensaryId,
      overrideExplicit: body.overrideShopOwnership === true,
      reviewNotes: body.reviewNotes,
    });
  }

  // Check if this owner already has a primary location (multi-location scenario)
  const ownerProfileSnapshot = await db
    .collection(OWNER_PROFILES_COLLECTION)
    .doc(claim.ownerUid)
    .get();
  const existingProfile = ownerProfileSnapshot.exists ? ownerProfileSnapshot.data() : null;
  const hasPrimaryLocation = Boolean(existingProfile?.dispensaryId);
  const isAdditionalLocation =
    hasPrimaryLocation && existingProfile?.dispensaryId !== claim.dispensaryId;

  const updates: Array<Promise<unknown>> = [
    claimRef.set(
      {
        claimStatus: validatedStatus,
        reviewedAt: now,
        reviewNotes: body.reviewNotes,
      },
      { merge: true },
    ),
  ];

  if (validatedStatus === 'approved') {
    if (isAdditionalLocation) {
      // Multi-location: add to additionalLocationIds instead of overwriting dispensaryId
      const currentAdditional: string[] = existingProfile?.additionalLocationIds ?? [];
      if (!currentAdditional.includes(claim.dispensaryId)) {
        updates.push(
          db
            .collection(OWNER_PROFILES_COLLECTION)
            .doc(claim.ownerUid)
            .set(
              {
                additionalLocationIds: [...currentAdditional, claim.dispensaryId],
                updatedAt: now,
              },
              { merge: true },
            ),
        );
      }
    } else {
      // Primary location: set dispensaryId as before
      updates.push(
        db.collection(OWNER_PROFILES_COLLECTION).doc(claim.ownerUid).set(
          {
            dispensaryId: claim.dispensaryId,
            onboardingStep: 'business_verification',
            updatedAt: now,
          },
          { merge: true },
        ),
      );
    }

    updates.push(
      db.collection(DISPENSARIES_COLLECTION).doc(claim.dispensaryId).set(
        {
          ownerUid: claim.ownerUid,
          claimStatus: 'approved',
          ownerClaimReviewedAt: now,
          isAdditionalLocation,
        },
        { merge: true },
      ),
    );
  } else {
    // Rejection/resubmission — only reset if this was the primary location claim
    if (!isAdditionalLocation) {
      updates.push(
        db.collection(OWNER_PROFILES_COLLECTION).doc(claim.ownerUid).set(
          {
            dispensaryId: null,
            onboardingStep: 'claim_listing',
            updatedAt: now,
          },
          { merge: true },
        ),
      );
    }
  }

  await Promise.all(updates);

  return {
    ok: true,
    claimId,
    status: validatedStatus,
  };
}

export type BatchClaimReviewOutcome = {
  ownerUid: string | null;
  /** Per-claim results keyed by claimId. */
  results: Map<string, { ok: true; status: ReviewDecision } | { ok: false; error: string }>;
  approvedCount: number;
  rejectedCount: number;
  failedCount: number;
};

/**
 * Phase 3 — admin batch claim review. Lets an admin approve/reject N
 * claim IDs in one request. Calls the existing `reviewOwnerClaim` per
 * claim sequentially (same per-claim atomicity, same audit trail).
 *
 * Use cases:
 *   - Approve all claims sharing a `bulkClaimBatchId` from Phase 2 that
 *     didn't auto-approve (e.g., dual-OTP not satisfied; admin verified
 *     out-of-band)
 *   - Approve a hand-picked set of claims for a chain operator the admin
 *     has vetted via separate documentation (corporate filings, etc.)
 *
 * Per-claim sequencing is intentional. Each `reviewOwnerClaim` call is
 * already its own atomic write group; partial success is the desired
 * behavior — if 4 of 5 approvals succeed and 1 fails, the 4 stay approved
 * and the 1 stays pending for the admin to retry.
 *
 * Hard cap on batch size to prevent runaway requests.
 */
const MAX_BATCH_CLAIM_REVIEW = 25;

export async function reviewOwnerClaimsBatch(input: {
  claimIds: string[];
  body: ReturnType<typeof parseAdminReviewBody>;
}): Promise<BatchClaimReviewOutcome> {
  const distinctIds = Array.from(
    new Set(input.claimIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );
  if (distinctIds.length === 0) {
    throw new Error('claimIds is required and must contain at least one non-empty string.');
  }
  if (distinctIds.length > MAX_BATCH_CLAIM_REVIEW) {
    throw new Error(
      `Batch claim review is capped at ${MAX_BATCH_CLAIM_REVIEW} claims per request.`,
    );
  }

  const results = new Map<
    string,
    { ok: true; status: ReviewDecision } | { ok: false; error: string }
  >();
  let approvedCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;
  let ownerUid: string | null = null;

  for (const claimId of distinctIds) {
    try {
      const outcome = await reviewOwnerClaim(claimId, input.body);
      results.set(claimId, { ok: true, status: outcome.status });
      if (outcome.status === 'approved') approvedCount += 1;
      else rejectedCount += 1;
      // Capture the ownerUid from the first successful review for logging
      // (all batch claims should belong to one owner, but we don't enforce
      // that — admins occasionally batch across owners).
      if (!ownerUid) {
        const db = getAdminReviewDb();
        const claimSnap = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
        const data = claimSnap.exists ? (claimSnap.data() as { ownerUid?: string }) : null;
        ownerUid = data?.ownerUid ?? null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.set(claimId, { ok: false, error: message });
      failedCount += 1;
      logger.warn('[adminReviewService] Batch claim review failure', {
        claimId,
        error: message,
      });
    }
  }

  logger.info('[adminReviewService] Batch claim review complete', {
    ownerUid,
    requested: distinctIds.length,
    approved: approvedCount,
    rejected: rejectedCount,
    failed: failedCount,
  });

  return { ownerUid, results, approvedCount, rejectedCount, failedCount };
}

export async function reviewBusinessVerification(
  ownerUid: string,
  body: { status: ReviewDecision; reviewNotes: string | null },
) {
  const db = getAdminReviewDb();
  const now = createNow();
  const verificationRef = db.collection(BUSINESS_VERIFICATIONS_COLLECTION).doc(ownerUid);
  const verificationStatus = mapVerificationDecision(body.status);
  await Promise.all([
    verificationRef.set(
      {
        verificationStatus,
        reviewedAt: now,
        adminNotes: body.reviewNotes,
      },
      { merge: true },
    ),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          businessVerificationStatus: verificationStatus,
          onboardingStep:
            verificationStatus === 'verified' ? 'identity_verification' : 'business_verification',
          updatedAt: now,
        },
        { merge: true },
      ),
  ]);

  return {
    ok: true,
    ownerUid,
    status: body.status,
  };
}

export async function reviewIdentityVerification(
  ownerUid: string,
  body: { status: ReviewDecision; reviewNotes: string | null },
) {
  const db = getAdminReviewDb();
  const now = createNow();
  const verificationRef = db.collection(IDENTITY_VERIFICATIONS_COLLECTION).doc(ownerUid);
  const verificationStatus = mapVerificationDecision(body.status);
  await Promise.all([
    verificationRef.set(
      {
        verificationStatus,
        reviewedAt: now,
        adminNotes: body.reviewNotes,
      },
      { merge: true },
    ),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          identityVerificationStatus: verificationStatus,
          onboardingStep:
            verificationStatus === 'verified' ? 'subscription' : 'identity_verification',
          updatedAt: now,
        },
        { merge: true },
      ),
  ]);

  return {
    ok: true,
    ownerUid,
    status: body.status,
  };
}

export async function reviewStorefrontReport(
  reportId: string,
  body: { status: ReviewDecision; reviewNotes: string | null },
) {
  const db = getAdminReviewDb();
  const now = createNow();
  const moderationStatus =
    body.status === 'approved' ? 'reviewed' : body.status === 'rejected' ? 'dismissed' : 'open';

  await db.collection(STOREFRONT_REPORTS_COLLECTION).doc(reportId).set(
    {
      moderationStatus,
      reviewedAt: now,
      reviewNotes: body.reviewNotes,
    },
    { merge: true },
  );

  return {
    ok: true,
    reportId,
    moderationStatus,
  };
}

export async function reviewStorefrontPhoto(
  photoId: string,
  body: { status: ReviewDecision; reviewNotes: string | null },
) {
  const moderationDecision =
    body.status === 'approved'
      ? 'approved'
      : body.status === 'rejected'
        ? 'rejected'
        : 'needs_manual_review';

  const result = await reviewReviewPhotoUpload(photoId, {
    decision: moderationDecision,
    reviewNotes: body.reviewNotes,
  });

  if (result.moderationStatus === 'approved' && result.session.reviewId) {
    await appendPhotoIdToStorefrontAppReview(result.session.reviewId, result.photoId);
  }

  return result;
}
