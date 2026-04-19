/**
 * Bridges the OCM license cache into storefront summaries + details.
 *
 * Called in the enrichment phase of storefrontService so every card and
 * detail response carries an `ocmVerification` payload the frontend can
 * render as a "Verified licensed" badge.
 */

import { logger } from '../observability/logger';
import { bulkMatchStorefronts, type VerificationMatch } from './ocmLicenseCacheService';
import type {
  OcmVerificationApiDocument,
  StorefrontDetailApiDocument,
  StorefrontSummaryApiDocument,
} from '../types';

const ENRICHMENT_TIMEOUT_MS = 1_500;

function shapeVerification(
  match: VerificationMatch | undefined,
): OcmVerificationApiDocument | null {
  if (!match) return null;
  return {
    licensed: match.licensed,
    confidence: match.confidence,
    asOf: match.asOf,
    source: match.source,
    licenseNumber: match.record?.license_number ?? null,
    licenseType: match.record?.license_type ?? null,
    licenseeName: match.record?.licensee_name ?? null,
  };
}

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ENRICHMENT_TIMEOUT_MS)),
  ]);
}

export async function attachOcmVerificationToSummaries<T extends StorefrontSummaryApiDocument>(
  items: T[],
): Promise<T[]> {
  if (!items.length) return items;
  try {
    const inputs = items.map((item) => ({
      id: item.id,
      address: item.addressLine1,
      zip: item.zip,
      name: item.displayName || item.legalName,
    }));
    const matches = await withTimeout(
      bulkMatchStorefronts(inputs),
      new Map<string, VerificationMatch>(),
    );
    if (!matches.size) return items;
    return items.map((item) => {
      const match = matches.get(item.id);
      if (!match) return item;
      return { ...item, ocmVerification: shapeVerification(match) };
    });
  } catch (err) {
    logger.warn('OCM enrichment for summaries failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return items;
  }
}

export async function attachOcmVerificationToDetail(
  detail: StorefrontDetailApiDocument,
  summary: StorefrontSummaryApiDocument | null,
): Promise<StorefrontDetailApiDocument> {
  if (!summary) return detail;
  try {
    const matches = await withTimeout(
      bulkMatchStorefronts([
        {
          id: detail.storefrontId,
          address: summary.addressLine1,
          zip: summary.zip,
          name: summary.displayName || summary.legalName,
        },
      ]),
      new Map<string, VerificationMatch>(),
    );
    const match = matches.get(detail.storefrontId);
    if (!match) return detail;
    return { ...detail, ocmVerification: shapeVerification(match) };
  } catch (err) {
    logger.warn('OCM enrichment for detail failed', {
      err: err instanceof Error ? err.message : String(err),
      storefrontId: detail.storefrontId,
    });
    return detail;
  }
}
