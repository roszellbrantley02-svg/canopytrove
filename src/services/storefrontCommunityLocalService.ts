import {
  StorefrontDetails,
  StorefrontReportSubmissionInput,
  StorefrontReviewHelpfulInput,
  StorefrontReviewSubmissionInput,
} from '../types/storefront';
import {
  getCachedStorefrontCommunityState,
  loadStorefrontCommunityState,
  primeStoredStorefrontCommunityState,
  saveStorefrontCommunityState,
} from './storefrontCommunityLocalState';
import {
  createCommunityLocalId,
  mapStoredReviewToAppReview,
  normalizeCommunityRating,
  normalizeCommunityTags,
  cloneStorefrontCommunityState,
} from './storefrontCommunityLocalShared';

export { getCachedStorefrontCommunityState, loadStorefrontCommunityState, primeStoredStorefrontCommunityState };

export async function mergeLocalStorefrontCommunityIntoDetail(
  detail: StorefrontDetails
): Promise<StorefrontDetails> {
  const communityState = await loadStorefrontCommunityState();
  const localReviews = communityState.appReviewsByStorefrontId[detail.storefrontId] ?? [];

  const mergedLocalReviews = localReviews.map((review) =>
    mapStoredReviewToAppReview(review, communityState.helpfulReviewsById[review.id])
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
  const nextReview = {
    id: createCommunityLocalId('local-review'),
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    authorName: input.authorName.trim() || 'Canopy Trove user',
    rating: normalizeCommunityRating(input.rating),
    text: input.text.trim(),
    gifUrl: input.gifUrl?.trim() || null,
    tags: normalizeCommunityTags(input.tags),
    photoCount: Math.max(0, Math.floor(input.photoCount ?? 0)),
    createdAt: new Date().toISOString(),
  };

  const currentReviews = state.appReviewsByStorefrontId[input.storefrontId] ?? [];
  state.appReviewsByStorefrontId[input.storefrontId] = [nextReview, ...currentReviews];
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
    createdAt: new Date().toISOString(),
  };

  const currentReports = state.reportsByStorefrontId[input.storefrontId] ?? [];
  state.reportsByStorefrontId[input.storefrontId] = [nextReport, ...currentReports];
  await saveStorefrontCommunityState(state);
}

export async function markLocalStorefrontReviewHelpful(
  input: StorefrontReviewHelpfulInput & { reviewAuthorProfileId?: string | null }
) {
  const state = cloneStorefrontCommunityState(await loadStorefrontCommunityState());
  const currentOverlay = state.helpfulReviewsById[input.reviewId] ?? {
    helpfulVoterIds: [],
  };

  if (input.reviewAuthorProfileId && input.reviewAuthorProfileId === input.profileId) {
    return {
      didApply: false,
      reviewAuthorProfileId: input.reviewAuthorProfileId,
    };
  }

  if (currentOverlay.helpfulVoterIds.includes(input.profileId)) {
    return {
      didApply: false,
      reviewAuthorProfileId: input.reviewAuthorProfileId ?? null,
    };
  }

  state.helpfulReviewsById[input.reviewId] = {
    helpfulVoterIds: [...currentOverlay.helpfulVoterIds, input.profileId],
  };
  await saveStorefrontCommunityState(state);

  return {
    didApply: true,
    reviewAuthorProfileId: input.reviewAuthorProfileId ?? null,
  };
}
