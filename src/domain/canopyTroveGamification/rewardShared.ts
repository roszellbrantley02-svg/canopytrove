import {
  GamificationActivityType,
  GamificationBadgeDefinition,
  GamificationRewardResult,
  StorefrontGamificationState,
} from '../../types/storefront';
import { CANOPYTROVE_BADGES, CANOPYTROVE_POINTS } from './definitions';
import {
  getLevelFromPoints,
  getPointsForLevel,
  normalizeGamificationState,
} from './state';

type ActivityStreakState = Pick<
  StorefrontGamificationState,
  'currentStreak' | 'longestStreak' | 'lastActiveDate'
>;

export function getCurrentIsoDate() {
  return new Date().toISOString();
}

function calculateDaysSince(dateValue: string | null, occurredAt: string) {
  if (!dateValue) {
    return Number.POSITIVE_INFINITY;
  }

  const baseDate = new Date(dateValue);
  const nextDate = new Date(occurredAt);
  if (Number.isNaN(baseDate.getTime()) || Number.isNaN(nextDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime();
  const next = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()).getTime();
  return Math.floor((next - base) / 86400000);
}

function applyActivityStreak(
  state: StorefrontGamificationState,
  occurredAt: string
): ActivityStreakState {
  const daysSinceActive = calculateDaysSince(state.lastActiveDate, occurredAt);

  if (daysSinceActive === 0) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: state.lastActiveDate ?? occurredAt,
    };
  }

  if (daysSinceActive === 1) {
    const currentStreak = state.currentStreak + 1;
    return {
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastActiveDate: occurredAt,
    };
  }

  return {
    currentStreak: 1,
    longestStreak: Math.max(state.longestStreak, 1),
    lastActiveDate: occurredAt,
  };
}

function addPoints(
  state: StorefrontGamificationState,
  points: number
) {
  const totalPoints = state.totalPoints + points;
  const level = getLevelFromPoints(totalPoints);

  return {
    ...state,
    totalPoints,
    level,
    nextLevelPoints: getPointsForLevel(level + 1),
  };
}

function getEarnedBadgeMetric(state: StorefrontGamificationState, badge: GamificationBadgeDefinition) {
  switch (badge.id) {
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
    case 'streak_7':
    case 'streak_30':
      return state.currentStreak;
    case 'member_30':
    case 'member_365':
      return Math.max(0, Math.floor((Date.now() - new Date(state.joinedDate).getTime()) / 86400000));
    case 'ambassador':
      return state.friendsInvited;
    case 'followed_10':
      return state.followersCount;
    case 'verified_user':
    case 'early_adopter':
      return state.badges.includes(badge.id) ? 1 : 0;
    default:
      if (badge.category === 'review') return state.totalReviews;
      if (badge.category === 'photo') return state.totalPhotos;
      if (badge.category === 'explorer') return state.dispensariesVisited;
      if (badge.category === 'social') return state.totalHelpfulVotes;
      return 0;
  }
}

function collectNewBadges(state: StorefrontGamificationState) {
  return CANOPYTROVE_BADGES.filter((badge) => {
    if (state.badges.includes(badge.id)) {
      return false;
    }

    if (!badge.requirement || badge.requirement <= 0) {
      return badge.id === 'early_adopter';
    }

    return getEarnedBadgeMetric(state, badge) >= badge.requirement;
  });
}

function awardBadges(
  state: StorefrontGamificationState,
  badges: GamificationBadgeDefinition[]
) {
  if (!badges.length) {
    return state;
  }

  const badgePoints = badges.reduce((sum, badge) => sum + badge.points, 0);
  return addPoints(
    {
      ...state,
      badges: state.badges.concat(badges.map((badge) => badge.id)),
    },
    badgePoints
  );
}

export function finalizeReward(
  state: StorefrontGamificationState,
  activityType: GamificationActivityType,
  occurredAt: string,
  pointsEarned: number,
  updates: Partial<StorefrontGamificationState>
): GamificationRewardResult {
  const levelBefore = state.level;

  let nextState = normalizeGamificationState(
    state.profileId,
    {
      ...state,
      ...applyActivityStreak(state, occurredAt),
      ...updates,
    },
    state.joinedDate
  );

  nextState = addPoints(nextState, pointsEarned);
  const badgesEarned = collectNewBadges(nextState);
  nextState = awardBadges(nextState, badgesEarned);

  return {
    activityType,
    pointsEarned: pointsEarned + badgesEarned.reduce((sum, badge) => sum + badge.points, 0),
    badgesEarned,
    levelBefore,
    levelAfter: nextState.level,
    updatedState: nextState,
  };
}

export function getReviewSubmittedPoints(textLength: number, photoCount: number) {
  let pointsEarned = CANOPYTROVE_POINTS.review_submit;

  if (textLength >= 100) {
    pointsEarned += CANOPYTROVE_POINTS.review_detailed;
  }

  if (photoCount > 0) {
    pointsEarned += CANOPYTROVE_POINTS.review_with_photo;
  }

  return pointsEarned;
}

export function getHelpfulVotePoints(count: number) {
  return CANOPYTROVE_POINTS.review_helpful * count;
}

export function getFriendInvitePoints(count: number) {
  return CANOPYTROVE_POINTS.friend_invited * count;
}

export function getFollowerPoints(gainedFollowers: number) {
  return gainedFollowers * CANOPYTROVE_POINTS.follow_received;
}
