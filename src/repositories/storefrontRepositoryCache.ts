import { BrowseSummaryResult, StorefrontDetails, StorefrontListQuery, StorefrontSummary } from '../types/storefront';

export const savedSummariesCache = new Map<string, StorefrontSummary[]>();
export const nearbySummariesCache = new Map<string, StorefrontSummary[]>();
export const browseSummariesCache = new Map<string, BrowseSummaryResult>();
export const storefrontDetailsCache = new Map<
  string,
  { expiresAt: number; value: StorefrontDetails | null }
>();

export const savedSummariesInFlight = new Map<string, Promise<StorefrontSummary[]>>();
export const nearbySummariesInFlight = new Map<string, Promise<StorefrontSummary[]>>();
export const browseSummariesInFlight = new Map<string, Promise<BrowseSummaryResult>>();
export const storefrontDetailsInFlight = new Map<string, Promise<StorefrontDetails | null>>();

export const NEARBY_RADIUS_MILES = 35;
export const BROWSE_RADIUS_MILES = 120;
export const DETAIL_TTL_MS = 60_000;

export async function resolveWithCache<T>(
  key: string,
  cache: Map<string, T>,
  inFlight: Map<string, Promise<T>>,
  loader: () => Promise<T>
) {
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const current = inFlight.get(key);
  if (current) {
    return current;
  }

  const pending = loader()
    .then((value) => {
      cache.set(key, value);
      inFlight.delete(key);
      return value;
    })
    .catch((error) => {
      inFlight.delete(key);
      throw error;
    });

  inFlight.set(key, pending);
  return pending;
}

export function getFreshDetail(storefrontId: string) {
  const cached = storefrontDetailsCache.get(storefrontId);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) {
      storefrontDetailsCache.delete(storefrontId);
    }
    return null;
  }

  return cached.value;
}

export async function resolveDetailWithCache(
  storefrontId: string,
  loader: () => Promise<StorefrontDetails | null>,
  ttlMs: number | ((value: StorefrontDetails | null) => number) = DETAIL_TTL_MS
) {
  const cached = getFreshDetail(storefrontId);
  if (cached) {
    return cached;
  }

  const current = storefrontDetailsInFlight.get(storefrontId);
  if (current) {
    return current;
  }

  const pending = loader()
    .then((value) => {
      const resolvedTtlMs = typeof ttlMs === 'function' ? ttlMs(value) : ttlMs;
      storefrontDetailsCache.set(storefrontId, {
        value,
        expiresAt: Date.now() + resolvedTtlMs,
      });
      storefrontDetailsInFlight.delete(storefrontId);
      return value;
    })
    .catch((error) => {
      storefrontDetailsInFlight.delete(storefrontId);
      throw error;
    });

  storefrontDetailsInFlight.set(storefrontId, pending);
  return pending;
}

export function createSavedKey(storefrontIds: string[]) {
  return storefrontIds.join('|');
}

export function createNearbyKey(query: StorefrontListQuery) {
  return `${query.areaId}::${query.searchQuery.trim().toLowerCase()}::${query.origin.latitude.toFixed(3)}::${query.origin.longitude.toFixed(3)}`;
}

export function createBrowseKey(
  query: StorefrontListQuery,
  sortKey: string,
  limit: number,
  offset: number
) {
  return `${query.areaId}::${sortKey}::${query.searchQuery.trim().toLowerCase()}::${query.hotDealsOnly ? 'deals' : 'all'}::${query.origin.latitude.toFixed(3)}::${query.origin.longitude.toFixed(3)}::${limit}::${offset}`;
}

export function clearStorefrontRepositoryCacheEntries() {
  savedSummariesCache.clear();
  nearbySummariesCache.clear();
  browseSummariesCache.clear();
  storefrontDetailsCache.clear();
  savedSummariesInFlight.clear();
  nearbySummariesInFlight.clear();
  browseSummariesInFlight.clear();
  storefrontDetailsInFlight.clear();
}

export function primeStorefrontDetailsCache(storefrontId: string, detail: StorefrontDetails | null) {
  if (!detail) {
    storefrontDetailsCache.delete(storefrontId);
    storefrontDetailsInFlight.delete(storefrontId);
    return;
  }

  storefrontDetailsCache.set(storefrontId, {
    value: detail,
    expiresAt: Date.now() + DETAIL_TTL_MS,
  });
  storefrontDetailsInFlight.delete(storefrontId);
}

export function invalidateStorefrontDetailsCache(storefrontId: string) {
  storefrontDetailsCache.delete(storefrontId);
  storefrontDetailsInFlight.delete(storefrontId);
}
