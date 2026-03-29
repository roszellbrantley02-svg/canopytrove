import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorefrontListQuery, StorefrontSummary } from '../types/storefront';
import {
  createNearbySnapshotKey,
  LATEST_NEARBY_SNAPSHOT_KEY,
} from './storefrontSnapshotShared';

const nearbySnapshotCache = new Map<string, StorefrontSummary[]>();
let latestNearbySnapshotCache: StorefrontSummary[] | null = null;

export function getCachedNearbySummarySnapshot(query: StorefrontListQuery) {
  return nearbySnapshotCache.get(createNearbySnapshotKey(query)) ?? null;
}

export function getCachedLatestNearbySummarySnapshot() {
  return latestNearbySnapshotCache;
}

export async function loadNearbySummarySnapshot(
  query: StorefrontListQuery
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
    return snapshot;
  } catch {
    return null;
  }
}

export async function loadLatestNearbySummarySnapshot(): Promise<StorefrontSummary[] | null> {
  if (latestNearbySnapshotCache?.length) {
    return latestNearbySnapshotCache;
  }

  try {
    const rawValue = await AsyncStorage.getItem(LATEST_NEARBY_SNAPSHOT_KEY);
    if (!rawValue) {
      return null;
    }

    const snapshot = JSON.parse(rawValue) as StorefrontSummary[];
    latestNearbySnapshotCache = snapshot;
    return snapshot;
  } catch {
    return null;
  }
}

export async function saveNearbySummarySnapshot(
  query: StorefrontListQuery,
  summaries: StorefrontSummary[]
): Promise<void> {
  const cacheKey = createNearbySnapshotKey(query);
  nearbySnapshotCache.set(cacheKey, summaries);
  latestNearbySnapshotCache = summaries;

  try {
    const payload = JSON.stringify(summaries);
    await Promise.all([
      AsyncStorage.setItem(cacheKey, payload),
      AsyncStorage.setItem(LATEST_NEARBY_SNAPSHOT_KEY, payload),
    ]);
  } catch {
    // Snapshot persistence should not block render flow.
  }
}
