import type { OwnerPromotionPlacementScope, OwnerPromotionPlacementSurface } from './ownerPortal';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type AppProfile = {
  id: string;
  kind: 'anonymous' | 'authenticated';
  accountId: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerReviewReply = {
  ownerUid: string;
  ownerDisplayName: string | null;
  text: string;
  respondedAt: string;
};

export type AppReview = {
  id: string;
  authorName: string;
  authorProfileId: string | null;
  rating: number;
  relativeTime: string;
  text: string;
  gifUrl?: string | null;
  photoUrls?: string[];
  tags: string[];
  helpfulCount: number;
  ownerReply?: OwnerReviewReply | null;
};

export type StorefrontActivePromotion = {
  id: string;
  title: string;
  description: string;
  badges: string[];
  startsAt: string;
  endsAt: string;
  cardTone: 'standard' | 'owner_featured' | 'hot_deal';
};

export type StorefrontStateCode = string;

export type StorefrontSummary = {
  id: string;
  licenseId: string;
  marketId: string;
  displayName: string;
  legalName: string;
  addressLine1: string;
  city: string;
  state: StorefrontStateCode;
  zip: string;
  coordinates: Coordinates;
  distanceMiles: number;
  travelMinutes: number;
  rating: number;
  reviewCount: number;
  openNow: boolean | null;
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
  promotionPlacementSurfaces?: OwnerPromotionPlacementSurface[];
  promotionPlacementScope?: OwnerPromotionPlacementScope | null;
  placeId?: string;
  thumbnailUrl?: string | null;
  /** Route starts per hour — drives the heat glow visual on cards. */
  routeStartsPerHour?: number | null;
};

export type StorefrontDetails = {
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
  activePromotions?: StorefrontActivePromotion[];
  photoCount?: number;
  appReviewCount: number;
  appReviews: AppReview[];
  photoUrls: string[];
  amenities: string[];
  editorialSummary: string | null;
  routeMode: 'preview' | 'verified';
};

export type BrowseSortKey = 'distance' | 'rating' | 'reviews';

export type BrowseSummaryResult = {
  items: StorefrontSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type MarketArea = {
  id: string;
  label: string;
  subtitle: string;
  center: Coordinates;
};

export type StorefrontListQuery = {
  areaId?: string;
  searchQuery: string;
  origin: Coordinates;
  locationLabel: string;
  hotDealsOnly?: boolean;
};
