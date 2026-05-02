/**
 * Storefront Route-Heat Service.
 *
 * Reads the per-storefront-per-hour route-start counters that the
 * analytics ingestion path writes (see analyticsEventService
 * applyHourlyRouteStartMetric) and exposes them to the storefront
 * enrichment pipeline as a `routeStartsPerHour` value attached to
 * each summary.
 *
 * That value drives the heat-glow visual on storefront cards
 * (StorefrontHeatGlow.tsx) — the more route-starts in the current
 * clock hour, the brighter and faster the glow pulses.
 *
 * Design notes:
 *
 *   - We use the *current clock hour* bucket only — not a rolling
 *     60-minute window. That's intentional. Strict-hour buckets are
 *     a single Firestore read per storefront and naturally bound the
 *     write fan-out (one doc per shop per hour, never more). Rolling
 *     windows would need 2 reads + math, and the visual feels
 *     identical in practice — heat fades smoothly because the React
 *     animation handles transitions between heat levels regardless
 *     of how the underlying number changes.
 *
 *   - We cache the bulk-loaded counters in-process for 60 seconds.
 *     Storefront cards re-render frequently (scroll, filter changes,
 *     pull-to-refresh) — re-reading 20 hour-bucket docs from
 *     Firestore on every render would be wasteful. 60s staleness is
 *     invisible to the eye since the heat animation already smooths
 *     transitions.
 *
 *   - Reads are fail-soft. If Firestore is unavailable or the
 *     in-process cache misses without a successful refresh, we
 *     return 0 for every storefront. The frontend then renders no
 *     heat glow, which is the same as today's behavior.
 *
 *   - Bulk reads use Firestore's `getAll` (multi-doc batch get) so
 *     N storefronts cost a single round-trip instead of N round-trips.
 *     Documented limit is 500 docs per batch — well above any single
 *     listing-page size.
 */

import { logger } from '../observability/logger';
import { getBackendFirebaseDb } from '../firebase';
import { HOURLY_STOREFRONT_ROUTES_COLLECTION } from '../constants/collections';
import { createHourBucketKey, createHourlyStorefrontRouteId } from './analyticsEventService';

const CACHE_TTL_MS = 60 * 1_000; // 60 seconds — see Design notes above
const READ_TIMEOUT_MS = 1_500;

type HeatCacheEntry = {
  bucketKey: string;
  /** routeStartCount keyed by storefrontId for the bucket. */
  counts: Map<string, number>;
  fetchedAt: number;
};

const heatCache: Map<string, HeatCacheEntry> = new Map();

function nowMs(): number {
  return Date.now();
}

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), READ_TIMEOUT_MS)),
  ]);
}

/**
 * Bulk-load route-start counts for the current clock hour for the
 * given storefront IDs. Returns a Map keyed by storefrontId.
 * Storefronts with no counter doc (no route-starts this hour) are
 * absent from the returned map — callers should treat absence as 0.
 *
 * Uses an in-process cache keyed on the bucket key (YYYYMMDDHH) so
 * concurrent listing-page renders share the same fetch.
 */
export async function loadRouteStartsForCurrentHour(
  storefrontIds: string[],
): Promise<Map<string, number>> {
  if (!storefrontIds.length) return new Map();

  const bucketKey = createHourBucketKey(new Date().toISOString());
  const cached = heatCache.get(bucketKey);

  // Cache hit: return only the requested IDs from the cached map.
  if (cached && nowMs() - cached.fetchedAt < CACHE_TTL_MS) {
    const result = new Map<string, number>();
    for (const id of storefrontIds) {
      const value = cached.counts.get(id);
      if (typeof value === 'number' && value > 0) {
        result.set(id, value);
      }
    }
    return result;
  }

  // Cache miss or expired: fetch fresh.
  const db = getBackendFirebaseDb();
  if (!db) return new Map();

  try {
    const refs = storefrontIds.map((storefrontId) =>
      db
        .collection(HOURLY_STOREFRONT_ROUTES_COLLECTION)
        .doc(createHourlyStorefrontRouteId(storefrontId, bucketKey)),
    );
    const snaps = await withTimeout(db.getAll(...refs), []);
    const counts = new Map<string, number>();
    snaps.forEach((snap, i) => {
      if (!snap.exists) return;
      const data = snap.data() as { routeStartCount?: number } | undefined;
      const count = typeof data?.routeStartCount === 'number' ? data.routeStartCount : 0;
      if (count > 0) {
        counts.set(storefrontIds[i], count);
      }
    });

    // Update cache. We replace the entry rather than merge — every fetch
    // covers the full set of requested IDs, but a missing entry in the
    // new fetch should evict any stale value from the cache. Storing
    // only the IDs we just fetched keeps the cache size bounded by
    // recent listing pages.
    heatCache.set(bucketKey, {
      bucketKey,
      counts,
      fetchedAt: nowMs(),
    });

    // Evict any cache entries for older buckets — they're stale by
    // definition once the clock ticks to a new hour.
    for (const key of heatCache.keys()) {
      if (key !== bucketKey) {
        heatCache.delete(key);
      }
    }

    return counts;
  } catch (err) {
    logger.warn('storefrontRouteHeat: bulk load failed', {
      err: err instanceof Error ? err.message : String(err),
      bucketKey,
      storefrontCount: storefrontIds.length,
    });
    return new Map();
  }
}

/**
 * Attach `routeStartsPerHour` to each storefront summary in the page.
 * Always returns the input items (with the field added when we have
 * a count). Fails soft — never blocks or rejects the calling pipeline.
 */
export async function attachRouteHeatToSummaries<
  T extends { id: string; routeStartsPerHour?: number | null },
>(items: T[]): Promise<T[]> {
  if (!items.length) return items;
  try {
    const ids = items.map((item) => item.id);
    const counts = await loadRouteStartsForCurrentHour(ids);
    if (counts.size === 0) return items;
    return items.map((item) => {
      const count = counts.get(item.id);
      if (typeof count !== 'number' || count <= 0) return item;
      return { ...item, routeStartsPerHour: count };
    });
  } catch (err) {
    logger.warn('storefrontRouteHeat: enrichment failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return items;
  }
}

/**
 * Single-storefront variant for the detail screen enrichment path.
 */
export async function attachRouteHeatToDetail<
  T extends { storefrontId: string; routeStartsPerHour?: number | null },
>(detail: T): Promise<T> {
  try {
    const counts = await loadRouteStartsForCurrentHour([detail.storefrontId]);
    const count = counts.get(detail.storefrontId);
    if (typeof count !== 'number' || count <= 0) return detail;
    return { ...detail, routeStartsPerHour: count };
  } catch (err) {
    logger.warn('storefrontRouteHeat: detail enrichment failed', {
      err: err instanceof Error ? err.message : String(err),
      storefrontId: detail.storefrontId,
    });
    return detail;
  }
}

/** Test-only: clear the in-process cache between cases. */
export function clearStorefrontRouteHeatCacheForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  heatCache.clear();
}
