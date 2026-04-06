import type { Request, RequestHandler } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { logSecurityEvent } from './securityEventLogger';
import { recordAbuseSignal } from './abuseScoring';

/**
 * Re-authentication guard for sensitive operations.
 *
 * OWASP recommends re-authentication before:
 * - Changing email address
 * - Changing password
 * - Updating payment or payout information
 * - Modifying MFA settings
 *
 * This middleware verifies the Firebase ID token was issued recently
 * (within a configurable time window), ensuring the user has actively
 * re-authenticated before performing a sensitive action.
 *
 * Firebase ID tokens contain an `auth_time` claim (seconds since epoch)
 * that records when the user last signed in or re-authenticated.
 */

type RecentAuthGuardOptions = {
  /** Maximum age of the auth session in seconds. Default: 300 (5 minutes). */
  maxAuthAgeSeconds?: number;
  /** Human-readable label for the sensitive operation (used in logs). */
  operationLabel?: string;
};

const DEFAULT_MAX_AUTH_AGE_SECONDS = 300; // 5 minutes

function getBearerToken(request: Request) {
  const authorizationHeader = request.header('authorization')?.trim();
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

export function createRecentAuthGuard(options?: RecentAuthGuardOptions): RequestHandler {
  const maxAuthAgeSeconds = options?.maxAuthAgeSeconds ?? DEFAULT_MAX_AUTH_AGE_SECONDS;
  const operationLabel = options?.operationLabel ?? 'sensitive operation';

  return async (request, response, next) => {
    const token = getBearerToken(request);
    if (!token) {
      response.status(401).json({
        ok: false,
        error: 'Authentication is required for this action.',
        code: 'auth_required',
      });
      return;
    }

    if (!hasBackendFirebaseConfig) {
      response.status(503).json({
        ok: false,
        error: 'Authentication service is not configured.',
        code: 'auth_not_configured',
      });
      return;
    }

    const auth = getBackendFirebaseAuth();
    if (!auth) {
      response.status(503).json({
        ok: false,
        error: 'Authentication service is not available.',
        code: 'auth_not_available',
      });
      return;
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      const authTime = decodedToken.auth_time;
      if (typeof authTime !== 'number') {
        response.status(401).json({
          ok: false,
          error: 'Unable to verify authentication recency.',
          code: 'auth_time_missing',
        });
        return;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const authAgeSeconds = nowSeconds - authTime;

      if (authAgeSeconds > maxAuthAgeSeconds) {
        logSecurityEvent({
          event: 'auth_failure',
          ip: request.ip || 'unknown',
          path: request.originalUrl,
          method: request.method,
          userId: decodedToken.uid,
          detail: `Re-auth required for ${operationLabel}: auth_time ${authAgeSeconds}s ago, max ${maxAuthAgeSeconds}s`,
        });

        response.status(403).json({
          ok: false,
          error: 'Please sign in again before performing this action.',
          code: 'reauth_required',
          maxAuthAgeSeconds,
        });
        return;
      }

      // Attach decoded token to request for downstream use
      (request as Request & { verifiedUid?: string }).verifiedUid = decodedToken.uid;
      next();
    } catch {
      const clientIp = request.ip || request.socket.remoteAddress || 'unknown';
      logSecurityEvent({
        event: 'auth_failure',
        ip: clientIp,
        path: request.originalUrl,
        method: request.method,
        detail: `Invalid token during re-auth check for ${operationLabel}`,
      });
      recordAbuseSignal(clientIp, 3, request.originalUrl);

      response.status(401).json({
        ok: false,
        error: 'Invalid authentication token.',
        code: 'invalid_token',
      });
    }
  };
}
