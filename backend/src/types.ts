export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type AppProfileApiDocument = {
  id: string;
  kind: 'anonymous' | 'authenticated';
  accountId: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveRouteSessionApiDocument = {
  storefrontId: string;
  routeMode: 'preview' | 'verified';
  startedAt: string;
};

export type GamificationBadgeCategoryApiDocument =
  | 'review'
  | 'photo'
  | 'social'
  | 'milestone'
  | 'location'
  | 'special'
  | 'community'
  | 'explorer'
  | 'scan';

export type GamificationBadgeTierApiDocument =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

export type GamificationBadgeDefinitionApiDocument = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: GamificationBadgeCategoryApiDocument;
  points: number;
  requirement: number;
  hidden: boolean;
  tier?: GamificationBadgeTierApiDocument;
};

export type ScanStatsApiDocument = {
  productScanCount: number;
  uniqueBrandIds: string[];
  uniqueTerpenes: string[];
  coaOpenCount: number;
  cleanPassCount: number;
  highThcScans: number;
};

export type StorefrontGamificationStateApiDocument = {
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
  scanStats?: ScanStatsApiDocument;
};

export type StorefrontRouteStateApiDocument = {
  profileId: string;
  savedStorefrontIds: string[];
  recentStorefrontIds: string[];
  activeRouteSession: ActiveRouteSessionApiDocument | null;
  routeSessions: ActiveRouteSessionApiDocument[];
  plannedRouteStorefrontIds: string[];
};

export type StorefrontProfileStateApiDocument = {
  profile: AppProfileApiDocument;
  routeState: StorefrontRouteStateApiDocument;
  gamificationState: StorefrontGamificationStateApiDocument;
};

export type BlockedCommunityAuthorApiDocument = {
  storefrontId: string;
  storefrontName: string | null;
  authorId: string;
};

export type StorefrontCommunitySafetyStateApiDocument = {
  profileId: string;
  acceptedGuidelinesVersion: string | null;
  blockedReviewAuthors: BlockedCommunityAuthorApiDocument[];
  updatedAt: string;
};

export type GamificationLeaderboardEntryApiDocument = {
  profileId: string;
  displayName: string | null;
  profileKind: AppProfileApiDocument['kind'];
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

export type GamificationLeaderboardApiResponse = {
  items: GamificationLeaderboardEntryApiDocument[];
  total: number;
  limit: number;
  offset: number;
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
  /** Android moderation: platform visibility for this storefront's active promotion. */
  promotionAndroidEligible?: boolean;
  /** Whether this storefront is visible in listings (false = hidden/delisted). */
  isVisible?: boolean;
  /**
   * OCM public-records licensing signal, derived from the cached Current OCM
   * Licenses dataset (data.ny.gov, jskf-tt3q). Surfaced on cards + details as
   * a "Verified licensed" badge. Absence of a match is not a claim that the
   * shop is unlicensed — see frontend disclaimer copy.
   */
  ocmVerification?: OcmVerificationApiDocument | null;
};

export type OcmVerificationApiDocument = {
  licensed: boolean;
  confidence: 'exact' | 'address' | 'name' | 'fuzzy' | 'none';
  asOf: string;
  source: 'ocm_public_records';
  licenseNumber?: string | null;
  licenseType?: string | null;
  licenseeName?: string | null;
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
    androidEligible?: boolean;
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
    tags: string[];
    helpfulCount: number;
    photoCount?: number;
    photoUrls?: string[];
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

export type StorefrontSummarySortKey = 'distance' | 'rating' | 'reviews';

export type StorefrontSummariesApiResponse = {
  items: StorefrontSummaryApiDocument[];
  total: number;
  limit: number | null;
  offset: number;
};

export type LocationResolutionApiResponse = {
  coordinates: Coordinates | null;
  label: string | null;
  source: 'area' | 'summary' | 'unavailable';
};

export type MarketAreaApiDocument = {
  id: string;
  label: string;
  subtitle: string;
  center: Coordinates;
};

/**
 * Lab name for COA (Certificate of Analysis) parsing.
 * Supports six NY lab formats plus generic fallback.
 */
export type LabName =
  | 'kaycha_labs'
  | 'ny_green_analytics'
  | 'proverde_laboratories'
  | 'keystone_state_testing'
  | 'act_laboratories'
  | 'generic';

/**
 * Parsed Certificate of Analysis (COA) metadata extracted from a URL.
 * For most labs, only URL-derived fields are available initially.
 * Full HTML/PDF parsing is marked as TODO for each lab.
 */
export type ProductCOA = {
  labName: LabName;
  brandName?: string;
  productName?: string;
  batchId?: string;
  thcPercent?: number;
  cbdPercent?: number;
  terpenes?: string[];
  contaminants?: {
    pesticides?: boolean;
    heavyMetals?: boolean;
    microbial?: boolean;
    solvents?: boolean;
  };
  passFailOverall?: 'pass' | 'fail' | 'unknown';
  coaUrl: string;
  retrievedAt: string;
};

/**
 * Result of scanning and resolving a raw scanned code.
 * Supports license numbers, COA URLs, and unknown codes.
 */
export type ScanResolution =
  | {
      kind: 'license';
      license: {
        licenseNumber: string;
        licenseType: string;
        licenseeName: string;
        status: string;
      };
    }
  | {
      kind: 'product';
      coa: ProductCOA;
    }
  | {
      kind: 'unknown';
      rawCode: string;
    };

/**
 * Persisted scan record in Firestore productScans collection.
 * Captures what was scanned and how it resolved, without PII.
 */
export type ScanRecord = {
  installId: string;
  rawCode: string;
  resolvedKind: 'license' | 'product' | 'unknown';
  brandId?: string;
  productId?: string;
  batchId?: string;
  labName?: string;
  storefrontId?: string;
  scannedAt: string;
  geoHint?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  };
  schemaVersion: 1;
};

/**
 * Aggregated brand scan counter in Firestore brandCounters collection.
 * Maintained via transactions with atomic increments.
 */
export type BrandCounter = {
  brandId: string;
  brandName?: string;
  totalScans: number;
  lastScannedAt: string;
  byRegion: Record<string, number>;
};

/**
 * Brand smell tag (dominant terpene smell category).
 */
export type BrandSmellTag =
  | 'citrus'
  | 'earthy'
  | 'pine'
  | 'floral'
  | 'peppery'
  | 'fruity'
  | 'hoppy'
  | 'sweet'
  | 'musky'
  | 'woody';

/**
 * Brand taste tag (derived from terpenes).
 */
export type BrandTasteTag =
  | 'citrus'
  | 'musky'
  | 'herbal'
  | 'sweet'
  | 'piney'
  | 'sharp'
  | 'floral'
  | 'lavender'
  | 'peppery'
  | 'spicy'
  | 'hoppy'
  | 'woody'
  | 'fruity'
  | 'tropical'
  | 'chamomile';

/**
 * Sorting key for brand profiles.
 */
export type BrandSortKey = 'smell' | 'taste' | 'potency';

/**
 * Full brand profile with merged seed + live scan data.
 */
export type BrandProfile = {
  brandId: string;
  displayName: string;
  aggregateDominantTerpene?: string;
  smellTags: BrandSmellTag[];
  tasteTags: BrandTasteTag[];
  avgThcPercent: number;
  contaminantPassRate: number; // 0..1
  totalScans: number;
  lastScannedAt?: string;
  description?: string;
  website?: string;
  source: 'seed' | 'scanned' | 'merged';
};

/**
 * Shorter brand profile for list views.
 */
export type BrandProfileSummary = {
  brandId: string;
  displayName: string;
  aggregateDominantTerpene?: string;
  smellTags: BrandSmellTag[];
  avgThcPercent: number;
  contaminantPassRate: number;
  totalScans: number;
};

/**
 * Favorite brand entry in user's profile.
 */
export type FavoriteBrandEntry = {
  brandId: string;
  savedAt: string;
  displayName: string;
  note?: string;
};
