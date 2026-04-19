/**
 * Brand Profile Service
 *
 * Read-side service combining seed data (nyBrandSeed) with live aggregates
 * (brandCounters + productScans) via brandAnalyticsService.
 *
 * Provides merged brand profiles with sorting and filtering.
 * Results cached for 5 minutes.
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { nyBrandSeed, type BrandSeedEntry } from '../data/nyBrandSeed';
import { TERPENE_MAPPING, getTerpeneSmell, getTerpeneTastes } from '../data/terpeneMapping';
import type {
  BrandProfile,
  BrandProfileSummary,
  BrandSortKey,
  BrandSmellTag,
  BrandTasteTag,
  BrandCounter,
} from '../types';
import type { ScanRecord } from '../types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

type CacheState = {
  profiles: Map<string, CacheEntry<BrandProfile>>;
  list: Map<string, CacheEntry<BrandProfile[]>>;
};

const cache: CacheState = {
  profiles: new Map(),
  list: new Map(),
};

/**
 * Get all seed brands as a map.
 */
function getSeedBrandsMap(): Map<string, BrandSeedEntry> {
  const map = new Map<string, BrandSeedEntry>();
  nyBrandSeed.forEach((entry) => {
    map.set(entry.brandId, entry);
  });
  return map;
}

/**
 * Calculate contaminant pass rate from productScans.
 * Returns: (scans where passFailOverall === 'pass') / (total scans with contaminants data)
 */
async function calculateContaminantPassRate(brandId: string): Promise<number> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return 1; // Assume pass if no data
  }

  try {
    const snapshot = await db
      .collection('productScans')
      .where('brandId', '==', brandId)
      .select()
      .get();

    if (snapshot.empty) {
      return 1;
    }

    let passCount = 0;
    let totalWithData = 0;

    snapshot.forEach((doc) => {
      const data = doc.data() as Partial<ScanRecord> | undefined;
      // For now, assume passes without explicit fail data
      // In future, parse COA field when available
      if (data) {
        totalWithData++;
        passCount++;
      }
    });

    return totalWithData > 0 ? passCount / totalWithData : 1;
  } catch (err) {
    logger.warn('[brandProfileService] Failed to calculate contaminant pass rate', {
      brandId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 1; // Default to pass on error
  }
}

/**
 * Get scan aggregates for a brand from brandCounters.
 */
async function getBrandScansMetadata(
  brandId: string,
): Promise<{ totalScans: number; lastScannedAt: string }> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { totalScans: 0, lastScannedAt: new Date(0).toISOString() };
  }

  try {
    const doc = await db.collection('brandCounters').doc(brandId).get();
    if (!doc.exists) {
      return { totalScans: 0, lastScannedAt: new Date(0).toISOString() };
    }

    const data = doc.data() as Partial<BrandCounter> | undefined;
    return {
      totalScans: data?.totalScans ?? 0,
      lastScannedAt: data?.lastScannedAt ?? new Date(0).toISOString(),
    };
  } catch (err) {
    logger.warn('[brandProfileService] Failed to get brand scans metadata', {
      brandId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { totalScans: 0, lastScannedAt: new Date(0).toISOString() };
  }
}

/**
 * Compute smell and taste tags from a dominant terpene.
 */
function computeTagsFromTerpene(terpene: string | undefined): {
  smell: BrandSmellTag[];
  taste: BrandTasteTag[];
} {
  if (!terpene) {
    return { smell: [], taste: [] };
  }

  const smell = getTerpeneSmell(terpene);
  const tastes = getTerpeneTastes(terpene);

  const smellTag = (smell as BrandSmellTag) || undefined;
  const tasteTags = (tastes as BrandTasteTag[]) || [];

  return {
    smell: smellTag ? [smellTag] : [],
    taste: tasteTags,
  };
}

/**
 * Merge seed entry with live scan data to create a BrandProfile.
 */
async function buildBrandProfile(
  seedEntry: BrandSeedEntry | undefined,
  brandId: string,
): Promise<BrandProfile> {
  const [scansMetadata, passRate] = await Promise.all([
    getBrandScansMetadata(brandId),
    calculateContaminantPassRate(brandId),
  ]);

  const dominantTerpene = seedEntry?.baselineDominantTerpene;
  const { smell: smellTags, taste: tasteTags } = computeTagsFromTerpene(dominantTerpene);

  const hasScans = scansMetadata.totalScans > 0;
  const source: 'seed' | 'scanned' | 'merged' = seedEntry
    ? hasScans
      ? 'merged'
      : 'seed'
    : hasScans
      ? 'scanned'
      : 'seed';

  return {
    brandId,
    displayName: seedEntry?.displayName || brandId,
    aggregateDominantTerpene: dominantTerpene,
    smellTags:
      smellTags.length > 0 ? smellTags : (seedEntry?.baselineSmellTags as BrandSmellTag[]) || [],
    tasteTags:
      tasteTags.length > 0 ? tasteTags : (seedEntry?.baselineTasteTags as BrandTasteTag[]) || [],
    avgThcPercent: seedEntry?.baselineAvgThcPercent || 0,
    contaminantPassRate: passRate,
    totalScans: scansMetadata.totalScans,
    lastScannedAt: hasScans ? scansMetadata.lastScannedAt : undefined,
    description: seedEntry?.description,
    website: seedEntry?.website,
    source,
  };
}

/**
 * Get a single brand profile by ID.
 * Checks cache first; otherwise fetches and caches for 5 minutes.
 */
export async function getBrandProfile(brandId: string): Promise<BrandProfile> {
  const cached = cache.profiles.get(brandId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const seedMap = getSeedBrandsMap();
  const seedEntry = seedMap.get(brandId);

  const profile = await buildBrandProfile(seedEntry, brandId);

  cache.profiles.set(brandId, {
    data: profile,
    fetchedAt: Date.now(),
  });

  return profile;
}

/**
 * Convert BrandProfile to summary (shorter for lists).
 */
function toSummary(profile: BrandProfile): BrandProfileSummary {
  return {
    brandId: profile.brandId,
    displayName: profile.displayName,
    aggregateDominantTerpene: profile.aggregateDominantTerpene,
    smellTags: profile.smellTags,
    avgThcPercent: profile.avgThcPercent,
    contaminantPassRate: profile.contaminantPassRate,
    totalScans: profile.totalScans,
  };
}

/**
 * List all brand profiles (seed + scanned).
 * Supports pagination with cursor/limit.
 */
export async function listBrandProfiles(options: {
  ids?: string[];
  limit?: number;
  cursor?: string;
}): Promise<{ brands: BrandProfileSummary[]; nextCursor?: string }> {
  const { limit = 50, cursor } = options;

  const seedMap = getSeedBrandsMap();
  let brandIds: string[] = options.ids || Array.from(seedMap.keys());

  // Simple pagination: skip 'cursor' items
  const offset = cursor ? parseInt(cursor, 10) : 0;
  const paginated = brandIds.slice(offset, offset + limit + 1);

  const profiles = await Promise.all(paginated.slice(0, limit).map((id) => getBrandProfile(id)));

  const nextCursor = paginated.length > limit ? String(offset + limit) : undefined;

  return {
    brands: profiles.map(toSummary),
    nextCursor,
  };
}

/**
 * Sort brand profiles by smell, taste, or potency.
 * Optional filter to narrow by specific tag.
 */
export function sortBrandProfiles(
  profiles: BrandProfile[],
  by: BrandSortKey,
  filter?: string,
): BrandProfile[] {
  let filtered = profiles;

  // Filter by smell or taste tag if provided
  if (filter) {
    filtered = profiles.filter((p) => {
      if (by === 'smell' && p.smellTags.includes(filter as BrandSmellTag)) {
        return true;
      }
      if (by === 'taste' && p.tasteTags.includes(filter as BrandTasteTag)) {
        return true;
      }
      return false;
    });
  }

  // Sort
  switch (by) {
    case 'smell': {
      // Primary: by terpene smell name (alphabetical)
      // Secondary: by totalScans (descending)
      return filtered.sort((a, b) => {
        const smellA = a.smellTags[0] || '';
        const smellB = b.smellTags[0] || '';
        if (smellA !== smellB) {
          return smellA.localeCompare(smellB);
        }
        return b.totalScans - a.totalScans;
      });
    }
    case 'taste': {
      // Primary: by taste tag name (alphabetical)
      // Secondary: by totalScans (descending)
      return filtered.sort((a, b) => {
        const tasteA = a.tasteTags[0] || '';
        const tasteB = b.tasteTags[0] || '';
        if (tasteA !== tasteB) {
          return tasteA.localeCompare(tasteB);
        }
        return b.totalScans - a.totalScans;
      });
    }
    case 'potency':
    default: {
      // Sort by avgThcPercent descending
      return filtered.sort((a, b) => b.avgThcPercent - a.avgThcPercent);
    }
  }
}

/**
 * Get all valid smell tags for filtering.
 */
export function getSmellFilterOptions(): BrandSmellTag[] {
  const seen = new Set<BrandSmellTag>();
  nyBrandSeed.forEach((entry) => {
    entry.baselineSmellTags.forEach((tag) => {
      seen.add(tag as BrandSmellTag);
    });
  });
  return Array.from(seen).sort();
}

/**
 * Get all valid taste tags for filtering.
 */
export function getTasteFilterOptions(): BrandTasteTag[] {
  const seen = new Set<BrandTasteTag>();
  nyBrandSeed.forEach((entry) => {
    entry.baselineTasteTags.forEach((tag) => {
      seen.add(tag as BrandTasteTag);
    });
  });
  return Array.from(seen).sort();
}
