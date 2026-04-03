import { getBackendFirebaseDb } from '../firebase';
import { clearFirestoreStorefrontSourceCache } from '../sources/firestoreStorefrontSource';
import { clearStorefrontBackendCache } from './storefrontCacheService';

export type GooglePlacesEnrichment = {
  phone: string | null;
  website: string | null;
  hours: string[];
  openNow: boolean | null;
  businessStatus?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
};

export type GoogleSearchPlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
};

export type GooglePlaceDetailResponse = {
  id?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  businessStatus?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  currentOpeningHours?: {
    openNow?: boolean;
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type InFlightEntry<T> = {
  startedAt: number;
  promise: Promise<T>;
};

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
export const PLACE_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DETAIL_TTL_MS = 15 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 2_000;
export const SUMMARY_COLLECTION = 'storefront_summaries';
export const BACKGROUND_CONCURRENCY = 2;
const PLACE_ID_CACHE_LIMIT = 1024;
const STOREFRONT_ENRICHMENT_CACHE_LIMIT = 512;
const DETAIL_CACHE_LIMIT = 512;
const IN_FLIGHT_MAX_AGE_MS = 5_000;
const GOOGLE_PLACES_AUTH_BACKOFF_MS = 60_000;
const GOOGLE_PLACES_TRANSIENT_BACKOFF_MS = 15_000;

type GooglePlacesDbLike = NonNullable<ReturnType<typeof getBackendFirebaseDb>>;

let googlePlacesDegradedUntilMs = 0;
let googlePlacesLastFailureStatus: number | null = null;
let googlePlacesDbForTests: GooglePlacesDbLike | null = null;

export const placeIdCache = new Map<string, CacheEntry<string | null>>();
export const placeIdInFlight = new Map<string, InFlightEntry<string | null>>();
export const storefrontEnrichmentCache = new Map<
  string,
  CacheEntry<GooglePlacesEnrichment | null>
>();
export const storefrontEnrichmentInFlight = new Map<
  string,
  InFlightEntry<GooglePlacesEnrichment | null>
>();
export const detailCache = new Map<string, CacheEntry<GooglePlacesEnrichment | null>>();
export const detailInFlight = new Map<string, InFlightEntry<GooglePlacesEnrichment | null>>();

export function hasGooglePlacesConfig() {
  return Boolean(GOOGLE_MAPS_API_KEY) && Date.now() >= googlePlacesDegradedUntilMs;
}

export function markGooglePlacesConfigTemporarilyUnavailable(statusCode?: number | null) {
  const backoffMs =
    statusCode === 401 || statusCode === 403
      ? GOOGLE_PLACES_AUTH_BACKOFF_MS
      : GOOGLE_PLACES_TRANSIENT_BACKOFF_MS;
  googlePlacesLastFailureStatus = statusCode ?? null;
  googlePlacesDegradedUntilMs = Math.max(googlePlacesDegradedUntilMs, Date.now() + backoffMs);
}

export function markGooglePlacesConfigHealthy() {
  googlePlacesDegradedUntilMs = 0;
  googlePlacesLastFailureStatus = null;
}

export function resetGooglePlacesConfig() {
  markGooglePlacesConfigHealthy();
}

export function getGooglePlacesRuntimeStateForTests() {
  return {
    degradedUntilMs: googlePlacesDegradedUntilMs,
    lastFailureStatus: googlePlacesLastFailureStatus,
  };
}

export function setGooglePlacesDbForTests(db: GooglePlacesDbLike | null) {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  googlePlacesDbForTests = db;
}

export function isFresh<T>(entry?: CacheEntry<T>) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function pruneCache<T>(cache: Map<string, CacheEntry<T>>, maxSize: number, now = Date.now()) {
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  });

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    cache.delete(oldestKey);
  }
}

export function setCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxSize: number
) {
  cache.delete(key);
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  pruneCache(cache, maxSize);
}

export async function resolveCached<T>(
  key: string,
  cache: Map<string, CacheEntry<T>>,
  inFlight: Map<string, InFlightEntry<T>>,
  ttlMs: number,
  maxSize: number,
  loader: () => Promise<T>
) {
  pruneCache(cache, maxSize);
  const cached = cache.get(key);
  if (isFresh(cached)) {
    return cached!.value;
  }

  if (cached) {
    cache.delete(key);
  }

  const pending = inFlight.get(key);
  if (pending) {
    if (Date.now() - pending.startedAt <= IN_FLIGHT_MAX_AGE_MS) {
      return pending.promise;
    }

    inFlight.delete(key);
  }

  const next = loader()
    .then((value) => {
      setCache(cache, key, value, ttlMs, maxSize);
      inFlight.delete(key);
      return value;
    })
    .catch((error) => {
      inFlight.delete(key);
      throw error;
    });

  inFlight.set(key, {
    startedAt: Date.now(),
    promise: next,
  });
  return next;
}

export function normalizeHours(value: string[] | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function persistPlaceId(storefrontId: string, placeId: string) {
  const db =
    process.env.NODE_ENV === 'test' && googlePlacesDbForTests ? googlePlacesDbForTests : getBackendFirebaseDb();
  if (!db) {
    return;
  }

  try {
    const summaryDocumentRef = db.collection(SUMMARY_COLLECTION).doc(storefrontId);
    const summarySnapshot = await summaryDocumentRef.get();
    if (!summarySnapshot.exists) {
      return;
    }

    await summaryDocumentRef.set(
      {
        placeId,
      },
      {
        merge: true,
      }
    );
    clearFirestoreStorefrontSourceCache();
    clearStorefrontBackendCache();
  } catch {
    // Place ID persistence should not block response flow.
  }
}

export function clearGooglePlacesCaches() {
  resetGooglePlacesConfig();
  googlePlacesDbForTests = null;
  placeIdCache.clear();
  placeIdInFlight.clear();
  storefrontEnrichmentCache.clear();
  storefrontEnrichmentInFlight.clear();
  detailCache.clear();
  detailInFlight.clear();
}

export const googlePlacesCacheLimits = {
  placeId: PLACE_ID_CACHE_LIMIT,
  storefrontEnrichment: STOREFRONT_ENRICHMENT_CACHE_LIMIT,
  detail: DETAIL_CACHE_LIMIT,
};
