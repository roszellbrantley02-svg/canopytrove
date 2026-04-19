/**
 * Owner Storefront Brands Service
 *
 * Self-reported "brands we carry" roster per storefront.
 * Owners manage a list of brand IDs they stock at their shop.
 * Consumer-facing callers use it to answer "where can I find Brand X?"
 *
 * Firestore collection: `owner_storefront_brands`
 * Doc key: storefrontId
 * Doc shape: { storefrontId, ownerUid, brandIds: string[], updatedAt }
 *
 * Reads are cached in-memory for 2 minutes to reduce Firestore reads for
 * the public "Where to find it" lookup.
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { getOwnerStorefrontBrandsCollection } from './ownerPortalWorkspaceCollections';
import { nyBrandSeed } from '../data/nyBrandSeed';
import type {
  OwnerStorefrontBrandsDocument,
  StorefrontBrandCarrierSummary,
} from '../../../src/types/brandTypes';

const CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_BRANDS_PER_STOREFRONT = 60;

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const storefrontRosterCache = new Map<string, CacheEntry<OwnerStorefrontBrandsDocument | null>>();
const brandCarriersCache = new Map<string, CacheEntry<StorefrontBrandCarrierSummary[]>>();

/**
 * Validate + normalize a list of brand IDs against the seed catalog.
 * Preserves input order, deduplicates, drops unknown IDs, and caps length.
 */
export function normalizeBrandIds(input: readonly string[]): string[] {
  const seedIds = new Set(nyBrandSeed.map((entry) => entry.brandId));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    if (!seedIds.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_BRANDS_PER_STOREFRONT) break;
  }
  return out;
}

/**
 * Get the brand roster for a storefront (read-only).
 * Returns null if no roster has been saved yet.
 */
export async function getOwnerStorefrontBrands(
  storefrontId: string,
): Promise<OwnerStorefrontBrandsDocument | null> {
  const cached = storefrontRosterCache.get(storefrontId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const collection = getOwnerStorefrontBrandsCollection();
  if (!collection) {
    return null;
  }

  try {
    const doc = await collection.doc(storefrontId).get();
    const data = doc.exists ? (doc.data() as OwnerStorefrontBrandsDocument) : null;
    storefrontRosterCache.set(storefrontId, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    logger.warn('[ownerStorefrontBrands] Failed to read roster', {
      storefrontId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Save (create or replace) the brand roster for a storefront.
 * Invalidates both roster + brand-carrier caches.
 */
export async function saveOwnerStorefrontBrands(options: {
  storefrontId: string;
  ownerUid: string;
  brandIds: string[];
}): Promise<OwnerStorefrontBrandsDocument> {
  const { storefrontId, ownerUid } = options;
  const brandIds = normalizeBrandIds(options.brandIds);
  const now = new Date().toISOString();
  const record: OwnerStorefrontBrandsDocument = {
    storefrontId,
    ownerUid,
    brandIds,
    updatedAt: now,
  };

  const collection = getOwnerStorefrontBrandsCollection();
  if (collection) {
    try {
      await collection.doc(storefrontId).set(record, { merge: false });
    } catch (error) {
      logger.warn('[ownerStorefrontBrands] Failed to persist roster', {
        storefrontId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } else {
    logger.warn('[ownerStorefrontBrands] Firestore unavailable — roster not persisted', {
      storefrontId,
    });
  }

  // Invalidate caches
  storefrontRosterCache.set(storefrontId, { data: record, fetchedAt: Date.now() });
  brandCarriersCache.clear();
  return record;
}

/**
 * List storefronts that self-report carrying a given brand.
 * Joins with the `dispensaries` collection for display metadata.
 *
 * Cached for 2 minutes.
 */
export async function listStorefrontsCarryingBrand(options: {
  brandId: string;
  limit?: number;
}): Promise<StorefrontBrandCarrierSummary[]> {
  const { brandId, limit = 25 } = options;
  const cacheKey = `${brandId}:${limit}`;
  const cached = brandCarriersCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const collection = getOwnerStorefrontBrandsCollection();
  const db = getBackendFirebaseDb();
  if (!collection || !db) {
    return [];
  }

  try {
    const snapshot = await collection
      .where('brandIds', 'array-contains', brandId)
      .limit(limit)
      .get();

    const storefrontIds: string[] = [];
    const updatedAtMap = new Map<string, string>();
    snapshot.forEach((doc) => {
      const data = doc.data() as OwnerStorefrontBrandsDocument;
      storefrontIds.push(data.storefrontId);
      updatedAtMap.set(data.storefrontId, data.updatedAt);
    });

    if (storefrontIds.length === 0) {
      brandCarriersCache.set(cacheKey, { data: [], fetchedAt: Date.now() });
      return [];
    }

    // Batch fetch dispensary docs (Firestore allows up to 10 per `in` query).
    const results: StorefrontBrandCarrierSummary[] = [];
    for (let i = 0; i < storefrontIds.length; i += 10) {
      const chunk = storefrontIds.slice(i, i + 10);
      try {
        const docRefs = chunk.map((id) => db.collection('dispensaries').doc(id));
        const docs = await db.getAll(...docRefs);
        docs.forEach((doc) => {
          if (!doc.exists) return;
          const data = doc.data() as {
            displayName?: string | null;
            storefrontName?: string | null;
            legalBusinessName?: string | null;
            city?: string | null;
            state?: string | null;
          };
          const displayName = (
            data.displayName ||
            data.storefrontName ||
            data.legalBusinessName ||
            'Storefront'
          ).toString();
          const city = (data.city || '').toString();
          const state = (data.state || '').toString();
          results.push({
            storefrontId: doc.id,
            displayName,
            city,
            state,
            updatedAt: updatedAtMap.get(doc.id) ?? new Date(0).toISOString(),
          });
        });
      } catch (error) {
        logger.warn('[ownerStorefrontBrands] Failed to hydrate dispensaries for carriers', {
          brandId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Sort: most recently updated first
    results.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    brandCarriersCache.set(cacheKey, { data: results, fetchedAt: Date.now() });
    return results;
  } catch (error) {
    logger.warn('[ownerStorefrontBrands] Failed to query brand carriers', {
      brandId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** Clear caches — intended for tests. */
export function clearOwnerStorefrontBrandsCache(): void {
  storefrontRosterCache.clear();
  brandCarriersCache.clear();
}
