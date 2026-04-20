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
  /** Stable public author token for device-side blocking/reporting. */
  authorProfileId: string | null;
  isOwnReview?: boolean;
  rating: number;
  relativeTime: string;
  text: string;
  gifUrl?: string | null;
  photoCount?: number;
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

export type OcmVerification = {
  licensed: boolean;
  confidence: 'exact' | 'address' | 'name' | 'fuzzy' | 'none';
  asOf?: string | null;
  source: 'ocm_public_records';
  licenseNumber?: string | null;
  licenseType?: string | null;
  licenseeName?: string | null;
};

/**
 * Supported payment method IDs. Kept small on purpose — these map 1:1
 * to badge icons and owner-portal toggles. Grouping Apple Pay / Google
 * Pay / contactless under a single `tap_pay` reflects the fact that
 * dispensary processors don't meaningfully distinguish between them.
 */
export type PaymentMethodId =
  | 'cash'
  | 'debit'
  | 'credit'
  | 'tap_pay'
  | 'ach_app'
  | 'atm_on_site'
  | 'crypto';

export type PaymentMethodSource = 'google' | 'owner' | 'community';

export type PaymentMethodRecord = {
  methodId: PaymentMethodId;
  accepted: boolean;
  source: PaymentMethodSource;
  /** Community only: fraction of positive votes (0..1). */
  confidence?: number | null;
  /** Community only: total votes weighing in on this method. */
  sampleCount?: number | null;
};

export type PaymentMethods = {
  storefrontId: string;
  asOf: string;
  methods: PaymentMethodRecord[];
  /** True when the shop's verified owner has declared any methods. */
  hasOwnerDeclaration: boolean;
};

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
  promotionPlacementSurfaces?: OwnerPromotionPlacementSurface[];
  promotionPlacementScope?: OwnerPromotionPlacementScope | null;
  placeId?: string;
  thumbnailUrl?: string | null;
  /** Route starts per hour — drives the heat glow visual on cards. */
  routeStartsPerHour?: number | null;
  /**
   * Public OCM licensing signal sourced from data.ny.gov (refreshed hourly).
   * Drives the "Verified licensed" badge on cards and the detail screen.
   */
  ocmVerification?: OcmVerification | null;
  /**
   * Merged payment methods signal (Google Places + verified owner
   * declaration + community reports). Drives the blue "Accepts X"
   * badge under the open/closed indicator.
   */
  paymentMethods?: PaymentMethods | null;
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
  ocmVerification?: OcmVerification | null;
  /**
   * Merged payment methods signal (Google Places + owner + community).
   * Detail screen renders the full section with per-method chips.
   */
  paymentMethods?: PaymentMethods | null;
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
