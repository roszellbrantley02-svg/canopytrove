import { brand } from '../config/brand';
import { BrowseSortKey, StorefrontDetails, StorefrontListQuery } from '../types/storefront';

export const NEARBY_SNAPSHOT_PREFIX = `${brand.storageNamespace}:nearby-snapshot:v7`;
export const LATEST_NEARBY_SNAPSHOT_KEY = `${brand.storageNamespace}:nearby-latest:v3`;
export const BROWSE_SNAPSHOT_PREFIX = `${brand.storageNamespace}:browse-snapshot:v6`;
export const DETAIL_SNAPSHOT_PREFIX = `${brand.storageNamespace}:detail-snapshot:v7`;

export function createNearbySnapshotKey(query: StorefrontListQuery) {
  return `${NEARBY_SNAPSHOT_PREFIX}:${query.areaId}:${query.searchQuery.trim().toLowerCase()}:${query.origin.latitude.toFixed(3)}:${query.origin.longitude.toFixed(3)}`;
}

export function createBrowseSnapshotKey(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number
) {
  return `${BROWSE_SNAPSHOT_PREFIX}:${query.areaId}:${query.searchQuery.trim().toLowerCase()}:${query.hotDealsOnly ? 'deals' : 'all'}:${query.origin.latitude.toFixed(3)}:${query.origin.longitude.toFixed(3)}:${sortKey}:${limit}`;
}

export function createDetailSnapshotKey(storefrontId: string) {
  return `${DETAIL_SNAPSHOT_PREFIX}:${storefrontId}`;
}

export function normalizeDetailSnapshot(detail: StorefrontDetails): StorefrontDetails {
  return {
    storefrontId: detail.storefrontId,
    phone: detail.phone ?? null,
    website: detail.website ?? null,
    hours: [...(detail.hours ?? [])],
    openNow: typeof detail.openNow === 'boolean' ? detail.openNow : null,
    hasOwnerClaim: detail.hasOwnerClaim === true,
    appReviewCount:
      typeof detail.appReviewCount === 'number' && Number.isFinite(detail.appReviewCount)
        ? detail.appReviewCount
        : 0,
    appReviews: (detail.appReviews ?? []).map((review) => ({
      ...review,
      authorProfileId: review.authorProfileId ?? null,
      tags: [...(review.tags ?? [])],
      helpfulCount: typeof review.helpfulCount === 'number' ? review.helpfulCount : 0,
    })),
    photoUrls: [...(detail.photoUrls ?? [])],
    amenities: [...(detail.amenities ?? [])],
    editorialSummary: detail.editorialSummary ?? null,
    routeMode: detail.routeMode === 'verified' ? 'verified' : 'preview',
  };
}
