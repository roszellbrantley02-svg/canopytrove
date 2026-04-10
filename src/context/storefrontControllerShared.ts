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

export function areGamificationStatesEqual(
  current: StorefrontGamificationState,
  next: StorefrontGamificationState,
) {
  return JSON.stringify(current) === JSON.stringify(next);
}
