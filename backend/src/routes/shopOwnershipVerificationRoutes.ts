/**
 * Shop Ownership Verification routes — merged voice OTP + alert call.
 *
 *   POST /owner-portal/shop-ownership-verification/send
 *   POST /owner-portal/shop-ownership-verification/confirm
 *
 * Both require a signed-in owner with an existing claim for the supplied
 * storefrontId. The send endpoint places a Twilio Voice TTS call to the
 * SHOP'S published phone number that delivers a 6-digit verification
 * code AND alerts the legitimate operator that a claim was filed. The
 * confirm endpoint marks the claim as shopOwnershipVerified on success.
 *
 * Rate-limit philosophy:
 * - The service layer enforces the real anti-abuse cooldowns:
 *     * 30 min between calls per claim
 *     * 3 calls per claim per 24h
 * - The route-level rate limiters here are pure DDoS protection (e.g.
 *   prevent a botnet from hammering the endpoint) and are intentionally
 *   loose so they don't fire BEFORE the service-level cooldown does.
 *
 * On rate-limit errors (cooldown_active, daily_limit_reached) the
 * response includes `cooldownEndsAt` so the frontend can show a live
 * countdown without polling.
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { getSafeErrorMessage } from '../http/errors';
import {
  ShopOwnershipVerificationError,
  confirmShopOwnershipVerificationCode,
  sendShopOwnershipVerificationCall,
} from '../services/shopOwnershipVerificationService';

export const shopOwnershipVerificationRoutes = Router();

// IP rate limit — pure DDoS protection. The real anti-abuse cooldown
// (30 min between calls, 3 per 24h per claim) lives in the service.
const sendIpRateLimiter = createRateLimitMiddleware({
  name: 'shop-ownership-verify-send-ip',
  windowMs: 10 * 60_000,
  max: 20,
  methods: ['POST'],
  persistent: true,
});

// Per-user: 10/hr at the route level. Service caps to 3/24h per claim,
// so this only fires if a single owner is hammering across multiple claims.
const sendUserRateLimiter = createUserRateLimitMiddleware({
  name: 'shop-ownership-verify-send-user',
  windowMs: 60 * 60_000,
  max: 10,
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
      const result = await sendShopOwnershipVerificationCall(request, {
        storefrontId: body.storefrontId,
      });
      response.json(result);
    } catch (error) {
      const statusCode = error instanceof ShopOwnershipVerificationError ? error.statusCode : 500;
      const code = error instanceof ShopOwnershipVerificationError ? error.code : null;
      const cooldownEndsAt =
        error instanceof ShopOwnershipVerificationError ? error.cooldownEndsAt : null;
      const requestId = response.getHeader('X-CanopyTrove-Request-Id');
      response.status(statusCode).json({
        ok: false,
        code,
        cooldownEndsAt,
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
