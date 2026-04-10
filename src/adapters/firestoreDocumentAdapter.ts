import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import type { StorefrontRecord } from '../types/storefrontRecord';
import type {
  StorefrontDetailDocument,
  StorefrontSummaryDocument,
} from '../types/firestoreDocuments';
import { normalizeStorefrontHours } from '../utils/storefrontHours';
import { getStorefrontPromotionBadges } from '../utils/storefrontPromotions';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asOptionalUndefinedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function toStorefrontSummaryDocument(record: StorefrontRecord): StorefrontSummaryDocument {
  const promotionBadges = getStorefrontPromotionBadges(record);
  return {
    licenseId: record.licenseId,
    marketId: record.marketId,
    displayName: record.displayName,
    legalName: record.legalName,
    addressLine1: record.addressLine1,
    city: record.city,
    state: record.state,
    zip: record.zip,
    latitude: record.coordinates.latitude,
    longitude: record.coordinates.longitude,
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
    premiumCardVariant: record.promotionText?.trim() ? 'hot_deal' : 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    ...(typeof record.placeId === 'string' && record.placeId.trim()
      ? {
          placeId: record.placeId,
        }
      : {}),
    thumbnailUrl: record.thumbnailUrl ?? null,
  };
}

export function toStorefrontDetailDocument(record: StorefrontRecord): StorefrontDetailDocument {
  return {
    phone: record.phone,
    website: record.website,
    hours: normalizeStorefrontHours(record.hours),
    openNow: record.openNow,
    hasOwnerClaim: false,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    favoriteFollowerCount: null,
    ownerFeaturedBadges: [],
    appReviewCount: record.appReviewCount,
    appReviews: record.appReviews.map((review) => ({
      ...review,
      gifUrl: review.gifUrl ?? null,
      tags: [...review.tags],
      ownerReply: review.ownerReply ?? null,
    })),
    photoUrls: [...record.photoUrls],
    amenities: [...record.amenities],
    editorialSummary: record.editorialSummary,
    routeMode: record.routeMode,
  };
}

export function fromStorefrontSummaryDocument(
  storefrontId: string,
  data: Record<string, unknown>,
): StorefrontSummary {
  const promotionBadges = getStorefrontPromotionBadges({
    promotionBadges: asStringArray(data.promotionBadges),
    promotionText: asOptionalString(data.promotionText),
  });
  return {
    id: storefrontId,
    licenseId: asString(data.licenseId),
    marketId: asString(data.marketId),
    displayName: asString(data.displayName),
    legalName: asString(data.legalName),
    addressLine1: asString(data.addressLine1),
    city: asString(data.city),
    state: asString(data.state, 'NY'),
    zip: asString(data.zip),
    coordinates: {
      latitude: asNumber(data.latitude),
      longitude: asNumber(data.longitude),
    },
    distanceMiles: asNumber(data.distanceMiles),
    travelMinutes: asNumber(data.travelMinutes),
    rating: asNumber(data.rating),
    reviewCount: asNumber(data.reviewCount),
    openNow: asNullableBoolean(data.openNow),
    isVerified: asBoolean(data.isVerified),
    mapPreviewLabel: asString(data.mapPreviewLabel),
    promotionText: asOptionalString(data.promotionText),
    promotionBadges,
    promotionExpiresAt: asOptionalString(data.promotionExpiresAt),
    activePromotionId: asOptionalString(data.activePromotionId),
    activePromotionCount:
      typeof data.activePromotionCount === 'number' && Number.isFinite(data.activePromotionCount)
        ? data.activePromotionCount
        : null,
    favoriteFollowerCount:
      typeof data.favoriteFollowerCount === 'number' && Number.isFinite(data.favoriteFollowerCount)
        ? data.favoriteFollowerCount
        : null,
    menuUrl: asOptionalString(data.menuUrl),
    verifiedOwnerBadgeLabel: asOptionalString(data.verifiedOwnerBadgeLabel),
    ownerFeaturedBadges: asStringArray(data.ownerFeaturedBadges),
    ownerCardSummary: asOptionalString(data.ownerCardSummary),
    premiumCardVariant:
      data.premiumCardVariant === 'owner_featured' || data.premiumCardVariant === 'hot_deal'
        ? data.premiumCardVariant
        : 'standard',
    promotionPlacementSurfaces: asStringArray(data.promotionPlacementSurfaces).filter(
      (value): value is 'nearby' | 'browse' | 'hot_deals' =>
        value === 'nearby' || value === 'browse' || value === 'hot_deals',
    ),
    promotionPlacementScope:
      data.promotionPlacementScope === 'statewide' ||
      data.promotionPlacementScope === 'storefront_area'
        ? data.promotionPlacementScope
        : null,
    placeId: asOptionalUndefinedString(data.placeId),
    thumbnailUrl: asOptionalString(data.thumbnailUrl),
  };
}

export function fromStorefrontDetailDocument(
  storefrontId: string,
  data: Record<string, unknown>,
): StorefrontDetails {
  return {
    storefrontId,
    phone: asOptionalString(data.phone),
    website: asOptionalString(data.website),
    hours: normalizeStorefrontHours(asStringArray(data.hours)),
    openNow: typeof data.openNow === 'boolean' ? data.openNow : null,
    hasOwnerClaim: asBoolean(data.hasOwnerClaim),
    menuUrl: asOptionalString(data.menuUrl),
    verifiedOwnerBadgeLabel: asOptionalString(data.verifiedOwnerBadgeLabel),
    favoriteFollowerCount:
      typeof data.favoriteFollowerCount === 'number' && Number.isFinite(data.favoriteFollowerCount)
        ? data.favoriteFollowerCount
        : null,
    ownerFeaturedBadges: asStringArray(data.ownerFeaturedBadges),
    appReviewCount: asNumber(data.appReviewCount),
    appReviews: Array.isArray(data.appReviews)
      ? data.appReviews.map((review, index) => {
          const entry =
            typeof review === 'object' && review ? (review as Record<string, unknown>) : {};
          return {
            id: asString(entry.id, `app-review-${index}`),
            authorName: asString(entry.authorName, 'Canopy Trove user'),
            authorProfileId: asOptionalString(entry.authorProfileId),
            isOwnReview: asBoolean(entry.isOwnReview),
            rating: asNumber(entry.rating),
            relativeTime: asString(entry.relativeTime, 'Unknown'),
            text: asString(entry.text),
            gifUrl: asOptionalString(entry.gifUrl),
            photoUrls: asStringArray(entry.photoUrls),
            tags: asStringArray(entry.tags),
            helpfulCount: asNumber(entry.helpfulCount),
            ownerReply:
              typeof entry.ownerReply === 'object' && entry.ownerReply
                ? {
                    ownerUid: asString((entry.ownerReply as Record<string, unknown>).ownerUid),
                    ownerDisplayName: asOptionalString(
                      (entry.ownerReply as Record<string, unknown>).ownerDisplayName,
                    ),
                    text: asString((entry.ownerReply as Record<string, unknown>).text),
                    respondedAt: asString(
                      (entry.ownerReply as Record<string, unknown>).respondedAt,
                    ),
                  }
                : null,
          };
        })
      : [],
    photoUrls: asStringArray(data.photoUrls),
    amenities: asStringArray(data.amenities),
    editorialSummary: asOptionalString(data.editorialSummary),
    routeMode: data.routeMode === 'verified' ? 'verified' : 'preview',
  };
}
