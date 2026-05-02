/**
 * Sibling-location discovery — Phase 2 of the multi-location claim feature.
 *
 * Given a primary storefront the owner has just claimed (or is about to
 * claim), look up its OCM legal entity (`licensee_name`, populated from
 * SODA's `entity_name`) and return every OTHER licensed retail record
 * held by that same legal entity. This is the cluster-rollup primitive
 * the bulk-claim flow uses to surface "Add 2 sibling locations" prompts.
 *
 * Empirical findings (May 2 2026, see docs/research/dataset-verification-findings.md):
 *  - 20 NY entities have 2+ retail dispensary licenses today
 *  - `entity_name` is consistent within a cluster (exact match, no fuzz)
 *  - `gttd-5u6y` tax dataset is sparser than `jskf-tt3q` — newer 2026
 *    sibling licenses haven't registered for tax collection yet, so
 *    tax-ID match is NOT the cluster rollup. `entity_name` is.
 *
 * Resolves OCM siblings to storefront IDs via an in-memory reverse index
 * (built from getAllSummaries, cached 5 min) keyed on normalized address+zip.
 * Siblings whose OCM record has no matching storefront in our directory
 * surface as `dispensaryId: null` — the frontend hero card hides those
 * candidates so we never offer to claim a shop we can't actually load.
 */

import { logger } from '../observability/logger';
import {
  bulkMatchStorefronts,
  findOcmRecordsByLicenseeName,
  isActiveOcmLicenseStatus,
} from './ocmLicenseCacheService';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';
import { backendStorefrontSource } from '../sources';
import type { StorefrontSummaryApiDocument } from '../types';

export type SiblingCandidate = {
  /** The full OCM record for the sibling location. */
  ocmRecord: OcmLicenseRecord;
  /** True if the license is in an active OCM status (active/approved/issued/operational). */
  active: boolean;
  /**
   * The matching storefront ID in our `dispensaries` collection, when we
   * can resolve it. PR-A always returns null here; PR-D will add the
   * resolution layer that maps OCM license_number → storefrontId.
   */
  dispensaryId: string | null;
};

export type SiblingDiscoveryResult = {
  primaryDispensaryId: string;
  /** The OCM legal entity name for the primary, or null if primary didn't match OCM. */
  primaryLicenseeName: string | null;
  /** The full primary OCM record, or null if no match. */
  primaryOcmRecord: OcmLicenseRecord | null;
  /**
   * Sibling candidates — every OCM retail record under the same licensee_name,
   * excluding the primary itself. Empty array means: either the entity is
   * single-location, or the primary couldn't be matched to OCM at all.
   */
  siblings: SiblingCandidate[];
  /**
   * Diagnostic — populated when we couldn't run the discovery (storefront
   * not found in directory, OCM cache empty, etc). Always null on success.
   */
  reason: 'storefront_not_found' | 'ocm_match_not_found' | 'ocm_cache_unavailable' | null;
};

const EMPTY_RESULT = (
  primaryDispensaryId: string,
  reason: SiblingDiscoveryResult['reason'],
): SiblingDiscoveryResult => ({
  primaryDispensaryId,
  primaryLicenseeName: null,
  primaryOcmRecord: null,
  siblings: [],
  reason,
});

// ============================================================================
// Storefront reverse-index — maps OCM (address, zip) → storefrontId. Built
// once from getAllSummaries(), cached for STOREFRONT_INDEX_TTL_MS.
// ============================================================================

const STOREFRONT_INDEX_TTL_MS = 5 * 60 * 1000; // 5 min

type StorefrontIndex = {
  byAddressZip: Map<string, string>;
  builtAt: number;
};

let storefrontIndexState: StorefrontIndex | null = null;
let storefrontIndexInFlight: Promise<StorefrontIndex | null> | null = null;

/**
 * Normalize an address + zip into a stable lookup key. Mirrors the
 * normalizeAddressKey used by ocmLicenseCacheService so OCM records and
 * our directory storefronts hash to the same key when they're the same
 * physical location.
 */
function normalizeAddressZipKey(
  address: string | null | undefined,
  zip: string | null | undefined,
): string | null {
  if (!address || !zip) return null;
  const normalizedAddress = address
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\broute\b/g, 'rt')
    .replace(/\s+/g, ' ');
  const normalizedZip = zip.trim().slice(0, 5);
  if (!normalizedAddress || !/^\d{5}$/.test(normalizedZip)) return null;
  return `${normalizedAddress}|${normalizedZip}`;
}

async function buildStorefrontIndex(): Promise<StorefrontIndex | null> {
  let summaries: StorefrontSummaryApiDocument[];
  try {
    summaries = await backendStorefrontSource.getAllSummaries();
  } catch (err) {
    logger.warn('siblingLocationDiscovery: getAllSummaries failed for resolver index', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const byAddressZip = new Map<string, string>();
  for (const summary of summaries) {
    const key = normalizeAddressZipKey(summary.addressLine1, summary.zip);
    if (key) {
      byAddressZip.set(key, summary.id);
    }
  }
  logger.info('siblingLocationDiscovery: storefront index built', {
    summaryCount: summaries.length,
    indexedAddresses: byAddressZip.size,
  });
  return { byAddressZip, builtAt: Date.now() };
}

async function getStorefrontIndex(): Promise<StorefrontIndex | null> {
  const existing = storefrontIndexState;
  const now = Date.now();
  if (existing && now - existing.builtAt < STOREFRONT_INDEX_TTL_MS) {
    return existing;
  }
  if (storefrontIndexInFlight) return storefrontIndexInFlight;
  storefrontIndexInFlight = (async () => {
    try {
      const built = await buildStorefrontIndex();
      if (built) storefrontIndexState = built;
      return built ?? existing ?? null;
    } finally {
      storefrontIndexInFlight = null;
    }
  })();
  return storefrontIndexInFlight;
}

/**
 * Map an OCM record back to a storefrontId in our `dispensaries` collection.
 * Uses the cached address+zip reverse index. Returns null if no storefront
 * matches — the frontend filters those candidates out of the hero card.
 */
function resolveStorefrontIdForOcmRecord(
  index: StorefrontIndex | null,
  record: OcmLicenseRecord,
): string | null {
  if (!index) return null;
  const key = normalizeAddressZipKey(record.address, record.zip_code);
  if (!key) return null;
  return index.byAddressZip.get(key) ?? null;
}

/** Test-only: clear the reverse index between test cases. */
export function clearSiblingResolverIndexForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  storefrontIndexState = null;
  storefrontIndexInFlight = null;
}

export async function discoverSiblingLocations(
  primaryDispensaryId: string,
): Promise<SiblingDiscoveryResult> {
  if (!primaryDispensaryId) {
    return EMPTY_RESULT(primaryDispensaryId, 'storefront_not_found');
  }

  let summaries;
  try {
    summaries = await backendStorefrontSource.getSummariesByIds([primaryDispensaryId]);
  } catch (err) {
    logger.warn('siblingLocationDiscovery: getSummariesByIds failed', {
      err: err instanceof Error ? err.message : String(err),
      primaryDispensaryId,
    });
    return EMPTY_RESULT(primaryDispensaryId, 'storefront_not_found');
  }

  const primarySummary = summaries.find((summary) => summary.id === primaryDispensaryId);
  if (!primarySummary) {
    return EMPTY_RESULT(primaryDispensaryId, 'storefront_not_found');
  }

  const matches = await bulkMatchStorefronts([
    {
      id: primarySummary.id,
      address: primarySummary.addressLine1,
      zip: primarySummary.zip,
      name: primarySummary.displayName || primarySummary.legalName,
    },
  ]);

  const primaryMatch = matches.get(primaryDispensaryId);
  if (!primaryMatch || !primaryMatch.record) {
    return EMPTY_RESULT(primaryDispensaryId, 'ocm_match_not_found');
  }

  const primaryOcmRecord = primaryMatch.record;
  const licenseeName = primaryOcmRecord.licensee_name;
  if (!licenseeName) {
    return {
      primaryDispensaryId,
      primaryLicenseeName: null,
      primaryOcmRecord,
      siblings: [],
      reason: 'ocm_match_not_found',
    };
  }

  const allRecordsForEntity = await findOcmRecordsByLicenseeName(licenseeName);
  if (allRecordsForEntity.length === 0) {
    // Cache miss — shouldn't happen if primary matched OCM, but defend
    // against the race where the cache TTL expires between calls.
    return {
      primaryDispensaryId,
      primaryLicenseeName: licenseeName,
      primaryOcmRecord,
      siblings: [],
      reason: 'ocm_cache_unavailable',
    };
  }

  const primaryLicenseNumber = primaryOcmRecord.license_number;
  const siblingRecords = allRecordsForEntity.filter(
    (record) => record.license_number !== primaryLicenseNumber,
  );

  // Resolve each sibling OCM record back to a storefrontId via the cached
  // address+zip reverse index. Siblings whose OCM record has no matching
  // storefront in our directory surface as `dispensaryId: null` — the
  // frontend hero card filters those out so we never offer to claim a
  // shop the owner can't actually load.
  const index = await getStorefrontIndex();
  const siblings: SiblingCandidate[] = siblingRecords.map((record) => ({
    ocmRecord: record,
    active: isActiveOcmLicenseStatus(record.license_status),
    dispensaryId: resolveStorefrontIdForOcmRecord(index, record),
  }));

  return {
    primaryDispensaryId,
    primaryLicenseeName: licenseeName,
    primaryOcmRecord,
    siblings,
    reason: null,
  };
}
