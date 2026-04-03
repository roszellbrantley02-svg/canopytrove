import { serverConfig } from '../config';
import { getBackendFirebaseDb, hasBackendFirebaseConfig } from '../firebase';
import {
  listReviewPhotoModerationQueue,
  reviewReviewPhotoUpload,
} from './reviewPhotoModerationService';
import { appendPhotoIdToStorefrontAppReview } from './storefrontCommunityService';

type ReviewDecision = 'approved' | 'rejected' | 'needs_resubmission';
type VerificationDecision = 'verified' | 'rejected' | 'needs_resubmission';

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const BUSINESS_VERIFICATIONS_COLLECTION = 'businessVerifications';
const IDENTITY_VERIFICATIONS_COLLECTION = 'identityVerifications';
const STOREFRONT_REPORTS_COLLECTION = 'storefront_reports';

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

export async function getAdminReviewQueue(limitInput?: unknown) {
  const db = getAdminReviewDb();
  const limit = parsePositiveLimit(limitInput);

  const [claims, businessVerifications, identityVerifications, storefrontReports, reviewPhotos] =
    await Promise.all([
      db
        .collection(DISPENSARY_CLAIMS_COLLECTION)
        .where('claimStatus', '==', 'pending')
        .limit(limit)
        .get(),
      db
        .collection(BUSINESS_VERIFICATIONS_COLLECTION)
        .where('verificationStatus', '==', 'pending')
        .limit(limit)
        .get(),
      db
        .collection(IDENTITY_VERIFICATIONS_COLLECTION)
        .where('verificationStatus', '==', 'pending')
        .limit(limit)
        .get(),
      db
        .collection(STOREFRONT_REPORTS_COLLECTION)
        .where('moderationStatus', '==', 'open')
        .limit(limit)
        .get(),
      listReviewPhotoModerationQueue(limit),
    ]);

  return {
    claims: claims.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    })),
    businessVerifications: businessVerifications.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    })),
    identityVerifications: identityVerifications.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    })),
    storefrontReports: storefrontReports.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    })),
    reviewPhotos,
  };
}

export async function getAdminReviewPhotoQueue(limitInput?: unknown) {
  const limit = parsePositiveLimit(limitInput);
  return listReviewPhotoModerationQueue(limit);
}

export async function reviewOwnerClaim(claimId: string, body: { status: ReviewDecision; reviewNotes: string | null }) {
  const db = getAdminReviewDb();
  const now = createNow();
  const claimRef = db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId);
  const claimSnapshot = await claimRef.get();
  if (!claimSnapshot.exists) {
    throw new Error('Owner claim not found.');
  }

  const claim = claimSnapshot.data() as { ownerUid: string; dispensaryId: string };
  const updates: Array<Promise<unknown>> = [
    claimRef.set(
      {
        claimStatus: body.status,
        reviewedAt: now,
        reviewNotes: body.reviewNotes,
      },
      { merge: true }
    ),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(claim.ownerUid)
      .set(
        {
          dispensaryId: body.status === 'approved' ? claim.dispensaryId : null,
          onboardingStep:
            body.status === 'approved' ? 'business_verification' : 'claim_listing',
          updatedAt: now,
        },
        { merge: true }
      ),
  ];

  if (body.status === 'approved') {
    updates.push(
      db.collection('dispensaries').doc(claim.dispensaryId).set(
        {
          ownerUid: claim.ownerUid,
          claimStatus: 'approved',
          ownerClaimReviewedAt: now,
        },
        { merge: true }
      )
    );
  }

  await Promise.all(updates);

  return {
    ok: true,
    claimId,
    status: body.status,
  };
}

export async function reviewBusinessVerification(ownerUid: string, body: { status: ReviewDecision; reviewNotes: string | null }) {
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
      { merge: true }
    ),
    db
      .collection(OWNER_PROFILES_COLLECTION)
      .doc(ownerUid)
      .set(
        {
          businessVerificationStatus: verificationStatus,
          onboardingStep:
            verificationStatus === 'verified'
              ? 'identity_verification'
              : 'business_verification',
          updatedAt: now,
        },
        { merge: true }
      ),
  ]);

  return {
    ok: true,
    ownerUid,
    status: body.status,
  };
}

export async function reviewIdentityVerification(ownerUid: string, body: { status: ReviewDecision; reviewNotes: string | null }) {
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
      { merge: true }
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
        { merge: true }
      ),
  ]);

  return {
    ok: true,
    ownerUid,
    status: body.status,
  };
}

export async function reviewStorefrontReport(reportId: string, body: { status: ReviewDecision; reviewNotes: string | null }) {
  const db = getAdminReviewDb();
  const now = createNow();
  const moderationStatus = body.status === 'approved' ? 'reviewed' : body.status === 'rejected' ? 'dismissed' : 'open';

  await db.collection(STOREFRONT_REPORTS_COLLECTION).doc(reportId).set(
    {
      moderationStatus,
      reviewedAt: now,
      reviewNotes: body.reviewNotes,
    },
    { merge: true }
  );

  return {
    ok: true,
    reportId,
    moderationStatus,
  };
}

export async function reviewStorefrontPhoto(photoId: string, body: { status: ReviewDecision; reviewNotes: string | null }) {
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
