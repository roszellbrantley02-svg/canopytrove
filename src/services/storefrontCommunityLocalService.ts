import type {
  StorefrontDetails,
  StorefrontReportSubmissionInput,
  StorefrontReviewHelpfulInput,
  StorefrontReviewSubmissionInput,
  StorefrontReviewUpdateInput,
} from '../types/storefront';
import {
  getCachedStorefrontCommunityState,
  loadStorefrontCommunityState,
  primeStoredStorefrontCommunityState,
  saveStorefrontCommunityState,
} from './storefrontCommunityLocalState';
import { getCachedAppProfile } from './appProfileService';
import {
  createCommunityLocalId,
  mapStoredReviewToAppReview,
  normalizeCommunityRating,
  normalizeCommunityTags,
  cloneStorefrontCommunityState,
} from './storefrontCommunityLocalShared';

export {
  getCachedStorefrontCommunityState,
  loadStorefrontCommunityState,
  primeStoredStorefrontCommunityState,
};

export async function mergeLocalStorefrontCommunityIntoDetail(
  detail: StorefrontDetails,
): Promise<StorefrontDetails> {
  const communityState = await loadStorefrontCommunityState();
  const localReviews = communityState.appReviewsByStorefrontId[detail.storefrontId] ?? [];
  const currentProfileId = getCachedAppProfile()?.id ?? null;

  const mergedLocalReviews = localReviews.map((review) =>
    mapStoredReviewToAppReview(
      review,
      communityState.helpfulReviewsById[review.id],
      currentProfileId,
    ),
  );

  const mergedBaseReviews = detail.appReviews.map((review) => ({
    ...review,
    tags: [...review.tags],
    helpfulCount:
      review.helpfulCount +
      (communityState.helpfulReviewsById[review.id]?.helpfulVoterIds.length ?? 0),
  }));

  const mergedReviews = [...mergedLocalReviews, ...mergedBaseReviews];

  return {
    ...detail,
    appReviewCount: mergedReviews.length,
    appReviews: mergedReviews,
  };
}

export async function addLocalStorefrontReview(input: StorefrontReviewSubmissionInput) {
  const state = cloneStorefrontCommunityState(await loadStorefrontCommunityState());
  const currentReviews = state.appReviewsByStorefrontId[input.storefrontId] ?? [];
  if (currentReviews.some((review) => review.profileId === input.profileId)) {
    throw new Error(
      'You already reviewed this storefront. Edit your existing review instead of posting a second one.',
    );
  }

  const nextReview = {
    id: createCommunityLocalId('local-review'),
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    authorName: input.authorName.trim() || 'Canopy Trove user',
    rating: normalizeCommunityRating(input.rating),
    text: input.text.trim(),
    gifUrl: input.gifUrl?.trim() || null,
    photoUrls: [],
    tags: normalizeCommunityTags(input.tags),
    photoCount: Math.max(0, Math.floor(input.photoCount ?? input.photoUploadIds?.length ?? 0)),
    photoUploadIds: input.photoUploadIds ? [...input.photoUploadIds] : undefined,
    createdAt: new Date().toISOString(),
  };

  state.appReviewsByStorefrontId[input.storefrontId] = [nextReview, ...currentReviews];
  await saveStorefrontCommunityState(state);
  return nextReview.id;
}

export async function updateLocalStorefrontReview(input: StorefrontReviewUpdateInput) {
  const state = cloneStorefrontCommunityState(await loadStorefrontCommunityState());
  const currentReviews = state.appReviewsByStorefrontId[input.storefrontId] ?? [];
  const reviewIndex = currentReviews.findIndex((review) => review.id === input.reviewId);
  if (reviewIndex < 0) {
    throw new Error('Review not found.');
  }

  const existingReview = currentReviews[reviewIndex];
  if (existingReview.profileId !== input.profileId) {
    throw new Error('Only the author can edit this review.');
  }

  const nextReview = {
    ...existingReview,
    authorName: input.authorName.trim() || existingReview.authorName,
    rating: normalizeCommunityRating(input.rating),
    text: input.text.trim(),
    gifUrl: input.gifUrl?.trim() || null,
    tags: normalizeCommunityTags(input.tags),
  };

  const nextReviews = currentReviews.slice();
  nextReviews[reviewIndex] = nextReview;
  state.appReviewsByStorefrontId[input.storefrontId] = nextReviews;
  await saveStorefrontCommunityState(state);
  return nextReview.id;
}

export async function addLocalStorefrontReport(input: StorefrontReportSubmissionInput) {
  const state = cloneStorefrontCommunityState(await loadStorefrontCommunityState());
  const nextReport = {
    id: createCommunityLocalId('local-report'),
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    authorName: input.authorName.trim() || 'Canopy Trove user',
    reason: input.reason.trim(),
    description: input.description.trim(),
    reportTarget: input.reportTarget ?? 'storefront',
    reportedReviewId: input.reportedReviewId?.trim() || undefined,
    reportedReviewAuthorProfileId: input.reportedReviewAuthorProfileId?.trim() || null,
    reportedReviewAuthorName: input.reportedReviewAuthorName?.trim() || null,
    reportedReviewExcerpt: input.reportedReviewExcerpt?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  const currentReports = state.reportsByStorefrontId[input.storefrontId] ?? [];
  state.reportsByStorefrontId[input.storefrontId] = [nextReport, ...currentReports];
  await saveStorefrontCommunityState(state);
}

export async function markLocalStorefrontReviewHelpful(input: StorefrontReviewHelpfulInput) {
  const state = cloneStorefrontCommunityState(await loadStorefrontCommunityState());
  const currentOverlay = state.helpfulReviewsById[input.reviewId] ?? {
    helpfulVoterIds: [],
  };

  if (input.isOwnReview) {
    return {
      didApply: false,
    };
  }

  if (currentOverlay.helpfulVoterIds.includes(input.profileId)) {
    return {
      didApply: false,
    };
  }

  state.helpfulReviewsById[input.reviewId] = {
    helpfulVoterIds: [...currentOverlay.helpfulVoterIds, input.profileId],
  };
  await saveStorefrontCommunityState(state);

  return {
    didApply: true,
  };
}
