/**
 * Bulk-claim HTTP endpoints for the multi-location feature (Phase 2 PR-D).
 *
 *   POST /owner-portal/claims/bulk          — submit N sibling claims
 *   GET  /owner-portal/claims/bulk/:batchId — poll batch status
 *   GET  /owner-portal/claims/siblings/:dispensaryId — discover sibling locations
 *
 * All three routes require owner-portal auth via the standard
 * `createOwnerPortalJsonRoute` helper. They're flag-gated by
 * `serverConfig.bulkClaimEnabled` — when off, the service-layer functions
 * return early so endpoints respond with `feature_disabled` / 404.
 *
 * Rate limits are tight on the POST endpoint because each submission can
 * create up to 6 claim docs and trigger up to 6 Twilio voice calls (when
 * frontend then fires the OTPs from Phase 1's bulk queue).
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { createOwnerPortalJsonRoute } from './ownerPortalRouteUtils';
import {
  getBulkClaimBatchStatus,
  getSiblingsForOwnerStorefront,
  submitBulkClaim,
} from '../services/bulkClaimService';

export const ownerPortalBulkClaimRoutes = Router();

// Per-IP: 8 bulk submissions per hour. Each can be up to 6 claims, so the
// theoretical worst case is 48 claim docs / hour / IP — enough headroom for
// chain operators legitimately onboarding several entities, tight enough
// to limit fraud-burst impact.
const bulkClaimIpRateLimiter = createRateLimitMiddleware({
  name: 'bulk-claim-ip',
  windowMs: 60 * 60_000,
  max: 8,
  methods: ['POST'],
  persistent: true,
});

// Per-user: 3 bulk submissions per hour. A legitimate chain owner won't
// need more — each batch lets them claim 6 shops at once.
const bulkClaimUserRateLimiter = createUserRateLimitMiddleware({
  name: 'bulk-claim-user',
  windowMs: 60 * 60_000,
  max: 3,
  persistent: true,
});

ownerPortalBulkClaimRoutes.post(
  '/owner-portal/claims/bulk',
  bulkClaimIpRateLimiter,
  bulkClaimUserRateLimiter,
  createOwnerPortalJsonRoute('Bulk claim submission failed.', async ({ ownerUid, request }) => {
    const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
      string,
      unknown
    >;
    const primaryDispensaryId =
      typeof body.primaryDispensaryId === 'string' ? body.primaryDispensaryId : '';
    const siblingDispensaryIds = Array.isArray(body.siblingDispensaryIds)
      ? (body.siblingDispensaryIds as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    const result = await submitBulkClaim({
      ownerUid,
      primaryDispensaryId,
      siblingDispensaryIds,
    });
    return result;
  }),
);

ownerPortalBulkClaimRoutes.get(
  '/owner-portal/claims/bulk/:batchId',
  createOwnerPortalJsonRoute('Bulk claim status lookup failed.', async ({ ownerUid, request }) => {
    const batchId = typeof request.params.batchId === 'string' ? request.params.batchId : '';
    if (!batchId) {
      return { ok: false as const, code: 'invalid_input', message: 'batchId is required.' };
    }
    const status = await getBulkClaimBatchStatus({ ownerUid, batchId });
    if (!status) {
      return { ok: false as const, code: 'not_found', message: 'Batch not found.' };
    }
    return status;
  }),
);

ownerPortalBulkClaimRoutes.get(
  '/owner-portal/claims/siblings/:dispensaryId',
  createOwnerPortalJsonRoute('Sibling discovery failed.', async ({ ownerUid, request }) => {
    const dispensaryId =
      typeof request.params.dispensaryId === 'string' ? request.params.dispensaryId : '';
    if (!dispensaryId) {
      return { ok: false as const, code: 'invalid_input', message: 'dispensaryId is required.' };
    }
    const result = await getSiblingsForOwnerStorefront({ ownerUid, dispensaryId });
    if (!result) {
      return {
        ok: false as const,
        code: 'feature_disabled',
        message: 'Bulk claim is not enabled.',
      };
    }
    return {
      ok: true as const,
      primaryDispensaryId: result.primaryDispensaryId,
      primaryLicenseeName: result.primaryLicenseeName,
      siblings: result.siblings.map((sibling) => ({
        licenseNumber: sibling.ocmRecord.license_number,
        licenseeName: sibling.ocmRecord.licensee_name,
        dbaName: sibling.ocmRecord.dba_name ?? null,
        address: sibling.ocmRecord.address ?? null,
        city: sibling.ocmRecord.city ?? null,
        state: sibling.ocmRecord.state ?? null,
        zip: sibling.ocmRecord.zip_code ?? null,
        active: sibling.active,
        dispensaryId: sibling.dispensaryId,
      })),
      reason: result.reason,
    };
  }),
);
