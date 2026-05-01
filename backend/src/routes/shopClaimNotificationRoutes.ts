/**
 * Shop Claim Notification route — out-of-band alert to the legitimate
 * operator when an ownership claim is filed.
 *
 *   POST /owner-portal/claims/notify-shop
 *     Body: { storefrontId }
 *
 * Frontend calls this immediately after submitting a claim. The endpoint
 * is idempotent (won't double-call the same shop for the same claim) and
 * fail-soft (failures are logged + persisted but don't block the claim).
 *
 * Tight rate limits because each call dials a real shop's published
 * phone — we never want this to become an SMS-bombing vector for the
 * shop's line.
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { getSafeErrorMessage } from '../http/errors';
import {
  ShopClaimNotificationError,
  notifyShopOfPendingClaim,
} from '../services/shopClaimNotificationService';

export const shopClaimNotificationRoutes = Router();

// Tight per-IP limit: each call costs Twilio money + dials a real shop.
const notifyIpRateLimiter = createRateLimitMiddleware({
  name: 'shop-claim-notify-ip',
  windowMs: 60 * 60_000,
  max: 8,
  methods: ['POST'],
  persistent: true,
});

// Per-user: 3 unique notification calls per hour. The endpoint is
// idempotent per claim, so this only matters if the owner is filing
// multiple claims rapidly.
const notifyUserRateLimiter = createUserRateLimitMiddleware({
  name: 'shop-claim-notify-user',
  windowMs: 60 * 60_000,
  max: 3,
  persistent: true,
});

shopClaimNotificationRoutes.post(
  '/owner-portal/claims/notify-shop',
  notifyIpRateLimiter,
  notifyUserRateLimiter,
  async (request, response) => {
    try {
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const result = await notifyShopOfPendingClaim(request, {
        storefrontId: body.storefrontId,
      });
      response.json(result);
    } catch (error) {
      const statusCode = error instanceof ShopClaimNotificationError ? error.statusCode : 500;
      const code = error instanceof ShopClaimNotificationError ? error.code : null;
      const requestId = response.getHeader('X-CanopyTrove-Request-Id');
      response.status(statusCode).json({
        ok: false,
        code,
        error: getSafeErrorMessage(
          error,
          statusCode,
          typeof requestId === 'string' ? requestId : null,
        ),
      });
    }
  },
);
