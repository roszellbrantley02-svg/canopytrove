import { AppReview } from '../types/storefront';

export type StoredLocalAppReviewRecord = {
  id: string;
  storefrontId: string;
  profileId: string;
  authorName: string;
  rating: number;
  text: string;
  gifUrl?: string | null;
  tags: string[];
  photoCount: number;
  createdAt: string;
};

export type StoredLocalReportRecord = {
  id: string;
  storefrontId: string;
  profileId: string;
  authorName: string;
  reason: string;
  description: string;
  createdAt: string;
};

export type StoredHelpfulReviewOverlay = {
  helpfulVoterIds: string[];
};

export type StoredStorefrontCommunityState = {
  appReviewsByStorefrontId: Record<string, StoredLocalAppReviewRecord[]>;
  reportsByStorefrontId: Record<string, StoredLocalReportRecord[]>;
  helpfulReviewsById: Record<string, StoredHelpfulReviewOverlay>;
};

export const EMPTY_STOREFRONT_COMMUNITY_STATE: StoredStorefrontCommunityState = {
  appReviewsByStorefrontId: {},
  reportsByStorefrontId: {},
  helpfulReviewsById: {},
};

export function cloneStorefrontCommunityState(
  state: StoredStorefrontCommunityState
): StoredStorefrontCommunityState {
  return {
    appReviewsByStorefrontId: Object.fromEntries(
      Object.entries(state.appReviewsByStorefrontId).map(([storefrontId, reviews]) => [
        storefrontId,
        reviews.map((review) => ({
          ...review,
          gifUrl: review.gifUrl ?? null,
          tags: [...review.tags],
        })),
      ])
    ),
    reportsByStorefrontId: Object.fromEntries(
      Object.entries(state.reportsByStorefrontId).map(([storefrontId, reports]) => [
        storefrontId,
        reports.map((report) => ({ ...report })),
      ])
    ),
    helpfulReviewsById: Object.fromEntries(
      Object.entries(state.helpfulReviewsById).map(([reviewId, overlay]) => [
        reviewId,
        { helpfulVoterIds: [...overlay.helpfulVoterIds] },
      ])
    ),
  };
}

export function createCommunityLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeCommunityTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6)
    )
  );
}

export function normalizeCommunityRating(rating: number) {
  if (!Number.isFinite(rating)) {
    return 5;
  }

  return Math.max(1, Math.min(5, Math.round(rating)));
}

export function toCommunityRelativeTime(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return 'Recently';
  }

  const deltaMs = Date.now() - createdTime;
  const deltaMinutes = Math.floor(deltaMs / 60_000);
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

export function mapStoredReviewToAppReview(
  review: StoredLocalAppReviewRecord,
  helpfulVotes: StoredHelpfulReviewOverlay | undefined
): AppReview {
  return {
    id: review.id,
    authorName: review.authorName,
    authorProfileId: review.profileId,
    rating: review.rating,
    relativeTime: toCommunityRelativeTime(review.createdAt),
    text: review.text,
    gifUrl: review.gifUrl ?? null,
    tags: [...review.tags],
    helpfulCount: helpfulVotes?.helpfulVoterIds.length ?? 0,
  };
}
