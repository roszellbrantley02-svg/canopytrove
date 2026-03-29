import {
  GamificationRewardResult,
  StorefrontGamificationState,
} from './storefrontGamificationTypes';
import { AppProfile, StorefrontDetails } from './storefrontBaseTypes';

export type StorefrontReviewSubmissionInput = {
  storefrontId: string;
  profileId: string;
  authorName: string;
  rating: number;
  text: string;
  tags: string[];
  gifUrl?: string | null;
  photoCount?: number;
};

export type StorefrontReviewSubmissionResponse = {
  detail: StorefrontDetails;
  rewardResult: GamificationRewardResult | null;
};

export type StorefrontReportSubmissionInput = {
  storefrontId: string;
  profileId: string;
  authorName: string;
  reason: string;
  description: string;
};

export type StorefrontReportSubmissionResponse = {
  ok: boolean;
  rewardResult: GamificationRewardResult | null;
};

export type StorefrontReviewHelpfulInput = {
  storefrontId: string;
  reviewId: string;
  profileId: string;
};

export type StorefrontReviewHelpfulResponse = {
  detail: StorefrontDetails;
  didApply: boolean;
  reviewAuthorProfileId: string | null;
};

export type StorefrontRouteState = {
  profileId: string;
  savedStorefrontIds: string[];
  recentStorefrontIds: string[];
};

export type StorefrontProfileState = {
  profile: AppProfile;
  routeState: StorefrontRouteState;
  gamificationState: StorefrontGamificationState;
};
