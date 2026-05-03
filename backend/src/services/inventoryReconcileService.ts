/**
 * Receipt-photo reconciliation orchestrator (Phase 1.8).
 *
 * Pipeline:
 *   Owner uploads N photos (POS summary, receipts, screenshots, etc.)
 *     → callVisionInventoryAi('reconcile_receipt', images)
 *     → AI returns array of ReceiptSaleLine
 *     → fuzzyLookupBySignals against owner's existing menu items
 *     → store as ReceiptReconcileDraft (status: 'ready')
 *     → owner reviews + approves in UI
 *     → applyReconcileDraft writes adjustments to ownerInventory
 *
 * Spec: docs/AI_INVENTORY.md
 *
 * Phase 1.8 status: SCAFFOLD — function shapes are real and the
 * service-call wiring is in place, but the actual draft persistence,
 * matching, and apply-step are stubbed and throw `not_implemented`
 * until tomorrow's chunk.
 */

import { logger } from '../observability/logger';
import { getBackendFirebaseDb } from '../firebase';
import type {
  ReceiptReconcileDraft,
  ReceiptSaleLine,
  ReconcileReceiptResult,
} from '../types/aiInventory';
import { callVisionInventoryAi } from './visionAiInventoryService';
import { fuzzyLookupBySignals } from './inventoryProductCatalogService';
import { listOwnerInventoryItems, adjustOwnerInventoryItem } from './ownerInventoryService';

/**
 * Sub-collection under each owner doc:
 *   ownerInventory/{ownerUid}/reconcileDrafts/{draftId}
 *
 * Drafts live for 30 days then a scheduled job sweeps them.
 */
const RECONCILE_DRAFTS_SUBCOLLECTION = 'reconcileDrafts';

export type StartReconcileInput = {
  ownerUid: string;
  imageGcsUrls: string[];
};

/**
 * Kick off a reconcile job. Stores a draft with status 'parsing',
 * fires the AI call (async; updates draft when done), returns the
 * draftId so the frontend can poll.
 */
export async function startReconcileDraft(
  _input: StartReconcileInput,
): Promise<ReconcileReceiptResult> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.8):
  //   1. Create draft doc with status='parsing', createdAt=now
  //   2. Fire-and-forget runReconcileParse(draftId, ownerUid, imageGcsUrls)
  //      — same fire-and-forget pattern as aiShopBootstrapService
  //   3. Return { ok: true, draft } with the parsing-state draft so the
  //      frontend can poll for completion
  throw new Error(
    'inventoryReconcileService.startReconcileDraft: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Run the AI parse + match pass. Called fire-and-forget from
 * startReconcileDraft; updates the draft doc when complete.
 *
 * Exported so the route layer can invoke it directly during local
 * dev (skip the fire-and-forget wrapper for easier debugging).
 */
export async function runReconcileParse(
  ownerUid: string,
  draftId: string,
  imageGcsUrls: string[],
): Promise<void> {
  // Ordering guarantee: pull owner's menu BEFORE the AI call so the
  // hint payload is fresh, then send to the AI.
  const itemsResult = await listOwnerInventoryItems(ownerUid);
  if (!itemsResult.ok) {
    logger.warn('runReconcileParse: failed to fetch owner items, AI matching will be limited', {
      ownerUid,
      draftId,
      reason: itemsResult.reason,
    });
  }
  const knownMenuItems = itemsResult.ok
    ? itemsResult.items.map((item) => ({
        catalogId: item.catalogId,
        // Owner inventory item doesn't carry display info directly —
        // tomorrow's wiring will join against productCatalog. For
        // scaffold purposes we surface the catalogId.
        brand: '',
        productName: '',
        weight: null as string | null,
      }))
    : [];

  const aiResult = await callVisionInventoryAi({
    task: 'reconcile_receipt',
    imageGcsUrls,
    knownMenuItems,
  });

  // TODO(phase-1.8):
  //   1. If aiResult.ok && task === 'reconcile_receipt':
  //        - For each saleLine without matchedItemId, run
  //          fuzzyLookupBySignals to populate matchedCatalogId
  //        - Persist the populated saleLines onto the draft, status='ready'
  //   2. If aiResult NOT ok: write status='failed', failureReason=...
  logger.debug('runReconcileParse not implemented yet', {
    ownerUid,
    draftId,
    aiResultOk: aiResult.ok,
  });
  throw new Error(
    'inventoryReconcileService.runReconcileParse: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Read a reconcile draft (for polling). Owner-scoped.
 */
export async function getReconcileDraft(
  _ownerUid: string,
  _draftId: string,
): Promise<
  | { ok: true; draft: ReceiptReconcileDraft }
  | { ok: false; reason: 'not_found' | 'service_unavailable' | 'unknown'; message: string }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.8): read ownerInventory/{ownerUid}/reconcileDrafts/{draftId}
  throw new Error(
    'inventoryReconcileService.getReconcileDraft: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Owner edits a draft before apply (e.g. corrects a fuzzy-match,
 * unchecks a line, adds a missing item). Replaces the saleLines
 * array verbatim — frontend is the source of truth.
 */
export async function updateReconcileDraftLines(_input: {
  ownerUid: string;
  draftId: string;
  saleLines: ReceiptSaleLine[];
}): Promise<
  | { ok: true; draft: ReceiptReconcileDraft }
  | {
      ok: false;
      reason: 'not_found' | 'service_unavailable' | 'invalid_state' | 'unknown';
      message: string;
    }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.8):
  //   - Validate draft exists + ownerUid match + status === 'ready'
  //   - Replace saleLines, bump updatedAt
  throw new Error(
    'inventoryReconcileService.updateReconcileDraftLines: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Apply an approved reconcile draft. Walks every approved sale line
 * and decrements the matched ownerInventory item's stockLevel.
 * Auto-flips isInStock=false on items that hit 0.
 *
 * Atomicity note: per-line, NOT per-draft. If line 7 of 10 fails
 * (matched item was deleted between parse and apply), lines 1-6 still
 * get their adjustments. That's the desired UX — owner shouldn't lose
 * 9 valid sales because of one orphan reference.
 */
export async function applyReconcileDraft(_input: {
  ownerUid: string;
  draftId: string;
}): Promise<
  | { ok: true; draft: ReceiptReconcileDraft }
  | {
      ok: false;
      reason: 'not_found' | 'service_unavailable' | 'invalid_state' | 'unknown';
      message: string;
    }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.8):
  //   1. Read draft, assert status === 'ready'
  //   2. Set status='applying'
  //   3. For each approved line with matchedItemId:
  //        adjustOwnerInventoryItem({ delta: -line.parsedQuantity,
  //                                    reason: 'reconcile_sale',
  //                                    sourceImageUrl: draft.imageGcsUrls[0],
  //                                    matchConfidence: line.matchConfidence })
  //   4. Set draft status='applied', appliedAt=now,
  //      totalUnitsDecremented=sum
  //   5. Catch per-line failures, log them, don't fail the whole apply
  // The functions below are referenced so the import set survives the
  // typecheck — remove these once the real impl uses them.
  void adjustOwnerInventoryItem;
  void fuzzyLookupBySignals;
  throw new Error(
    'inventoryReconcileService.applyReconcileDraft: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

export { RECONCILE_DRAFTS_SUBCOLLECTION };
