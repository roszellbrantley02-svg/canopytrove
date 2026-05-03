/**
 * Owner Portal: AI Inventory routes (Phase 1.7 + 1.8).
 *
 * Spec: docs/AI_INVENTORY.md
 *
 * Endpoints:
 *   POST   /owner-portal/inventory/scan-product
 *   POST   /owner-portal/inventory/scan-shipment
 *   POST   /owner-portal/inventory/reconcile-receipt
 *   GET    /owner-portal/inventory/reconcile-receipt/:draftId
 *   PATCH  /owner-portal/inventory/reconcile-receipt/:draftId
 *   POST   /owner-portal/inventory/reconcile-receipt/:draftId/apply
 *   POST   /owner-portal/inventory/items/:itemId/adjust
 *   GET    /owner-portal/inventory/items
 *   GET    /owner-portal/inventory/adjustments
 *
 * All endpoints require an owner-authenticated bearer token. Owner
 * scoping is enforced at the service layer.
 *
 * Phase 1.7 status: SCAFFOLD — routes are wired, owner-auth gating
 * is enforced, but the service-layer calls throw `not_implemented`
 * until the AI integrations land tomorrow. The route shapes will
 * not change.
 */

import { Request, Router } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { serverConfig } from '../config';
import { callVisionInventoryAi } from '../services/visionAiInventoryService';
import { upsertCatalogEntry, lookupCatalogEntry } from '../services/inventoryProductCatalogService';
import {
  addOwnerInventoryItem,
  adjustOwnerInventoryItem,
  listOwnerInventoryItems,
  listInventoryAdjustments,
  setOwnerInventoryItemAvailability,
} from '../services/ownerInventoryService';
import {
  startReconcileDraft,
  getReconcileDraft,
  updateReconcileDraftLines,
  applyReconcileDraft,
} from '../services/inventoryReconcileService';

export const aiInventoryRoutes = Router();

// Rate limit: writes get the standard write-rate cap. Camera-scan
// operations are owner-driven (one per few-second tap) so the global
// per-minute cap is fine.
aiInventoryRoutes.use(
  createRateLimitMiddleware({
    name: 'ai-inventory-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PATCH'],
  }),
);

function getBearerToken(authorizationHeader: string | undefined) {
  const trimmedHeader = authorizationHeader?.trim();
  if (!trimmedHeader) return null;
  const [scheme, token] = trimmedHeader.split(/\s+/, 2);
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

class InventoryAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

async function resolveOwnerUid(request: Request): Promise<string> {
  // Test bypass — same pattern as aiShopBootstrapRoutes.
  if (process.env.NODE_ENV === 'test' && !process.env.K_SERVICE) {
    const testOwnerUid = request.header('x-canopy-test-account-id')?.trim();
    if (testOwnerUid) return testOwnerUid;
  }

  const token = getBearerToken(request.header('authorization'));
  if (!token) throw new InventoryAccessError('Owner authentication required.', 401);
  if (!hasBackendFirebaseConfig) {
    throw new InventoryAccessError('Owner auth not configured.', 503);
  }
  const auth = getBackendFirebaseAuth();
  if (!auth) throw new InventoryAccessError('Owner auth not configured.', 503);
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new InventoryAccessError('Invalid owner authentication token.', 401);
  }
  return decoded.uid;
}

// ---- Phase 1.7: scan-product ---------------------------------------

aiInventoryRoutes.post('/owner-portal/inventory/scan-product', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const imageGcsUrl =
      typeof request.body?.imageGcsUrl === 'string' ? request.body.imageGcsUrl.trim() : '';
    if (!imageGcsUrl) {
      response.status(400).json({ ok: false, error: 'imageGcsUrl is required' });
      return;
    }
    const retailPrice =
      typeof request.body?.retailPrice === 'number' ? request.body.retailPrice : null;

    // Phase 1.7 step 1: AI reads the package label.
    const visionResult = await callVisionInventoryAi({
      task: 'scan_product',
      imageGcsUrl,
    });
    if (!visionResult.ok) {
      response
        .status(422)
        .json({ ok: false, error: visionResult.reason, message: visionResult.message });
      return;
    }
    if (visionResult.output.task !== 'scan_product') {
      response.status(500).json({ ok: false, error: 'vision_task_mismatch' });
      return;
    }

    // Phase 1.7 step 2: catalog upsert (deduped by signals).
    const catalogResult = await upsertCatalogEntry(ownerUid, visionResult.output.productInfo);
    if (!catalogResult.ok) {
      response
        .status(500)
        .json({ ok: false, error: catalogResult.reason, message: catalogResult.message });
      return;
    }

    // Phase 1.7 step 3: add to owner's menu (only if retailPrice supplied).
    let item = null;
    if (retailPrice !== null) {
      const addResult = await addOwnerInventoryItem({
        ownerUid,
        catalogId: catalogResult.entry.catalogId,
        retailPrice,
        initialStockLevel: 1,
        reason: 'scan_add',
        sourceImageUrl: imageGcsUrl,
      });
      if (!addResult.ok) {
        response
          .status(500)
          .json({ ok: false, error: addResult.reason, message: addResult.message });
        return;
      }
      item = addResult.item;
    }

    response.json({
      ok: true,
      catalogEntry: catalogResult.entry,
      isNewCatalogEntry: catalogResult.isNew,
      modelUsed: visionResult.modelUsed,
      extractionConfidence: visionResult.confidence,
      extractionNotes: visionResult.notes,
      suggestedRetailPriceLow: visionResult.output.suggestedRetailPriceLow,
      suggestedRetailPriceHigh: visionResult.output.suggestedRetailPriceHigh,
      item,
    });
  } catch (error) {
    handleError(response, error);
  }
});

// ---- Phase 1.7: scan-shipment (two-step) ---------------------------

aiInventoryRoutes.post('/owner-portal/inventory/scan-shipment', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const imageGcsUrl =
      typeof request.body?.imageGcsUrl === 'string' ? request.body.imageGcsUrl.trim() : '';
    const step = request.body?.step;
    if (!imageGcsUrl) {
      response.status(400).json({ ok: false, error: 'imageGcsUrl is required' });
      return;
    }
    if (step !== 'box' && step !== 'unit') {
      response.status(400).json({ ok: false, error: 'step must be "box" or "unit"' });
      return;
    }

    if (step === 'box') {
      const visionResult = await callVisionInventoryAi({
        task: 'scan_shipment_box',
        imageGcsUrl,
      });
      if (!visionResult.ok) {
        response
          .status(422)
          .json({ ok: false, error: visionResult.reason, message: visionResult.message });
        return;
      }
      if (visionResult.output.task !== 'scan_shipment_box') {
        response.status(500).json({ ok: false, error: 'vision_task_mismatch' });
        return;
      }
      response.json({
        ok: true,
        step: 'box',
        box: visionResult.output.box,
        modelUsed: visionResult.modelUsed,
        extractionConfidence: visionResult.confidence,
      });
      return;
    }

    // step === 'unit'
    const boxBrand = typeof request.body?.boxBrand === 'string' ? request.body.boxBrand : null;
    const boxProductLine =
      typeof request.body?.boxProductLine === 'string' ? request.body.boxProductLine : null;
    const visionResult = await callVisionInventoryAi({
      task: 'scan_shipment_unit',
      imageGcsUrl,
      boxBrand,
      boxProductLine,
    });
    if (!visionResult.ok) {
      response
        .status(422)
        .json({ ok: false, error: visionResult.reason, message: visionResult.message });
      return;
    }
    if (visionResult.output.task !== 'scan_shipment_unit') {
      response.status(500).json({ ok: false, error: 'vision_task_mismatch' });
      return;
    }

    // Cache the catalog entry surfaced by the unit scan; the route
    // returns it so the frontend can confirm with the owner before
    // committing to inventory in a second call.
    void lookupCatalogEntry; // Imported for the next chunk's lookup-then-merge.
    response.json({
      ok: true,
      step: 'unit',
      unit: visionResult.output.unit,
      modelUsed: visionResult.modelUsed,
      extractionConfidence: visionResult.confidence,
    });
  } catch (error) {
    handleError(response, error);
  }
});

// ---- Phase 1.8: reconcile-receipt -----------------------------------

aiInventoryRoutes.post('/owner-portal/inventory/reconcile-receipt', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const imageGcsUrls = Array.isArray(request.body?.imageGcsUrls)
      ? (request.body.imageGcsUrls as unknown[]).filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    if (imageGcsUrls.length === 0) {
      response.status(400).json({ ok: false, error: 'imageGcsUrls (non-empty array) is required' });
      return;
    }
    const result = await startReconcileDraft({ ownerUid, imageGcsUrls });
    if (!result.ok) {
      response.status(500).json({ ok: false, error: result.reason, message: result.message });
      return;
    }
    response.json({ ok: true, draft: result.draft });
  } catch (error) {
    handleError(response, error);
  }
});

aiInventoryRoutes.get(
  '/owner-portal/inventory/reconcile-receipt/:draftId',
  async (request, response) => {
    try {
      const ownerUid = await resolveOwnerUid(request);
      const result = await getReconcileDraft(ownerUid, request.params.draftId);
      if (!result.ok) {
        response.status(result.reason === 'not_found' ? 404 : 500).json({
          ok: false,
          error: result.reason,
          message: result.message,
        });
        return;
      }
      response.json({ ok: true, draft: result.draft });
    } catch (error) {
      handleError(response, error);
    }
  },
);

aiInventoryRoutes.patch(
  '/owner-portal/inventory/reconcile-receipt/:draftId',
  async (request, response) => {
    try {
      const ownerUid = await resolveOwnerUid(request);
      const saleLines = Array.isArray(request.body?.saleLines) ? request.body.saleLines : null;
      if (!saleLines) {
        response.status(400).json({ ok: false, error: 'saleLines array required' });
        return;
      }
      const result = await updateReconcileDraftLines({
        ownerUid,
        draftId: request.params.draftId,
        saleLines,
      });
      if (!result.ok) {
        response.status(result.reason === 'not_found' ? 404 : 500).json({
          ok: false,
          error: result.reason,
          message: result.message,
        });
        return;
      }
      response.json({ ok: true, draft: result.draft });
    } catch (error) {
      handleError(response, error);
    }
  },
);

aiInventoryRoutes.post(
  '/owner-portal/inventory/reconcile-receipt/:draftId/apply',
  async (request, response) => {
    try {
      const ownerUid = await resolveOwnerUid(request);
      const result = await applyReconcileDraft({
        ownerUid,
        draftId: request.params.draftId,
      });
      if (!result.ok) {
        response.status(result.reason === 'not_found' ? 404 : 500).json({
          ok: false,
          error: result.reason,
          message: result.message,
        });
        return;
      }
      response.json({ ok: true, draft: result.draft });
    } catch (error) {
      handleError(response, error);
    }
  },
);

// ---- Owner-side menu management ------------------------------------

aiInventoryRoutes.post(
  '/owner-portal/inventory/items/:itemId/adjust',
  async (request, response) => {
    try {
      const ownerUid = await resolveOwnerUid(request);
      const delta = typeof request.body?.delta === 'number' ? request.body.delta : NaN;
      const reason = request.body?.reason;
      if (!Number.isFinite(delta)) {
        response.status(400).json({ ok: false, error: 'delta (number) required' });
        return;
      }
      if (reason !== 'manual_edit' && reason !== 'mark_sold_out' && reason !== 'mark_in_stock') {
        response
          .status(400)
          .json({ ok: false, error: 'reason must be manual_edit | mark_sold_out | mark_in_stock' });
        return;
      }

      // Toggle path: mark_sold_out / mark_in_stock just flip availability.
      if (reason === 'mark_sold_out' || reason === 'mark_in_stock') {
        const result = await setOwnerInventoryItemAvailability({
          ownerUid,
          itemId: request.params.itemId,
          isInStock: reason === 'mark_in_stock',
        });
        if (!result.ok) {
          response.status(result.reason === 'not_found' ? 404 : 500).json({
            ok: false,
            error: result.reason,
            message: result.message,
          });
          return;
        }
        response.json({ ok: true, item: result.item, adjustment: result.adjustment });
        return;
      }

      const result = await adjustOwnerInventoryItem({
        ownerUid,
        itemId: request.params.itemId,
        delta,
        reason: 'manual_edit',
        sourceImageUrl: null,
      });
      if (!result.ok) {
        response.status(result.reason === 'not_found' ? 404 : 500).json({
          ok: false,
          error: result.reason,
          message: result.message,
        });
        return;
      }
      response.json({ ok: true, item: result.item, adjustment: result.adjustment });
    } catch (error) {
      handleError(response, error);
    }
  },
);

aiInventoryRoutes.get('/owner-portal/inventory/items', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const result = await listOwnerInventoryItems(ownerUid);
    if (!result.ok) {
      response.status(500).json({ ok: false, error: result.reason, message: result.message });
      return;
    }
    response.json({ ok: true, items: result.items });
  } catch (error) {
    handleError(response, error);
  }
});

aiInventoryRoutes.get('/owner-portal/inventory/adjustments', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const itemId = typeof request.query?.itemId === 'string' ? request.query.itemId : undefined;
    const limitRaw = request.query?.limit;
    const limit =
      typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw))
        ? Math.min(Math.max(Number(limitRaw), 1), 200)
        : undefined;
    const result = await listInventoryAdjustments({ ownerUid, itemId, limit });
    if (!result.ok) {
      response.status(500).json({ ok: false, error: result.reason, message: result.message });
      return;
    }
    response.json({ ok: true, adjustments: result.adjustments });
  } catch (error) {
    handleError(response, error);
  }
});

function handleError(response: import('express').Response, error: unknown) {
  if (error instanceof InventoryAccessError) {
    response.status(error.statusCode).json({ ok: false, error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  response.status(500).json({ ok: false, error: message });
}
