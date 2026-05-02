import type React from 'react';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import type { AppProfile, StorefrontGamificationState } from '../types/storefront';
import type { CanopyTroveAuthSession } from '../types/identity';
import { normalizeGamificationState } from '../services/canopyTroveGamificationService';

export type UseStorefrontRemoteProfileSyncArgs = {
  appProfile: AppProfile | null;
  authSession: CanopyTroveAuthSession;
  hasHydratedPreferences: boolean;
  profileId: string;
  recentStorefrontIds: string[];
  savedStorefrontIds: string[];
  gamificationState: StorefrontGamificationState;
  gamificationStateRef: React.MutableRefObject<StorefrontGamificationState>;
  lastLocalRouteMutationAtRef: React.MutableRefObject<number>;
  lastLocalGamificationMutationAtRef: React.MutableRefObject<number>;
  setAppProfile: React.Dispatch<React.SetStateAction<AppProfile | null>>;
  setProfileId: React.Dispatch<React.SetStateAction<string>>;
  setRecentStorefrontIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSavedStorefrontIds: React.Dispatch<React.SetStateAction<string[]>>;
  setGamificationState: React.Dispatch<React.SetStateAction<StorefrontGamificationState>>;
};

export function getShouldSyncRemoteProfileState(_authSession: CanopyTroveAuthSession) {
  // Previously this gate required `authSession.status === 'authenticated'`,
  // which meant anonymous users' saves (savedStorefrontIds) lived only in
  // AsyncStorage on device and never reached the backend. As a result the
  // backend `route_state` collection was empty platform-wide, owners saw
  // 0 followers in their portal even when real saves existed, and the
  // public storefront detail page also showed 0. Anonymous users already
  // have a stable install-id-based profileId (same one used for product
  // scans), so their save state can persist remotely under that id and
  // migrate cleanly to an authenticated profile id on signup via the
  // existing canonical-profile resolver. Drop the auth gate so saves
  // sync for everyone in api mode.
  return storefrontSourceMode === 'api';
}

export function createFallbackRemoteProfile(profileId: string) {
  const now = new Date().toISOString();
  return {
    id: profileId,
    kind: 'anonymous' as const,
    accountId: null,
    displayName: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeRemoteProfileState({
  appProfile,
  profileId,
  savedStorefrontIds,
  recentStorefrontIds,
  gamificationState,
}: {
  appProfile: AppProfile | null;
  profileId: string;
  savedStorefrontIds: string[];
  recentStorefrontIds: string[];
  gamificationState: StorefrontGamificationState;
}) {
  return JSON.stringify({
    profile: appProfile ?? createFallbackRemoteProfile(profileId),
    routeState: {
      profileId,
      savedStorefrontIds,
      recentStorefrontIds,
    },
    gamificationState,
  });
}

export function normalizeRemoteGamificationState({
  profileId,
  remoteGamificationState,
  remoteCreatedAt,
  localCreatedAt,
}: {
  profileId: string;
  remoteGamificationState: StorefrontGamificationState | undefined;
  remoteCreatedAt?: string | null;
  localCreatedAt?: string | null;
}) {
  return normalizeGamificationState(
    profileId,
    remoteGamificationState,
    remoteCreatedAt ?? localCreatedAt,
  );
}

export function areProfilesEquivalent(
  current: AppProfile | null | undefined,
  next: AppProfile | null | undefined,
) {
  return (
    (current?.id ?? null) === (next?.id ?? null) &&
    (current?.kind ?? null) === (next?.kind ?? null) &&
    (current?.accountId ?? null) === (next?.accountId ?? null) &&
    (current?.displayName ?? null) === (next?.displayName ?? null) &&
    (current?.createdAt ?? null) === (next?.createdAt ?? null) &&
    (current?.updatedAt ?? null) === (next?.updatedAt ?? null)
  );
}

export function mergeOrderedStringIds(primary: string[], secondary: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];

  primary.forEach((value) => {
    if (seen.has(value)) {
      return;
    }

    seen.add(value);
    merged.push(value);
  });

  secondary.forEach((value) => {
    if (seen.has(value)) {
      return;
    }

    seen.add(value);
    merged.push(value);
  });

  return merged;
}

function getMaxNumber(...values: number[]) {
  return Math.max(...values);
}

function getLaterIsoDate(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left >= right ? left : right;
}

function getEarlierIsoDate(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left <= right ? left : right;
}

export function mergeRemoteGamificationState({
  profileId,
  remoteGamificationState,
  localGamificationState,
  remoteCreatedAt,
  localCreatedAt,
}: {
  profileId: string;
  remoteGamificationState: StorefrontGamificationState;
  localGamificationState: StorefrontGamificationState;
  remoteCreatedAt?: string | null;
  localCreatedAt?: string | null;
}) {
  const remoteState = normalizeRemoteGamificationState({
    profileId,
    remoteGamificationState,
    remoteCreatedAt,
    localCreatedAt,
  });
  const localState = normalizeGamificationState(
    profileId,
    localGamificationState,
    localCreatedAt ?? remoteCreatedAt,
  );
  const mergedVisitedStorefrontIds = mergeOrderedStringIds(
    localState.visitedStorefrontIds,
    remoteState.visitedStorefrontIds,
  );
  const mergedBadges = mergeOrderedStringIds(localState.badges, remoteState.badges);

  return normalizeGamificationState(
    profileId,
    {
      totalPoints: getMaxNumber(localState.totalPoints, remoteState.totalPoints),
      totalReviews: getMaxNumber(localState.totalReviews, remoteState.totalReviews),
      totalPhotos: getMaxNumber(localState.totalPhotos, remoteState.totalPhotos),
      totalHelpfulVotes: getMaxNumber(localState.totalHelpfulVotes, remoteState.totalHelpfulVotes),
      currentStreak: getMaxNumber(localState.currentStreak, remoteState.currentStreak),
      longestStreak: getMaxNumber(localState.longestStreak, remoteState.longestStreak),
      lastReviewDate: getLaterIsoDate(localState.lastReviewDate, remoteState.lastReviewDate),
      lastActiveDate: getLaterIsoDate(localState.lastActiveDate, remoteState.lastActiveDate),
      dispensariesVisited: getMaxNumber(
        localState.dispensariesVisited,
        remoteState.dispensariesVisited,
        mergedVisitedStorefrontIds.length,
      ),
      visitedStorefrontIds: mergedVisitedStorefrontIds,
      badges: mergedBadges,
      joinedDate:
        getEarlierIsoDate(localState.joinedDate, remoteState.joinedDate) ?? localState.joinedDate,
      reviewsWithPhotos: getMaxNumber(localState.reviewsWithPhotos, remoteState.reviewsWithPhotos),
      detailedReviews: getMaxNumber(localState.detailedReviews, remoteState.detailedReviews),
      fiveStarReviews: getMaxNumber(localState.fiveStarReviews, remoteState.fiveStarReviews),
      oneStarReviews: getMaxNumber(localState.oneStarReviews, remoteState.oneStarReviews),
      commentsWritten: getMaxNumber(localState.commentsWritten, remoteState.commentsWritten),
      reportsSubmitted: getMaxNumber(localState.reportsSubmitted, remoteState.reportsSubmitted),
      friendsInvited: getMaxNumber(localState.friendsInvited, remoteState.friendsInvited),
      followersCount: getMaxNumber(localState.followersCount, remoteState.followersCount),
      totalRoutesStarted: getMaxNumber(
        localState.totalRoutesStarted,
        remoteState.totalRoutesStarted,
      ),
    },
    getEarlierIsoDate(
      localCreatedAt ?? localState.joinedDate,
      remoteCreatedAt ?? remoteState.joinedDate,
    ) ?? undefined,
  );
}
