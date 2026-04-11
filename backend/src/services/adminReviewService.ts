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
  body: { status: ReviewDecision; reviewNotes: string | null },
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

  const claim = claimSnapshot.data() as { ownerUid: string; dispensaryId: string };

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
