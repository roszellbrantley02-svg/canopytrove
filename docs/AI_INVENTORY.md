# AI Inventory — Phases 1.7 + 1.8

**Status:** in development (started May 3 2026)
**Branch:** `feat/ai-inventory`
**Sister doc:** `docs/AI_SHOP_BOOTSTRAP.md` (Phase 1, already shipped)

## What this is

Two complementary owner-side flows that, together, give a dispensary owner full menu + inventory management WITHOUT integrating with their POS:

- **Phase 1.7 — Scan to add inventory.** Owner snaps a photo of a product on their shelf (or a wholesale shipment box). Vision AI reads the label and adds a real menu entry with a real photo.
- **Phase 1.8 — Receipt-photo reconciliation.** End of day, owner snaps a photo of their POS sales summary (or stack of receipts). Vision AI parses sale lines and decrements menu inventory automatically.

Both flows share infrastructure (productCatalog collection, vision AI service, owner-mode camera screen) and ship together.

## Why this matters

Existing AI Shop Bootstrap (Phase 1) handles the **initial setup** of an owner's listing from their website. But two big problems remained:

1. **Owners without websites** (~20% of NY licensees per the bootstrap research) couldn't bootstrap from a site.
2. **Inventory always rotted** — initial bootstrap worked, but as products sold and new shipments arrived, the menu drifted out of sync. Manual updates always rot. POS integrations require partner approvals (months) and are POS-specific (5+ integrations to cover NY).

**Phase 1.7 solves problem #1**: scan products directly from your shelf, no website required.

**Phase 1.8 solves problem #2**: take one photo of your end-of-day sales summary, AI does the inventory math. Works with ANY POS — Dutchie, Treez, Flowhub, Carrot, paper ledger — because vision AI doesn't care about format.

Combined: an owner can run their entire Canopy Trove listing from their phone with zero POS integration debt, zero manual inventory tracking, zero website required.

## Architecture overview

```
Owner Portal Inventory hub (NEW screen)
   │
   ├─ "Add product" → Phase 1.7 scan-product flow
   ├─ "Receive shipment" → Phase 1.7 scan-shipment two-step flow
   └─ "End-of-day reconcile" → Phase 1.8 receipt-photo flow

Backend services (NEW):
   visionAiInventoryService       — routes vision calls (Gemini Flash default,
                                    Sonnet 4.5 fallback for low confidence)
   productCatalogService          — read/write SHARED productCatalog
   inventoryReconcileService      — parses sales-receipt photos → adjustment lines
   ownerInventoryService          — read/write per-owner menu inventory state

Firestore (NEW collections):
   productCatalog/{upcOrCoaId}    — SHARED catalog, all owners contribute & benefit
                                    Schema: brand, productName, strainType, category,
                                            thcPct, cbdPct, packageWeight, photoUrl,
                                            firstScannedBy, scanCount, lastUpdatedAt
   ownerInventory/{ownerUid}/items/{itemId}
                                  — per-owner menu/inventory state
                                    Schema: catalogId (ref), retailPrice, stockLevel,
                                            isInStock, addedAt, lastReconciledAt
   inventoryAdjustments/{adjustmentId}
                                  — audit log of every inventory change
                                    Schema: ownerUid, itemId, delta, reason
                                            ('scan_add' | 'receive_shipment' | 'reconcile_sale'
                                             | 'manual_edit' | 'mark_sold_out'),
                                            sourceImageUrl, appliedAt

Endpoints (NEW):
   POST /owner-portal/inventory/scan-product
   POST /owner-portal/inventory/scan-shipment
   POST /owner-portal/inventory/reconcile-receipt
   POST /owner-portal/inventory/items/{itemId}/adjust
   GET  /owner-portal/inventory/items
   GET  /owner-portal/inventory/adjustments
```

## Shared foundation

### `productCatalog` collection — the moat

A SINGLE shared collection across all owners. Doc id is the canonical product identifier (UPC barcode, COA URL hash, or AI-generated slug).

When the FIRST owner scans a product, AI reads the label and writes the entry. Every subsequent owner who scans the same product gets an instant DB lookup with zero AI cost. After ~3 months and a few hundred owners, the catalog covers 80%+ of common NY cannabis products.

**This is a defensible moat.** Dutchie/Jane don't have it. We become the only platform with a crowdsourced NY cannabis product catalog.

Schema:

```ts
type ProductCatalogEntry = {
  catalogId: string; // doc id
  // Identity (any of these may be how the entry was first found)
  upc: string | null;
  coaUrlHash: string | null; // sha256 of normalized COA URL
  metrcRetailItemUid: string | null; // post-May 5 2026 NY requirement
  // Product info (read from package label)
  brand: string;
  productName: string;
  strainType: 'indica' | 'sativa' | 'hybrid' | 'cbd' | 'unknown';
  category:
    | 'pre_roll'
    | 'flower'
    | 'vape_cart'
    | 'edible'
    | 'tincture'
    | 'topical'
    | 'concentrate'
    | 'other';
  packageWeight: string | null; // "1g", "100mg", etc.
  thcPct: number | null;
  cbdPct: number | null;
  // Photo (owner-taken, copied to Cloud Storage)
  photoUrl: string | null;
  photoSource: 'owner_capture' | 'brand_supplied' | null;
  // Provenance
  firstScannedBy: string; // ownerUid
  firstScannedAt: string; // ISO
  scanCount: number; // total times any owner scanned
  lastUpdatedAt: string;
  // Verification
  needsReview: boolean; // flagged by an owner as wrong
};
```

### `visionAiInventoryService` — model routing

Routes vision API calls based on cost + confidence:

```ts
async function callVisionAi(
  task: 'scan_product' | 'scan_shipment' | 'reconcile_receipt',
  imageBase64: string,
  context: VisionContext,
): Promise<{ result: T; modelUsed: string; confidence: 'high' | 'medium' | 'low' }>;
```

Default routing:

- **Gemini 1.5 Flash** for all initial calls (free tier: 1500/day total)
- If Gemini returns confidence < `low` → automatic retry with **Claude Sonnet 4.5**
- Per-tenant cost capping: if Sonnet calls exceed N/day for one owner, surface a "verify manually" prompt instead

Env vars consumed:

- `LLM_PROVIDER_INVENTORY` (default `gemini`, override `anthropic`)
- `GEMINI_API_KEY` (Secret Manager, new)
- `ANTHROPIC_API_KEY` (Secret Manager, existing)

### `ownerScanCameraScreen` — reused from existing scan tab

The existing `ScanCameraScreen.tsx` already handles camera capture, permissions, and image upload. We add an `ownerMode` prop and route differently based on which sub-flow we're in.

## Phase 1.7 — Scan to add inventory

### Sub-flow A: scan a single product

```
Owner Portal Inventory hub → "Add product" button
  → Camera opens (owner-mode)
  → Owner snaps photo of product
  → Image uploaded to Cloud Storage
  → POST /owner-portal/inventory/scan-product { imageGcsUrl, ownerUid }
  → Backend:
      1. Check productCatalog by image hash (rare hit, but free if found)
      2. Call visionAiInventoryService('scan_product', imageBase64)
      3. AI returns: brand, productName, strain, category, weight, thcPct, cbdPct,
                     suggestedRetailPriceRange
      4. Lookup productCatalog by (brand + productName + weight) — fuzzy match
      5. If found: return existing catalog entry + suggest "add to your menu"
      6. If not found: create new catalog entry, return it
  → Frontend shows AI suggestion side-by-side with editable fields:
      Brand: Stiiizy            ← editable
      Product: Live Resin Cart  ← editable
      Strain: Indica            ← editable
      Weight: 1g                ← editable
      THC%: 78.4                ← editable
      Retail price: $___        ← REQUIRED owner input
  → Owner taps "Add to my menu"
  → POST /owner-portal/inventory/items { catalogId, retailPrice, stockLevel: 1 }
  → Done
```

Cost per scan:

- New product: ~$0 (Gemini Flash free tier) or ~$0.005 (Haiku) or ~$0.04 (Sonnet)
- Cached product: $0 (DB lookup only)

### Sub-flow B: receive shipment (two-step)

```
Owner just received a wholesale shipment from their distributor.
Taps "Receive shipment" in the Inventory hub.

STEP 1 — Scan the box
  Camera opens → snap photo of the wholesale case
  POST /owner-portal/inventory/scan-shipment { imageGcsUrl, step: 'box' }
  AI reads from the box label:
    - brand, productLine, variant
    - unitCount (e.g. "Case of 24")
    - lotNumber, batchNumber
    - distributor info
  Owner sees: "24 × Stiiizy Live Resin Cart 1g — confirm count?"

STEP 2 — Scan one unit from the box
  Camera reopens → "Now scan one of the products inside"
  POST /owner-portal/inventory/scan-shipment { imageGcsUrl, step: 'unit',
                                                boxScanId: <prev scan id> }
  AI reads from the unit:
    - confirms it matches the box (or flags mismatch)
    - reads unit-specific data: exact strain, individual UPC, COA QR URL
    - captures clean photo (becomes the menu photo)

CONFIRMED: ownerInventory/{ownerUid}/items/{itemId} created or updated:
  catalogId: <productCatalog ref>
  stockLevel: existing + 24
  retailPrice: <kept from prior or owner sets fresh>
  inventoryAdjustments doc: { delta: +24, reason: 'receive_shipment',
                              sourceImageUrl: <box photo>, appliedAt: now }
```

Edge cases:

- **Multi-product box** ("variety pack"): AI detects, prompts owner to scan each variant individually
- **Generic brown box no labels**: fallback to per-unit scan only — still works, just slower
- **Box / unit mismatch**: AI flags, owner picks correct one

## Phase 1.8 — Receipt-photo reconciliation

### Sub-flow C: end-of-day reconcile

```
End of day. Owner taps "End-of-day reconcile" in the Inventory hub.

  → Camera opens
  → Owner snaps photo of:
      - POS-printed end-of-day summary, OR
      - Screenshot of POS dashboard, OR
      - Stack of customer receipts (multiple photos OK), OR
      - Handwritten tally sheet
  → POST /owner-portal/inventory/reconcile-receipt { imageGcsUrls[], ownerUid }
  → Backend:
      1. Call visionAiInventoryService('reconcile_receipt', imageBase64s)
      2. AI returns array of sale lines:
           [{ rawText: "Stiiizy LR Indica 1g x3 @ $45 = $135",
              parsedQuantity: 3,
              parsedItemDescription: "Stiiizy Live Resin Indica 1g",
              parsedUnitPrice: 45,
              parsedTotal: 135,
              confidence: 'high' }, ...]
      3. For each sale line, fuzzy-match against ownerInventory items:
           - Exact match (catalogId hit) → 'high' confidence
           - Brand + product line match → 'medium'
           - Brand only → 'low'
           - No match → flagged as "couldn't match"
  → Frontend shows a reconcile review:
      ✓ Stiiizy Live Resin Indica 1g       sold 3   match: high
      ✓ Wagmi 100mg Gummies Hybrid          sold 2   match: high
      ⚠ Cresco High Supply pre-roll          sold 5   match: medium [tap to confirm]
      ✗ MFNY Concentrate                     sold 1   no match    [tap to add new]

  → Owner reviews, taps "Apply"
  → For each applied line: ownerInventory item stockLevel decremented,
    inventoryAdjustments doc written { delta: -3, reason: 'reconcile_sale',
                                        sourceImageUrl: <receipt photo> }
  → Auto-flips isInStock = false on items that hit stockLevel <= 0
  → Done — consumer side now sees "Sold out today" badge
```

Cost per reconcile:

- Gemini 1.5 Flash: $0 (under free tier)
- One photo per day per shop = ~30/month per shop
- 100 shops × 30 = 3000 reconciles/month, well under 1500/day free quota

### Confidence-scored matching rubric

| AI confidence                                                   | Auto-action                                          | UI surface                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| **high** (catalogId match or exact brand+product+weight string) | auto-checkbox-checked                                | "✓ matched" badge, collapsed                                |
| **medium** (brand + partial product)                            | auto-checkbox-checked, but **draws owner attention** | "⚠ verify" badge, expanded with the AI's match candidate    |
| **low** (brand only)                                            | unchecked by default                                 | "tap to confirm match" button with dropdown of likely items |
| **none** (no menu item could be found)                          | unchecked, surfaced as "not in your menu yet"        | "Add as new product" button → goes to scan-product flow     |

## Frontend screens (NEW)

| Screen                                  | Purpose                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `OwnerPortalInventoryScreen.tsx`        | Hub. List of menu items + 3 CTAs: Add product, Receive shipment, End-of-day reconcile |
| `OwnerPortalScanProductScreen.tsx`      | Phase 1.7 sub-flow A: single-product scan + edit + add                                |
| `OwnerPortalReceiveShipmentScreen.tsx`  | Phase 1.7 sub-flow B: two-step (box → unit)                                           |
| `OwnerPortalReconcileReceiptScreen.tsx` | Phase 1.8 sub-flow C: photo → review → apply                                          |

All four reuse existing primitives: `ScreenShell`, `SectionCard`, `MotionInView`, the existing `ScanCameraScreen` for camera capture.

## CTAs added to Owner Portal home

Two new banners, alongside the existing "Set up your shop in 60 seconds":

```
✨ Set up your shop in 60 seconds       (existing — Phase 1, AI Shop Bootstrap)
📦 Build your menu by scanning           (NEW — Phase 1.7, Inventory hub)
🧾 Reconcile end-of-day in 30 seconds    (NEW — Phase 1.8, Inventory hub > reconcile)
```

The reconcile CTA only shows after the owner has at least 1 inventory item.

## Cost model (locked in)

Per shop per month at typical usage:

- 50 product scans (mostly cached after month 1) × $0 = **$0**
- 5 shipment receives × 2 photos each = 10 vision calls × $0 = **$0**
- 30 daily reconciles × $0 = **$0**

100 shops × $0 = **$0/month total** at Gemini free tier limits.

If we ever blow the free tier (>50 active shops × all daily flows), worst case we hit Sonnet pricing:

- 50 × 50 product scans/mo at $0.04 = $100
- 50 × 30 reconciles/mo at $0.04 = $60
- **Total: $160/month at 50 shops on full Sonnet quality.** Still trivial.

## Compliance posture (NY OCM)

| Compliance angle         | How this handles it                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trademark on brand names | Owner has the brand legally on their shelf. Displaying brand info matches normal commerce.                                                       |
| Cannabis ad regulations  | Owner controls every menu entry before publish. Same posture as existing AI Shop Bootstrap.                                                      |
| AI hallucination         | AI READS what's printed; owner has approval gate before save.                                                                                    |
| Photo IP                 | Owner's camera, owner's photo, owner's product. Full ownership.                                                                                  |
| METRC accuracy           | Reconcile flow does NOT report to METRC. Owner's actual POS still does the state reporting. We just maintain Canopy Trove's menu state to match. |

## Phase 1.7 + 1.8 implementation effort

| Component                                          | Effort |
| -------------------------------------------------- | ------ |
| Spec doc (this)                                    | done   |
| Types + collections                                | <1 day |
| visionAiInventoryService (Gemini + Sonnet routing) | 2 days |
| productCatalogService                              | 2 days |
| ownerInventoryService                              | 2 days |
| inventoryReconcileService                          | 3 days |
| Backend routes + auth gating                       | 1 day  |
| Frontend hub screen                                | 2 days |
| 3 sub-flow screens                                 | 5 days |
| Wire navigation + CTAs                             | 1 day  |
| Backend tests                                      | 2 days |
| End-to-end testing against real shop               | 2 days |

**Total: ~3 weeks of focused build.** Can be split into 1.7 first (scan-add + shipment) and 1.8 second (reconcile) — Phase 1.7 alone is ~2 weeks, Phase 1.8 ~1 week given shared infrastructure.

## What this commit (May 3 2026) covers

This commit lays the **complete spec + scaffolding**. Every file compiles, types are correct, navigation routes exist, but the actual AI calls + Firestore writes throw `not_implemented`. Tomorrow's work fills those in cleanly, with no architectural decisions left to make.

Same pattern as the AI Shop Bootstrap landed this morning: scaffold first, fill in incrementally.

## What this commit explicitly does NOT cover

- Brand-supplied catalog import (separate side-channel work, partner relationships needed)
- METRC retail item UID lookup (licensee-gated, Phase 4 territory)
- Real-time POS API integrations (deferred — receipt-photo reconciliation handles 90% of the value at <1% of the integration cost)
- Native iOS share sheet integration ("share from POS app to Canopy Trove") — a nice future enhancement
