import { Router } from 'express';
import { logger } from '../observability/logger';
import { createRateLimitMiddleware } from '../http/rateLimit';

export const webBeaconRoutes = Router();

/**
 * Lightweight beacon endpoints for browser-reported telemetry.
 * These accept fire-and-forget POSTs from sendBeacon() / fetch keepalive.
 * They log to structured JSON (Pino → Cloud Logging) for analysis.
 */

const beaconRateLimiter = createRateLimitMiddleware({
  name: 'beacon',
  windowMs: 60_000,
  max: 60,
  methods: ['POST'],
});

webBeaconRoutes.use(beaconRateLimiter);

// ── Web Vitals (LCP, INP, CLS) ──
webBeaconRoutes.post('/v1/web-vitals', (request, response) => {
  try {
    const { name, value, rating, delta, id, navigationType } = request.body ?? {};

    // Basic validation — only accept known metric names
    const validMetrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
    if (!validMetrics.includes(name)) {
      response.status(400).json({ error: 'invalid metric name' });
      return;
    }

    logger.info(`web-vital: ${name}=${value} (${rating})`, {
      type: 'web-vital',
      metric: name,
      value: typeof value === 'number' ? value : null,
      rating: typeof rating === 'string' ? rating : null,
      delta: typeof delta === 'number' ? delta : null,
      metricId: typeof id === 'string' ? id.slice(0, 64) : null,
      navigationType: typeof navigationType === 'string' ? navigationType.slice(0, 32) : null,
      userAgent: request.headers['user-agent']?.slice(0, 256) ?? null,
    });

    response.status(204).end();
  } catch {
    response.status(204).end(); // Never fail a beacon — it's fire-and-forget
  }
});

// ── CSP Violation Reports ──
webBeaconRoutes.post('/v1/csp-report', (request, response) => {
  try {
    // Browsers send CSP reports in different formats
    const report = request.body?.['csp-report'] ?? request.body;

    if (report) {
      logger.warn(`csp-violation: ${report['violated-directive'] ?? 'unknown'}`, {
        type: 'csp-violation',
        documentUri:
          typeof report['document-uri'] === 'string' ? report['document-uri'].slice(0, 512) : null,
        violatedDirective:
          typeof report['violated-directive'] === 'string'
            ? report['violated-directive'].slice(0, 128)
            : null,
        blockedUri:
          typeof report['blocked-uri'] === 'string' ? report['blocked-uri'].slice(0, 512) : null,
        sourceFile:
          typeof report['source-file'] === 'string' ? report['source-file'].slice(0, 512) : null,
        lineNumber: typeof report['line-number'] === 'number' ? report['line-number'] : null,
        effectiveDirective:
          typeof report['effective-directive'] === 'string'
            ? report['effective-directive'].slice(0, 128)
            : null,
      });
    }

    response.status(204).end();
  } catch {
    response.status(204).end();
  }
});
