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
  | 'explorer';

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
  state: 'NY';
  zip: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  travelMinutes: number;
  rating: number;
  reviewCount: number;
  openNow: boolean;
  isVerified: boolean;
  mapPreviewLabel: string;
  promotionText?: string | null;
  promotionBadges?: string[];
  promotionExpiresAt?: string | null;
  activePromotionId?: string | null;
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
  appReviewCount: number;
  appReviews: Array<{
    id: string;
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
  }>;
  photoUrls: string[];
  amenities: string[];
  editorialSummary: string | null;
  routeMode: 'preview' | 'verified';
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
