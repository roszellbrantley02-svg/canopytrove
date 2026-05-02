import type { NextFunction, Request, Response } from 'express';
import { getBackendFirebaseAppCheck } from '../firebase';
import { logger } from '../observability/logger';

/**
 * Firebase App Check verification middleware.
 *
 * Mode is controlled by env var APP_CHECK_ENFORCEMENT:
 *   - "log"     (default): verify the token if present, log missing or
 *                          invalid tokens as warnings, but always call
 *                          next(). Safe to deploy before the client
 *                          rollout is complete.
 *   - "enforce":           reject requests without a valid App Check
 *                          token with HTTP 401. Only flip this on after
 *                          you've confirmed tokens are flowing cleanly
 *                          from real iOS clients for at least a week.
 *   - "disabled":          skip App Check verification entirely. Useful
 *                          for local development without Firebase admin
 *                          credentials.
 *
 * GET/HEAD/OPTIONS and health/ops probes are exempt regardless of mode
 * so Cloud Run health checks, sitemap crawlers, and beacon posts are
 * never blocked.
 */

export type AppCheckEnforcementMode = 'log' | 'enforce' | 'disabled';

const APP_CHECK_HEADER = 'x-firebase-appcheck';

const EXEMPT_PATH_PREFIXES = [
  '/livez',
  '/readyz',
  '/health',
  '/sitemap',
  '/robots.txt',
  '/owner-billing/stripe/webhook',
  '/email/webhooks/resend',
  '/identity-verification/stripe/webhook',
  // Admin routes are gated by ADMIN_API_KEY in ensureAdminApiKeyMatch
  // — that's a stronger guarantee than App Check (server-side secret
  // vs client-side attestation). Exempting prevents the GitHub Actions
  // crons (refresh-ocm-seed, dispatch-deal-digests, deploy-backend-now,
  // etc.) from being rejected when APP_CHECK_ENFORCEMENT=enforce flips
  // on. Without this exemption every cron run today shows up in the
  // [app-check] missing-token logs.
  '/admin/',
  // Analytics events come from anywhere — web app (no App Check setup
  // since web push isn't wired), pre-auth native sessions, server-to-
  // server smoke tests. Blocking them would lose all web analytics
  // and break the daily session-volume metrics (analytics_daily_app_
  // metrics). The endpoint is rate-limited by IP elsewhere; that's
  // the right defense for unauthenticated event ingest.
  '/analytics/events',
];

function readEnforcementMode(): AppCheckEnforcementMode {
  const raw = (process.env.APP_CHECK_ENFORCEMENT || '').trim().toLowerCase();
  if (raw === 'enforce') return 'enforce';
  if (raw === 'disabled') return 'disabled';
  return 'log';
}

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSafeMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS';
}

export function createAppCheckGuardMiddleware() {
  return async function appCheckGuard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const mode = readEnforcementMode();
    if (mode === 'disabled') {
      next();
      return;
    }

    // Never block health probes or webhook endpoints (Stripe, Resend,
    // etc. can't attach an App Check token).
    if (isExemptPath(request.path) || isSafeMethod(request.method)) {
      next();
      return;
    }

    const headerValue = request.header(APP_CHECK_HEADER);
    const token = typeof headerValue === 'string' ? headerValue.trim() : '';

    if (!token) {
      if (mode === 'enforce') {
        response.status(401).json({
          error: 'Missing App Check token.',
        });
        return;
      }

      logger.warn('[app-check] missing token', {
        method: request.method,
        path: request.path,
        mode,
      });
      next();
      return;
    }

    const appCheck = getBackendFirebaseAppCheck();
    if (!appCheck) {
      // Admin SDK isn't configured — log and pass. This typically only
      // happens in local dev without credentials.
      logger.warn('[app-check] admin SDK unavailable, cannot verify token', {
        method: request.method,
        path: request.path,
      });
      next();
      return;
    }

    try {
      await appCheck.verifyToken(token);
      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (mode === 'enforce') {
        logger.warn('[app-check] rejected invalid token', {
          method: request.method,
          path: request.path,
          error: errorMessage,
        });
        response.status(401).json({
          error: 'Invalid App Check token.',
        });
        return;
      }

      logger.warn('[app-check] invalid token', {
        method: request.method,
        path: request.path,
        mode,
        error: errorMessage,
      });
      next();
    }
  };
}

/**
 * Strict App Check middleware — always enforces, regardless of
 * APP_CHECK_ENFORCEMENT env var. Use this on high-risk public endpoints
 * that accept writes (scan ingestion, user-generated content) so the
 * global log-only mode can't accidentally leave them open.
 *
 * Honours `APP_CHECK_ENFORCEMENT=disabled` ONLY when NODE_ENV is not
 * production — local dev without Firebase admin credentials still works,
 * but production can never be silently downgraded.
 *
 * Exempt paths are always respected so health probes pass through.
 *
 * Options:
 *   - allowSafeMethods (default true): exempt GET/HEAD/OPTIONS. Set to
 *     false on GET endpoints that have side effects (e.g. server-side
 *     HTTP fetches), where "safe method" no longer means "no auth needed".
 */
export function createAppCheckStrictMiddleware(options?: { allowSafeMethods?: boolean }) {
  const allowSafeMethods = options?.allowSafeMethods !== false;
  return async function appCheckStrict(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const mode = readEnforcementMode();
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (mode === 'disabled' && !isProd) {
      next();
      return;
    }

    // OPTIONS is always exempt (CORS preflight cannot carry App Check
    // headers). GET/HEAD only exempt when allowSafeMethods is true.
    const method = request.method.toUpperCase();
    const isPreflight = method === 'OPTIONS';
    const isRead = method === 'GET' || method === 'HEAD';
    if (isExemptPath(request.path) || isPreflight || (allowSafeMethods && isRead)) {
      next();
      return;
    }

    const headerValue = request.header(APP_CHECK_HEADER);
    const token = typeof headerValue === 'string' ? headerValue.trim() : '';

    if (!token) {
      logger.warn('[app-check:strict] missing token', {
        method: request.method,
        path: request.path,
      });
      response.status(401).json({
        error: 'Missing App Check token.',
      });
      return;
    }

    const appCheck = getBackendFirebaseAppCheck();
    if (!appCheck) {
      // Admin SDK unavailable. In prod this is a hard failure (we cannot
      // verify the token) — refuse the request instead of silently
      // accepting it. In dev (NODE_ENV != production) we already returned
      // above.
      logger.error('[app-check:strict] admin SDK unavailable, refusing request', {
        method: request.method,
        path: request.path,
      });
      response.status(503).json({
        error: 'App Check verification is unavailable. Please retry shortly.',
      });
      return;
    }

    try {
      await appCheck.verifyToken(token);
      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('[app-check:strict] rejected invalid token', {
        method: request.method,
        path: request.path,
        error: errorMessage,
      });
      response.status(401).json({
        error: 'Invalid App Check token.',
      });
    }
  };
}
