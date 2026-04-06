import { RequestHandler } from 'express';
import { serverConfig } from '../config';
import { logSecurityEvent } from './securityEventLogger';

/**
 * Origin / Referer validation for state-changing requests.
 *
 * Since the API uses Bearer tokens (not cookies), traditional CSRF via
 * cross-origin form submission won't include the Authorization header.
 * This middleware is defense-in-depth: it rejects state-changing requests
 * whose Origin header doesn't match the configured CORS origins.
 *
 * Exceptions:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Requests with a valid Bearer token (already auth-gated)
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

    // Requests with Authorization header (Bearer token) — CSRF not applicable
    if (request.header('authorization')) {
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

    // Check Origin header
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
    // For unauthenticated state-changing requests without Origin, we're more lenient
    // because the rate limiter and other guards cover abuse.
    next();
  };
}
