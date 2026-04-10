import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import type { BrowseSortKey, StorefrontDetails, StorefrontListQuery } from '../types/storefront';
import { getStorefrontMemberAccessCacheKey } from './storefrontMemberDealAccessService';

export const NEARBY_SNAPSHOT_PREFIX = `${brand.storageNamespace}:nearby-snapshot:v8`;
export const BROWSE_SNAPSHOT_PREFIX = `${brand.storageNamespace}:browse-snapshot:v8`;
export const DETAIL_SNAPSHOT_PREFIX = `${brand.storageNamespace}:detail-snapshot:v7`;
const BROWSE_SNAPSHOT_REGISTRY_KEY = `${brand.storageNamespace}:browse-snapshot-registry:v1`;
const NEARBY_SNAPSHOT_REGISTRY_KEY = `${brand.storageNamespace}:nearby-snapshot-registry:v1`;
const DETAIL_SNAPSHOT_REGISTRY_KEY = `${brand.storageNamespace}:detail-snapshot-registry:v1`;
const MAX_BROWSE_SNAPSHOT_ENTRIES = 24;
const MAX_NEARBY_SNAPSHOT_ENTRIES = 24;
const MAX_DETAIL_SNAPSHOT_ENTRIES = 48;

type SnapshotRegistryEntry = {
  key: string;
  updatedAt: number;
};

function normalizeSnapshotRegistry(rawValue: string | null) {
  if (!rawValue) {
    return [] as SnapshotRegistryEntry[];
  }

  try {
    const parsed = JSON.parse(rawValue) as SnapshotRegistryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        typeof entry?.key === 'string' &&
        entry.key.trim().length > 0 &&
        typeof entry.updatedAt === 'number' &&
        Number.isFinite(entry.updatedAt),
    );
  } catch {
    return [];
  }
}

export function pruneSnapshotCacheToLimit<T>(cache: Map<string, T>, maxEntries: number) {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    cache.delete(oldestKey);
  }
}

async function trackStoredSnapshotKeys(
  registryKey: string,
  snapshotKeys: string[],
  maxEntries: number,
) {
  const uniqueSnapshotKeys = Array.from(
    new Set(snapshotKeys.map((value) => value.trim()).filter(Boolean)),
  );
  if (!uniqueSnapshotKeys.length) {
    return;
  }

  try {
    const existingRegistry = normalizeSnapshotRegistry(await AsyncStorage.getItem(registryKey));
    const now = Date.now();
    const nextRegistry = [
      ...uniqueSnapshotKeys.map((key) => ({
        key,
        updatedAt: now,
      })),
      ...existingRegistry.filter((entry) => !uniqueSnapshotKeys.includes(entry.key)),
    ].slice(0, maxEntries);
    const removedSnapshotKeys = existingRegistry
      .filter((entry) => !nextRegistry.some((nextEntry) => nextEntry.key === entry.key))
      .map((entry) => entry.key);

    await AsyncStorage.setItem(registryKey, JSON.stringify(nextRegistry));
    if (removedSnapshotKeys.length) {
      await AsyncStorage.multiRemove(removedSnapshotKeys);
    }
  } catch {
    // Snapshot pruning should not block render flow.
  }
}

export function trackStoredBrowseSnapshotKey(snapshotKey: string) {
  return trackStoredSnapshotKeys(
    BROWSE_SNAPSHOT_REGISTRY_KEY,
    [snapshotKey],
    MAX_BROWSE_SNAPSHOT_ENTRIES,
  );
}

export function trackStoredNearbySnapshotKeys(snapshotKeys: string[]) {
  return trackStoredSnapshotKeys(
    NEARBY_SNAPSHOT_REGISTRY_KEY,
    snapshotKeys,
    MAX_NEARBY_SNAPSHOT_ENTRIES,
  );
}

export function trackStoredDetailSnapshotKey(snapshotKey: string) {
  return trackStoredSnapshotKeys(
    DETAIL_SNAPSHOT_REGISTRY_KEY,
    [snapshotKey],
    MAX_DETAIL_SNAPSHOT_ENTRIES,
  );
}

export function createLatestNearbySnapshotKey() {
  return `${brand.storageNamespace}:nearby-latest:v5:${getStorefrontMemberAccessCacheKey()}`;
}

export function createNearbySnapshotKey(query: StorefrontListQuery) {
  return `${NEARBY_SNAPSHOT_PREFIX}:${query.areaId}:${query.searchQuery.trim().toLowerCase()}:${query.origin.latitude.toFixed(3)}:${query.origin.longitude.toFixed(3)}:${getStorefrontMemberAccessCacheKey()}`;
}

export function createBrowseSnapshotKey(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
) {
  return `${BROWSE_SNAPSHOT_PREFIX}:${query.areaId}:${query.searchQuery.trim().toLowerCase()}:${query.hotDealsOnly ? 'deals' : 'all'}:${query.origin.latitude.toFixed(3)}:${query.origin.longitude.toFixed(3)}:${sortKey}:${limit}:${getStorefrontMemberAccessCacheKey()}`;
}

export function createDetailSnapshotKey(storefrontId: string) {
  return `${DETAIL_SNAPSHOT_PREFIX}:${storefrontId}:${getStorefrontMemberAccessCacheKey()}`;
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
      photoUrls: [...(review.photoUrls ?? [])],
      tags: [...(review.tags ?? [])],
      helpfulCount: typeof review.helpfulCount === 'number' ? review.helpfulCount : 0,
    })),
    photoUrls: [...(detail.photoUrls ?? [])],
    amenities: [...(detail.amenities ?? [])],
    editorialSummary: detail.editorialSummary ?? null,
    routeMode: detail.routeMode === 'verified' ? 'verified' : 'preview',
  };
}
