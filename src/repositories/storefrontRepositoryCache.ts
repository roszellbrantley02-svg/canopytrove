import type {
  BrowseSummaryResult,
  StorefrontDetails,
  StorefrontListQuery,
  StorefrontSummary,
} from '../types/storefront';
import { getStorefrontMemberAccessCacheKey } from '../services/storefrontMemberDealAccessService';

type SummaryCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export const savedSummariesCache = new Map<string, SummaryCacheEntry<StorefrontSummary[]>>();
export const nearbySummariesCache = new Map<string, SummaryCacheEntry<StorefrontSummary[]>>();
export const browseSummariesCache = new Map<string, SummaryCacheEntry<BrowseSummaryResult>>();
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
export const SUMMARY_TTL_MS = 30_000;
export const DETAIL_TTL_MS = 60_000;
const MAX_SUMMARY_CACHE_ENTRIES = 48;
const MAX_DETAIL_CACHE_ENTRIES = 64;

function createDetailKey(storefrontId: string) {
  return `${storefrontId}::${getStorefrontMemberAccessCacheKey()}`;
}

function pruneMapToLimit<T>(cache: Map<string, T>, maxEntries: number) {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    cache.delete(oldestKey);
  }
}

function pruneExpiredDetailEntries() {
  const now = Date.now();
  Array.from(storefrontDetailsCache.entries()).forEach(([cacheKey, cached]) => {
    if (cached.expiresAt <= now) {
      storefrontDetailsCache.delete(cacheKey);
      storefrontDetailsInFlight.delete(cacheKey);
    }
  });
}

function getFreshSummaryValue<T>(cache: Map<string, SummaryCacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export async function resolveWithCache<T>(
  key: string,
  cache: Map<string, SummaryCacheEntry<T>>,
  inFlight: Map<string, Promise<T>>,
  loader: () => Promise<T>,
  ttlMs = SUMMARY_TTL_MS,
) {
  const cached = getFreshSummaryValue(cache, key);
  if (cached !== null) {
    return cached;
  }

  const current = inFlight.get(key);
  if (current) {
    return current;
  }

  const pending = loader()
    .then((value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      pruneMapToLimit(cache, MAX_SUMMARY_CACHE_ENTRIES);
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

function getFreshDetailEntry(storefrontId: string) {
  pruneExpiredDetailEntries();
  const detailKey = createDetailKey(storefrontId);
  if (!storefrontDetailsCache.has(detailKey)) {
    return {
      hit: false,
      value: null as StorefrontDetails | null,
    };
  }

  return {
    hit: true,
    value: storefrontDetailsCache.get(detailKey)?.value ?? null,
  };
}

export function getFreshDetail(storefrontId: string) {
  return getFreshDetailEntry(storefrontId).value;
}

export async function resolveDetailWithCache(
  storefrontId: string,
  loader: () => Promise<StorefrontDetails | null>,
  ttlMs: number | ((value: StorefrontDetails | null) => number) = DETAIL_TTL_MS,
) {
  const detailKey = createDetailKey(storefrontId);
  const cached = getFreshDetailEntry(storefrontId);
  if (cached.hit) {
    return cached.value;
  }

  const current = storefrontDetailsInFlight.get(detailKey);
  if (current) {
    return current;
  }

  const pending = loader()
    .then((value) => {
      const resolvedTtlMs = typeof ttlMs === 'function' ? ttlMs(value) : ttlMs;
      storefrontDetailsCache.set(detailKey, {
        value,
        expiresAt: Date.now() + resolvedTtlMs,
      });
      pruneMapToLimit(storefrontDetailsCache, MAX_DETAIL_CACHE_ENTRIES);
      storefrontDetailsInFlight.delete(detailKey);
      return value;
    })
    .catch((error) => {
      storefrontDetailsInFlight.delete(detailKey);
      throw error;
    });

  storefrontDetailsInFlight.set(detailKey, pending);
  return pending;
}

export function createSavedKey(storefrontIds: string[]) {
  return `${storefrontIds.join('|')}::${getStorefrontMemberAccessCacheKey()}`;
}

export function createNearbyKey(query: StorefrontListQuery) {
  return `${query.areaId ?? 'all'}::${query.searchQuery.trim().toLowerCase()}::${query.origin.latitude.toFixed(3)}::${query.origin.longitude.toFixed(3)}::${getStorefrontMemberAccessCacheKey()}`;
}

export function createBrowseKey(
  query: StorefrontListQuery,
  sortKey: string,
  limit: number,
  offset: number,
) {
  return `${query.areaId ?? 'all'}::${sortKey}::${query.searchQuery.trim().toLowerCase()}::${query.hotDealsOnly ? 'deals' : 'all'}::${query.origin.latitude.toFixed(3)}::${query.origin.longitude.toFixed(3)}::${limit}::${offset}::${getStorefrontMemberAccessCacheKey()}`;
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

export function primeStorefrontDetailsCache(
  storefrontId: string,
  detail: StorefrontDetails | null,
) {
  const detailKey = createDetailKey(storefrontId);
  if (!detail) {
    storefrontDetailsCache.delete(detailKey);
    storefrontDetailsInFlight.delete(detailKey);
    return;
  }

  storefrontDetailsCache.set(detailKey, {
    value: detail,
    expiresAt: Date.now() + DETAIL_TTL_MS,
  });
  storefrontDetailsInFlight.delete(detailKey);
}

export function invalidateStorefrontDetailsCache(storefrontId: string) {
  const detailKey = createDetailKey(storefrontId);
  storefrontDetailsCache.delete(detailKey);
  storefrontDetailsInFlight.delete(detailKey);
}
