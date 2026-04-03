import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorefrontListQuery, StorefrontSummary } from '../types/storefront';
import {
  createNearbySnapshotKey,
  createLatestNearbySnapshotKey,
  pruneSnapshotCacheToLimit,
  trackStoredNearbySnapshotKeys,
} from './storefrontSnapshotShared';

const nearbySnapshotCache = new Map<string, StorefrontSummary[]>();
const latestNearbySnapshotCache = new Map<string, StorefrontSummary[]>();
const MAX_NEARBY_MEMORY_SNAPSHOTS = 24;
const MAX_LATEST_NEARBY_MEMORY_SNAPSHOTS = 8;

export function getCachedNearbySummarySnapshot(query: StorefrontListQuery) {
  return nearbySnapshotCache.get(createNearbySnapshotKey(query)) ?? null;
}

export function getCachedLatestNearbySummarySnapshot() {
  return latestNearbySnapshotCache.get(createLatestNearbySnapshotKey()) ?? null;
}

export async function loadNearbySummarySnapshot(
  query: StorefrontListQuery,
): Promise<StorefrontSummary[] | null> {
  const cacheKey = createNearbySnapshotKey(query);
  const cached = nearbySnapshotCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const rawValue = await AsyncStorage.getItem(cacheKey);
    if (!rawValue) {
      return null;
    }

    const snapshot = JSON.parse(rawValue) as StorefrontSummary[];
    nearbySnapshotCache.set(cacheKey, snapshot);
    pruneSnapshotCacheToLimit(nearbySnapshotCache, MAX_NEARBY_MEMORY_SNAPSHOTS);
    return snapshot;
  } catch {
    return null;
  }
}

export async function loadLatestNearbySummarySnapshot(): Promise<StorefrontSummary[] | null> {
  const latestNearbySnapshotKey = createLatestNearbySnapshotKey();
  const cached = latestNearbySnapshotCache.get(latestNearbySnapshotKey);
  if (cached?.length) {
    return cached;
  }

  try {
    const rawValue = await AsyncStorage.getItem(latestNearbySnapshotKey);
    if (!rawValue) {
      return null;
    }

    const snapshot = JSON.parse(rawValue) as StorefrontSummary[];
    latestNearbySnapshotCache.set(latestNearbySnapshotKey, snapshot);
    pruneSnapshotCacheToLimit(latestNearbySnapshotCache, MAX_LATEST_NEARBY_MEMORY_SNAPSHOTS);
    return snapshot;
  } catch {
    return null;
  }
}

export async function saveNearbySummarySnapshot(
  query: StorefrontListQuery,
  summaries: StorefrontSummary[],
): Promise<void> {
  const cacheKey = createNearbySnapshotKey(query);
  const latestNearbySnapshotKey = createLatestNearbySnapshotKey();
  nearbySnapshotCache.set(cacheKey, summaries);
  latestNearbySnapshotCache.set(latestNearbySnapshotKey, summaries);
  pruneSnapshotCacheToLimit(nearbySnapshotCache, MAX_NEARBY_MEMORY_SNAPSHOTS);
  pruneSnapshotCacheToLimit(latestNearbySnapshotCache, MAX_LATEST_NEARBY_MEMORY_SNAPSHOTS);

  try {
    const payload = JSON.stringify(summaries);
    await Promise.all([
      AsyncStorage.setItem(cacheKey, payload),
      AsyncStorage.setItem(latestNearbySnapshotKey, payload),
    ]);
    await trackStoredNearbySnapshotKeys([cacheKey, latestNearbySnapshotKey]);
  } catch {
    // Snapshot persistence should not block render flow.
  }
}
