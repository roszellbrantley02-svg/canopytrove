/**
 * Product Review Service
 *
 * Members can rate + review products (brand + product name) they've scanned.
 * Reviews aggregate by `productSlug` so different batches of "Storyteller —
 * Blue Dream" roll up to the same page.
 *
 * Distinct from storefront reviews:
 *   - Keyed by productSlug (not storefrontId)
 *   - No GIFs, no owner replies (products don't have owners in our system)
 *   - Effect tags from a fixed vocabulary (relaxed/energetic/sleepy/...)
 *   - Member-only: anonymous and owner-only accounts cannot submit
 *
 * Photo pipeline reuses reviewPhotoModerationService — same upload session
 * flow as storefront review photos, just attached to a different parent.
 */

import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import {
  attachReviewPhotosToReview,
  getApprovedReviewPhotoUrls,
} from './reviewPhotoModerationService';
import { logger } from '../observability/logger';

const PRODUCT_REVIEWS_COLLECTION = 'product_app_reviews';
const PRODUCT_REVIEW_REPORTS_COLLECTION = 'product_review_reports';
const AGGREGATE_TTL_MS = 60_000;
const COMMUNITY_FAVORITES_TTL_MS = 5 * 60_000;
const COMMUNITY_FAVORITES_LIMIT = 25;
const PHOTO_URL_REFRESH_AFTER_MS = 5 * 24 * 60 * 60 * 1000; // refresh signed URLs after 5d

export type ProductReviewEffectTag =
  | 'relaxed'
  | 'energetic'
  | 'sleepy'
  | 'creative'
  | 'focused'
  | 'happy'
  | 'hungry';

export const PRODUCT_REVIEW_EFFECT_TAGS: ProductReviewEffectTag[] = [
  'relaxed',
  'energetic',
  'sleepy',
  'creative',
  'focused',
  'happy',
  'hungry',
];

export type StoredProductReviewRecord = {
  id: string;
  productSlug: string;
  brandName: string;
  productName: string;
  profileId: string;
  accountId: string;
  authorName: string;
  rating: number;
  text: string;
  effectTags: ProductReviewEffectTag[];
  photoCount: number;
  photoIds: string[];
  photoUrls?: string[];
  photoUrlsIssuedAt?: string | null;
  helpfulCount: number;
  helpfulVoterIds: string[];
  createdAt: string;
  updatedAt?: string | null;
};

export type ProductReviewSummary = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  effectTags: ProductReviewEffectTag[];
  photoUrls: string[];
  photoCount: number;
  helpfulCount: number;
  isOwnReview: boolean;
  relativeTime: string;
};

export type ProductReviewSubmissionInput = {
  productSlug: string;
  brandName: string;
  productName: string;
  profileId: string;
  accountId: string;
  authorName: string;
  rating: number;
  text: string;
  effectTags: ProductReviewEffectTag[];
  photoCount: number;
  photoUploadIds: string[];
};

export type ProductReviewSubmissionResult = {
  review: ProductReviewSummary;
  photoModeration: {
    submittedCount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    message: string | null;
  } | null;
};

export type ProductReviewAggregate = {
  productSlug: string;
  brandName: string;
  productName: string;
  reviewCount: number;
  averageRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  topEffectTags: Array<{ tag: ProductReviewEffectTag; count: number }>;
};

export class ProductReviewError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

/* ── Stores ─────────────────────────────────────────────────────────── */

// Fallback in-memory store for environments where Firestore isn't wired
// (tests, local dev). Mirrors the pattern in storefrontCommunityService.
const memoryStore = new Map<string, StoredProductReviewRecord[]>();

let aggregateCache: {
  expiresAt: number;
  value: Map<string, ProductReviewAggregate>;
} | null = null;

let communityFavoritesCache: {
  expiresAt: number;
  value: ProductReviewAggregate[];
} | null = null;

function getCollection() {
  return getOptionalFirestoreCollection<StoredProductReviewRecord>(PRODUCT_REVIEWS_COLLECTION);
}

function getReportCollection() {
  return getOptionalFirestoreCollection(PRODUCT_REVIEW_REPORTS_COLLECTION);
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function toRelativeTime(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 'Recently';
  const deltaMs = Date.now() - created;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes <= 0) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function normalizeRating(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  return Math.max(1, Math.min(5, Math.round(rating)));
}

function normalizeEffectTags(tags: string[]): ProductReviewEffectTag[] {
  const allowed = new Set<string>(PRODUCT_REVIEW_EFFECT_TAGS);
  const seen = new Set<ProductReviewEffectTag>();
  for (const raw of tags) {
    const trimmed = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (allowed.has(trimmed)) {
      seen.add(trimmed as ProductReviewEffectTag);
    }
    if (seen.size >= 4) break;
  }
  return Array.from(seen);
}

function photoUrlsAreFresh(record: StoredProductReviewRecord): boolean {
  const issuedAt = record.photoUrlsIssuedAt
    ? new Date(record.photoUrlsIssuedAt).getTime()
    : new Date(record.createdAt).getTime();
  if (!Number.isFinite(issuedAt)) return false;
  return Date.now() - issuedAt < PHOTO_URL_REFRESH_AFTER_MS;
}

async function resolveReviewPhotoUrls(record: StoredProductReviewRecord): Promise<string[]> {
  const cached = record.photoUrls ?? [];
  if (!record.photoIds || record.photoIds.length === 0) return cached;
  if (photoUrlsAreFresh(record)) return cached;

  try {
    const fresh = await getApprovedReviewPhotoUrls(record.photoIds);
    if (fresh.length > 0) {
      record.photoUrls = fresh;
      record.photoUrlsIssuedAt = new Date().toISOString();
    }
    return fresh.length > 0 ? fresh : cached;
  } catch (error) {
    logger.warn(`[productReviewService] failed to refresh photo URLs for ${record.id}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return cached;
  }
}

async function toSummary(
  record: StoredProductReviewRecord,
  viewerProfileId?: string | null,
): Promise<ProductReviewSummary> {
  const photoUrls = await resolveReviewPhotoUrls(record);
  return {
    id: record.id,
    authorName: record.authorName,
    rating: record.rating,
    text: record.text,
    effectTags: [...record.effectTags],
    photoUrls,
    photoCount: record.photoIds.length,
    helpfulCount: record.helpfulCount,
    isOwnReview: Boolean(viewerProfileId && viewerProfileId === record.profileId),
    relativeTime: toRelativeTime(record.createdAt),
  };
}

function clearCaches() {
  aggregateCache = null;
  communityFavoritesCache = null;
}

export function clearProductReviewAggregateCache() {
  clearCaches();
}

/* ── Submit ─────────────────────────────────────────────────────────── */

export async function submitProductReview(
  input: ProductReviewSubmissionInput,
): Promise<ProductReviewSubmissionResult> {
  const trimmedText = input.text.trim();
  if (trimmedText.length < 10) {
    throw new ProductReviewError('Reviews need at least a couple sentences.', 422);
  }
  if (trimmedText.length > 2000) {
    throw new ProductReviewError('Reviews are limited to 2000 characters.', 422);
  }

  const record: StoredProductReviewRecord = {
    id: createId('product-review'),
    productSlug: input.productSlug,
    brandName: input.brandName.slice(0, 120),
    productName: input.productName.slice(0, 200),
    profileId: input.profileId,
    accountId: input.accountId,
    authorName: input.authorName.slice(0, 60) || 'Canopy Trove member',
    rating: normalizeRating(input.rating),
    text: trimmedText,
    effectTags: normalizeEffectTags(input.effectTags),
    photoCount: 0,
    photoIds: [],
    photoUrls: [],
    photoUrlsIssuedAt: null,
    helpfulCount: 0,
    helpfulVoterIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };

  let photoModeration: ProductReviewSubmissionResult['photoModeration'] = null;

  if (input.photoUploadIds.length > 0) {
    try {
      const attached = await attachReviewPhotosToReview({
        reviewId: record.id,
        storefrontId: `product:${input.productSlug}`,
        profileId: input.profileId,
        photoUploadIds: input.photoUploadIds,
      });
      record.photoIds = attached.photoIds;
      record.photoUrls = attached.photoUrls;
      record.photoUrlsIssuedAt = new Date().toISOString();
      record.photoCount = attached.photoIds.length;
      photoModeration = {
        submittedCount: attached.moderationSummary.submittedCount,
        approvedCount: attached.moderationSummary.approvedCount,
        pendingCount: attached.moderationSummary.pendingCount,
        rejectedCount: attached.moderationSummary.rejectedCount,
        message: attached.moderationSummary.message ?? null,
      };
    } catch (error) {
      logger.warn('[productReviewService] photo attach failed; continuing without photos', {
        error: error instanceof Error ? error.message : String(error),
        reviewId: record.id,
      });
    }
  }

  const collection = getCollection();
  if (collection) {
    try {
      await collection.doc(record.id).set(record);
    } catch (error) {
      logger.error('[productReviewService] firestore write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ProductReviewError('Could not save your review right now.', 500);
    }
  } else {
    const list = memoryStore.get(input.productSlug) ?? [];
    list.push(record);
    memoryStore.set(input.productSlug, list);
  }

  clearCaches();

  return {
    review: await toSummary(record, input.profileId),
    photoModeration,
  };
}

/* ── List + aggregate ───────────────────────────────────────────────── */

async function loadReviewsForSlug(productSlug: string): Promise<StoredProductReviewRecord[]> {
  const collection = getCollection();
  if (collection) {
    try {
      const snapshot = await collection
        .where('productSlug', '==', productSlug)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      return snapshot.docs.map((doc) => doc.data() as StoredProductReviewRecord);
    } catch (error) {
      logger.warn('[productReviewService] failed to read product reviews', {
        productSlug,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  return [...(memoryStore.get(productSlug) ?? [])].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export async function listProductReviews(
  productSlug: string,
  viewerProfileId?: string | null,
): Promise<ProductReviewSummary[]> {
  const records = await loadReviewsForSlug(productSlug);
  return Promise.all(records.map((record) => toSummary(record, viewerProfileId)));
}

function buildAggregate(
  productSlug: string,
  records: StoredProductReviewRecord[],
): ProductReviewAggregate {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const tagCounts = new Map<ProductReviewEffectTag, number>();
  let total = 0;
  let brandName = '';
  let productName = '';

  for (const record of records) {
    const r = normalizeRating(record.rating) as 1 | 2 | 3 | 4 | 5;
    distribution[r] += 1;
    total += r;
    for (const tag of record.effectTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    if (!brandName) brandName = record.brandName;
    if (!productName) productName = record.productName;
  }

  const reviewCount = records.length;
  const averageRating = reviewCount > 0 ? total / reviewCount : 0;
  const topEffectTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    productSlug,
    brandName,
    productName,
    reviewCount,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution: distribution,
    topEffectTags,
  };
}

export async function getProductReviewAggregate(
  productSlug: string,
): Promise<ProductReviewAggregate> {
  const records = await loadReviewsForSlug(productSlug);
  return buildAggregate(productSlug, records);
}

/* ── Community favorites (powers the chart) ────────────────────────── */

async function loadAllRecentReviews(): Promise<StoredProductReviewRecord[]> {
  const collection = getCollection();
  if (collection) {
    try {
      const snapshot = await collection.orderBy('createdAt', 'desc').limit(1000).get();
      return snapshot.docs.map((doc) => doc.data() as StoredProductReviewRecord);
    } catch (error) {
      logger.warn('[productReviewService] failed to read community reviews', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  return Array.from(memoryStore.values()).flat();
}

export async function getCommunityFavoriteProducts(
  limit = COMMUNITY_FAVORITES_LIMIT,
): Promise<ProductReviewAggregate[]> {
  const now = Date.now();
  if (communityFavoritesCache && communityFavoritesCache.expiresAt > now) {
    return communityFavoritesCache.value.slice(0, limit);
  }

  const records = await loadAllRecentReviews();
  const grouped = new Map<string, StoredProductReviewRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.productSlug) ?? [];
    list.push(record);
    grouped.set(record.productSlug, list);
  }

  const aggregates = Array.from(grouped.entries())
    .map(([slug, list]) => buildAggregate(slug, list))
    .filter((agg) => agg.reviewCount >= 1)
    .sort((a, b) => {
      // Rank by Bayesian-ish score: blend average and count so a single
      // 5-star review doesn't outrank a steady 4.6 with 40 reviews.
      const scoreA = a.averageRating * Math.log10(a.reviewCount + 1);
      const scoreB = b.averageRating * Math.log10(b.reviewCount + 1);
      return scoreB - scoreA;
    });

  communityFavoritesCache = {
    expiresAt: now + COMMUNITY_FAVORITES_TTL_MS,
    value: aggregates,
  };

  return aggregates.slice(0, limit);
}

/* ── Member's own reviews ──────────────────────────────────────────── */

export async function listProductReviewsByProfile(
  profileId: string,
): Promise<StoredProductReviewRecord[]> {
  const collection = getCollection();
  if (collection) {
    try {
      const snapshot = await collection
        .where('profileId', '==', profileId)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      return snapshot.docs.map((doc) => doc.data() as StoredProductReviewRecord);
    } catch (error) {
      logger.warn('[productReviewService] failed to read member reviews', {
        profileId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  return Array.from(memoryStore.values())
    .flat()
    .filter((r) => r.profileId === profileId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* ── Helpful vote ───────────────────────────────────────────────────── */

export async function markProductReviewHelpful(
  reviewId: string,
  voterProfileId: string,
): Promise<{ helpfulCount: number; alreadyVoted: boolean }> {
  const collection = getCollection();
  if (collection) {
    const doc = collection.doc(reviewId);
    const snapshot = await doc.get();
    if (!snapshot.exists) {
      throw new ProductReviewError('Review not found.', 404);
    }
    const record = snapshot.data() as StoredProductReviewRecord;
    if (record.helpfulVoterIds.includes(voterProfileId)) {
      return { helpfulCount: record.helpfulCount, alreadyVoted: true };
    }
    const newCount = record.helpfulCount + 1;
    await doc.update({
      helpfulCount: newCount,
      helpfulVoterIds: FieldValue.arrayUnion(voterProfileId),
    });
    return { helpfulCount: newCount, alreadyVoted: false };
  }

  for (const list of memoryStore.values()) {
    const found = list.find((r) => r.id === reviewId);
    if (found) {
      if (found.helpfulVoterIds.includes(voterProfileId)) {
        return { helpfulCount: found.helpfulCount, alreadyVoted: true };
      }
      found.helpfulCount += 1;
      found.helpfulVoterIds.push(voterProfileId);
      return { helpfulCount: found.helpfulCount, alreadyVoted: false };
    }
  }
  throw new ProductReviewError('Review not found.', 404);
}

/* ── Report / flag ─────────────────────────────────────────────────── */

export type ProductReviewReportInput = {
  reviewId: string;
  productSlug: string;
  reporterProfileId: string;
  reporterAccountId: string;
  reason: string;
  description: string;
};

export async function submitProductReviewReport(
  input: ProductReviewReportInput,
): Promise<{ id: string }> {
  const id = createId('product-review-report');
  const record = {
    id,
    reviewId: input.reviewId,
    productSlug: input.productSlug,
    reporterProfileId: input.reporterProfileId,
    reporterAccountId: input.reporterAccountId,
    reason: input.reason.slice(0, 60),
    description: input.description.slice(0, 600),
    createdAt: new Date().toISOString(),
    moderationStatus: 'open' as const,
  };

  const collection = getReportCollection();
  if (collection) {
    try {
      await collection.doc(id).set(record);
    } catch (error) {
      logger.error('[productReviewService] failed to save report', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ProductReviewError('Could not file your report right now.', 500);
    }
  }

  return { id };
}
