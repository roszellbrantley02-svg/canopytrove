import { RequestHandler } from 'express';
import { logger } from '../observability/logger';

/**
 * Aborts requests that exceed the given timeout.
 * Cloud Run has its own timeout (default 300s), but this catches
 * application-level hangs earlier with a structured error response.
 */
export function createRequestTimeoutMiddleware(timeoutMs = 30_000): RequestHandler {
  return (request, response, next) => {
    const timer = setTimeout(() => {
      if (!response.headersSent) {
        logger.warn('Request timeout exceeded', {
          method: request.method,
          path: request.originalUrl,
          timeoutMs,
        });
        response.status(504).json({
          error: 'Request timeout exceeded.',
        });
      }
    }, timeoutMs);

    // Expose the timer so long-running admin routes can clear it.
    (response as any).__requestTimeoutTimer = timer;

    // Clear timeout when response finishes
    response.on('close', () => clearTimeout(timer));
    response.on('finish', () => clearTimeout(timer));

    next();
  };
}

/**
 * Middleware that disables the global request timeout for long-running
 * admin operations (e.g. discovery sweeps). Cloud Run's own 300s
 * timeout remains the hard ceiling.
 */
export function disableRequestTimeout(): RequestHandler {
  return (_request, response, next) => {
    const timer = (response as any).__requestTimeoutTimer;
    if (timer) {
      clearTimeout(timer);
    }
    next();
  };
}
