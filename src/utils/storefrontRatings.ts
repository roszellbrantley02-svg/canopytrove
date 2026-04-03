import type { AppReview } from '../types/storefront';

export const MIN_PUBLIC_RATING_COUNT = 10;

const MIN_STAR_RATING = 1;
const MAX_STAR_RATING = 5;

export type StorefrontRatingDisplay = {
  isReady: boolean;
  average: number | null;
  badgeLabel: string;
  countLabel: string;
  helperLabel: string | null;
};

function normalizeReviewCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizePublishedRating(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.max(MIN_STAR_RATING, Math.min(MAX_STAR_RATING, value));
}

function formatRatingCount(value: number) {
  return `${value} rating${value === 1 ? '' : 's'}`;
}

export function calculateAverageRatingFromReviews(appReviews: AppReview[]) {
  if (!appReviews.length) {
    return null;
  }

  const total = appReviews.reduce((sum, review) => sum + review.rating, 0);
  const average = total / appReviews.length;

  if (!Number.isFinite(average) || average <= 0) {
    return null;
  }

  return Math.max(MIN_STAR_RATING, Math.min(MAX_STAR_RATING, average));
}

export function getStorefrontRatingDisplay({
  publishedRating,
  publishedReviewCount,
  appReviewCount,
  appReviews = [],
  threshold = MIN_PUBLIC_RATING_COUNT,
}: {
  publishedRating?: number | null;
  publishedReviewCount?: number | null;
  appReviewCount?: number | null;
  appReviews?: AppReview[];
  threshold?: number;
}): StorefrontRatingDisplay {
  const normalizedThreshold = Math.max(1, Math.floor(threshold));
  const normalizedPublishedCount = normalizeReviewCount(publishedReviewCount);
  const normalizedCommunityCount = Math.max(
    normalizeReviewCount(appReviewCount),
    appReviews.length,
  );
  const publishedAverage = normalizePublishedRating(publishedRating);
  const communityAverage = calculateAverageRatingFromReviews(appReviews);

  if (normalizedCommunityCount >= normalizedThreshold && communityAverage !== null) {
    return {
      isReady: true,
      average: communityAverage,
      badgeLabel: communityAverage.toFixed(1),
      countLabel: formatRatingCount(normalizedCommunityCount),
      helperLabel: null,
    };
  }

  if (normalizedPublishedCount >= normalizedThreshold && publishedAverage !== null) {
    return {
      isReady: true,
      average: publishedAverage,
      badgeLabel: publishedAverage.toFixed(1),
      countLabel: formatRatingCount(normalizedPublishedCount),
      helperLabel: null,
    };
  }

  const waitingCount = Math.max(normalizedCommunityCount, normalizedPublishedCount);

  return {
    isReady: false,
    average: null,
    badgeLabel: 'Rating Pending',
    countLabel: `${Math.min(waitingCount, normalizedThreshold)} / ${normalizedThreshold} ratings`,
    helperLabel: 'Needs more ratings before a score is shown.',
  };
}
