import {
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
} from '../types/storefront';
import {
  clearCachedValue,
  createLeaderboardRankCacheKey,
  createProfileCacheKey,
  createProfileStateCacheKey,
  requestJson,
} from './storefrontBackendHttp';

function clearProfileLinkedCache(profileId: string) {
  clearCachedValue(createProfileCacheKey(profileId));
  clearCachedValue(createProfileStateCacheKey(profileId));
  clearCachedValue('leaderboard:');
  clearCachedValue(createLeaderboardRankCacheKey(profileId));
}

export function seedStorefrontBackendFirestore() {
  clearCachedValue('seed-status');
  clearCachedValue('health');
  return requestJson<{
    ok: boolean;
    summaryCount: number;
    detailCount: number;
  }>('/admin/seed-firestore', {
    method: 'POST',
  });
}

export function postStorefrontBackendGamificationEvent(
  profileId: string,
  event: GamificationEventRequest
) {
  clearProfileLinkedCache(profileId);

  return requestJson<GamificationRewardResult>(
    `/gamification/${encodeURIComponent(profileId)}/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
}

export function submitStorefrontBackendReview(input: StorefrontReviewSubmissionInput) {
  clearProfileLinkedCache(input.profileId);

  return requestJson<StorefrontReviewSubmissionResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: input.profileId,
        authorName: input.authorName,
        rating: input.rating,
        text: input.text,
        tags: input.tags,
        gifUrl: input.gifUrl ?? null,
        photoCount: input.photoCount ?? 0,
      }),
    }
  );
}

export function submitStorefrontBackendReport(input: StorefrontReportSubmissionInput) {
  clearProfileLinkedCache(input.profileId);

  return requestJson<StorefrontReportSubmissionResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reports`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: input.profileId,
        authorName: input.authorName,
        reason: input.reason,
        description: input.description,
      }),
    }
  );
}

export function submitStorefrontBackendReviewHelpful(input: StorefrontReviewHelpfulInput) {
  clearCachedValue('leaderboard:');

  return requestJson<StorefrontReviewHelpfulResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/${encodeURIComponent(
      input.reviewId
    )}/helpful`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: input.profileId,
      }),
    }
  );
}

export function saveStorefrontBackendProfileState(profileState: StorefrontProfileState) {
  clearProfileLinkedCache(profileState.profile.id);
  return requestJson<StorefrontProfileState>(
    `/profile-state/${encodeURIComponent(profileState.profile.id)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileState),
    }
  );
}

export function saveStorefrontBackendProfile(profile: AppProfile) {
  clearProfileLinkedCache(profile.id);
  return requestJson<AppProfile>(`/profiles/${encodeURIComponent(profile.id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });
}

export function deleteStorefrontBackendProfile(profileId: string) {
  clearProfileLinkedCache(profileId);
  return requestJson<{
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

  return requestJson<{
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      savedStorefrontIds: input.savedStorefrontIds,
      allowNotifications: input.allowNotifications,
      devicePushToken: input.devicePushToken ?? undefined,
    }),
  });
}
