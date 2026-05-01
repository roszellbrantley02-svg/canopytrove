/**
 * Owner Phone Verification routes — Twilio Verify integration.
 *
 *   POST /owner-portal/phone-verification/send
 *   POST /owner-portal/phone-verification/confirm
 *
 * Both require a signed-in owner. Both are rate-limited per-IP and
 * per-user. Send is tighter than confirm because it's the one that
 * costs Twilio money + sends physical SMS to a real phone.
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { getSafeErrorMessage } from '../http/errors';
import {
  PhoneVerificationError,
  confirmPhoneVerificationCode,
  sendPhoneVerificationCode,
} from '../services/phoneVerificationService';

export const phoneVerificationRoutes = Router();

// IP-side: 6 sends per 10 min stops casual abuse from a single network
// without breaking legitimate retry behaviour (most owners enter the
// number wrong once or twice).
const sendIpRateLimiter = createRateLimitMiddleware({
  name: 'phone-verification-send-ip',
  windowMs: 10 * 60_000,
  max: 6,
  methods: ['POST'],
  persistent: true,
});

// User-side: 3 sends per hour per signed-in account. Tight because the
// real fraud vector is a single account spamming codes to harvested phone
// numbers (carrier-level SMS pumping fraud). Twilio Verify also enforces
// its own per-phone limit (5/hour by default), so this is belt + suspenders.
const sendUserRateLimiter = createUserRateLimitMiddleware({
  name: 'phone-verification-send-user',
  windowMs: 60 * 60_000,
  max: 3,
  persistent: true,
});

// Confirm doesn't cost money or SMS, so the limits are looser. The point
// is just to make brute-forcing 6-digit codes infeasible (10^6 = 1M
// guesses; 60 attempts/hr per user keeps that decade-scale).
const confirmIpRateLimiter = createRateLimitMiddleware({
  name: 'phone-verification-confirm-ip',
  windowMs: 10 * 60_000,
  max: 30,
  methods: ['POST'],
  persistent: true,
});

const confirmUserRateLimiter = createUserRateLimitMiddleware({
  name: 'phone-verification-confirm-user',
  windowMs: 60 * 60_000,
  max: 60,
  persistent: true,
});

phoneVerificationRoutes.post(
  '/owner-portal/phone-verification/send',
  sendIpRateLimiter,
  sendUserRateLimiter,
  async (request, response) => {
    try {
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const result = await sendPhoneVerificationCode(request, {
        phone: body.phone,
        channel: body.channel === 'call' ? 'call' : 'sms',
      });
      response.json(result);
    } catch (error) {
      const statusCode = error instanceof PhoneVerificationError ? error.statusCode : 500;
      const code = error instanceof PhoneVerificationError ? error.code : null;
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

phoneVerificationRoutes.post(
  '/owner-portal/phone-verification/confirm',
  confirmIpRateLimiter,
  confirmUserRateLimiter,
  async (request, response) => {
    try {
      const body = (typeof request.body === 'object' && request.body ? request.body : {}) as Record<
        string,
        unknown
      >;
      const result = await confirmPhoneVerificationCode(request, {
        phone: body.phone,
        code: body.code,
      });
      response.json(result);
    } catch (error) {
      const statusCode = error instanceof PhoneVerificationError ? error.statusCode : 500;
      const code = error instanceof PhoneVerificationError ? error.code : null;
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
