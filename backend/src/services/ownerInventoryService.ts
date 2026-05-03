/**
 * Per-owner inventory state for AI Inventory (Phase 1.7 + 1.8).
 *
 * Manages two collections:
 *   ownerInventory/{ownerUid}/items/{itemId}    — menu state
 *   inventoryAdjustments/{adjustmentId}          — audit log
 *
 * Every state mutation MUST write a paired adjustment doc so we have
 * a complete history of how stockLevel got to its current value.
 *
 * Spec: docs/AI_INVENTORY.md
 *
 * Phase 1.7 status: SCAFFOLD — function shapes are real and the
 * Firestore collection routing is wired, but the actual reads/writes
 * are stubbed and throw `not_implemented` until tomorrow's chunk.
 */

import { logger } from '../observability/logger';
import { getBackendFirebaseDb } from '../firebase';
import {
  OWNER_INVENTORY_COLLECTION,
  INVENTORY_ADJUSTMENTS_COLLECTION,
} from '../constants/collections';
import type {
  OwnerInventoryItem,
  InventoryAdjustment,
  InventoryAdjustmentReason,
} from '../types/aiInventory';

const ITEMS_SUBCOLLECTION = 'items';

/**
 * Add a freshly-scanned product to an owner's menu. Used by:
 *   - scan-product flow (sub-flow A)
 *   - shipment-receive flow (sub-flow B, when the catalog entry is new
 *     to this owner)
 *
 * Idempotent on (ownerUid, catalogId): if the item already exists,
 * this returns the existing record rather than duplicating.
 */
export async function addOwnerInventoryItem(_input: {
  ownerUid: string;
  catalogId: string;
  retailPrice: number;
  initialStockLevel: number;
  reason: Extract<InventoryAdjustmentReason, 'scan_add' | 'receive_shipment'>;
  sourceImageUrl: string | null;
}): Promise<
  | { ok: true; item: OwnerInventoryItem; adjustment: InventoryAdjustment; isNew: boolean }
  | { ok: false; reason: 'service_unavailable' | 'invalid_payload' | 'unknown'; message: string }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7):
  //   1. Look up existing item: ownerInventory/{ownerUid}/items where catalogId == X
  //   2. If exists: increment stockLevel by initialStockLevel, write adjustment
  //   3. If new: create item doc + write adjustment
  //   4. Return both records + isNew flag
  throw new Error(
    'ownerInventoryService.addOwnerInventoryItem: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Apply a stockLevel delta to an owner's existing item. Used by:
 *   - reconcile-receipt flow (delta < 0 for sales)
 *   - manual edit affordance in the UI (any delta)
 *   - mark-sold-out toggle (delta = -current stockLevel)
 *
 * Auto-flips isInStock = false when the new stockLevel reaches 0.
 */
export async function adjustOwnerInventoryItem(_input: {
  ownerUid: string;
  itemId: string;
  delta: number;
  reason: InventoryAdjustmentReason;
  sourceImageUrl: string | null;
  matchConfidence?: 'high' | 'medium' | 'low';
}): Promise<
  | { ok: true; item: OwnerInventoryItem; adjustment: InventoryAdjustment }
  | { ok: false; reason: 'not_found' | 'service_unavailable' | 'unknown'; message: string }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7):
  //   Transaction:
  //     1. Read item; bail with not_found if missing or owner mismatch
  //     2. Compute newStockLevel = max(0, current + delta)
  //     3. Compute newIsInStock = newStockLevel > 0
  //     4. Write item update + adjustment doc atomically
  throw new Error(
    'ownerInventoryService.adjustOwnerInventoryItem: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Owner-side toggle: mark an item sold out without specifying delta.
 * Distinct from `adjustOwnerInventoryItem` because the owner often
 * just wants to flip the public-facing badge without committing to
 * a stockLevel value. The catalog itself stays intact.
 */
export async function setOwnerInventoryItemAvailability(_input: {
  ownerUid: string;
  itemId: string;
  isInStock: boolean;
}): Promise<
  | { ok: true; item: OwnerInventoryItem; adjustment: InventoryAdjustment }
  | { ok: false; reason: 'not_found' | 'service_unavailable' | 'unknown'; message: string }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7): write isInStock + adjustment with reason
  // 'mark_sold_out' or 'mark_in_stock' (delta = 0 in both cases).
  throw new Error(
    'ownerInventoryService.setOwnerInventoryItemAvailability: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * List an owner's full menu inventory. Used by the Inventory hub
 * screen + the receipt-reconcile matching pass.
 */
export async function listOwnerInventoryItems(
  _ownerUid: string,
): Promise<
  | { ok: true; items: OwnerInventoryItem[] }
  | { ok: false; reason: 'service_unavailable' | 'unknown'; message: string }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7): read ownerInventory/{ownerUid}/items, sorted by
  // updatedAt desc. Cap at ~500 (NY shop typical SKU count is ~80).
  throw new Error(
    'ownerInventoryService.listOwnerInventoryItems: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Read the audit log for an owner's inventory. Powers the "what
 * happened to my stock?" view.
 */
export async function listInventoryAdjustments(_input: {
  ownerUid: string;
  itemId?: string;
  limit?: number;
}): Promise<
  | { ok: true; adjustments: InventoryAdjustment[] }
  | { ok: false; reason: 'service_unavailable' | 'unknown'; message: string }
> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return { ok: false, reason: 'service_unavailable', message: 'Firestore unavailable.' };
  }
  // TODO(phase-1.7): read INVENTORY_ADJUSTMENTS_COLLECTION where
  // ownerUid == X (and optional itemId == Y), order appliedAt desc,
  // limit defaults to 50.
  logger.debug('listInventoryAdjustments not implemented yet', { ownerUid: _input.ownerUid });
  throw new Error(
    'ownerInventoryService.listInventoryAdjustments: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

export { OWNER_INVENTORY_COLLECTION, INVENTORY_ADJUSTMENTS_COLLECTION, ITEMS_SUBCOLLECTION };
