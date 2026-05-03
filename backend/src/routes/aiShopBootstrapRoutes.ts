/**
 * Owner Portal: AI Shop Bootstrap routes.
 *
 * Spec: docs/AI_SHOP_BOOTSTRAP.md
 *
 * Endpoints:
 *   POST   /owner-portal/shop-bootstrap/start
 *   GET    /owner-portal/shop-bootstrap/:draftId
 *   PATCH  /owner-portal/shop-bootstrap/:draftId
 *   POST   /owner-portal/shop-bootstrap/:draftId/publish
 *
 * All endpoints require an owner-authenticated bearer token. The PATCH
 * + publish endpoints additionally enforce that the draft's ownerUid
 * matches the authenticated user (handled inside the service layer).
 */

import { Request, Router } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { serverConfig } from '../config';
import {
  applyOwnerEdits,
  getDraft,
  publishDraft,
  startShopBootstrap,
} from '../services/aiShopBootstrapService';

export const aiShopBootstrapRoutes = Router();

// Rate limit: writes get the standard write-rate cap; one bootstrap per
// shop per 24h is enforced inside the service via dedup-by-website-URL
// (TODO phase 1) — middleware here just protects against abuse.
aiShopBootstrapRoutes.use(
  createRateLimitMiddleware({
    name: 'shop-bootstrap-write',
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

class ShopBootstrapAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

async function resolveOwnerUid(request: Request): Promise<string> {
  // Test bypass — same pattern as ownerWelcomeEmailRoutes.
  if (process.env.NODE_ENV === 'test' && !process.env.K_SERVICE) {
    const testOwnerUid = request.header('x-canopy-test-account-id')?.trim();
    if (testOwnerUid) return testOwnerUid;
  }

  const token = getBearerToken(request.header('authorization'));
  if (!token) throw new ShopBootstrapAccessError('Owner authentication required.', 401);
  if (!hasBackendFirebaseConfig) {
    throw new ShopBootstrapAccessError('Owner auth not configured.', 503);
  }
  const auth = getBackendFirebaseAuth();
  if (!auth) throw new ShopBootstrapAccessError('Owner auth not configured.', 503);
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new ShopBootstrapAccessError('Invalid owner authentication token.', 401);
  }
  return decoded.uid;
}

aiShopBootstrapRoutes.post('/owner-portal/shop-bootstrap/start', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const websiteUrl =
      typeof request.body?.websiteUrl === 'string' ? request.body.websiteUrl.trim() : '';
    if (!websiteUrl) {
      response.status(400).json({ ok: false, error: 'websiteUrl is required' });
      return;
    }
    const claimedStorefrontId =
      typeof request.body?.claimedStorefrontId === 'string'
        ? request.body.claimedStorefrontId.trim() || undefined
        : undefined;
    const draft = await startShopBootstrap({ ownerUid, websiteUrl, claimedStorefrontId });
    response.json({ ok: true, draft });
  } catch (error) {
    handleError(response, error);
  }
});

aiShopBootstrapRoutes.get('/owner-portal/shop-bootstrap/:draftId', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const draft = await getDraft(request.params.draftId, ownerUid);
    if (!draft) {
      response.status(404).json({ ok: false, error: 'Draft not found.' });
      return;
    }
    response.json({ ok: true, draft });
  } catch (error) {
    handleError(response, error);
  }
});

aiShopBootstrapRoutes.patch('/owner-portal/shop-bootstrap/:draftId', async (request, response) => {
  try {
    const ownerUid = await resolveOwnerUid(request);
    const ownerEdits = request.body?.ownerEdits;
    if (!ownerEdits || typeof ownerEdits !== 'object') {
      response.status(400).json({ ok: false, error: 'ownerEdits payload required.' });
      return;
    }
    const draft = await applyOwnerEdits({
      draftId: request.params.draftId,
      ownerUid,
      ownerEdits,
    });
    if (!draft) {
      response.status(404).json({ ok: false, error: 'Draft not found.' });
      return;
    }
    response.json({ ok: true, draft });
  } catch (error) {
    handleError(response, error);
  }
});

aiShopBootstrapRoutes.post(
  '/owner-portal/shop-bootstrap/:draftId/publish',
  async (request, response) => {
    try {
      const ownerUid = await resolveOwnerUid(request);
      const result = await publishDraft({
        draftId: request.params.draftId,
        ownerUid,
      });
      if (!result.ok) {
        response.status(409).json({ ok: false, error: result.reason });
        return;
      }
      response.json({ ok: true, storefrontId: result.storefrontId });
    } catch (error) {
      handleError(response, error);
    }
  },
);

function handleError(response: import('express').Response, error: unknown) {
  if (error instanceof ShopBootstrapAccessError) {
    response.status(error.statusCode).json({ ok: false, error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  response.status(500).json({ ok: false, error: message });
}
