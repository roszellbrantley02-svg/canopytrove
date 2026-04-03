import type {
  AppProfile,
  GamificationEventRequest,
  GamificationRewardResult,
  StorefrontProfileState,
  StorefrontReportSubmissionInput,
  StorefrontReportSubmissionResponse,
  StorefrontReviewHelpfulInput,
  StorefrontReviewHelpfulResponse,
  StorefrontReviewSubmissionInput,
  StorefrontReviewSubmissionResponse,
  StorefrontReviewUpdateInput,
} from '../types/storefront';
import {
  clearCachedValue,
  createLeaderboardRankCacheKey,
  createProfileCacheKey,
  createProfileStateCacheKey,
  requestJson,
} from './storefrontBackendHttp';

function requestStorefrontBackendJson<T>(
  pathname: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
) {
  const body =
    init && Object.prototype.hasOwnProperty.call(init, 'body')
      ? JSON.stringify(init.body)
      : undefined;
  const headers = new Headers(init?.headers);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  return requestJson<T>(pathname, {
    ...init,
    headers: body === undefined ? init?.headers : headers,
    body,
  });
}

function clearProfileLinkedCache(profileId: string) {
  clearCachedValue(createProfileCacheKey(profileId));
  clearCachedValue(createProfileStateCacheKey(profileId));
  clearCachedValue('leaderboard:');
  clearCachedValue(createLeaderboardRankCacheKey(profileId));
}

export function seedStorefrontBackendFirestore() {
  clearCachedValue('seed-status');
  clearCachedValue('health');
  return requestStorefrontBackendJson<{
    ok: boolean;
    summaryCount: number;
    detailCount: number;
  }>('/admin/seed-firestore', {
    method: 'POST',
  });
}

export function postStorefrontBackendGamificationEvent(
  profileId: string,
  event: GamificationEventRequest,
) {
  clearProfileLinkedCache(profileId);

  return requestStorefrontBackendJson<GamificationRewardResult>(
    `/gamification/${encodeURIComponent(profileId)}/events`,
    {
      method: 'POST',
      body: event,
    },
  );
}

export function submitStorefrontBackendReview(input: StorefrontReviewSubmissionInput) {
  clearProfileLinkedCache(input.profileId);

  return requestStorefrontBackendJson<StorefrontReviewSubmissionResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews`,
    {
      method: 'POST',
      body: {
        profileId: input.profileId,
        authorName: input.authorName,
        rating: input.rating,
        text: input.text,
        tags: input.tags,
        gifUrl: input.gifUrl ?? null,
        photoCount: input.photoCount ?? 0,
        photoUploadIds: input.photoUploadIds ?? [],
      },
    },
  );
}

export function updateStorefrontBackendReview(input: StorefrontReviewUpdateInput) {
  clearProfileLinkedCache(input.profileId);

  return requestStorefrontBackendJson<StorefrontReviewSubmissionResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/${encodeURIComponent(input.reviewId)}`,
    {
      method: 'PUT',
      body: {
        profileId: input.profileId,
        authorName: input.authorName,
        rating: input.rating,
        text: input.text,
        tags: input.tags,
        gifUrl: input.gifUrl ?? null,
        photoCount: input.photoCount ?? 0,
        photoUploadIds: input.photoUploadIds ?? [],
      },
    },
  );
}

export function submitStorefrontBackendReport(input: StorefrontReportSubmissionInput) {
  clearProfileLinkedCache(input.profileId);

  return requestStorefrontBackendJson<StorefrontReportSubmissionResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reports`,
    {
      method: 'POST',
      body: {
        profileId: input.profileId,
        authorName: input.authorName,
        reason: input.reason,
        description: input.description,
        reportTarget: input.reportTarget ?? 'storefront',
        reportedReviewId: input.reportedReviewId ?? undefined,
        reportedReviewAuthorProfileId: input.reportedReviewAuthorProfileId ?? undefined,
        reportedReviewAuthorName: input.reportedReviewAuthorName ?? undefined,
        reportedReviewExcerpt: input.reportedReviewExcerpt ?? undefined,
      },
    },
  );
}

export function submitStorefrontBackendReviewHelpful(input: StorefrontReviewHelpfulInput) {
  clearCachedValue('leaderboard:');

  return requestStorefrontBackendJson<StorefrontReviewHelpfulResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/${encodeURIComponent(
      input.reviewId,
    )}/helpful`,
    {
      method: 'POST',
      body: {
        profileId: input.profileId,
      },
    },
  );
}

export function saveStorefrontBackendProfileState(profileState: StorefrontProfileState) {
  clearProfileLinkedCache(profileState.profile.id);
  return requestStorefrontBackendJson<StorefrontProfileState>(
    `/profile-state/${encodeURIComponent(profileState.profile.id)}`,
    {
      method: 'PUT',
      body: profileState,
    },
  );
}

export function saveStorefrontBackendProfile(profile: AppProfile) {
  clearProfileLinkedCache(profile.id);
  return requestStorefrontBackendJson<AppProfile>(`/profiles/${encodeURIComponent(profile.id)}`, {
    method: 'PUT',
    body: profile,
  });
}

export function deleteStorefrontBackendProfile(profileId: string) {
  clearProfileLinkedCache(profileId);
  return requestStorefrontBackendJson<{
    ok: boolean;
    profileId: string;
  }>(`/profiles/${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
  });
}

export function syncStorefrontBackendFavoriteDealAlerts(input: {
  profileId: string;
  savedStorefrontIds: string[];
  allowNotifications: boolean;
  devicePushToken?: string | null;
}) {
  clearProfileLinkedCache(input.profileId);

  return requestStorefrontBackendJson<{
    notifications: Array<{
      storefrontId: string;
      storefrontName: string;
      promotionText: string;
    }>;
    deliveryMode: 'backend_push' | 'client_local' | 'none';
    storage: 'memory' | 'firestore';
    state: {
      profileId: string;
      activeDealFingerprintsByStorefrontId: Record<string, string>;
      devicePushToken: string | null;
      updatedAt: string;
    };
  }>(`/profiles/${encodeURIComponent(input.profileId)}/favorite-deal-alerts/sync`, {
    method: 'POST',
    body: {
      savedStorefrontIds: input.savedStorefrontIds,
      allowNotifications: input.allowNotifications,
      devicePushToken: input.devicePushToken ?? undefined,
    },
  });
}
