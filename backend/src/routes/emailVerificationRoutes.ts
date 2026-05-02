/**
 * Public route: POST /auth/send-verification-email
 *
 * Triggered by the frontend right after a successful signup, OR by a
 * "resend verification" button later. Authenticates via the verified
 * Firebase ID token on the request, then asks the
 * emailVerificationService to generate a Firebase-Auth-issued
 * verification link and send it via Resend with a Canopy-Trove-
 * branded template.
 *
 * Rate limited per accountId at the route layer (1 per minute) to
 * stop abuse / accidental double-taps. Idempotency is also enforced
 * at the Resend layer via a key keyed on accountId + minute.
 */
import { Router, type Request, type Response } from 'express';
import { logger } from '../observability/logger';
import { sendBrandedVerificationEmail } from '../services/emailVerificationService';
import { resolveVerifiedRequestAccountId } from '../services/profileAccessService';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';

export const emailVerificationRoutes = Router();

const verificationSendRateLimiter = createUserRateLimitMiddleware({
  name: 'email-verification-send',
  windowMs: 60_000,
  max: 1,
});

emailVerificationRoutes.post(
  '/auth/send-verification-email',
  verificationSendRateLimiter,
  async (request: Request, response: Response) => {
    const accountId = await resolveVerifiedRequestAccountId(request);
    if (!accountId) {
      response.status(401).json({
        ok: false,
        error: 'You must be signed in to request a verification email.',
      });
      return;
    }

    const result = await sendBrandedVerificationEmail({ accountId });
    if (!result.ok) {
      // 503 for "we couldn't talk to Firebase or Resend" — caller can
      // retry. 422 for "no email on this account" — caller can't fix.
      const status = result.reason === 'no_email' ? 422 : 503;
      logger.info(
        `[emailVerificationRoutes] send failed accountId=${accountId} reason=${result.reason}`,
      );
      response.status(status).json({
        ok: false,
        error: result.message,
        reason: result.reason,
      });
      return;
    }

    response.status(200).json({
      ok: true,
      alreadyVerified: result.alreadyVerified,
      sent: result.sent,
    });
  },
);
