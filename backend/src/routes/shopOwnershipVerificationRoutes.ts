/**
 * Shop Ownership Verification routes — second-layer anti-hijack defense.
 *
 *   POST /owner-portal/shop-ownership-verification/send
 *   POST /owner-portal/shop-ownership-verification/confirm
 *
 * Both require a signed-in owner with an existing claim for the supplied
 * storefrontId. The send endpoint dispatches a Twilio Verify SMS to the
 * SHOP'S published phone number (from Google Places); the confirm endpoint
 * marks the claim as shopOwnershipVerified on success — which the admin
 * approval gate requires before approving the claim.
 *
 * Rate limits are tighter than the personal phone verification routes
 * because each send blasts an SMS to a real shop phone (deterring
 * harassment of legit dispensary lines). Twilio Verify also enforces
 * its own per-phone limit (5/hr default).
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { getSafeErrorMessage } from '../http/errors';
import {
  ShopOwnershipVerificationError,
  confirmShopOwnershipVerificationCode,
  sendShopOwnershipVerificationCode,
} from '../services/shopOwnershipVerificationService';

export const shopOwnershipVerificationRoutes = Router();

// Tight IP limit — each send hits a real shop's phone. Don't let a single
// network harass dispensary lines with spam.
const sendIpRateLimiter = createRateLimitMiddleware({
  name: 'shop-ownership-verify-send-ip',
  windowMs: 10 * 60_000,
  max: 4,
  methods: ['POST'],
  persistent: true,
});

// Per-user: 2 sends per hour. Owner should be able to retry a couple
// times if their first send fails delivery, but no more.
const sendUserRateLimiter = createUserRateLimitMiddleware({
  name: 'shop-ownership-verify-send-user',
  windowMs: 60 * 60_000,
  max: 2,
  persistent: true,
});

const confirmIpRateLimiter = createRateLimitMiddleware({
  name: 'shop-ownership-verify-confirm-ip',
  windowMs: 10 * 60_000,
  max: 30,
  methods: ['POST'],
  persistent: true,
});

const confirmUserRateLimiter = createUserRateLimitMiddleware({
  name: 'shop-ownership-verify-confirm-user',
  windowMs: 60 * 60_000,
  max: 30,
  persistent: true,
});

shopOwnershipVerificationRoutes.post(
  '/owner-portal/shop-ownership-verification/send',
  sendIpRateLimiter,
  sendUserRateLimiter,
  async (request, response) => {
    try {
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const result = await sendShopOwnershipVerificationCode(request, {
        storefrontId: body.storefrontId,
      });
      response.json(result);
    } catch (error) {
      const statusCode = error instanceof ShopOwnershipVerificationError ? error.statusCode : 500;
      const code = error instanceof ShopOwnershipVerificationError ? error.code : null;
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

shopOwnershipVerificationRoutes.post(
  '/owner-portal/shop-ownership-verification/confirm',
  confirmIpRateLimiter,
  confirmUserRateLimiter,
  async (request, response) => {
    try {
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const result = await confirmShopOwnershipVerificationCode(request, {
        storefrontId: body.storefrontId,
        code: body.code,
      });
      response.json(result);
    } catch (error) {
      const statusCode = error instanceof ShopOwnershipVerificationError ? error.statusCode : 500;
      const code = error instanceof ShopOwnershipVerificationError ? error.code : null;
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
