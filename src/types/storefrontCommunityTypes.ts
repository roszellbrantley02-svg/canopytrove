import type {
  GamificationRewardResult,
  StorefrontGamificationState,
} from './storefrontGamificationTypes';
import type { AppProfile, StorefrontDetails } from './storefrontBaseTypes';

export type StorefrontReviewSubmissionInput = {
  storefrontId: string;
  profileId: string;
  // Firebase Auth uid of the signed-in user submitting the review.
  // Captured server-side from the verified ID token on the request, not
  // trusted from client input. Stored on the review record so future
  // analytics, "verified user" badges, deal-digest signals, and gamif-
  // ication can correlate reviews back to their author's account.
  // Optional only because legacy review records pre-May-2-2026 don't
  // carry it; new submissions always have it.
  authorAccountId?: string | null;
  authorName: string;
  rating: number;
  text: string;
  tags: string[];
  gifUrl?: string | null;
  photoCount?: number;
  photoUploadIds?: string[];
};

export type StorefrontReviewUpdateInput = StorefrontReviewSubmissionInput & {
  reviewId: string;
};

export type StorefrontReviewPhotoModerationSummary = {
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  message: string | null;
};

export type StorefrontReviewSubmissionResponse = {
  detail: StorefrontDetails;
  rewardResult: GamificationRewardResult | null;
  photoModeration: StorefrontReviewPhotoModerationSummary | null;
};

export type StorefrontReportTarget = 'storefront' | 'review';

export type StorefrontReviewReportContext = {
  reviewId: string;
  authorProfileId?: string | null;
  authorName: string;
  excerpt: string;
};

export type StorefrontReportSubmissionInput = {
  storefrontId: string;
  profileId: string;
  authorName: string;
  reason: string;
  description: string;
  reportTarget?: StorefrontReportTarget;
  reportedReviewId?: string;
  reportedReviewAuthorProfileId?: string | null;
  reportedReviewAuthorName?: string | null;
  reportedReviewExcerpt?: string | null;
};

export type StorefrontReportSubmissionResponse = {
  ok: boolean;
  rewardResult: GamificationRewardResult | null;
};

export type StorefrontReviewHelpfulInput = {
  storefrontId: string;
  reviewId: string;
  profileId: string;
  isOwnReview?: boolean;
};

export type StorefrontReviewHelpfulResponse = {
  detail: StorefrontDetails;
  didApply: boolean;
};

export type BlockedReviewAuthor = {
  storefrontId: string;
  storefrontName?: string | null;
  authorId: string;
};

export type CommunitySafetyState = {
  acceptedGuidelinesVersion: string | null;
  blockedReviewAuthors: BlockedReviewAuthor[];
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
