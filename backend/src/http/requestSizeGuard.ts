import { RequestHandler } from 'express';
import { logSecurityEvent } from './securityEventLogger';

/**
 * Enforce a maximum request body size for specific routes.
 * Applies AFTER express.json() has already parsed — checks the
 * parsed body's serialized size against the limit.
 *
 * Use this on routes that accept user content (reviews, profiles, etc.)
 * to prevent oversized payloads that slip under the global 128kb limit.
 */
export function createRequestSizeGuard(maxBytes: number): RequestHandler {
  return (request, response, next) => {
    if (!request.body || request.method === 'GET' || request.method === 'OPTIONS') {
      next();
      return;
    }

    try {
      const bodySize = Buffer.byteLength(JSON.stringify(request.body), 'utf8');
      if (bodySize > maxBytes) {
        logSecurityEvent({
          event: 'request_size_exceeded',
          ip: request.ip || 'unknown',
          path: request.originalUrl,
          method: request.method,
          detail: `Body size ${bodySize} exceeds limit ${maxBytes}`,
          meta: { bodySize, maxBytes },
        });

        response.status(413).json({
          error: 'Request body too large for this endpoint.',
        });
        return;
      }
    } catch {
      // If serialization fails, let the route handler deal with it
    }

    next();
  };
}
