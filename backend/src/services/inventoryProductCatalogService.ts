/**
 * Shared product catalog for AI Inventory (Phase 1.7).
 *
 * Distinct from `productCatalogService.ts` (which parses COA URLs for
 * the consumer scan tab). This service manages the SHARED Firestore
 * `productCatalog` collection — every owner contributes entries on
 * first scan, every subsequent owner gets an instant DB hit.
 *
 * Spec: docs/AI_INVENTORY.md
 *
 * Phase 1.7 status: SCAFFOLD — function shapes are real and the
 * Firestore collection routing is wired, but the actual reads/writes
 * are stubbed and throw `not_implemented` until tomorrow's chunk.
 */

import { createHash } from 'node:crypto';
import { logger } from '../observability/logger';
import { getBackendFirebaseDb } from '../firebase';
import { PRODUCT_CATALOG_COLLECTION } from '../constants/collections';
import type { ProductCatalogEntry } from '../types/aiInventory';
import type { PartialCatalogPayload } from './visionAiInventoryService';

/**
 * Stable doc-id for a catalog entry. Priority order:
 *   1. UPC (most reliable when present on the package)
 *   2. sha256(normalizedCoaUrl) — present when the unit has a COA QR
 *   3. AI-generated slug from brand + product name + weight
 *
 * Treating these as a tiered set means two scans of the same product
 * by different owners always collapse to the same doc, regardless of
 * which signal each scan happened to surface.
 */
export type CatalogIdentitySignals = {
  upc?: string | null;
  coaUrl?: string | null;
  brand?: string | null;
  productName?: string | null;
  packageWeight?: string | null;
};

export function deriveCatalogId(signals: CatalogIdentitySignals): string {
  if (signals.upc && signals.upc.trim()) {
    return `upc_${signals.upc.replace(/\D/g, '')}`;
  }
  if (signals.coaUrl && signals.coaUrl.trim()) {
    const normalized = signals.coaUrl.trim().toLowerCase().replace(/\/+$/, '');
    const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 32);
    return `coa_${hash}`;
  }
  const brand = (signals.brand ?? '').trim().toLowerCase();
  const name = (signals.productName ?? '').trim().toLowerCase();
  const weight = (signals.packageWeight ?? '').trim().toLowerCase();
  const slug = `${brand}__${name}__${weight}`
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!slug) {
    // Fallback: pure timestamp-based id so we never block a write.
    return `unknown_${Date.now()}`;
  }
  return `slug_${slug}`;
}

export type LookupResult =
  | { ok: true; found: true; entry: ProductCatalogEntry }
  | { ok: true; found: false }
  | { ok: false; reason: 'service_unavailable' | 'unknown'; message: string };

/**
 * Look up an existing catalog entry by signals (UPC / COA URL / slug).
 *
 * Returns `{ found: false }` (not an error) when no match exists —
 * callers should then proceed to write a new entry via
 * `upsertCatalogEntry`.
 */
export async function lookupCatalogEntry(_signals: CatalogIdentitySignals): Promise<LookupResult> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7): read PRODUCT_CATALOG_COLLECTION/{deriveCatalogId(signals)}.
  // If the doc exists, increment `scanCount` (FieldValue.increment(1))
  // and return the parsed entry. If not, return { found: false }.
  throw new Error(
    'inventoryProductCatalogService.lookupCatalogEntry: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

export type UpsertResult =
  | { ok: true; entry: ProductCatalogEntry; isNew: boolean }
  | { ok: false; reason: 'service_unavailable' | 'invalid_payload' | 'unknown'; message: string };

/**
 * Create or update a catalog entry. Used by:
 *   - scan-product flow (creates new entries on first sighting)
 *   - shipment-receive flow (same — but typically with COA QR data)
 *
 * If the doc already exists, this MERGES owner-supplied corrections
 * onto the existing entry rather than overwriting (the catalog is a
 * crowdsourced moat — preserving early scans is important).
 */
export async function upsertCatalogEntry(
  _ownerUid: string,
  _payload: PartialCatalogPayload & { upc?: string | null; coaUrlHash?: string | null },
): Promise<UpsertResult> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7):
  //   1. deriveCatalogId from payload signals
  //   2. read existing entry (if any)
  //   3. if new: write with firstScannedBy=ownerUid, scanCount=1, needsReview=false
  //   4. if existing: merge owner corrections, increment scanCount, bump lastUpdatedAt
  //   5. return { entry, isNew: !existed }
  throw new Error(
    'inventoryProductCatalogService.upsertCatalogEntry: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Owner-flagged corrections for a catalog entry. Bumps `needsReview`
 * so an admin can audit + canonicalize. Used by the "this looks wrong"
 * affordance on the catalog detail screen.
 */
export async function flagCatalogEntryForReview(
  _catalogId: string,
  _flaggedByOwnerUid: string,
  _reason: string,
): Promise<{ ok: true } | { ok: false; reason: string; message: string }> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7): set needsReview=true + append a flag record to a
  // subcollection so we have an audit trail. Don't immediately remove
  // the entry — we want the admin to make the call.
  logger.info('flagCatalogEntryForReview not implemented yet', {
    catalogId: _catalogId,
    flaggedByOwnerUid: _flaggedByOwnerUid,
  });
  throw new Error(
    'inventoryProductCatalogService.flagCatalogEntryForReview: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Fuzzy lookup by brand + product name + weight. Used by the receipt
 * reconciliation flow when the AI parses a sale line that doesn't
 * carry a UPC — we still want to find the catalog entry the owner
 * has on their shelf.
 *
 * Phase 1.8 will implement this as a Firestore composite query +
 * in-memory ranking; for now it's a stub.
 */
export async function fuzzyLookupBySignals(_signals: {
  brand: string;
  productName: string;
  weight: string | null;
}): Promise<
  | {
      ok: true;
      candidates: Array<{ entry: ProductCatalogEntry; score: number }>;
    }
  | {
      ok: false;
      reason: string;
      message: string;
    }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.8): Firestore range query on lowercased brand prefix,
  // then in-memory rank by token-overlap on productName + weight match.
  throw new Error(
    'inventoryProductCatalogService.fuzzyLookupBySignals: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

// Re-export the collection constant for callers that need to read it
// directly (e.g. firestore-rules generators).
export { PRODUCT_CATALOG_COLLECTION };
