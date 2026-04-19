import { createContext } from 'react';
import type {
  AppProfile,
  BrowseSortKey,
  Coordinates,
  GamificationBadgeDefinition,
  GamificationRewardResult,
  MarketArea,
  StorefrontGamificationState,
  StorefrontListQuery,
} from '../types/storefront';
import type { CanopyTroveAuthSession } from '../types/identity';

export type StorefrontQueryControllerValue = {
  availableAreas: MarketArea[];
  selectedAreaId: string;
  selectedArea: MarketArea;
  searchQuery: string;
  locationQuery: string;
  locationError: string | null;
  isResolvingLocation: boolean;
  browseSortKey: BrowseSortKey;
  browseHotDealsOnly: boolean;
  deviceLocation: Coordinates | null;
  searchLocation: Coordinates | null;
  activeLocation: Coordinates;
  activeLocationMode: 'search' | 'device' | 'fallback';
  activeLocationLabel: string;
  deviceLocationLabel: string | null;
  storefrontQuery: StorefrontListQuery;
  setSelectedAreaId: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setLocationQuery: (value: string) => void;
  setBrowseSortKey: (value: BrowseSortKey) => void;
  setBrowseHotDealsOnly: (value: boolean) => void;
  setDeviceLocation: (value: Coordinates | null) => void;
  useDeviceLocation: () => Promise<boolean>;
  applyLocationQuery: () => Promise<boolean>;
};

export type StorefrontRouteControllerValue = {
  savedStorefrontIds: string[];
  isSavedStorefront: (storefrontId: string) => boolean;
  toggleSavedStorefront: (storefrontId: string) => void;
};

export type StorefrontProfileControllerValue = {
  appProfile: AppProfile | null;
  authSession: CanopyTroveAuthSession;
  isStartingGuestSession: boolean;
  profileId: string;
  startGuestSession: () => Promise<boolean>;
  signOutSession: () => Promise<boolean>;
  repairProfileForCurrentSession: () => Promise<AppProfile | null>;
  deleteAccount: () => Promise<{ ok: boolean; partial: boolean; message: string }>;
  updateDisplayName: (value: string) => Promise<boolean>;
  clearDisplayName: () => Promise<boolean>;
};

export type StorefrontRewardsControllerValue = {
  badgeDefinitions: readonly GamificationBadgeDefinition[];
  gamificationState: StorefrontGamificationState;
  levelTitle: string;
  lastRewardResult: GamificationRewardResult | null;
  clearLastRewardResult: () => void;
  applyRewardResult: (rewardResult: GamificationRewardResult) => GamificationRewardResult;
  trackRouteStartedReward: (payload: {
    storefrontId: string;
    routeMode: 'preview' | 'verified';
  }) => GamificationRewardResult;
  trackReviewSubmittedReward: (payload: {
    rating: number;
    textLength: number;
    photoCount?: number;
  }) => GamificationRewardResult;
  trackPhotoUploadedReward: () => GamificationRewardResult;
  trackHelpfulVoteReceivedReward: (count?: number) => GamificationRewardResult;
  trackReportSubmittedReward: () => GamificationRewardResult;
  trackFriendInvitedReward: (count?: number) => GamificationRewardResult;
  trackFollowersUpdatedReward: (count: number) => GamificationRewardResult;
};

export type StorefrontControllerContextValue = {
  query: StorefrontQueryControllerValue;
  route: StorefrontRouteControllerValue;
  profile: StorefrontProfileControllerValue;
  rewards: StorefrontRewardsControllerValue;
};

export const StorefrontControllerContext = createContext<StorefrontControllerContextValue | null>(
  null,
);

export function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areScanStatsEqual(
  left: StorefrontGamificationState['scanStats'],
  right: StorefrontGamificationState['scanStats'],
) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.productScanCount === right.productScanCount &&
    left.coaOpenCount === right.coaOpenCount &&
    left.cleanPassCount === right.cleanPassCount &&
    left.highThcScans === right.highThcScans &&
    areStringArraysEqual(left.uniqueBrandIds, right.uniqueBrandIds) &&
    areStringArraysEqual(left.uniqueTerpenes, right.uniqueTerpenes)
  );
}

/**
 * Structural equality for gamification state. Previous implementation used
 * JSON.stringify which is (a) slow when invoked on every render and
 * (b) non-deterministic for objects where key order can differ (old vs new
 * state paths sometimes build objects in different orders, causing spurious
 * diffs that re-broadcast no-op updates).
 *
 * This compares every known field explicitly. Arrays are compared by length
 * and element order — that matches the state machine's contract (ordered
 * history of visits + badges).
 */
export function areGamificationStatesEqual(
  current: StorefrontGamificationState,
  next: StorefrontGamificationState,
) {
  if (current === next) return true;

  return (
    current.profileId === next.profileId &&
    current.totalPoints === next.totalPoints &&
    current.totalReviews === next.totalReviews &&
    current.totalPhotos === next.totalPhotos &&
    current.totalHelpfulVotes === next.totalHelpfulVotes &&
    current.currentStreak === next.currentStreak &&
    current.longestStreak === next.longestStreak &&
    current.lastReviewDate === next.lastReviewDate &&
    current.lastActiveDate === next.lastActiveDate &&
    current.dispensariesVisited === next.dispensariesVisited &&
    current.joinedDate === next.joinedDate &&
    current.level === next.level &&
    current.nextLevelPoints === next.nextLevelPoints &&
    current.reviewsWithPhotos === next.reviewsWithPhotos &&
    current.detailedReviews === next.detailedReviews &&
    current.fiveStarReviews === next.fiveStarReviews &&
    current.oneStarReviews === next.oneStarReviews &&
    current.commentsWritten === next.commentsWritten &&
    current.reportsSubmitted === next.reportsSubmitted &&
    current.friendsInvited === next.friendsInvited &&
    current.followersCount === next.followersCount &&
    current.totalRoutesStarted === next.totalRoutesStarted &&
    areStringArraysEqual(current.visitedStorefrontIds, next.visitedStorefrontIds) &&
    areStringArraysEqual(current.badges, next.badges) &&
    areScanStatsEqual(current.scanStats, next.scanStats)
  );
}
