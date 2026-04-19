import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import type {
  StorefrontDetailApiDocument,
  StorefrontSummaryApiDocument,
} from '../types/storefrontApi';
import { normalizeStorefrontHours } from '../utils/storefrontHours';
import { getStorefrontPromotionBadges } from '../utils/storefrontPromotions';

export function fromStorefrontSummaryApiDocument(
  document: StorefrontSummaryApiDocument,
): StorefrontSummary {
  const promotionBadges = getStorefrontPromotionBadges(document);
  return {
    id: document.id,
    licenseId: document.licenseId,
    marketId: document.marketId,
    displayName: document.displayName,
    legalName: document.legalName,
    addressLine1: document.addressLine1,
    city: document.city,
    state: document.state,
    zip: document.zip,
    coordinates: {
      latitude: document.latitude,
      longitude: document.longitude,
    },
    distanceMiles: document.distanceMiles,
    travelMinutes: document.travelMinutes,
    rating: document.rating,
    reviewCount: document.reviewCount,
    openNow: typeof document.openNow === 'boolean' ? document.openNow : null,
    hours: normalizeStorefrontHours(document.hours),
    isVerified: document.isVerified,
    mapPreviewLabel: document.mapPreviewLabel,
    promotionText: document.promotionText ?? null,
    promotionBadges,
    promotionExpiresAt: document.promotionExpiresAt ?? null,
    activePromotionId: document.activePromotionId ?? null,
    activePromotionCount: document.activePromotionCount ?? null,
    favoriteFollowerCount: document.favoriteFollowerCount ?? null,
    menuUrl: document.menuUrl ?? null,
    verifiedOwnerBadgeLabel: document.verifiedOwnerBadgeLabel ?? null,
    ownerFeaturedBadges: document.ownerFeaturedBadges ?? [],
    ownerCardSummary: document.ownerCardSummary ?? null,
    premiumCardVariant: document.premiumCardVariant ?? 'standard',
    promotionPlacementSurfaces: document.promotionPlacementSurfaces ?? [],
    promotionPlacementScope: document.promotionPlacementScope ?? null,
    placeId: document.placeId,
    thumbnailUrl: document.thumbnailUrl ?? null,
    ocmVerification: document.ocmVerification ?? null,
    paymentMethods: document.paymentMethods ?? null,
  };
}

export function fromStorefrontDetailApiDocument(
  document: StorefrontDetailApiDocument,
): StorefrontDetails {
  return {
    storefrontId: document.storefrontId,
    phone: document.phone,
    website: document.website,
    hours: normalizeStorefrontHours(document.hours),
    openNow: typeof document.openNow === 'boolean' ? document.openNow : null,
    hasOwnerClaim: Boolean(document.hasOwnerClaim),
    menuUrl: document.menuUrl ?? null,
    verifiedOwnerBadgeLabel: document.verifiedOwnerBadgeLabel ?? null,
    favoriteFollowerCount: document.favoriteFollowerCount ?? null,
    ownerFeaturedBadges: document.ownerFeaturedBadges ?? [],
    activePromotions: (document.activePromotions ?? []).map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      badges: [...promotion.badges],
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      cardTone: promotion.cardTone,
    })),
    photoCount:
      typeof document.photoCount === 'number'
        ? document.photoCount
        : Array.isArray(document.photoUrls)
          ? document.photoUrls.length
          : 0,
    appReviewCount: document.appReviewCount,
    appReviews: document.appReviews.map((review) => ({
      ...review,
      authorProfileId: review.authorProfileId ?? null,
      isOwnReview: review.isOwnReview ?? false,
      gifUrl: review.gifUrl ?? null,
      photoUrls: [...(review.photoUrls ?? [])],
      tags: [...review.tags],
      helpfulCount: review.helpfulCount ?? 0,
      ownerReply: review.ownerReply ?? null,
    })),
    photoUrls: [...document.photoUrls],
    amenities: [...document.amenities],
    editorialSummary: document.editorialSummary,
    routeMode: document.routeMode,
    ocmVerification: document.ocmVerification ?? null,
    paymentMethods: document.paymentMethods ?? null,
  };
}
