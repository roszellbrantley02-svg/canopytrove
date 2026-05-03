/**
 * Vision-AI router for AI Inventory flows (Phase 1.7 + 1.8).
 *
 * Routes vision API calls to Gemini 1.5 Flash by default (free tier:
 * 1,500 requests/day) with automatic fallback to Claude Sonnet 4.5
 * when Gemini returns low confidence or the call fails. This keeps
 * marginal cost near zero at our scale while preserving quality on
 * tricky inputs.
 *
 * Spec: docs/AI_INVENTORY.md
 *
 * Phase 1.7 status: SCAFFOLD — function shapes are real, env-var
 * routing decision is wired, but the actual API calls throw
 * `not_implemented` until the next chunk of work fills in the
 * Gemini + Anthropic vision payloads. Tomorrow's work fills these
 * in cleanly without architectural drift.
 */

import type {
  ProductCatalogEntry,
  ScanProductResult,
  BoxScanResult,
  UnitScanResult,
  ReceiptSaleLine,
} from '../types/aiInventory';

export type VisionInventoryTask =
  | 'scan_product'
  | 'scan_shipment_box'
  | 'scan_shipment_unit'
  | 'reconcile_receipt';

export type VisionInventoryInput =
  | { task: 'scan_product'; imageGcsUrl: string }
  | { task: 'scan_shipment_box'; imageGcsUrl: string }
  | {
      task: 'scan_shipment_unit';
      imageGcsUrl: string;
      // Box context for mismatch detection.
      boxBrand: string | null;
      boxProductLine: string | null;
    }
  | {
      task: 'reconcile_receipt';
      imageGcsUrls: string[];
      // Owner's existing menu items so the AI can hint matches inline.
      knownMenuItems: Array<{
        catalogId: string;
        brand: string;
        productName: string;
        weight: string | null;
      }>;
    };

export type VisionInventoryOutput =
  | {
      task: 'scan_product';
      productInfo: PartialCatalogPayload;
      suggestedRetailPriceLow: number | null;
      suggestedRetailPriceHigh: number | null;
    }
  | { task: 'scan_shipment_box'; box: BoxScanResult }
  | { task: 'scan_shipment_unit'; unit: UnitScanResult }
  | { task: 'reconcile_receipt'; saleLines: ReceiptSaleLine[] };

export type VisionInventoryEnvelope =
  | {
      ok: true;
      modelUsed: 'gemini-1.5-flash' | 'claude-haiku-4-5' | 'claude-sonnet-4-5';
      confidence: 'high' | 'medium' | 'low';
      notes: string;
      output: VisionInventoryOutput;
    }
  | {
      ok: false;
      reason:
        | 'image_unreadable'
        | 'not_a_cannabis_product'
        | 'service_unavailable'
        | 'config_missing'
        | 'unknown';
      message: string;
    };

/**
 * Subset of ProductCatalogEntry that the vision AI populates from
 * a product image. The catalog write step adds catalogId, photoUrl,
 * provenance fields, etc.
 */
export type PartialCatalogPayload = Omit<
  ProductCatalogEntry,
  | 'catalogId'
  | 'photoUrl'
  | 'photoSource'
  | 'firstScannedBy'
  | 'firstScannedAt'
  | 'scanCount'
  | 'lastUpdatedAt'
  | 'needsReview'
>;

const DEFAULT_PROVIDER = (process.env.LLM_PROVIDER_INVENTORY ?? 'gemini').toLowerCase();
const FALLBACK_THRESHOLD: 'high' | 'medium' | 'low' = 'low';

/**
 * Public entry point. Picks the model, runs the call, falls back
 * if the primary returns low confidence.
 */
export async function callVisionInventoryAi(
  input: VisionInventoryInput,
): Promise<VisionInventoryEnvelope> {
  // Primary attempt
  const primary = await runWithProvider(DEFAULT_PROVIDER, input);
  if (!primary.ok) return primary;

  // Auto-fallback to Sonnet on low confidence (only if primary wasn't already Sonnet)
  if (primary.confidence === FALLBACK_THRESHOLD && primary.modelUsed !== 'claude-sonnet-4-5') {
    const fallback = await runWithProvider('anthropic', input);
    if (fallback.ok) return fallback;
    // Fallback failed — return the original primary result.
    return primary;
  }

  return primary;
}

async function runWithProvider(
  provider: string,
  input: VisionInventoryInput,
): Promise<VisionInventoryEnvelope> {
  if (provider === 'gemini') {
    return callGeminiFlash(input);
  }
  if (provider === 'anthropic') {
    return callClaudeSonnet(input);
  }
  return {
    ok: false,
    reason: 'config_missing',
    message: `Unknown LLM_PROVIDER_INVENTORY: ${provider}`,
  };
}

/**
 * Gemini 1.5 Flash call. SCAFFOLD — real implementation pending.
 *
 * Plan:
 *   1. Read GEMINI_API_KEY from Secret Manager
 *   2. Download images from Cloud Storage to base64
 *   3. Build per-task prompt + JSON schema
 *   4. POST to https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent
 *   5. Parse the structured output
 *   6. Map onto VisionInventoryEnvelope
 */
async function callGeminiFlash(_input: VisionInventoryInput): Promise<VisionInventoryEnvelope> {
  // TODO(phase-1.7): wire Gemini API call.
  throw new Error(
    'visionAiInventoryService.callGeminiFlash: not implemented yet — see docs/AI_INVENTORY.md',
  );
}

/**
 * Claude Sonnet 4.5 vision call. SCAFFOLD — same shape as the
 * existing aiShopBootstrapVisionParser pattern. Implementation can
 * largely copy that file's request structure with a per-task tool
 * definition swap.
 */
async function callClaudeSonnet(_input: VisionInventoryInput): Promise<VisionInventoryEnvelope> {
  // TODO(phase-1.7): wire Anthropic API call. Pattern same as
  // backend/src/services/aiShopBootstrapVisionParser.ts. Per-task
  // tool definitions live in a separate constant block.
  throw new Error(
    'visionAiInventoryService.callClaudeSonnet: not implemented yet — see docs/AI_INVENTORY.md',
  );
}
