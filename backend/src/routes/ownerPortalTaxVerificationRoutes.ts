/**
 * Tax-ID verification endpoint (Phase 2.5).
 *
 *   POST /owner-portal/tax-verification
 *     body: { tpid: string, primaryDispensaryId: string }
 *     → { ok: true, matched: bool, ... } | { ok: false, code, message }
 *
 * Flag-gated server-side by `taxIdVerificationEnabled`. The TPID never
 * appears in the response or logs — only the salted hash is persisted.
 *
 * Tight rate limit: 3 attempts per hour per user, 10 per hour per IP.
 * Brute-forcing valid TPID + entity-name combinations would let an
 * attacker confirm chain identities, so the limit is intentionally low.
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { createOwnerPortalJsonRoute } from './ownerPortalRouteUtils';
import { verifyOwnerTaxId } from '../services/taxIdVerificationService';

export const ownerPortalTaxVerificationRoutes = Router();

const ipLimit = createRateLimitMiddleware({
  name: 'tax-id-verify-ip',
  windowMs: 60 * 60_000,
  max: 10,
  methods: ['POST'],
  persistent: true,
});

const userLimit = createUserRateLimitMiddleware({
  name: 'tax-id-verify-user',
  windowMs: 60 * 60_000,
  max: 3,
  persistent: true,
});

ownerPortalTaxVerificationRoutes.post(
  '/owner-portal/tax-verification',
  ipLimit,
  userLimit,
  createOwnerPortalJsonRoute('Tax-ID verification failed.', async ({ ownerUid, request }) => {
    const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
      string,
      unknown
    >;
    const tpid = typeof body.tpid === 'string' ? body.tpid : '';
    const primaryDispensaryId =
      typeof body.primaryDispensaryId === 'string' ? body.primaryDispensaryId : '';
    return verifyOwnerTaxId({ ownerUid, tpid, primaryDispensaryId });
  }),
);
