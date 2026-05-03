/**
 * AI Inventory — types for Phase 1.7 (scan-to-add) + Phase 1.8
 * (receipt-photo reconciliation). Spec: docs/AI_INVENTORY.md.
 */

// ---- Shared catalog -------------------------------------------------

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

/**
 * Shared cross-owner catalog entry. Doc id = canonical product
 * identifier (UPC, or sha256 of normalized COA URL, or AI-generated
 * slug). The first owner to scan a product contributes the entry;
 * every subsequent owner who scans the same product hits the cached
 * entry instantly with zero AI cost.
 */
export type ProductCatalogEntry = {
  catalogId: string;
  // Identity (any combination may be present)
  upc: string | null;
  coaUrlHash: string | null; // sha256 of normalized COA URL
  metrcRetailItemUid: string | null; // post-May 5 2026 NY requirement
  // Product info — read from package label by vision AI
  brand: string;
  productName: string;
  strainType: StrainType;
  category: ProductCategory;
  packageWeight: string | null; // "1g", "100mg", "0.5g x 5", etc.
  thcPct: number | null;
  cbdPct: number | null;
  // Photo (owner-taken, copied to Cloud Storage)
  photoUrl: string | null;
  photoSource: 'owner_capture' | 'brand_supplied' | null;
  // Provenance
  firstScannedBy: string; // ownerUid
  firstScannedAt: string; // ISO
  scanCount: number;
  lastUpdatedAt: string;
  // Quality flag — owner can flag entries that look wrong
  needsReview: boolean;
};

// ---- Per-owner inventory --------------------------------------------

/**
 * Per-owner menu/inventory item. Stored under
 *   ownerInventory/{ownerUid}/items/{itemId}
 * Refs a productCatalog entry by catalogId; carries the owner's
 * specific retail price + stock state.
 */
export type OwnerInventoryItem = {
  itemId: string;
  ownerUid: string;
  catalogId: string;
  retailPrice: number; // dollars
  stockLevel: number;
  isInStock: boolean;
  addedAt: string;
  lastReconciledAt: string | null;
  updatedAt: string;
};

// ---- Adjustment audit log ------------------------------------------

export type InventoryAdjustmentReason =
  | 'scan_add' // Phase 1.7 sub-flow A — owner scanned a single product
  | 'receive_shipment' // Phase 1.7 sub-flow B — wholesale case received
  | 'reconcile_sale' // Phase 1.8 — receipt photo decremented stock
  | 'manual_edit' // Owner directly edited the stock field
  | 'mark_sold_out' // Owner tapped "sold out" toggle
  | 'mark_in_stock'; // Owner re-enabled an item that was sold out

export type InventoryAdjustment = {
  adjustmentId: string;
  ownerUid: string;
  itemId: string;
  catalogId: string;
  delta: number; // +N for receives, -N for sales
  newStockLevel: number;
  reason: InventoryAdjustmentReason;
  sourceImageUrl: string | null; // gs:// URL for the photo that justified this
  appliedAt: string;
  // For reconcile_sale only — the AI's confidence in the match
  matchConfidence?: 'high' | 'medium' | 'low';
};

// ---- Phase 1.7 — scan single product --------------------------------

export type ScanProductRequest = {
  imageGcsUrl: string;
  // Optional: existing catalog entry to merge into instead of
  // creating new (used by the "I think this is one of my existing
  // items" flow in the review UI).
  catalogIdHint?: string;
};

export type ScanProductResult =
  | {
      ok: true;
      catalogEntry: ProductCatalogEntry;
      isNewCatalogEntry: boolean;
      modelUsed: 'gemini-1.5-flash' | 'claude-haiku-4-5' | 'claude-sonnet-4-5' | 'cached';
      extractionConfidence: 'high' | 'medium' | 'low';
      extractionNotes: string;
      // AI's price-range guess if the package showed any pricing context
      // (most don't, but some have suggested-retail printed). Used to
      // pre-fill the owner's retailPrice field as a hint.
      suggestedRetailPriceLow: number | null;
      suggestedRetailPriceHigh: number | null;
    }
  | {
      ok: false;
      reason: 'image_unreadable' | 'not_a_cannabis_product' | 'service_error';
      message: string;
    };

// ---- Phase 1.7 — scan shipment (two-step) --------------------------

export type ScanShipmentStep = 'box' | 'unit';

export type ScanShipmentRequest = {
  imageGcsUrl: string;
  step: ScanShipmentStep;
  // Required for step: 'unit' — refs the prior box scan so we
  // can detect mismatches and inherit batch info.
  boxScanId?: string;
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
  // Best-effort match to the prior box scan
  boxScanId: string | null;
  matchesBox: boolean | null;
  // Same product info as a single-product scan
  catalogEntry: ProductCatalogEntry;
  // If the unit's COA QR was readable, we attach the URL so the
  // existing productCatalogService can resolve lab + batch ID.
  detectedCoaUrl: string | null;
};

export type ScanShipmentResult =
  | { ok: true; step: 'box'; box: BoxScanResult }
  | { ok: true; step: 'unit'; unit: UnitScanResult }
  | { ok: false; reason: string; message: string };

// ---- Phase 1.8 — reconcile receipt ---------------------------------

export type ReconcileReceiptRequest = {
  // Owner can attach multiple photos for long receipts / multi-page
  // POS reports. AI is given them in order.
  imageGcsUrls: string[];
};

export type ReceiptSaleLine = {
  rawText: string; // exact line as the AI read it from the receipt
  parsedItemDescription: string;
  parsedQuantity: number;
  parsedUnitPrice: number | null;
  parsedTotal: number | null;
  // Match against the owner's existing menu inventory
  matchedItemId: string | null;
  matchedCatalogId: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  // Set true once the owner approves this line in the review UI
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
  // After apply: total stock decremented across all lines
  totalUnitsDecremented: number;
};

export type ReconcileReceiptResult =
  | { ok: true; draft: ReceiptReconcileDraft }
  | { ok: false; reason: string; message: string };
