import type { RuntimeOpsStatus } from './runtimeOps';
import type { OwnerSubscriptionTier } from './ownerTiers';

export type OwnerPortalUserRole = 'customer' | 'owner' | 'admin';

export type OwnerPortalAccountStatus = 'active' | 'invited' | 'suspended';

export type OwnerOnboardingStep =
  | 'account_created'
  | 'business_details'
  | 'claim_listing'
  | 'business_verification'
  | 'identity_verification'
  | 'subscription'
  | 'completed';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'needs_resubmission'
  | 'failed'
  | 'expired';

export type OwnerClaimStatus = 'pending' | 'approved' | 'rejected' | 'needs_resubmission';

export type OwnerSubscriptionStatus =
  | 'inactive'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'suspended';

export type OwnerUserDocument = {
  uid: string;
  email: string;
  role: OwnerPortalUserRole;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string;
  accountStatus: OwnerPortalAccountStatus;
};

export type OwnerProfileDocument = {
  uid: string;
  legalName: string;
  phone: string | null;
  companyName: string;
  identityVerificationStatus: VerificationStatus;
  businessVerificationStatus: VerificationStatus;
  dispensaryId: string | null;
  /** Additional storefront IDs beyond the primary (Pro tier multi-location). */
  additionalLocationIds?: string[];
  onboardingStep: OwnerOnboardingStep;
  subscriptionStatus: OwnerSubscriptionStatus;
  badgeLevel: number;
  earnedBadgeIds: string[];
  selectedBadgeIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type OwnerDispensaryClaimDocument = {
  ownerUid: string;
  dispensaryId: string;
  claimStatus: OwnerClaimStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type OwnerPortalAccessState = {
  enabled: boolean;
  restricted: boolean;
  allowlisted: boolean;
};

export type OwnerPortalAuthClaimsSyncResponse = {
  ok: true;
  role: 'owner' | 'admin';
  syncedAt: string;
};

export type OwnerPortalSignUpInput = {
  email: string;
  password: string;
  displayName: string;
  legalName: string;
  companyName: string;
};

export type OwnerPortalBusinessDetailsInput = {
  legalName: string;
  phone: string;
  companyName: string;
};

export type OwnerPortalUploadedFile = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

export type OwnerPortalBusinessVerificationDocument = {
  ownerUid: string;
  dispensaryId: string;
  legalBusinessName: string;
  storefrontName: string;
  licenseNumber: string;
  licenseType: string;
  state: string;
  address: string;
  uploadedLicenseFilePath: string;
  uploadedBusinessDocPath: string;
  verificationStatus: VerificationStatus;
  verificationSource: 'owner_upload';
  matchedRecord: {
    dispensaryId: string;
    matchScore: number;
  } | null;
  adminNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type OwnerPortalIdentityIdType = 'drivers_license' | 'state_id' | 'passport';

export type OwnerPortalIdentityVerificationDocument = {
  ownerUid: string;
  fullName: string;
  idType: OwnerPortalIdentityIdType;
  idDocumentFrontPath: string;
  idDocumentBackPath: string | null;
  selfiePath: string;
  verificationStatus: VerificationStatus;
  provider: 'manual_review';
  providerReferenceId: string | null;
  adminNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  expiresAt: string;
};

export type OwnerPortalSubscriptionDocument = {
  ownerUid: string;
  dispensaryId: string;
  provider: 'internal_prelaunch' | 'stripe';
  externalCustomerId?: string | null;
  externalSubscriptionId: string | null;
  planId: string;
  tier?: OwnerSubscriptionTier | null;
  status: OwnerSubscriptionStatus;
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckoutSessionId?: string | null;
  lastCheckoutOpenedAt?: string | null;
};

export type OwnerLicenseRenewalStatus =
  | 'unknown'
  | 'active'
  | 'window_open'
  | 'urgent'
  | 'submitted'
  | 'expired';

export type OwnerLicenseReminderStage =
  | '120_day'
  | '90_day'
  | '60_day'
  | '30_day'
  | '14_day'
  | '7_day'
  | 'expired';

export type OwnerLicenseComplianceDocument = {
  ownerUid: string;
  dispensaryId: string;
  licenseNumber: string;
  licenseType: string;
  state?: string;
  jurisdiction: 'NY';
  issuedAt: string | null;
  expiresAt: string | null;
  renewalWindowStartsAt: string | null;
  renewalWindowEndsAt?: string | null;
  renewalUrgentAt: string | null;
  renewalStatus: OwnerLicenseRenewalStatus;
  renewalSubmittedAt: string | null;
  lastReminderSentAt: string | null;
  lastReminderAt?: string | null;
  lastReminderStage: OwnerLicenseReminderStage | null;
  lastReviewedAt?: string | null;
  lastReviewedLabel?: string | null;
  renewalSubmissionStatus?: string | null;
  checklist?: Array<{
    id: string;
    label: string;
    completed: boolean;
    detail: string;
  }>;
  source: 'owner_input' | 'admin_input' | 'verification_seed';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Android moderation & compliance types ────────────────────────────

export type ClientPlatform = 'android' | 'ios' | 'web';

export type ContentCategory =
  | 'announcement'
  | 'event'
  | 'community'
  | 'hours_update'
  | 'amenity_update'
  | 'education'
  | 'promotion';

export type ModerationDecision = 'allowed' | 'review_required' | 'blocked';

export type ModerationReasonCode =
  | 'PRICE_OR_DISCOUNT'
  | 'PRODUCT_TERM'
  | 'TRANSACTION_CTA'
  | 'ORDER_FLOW_LANGUAGE'
  | 'DELIVERY_OR_PICKUP'
  | 'MENU_SHOPPING_LANGUAGE'
  | 'AMBIGUOUS_EVENT_PROMO'
  | 'IMAGE_TEXT_REVIEW_REQUIRED'
  | 'UNKNOWN_RISK';

export type PlatformModeration = {
  decision: ModerationDecision;
  reasons: ModerationReasonCode[];
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

export type OwnerCardModeration = {
  category: ContentCategory;
  overallDecision: ModerationDecision;
  android: PlatformModeration;
  ios: PlatformModeration;
  web: PlatformModeration;
  classifierVersion: string;
};

export type PlatformVisibility = {
  android: boolean;
  ios: boolean;
  web: boolean;
};

export type ModerationQueueEntry = {
  contentId: string;
  storefrontId: string;
  submittedByOwnerId: string;
  submittedAt: string;
  platform: ClientPlatform;
  normalizedText: string;
  matchedRules: ModerationReasonCode[];
  imageOcrText: string | null;
  reviewStatus: 'pending_review' | 'approved' | 'rejected' | 'published' | 'removed';
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type OwnerPromotionAudience = 'all_followers' | 'frequent_visitors' | 'new_customers';

export type OwnerPromotionStatus = 'draft' | 'scheduled' | 'active' | 'expired';

export type OwnerPromotionCardTone = 'standard' | 'owner_featured' | 'hot_deal';

export type OwnerPromotionPlacementSurface = 'nearby' | 'browse' | 'hot_deals';

export type OwnerPromotionPlacementScope = 'storefront_area' | 'statewide';

export type OwnerStorefrontPromotionDocument = {
  id: string;
  storefrontId: string;
  ownerUid: string;
  title: string;
  description: string;
  badges: string[];
  startsAt: string;
  endsAt: string;
  status: OwnerPromotionStatus;
  audiences: OwnerPromotionAudience[];
  alertFollowersOnStart: boolean;
  cardTone: OwnerPromotionCardTone;
  placementSurfaces: OwnerPromotionPlacementSurface[];
  placementScope: OwnerPromotionPlacementScope;
  followersAlertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Android moderation
  moderation?: OwnerCardModeration;
  platformVisibility?: PlatformVisibility;
};

export type OwnerStorefrontProfileToolsDocument = {
  storefrontId: string;
  ownerUid: string;
  menuUrl: string | null;
  featuredPhotoUrls: string[];
  cardPhotoUrl: string | null;
  featuredPhotoPaths?: string[];
  cardPhotoPath?: string | null;
  verifiedBadgeLabel: string | null;
  featuredBadges: string[];
  cardSummary: string | null;
  ownerHours?: OwnerHoursEntry[] | null;
  updatedAt: string;
};

export type OwnerHoursEntry = {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  open: string | null;
  close: string | null;
  closed: boolean;
};

export type OwnerWorkspacePatternFlag = {
  id: string;
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'success';
};

export type OwnerWorkspaceReviewRecord = {
  id: string;
  storefrontId: string;
  authorName: string;
  authorProfileId: string | null;
  rating: number;
  relativeTime: string;
  text: string;
  gifUrl?: string | null;
  tags: string[];
  helpfulCount: number;
  ownerReply?: {
    ownerUid: string;
    ownerDisplayName: string | null;
    text: string;
    respondedAt: string;
  } | null;
  isLowRating: boolean;
};

export type OwnerWorkspaceReportRecord = {
  id: string;
  storefrontId: string;
  authorName: string;
  profileId: string;
  reason: string;
  description: string;
  createdAt: string;
  moderationStatus: 'open' | 'reviewed' | 'dismissed';
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type OwnerWorkspaceMetrics = {
  followerCount: number;
  storefrontImpressions7d: number;
  storefrontOpenCount7d: number;
  routeStarts7d: number;
  websiteTapCount7d: number;
  phoneTapCount7d: number;
  menuTapCount7d: number;
  reviewCount30d: number;
  openReportCount: number;
  averageRating: number | null;
  replyRate: number;
  openToRouteRate: number;
  openToWebsiteRate: number;
  openToPhoneRate: number;
  openToMenuRate: number;
};

export type OwnerPromotionPerformanceSnapshot = {
  promotionId: string;
  title: string;
  status: OwnerPromotionStatus;
  badges: string[];
  startsAt: string;
  endsAt: string;
  metrics: {
    impressions: number;
    opens: number;
    saves: number;
    redeemStarts: number;
    redeemed: number;
    websiteTaps: number;
    phoneTaps: number;
    menuTaps: number;
    clickThroughRate: number;
    actionRate: number;
  };
};

export type OwnerPortalWorkspaceDocument = {
  ownerProfile: OwnerProfileDocument | null;
  ownerClaim: OwnerDispensaryClaimDocument | null;
  storefrontSummary: {
    id: string;
    displayName: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    promotionText?: string | null;
    promotionBadges?: string[];
  } | null;
  metrics: OwnerWorkspaceMetrics;
  patternFlags: OwnerWorkspacePatternFlag[];
  recentReviews: OwnerWorkspaceReviewRecord[];
  recentReports: OwnerWorkspaceReportRecord[];
  promotions: OwnerStorefrontPromotionDocument[];
  promotionPerformance: OwnerPromotionPerformanceSnapshot[];
  profileTools: OwnerStorefrontProfileToolsDocument | null;
  licenseCompliance: OwnerLicenseComplianceDocument | null;
  ownerAlertStatus: {
    pushEnabled: boolean;
    updatedAt: string | null;
  };
  runtimeStatus: RuntimeOpsStatus;
  tier?: OwnerSubscriptionTier | null;
  /** The storefront ID the workspace is currently loaded for. */
  activeLocationId?: string | null;
  /** All locations this owner manages (primary + additional). Empty for single-location owners. */
  locations?: OwnerLocationSummary[];
};

/** Summary of a location for the multi-location switcher. */
export type OwnerLocationSummary = {
  storefrontId: string;
  displayName: string;
  addressLine1: string;
  city: string;
  state: string;
  isPrimary: boolean;
};

export type OwnerPortalProfileToolsInput = {
  menuUrl?: string | null;
  featuredPhotoUrls?: string[];
  cardPhotoUrl?: string | null;
  featuredPhotoPaths?: string[];
  cardPhotoPath?: string | null;
  verifiedBadgeLabel?: string | null;
  featuredBadges?: string[];
  cardSummary?: string | null;
  ownerHours?: OwnerHoursEntry[] | null;
};

export type OwnerPortalLicenseComplianceInput = {
  licenseNumber?: string;
  licenseType?: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  renewalSubmittedAt?: string | null;
  notes?: string | null;
};

export type OwnerPortalPromotionInput = {
  title: string;
  description: string;
  badges: string[];
  startsAt: string;
  endsAt: string;
  audiences: OwnerPromotionAudience[];
  alertFollowersOnStart: boolean;
  cardTone: OwnerPromotionCardTone;
  placementSurfaces: OwnerPromotionPlacementSurface[];
  placementScope: OwnerPromotionPlacementScope;
  contentCategory?: ContentCategory;
};

export type OwnerAiPriority = {
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'success';
};

export type OwnerAiActionPlan = {
  headline: string;
  summary: string;
  priorities: OwnerAiPriority[];
  generatedAt: string;
  usedFallback: boolean;
};

export type OwnerAiPromotionDraft = {
  title: string;
  description: string;
  badges: string[];
  audiences: OwnerPromotionAudience[];
  cardTone: OwnerPromotionCardTone;
  placementSurfaces: OwnerPromotionPlacementSurface[];
  placementScope: OwnerPromotionPlacementScope;
  reasoning: string;
  generatedAt: string;
  usedFallback: boolean;
};

export type OwnerAiReviewReplyDraft = {
  text: string;
  tone: string;
  reasoning: string;
  generatedAt: string;
  usedFallback: boolean;
};

export type OwnerAiProfileSuggestion = {
  cardSummary: string;
  verifiedBadgeLabel: string | null;
  featuredBadges: string[];
  reasoning: string;
  generatedAt: string;
  usedFallback: boolean;
};

export type OwnerAiDraftRequest = {
  goal?: string | null;
  tone?: string | null;
  focus?: string | null;
};

export type OwnerPortalAiPromotionDraftInput = {
  brief: string | null;
  audiences: OwnerPromotionAudience[];
  cardTone: OwnerPromotionCardTone;
  placementScope: OwnerPromotionPlacementScope;
};

export type OwnerPortalAiReviewReplyResponse = OwnerAiReviewReplyDraft;
export type OwnerPortalAiPromotionDraftResponse = OwnerAiPromotionDraft;
export type OwnerPortalAiActionPlanResponse = OwnerAiActionPlan;
