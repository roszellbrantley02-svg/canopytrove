import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createRecentAuthGuard } from '../http/recentAuthGuard';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { withGenericResponse, withUniformTiming, GENERIC_AUTH_MESSAGES } from '../http/enumGuard';
import { RequestValidationError } from '../http/errors';
import { initiateEmailChange, confirmEmailChange } from '../services/emailChangeService';

/**
 * Account Security Routes
 *
 * Endpoints for sensitive account operations that require
 * re-authentication and produce security notifications:
 *
 * POST /account/email-change          — Initiate email change (re-auth required)
 * POST /account/email-change/confirm  — Confirm email change via token
 */

export const accountSecurityRoutes = Router();

// Tight rate limits — these are sensitive, low-frequency operations
const emailChangeRateLimiter = createRateLimitMiddleware({
  name: 'email-change',
  windowMs: 600_000, // 10 minutes
  max: 3,
  methods: ['POST'],
  persistent: true,
});

const emailChangeUserRateLimiter = createUserRateLimitMiddleware({
  name: 'email-change',
  windowMs: 600_000, // 10 minutes
  max: 3,
  persistent: true,
});

const emailChangeRecentAuth = createRecentAuthGuard({
  operationLabel: 'email change',
  maxAuthAgeSeconds: 300, // 5 minutes
});

function parseEmailChangeBody(body: unknown) {
  if (typeof body !== 'object' || !body || Array.isArray(body)) {
    throw new RequestValidationError('Request body must be an object.');
  }

  const record = body as Record<string, unknown>;
  const newEmail = typeof record.newEmail === 'string' ? record.newEmail.trim() : '';
  if (!newEmail || !newEmail.includes('@') || newEmail.length > 254) {
    throw new RequestValidationError('A valid email address is required.');
  }

  const confirmUrl =
    typeof record.confirmUrl === 'string' ? record.confirmUrl.trim() || null : null;

  return { newEmail, confirmUrl };
}

function parseConfirmBody(body: unknown) {
  if (typeof body !== 'object' || !body || Array.isArray(body)) {
    throw new RequestValidationError('Request body must be an object.');
  }

  const record = body as Record<string, unknown>;
  const token = typeof record.token === 'string' ? record.token.trim() : '';
  if (!token) {
    throw new RequestValidationError('Confirmation token is required.');
  }

  return { token };
}

// Initiate email change — requires recent re-authentication
accountSecurityRoutes.post(
  '/account/email-change',
  emailChangeRateLimiter,
  emailChangeRecentAuth,
  emailChangeUserRateLimiter,
  async (request, response) => {
    try {
      const { newEmail, confirmUrl } = parseEmailChangeBody(request.body);
      const uid = (request as typeof request & { verifiedUid?: string }).verifiedUid;
      if (!uid) {
        response.status(401).json({ ok: false, error: 'Authentication required.' });
        return;
      }

      const result = await initiateEmailChange(uid, newEmail, {
        ip: request.ip || 'unknown',
        confirmUrl: confirmUrl ?? undefined,
      });

      response.json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        response.status(400).json({ ok: false, error: error.message });
        return;
      }
      response.status(500).json({ ok: false, error: 'Unable to process email change request.' });
    }
  },
);

// Confirm email change — public endpoint with token validation
// Uses uniform timing to prevent token-existence enumeration
accountSecurityRoutes.post(
  '/account/email-change/confirm',
  emailChangeRateLimiter,
  async (request, response) => {
    try {
      const { token } = parseConfirmBody(request.body);

      const result = await withUniformTiming(
        () => confirmEmailChange(token, { ip: request.ip || 'unknown' }),
        { minResponseTimeMs: 300, maxJitterMs: 200 },
      );

      response.json(result);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        response.status(400).json({ ok: false, error: error.message });
        return;
      }
      response.status(500).json({ ok: false, error: 'Unable to confirm email change.' });
    }
  },
);
