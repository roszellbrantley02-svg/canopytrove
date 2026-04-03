import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BrowseSortKey, BrowseSummaryResult, StorefrontListQuery } from '../types/storefront';
import {
  createBrowseSnapshotKey,
  pruneSnapshotCacheToLimit,
  trackStoredBrowseSnapshotKey,
} from './storefrontSnapshotShared';

const browseSnapshotCache = new Map<string, BrowseSummaryResult>();
const MAX_BROWSE_MEMORY_SNAPSHOTS = 24;

export function getCachedBrowseSummarySnapshot(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
) {
  return browseSnapshotCache.get(createBrowseSnapshotKey(query, sortKey, limit)) ?? null;
}

export async function loadBrowseSummarySnapshot(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
): Promise<BrowseSummaryResult | null> {
  const cacheKey = createBrowseSnapshotKey(query, sortKey, limit);
  const cached = browseSnapshotCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const rawValue = await AsyncStorage.getItem(cacheKey);
    if (!rawValue) {
      return null;
    }

    const snapshot = JSON.parse(rawValue) as BrowseSummaryResult;
    browseSnapshotCache.set(cacheKey, snapshot);
    pruneSnapshotCacheToLimit(browseSnapshotCache, MAX_BROWSE_MEMORY_SNAPSHOTS);
    return snapshot;
  } catch {
    return null;
  }
}

export async function saveBrowseSummarySnapshot(
  query: StorefrontListQuery,
  sortKey: BrowseSortKey,
  limit: number,
  result: BrowseSummaryResult,
): Promise<void> {
  const cacheKey = createBrowseSnapshotKey(query, sortKey, limit);
  browseSnapshotCache.set(cacheKey, result);
  pruneSnapshotCacheToLimit(browseSnapshotCache, MAX_BROWSE_MEMORY_SNAPSHOTS);

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    await trackStoredBrowseSnapshotKey(cacheKey);
  } catch {
    // Snapshot persistence should not block render flow.
  }
}
