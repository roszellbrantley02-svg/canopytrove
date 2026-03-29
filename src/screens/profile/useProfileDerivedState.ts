import React from 'react';
import { getMockFirestoreSeedCounts } from '../../services/firestoreSeedService';
import { storefrontSourceMode } from '../../config/storefrontSourceConfig';
import {
  AppProfile,
  GamificationBadgeDefinition,
  StorefrontGamificationState,
} from '../../types/storefront';
import {
  buildBadgeProgressItems,
  getJoinedDays,
  getLevelProgress,
  getProfileDisplayName,
  getProfileInitials,
} from './profileUtils';

type UseProfileDerivedStateArgs = {
  appProfile: AppProfile | null;
  badgeDefinitions: readonly GamificationBadgeDefinition[];
  backendSeedStatus: {
    counts: { summaryCount: number; detailCount: number };
  } | null;
  gamificationState: StorefrontGamificationState;
  levelTitle: string;
  profileId: string;
  rank: number | null;
};

export function useProfileDerivedState({
  appProfile,
  badgeDefinitions,
  backendSeedStatus,
  gamificationState,
  levelTitle,
  profileId,
  rank,
}: UseProfileDerivedStateArgs) {
  const displayName = getProfileDisplayName(appProfile, profileId);
  const profileInitials = getProfileInitials(displayName);
  const earnedBadgeIds = React.useMemo(() => new Set(gamificationState.badges), [gamificationState.badges]);
  const earnedBadges = React.useMemo(
    () => badgeDefinitions.filter((badge) => earnedBadgeIds.has(badge.id)),
    [badgeDefinitions, earnedBadgeIds]
  );
  const featuredBadges = React.useMemo(
    () => [...earnedBadges].sort((a, b) => b.points - a.points).slice(0, 3),
    [earnedBadges]
  );
  const nextBadges = React.useMemo(
    () => buildBadgeProgressItems(badgeDefinitions, earnedBadgeIds, gamificationState).slice(0, 4),
    [badgeDefinitions, earnedBadgeIds, gamificationState]
  );
  const levelProgress = getLevelProgress(gamificationState);
  const fallbackSeedCounts = getMockFirestoreSeedCounts();
  const seedCounts =
    storefrontSourceMode === 'api' && backendSeedStatus ? backendSeedStatus.counts : fallbackSeedCounts;

  return {
    displayName,
    featuredBadges,
    levelProgress,
    levelTitle,
    nextBadges,
    profileInitials,
    rank: rank ?? 0,
    seedCounts,
    joinedDays: getJoinedDays(gamificationState.joinedDate),
    earnedBadges,
  };
}
