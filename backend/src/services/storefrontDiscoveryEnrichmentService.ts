import type { StorefrontSummaryApiDocument } from '../types';
import type { StorefrontRecord } from '../../../src/types/storefrontRecord';
import { getGooglePlacesEnrichment, hasGooglePlacesConfig } from './googlePlacesService';
import { matchPlaceId } from './googlePlacesMatching';
import { GooglePlacesEnrichment } from './googlePlacesShared';
import {
  StorefrontDiscoveryCandidateDocument,
  StorefrontDiscoveryPublicationStatus,
} from './storefrontDiscoveryModels';
import {
  LIVE_DISCOVERY_PENDING_HOURS_LABEL,
  STOREFRONT_DISCOVERY_SOURCE_KIND,
} from './storefrontDiscoverySourceService';

/** Maximum distance (in miles) between OCM-geocoded and Google Places locations before we distrust the Google result. */
const MAX_GOOGLE_LOCATION_DRIFT_MILES = 0.5;

/** Quick haversine distance between two lat/lng pairs, returned in miles. */
function haversineDistanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function createNow() {
  return new Date().toISOString();
}

function hasPendingDiscoveryHours(source: StorefrontRecord) {
  return (
    source.mapPreviewLabel.trim() === LIVE_DISCOVERY_PENDING_HOURS_LABEL &&
    source.hours.length === 0
  );
}

export function buildDiscoverySummaryLikeDocument(
  source: StorefrontRecord,
  placeId?: string | null,
): StorefrontSummaryApiDocument {
  return {
    id: source.id,
    licenseId: source.licenseId,
    marketId: source.marketId,
    displayName: source.displayName,
    legalName: source.legalName,
    addressLine1: source.addressLine1,
    city: source.city,
    state: source.state,
    zip: source.zip,
    latitude: source.coordinates.latitude,
    longitude: source.coordinates.longitude,
    distanceMiles: source.distanceMiles,
    travelMinutes: source.travelMinutes,
    rating: source.rating,
    reviewCount: source.reviewCount,
    openNow: source.openNow,
    isVerified: source.isVerified,
    mapPreviewLabel: source.mapPreviewLabel,
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    favoriteFollowerCount: null,
    menuUrl: source.website ?? null,
    verifiedOwnerBadgeLabel: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    premiumCardVariant: 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    placeId: placeId ?? undefined,
    thumbnailUrl: source.thumbnailUrl ?? null,
  };
}

export async function resolveDiscoveryGoogleData(source: StorefrontRecord): Promise<{
  googlePlaceId: string | null;
  googleEnrichment: GooglePlacesEnrichment | null;
}> {
  if (!hasGooglePlacesConfig()) {
    return {
      googlePlaceId: null,
      googleEnrichment: null,
    };
  }

  const discoverySummary = buildDiscoverySummaryLikeDocument(source);
  try {
    const googlePlaceId = await matchPlaceId(discoverySummary);
    if (!googlePlaceId) {
      return {
        googlePlaceId: null,
        googleEnrichment: null,
      };
    }

    const googleEnrichment = await getGooglePlacesEnrichment({
      ...discoverySummary,
      placeId: googlePlaceId,
    });

    return {
      googlePlaceId,
      googleEnrichment,
    };
  } catch {
    return {
      googlePlaceId: null,
      googleEnrichment: null,
    };
  }
}

export function deriveDiscoveryPublicationStatus(
  source: StorefrontRecord,
  googleEnrichment: GooglePlacesEnrichment | null,
): {
  publicationStatus: StorefrontDiscoveryPublicationStatus;
  publicationReason: string;
} {
  if (source.state.trim().toUpperCase() !== 'NY') {
    return {
      publicationStatus: 'suppressed',
      publicationReason: 'Source storefront is outside the New York launch scope.',
    };
  }

  if (!source.isVerified) {
    return {
      publicationStatus: 'suppressed',
      publicationReason: 'Source storefront is not verified in the OCM feed.',
    };
  }

  if (
    source.openNow ||
    googleEnrichment?.openNow ||
    googleEnrichment?.businessStatus === 'OPERATIONAL' ||
    hasPendingDiscoveryHours(source)
  ) {
    return {
      publicationStatus: 'ready_for_publish',
      publicationReason: 'Storefront is publicly open and eligible for manual publish.',
    };
  }

  return {
    publicationStatus: 'hidden',
    publicationReason: 'Hidden until manual publish after public-open verification.',
  };
}

export function buildDiscoveryCandidateDocument(
  source: StorefrontRecord,
  input: {
    googlePlaceId: string | null;
    googleEnrichment: GooglePlacesEnrichment | null;
    existing?: StorefrontDiscoveryCandidateDocument | null;
    nowIso?: string;
  },
): StorefrontDiscoveryCandidateDocument {
  const nowIso = input.nowIso ?? createNow();
  const existing = input.existing ?? null;
  const derived = deriveDiscoveryPublicationStatus(source, input.googleEnrichment);
  const publicationStatus =
    existing?.publicationStatus === 'published' ? 'published' : derived.publicationStatus;
  const publicationReason =
    existing?.publicationStatus === 'published'
      ? existing.publicationReason
      : derived.publicationReason;

  return {
    id: source.id,
    sourceKind: STOREFRONT_DISCOVERY_SOURCE_KIND,
    source,
    googlePlaceId: input.googlePlaceId,
    googleEnrichment: input.googleEnrichment,
    publicationStatus,
    publicationReason,
    discoveredAt: existing?.discoveredAt ?? nowIso,
    lastCheckedAt: nowIso,
    publishedAt: existing?.publishedAt ?? null,
    publishedSummaryId: existing?.publishedSummaryId ?? null,
    publishedDetailId: existing?.publishedDetailId ?? null,
    updatedAt: nowIso,
  };
}

export function buildPublishedStorefrontSummaryDocument(
  source: StorefrontRecord,
  googlePlaceId?: string | null,
  googleEnrichment: GooglePlacesEnrichment | null = null,
) {
  // Only use Google's location if it's within a reasonable distance of the
  // OCM-geocoded address. A large drift means Google matched the wrong place.
  const googleLocation = googleEnrichment?.location;
  const googleLocationTrusted =
    googleLocation &&
    haversineDistanceMiles(source.coordinates, googleLocation) <= MAX_GOOGLE_LOCATION_DRIFT_MILES;
  const publishedLocation = googleLocationTrusted ? googleLocation : source.coordinates;

  return {
    licenseId: source.licenseId,
    marketId: source.marketId,
    displayName: source.displayName,
    legalName: source.legalName,
    addressLine1: source.addressLine1,
    city: source.city,
    state: source.state,
    zip: source.zip,
    latitude: publishedLocation.latitude,
    longitude: publishedLocation.longitude,
    distanceMiles: 0,
    travelMinutes: 0,
    rating: source.rating,
    reviewCount: source.reviewCount,
    openNow: googleEnrichment?.openNow ?? source.openNow,
    isVerified: source.isVerified,
    mapPreviewLabel: source.mapPreviewLabel,
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    favoriteFollowerCount: null,
    menuUrl: source.menuUrl ?? source.website ?? googleEnrichment?.website ?? null,
    verifiedOwnerBadgeLabel: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    premiumCardVariant: 'standard' as const,
    promotionPlacementSurfaces: [] as Array<'nearby' | 'browse' | 'hot_deals'>,
    promotionPlacementScope: null as null,
    placeId: googlePlaceId ?? undefined,
    thumbnailUrl: source.thumbnailUrl ?? null,
  };
}

export function buildPublishedStorefrontDetailDocument(
  source: StorefrontRecord,
  googleEnrichment: GooglePlacesEnrichment | null,
) {
  return {
    phone: googleEnrichment?.phone ?? source.phone,
    website: googleEnrichment?.website ?? source.website,
    hours: googleEnrichment?.hours?.length ? [...googleEnrichment.hours] : [...source.hours],
    openNow:
      googleEnrichment?.openNow ?? (hasPendingDiscoveryHours(source) ? null : source.openNow),
    hasOwnerClaim: false,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    favoriteFollowerCount: null,
    ownerFeaturedBadges: [],
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [...source.photoUrls],
    amenities: [...source.amenities],
    editorialSummary: source.editorialSummary,
    routeMode: source.routeMode,
  };
}
