/**
 * Scan Ingestion Service
 *
 * Accepts a raw scanned string and routes it:
 *   - OCM license number → delegates to ocmLicenseLookupService
 *   - Known lab COA URL → delegates to productCatalogService
 *   - Otherwise → marks as unknown
 *
 * Persists every scan to Firestore `productScans` collection with
 * anonymous installId, resolution kind, and geoHint (if provided).
 *
 * Also maintains `brandCounters` collection for brand-level analytics
 * via transactional atomic increments.
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { createHash } from 'node:crypto';
import { lookupOcmLicense } from './ocmLicenseLookupService';
import {
  parseCoa,
  isCoa,
  isUpc,
  isHttpUrl,
  buildUpcOnlyCoa,
  buildUnknownLabCoa,
} from './productCatalogService';
import { resolveBrandPage } from './brandPageResolverService';
import type { ProductCOA, ScanRecord, ScanResolution } from '../types';
import { getGamificationState, saveGamificationState } from './gamificationPersistenceService';

const OCM_LICENSE_PATTERN = /^[A-Z0-9\-]{10,30}$/;

export type ScanIngestionInput = {
  rawCode: string;
  installId: string;
  profileId?: string;
  location?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  };
  nearStorefrontId?: string;
};

export type ScanIngestionResult = {
  resolution: ScanResolution;
  persisted: boolean;
};

type CoaOpenedTelemetryRecord = {
  installId: string;
  brandId: string;
  labName: string;
  batchId: string | null;
  openedAt: string;
  schemaVersion: 1;
};

function buildStableHash(parts: Array<string | number | null | undefined>): string {
  const hash = createHash('sha256');
  hash.update(parts.map((part) => String(part ?? '')).join('|'));
  return hash.digest('hex').slice(0, 32);
}

function getUtcDateBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMinuteBucket(date: Date): number {
  return Math.floor(date.getTime() / 60_000);
}

function normalizeScanFingerprint(rawCode: string): string {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed.toUpperCase();
}

function buildScanRecordId(
  input: ScanIngestionInput,
  resolution: ScanResolution,
  date: Date,
): string {
  return buildStableHash([
    input.installId,
    resolution.kind,
    normalizeScanFingerprint(input.rawCode),
    getUtcDateBucket(date),
  ]);
}

function buildCoaOpenedRecordId(
  input: {
    installId: string;
    brandId: string;
    labName: string;
    batchId?: string;
  },
  date: Date,
): string {
  return buildStableHash([
    input.installId,
    input.brandId,
    input.labName,
    input.batchId ?? '',
    getMinuteBucket(date),
  ]);
}

/**
 * Resolve a raw scanned code into license, product, or unknown.
 *
 * Classification tiers (first match wins):
 *   1. UPC/EAN/ITF retail barcode  → product (catalogState: 'uncatalogued')
 *   2. Recognized COA URL          → product (catalogState: 'verified')
 *   3. Any other well-formed URL   → product (catalogState: 'unrecognized_lab')
 *   4. OCM license pattern + hit   → license (verificationState: 'verified')
 *   5. OCM license pattern only    → license (verificationState: 'unverified')
 *   6. Otherwise                   → unknown (with reason)
 *
 * The goal is that anything that plausibly came off a cannabis product or
 * shop gets a rich result screen (possibly asking the user to help fill
 * in missing fields) instead of a dead-end "enter manually" fallback.
 */
async function resolveCode(rawCode: string): Promise<ScanResolution> {
  const trimmed = rawCode.trim();

  if (!trimmed) {
    return { kind: 'unknown', rawCode: trimmed, reason: 'empty' };
  }

  // (1) Retail UPC/EAN/ITF barcode — classify as uncatalogued product.
  //     This is the big UX win: UPC scans no longer get dumped to manual.
  if (isUpc(trimmed)) {
    return {
      kind: 'product',
      coa: buildUpcOnlyCoa(trimmed),
      catalogState: 'uncatalogued',
    };
  }

  // (2) Recognized COA URL — full verified product with lab parse.
  if (isCoa(trimmed)) {
    const coa = await parseCoa(trimmed);
    if (coa) {
      return {
        kind: 'product',
        coa,
        catalogState: 'verified',
      };
    }
  }

  // (3) Any other well-formed URL — this is a brand-site QR.
  //     First try a chain-through: fetch the page and see if it links to a
  //     known lab (very common pattern — brand hosts the marketing site,
  //     lab hosts the real COA). If that works, we keep BOTH URLs so the
  //     result screen can offer "View lab results" AND "Visit brand site".
  //     Otherwise fall back to a placeholder with just the brand URL so
  //     the shopper still gets a one-tap path to the brand's own page.
  if (isHttpUrl(trimmed)) {
    const brandPage = await resolveBrandPage(trimmed);

    if (brandPage.outcome === 'chained_to_known_lab') {
      return {
        kind: 'product',
        coa: {
          ...brandPage.coa,
          brandWebsiteUrl: trimmed,
        },
        catalogState: 'verified',
      };
    }

    return {
      kind: 'product',
      coa: {
        ...buildUnknownLabCoa(trimmed),
        brandWebsiteUrl: trimmed,
        coaUrl: undefined,
      },
      catalogState: 'unrecognized_lab',
    };
  }

  // (4,5) OCM license pattern — verified if registry hit, unverified otherwise.
  const normalizedLicenseCandidate = trimmed.toUpperCase();
  if (OCM_LICENSE_PATTERN.test(normalizedLicenseCandidate)) {
    const lookup = await lookupOcmLicense(normalizedLicenseCandidate);
    if (lookup.found && lookup.record) {
      return {
        kind: 'license',
        license: {
          licenseNumber: lookup.record.license_number,
          licenseType: lookup.record.license_type,
          licenseeName: lookup.record.licensee_name,
          status: lookup.record.license_status,
        },
        verificationState: 'verified',
      };
    }
    // Pattern matched but no registry record — surface as unverified
    // so the shopper sees "couldn't confirm this license" instead of
    // being told the code is garbage.
    return {
      kind: 'license',
      license: {
        licenseNumber: normalizedLicenseCandidate,
        licenseType: 'unknown',
        licenseeName: 'Unverified',
        status: 'unverified',
      },
      verificationState: 'unverified',
    };
  }

  // (6) Nothing matched — last resort.
  return {
    kind: 'unknown',
    rawCode: trimmed,
    reason: 'unrecognized_format',
  };
}

/**
 * Extract brand ID from a scan resolution result.
 * For products, we use lab + batch as a composite key.
 * For licenses, no brand ID is assigned (brands can be assigned later).
 */
function extractBrandId(resolution: ScanResolution): string | undefined {
  if (resolution.kind === 'product' && resolution.coa) {
    const { labName, batchId } = resolution.coa;
    if (batchId) {
      return `${labName}:${batchId}`;
    }
  }
  return undefined;
}

/**
 * Extract a brand name from a scan resolution.
 */
function extractBrandName(resolution: ScanResolution): string | undefined {
  if (resolution.kind === 'product' && resolution.coa) {
    return resolution.coa.brandName;
  }
  if (resolution.kind === 'license' && resolution.license) {
    return resolution.license.licenseeName;
  }
  return undefined;
}

/**
 * Persist a scan record to Firestore.
 * Fail-soft: logs errors but always returns success (never throws).
 */
async function persistScan(
  input: ScanIngestionInput,
  resolution: ScanResolution,
): Promise<boolean> {
  const db = getBackendFirebaseDb();
  if (!db) {
    logger.warn('[scanIngestion] Firestore not available, skipping persistence');
    return false;
  }

  try {
    const brandId = extractBrandId(resolution);
    const brandName = extractBrandName(resolution);
    const now = new Date();
    const scannedAt = now.toISOString();
    const scanRef = db.collection('productScans').doc(buildScanRecordId(input, resolution, now));

    const record: ScanRecord = {
      installId: input.installId,
      rawCode: input.rawCode.trim(),
      resolvedKind: resolution.kind,
      brandId,
      storefrontId: input.nearStorefrontId,
      scannedAt,
      schemaVersion: 1,
    };

    // Add geo hint if provided
    if (input.location) {
      record.geoHint = {
        lat: input.location.lat,
        lng: input.location.lng,
        accuracyMeters: input.location.accuracyMeters,
      };
    }

    // Add product-specific fields
    if (resolution.kind === 'product' && resolution.coa) {
      record.labName = resolution.coa.labName;
      record.batchId = resolution.coa.batchId;
      record.productId = resolution.coa.productName;
    }

    const created = await db.runTransaction(async (transaction) => {
      const existingScan = await transaction.get(scanRef);
      if (existingScan.exists) {
        return false;
      }

      transaction.set(scanRef, record);

      if (brandId) {
        const counterRef = db.collection('brandCounters').doc(brandId);
        const counterSnapshot = await transaction.get(counterRef);
        const existingCounter = counterSnapshot.exists ? (counterSnapshot.data() as any) : null;

        transaction.set(
          counterRef,
          {
            brandId,
            brandName: brandName || 'Unknown',
            totalScans: (existingCounter?.totalScans ?? 0) + 1,
            lastScannedAt: scannedAt,
            byRegion: existingCounter?.byRegion ?? {},
          },
          { merge: true },
        );
      }

      return true;
    });

    logger.info(created ? '[scanIngestion] Persisted scan' : '[scanIngestion] Deduped scan', {
      installId: input.installId,
      kind: resolution.kind,
      brandId,
    });
    return created;
  } catch (err) {
    logger.warn('[scanIngestion] Failed to persist scan', {
      installId: input.installId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail soft: return false but don't throw
    return false;
  }
}

/**
 * Emit gamification event for a product scan.
 * Fail-soft: logs errors but continues.
 */
async function emitScanGamificationEvent(
  installId: string,
  resolution: ScanResolution,
  profileId: string | undefined,
  allowReward: boolean,
): Promise<void> {
  try {
    if (!allowReward) {
      return;
    }

    // Only emit events for product scans
    if (resolution.kind !== 'product' || !resolution.coa) {
      return;
    }

    const coa = resolution.coa;

    // Get current gamification state to check if brand is new
    let isNewBrand = false;
    if (profileId) {
      try {
        const currentState = await getGamificationState(profileId);
        const brandId = `${coa.labName}:${coa.batchId || ''}`;
        if (currentState.scanStats && !currentState.scanStats.uniqueBrandIds.includes(brandId)) {
          isNewBrand = true;
        }
      } catch (err) {
        logger.warn('[scanIngestion] Failed to check brand newness', {
          profileId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Import here to avoid circular dependency at module load time
    const { applyScanCompletedReward } =
      await import('../../../src/domain/canopyTroveGamification');

    // Only proceed if we have a profile to update
    if (!profileId) {
      logger.debug('[scanIngestion] Skipping gamification for anonymous scan');
      return;
    }

    try {
      const currentState = await getGamificationState(profileId);

      const scanPayload = {
        scanKind: 'product' as const,
        brandId: `${coa.labName}:${coa.batchId || ''}`,
        labName: coa.labName,
        thcPercent: coa.thcPercent,
        contaminants: coa.contaminants,
        isNewBrandForUser: isNewBrand,
        terpenes: coa.terpenes,
      };

      const result = applyScanCompletedReward(currentState, scanPayload);

      // Persist updated state
      await saveGamificationState(profileId, result.updatedState);

      logger.debug('[scanIngestion] Gamification event processed', {
        profileId,
        pointsEarned: result.pointsEarned,
        badgesEarned: result.badgesEarned.length,
      });
    } catch (err) {
      logger.warn('[scanIngestion] Failed to process gamification', {
        profileId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    logger.warn('[scanIngestion] Failed to emit gamification event', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Record that a user opened a full COA.
 * Fail-soft: logs errors but continues.
 */
export async function recordCoaOpened(input: {
  installId: string;
  profileId?: string;
  brandId: string;
  labName: string;
  batchId?: string;
}): Promise<void> {
  try {
    const db = getBackendFirebaseDb();
    const now = new Date();
    const openedAt = now.toISOString();
    let created = true;

    if (db) {
      const eventRef = db.collection('coaOpenEvents').doc(buildCoaOpenedRecordId(input, now));

      created = await db.runTransaction(async (transaction) => {
        const existingEvent = await transaction.get(eventRef);
        if (existingEvent.exists) {
          return false;
        }

        const record: CoaOpenedTelemetryRecord = {
          installId: input.installId,
          brandId: input.brandId,
          labName: input.labName,
          batchId: input.batchId ?? null,
          openedAt,
          schemaVersion: 1,
        };

        transaction.set(eventRef, record);
        return true;
      });
    } else {
      logger.warn(
        '[scanIngestion] Firestore not available, skipping COA-open telemetry persistence',
      );
    }

    if (!created) {
      logger.info('[scanIngestion] Deduped COA opened event', {
        installId: input.installId,
        brandId: input.brandId,
      });
      return;
    }

    if (!input.profileId) {
      logger.info('[scanIngestion] Recorded anonymous COA opened event', {
        installId: input.installId,
        brandId: input.brandId,
      });
      return;
    }

    const { applyCoaOpenedReward } = await import('../../../src/domain/canopyTroveGamification');

    const currentState = await getGamificationState(input.profileId);

    const result = applyCoaOpenedReward(currentState, {
      brandId: input.brandId,
      labName: input.labName,
      batchId: input.batchId,
    });

    // Persist updated state
    await saveGamificationState(input.profileId, result.updatedState);

    logger.debug('[scanIngestion] COA opened event recorded', {
      profileId: input.profileId,
      pointsEarned: result.pointsEarned,
    });
  } catch (err) {
    logger.warn('[scanIngestion] Failed to record COA opened', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Main entry point: ingest a scanned code.
 *
 * 1. Resolves the code (license, product, or unknown)
 * 2. Persists to Firestore (fail-soft)
 * 3. Emits gamification event (fail-soft)
 * 4. Returns the resolution
 */
export async function ingestScan(input: ScanIngestionInput): Promise<ScanIngestionResult> {
  if (!input.installId) {
    throw new Error('installId is required');
  }

  if (!input.rawCode) {
    throw new Error('rawCode is required');
  }

  // Resolve the code
  const resolution = await resolveCode(input.rawCode);

  // Persist (fail-soft)
  const persisted = await persistScan(input, resolution);

  // Emit gamification event (fail-soft)
  void emitScanGamificationEvent(input.installId, resolution, input.profileId, persisted);

  return {
    resolution,
    persisted,
  };
}
