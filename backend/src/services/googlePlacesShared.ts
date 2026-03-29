import { getBackendFirebaseDb } from '../firebase';

export type GooglePlacesEnrichment = {
  phone: string | null;
  website: string | null;
  hours: string[];
  openNow: boolean | null;
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
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  currentOpeningHours?: {
    openNow?: boolean;
  };
};

export type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
export const PLACE_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DETAIL_TTL_MS = 15 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 2_000;
export const SUMMARY_COLLECTION = 'storefront_summaries';
export const BACKGROUND_CONCURRENCY = 2;

let googlePlacesConfigEnabled = Boolean(GOOGLE_MAPS_API_KEY);

export const placeIdCache = new Map<string, CacheEntry<string | null>>();
export const placeIdInFlight = new Map<string, Promise<string | null>>();
export const storefrontEnrichmentCache = new Map<
  string,
  CacheEntry<GooglePlacesEnrichment | null>
>();
export const storefrontEnrichmentInFlight = new Map<
  string,
  Promise<GooglePlacesEnrichment | null>
>();
export const detailCache = new Map<string, CacheEntry<GooglePlacesEnrichment | null>>();
export const detailInFlight = new Map<string, Promise<GooglePlacesEnrichment | null>>();

export function hasGooglePlacesConfig() {
  return Boolean(GOOGLE_MAPS_API_KEY) && googlePlacesConfigEnabled;
}

export function disableGooglePlacesConfig() {
  googlePlacesConfigEnabled = false;
}

export function resetGooglePlacesConfig() {
  googlePlacesConfigEnabled = Boolean(GOOGLE_MAPS_API_KEY);
}

export function isFresh<T>(entry?: CacheEntry<T>) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

export function setCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function resolveCached<T>(
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

export function normalizeHours(value: string[] | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function persistPlaceId(storefrontId: string, placeId: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return;
  }

  try {
    await db.collection(SUMMARY_COLLECTION).doc(storefrontId).set(
      {
        placeId,
      },
      {
        merge: true,
      }
    );
  } catch {
    // Place ID persistence should not block response flow.
  }
}

export function clearGooglePlacesCaches() {
  resetGooglePlacesConfig();
  placeIdCache.clear();
  placeIdInFlight.clear();
  storefrontEnrichmentCache.clear();
  storefrontEnrichmentInFlight.clear();
  detailCache.clear();
  detailInFlight.clear();
}
