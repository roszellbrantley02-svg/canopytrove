export type OcmVerificationApiDocument = {
  licensed: boolean;
  confidence: 'exact' | 'address' | 'name' | 'fuzzy' | 'none';
  asOf: string;
  source: 'ocm_public_records';
  licenseNumber?: string | null;
  licenseType?: string | null;
  licenseeName?: string | null;
};

export type StorefrontSummaryApiDocument = {
  id: string;
  licenseId: string;
  marketId: string;
  displayName: string;
  legalName: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  travelMinutes: number;
  rating: number;
  reviewCount: number;
  openNow: boolean | null;
  hours?: string[];
  isVerified: boolean;
  mapPreviewLabel: string;
  promotionText?: string | null;
  promotionBadges?: string[];
  promotionExpiresAt?: string | null;
  activePromotionId?: string | null;
  activePromotionCount?: number | null;
  favoriteFollowerCount?: number | null;
  menuUrl?: string | null;
  verifiedOwnerBadgeLabel?: string | null;
  ownerFeaturedBadges?: string[];
  ownerCardSummary?: string | null;
  premiumCardVariant?: 'standard' | 'owner_featured' | 'hot_deal';
  promotionPlacementSurfaces?: Array<'nearby' | 'browse' | 'hot_deals'>;
  promotionPlacementScope?: 'storefront_area' | 'statewide' | null;
  placeId?: string;
  thumbnailUrl?: string | null;
  ocmVerification?: OcmVerificationApiDocument | null;
};

export type StorefrontDetailApiDocument = {
  storefrontId: string;
  phone: string | null;
  website: string | null;
  hours: string[];
  openNow: boolean | null;
  hasOwnerClaim: boolean;
  menuUrl?: string | null;
  verifiedOwnerBadgeLabel?: string | null;
  favoriteFollowerCount?: number | null;
  ownerFeaturedBadges?: string[];
  activePromotions?: Array<{
    id: string;
    title: string;
    description: string;
    badges: string[];
    startsAt: string;
    endsAt: string;
    cardTone: 'standard' | 'owner_featured' | 'hot_deal';
  }>;
  photoCount?: number;
  appReviewCount: number;
  appReviews: Array<{
    id: string;
    authorName: string;
    authorProfileId: string | null;
    isOwnReview?: boolean;
    rating: number;
    relativeTime: string;
    text: string;
    gifUrl?: string | null;
    photoUrls?: string[];
    tags: string[];
    helpfulCount: number;
    ownerReply?: {
      ownerUid: string;
      ownerDisplayName: string | null;
      text: string;
      respondedAt: string;
    } | null;
  }>;
  photoUrls: string[];
  amenities: string[];
  editorialSummary: string | null;
  routeMode: 'preview' | 'verified';
  ocmVerification?: OcmVerificationApiDocument | null;
};

export type StorefrontSummariesApiResponse = {
  items: StorefrontSummaryApiDocument[];
  total: number;
  limit: number | null;
  offset: number;
};
