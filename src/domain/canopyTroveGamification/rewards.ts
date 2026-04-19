import type { GamificationRewardResult, StorefrontGamificationState } from '../../types/storefront';
import { CANOPYTROVE_BADGES, CANOPYTROVE_POINTS } from './definitions';
import { normalizeGamificationState } from './state';
import {
  finalizeReward,
  getCurrentIsoDate,
  getFollowerPoints,
  getFriendInvitePoints,
  getHelpfulVotePoints,
  getReviewSubmittedPoints,
} from './rewardShared';

type RouteStartedPayload = {
  storefrontId: string;
  occurredAt?: string;
};

type ReviewSubmittedPayload = {
  rating: number;
  textLength: number;
  photoCount?: number;
  occurredAt?: string;
};

type PhotoUploadedPayload = {
  occurredAt?: string;
};

type HelpfulVoteReceivedPayload = {
  count?: number;
  occurredAt?: string;
};

type ReportSubmittedPayload = {
  occurredAt?: string;
};

type FriendInvitedPayload = {
  count?: number;
  occurredAt?: string;
};

type FollowersUpdatedPayload = {
  count: number;
  occurredAt?: string;
};

type ScanCompletedPayload = {
  scanKind: 'license' | 'product' | 'unknown';
  brandId?: string;
  labName?: string;
  thcPercent?: number;
  contaminants?: {
    pesticides?: boolean;
    heavyMetals?: boolean;
    microbial?: boolean;
    solvents?: boolean;
  };
  isNewBrandForUser?: boolean;
  terpenes?: string[];
  occurredAt?: string;
};

type CoaOpenedPayload = {
  brandId: string;
  labName: string;
  batchId?: string;
  occurredAt?: string;
};

export function applyRouteStartedReward(
  state: StorefrontGamificationState,
  payload: RouteStartedPayload,
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();
  const alreadyVisited = state.visitedStorefrontIds.includes(payload.storefrontId);
  const pointsEarned = alreadyVisited ? 0 : CANOPYTROVE_POINTS.visit_new;

  return finalizeReward(state, 'route_started', occurredAt, pointsEarned, {
    dispensariesVisited: alreadyVisited ? state.dispensariesVisited : state.dispensariesVisited + 1,
    visitedStorefrontIds: alreadyVisited
      ? state.visitedStorefrontIds
      : [...state.visitedStorefrontIds, payload.storefrontId].slice(-256),
    totalRoutesStarted: state.totalRoutesStarted + 1,
  });
}

export function applyReviewSubmittedReward(
  state: StorefrontGamificationState,
  payload: ReviewSubmittedPayload,
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();
  const photoCount = Math.max(0, payload.photoCount ?? 0);

  return finalizeReward(
    state,
    'review_submitted',
    occurredAt,
    getReviewSubmittedPoints(payload.textLength, photoCount),
    {
      totalReviews: state.totalReviews + 1,
      reviewsWithPhotos: state.reviewsWithPhotos + (photoCount > 0 ? 1 : 0),
      detailedReviews: state.detailedReviews + (payload.textLength >= 100 ? 1 : 0),
      fiveStarReviews: state.fiveStarReviews + (payload.rating === 5 ? 1 : 0),
      oneStarReviews: state.oneStarReviews + (payload.rating === 1 ? 1 : 0),
      lastReviewDate: occurredAt,
    },
  );
}

export function applyPhotoUploadedReward(
  state: StorefrontGamificationState,
  payload: PhotoUploadedPayload = {},
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();

  return finalizeReward(state, 'photo_uploaded', occurredAt, CANOPYTROVE_POINTS.photo_upload, {
    totalPhotos: state.totalPhotos + 1,
  });
}

export function applyHelpfulVoteReceivedReward(
  state: StorefrontGamificationState,
  payload: HelpfulVoteReceivedPayload = {},
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();
  const count = Math.max(1, payload.count ?? 1);

  return finalizeReward(state, 'helpful_vote_received', occurredAt, getHelpfulVotePoints(count), {
    totalHelpfulVotes: state.totalHelpfulVotes + count,
  });
}

export function applyReportSubmittedReward(
  state: StorefrontGamificationState,
  payload: ReportSubmittedPayload = {},
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();

  return finalizeReward(
    state,
    'report_submitted',
    occurredAt,
    CANOPYTROVE_POINTS.report_submitted,
    {
      reportsSubmitted: state.reportsSubmitted + 1,
    },
  );
}

export function applyFriendInvitedReward(
  state: StorefrontGamificationState,
  payload: FriendInvitedPayload = {},
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();
  const count = Math.max(1, payload.count ?? 1);

  return finalizeReward(state, 'friend_invited', occurredAt, getFriendInvitePoints(count), {
    friendsInvited: state.friendsInvited + count,
  });
}

export function applyFollowersUpdatedReward(
  state: StorefrontGamificationState,
  payload: FollowersUpdatedPayload,
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();
  const count = Math.max(0, payload.count);
  const gainedFollowers = Math.max(0, count - state.followersCount);

  return finalizeReward(
    state,
    'followers_updated',
    occurredAt,
    getFollowerPoints(gainedFollowers),
    {
      followersCount: count,
    },
  );
}

export function applyScanCompletedReward(
  state: StorefrontGamificationState,
  payload: ScanCompletedPayload,
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();

  // Only product scans participate in consumer scan gamification.
  // License/unknown scans are informational and should not trigger
  // unrelated badge evaluation such as membership-duration milestones.
  if (payload.scanKind !== 'product') {
    const updatedState = normalizeGamificationState(state.profileId, state, state.joinedDate);

    return {
      activityType: 'scan_completed',
      pointsEarned: 0,
      badgesEarned: [],
      levelBefore: state.level,
      levelAfter: updatedState.level,
      updatedState,
    };
  }

  const scanStats = state.scanStats ?? {
    productScanCount: 0,
    uniqueBrandIds: [],
    uniqueTerpenes: [],
    coaOpenCount: 0,
    cleanPassCount: 0,
    highThcScans: 0,
  };

  // Base points for scan
  let pointsEarned = CANOPYTROVE_POINTS.scan_completed;

  // Bonus for new brand
  if (payload.isNewBrandForUser) {
    pointsEarned += CANOPYTROVE_POINTS.scan_new_brand_bonus;
  }

  // Update scan stats
  const updatedScanStats = { ...scanStats };
  updatedScanStats.productScanCount += 1;

  // Track unique brands
  if (payload.brandId && !scanStats.uniqueBrandIds.includes(payload.brandId)) {
    updatedScanStats.uniqueBrandIds = [...scanStats.uniqueBrandIds, payload.brandId].slice(-500);
  }

  // Track unique terpenes
  if (payload.terpenes && Array.isArray(payload.terpenes) && payload.terpenes.length > 0) {
    const dominantTerpene = payload.terpenes[0];
    if (dominantTerpene && !scanStats.uniqueTerpenes.includes(dominantTerpene)) {
      updatedScanStats.uniqueTerpenes = [...scanStats.uniqueTerpenes, dominantTerpene].slice(-100);
    }
  }

  // Track clean passes
  const isCleanPass =
    payload.contaminants &&
    payload.contaminants.pesticides !== true &&
    payload.contaminants.heavyMetals !== true &&
    payload.contaminants.microbial !== true &&
    payload.contaminants.solvents !== true;
  if (isCleanPass) {
    updatedScanStats.cleanPassCount += 1;
  }

  // Track high THC scans
  if (payload.thcPercent !== undefined && payload.thcPercent >= 25) {
    updatedScanStats.highThcScans += 1;
  }

  return finalizeReward(state, 'scan_completed', occurredAt, pointsEarned, {
    scanStats: updatedScanStats,
  });
}

export function applyCoaOpenedReward(
  state: StorefrontGamificationState,
  payload: CoaOpenedPayload,
): GamificationRewardResult {
  const occurredAt = payload.occurredAt ?? getCurrentIsoDate();
  const pointsEarned = CANOPYTROVE_POINTS.coa_opened;

  const scanStats = state.scanStats ?? {
    productScanCount: 0,
    uniqueBrandIds: [],
    uniqueTerpenes: [],
    coaOpenCount: 0,
    cleanPassCount: 0,
    highThcScans: 0,
  };

  const updatedScanStats = { ...scanStats };
  updatedScanStats.coaOpenCount += 1;

  return finalizeReward(state, 'coa_opened', occurredAt, pointsEarned, {
    scanStats: updatedScanStats,
  });
}

export function getBadgeDefinitions() {
  return CANOPYTROVE_BADGES;
}

export function getBadgeDefinition(badgeId: string) {
  return CANOPYTROVE_BADGES.find((badge) => badge.id === badgeId) ?? null;
}
