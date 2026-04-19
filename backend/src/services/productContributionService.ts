/**
 * Product Contribution Service
 *
 * Handles crowdsourced product catalog submissions from the scan flow.
 *
 * When a shopper scans a barcode or unrecognized URL that we can't fully
 * resolve (catalogState 'uncatalogued' or 'unrecognized_lab'), the
 * ScanResultScreen shows a soft prompt asking them to add brand + product
 * info. Those submissions land here.
 *
 * Persistence target: Firestore `productContributions` collection.
 *   - Anonymous: identified only by installId
 *   - Indexed by rawCode for dedupe + admin review queues
 *   - Schema versioned for future migrations
 *
 * Privacy / safety posture:
 *   - No PII collected (just installId + free-form notes)
 *   - Notes capped at 500 chars to prevent abuse
 *   - Fail-soft: never throws to the route layer
 *   - Counts dupes per rawCode so we can prioritize popular gaps
 */

import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';

const NOTES_MAX_LENGTH = 500;
const FREE_TEXT_MAX_LENGTH = 200;

export type ProductContributionInput = {
  rawCode: string;
  installId: string;
  brandName?: string;
  productName?: string;
  upc?: string;
  coaUrl?: string;
  notes?: string;
};

export type ProductContributionResult = {
  accepted: boolean;
  contributionId?: string;
  duplicateCount?: number;
  error?: string;
};

type StoredContribution = {
  rawCode: string;
  installId: string;
  brandName?: string;
  productName?: string;
  upc?: string;
  coaUrl?: string;
  notes?: string;
  submittedAt: string;
  schemaVersion: 1;
};

/**
 * Strip control characters and clip to a safe length.
 */
function sanitize(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Strip non-printable ASCII < 32 except tab/newline; preserve unicode.
  const cleaned = value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Build a Firestore-safe doc ID from the rawCode for dedupe lookups.
 * Slashes / dots / # break Firestore IDs, so encode them.
 */
function rawCodeAggregateId(rawCode: string): string {
  return encodeURIComponent(rawCode.trim()).slice(0, 1500);
}

/**
 * Submit a product contribution.
 *
 * Always returns; never throws. If Firestore is unavailable, returns
 * `{ accepted: false, error: ... }` so the client can display a
 * friendly retry/contact message.
 */
export async function submitProductContribution(
  input: ProductContributionInput,
): Promise<ProductContributionResult> {
  if (!input.rawCode || !input.rawCode.trim()) {
    return { accepted: false, error: 'rawCode is required' };
  }
  if (!input.installId || !input.installId.trim()) {
    return { accepted: false, error: 'installId is required' };
  }

  // At minimum we need *something* useful besides the rawCode.
  const brandName = sanitize(input.brandName, FREE_TEXT_MAX_LENGTH);
  const productName = sanitize(input.productName, FREE_TEXT_MAX_LENGTH);
  const upc = sanitize(input.upc, 32);
  const coaUrl = sanitize(input.coaUrl, 1000);
  const notes = sanitize(input.notes, NOTES_MAX_LENGTH);

  if (!brandName && !productName && !coaUrl && !notes) {
    return {
      accepted: false,
      error: 'At least one of brandName, productName, coaUrl, or notes must be provided',
    };
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    logger.warn('[productContribution] Firestore unavailable, cannot persist contribution');
    return { accepted: false, error: 'Contribution service unavailable' };
  }

  try {
    const contribution: StoredContribution = {
      rawCode: input.rawCode.trim(),
      installId: input.installId.trim(),
      brandName,
      productName,
      upc,
      coaUrl,
      notes,
      submittedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    // Strip undefined fields before writing — Firestore rejects them.
    const cleanContribution = Object.fromEntries(
      Object.entries(contribution).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>;

    const docRef = await db.collection('productContributions').add(cleanContribution);

    // Maintain an aggregate doc per rawCode so we can prioritize popular
    // gaps (e.g. "this barcode has been submitted 12 times — fast-track it").
    const aggregateRef = db
      .collection('productContributionAggregates')
      .doc(rawCodeAggregateId(input.rawCode));

    let duplicateCount = 1;
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(aggregateRef);
        const existing = snap.exists
          ? (snap.data() as
              | { count?: number; lastBrandName?: string; lastProductName?: string }
              | undefined)
          : undefined;
        duplicateCount = (existing?.count ?? 0) + 1;
        tx.set(
          aggregateRef,
          {
            rawCode: input.rawCode.trim(),
            count: duplicateCount,
            lastSubmittedAt: new Date().toISOString(),
            lastBrandName: brandName ?? existing?.lastBrandName,
            lastProductName: productName ?? existing?.lastProductName,
          },
          { merge: true },
        );
      });
    } catch (aggErr) {
      // Aggregate failure shouldn't fail the whole submission.
      logger.warn('[productContribution] Aggregate update failed', {
        error: aggErr instanceof Error ? aggErr.message : String(aggErr),
      });
    }

    logger.info('[productContribution] Accepted contribution', {
      contributionId: docRef.id,
      installId: contribution.installId,
      hasBrand: Boolean(brandName),
      hasProduct: Boolean(productName),
      hasCoaUrl: Boolean(coaUrl),
      duplicateCount,
    });

    return {
      accepted: true,
      contributionId: docRef.id,
      duplicateCount,
    };
  } catch (err) {
    logger.warn('[productContribution] Failed to persist contribution', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      accepted: false,
      error: err instanceof Error ? err.message : 'Failed to record contribution',
    };
  }
}
