/**
 * Brand Analytics Service
 *
 * Read-only analytics for product scans.
 * Queries the `brandCounters` and `productScans` collections.
 *
 * Provides:
 *   - Trending brands by recent scans
 *   - Brand activity near a storefront
 *   - Time series data for a brand
 *
 * Caches results in-memory for 5 minutes to reduce Firestore reads.
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import type { BrandCounter } from '../types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STOREFRONT_RADIUS_KM = 10;

// Cap the raw scan rows we pull per query. Without this, a hot brand or a
// dense metro with thousands of recent scans causes Firestore reads to
// balloon + memory to spike + p95 latency to degrade. 5k is generous — any
// trend windows exceeding this are noise for analytics purposes; we sample.
const SCAN_QUERY_LIMIT = 5000;

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

type CacheState = {
  trendingBrands: Map<string, CacheEntry<TrendingBrand[]>>;
  brandActivity: Map<string, CacheEntry<BrandActivityNearStorefront[]>>;
  brandTimeSeries: Map<string, CacheEntry<BrandActivitySnapshot[]>>;
};

const cache: CacheState = {
  trendingBrands: new Map(),
  brandActivity: new Map(),
  brandTimeSeries: new Map(),
};

export type TrendingBrand = {
  brandId: string;
  brandName: string;
  totalScans: number;
  lastScannedAt: string;
};

export type BrandActivityNearStorefront = {
  brandId: string;
  brandName: string;
  scansNearby: number;
};

export type BrandActivitySnapshot = {
  date: string;
  scans: number;
};

/**
 * Get trending brands by total scans.
 * Results are cached for 5 minutes.
 */
export async function getTrendingBrands(options: {
  regionKey?: string;
  limit?: number;
}): Promise<TrendingBrand[]> {
  const { limit = 10 } = options;
  const cacheKey = `all:${limit}`;

  // Check cache
  const cached = cache.trendingBrands.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    logger.warn('[brandAnalytics] Firestore not available for trending brands query');
    return [];
  }

  try {
    const snapshot = await db
      .collection('brandCounters')
      .orderBy('totalScans', 'desc')
      .limit(limit)
      .get();

    const results: TrendingBrand[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as BrandCounter;
      results.push({
        brandId: data.brandId,
        brandName: data.brandName || 'Unknown',
        totalScans: data.totalScans,
        lastScannedAt: data.lastScannedAt,
      });
    });

    // Cache the result
    cache.trendingBrands.set(cacheKey, {
      data: results,
      fetchedAt: Date.now(),
    });

    return results;
  } catch (err) {
    logger.warn('[brandAnalytics] Failed to query trending brands', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Get brand scan counts within ~10km of a storefront.
 * Uses geoHint from productScans collection.
 *
 * Simple distance approximation (rough, not precise Haversine).
 * Cached for 5 minutes.
 */
export async function getBrandScansNearStorefront(options: {
  storefrontId: string;
  storefrontLat: number;
  storefrontLng: number;
  sinceDays?: number;
}): Promise<BrandActivityNearStorefront[]> {
  const { storefrontId, storefrontLat, storefrontLng, sinceDays = 7 } = options;
  const cacheKey = `near:${storefrontId}:${sinceDays}`;

  // Check cache
  const cached = cache.brandActivity.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    logger.warn('[brandAnalytics] Firestore not available for nearby scans query');
    return [];
  }

  try {
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

    // Query scans with brandId, scanned after cutoff. Bounded to avoid
    // unbounded Firestore reads when a metro has tens of thousands of
    // recent scans — we sample the newest SCAN_QUERY_LIMIT rows.
    const snapshot = await db
      .collection('productScans')
      .where('brandId', '!=', null)
      .where('scannedAt', '>=', cutoff)
      .orderBy('scannedAt', 'desc')
      .limit(SCAN_QUERY_LIMIT)
      .get();

    // Build a map of brand → scan count, filtering by proximity
    const brandCounts = new Map<string, number>();
    const brandNames = new Map<string, string>();

    snapshot.forEach((doc) => {
      const scan = doc.data() as any;
      if (!scan.geoHint || !scan.brandId) return;

      const { lat, lng } = scan.geoHint;
      const distance = roughDistanceKm(storefrontLat, storefrontLng, lat, lng);

      if (distance <= STOREFRONT_RADIUS_KM) {
        const count = (brandCounts.get(scan.brandId) ?? 0) + 1;
        brandCounts.set(scan.brandId, count);
        // Store brand name from counter if available
        if (!brandNames.has(scan.brandId)) {
          brandNames.set(scan.brandId, 'Unknown');
        }
      }
    });

    // Fetch brand names from brandCounters in ONE batched RPC instead of
    // N sequential gets. db.getAll() takes a variadic list of doc refs and
    // returns an equally-ordered list of snapshots — linear in the number
    // of brands but only a single round trip.
    const pendingBrandIds = Array.from(brandCounts.keys()).filter(
      (brandId) => brandNames.get(brandId) === 'Unknown',
    );

    if (pendingBrandIds.length > 0) {
      try {
        const refs = pendingBrandIds.map((brandId) =>
          db.collection('brandCounters').doc(brandId),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snapshots = await (db as any).getAll(...refs);
        snapshots.forEach((snap: FirebaseFirestore.DocumentSnapshot, idx: number) => {
          if (snap.exists) {
            const data = snap.data() as BrandCounter | undefined;
            brandNames.set(pendingBrandIds[idx]!, data?.brandName || 'Unknown');
          }
        });
      } catch (batchErr) {
        logger.warn('[brandAnalytics] getAll for brand names failed, leaving defaults', {
          error: batchErr instanceof Error ? batchErr.message : String(batchErr),
        });
      }
    }

    const results: BrandActivityNearStorefront[] = [];
    for (const [brandId, count] of brandCounts.entries()) {
      results.push({
        brandId,
        brandName: brandNames.get(brandId) || 'Unknown',
        scansNearby: count,
      });
    }

    // Sort by scans descending
    results.sort((a, b) => b.scansNearby - a.scansNearby);

    // Cache result
    cache.brandActivity.set(cacheKey, {
      data: results,
      fetchedAt: Date.now(),
    });

    return results;
  } catch (err) {
    logger.warn('[brandAnalytics] Failed to query brand activity near storefront', {
      storefrontId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Get time series of a brand's scan activity over a window.
 * Groups scans by date.
 * Cached for 5 minutes.
 */
export async function getBrandActivity(options: {
  brandId: string;
  windowDays?: number;
}): Promise<BrandActivitySnapshot[]> {
  const { brandId, windowDays = 30 } = options;
  const cacheKey = `activity:${brandId}:${windowDays}`;

  // Check cache
  const cached = cache.brandTimeSeries.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    logger.warn('[brandAnalytics] Firestore not available for brand activity query');
    return [];
  }

  try {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Bounded: for a hot brand with >5k recent scans we sample the most
    // recent SCAN_QUERY_LIMIT rows. The time series is per-day counts, so
    // a truncated window still gives a representative shape — and it
    // prevents a single 30k-scan brand from timing out the function.
    const snapshot = await db
      .collection('productScans')
      .where('brandId', '==', brandId)
      .where('scannedAt', '>=', cutoff)
      .orderBy('scannedAt', 'desc')
      .limit(SCAN_QUERY_LIMIT)
      .get();

    if (snapshot.size >= SCAN_QUERY_LIMIT) {
      logger.info('[brandAnalytics] Brand activity query hit scan limit, results sampled', {
        brandId,
        limit: SCAN_QUERY_LIMIT,
      });
    }

    // Group by date
    const byDate = new Map<string, number>();
    snapshot.forEach((doc) => {
      const scan = doc.data() as any;
      const date = scan.scannedAt.split('T')[0]; // YYYY-MM-DD
      byDate.set(date, (byDate.get(date) ?? 0) + 1);
    });

    // Convert to sorted array (oldest first)
    const results: BrandActivitySnapshot[] = [];
    for (const [date, scans] of Array.from(byDate.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      results.push({ date, scans });
    }

    // Cache result
    cache.brandTimeSeries.set(cacheKey, {
      data: results,
      fetchedAt: Date.now(),
    });

    return results;
  } catch (err) {
    logger.warn('[brandAnalytics] Failed to query brand activity time series', {
      brandId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Rough distance calculation in km using simple lat/lng differences.
 * Not a precise Haversine formula, but good enough for 10km radius filtering.
 *
 * 1 degree of latitude ≈ 111 km
 * 1 degree of longitude ≈ 111 km * cos(latitude)
 */
function roughDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lng1 - lng2);

  // Average latitude for cosine adjustment
  const avgLat = (lat1 + lat2) / 2;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);

  const latKm = latDiff * 111;
  const lngKm = lngDiff * 111 * cosLat;

  return Math.sqrt(latKm * latKm + lngKm * lngKm);
}

/**
 * Clear the in-memory cache. Useful for testing.
 */
export function clearBrandAnalyticsCache(): void {
  cache.trendingBrands.clear();
  cache.brandActivity.clear();
  cache.brandTimeSeries.clear();
}
