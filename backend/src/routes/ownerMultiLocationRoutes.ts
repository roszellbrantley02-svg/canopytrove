import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createOwnerPortalJsonRoute } from './ownerPortalRouteUtils';
import {
  addOwnerLocation,
  getOwnerLocations,
  removeOwnerLocation,
} from '../services/ownerMultiLocationService';

export const ownerMultiLocationRoutes = Router();

ownerMultiLocationRoutes.use(
  '/owner-portal/locations',
  createRateLimitMiddleware({
    name: 'owner-locations',
    windowMs: 60_000,
    max: Math.max(10, Math.floor(serverConfig.writeRateLimitPerMinute / 2)),
    methods: ['GET', 'POST', 'DELETE'],
  }),
);

/**
 * GET /owner-portal/locations
 * Returns all locations managed by this owner (primary + additional).
 */
ownerMultiLocationRoutes.get(
  '/owner-portal/locations',
  createOwnerPortalJsonRoute('Unknown location list failure', async ({ ownerUid }) =>
    getOwnerLocations(ownerUid),
  ),
);

/**
 * POST /owner-portal/locations
 * Add an additional storefront location. Requires Pro tier + approved claim.
 * Body: { storefrontId: string }
 */
ownerMultiLocationRoutes.post(
  '/owner-portal/locations',
  createOwnerPortalJsonRoute('Unknown location add failure', async ({ ownerUid, request }) => {
    const storefrontId = parseStorefrontIdBody(request.body);
    return addOwnerLocation(ownerUid, storefrontId);
  }),
);

/**
 * DELETE /owner-portal/locations/:storefrontId
 * Remove an additional location. Cannot remove primary.
 */
ownerMultiLocationRoutes.delete(
  '/owner-portal/locations/:storefrontId',
  createOwnerPortalJsonRoute('Unknown location remove failure', async ({ ownerUid, request }) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    return removeOwnerLocation(ownerUid, storefrontId);
  }),
);

function parseStorefrontIdBody(body: unknown): string {
  const record = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const storefrontId = typeof record.storefrontId === 'string' ? record.storefrontId.trim() : '';
  if (!storefrontId) {
    throw new Error('storefrontId is required.');
  }
  return storefrontId;
}

function parseStorefrontIdParam(value: unknown): string {
  const storefrontId = typeof value === 'string' ? value.trim() : '';
  if (!storefrontId) {
    throw new Error('storefrontId parameter is required.');
  }
  return storefrontId;
}
