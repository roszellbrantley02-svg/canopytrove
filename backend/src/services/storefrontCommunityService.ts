import { randomUUID } from 'node:crypto';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { FieldValue } from 'firebase-admin/firestore';
import {
  AppReview,
  StorefrontReviewUpdateInput,
  StorefrontReviewHelpfulInput,
  StorefrontReportSubmissionInput,
  StorefrontReviewSubmissionInput,
} from '../../../src/types/storefront';
import {
  attachReviewPhotosToReview,
  deleteReviewPhotoUploadsForProfile,
  getApprovedReviewPhotoUrls,
} from './reviewPhotoModerationService';
import { createPublicCommunityAuthorId } from './publicCommunityIdentityService';

type StoredAppReviewRecord = {
  id: string;
  storefrontId: string;
  profileId: string;
  authorName: string;
  rating: number;
  text: string;
  gifUrl?: string | null;
  tags: string[];
  photoCount: number;
  photoIds: string[];
  helpfulCount: number;
  helpfulVoterIds: string[];
  createdAt: string;
  ownerReply?: {
    ownerUid: string;
    ownerDisplayName: string | null;
    text: string;
    respondedAt: string;
  } | null;
};

export type StorefrontAppReviewRecord = AppReview & {
  photoUrls: string[];
  photoCount: number;
};

export type StorefrontReviewSubmissionResult = {
  review: StorefrontAppReviewRecord;
  photoModeration: {
    submittedCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    message: string | null;
  } | null;
};

export type StoredStorefrontReportRecord = {
  id: string;
  storefrontId: string;
  profileId: string;
  authorName: string;
  reason: string;
  description: string;
  reportTarget?: 'storefront' | 'review';
  reportedReviewId?: string | null;
  reportedReviewAuthorProfileId?: string | null;
  reportedReviewAuthorName?: string | null;
  reportedReviewExcerpt?: string | null;
  createdAt: string;
  moderationStatus?: 'open' | 'reviewed' | 'dismissed';
  reviewedAt?: string | null;
  reviewNotes?: string | null;
};

const APP_REVIEWS_COLLECTION = 'storefront_app_reviews';
const STOREFRONT_REPORTS_COLLECTION = 'storefront_reports';
const APP_REVIEW_AGGREGATE_TTL_MS = 60_000;

const appReviewStore = new Map<string, StoredAppReviewRecord[]>();
const storefrontReportStore = new Map<string, StoredStorefrontReportRecord[]>();
let appReviewAggregateCache: {
  expiresAt: number;
  value: Map<string, { reviewCount: number; averageRating: number }>;
} | null = null;

export class StorefrontCommunityError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function toRelativeTime(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return 'Recently';
  }

  const deltaMs = Date.now() - createdTime;
  const deltaMinutes = Math.floor(deltaMs / 60000);
  if (deltaMinutes <= 0) {
    return 'Just now';
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes} min ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} hr ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;
}

function normalizeOwnerReply(
  value:
    | {
        ownerUid: string;
        ownerDisplayName: string | null;
        text: string;
        respondedAt: string;
      }
    | null
    | undefined,
) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const ownerUid = typeof value.ownerUid === 'string' ? value.ownerUid.trim() : '';
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const respondedAt =
    typeof value.respondedAt === 'string' && value.respondedAt.trim()
      ? value.respondedAt
      : new Date().toISOString();

  if (!ownerUid || !text) {
    return null;
  }

  return {
    ownerUid,
    ownerDisplayName:
      typeof value.ownerDisplayName === 'string' && value.ownerDisplayName.trim()
        ? value.ownerDisplayName.trim()
        : null,
    text,
    respondedAt,
  };
}

async function mapStoredReviewToAppReview(
  review: StoredAppReviewRecord,
  viewerProfileId?: string | null,
): Promise<StorefrontAppReviewRecord> {
  return {
    id: review.id,
    authorName: review.authorName,
    authorProfileId: createPublicCommunityAuthorId(review.profileId, review.storefrontId),
    rating: review.rating,
    relativeTime: toRelativeTime(review.createdAt),
    text: review.text,
    gifUrl: review.gifUrl ?? null,
    tags: [...review.tags],
    helpfulCount: review.helpfulCount,
    isOwnReview: Boolean(viewerProfileId && viewerProfileId === review.profileId),
    ownerReply: normalizeOwnerReply(review.ownerReply),
    photoUrls: await getApprovedReviewPhotoUrls(review.photoIds),
    photoCount: review.photoIds.length,
  };
}

function getAppReviewCollection() {
  return getOptionalFirestoreCollection<StoredAppReviewRecord>(APP_REVIEWS_COLLECTION);
}

function getStorefrontReportCollection() {
  return getOptionalFirestoreCollection<StoredStorefrontReportRecord>(
    STOREFRONT_REPORTS_COLLECTION,
  );
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
    ),
  );
}

function normalizeRating(rating: number) {
  if (!Number.isFinite(rating)) {
    return 5;
  }

  return Math.max(1, Math.min(5, Math.round(rating)));
}

function normalizeHelpfulVoterIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string')));
}

function normalizeStoredReviewRecord(review: StoredAppReviewRecord): StoredAppReviewRecord {
  return {
    ...review,
    helpfulCount:
      typeof review.helpfulCount === 'number' && Number.isFinite(review.helpfulCount)
        ? Math.max(0, Math.floor(review.helpfulCount))
        : 0,
    photoIds: Array.from(
      new Set(
        Array.isArray(review.photoIds)
          ? review.photoIds.filter((photoId): photoId is string => typeof photoId === 'string')
          : [],
      ),
    ).slice(0, 4),
    helpfulVoterIds: normalizeHelpfulVoterIds(review.helpfulVoterIds),
    ownerReply: normalizeOwnerReply(review.ownerReply),
  };
}

function createStorefrontReviewAggregateMap(reviews: StoredAppReviewRecord[]) {
  const totals = new Map<string, { reviewCount: number; ratingTotal: number }>();
  for (const review of reviews) {
    const storefrontId = review.storefrontId.trim();
    if (!storefrontId) {
      continue;
    }

    const current = totals.get(storefrontId) ?? { reviewCount: 0, ratingTotal: 0 };
    current.reviewCount += 1;
    current.ratingTotal += normalizeRating(review.rating);
    totals.set(storefrontId, current);
  }

  const aggregateMap = new Map<string, { reviewCount: number; averageRating: number }>();
  totals.forEach((current, storefrontId) => {
    aggregateMap.set(storefrontId, {
      reviewCount: current.reviewCount,
      averageRating:
        current.reviewCount > 0
          ? Number((current.ratingTotal / current.reviewCount).toFixed(1))
          : 0,
    });
  });

  return aggregateMap;
}

async function loadAllStoredAppReviews() {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.get();
    return snapshot.docs.map((documentSnapshot) =>
      normalizeStoredReviewRecord(documentSnapshot.data() as StoredAppReviewRecord),
    );
  }

  return Array.from(appReviewStore.values()).flat().map(normalizeStoredReviewRecord);
}

export function clearStorefrontAppReviewAggregateCache() {
  appReviewAggregateCache = null;
}

export async function getStorefrontAppReviewAggregates() {
  if (appReviewAggregateCache && appReviewAggregateCache.expiresAt > Date.now()) {
    return appReviewAggregateCache.value;
  }

  const aggregateMap = createStorefrontReviewAggregateMap(await loadAllStoredAppReviews());
  appReviewAggregateCache = {
    value: aggregateMap,
    expiresAt: Date.now() + APP_REVIEW_AGGREGATE_TTL_MS,
  };
  return aggregateMap;
}

function normalizeStoredReportRecord(
  report: StoredStorefrontReportRecord,
): StoredStorefrontReportRecord {
  return {
    ...report,
    reportTarget: report.reportTarget === 'review' ? 'review' : 'storefront',
    reportedReviewId:
      typeof report.reportedReviewId === 'string' && report.reportedReviewId.trim()
        ? report.reportedReviewId.trim()
        : null,
    reportedReviewAuthorProfileId:
      typeof report.reportedReviewAuthorProfileId === 'string' &&
      report.reportedReviewAuthorProfileId.trim()
        ? report.reportedReviewAuthorProfileId.trim()
        : null,
    reportedReviewAuthorName:
      typeof report.reportedReviewAuthorName === 'string' && report.reportedReviewAuthorName.trim()
        ? report.reportedReviewAuthorName.trim()
        : null,
    reportedReviewExcerpt:
      typeof report.reportedReviewExcerpt === 'string' && report.reportedReviewExcerpt.trim()
        ? report.reportedReviewExcerpt.trim()
        : null,
    moderationStatus:
      report.moderationStatus === 'reviewed' || report.moderationStatus === 'dismissed'
        ? report.moderationStatus
        : 'open',
    reviewedAt:
      typeof report.reviewedAt === 'string' && report.reviewedAt.trim() ? report.reviewedAt : null,
    reviewNotes:
      typeof report.reviewNotes === 'string' && report.reviewNotes.trim()
        ? report.reviewNotes.trim()
        : null,
  };
}

export async function listStorefrontAppReviews(
  storefrontId: string,
  viewerProfileId?: string | null,
) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('storefrontId', '==', storefrontId).get();
    const settledReviews = await Promise.allSettled(
      snapshot.docs
        .map((documentSnapshot) =>
          normalizeStoredReviewRecord(documentSnapshot.data() as StoredAppReviewRecord),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((review) => mapStoredReviewToAppReview(review, viewerProfileId)),
    );
    return settledReviews.flatMap((result) => {
      if (result.status === 'fulfilled') {
        return [result.value];
      }
      console.warn('[storefrontCommunityService] failed to map a review:', result.reason);
      return [];
    });
  }

  const settledMemoryReviews = await Promise.allSettled(
    (appReviewStore.get(storefrontId) ?? [])
      .slice()
      .map(normalizeStoredReviewRecord)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((review) => mapStoredReviewToAppReview(review, viewerProfileId)),
  );
  return settledMemoryReviews.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }
    console.warn('[storefrontCommunityService] failed to map a review:', result.reason);
    return [];
  });
}

async function getStoredStorefrontAppReviewById(reviewId: string) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(reviewId).get();
    if (!snapshot.exists) {
      return null;
    }

    return normalizeStoredReviewRecord(snapshot.data() as StoredAppReviewRecord);
  }

  for (const reviews of appReviewStore.values()) {
    const review = reviews.find((candidate) => candidate.id === reviewId);
    if (review) {
      return normalizeStoredReviewRecord(review);
    }
  }

  return null;
}

async function getStoredStorefrontAppReviewByProfile(
  storefrontId: string,
  profileId: string,
  withinHours?: number,
) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef
      .where('storefrontId', '==', storefrontId)
      .where('profileId', '==', profileId)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const review = snapshot.docs[0].data() as StoredAppReviewRecord;
    if (withinHours !== undefined && withinHours > 0) {
      const reviewTime = new Date(review.createdAt).getTime();
      const cutoffTime = Date.now() - withinHours * 60 * 60 * 1000;
      if (reviewTime < cutoffTime) {
        return null; // Review is older than the window
      }
    }

    return normalizeStoredReviewRecord(review);
  }

  const reviews = appReviewStore.get(storefrontId) ?? [];
  const review = reviews.find((candidate) => candidate.profileId === profileId);
  if (!review) {
    return null;
  }

  if (withinHours !== undefined && withinHours > 0) {
    const reviewTime = new Date(review.createdAt).getTime();
    const cutoffTime = Date.now() - withinHours * 60 * 60 * 1000;
    if (reviewTime < cutoffTime) {
      return null; // Review is older than the window
    }
  }

  return normalizeStoredReviewRecord(review);
}

export async function listStorefrontReports(storefrontId: string) {
  const collectionRef = getStorefrontReportCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('storefrontId', '==', storefrontId).get();
    return snapshot.docs
      .map((documentSnapshot) =>
        normalizeStoredReportRecord(documentSnapshot.data() as StoredStorefrontReportRecord),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  return (storefrontReportStore.get(storefrontId) ?? [])
    .slice()
    .map(normalizeStoredReportRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function submitStorefrontAppReview(
  input: StorefrontReviewSubmissionInput & { photoUploadIds?: string[] },
): Promise<StorefrontReviewSubmissionResult> {
  // Prevent duplicate reviews: check if user has a review for this storefront within the last 24 hours
  const recentReview = await getStoredStorefrontAppReviewByProfile(
    input.storefrontId,
    input.profileId,
    24, // Check within last 24 hours
  );
  if (recentReview) {
    throw new StorefrontCommunityError(
      'You already reviewed this storefront recently. Edit your existing review or wait before submitting a new one.',
      409,
    );
  }

  const photoUploadIds = Array.from(
    new Set(
      Array.isArray(input.photoUploadIds)
        ? input.photoUploadIds.filter((photoId): photoId is string => typeof photoId === 'string')
        : [],
    ),
  ).slice(0, 4);
  const reviewRecord: StoredAppReviewRecord = {
    id: createId('review'),
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    authorName: input.authorName.trim() || 'Canopy Trove user',
    rating: normalizeRating(input.rating),
    text: input.text.trim(),
    gifUrl: input.gifUrl?.trim() || null,
    tags: normalizeTags(input.tags),
    photoCount: Math.max(0, Math.floor(input.photoCount ?? 0)),
    photoIds: [],
    helpfulCount: 0,
    helpfulVoterIds: [],
    createdAt: new Date().toISOString(),
    ownerReply: null,
  };

  let photoModeration: StorefrontReviewSubmissionResult['photoModeration'] = null;
  if (photoUploadIds.length) {
    const attachedPhotos = await attachReviewPhotosToReview({
      storefrontId: input.storefrontId,
      reviewId: reviewRecord.id,
      profileId: input.profileId,
      photoUploadIds,
    });

    reviewRecord.photoIds = attachedPhotos.photoIds;
    reviewRecord.photoCount = attachedPhotos.photoIds.length;
    photoModeration = attachedPhotos.moderationSummary;
  }

  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    await collectionRef.doc(reviewRecord.id).set(reviewRecord);
    clearStorefrontAppReviewAggregateCache();
    return {
      review: await mapStoredReviewToAppReview(reviewRecord),
      photoModeration,
    };
  }

  const currentReviews = appReviewStore.get(input.storefrontId) ?? [];
  appReviewStore.set(input.storefrontId, [reviewRecord, ...currentReviews]);
  clearStorefrontAppReviewAggregateCache();
  return {
    review: await mapStoredReviewToAppReview(reviewRecord),
    photoModeration,
  };
}

export async function updateStorefrontAppReview(
  input: StorefrontReviewUpdateInput & { photoUploadIds?: string[] },
): Promise<StorefrontReviewSubmissionResult> {
  const currentReview = await getStoredStorefrontAppReviewById(input.reviewId);
  if (!currentReview) {
    throw new StorefrontCommunityError('Review not found.', 404);
  }

  if (currentReview.storefrontId !== input.storefrontId) {
    throw new StorefrontCommunityError('Review does not belong to this storefront.', 400);
  }

  if (currentReview.profileId !== input.profileId) {
    throw new StorefrontCommunityError('Only the author can edit this review.', 403);
  }

  const photoUploadIds = Array.from(
    new Set(
      Array.isArray(input.photoUploadIds)
        ? input.photoUploadIds.filter((photoId): photoId is string => typeof photoId === 'string')
        : [],
    ),
  ).slice(0, 4);

  const nextReview: StoredAppReviewRecord = {
    ...currentReview,
    authorName: input.authorName.trim() || currentReview.authorName,
    rating: normalizeRating(input.rating),
    text: input.text.trim(),
    gifUrl: input.gifUrl?.trim() || null,
    tags: normalizeTags(input.tags),
  };

  let photoModeration: StorefrontReviewSubmissionResult['photoModeration'] = null;
  if (photoUploadIds.length) {
    const attachedPhotos = await attachReviewPhotosToReview({
      storefrontId: input.storefrontId,
      reviewId: currentReview.id,
      profileId: input.profileId,
      photoUploadIds,
    });

    nextReview.photoIds = attachedPhotos.photoIds;
    nextReview.photoCount = attachedPhotos.photoIds.length;
    photoModeration = attachedPhotos.moderationSummary;
  }

  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    await collectionRef.doc(currentReview.id).set(nextReview);
    clearStorefrontAppReviewAggregateCache();
    return {
      review: await mapStoredReviewToAppReview(nextReview),
      photoModeration,
    };
  }

  const storefrontReviews = appReviewStore.get(input.storefrontId) ?? [];
  const reviewIndex = storefrontReviews.findIndex((review) => review.id === input.reviewId);
  if (reviewIndex < 0) {
    throw new StorefrontCommunityError('Review not found.', 404);
  }

  const nextReviews = storefrontReviews.slice();
  nextReviews[reviewIndex] = nextReview;
  appReviewStore.set(input.storefrontId, nextReviews);
  clearStorefrontAppReviewAggregateCache();

  return {
    review: await mapStoredReviewToAppReview(nextReview),
    photoModeration,
  };
}

export async function appendPhotoIdToStorefrontAppReview(reviewId: string, photoId: string) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const reviewRef = collectionRef.doc(reviewId);
    const snapshot = await reviewRef.get();
    if (!snapshot.exists) {
      return false;
    }

    const current = normalizeStoredReviewRecord(snapshot.data() as StoredAppReviewRecord);
    if (current.photoIds.includes(photoId)) {
      return true;
    }

    const nextPhotoIds = [...current.photoIds, photoId].slice(0, 4);
    await reviewRef.set(
      {
        photoIds: nextPhotoIds,
        photoCount: nextPhotoIds.length,
      },
      { merge: true },
    );
    return true;
  }

  for (const [storefrontId, reviews] of appReviewStore.entries()) {
    const reviewIndex = reviews.findIndex((review) => review.id === reviewId);
    if (reviewIndex < 0) {
      continue;
    }

    const current = normalizeStoredReviewRecord(reviews[reviewIndex]);
    if (current.photoIds.includes(photoId)) {
      return true;
    }

    const nextPhotoIds = [...current.photoIds, photoId].slice(0, 4);
    reviews[reviewIndex] = {
      ...current,
      photoIds: nextPhotoIds,
      photoCount: nextPhotoIds.length,
    };
    appReviewStore.set(storefrontId, reviews);
    return true;
  }

  return false;
}

export async function markStorefrontAppReviewHelpful(input: StorefrontReviewHelpfulInput) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const reviewRef = collectionRef.doc(input.reviewId);
    return collectionRef.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reviewRef);
      if (!snapshot.exists) {
        return {
          didApply: false,
          reviewAuthorProfileId: null,
        };
      }

      const record = normalizeStoredReviewRecord(snapshot.data() as StoredAppReviewRecord);
      if (record.storefrontId !== input.storefrontId) {
        return {
          didApply: false,
          reviewAuthorProfileId: null,
        };
      }

      if (
        record.profileId === input.profileId ||
        record.helpfulVoterIds.includes(input.profileId)
      ) {
        return {
          didApply: false,
          reviewAuthorProfileId: record.profileId,
        };
      }

      transaction.update(reviewRef, {
        helpfulCount: FieldValue.increment(1),
        helpfulVoterIds: FieldValue.arrayUnion(input.profileId),
      });

      return {
        didApply: true,
        reviewAuthorProfileId: record.profileId,
      };
    });
  }

  const storefrontReviews = appReviewStore.get(input.storefrontId) ?? [];
  const reviewIndex = storefrontReviews.findIndex((review) => review.id === input.reviewId);
  if (reviewIndex < 0) {
    return {
      didApply: false,
      reviewAuthorProfileId: null,
    };
  }

  const currentReview = normalizeStoredReviewRecord(storefrontReviews[reviewIndex]);
  if (
    currentReview.profileId === input.profileId ||
    currentReview.helpfulVoterIds.includes(input.profileId)
  ) {
    return {
      didApply: false,
      reviewAuthorProfileId: currentReview.profileId,
    };
  }

  const nextReview: StoredAppReviewRecord = {
    ...currentReview,
    helpfulCount: currentReview.helpfulCount + 1,
    helpfulVoterIds: [...currentReview.helpfulVoterIds, input.profileId],
  };
  const nextReviews = storefrontReviews.slice();
  nextReviews[reviewIndex] = nextReview;
  appReviewStore.set(input.storefrontId, nextReviews);

  return {
    didApply: true,
    reviewAuthorProfileId: currentReview.profileId,
  };
}

export async function replyToStorefrontAppReview(options: {
  storefrontId: string;
  reviewId: string;
  ownerUid: string;
  ownerDisplayName: string | null;
  text: string;
}) {
  const ownerReply = normalizeOwnerReply({
    ownerUid: options.ownerUid,
    ownerDisplayName: options.ownerDisplayName,
    text: options.text,
    respondedAt: new Date().toISOString(),
  });

  if (!ownerReply) {
    throw new Error('Owner reply is required.');
  }

  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(options.reviewId).get();
    if (!snapshot.exists) {
      throw new Error('Review not found.');
    }

    const record = normalizeStoredReviewRecord(snapshot.data() as StoredAppReviewRecord);
    if (record.storefrontId !== options.storefrontId) {
      throw new Error('Review does not belong to this storefront.');
    }

    const nextRecord: StoredAppReviewRecord = {
      ...record,
      ownerReply,
    };
    await collectionRef.doc(options.reviewId).set(nextRecord);
    return mapStoredReviewToAppReview(nextRecord);
  }

  const storefrontReviews = appReviewStore.get(options.storefrontId) ?? [];
  const reviewIndex = storefrontReviews.findIndex((review) => review.id === options.reviewId);
  if (reviewIndex < 0) {
    throw new Error('Review not found.');
  }

  const nextReview: StoredAppReviewRecord = {
    ...normalizeStoredReviewRecord(storefrontReviews[reviewIndex]),
    ownerReply,
  };
  const nextReviews = storefrontReviews.slice();
  nextReviews[reviewIndex] = nextReview;
  appReviewStore.set(options.storefrontId, nextReviews);
  return mapStoredReviewToAppReview(nextReview);
}

export async function submitStorefrontReport(input: StorefrontReportSubmissionInput) {
  const reportTarget = input.reportTarget === 'review' ? 'review' : 'storefront';
  let reportedReviewId: string | null = null;
  let reportedReviewAuthorProfileId: string | null = null;
  let reportedReviewAuthorName: string | null = null;
  let reportedReviewExcerpt: string | null = null;

  if (reportTarget === 'review') {
    const normalizedReviewId = input.reportedReviewId?.trim() || '';
    if (!normalizedReviewId) {
      throw new StorefrontCommunityError('Review not found.', 404);
    }

    const reviewRecord = await getStoredStorefrontAppReviewById(normalizedReviewId);
    if (!reviewRecord) {
      throw new StorefrontCommunityError('Review not found.', 404);
    }
    if (reviewRecord.storefrontId !== input.storefrontId) {
      throw new StorefrontCommunityError('Review does not belong to this storefront.', 400);
    }

    reportedReviewId = reviewRecord.id;
    reportedReviewAuthorProfileId = createPublicCommunityAuthorId(
      reviewRecord.profileId,
      reviewRecord.storefrontId,
    );
    reportedReviewAuthorName = reviewRecord.authorName;
    reportedReviewExcerpt = reviewRecord.text.trim().slice(0, 240) || null;
  }

  const reportRecord: StoredStorefrontReportRecord = {
    id: createId('report'),
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    authorName: input.authorName.trim() || 'Canopy Trove user',
    reason: input.reason.trim(),
    description: input.description.trim(),
    reportTarget,
    reportedReviewId,
    reportedReviewAuthorProfileId,
    reportedReviewAuthorName,
    reportedReviewExcerpt,
    createdAt: new Date().toISOString(),
    moderationStatus: 'open',
    reviewedAt: null,
    reviewNotes: null,
  };

  const collectionRef = getStorefrontReportCollection();
  if (collectionRef) {
    await collectionRef.doc(reportRecord.id).set(reportRecord);
    return reportRecord;
  }

  const currentReports = storefrontReportStore.get(input.storefrontId) ?? [];
  storefrontReportStore.set(input.storefrontId, [reportRecord, ...currentReports]);
  return reportRecord;
}

export async function deleteCommunityContentForProfile(profileId: string) {
  await deleteReviewPhotoUploadsForProfile(profileId);

  const reviewCollectionRef = getAppReviewCollection();
  const reportCollectionRef = getStorefrontReportCollection();

  if (reviewCollectionRef) {
    const reviewSnapshot = await reviewCollectionRef.where('profileId', '==', profileId).get();
    const reviewDeleteResults = await Promise.allSettled(
      reviewSnapshot.docs.map((documentSnapshot) => documentSnapshot.ref.delete()),
    );
    for (const result of reviewDeleteResults) {
      if (result.status === 'rejected') {
        console.warn(
          '[storefrontCommunityService] failed to delete a review during profile cleanup:',
          result.reason,
        );
      }
    }
  } else {
    Array.from(appReviewStore.entries()).forEach(([storefrontId, reviews]) => {
      const nextReviews = reviews.filter((review) => review.profileId !== profileId);
      if (nextReviews.length) {
        appReviewStore.set(storefrontId, nextReviews);
        return;
      }

      appReviewStore.delete(storefrontId);
    });
  }

  if (reportCollectionRef) {
    const reportSnapshot = await reportCollectionRef.where('profileId', '==', profileId).get();
    const reportDeleteResults = await Promise.allSettled(
      reportSnapshot.docs.map((documentSnapshot) => documentSnapshot.ref.delete()),
    );
    for (const result of reportDeleteResults) {
      if (result.status === 'rejected') {
        console.warn(
          '[storefrontCommunityService] failed to delete a report during profile cleanup:',
          result.reason,
        );
      }
    }
  } else {
    Array.from(storefrontReportStore.entries()).forEach(([storefrontId, reports]) => {
      const nextReports = reports.filter((report) => report.profileId !== profileId);
      if (nextReports.length) {
        storefrontReportStore.set(storefrontId, nextReports);
        return;
      }

      storefrontReportStore.delete(storefrontId);
    });
  }
}

export function clearStorefrontCommunityMemoryStateForTests() {
  appReviewStore.clear();
  storefrontReportStore.clear();
  clearStorefrontAppReviewAggregateCache();
}
