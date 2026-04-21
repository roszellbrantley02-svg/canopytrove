import type {
  AppProfile,
  GamificationBadgeDefinition,
  StorefrontGamificationState,
} from '../../types/storefront';
import { getPointsForLevel } from '../../services/canopyTroveGamificationService';
import { getProfileFallbackName, getSafePublicDisplayName } from '../../utils/publicIdentity';

export type BadgeProgressItem = {
  badge: GamificationBadgeDefinition;
  value: number;
  progress: number;
  label: string;
};

/**
 * Resolve the display name shown in the UI.
 *
 * Priority:
 *   1. Explicit display name / username the user chose
 *   2. Fallback label using the last 6 chars of the profile ID
 *
 * The same logic applies everywhere (profile screen, leaderboard,
 * community) — members are never shown as "anonymous", and email
 * addresses are never used as public identity.
 */
export function getProfileDisplayName(appProfile: AppProfile | null, profileId: string) {
  return getSafePublicDisplayName(appProfile?.displayName, getProfileFallbackName(profileId));
}

/**
 * Resolve the name shown on the leaderboard / community views
 * using only the data present in the leaderboard entry.
 */
export function getPublicDisplayName(displayName: string | null | undefined, profileId: string) {
  return getSafePublicDisplayName(displayName, getProfileFallbackName(profileId));
}

export function getProfileInitials(label: string) {
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'G'
  );
}

export function getJoinedDays(joinedDate: string) {
  const joinedTime = new Date(joinedDate).getTime();
  return Number.isFinite(joinedTime)
    ? Math.max(0, Math.floor((Date.now() - joinedTime) / 86400000))
    : 0;
}

export function getLevelProgress(state: StorefrontGamificationState) {
  const currentLevelFloor = getPointsForLevel(Math.max(1, state.level));
  const nextLevelPoints = Math.max(currentLevelFloor, state.nextLevelPoints);
  const progress = Math.min(
    1,
    Math.max(0, state.totalPoints - currentLevelFloor) /
      Math.max(1, nextLevelPoints - currentLevelFloor),
  );
  return { progress, pointsToNext: Math.max(0, nextLevelPoints - state.totalPoints) };
}

function getBadgeMetricValue(
  badge: GamificationBadgeDefinition,
  state: StorefrontGamificationState,
) {
  switch (badge.id) {
    case 'reviewer_1':
    case 'reviewer_5':
    case 'reviewer_25':
    case 'reviewer_100':
      return state.totalReviews;
    case 'five_star_reviewer':
      return state.fiveStarReviews;
    case 'detailed_reviewer':
      return state.detailedReviews;
    case 'helpful_reviewer':
    case 'helpful_25':
      return state.totalHelpfulVotes;
    case 'photographer_1':
    case 'photographer_10':
    case 'photographer_50':
      return state.totalPhotos;
    case 'visitor_1':
    case 'visitor_10':
    case 'local_explorer':
    case 'dispensary_master':
      return state.dispensariesVisited;
    case 'streak_7':
    case 'streak_30':
      return state.currentStreak;
    case 'member_30':
    case 'member_365':
      return getJoinedDays(state.joinedDate);
    case 'followed_10':
      return state.followersCount;
    case 'ambassador':
      return state.friendsInvited;
    default:
      return badge.requirement > 0 ? 0 : null;
  }
}

export function buildBadgeProgressItems(
  badgeDefinitions: readonly GamificationBadgeDefinition[],
  earnedBadgeIds: Set<string>,
  state: StorefrontGamificationState,
) {
  return badgeDefinitions
    .filter((badge) => !earnedBadgeIds.has(badge.id) && badge.requirement > 0)
    .map<BadgeProgressItem | null>((badge) => {
      const value = getBadgeMetricValue(badge, state);
      if (value === null) {
        return null;
      }

      return {
        badge,
        value,
        progress: Math.min(1, value / Math.max(1, badge.requirement)),
        label: `${Math.min(value, badge.requirement)}/${badge.requirement}`,
      };
    })
    .filter((item): item is BadgeProgressItem => item !== null)
    .sort((a, b) =>
      b.progress !== a.progress
        ? b.progress - a.progress
        : a.badge.requirement - b.badge.requirement,
    );
}
