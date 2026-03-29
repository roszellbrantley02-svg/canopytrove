import { AppProfile } from './storefrontBaseTypes';

export type GamificationBadgeCategory =
  | 'review'
  | 'photo'
  | 'social'
  | 'milestone'
  | 'location'
  | 'special'
  | 'community'
  | 'explorer';

export type GamificationBadgeTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

export type GamificationBadgeDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: GamificationBadgeCategory;
  points: number;
  requirement: number;
  hidden: boolean;
  tier?: GamificationBadgeTier;
};

export type GamificationActivityType =
  | 'route_started'
  | 'review_submitted'
  | 'photo_uploaded'
  | 'helpful_vote_received'
  | 'report_submitted'
  | 'friend_invited'
  | 'followers_updated';

export type GamificationRouteStartedPayload = {
  storefrontId: string;
  routeMode: 'preview' | 'verified';
  occurredAt?: string;
};

export type GamificationReviewSubmittedPayload = {
  rating: number;
  textLength: number;
  photoCount?: number;
  occurredAt?: string;
};

export type GamificationPhotoUploadedPayload = {
  occurredAt?: string;
};

export type GamificationHelpfulVoteReceivedPayload = {
  count?: number;
  occurredAt?: string;
};

export type GamificationReportSubmittedPayload = {
  occurredAt?: string;
};

export type GamificationFriendInvitedPayload = {
  count?: number;
  occurredAt?: string;
};

export type GamificationFollowersUpdatedPayload = {
  count: number;
  occurredAt?: string;
};

export type GamificationEventRequest =
  | {
      activityType: 'route_started';
      payload: GamificationRouteStartedPayload;
    }
  | {
      activityType: 'review_submitted';
      payload: GamificationReviewSubmittedPayload;
    }
  | {
      activityType: 'photo_uploaded';
      payload?: GamificationPhotoUploadedPayload;
    }
  | {
      activityType: 'helpful_vote_received';
      payload?: GamificationHelpfulVoteReceivedPayload;
    }
  | {
      activityType: 'report_submitted';
      payload?: GamificationReportSubmittedPayload;
    }
  | {
      activityType: 'friend_invited';
      payload?: GamificationFriendInvitedPayload;
    }
  | {
      activityType: 'followers_updated';
      payload: GamificationFollowersUpdatedPayload;
    };

export type StorefrontGamificationState = {
  profileId: string;
  totalPoints: number;
  totalReviews: number;
  totalPhotos: number;
  totalHelpfulVotes: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  lastActiveDate: string | null;
  dispensariesVisited: number;
  visitedStorefrontIds: string[];
  badges: string[];
  joinedDate: string;
  level: number;
  nextLevelPoints: number;
  reviewsWithPhotos: number;
  detailedReviews: number;
  fiveStarReviews: number;
  oneStarReviews: number;
  commentsWritten: number;
  reportsSubmitted: number;
  friendsInvited: number;
  followersCount: number;
  totalRoutesStarted: number;
};

export type GamificationRewardResult = {
  activityType: GamificationActivityType;
  pointsEarned: number;
  badgesEarned: GamificationBadgeDefinition[];
  levelBefore: number;
  levelAfter: number;
  updatedState: StorefrontGamificationState;
};

export type GamificationLeaderboardEntry = {
  profileId: string;
  displayName: string | null;
  profileKind: AppProfile['kind'];
  totalPoints: number;
  level: number;
  badgeCount: number;
  totalReviews: number;
  totalPhotos: number;
  dispensariesVisited: number;
  totalRoutesStarted: number;
  rank: number;
  updatedAt: string | null;
};

export type GamificationLeaderboardResponse = {
  items: GamificationLeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
};
