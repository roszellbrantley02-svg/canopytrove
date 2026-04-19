import { getBackendFirebaseDb } from '../firebase';
import { clearFirestoreStorefrontSourceCache } from '../sources/firestoreStorefrontSource';
import { clearStorefrontBackendCache } from './storefrontCacheService';

export type GooglePlacesPaymentOptions = {
  acceptsCreditCards?: boolean | null;
  acceptsDebitCards?: boolean | null;
  acceptsCashOnly?: boolean | null;
  acceptsNfcPayments?: boolean | null;
};

export type GooglePlacesEnrichment = {
  phone: string | null;
  website: string | null;
  hours: string[];
  openNow: boolean | null;
  hoursSource?: 'google' | 'website';
  businessStatus?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  /**
   * Raw Places paymentOptions flags. Probe (2026-04): 100% populated
   * for NY dispensaries. Note: `acceptsCreditCards=true` is often
   * suggestive rather than authoritative because Visa/Mastercard
   * don't permit cannabis MCCs. Treat `acceptsNfcPayments` as
   * absent unless owner-declared.
   */
  paymentOptions?: GooglePlacesPaymentOptions | null;
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
    weekdayDescriptions?: string[];
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
  paymentOptions?: GooglePlacesPaymentOptions;
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
export const PLACE_ID_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const DETAIL_TTL_MS = 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 2_000;
export const SUMMARY_COLLECTION = 'storefront_summaries';
export const BACKGROUND_CONCURRENCY = 2;
const PLACE_ID_CACHE_LIMIT = 1024;
const STOREFRONT_ENRICHMENT_CACHE_LIMIT = 512;
const DETAIL_CACHE_LIMIT = 512;
const IN_FLIGHT_MAX_AGE_MS = 5_000;
const GOOGLE_PLACES_AUTH_BACKOFF_MS = 60_000;
const GOOGLE_PLACES_TRANSIENT_BACKOFF_MS = 15_000;

/**
 * Daily API call budget — hard cap to prevent runaway billing.
 * 50 calls/day keeps the monthly bill under ~$3. Most storefronts already
 * have Place IDs after the first discovery run, so ongoing spend is minimal.
 * Override with GOOGLE_PLACES_DAILY_BUDGET env var if needed.
 *
 * IMPORTANT: This counter is persisted in Firestore so it's shared across
 * all Cloud Run instances. In-memory counters reset on cold start, which
 * means multiple instances each get their own budget — defeating the cap.
 */
const DAILY_API_CALL_BUDGET = Number(process.env.GOOGLE_PLACES_DAILY_BUDGET) || 50;
const BUDGET_COLLECTION = 'system_budgets';
const BUDGET_DOC_ID = 'google_places_daily';

// Local shadow of the Firestore counter — avoids a DB read on every API call.
// Synced from Firestore on first use and after each increment.
let dailyApiCallCount = 0;
let dailyApiCallDateKey = '';
let budgetSyncedFromFirestore = false;

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

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-04-07"
}

function getBudgetDb() {
  if (process.env.NODE_ENV === 'test' && googlePlacesDbForTests) {
    return googlePlacesDbForTests;
  }
  return getBackendFirebaseDb();
}

async function syncBudgetFromFirestore() {
  const db = getBudgetDb();
  if (!db) {
    // No Firestore — fall back to in-memory (local dev)
    return;
  }

  try {
    const todayKey = getTodayDateKey();
    const doc = await db.collection(BUDGET_COLLECTION).doc(BUDGET_DOC_ID).get();
    const data = doc.data() as { dateKey?: string; count?: number } | undefined;

    if (data?.dateKey === todayKey) {
      dailyApiCallCount = data.count ?? 0;
    } else {
      // New day or no doc yet — reset
      dailyApiCallCount = 0;
    }
    dailyApiCallDateKey = todayKey;
    budgetSyncedFromFirestore = true;
  } catch {
    // Firestore read failed — use local count as safety fallback
    budgetSyncedFromFirestore = false;
  }
}

async function incrementBudgetInFirestore() {
  const db = getBudgetDb();
  if (!db) return;

  const todayKey = getTodayDateKey();
  try {
    await db.collection(BUDGET_COLLECTION).doc(BUDGET_DOC_ID).set(
      {
        dateKey: todayKey,
        count: dailyApiCallCount,
        updatedAt: new Date().toISOString(),
        limit: DAILY_API_CALL_BUDGET,
      },
      { merge: true },
    );
  } catch {
    // Write failed — local counter still protects this instance
  }
}

function resetDailyBudgetIfNeeded() {
  const todayKey = getTodayDateKey();
  if (dailyApiCallDateKey !== todayKey) {
    dailyApiCallCount = 0;
    dailyApiCallDateKey = todayKey;
    budgetSyncedFromFirestore = false;
  }
}

/**
 * Record an API call against the daily budget. Returns `true` if the call
 * is within budget, `false` if the budget has been exhausted.
 *
 * On first call each day (or after cold start), syncs the count from
 * Firestore so all Cloud Run instances share a single budget.
 */
export async function consumeDailyApiBudget(): Promise<boolean> {
  resetDailyBudgetIfNeeded();

  // Sync from Firestore on first use to pick up counts from other instances
  if (!budgetSyncedFromFirestore) {
    await syncBudgetFromFirestore();
  }

  if (dailyApiCallCount >= DAILY_API_CALL_BUDGET) {
    return false;
  }
  dailyApiCallCount += 1;

  // Persist to Firestore so other instances see the updated count.
  // Fire-and-forget — don't block the API call on the write.
  void incrementBudgetInFirestore();

  return true;
}

export function getDailyApiBudgetStatus() {
  resetDailyBudgetIfNeeded();
  return {
    used: dailyApiCallCount,
    limit: DAILY_API_CALL_BUDGET,
    remaining: Math.max(0, DAILY_API_CALL_BUDGET - dailyApiCallCount),
    resetsAt: getTodayDateKey() + 'T24:00:00.000Z',
  };
}

export function hasGooglePlacesConfig() {
  resetDailyBudgetIfNeeded();
  return (
    Boolean(GOOGLE_MAPS_API_KEY) &&
    Date.now() >= googlePlacesDegradedUntilMs &&
    dailyApiCallCount < DAILY_API_CALL_BUDGET
  );
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
  maxSize: number,
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
  loader: () => Promise<T>,
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

  return value.map((entry) => entry.trim()).filter(Boolean);
}

export async function persistPlaceId(storefrontId: string, placeId: string) {
  const db =
    process.env.NODE_ENV === 'test' && googlePlacesDbForTests
      ? googlePlacesDbForTests
      : getBackendFirebaseDb();
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
      },
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
  dailyApiCallCount = 0;
  dailyApiCallDateKey = '';
  budgetSyncedFromFirestore = false;
}

export const googlePlacesCacheLimits = {
  placeId: PLACE_ID_CACHE_LIMIT,
  storefrontEnrichment: STOREFRONT_ENRICHMENT_CACHE_LIMIT,
  detail: DETAIL_CACHE_LIMIT,
};
