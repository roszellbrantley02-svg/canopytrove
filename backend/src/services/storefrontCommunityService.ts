import { CollectionReference } from 'firebase-admin/firestore';
import { getBackendFirebaseDb } from '../firebase';
import { backendStorefrontSourceStatus } from '../sources';
import {
  AppReview,
  StorefrontReviewHelpfulInput,
  StorefrontReportSubmissionInput,
  StorefrontReviewSubmissionInput,
} from '../../../src/types/storefront';

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

export type StoredStorefrontReportRecord = {
  id: string;
  storefrontId: string;
  profileId: string;
  authorName: string;
  reason: string;
  description: string;
  createdAt: string;
  moderationStatus?: 'open' | 'reviewed' | 'dismissed';
  reviewedAt?: string | null;
  reviewNotes?: string | null;
};

const APP_REVIEWS_COLLECTION = 'storefront_app_reviews';
const STOREFRONT_REPORTS_COLLECTION = 'storefront_reports';

const appReviewStore = new Map<string, StoredAppReviewRecord[]>();
const storefrontReportStore = new Map<string, StoredStorefrontReportRecord[]>();

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    | undefined
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

function mapStoredReviewToAppReview(review: StoredAppReviewRecord): AppReview {
  return {
    id: review.id,
    authorName: review.authorName,
    authorProfileId: review.profileId,
    rating: review.rating,
    relativeTime: toRelativeTime(review.createdAt),
    text: review.text,
    gifUrl: review.gifUrl ?? null,
    tags: [...review.tags],
    helpfulCount: review.helpfulCount,
    ownerReply: normalizeOwnerReply(review.ownerReply),
  };
}

function getAppReviewCollection() {
  const db = getBackendFirebaseDb();
  if (!db || backendStorefrontSourceStatus.activeMode !== 'firestore') {
    return null;
  }

  return db.collection(APP_REVIEWS_COLLECTION) as CollectionReference<StoredAppReviewRecord>;
}

function getStorefrontReportCollection() {
  const db = getBackendFirebaseDb();
  if (!db || backendStorefrontSourceStatus.activeMode !== 'firestore') {
    return null;
  }

  return db.collection(STOREFRONT_REPORTS_COLLECTION) as CollectionReference<StoredStorefrontReportRecord>;
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6)
    )
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
    helpfulVoterIds: normalizeHelpfulVoterIds(review.helpfulVoterIds),
    ownerReply: normalizeOwnerReply(review.ownerReply),
  };
}

function normalizeStoredReportRecord(
  report: StoredStorefrontReportRecord
): StoredStorefrontReportRecord {
  return {
    ...report,
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

export async function listStorefrontAppReviews(storefrontId: string) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('storefrontId', '==', storefrontId).get();
    return snapshot.docs
      .map((documentSnapshot) => normalizeStoredReviewRecord(documentSnapshot.data() as StoredAppReviewRecord))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(mapStoredReviewToAppReview);
  }

  return (appReviewStore.get(storefrontId) ?? [])
    .slice()
    .map(normalizeStoredReviewRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(mapStoredReviewToAppReview);
}

export async function listStorefrontReports(storefrontId: string) {
  const collectionRef = getStorefrontReportCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('storefrontId', '==', storefrontId).get();
    return snapshot.docs
      .map((documentSnapshot) =>
        normalizeStoredReportRecord(documentSnapshot.data() as StoredStorefrontReportRecord)
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  return (storefrontReportStore.get(storefrontId) ?? [])
    .slice()
    .map(normalizeStoredReportRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function submitStorefrontAppReview(input: StorefrontReviewSubmissionInput) {
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
    helpfulCount: 0,
    helpfulVoterIds: [],
    createdAt: new Date().toISOString(),
    ownerReply: null,
  };

  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    await collectionRef.doc(reviewRecord.id).set(reviewRecord);
    return mapStoredReviewToAppReview(reviewRecord);
  }

  const currentReviews = appReviewStore.get(input.storefrontId) ?? [];
  appReviewStore.set(input.storefrontId, [reviewRecord, ...currentReviews]);
  return mapStoredReviewToAppReview(reviewRecord);
}

export async function markStorefrontAppReviewHelpful(input: StorefrontReviewHelpfulInput) {
  const collectionRef = getAppReviewCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(input.reviewId).get();
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

    if (record.profileId === input.profileId || record.helpfulVoterIds.includes(input.profileId)) {
      return {
        didApply: false,
        reviewAuthorProfileId: record.profileId,
      };
    }

    const nextRecord: StoredAppReviewRecord = {
      ...record,
      helpfulCount: record.helpfulCount + 1,
      helpfulVoterIds: [...record.helpfulVoterIds, input.profileId],
    };
    await collectionRef.doc(input.reviewId).set(nextRecord);

    return {
      didApply: true,
      reviewAuthorProfileId: record.profileId,
    };
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
  const reportRecord: StoredStorefrontReportRecord = {
    id: createId('report'),
    storefrontId: input.storefrontId,
    profileId: input.profileId,
      authorName: input.authorName.trim() || 'Canopy Trove user',
    reason: input.reason.trim(),
    description: input.description.trim(),
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
  const reviewCollectionRef = getAppReviewCollection();
  const reportCollectionRef = getStorefrontReportCollection();

  if (reviewCollectionRef) {
    const reviewSnapshot = await reviewCollectionRef.where('profileId', '==', profileId).get();
    await Promise.all(reviewSnapshot.docs.map((documentSnapshot) => documentSnapshot.ref.delete()));
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
    await Promise.all(reportSnapshot.docs.map((documentSnapshot) => documentSnapshot.ref.delete()));
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
