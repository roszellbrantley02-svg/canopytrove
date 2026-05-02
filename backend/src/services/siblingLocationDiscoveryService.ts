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
 * This service is dead code in PR-A — nothing calls it yet. PR-D wires
 * it into the bulk-claim endpoint. The verification chain (PR-B) is
 * the next consumer. Pure read; never writes.
 *
 * Known limitation (deferred to PR-D): `dispensaryId` resolution. We can
 * find the OCM records cleanly, but mapping each sibling OCM license back
 * to a `dispensaries/{id}` doc requires either a Firestore query on
 * `licenseNumber` (no index today) or scanning all storefronts. Returning
 * `dispensaryId: null` keeps PR-A's surface minimal; PR-D adds the lookup
 * once we know which sibling licenses we actually need to resolve.
 */

import { logger } from '../observability/logger';
import {
  bulkMatchStorefronts,
  findOcmRecordsByLicenseeName,
  isActiveOcmLicenseStatus,
} from './ocmLicenseCacheService';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';
import { backendStorefrontSource } from '../sources';

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
  const siblings: SiblingCandidate[] = allRecordsForEntity
    .filter((record) => record.license_number !== primaryLicenseNumber)
    .map((record) => ({
      ocmRecord: record,
      active: isActiveOcmLicenseStatus(record.license_status),
      // Deferred to PR-D — resolving OCM record → storefrontId requires
      // a Firestore query on licenseNumber that doesn't exist today.
      dispensaryId: null,
    }));

  return {
    primaryDispensaryId,
    primaryLicenseeName: licenseeName,
    primaryOcmRecord,
    siblings,
    reason: null,
  };
}
