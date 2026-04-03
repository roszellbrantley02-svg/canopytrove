import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import type { StorefrontRecord } from '../types/storefrontRecord';
import { normalizeStorefrontHours } from '../utils/storefrontHours';
import { getStorefrontPromotionBadges } from '../utils/storefrontPromotions';

export function toStorefrontSummary(record: StorefrontRecord): StorefrontSummary {
  const promotionBadges = getStorefrontPromotionBadges(record);
  return {
    id: record.id,
    licenseId: record.licenseId,
    marketId: record.marketId,
    displayName: record.displayName,
    legalName: record.legalName,
    addressLine1: record.addressLine1,
    city: record.city,
    state: record.state,
    zip: record.zip,
    coordinates: record.coordinates,
    distanceMiles: record.distanceMiles,
    travelMinutes: record.travelMinutes,
    rating: record.rating,
    reviewCount: record.reviewCount,
    openNow: record.openNow,
    isVerified: record.isVerified,
    mapPreviewLabel: record.mapPreviewLabel,
    promotionText: record.promotionText ?? null,
    promotionBadges,
    promotionExpiresAt: record.promotionExpiresAt ?? null,
    activePromotionId: null,
    activePromotionCount: null,
    favoriteFollowerCount: null,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    premiumCardVariant: promotionTextToCardVariant(record.promotionText),
    placeId: record.placeId,
    thumbnailUrl: record.thumbnailUrl,
  };
}

function promotionTextToCardVariant(promotionText?: string | null) {
  return promotionText?.trim() ? 'hot_deal' : 'standard';
}

export function toStorefrontDetails(record: StorefrontRecord): StorefrontDetails {
  return {
    storefrontId: record.id,
    phone: record.phone,
    website: record.website,
    hours: normalizeStorefrontHours(record.hours),
    openNow: record.openNow,
    hasOwnerClaim: false,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    favoriteFollowerCount: null,
    ownerFeaturedBadges: [],
    photoCount: record.photoUrls.length,
    appReviewCount: record.appReviewCount,
    appReviews: record.appReviews,
    photoUrls: record.photoUrls,
    amenities: record.amenities,
    editorialSummary: record.editorialSummary,
    routeMode: record.routeMode,
  };
}
