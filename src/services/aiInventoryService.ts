/**
 * Frontend client for the AI Inventory backend (Phase 1.7 + 1.8).
 * Mirrors the endpoints documented in docs/AI_INVENTORY.md.
 */

import { requestJson } from './storefrontBackendHttp';

// ---- Mirrored types -------------------------------------------------
//
// Kept inline rather than imported from backend to avoid pulling
// backend-only types into the RN bundle.

export type ProductCategory =
  | 'pre_roll'
  | 'flower'
  | 'vape_cart'
  | 'edible'
  | 'tincture'
  | 'topical'
  | 'concentrate'
  | 'other';

export type StrainType = 'indica' | 'sativa' | 'hybrid' | 'cbd' | 'unknown';

export type ProductCatalogEntry = {
  catalogId: string;
  upc: string | null;
  coaUrlHash: string | null;
  metrcRetailItemUid: string | null;
  brand: string;
  productName: string;
  strainType: StrainType;
  category: ProductCategory;
  packageWeight: string | null;
  thcPct: number | null;
  cbdPct: number | null;
  photoUrl: string | null;
  photoSource: 'owner_capture' | 'brand_supplied' | null;
  firstScannedBy: string;
  firstScannedAt: string;
  scanCount: number;
  lastUpdatedAt: string;
  needsReview: boolean;
};

export type OwnerInventoryItem = {
  itemId: string;
  ownerUid: string;
  catalogId: string;
  retailPrice: number;
  stockLevel: number;
  isInStock: boolean;
  addedAt: string;
  lastReconciledAt: string | null;
  updatedAt: string;
};

export type InventoryAdjustmentReason =
  | 'scan_add'
  | 'receive_shipment'
  | 'reconcile_sale'
  | 'manual_edit'
  | 'mark_sold_out'
  | 'mark_in_stock';

export type InventoryAdjustment = {
  adjustmentId: string;
  ownerUid: string;
  itemId: string;
  catalogId: string;
  delta: number;
  newStockLevel: number;
  reason: InventoryAdjustmentReason;
  sourceImageUrl: string | null;
  appliedAt: string;
  matchConfidence?: 'high' | 'medium' | 'low';
};

export type BoxScanResult = {
  scanId: string;
  brand: string | null;
  productLine: string | null;
  variant: string | null;
  unitCount: number | null;
  lotNumber: string | null;
  batchNumber: string | null;
  distributorName: string | null;
  manifestQrUrl: string | null;
  extractionConfidence: 'high' | 'medium' | 'low';
  extractionNotes: string;
};

export type UnitScanResult = {
  scanId: string;
  boxScanId: string | null;
  matchesBox: boolean | null;
  catalogEntry: ProductCatalogEntry;
  detectedCoaUrl: string | null;
};

export type ReceiptSaleLine = {
  rawText: string;
  parsedItemDescription: string;
  parsedQuantity: number;
  parsedUnitPrice: number | null;
  parsedTotal: number | null;
  matchedItemId: string | null;
  matchedCatalogId: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  approved: boolean;
};

export type ReceiptReconcileDraft = {
  draftId: string;
  ownerUid: string;
  imageGcsUrls: string[];
  status: 'parsing' | 'ready' | 'applying' | 'applied' | 'failed';
  saleLines: ReceiptSaleLine[];
  failureReason: string | null;
  createdAt: string;
  parsedAt: string | null;
  appliedAt: string | null;
  totalUnitsDecremented: number;
};

// ---- Response envelopes --------------------------------------------

type ScanProductEnvelope = {
  ok: true;
  catalogEntry: ProductCatalogEntry;
  isNewCatalogEntry: boolean;
  modelUsed: 'gemini-1.5-flash' | 'claude-haiku-4-5' | 'claude-sonnet-4-5';
  extractionConfidence: 'high' | 'medium' | 'low';
  extractionNotes: string;
  suggestedRetailPriceLow: number | null;
  suggestedRetailPriceHigh: number | null;
  item: OwnerInventoryItem | null;
};

type ScanShipmentBoxEnvelope = {
  ok: true;
  step: 'box';
  box: BoxScanResult;
  modelUsed: 'gemini-1.5-flash' | 'claude-haiku-4-5' | 'claude-sonnet-4-5';
  extractionConfidence: 'high' | 'medium' | 'low';
};

type ScanShipmentUnitEnvelope = {
  ok: true;
  step: 'unit';
  unit: UnitScanResult;
  modelUsed: 'gemini-1.5-flash' | 'claude-haiku-4-5' | 'claude-sonnet-4-5';
  extractionConfidence: 'high' | 'medium' | 'low';
};

type ScanShipmentEnvelope = ScanShipmentBoxEnvelope | ScanShipmentUnitEnvelope;

type ReconcileDraftEnvelope = { ok: true; draft: ReceiptReconcileDraft };

type AdjustItemEnvelope = {
  ok: true;
  item: OwnerInventoryItem;
  adjustment: InventoryAdjustment;
};

type ListItemsEnvelope = { ok: true; items: OwnerInventoryItem[] };
type ListAdjustmentsEnvelope = { ok: true; adjustments: InventoryAdjustment[] };

// ---- Phase 1.7 — scan single product -------------------------------

export function scanProduct(input: { imageGcsUrl: string; retailPrice?: number }) {
  return requestJson<ScanProductEnvelope>('/owner-portal/inventory/scan-product', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---- Phase 1.7 — scan shipment (two-step) --------------------------

export function scanShipmentBox(input: { imageGcsUrl: string }) {
  return requestJson<ScanShipmentEnvelope>('/owner-portal/inventory/scan-shipment', {
    method: 'POST',
    body: JSON.stringify({ ...input, step: 'box' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function scanShipmentUnit(input: {
  imageGcsUrl: string;
  boxBrand: string | null;
  boxProductLine: string | null;
}) {
  return requestJson<ScanShipmentEnvelope>('/owner-portal/inventory/scan-shipment', {
    method: 'POST',
    body: JSON.stringify({ ...input, step: 'unit' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---- Phase 1.8 — receipt reconciliation ----------------------------

export function startReconcileReceipt(input: { imageGcsUrls: string[] }) {
  return requestJson<ReconcileDraftEnvelope>('/owner-portal/inventory/reconcile-receipt', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getReconcileReceiptDraft(draftId: string) {
  return requestJson<ReconcileDraftEnvelope>(
    `/owner-portal/inventory/reconcile-receipt/${encodeURIComponent(draftId)}`,
    { method: 'GET' },
  );
}

export function updateReconcileReceiptDraft(input: {
  draftId: string;
  saleLines: ReceiptSaleLine[];
}) {
  return requestJson<ReconcileDraftEnvelope>(
    `/owner-portal/inventory/reconcile-receipt/${encodeURIComponent(input.draftId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ saleLines: input.saleLines }),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export function applyReconcileReceiptDraft(draftId: string) {
  return requestJson<ReconcileDraftEnvelope>(
    `/owner-portal/inventory/reconcile-receipt/${encodeURIComponent(draftId)}/apply`,
    { method: 'POST' },
  );
}

// ---- Per-owner menu ------------------------------------------------

export function listOwnerInventory() {
  return requestJson<ListItemsEnvelope>('/owner-portal/inventory/items', { method: 'GET' });
}

export function adjustInventoryItem(input: {
  itemId: string;
  delta: number;
  reason: 'manual_edit' | 'mark_sold_out' | 'mark_in_stock';
}) {
  return requestJson<AdjustItemEnvelope>(
    `/owner-portal/inventory/items/${encodeURIComponent(input.itemId)}/adjust`,
    {
      method: 'POST',
      body: JSON.stringify({ delta: input.delta, reason: input.reason }),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export function listInventoryAdjustments(query?: { itemId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (query?.itemId) params.set('itemId', query.itemId);
  if (query?.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return requestJson<ListAdjustmentsEnvelope>(
    `/owner-portal/inventory/adjustments${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}
