import {
  LocationResolutionApiResponse,
  StorefrontDetailApiDocument,
  StorefrontSummariesApiResponse,
  StorefrontSummaryApiDocument,
  StorefrontSummarySortKey,
} from '../types';
import { Coordinates } from '../types';

type StorefrontSummaryQueryKey = {
  areaId?: string;
  searchQuery?: string;
  origin?: Coordinates;
  radiusMiles?: number;
  sortKey?: StorefrontSummarySortKey;
  limit?: number;
  offset?: number;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const SUMMARY_TTL_MS = 30_000;
const DETAIL_TTL_MS = 60_000;
const LOCATION_TTL_MS = 300_000;

const summaryPageCache = new Map<string, CacheEntry<StorefrontSummariesApiResponse>>();
const summaryPageInFlight = new Map<string, Promise<StorefrontSummariesApiResponse>>();
const summariesByIdsCache = new Map<string, CacheEntry<StorefrontSummaryApiDocument[]>>();
const summariesByIdsInFlight = new Map<string, Promise<StorefrontSummaryApiDocument[]>>();
const detailCache = new Map<string, CacheEntry<StorefrontDetailApiDocument | null>>();
const detailInFlight = new Map<string, Promise<StorefrontDetailApiDocument | null>>();
const locationCache = new Map<string, CacheEntry<LocationResolutionApiResponse>>();
const locationInFlight = new Map<string, Promise<LocationResolutionApiResponse>>();

function isFresh<T>(entry?: CacheEntry<T>) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

async function resolveCached<T>(
  key: string,
  cache: Map<string, CacheEntry<T>>,
  inFlight: Map<string, Promise<T>>,
  ttlMs: number,
  loader: () => Promise<T>
) {
  const cached = cache.get(key);
  if (isFresh(cached)) {
    return cached!.value;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const next = loader()
    .then((value) => {
      setCache(cache, key, value, ttlMs);
      inFlight.delete(key);
      return value;
    })
    .catch((error) => {
      inFlight.delete(key);
      throw error;
    });

  inFlight.set(key, next);
  return next;
}

function normalizeQueryValue(value?: string) {
  return value?.trim().toLowerCase() || '';
}

function createSummaryQueryCacheKey(query: StorefrontSummaryQueryKey) {
  return JSON.stringify({
    areaId: query.areaId ?? '',
    searchQuery: normalizeQueryValue(query.searchQuery),
    origin: query.origin
      ? {
          latitude: Number(query.origin.latitude.toFixed(4)),
          longitude: Number(query.origin.longitude.toFixed(4)),
        }
      : null,
    radiusMiles: query.radiusMiles ?? null,
    sortKey: query.sortKey ?? 'distance',
    limit: query.limit ?? null,
    offset: query.offset ?? 0,
  });
}

function createIdsCacheKey(ids: string[]) {
  return [...ids].sort().join('|');
}

export function clearStorefrontBackendCache() {
  summaryPageCache.clear();
  summaryPageInFlight.clear();
  summariesByIdsCache.clear();
  summariesByIdsInFlight.clear();
  detailCache.clear();
  detailInFlight.clear();
  locationCache.clear();
  locationInFlight.clear();
}

export function getCachedStorefrontSummaryPage(
  query: StorefrontSummaryQueryKey,
  loader: () => Promise<StorefrontSummariesApiResponse>
) {
  return resolveCached(
    createSummaryQueryCacheKey(query),
    summaryPageCache,
    summaryPageInFlight,
    SUMMARY_TTL_MS,
    loader
  );
}

export function getCachedStorefrontSummariesByIds(
  ids: string[],
  loader: () => Promise<StorefrontSummaryApiDocument[]>
) {
  return resolveCached(
    createIdsCacheKey(ids),
    summariesByIdsCache,
    summariesByIdsInFlight,
    SUMMARY_TTL_MS,
    loader
  );
}

export function getCachedStorefrontDetail(
  storefrontId: string,
  loader: () => Promise<StorefrontDetailApiDocument | null>,
  ttlMs = DETAIL_TTL_MS
) {
  return resolveCached(storefrontId, detailCache, detailInFlight, ttlMs, loader);
}

export function invalidateCachedStorefrontDetail(storefrontId: string) {
  detailCache.delete(storefrontId);
  detailInFlight.delete(storefrontId);
}

export function getCachedLocationResolution(
  query: string,
  loader: () => Promise<LocationResolutionApiResponse>
) {
  return resolveCached(
    normalizeQueryValue(query),
    locationCache,
    locationInFlight,
    LOCATION_TTL_MS,
    loader
  );
}
