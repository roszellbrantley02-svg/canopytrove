import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorefrontDetails } from '../types/storefront';
import {
  createDetailSnapshotKey,
  normalizeDetailSnapshot,
  pruneSnapshotCacheToLimit,
  trackStoredDetailSnapshotKey,
} from './storefrontSnapshotShared';

const detailSnapshotCache = new Map<string, StorefrontDetails>();
const detailSnapshotListeners = new Map<string, Set<(detail: StorefrontDetails | null) => void>>();
const MAX_DETAIL_MEMORY_SNAPSHOTS = 48;

function notifyDetailSnapshotListeners(storefrontId: string, detail: StorefrontDetails | null) {
  const listeners = detailSnapshotListeners.get(storefrontId);
  if (!listeners?.size) {
    return;
  }

  listeners.forEach((listener) => {
    listener(detail);
  });
}

export function getCachedStorefrontDetailSnapshot(storefrontId: string) {
  return detailSnapshotCache.get(createDetailSnapshotKey(storefrontId)) ?? null;
}

export function subscribeToStorefrontDetailSnapshot(
  storefrontId: string,
  listener: (detail: StorefrontDetails | null) => void,
) {
  const currentListeners = detailSnapshotListeners.get(storefrontId) ?? new Set();
  currentListeners.add(listener);
  detailSnapshotListeners.set(storefrontId, currentListeners);

  return () => {
    const nextListeners = detailSnapshotListeners.get(storefrontId);
    if (!nextListeners) {
      return;
    }

    nextListeners.delete(listener);
    if (!nextListeners.size) {
      detailSnapshotListeners.delete(storefrontId);
    }
  };
}

export async function loadStorefrontDetailSnapshot(
  storefrontId: string,
): Promise<StorefrontDetails | null> {
  const cacheKey = createDetailSnapshotKey(storefrontId);
  const cached = detailSnapshotCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const rawValue = await AsyncStorage.getItem(cacheKey);
    if (!rawValue) {
      return null;
    }

    const snapshot = normalizeDetailSnapshot(JSON.parse(rawValue) as StorefrontDetails);
    detailSnapshotCache.set(cacheKey, snapshot);
    pruneSnapshotCacheToLimit(detailSnapshotCache, MAX_DETAIL_MEMORY_SNAPSHOTS);
    return snapshot;
  } catch {
    return null;
  }
}

export async function saveStorefrontDetailSnapshot(
  storefrontId: string,
  detail: StorefrontDetails | null,
): Promise<void> {
  if (!detail) {
    return;
  }

  const cacheKey = createDetailSnapshotKey(storefrontId);
  const normalizedDetail = normalizeDetailSnapshot(detail);
  detailSnapshotCache.set(cacheKey, normalizedDetail);
  pruneSnapshotCacheToLimit(detailSnapshotCache, MAX_DETAIL_MEMORY_SNAPSHOTS);
  notifyDetailSnapshotListeners(storefrontId, normalizedDetail);

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(normalizedDetail));
    await trackStoredDetailSnapshotKey(cacheKey);
  } catch {
    // Snapshot persistence should not block render flow.
  }
}
