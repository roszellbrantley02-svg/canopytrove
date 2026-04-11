import { RequestHandler } from 'express';
import { serverConfig } from '../config';
import { logSecurityEvent } from './securityEventLogger';

/**
 * Origin / Referer validation for state-changing requests.
 *
 * This middleware enforces strict origin checking on all state-changing requests
 * to prevent CSRF attacks. Even though the API uses Bearer tokens (not cookies),
 * an attacker can still craft cross-origin requests with a valid token if the
 * user is logged in elsewhere. This is especially important for authenticated endpoints.
 *
 * Exceptions:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Webhook endpoints (use their own signature verification)
 * - Requests from mobile apps (no Origin header)
 */
export function createOriginGuardMiddleware(): RequestHandler {
  const allowedOrigins = new Set(
    Array.isArray(serverConfig.corsOrigin) ? serverConfig.corsOrigin : [serverConfig.corsOrigin],
  );

  return (request, response, next) => {
    // Safe methods — skip
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    // Webhook paths use their own signature verification
    if (
      request.path.includes('/webhook') ||
      request.path.includes('/stripe/') ||
      request.path.includes('/resend/')
    ) {
      next();
      return;
    }

    // Check Origin header for all state-changing requests (authenticated or not)
    const origin = request.header('origin');
    if (origin && !allowedOrigins.has(origin)) {
      logSecurityEvent({
        event: 'cors_rejection',
        ip: request.ip || 'unknown',
        path: request.originalUrl,
        method: request.method,
        detail: `Rejected origin: ${origin}`,
      });
      response.status(403).json({ error: 'Origin not allowed.' });
      return;
    }

    // No Origin header — could be mobile app, server-to-server, or curl.
    // For state-changing requests without Origin, we're more lenient
    // because the rate limiter and other guards cover abuse.
    next();
  };
}
