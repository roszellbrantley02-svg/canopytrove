import cors from 'cors';
import express from 'express';
import { backendErrorHandler } from './http/errors';
import { contentTypeEnforcementMiddleware } from './http/contentTypeEnforcement';
import { createAuditLogMiddleware } from './http/auditLog';
import { createRateLimitMiddleware } from './http/rateLimit';
import { securityHeadersMiddleware } from './http/securityHeaders';
import { suspiciousActivityMiddleware } from './http/suspiciousActivityDetector';
import { etagMiddleware } from './http/etag';
import { createRequestTimeoutMiddleware } from './http/requestTimeout';
import { setupExpressErrorMonitoring } from './observability/sentry';
import { requestTelemetryMiddleware } from './observability/requestTelemetry';
import { adminRoutes } from './routes/adminRoutes';
import { analyticsRoutes } from './routes/analyticsRoutes';
import { clientRuntimeRoutes } from './routes/clientRuntimeRoutes';
import { communityRoutes } from './routes/communityRoutes';
import { favoriteDealAlertRoutes } from './routes/favoriteDealAlertRoutes';
import { gamificationRoutes } from './routes/gamificationRoutes';
import { leaderboardRoutes } from './routes/leaderboardRoutes';
import { locationRoutes } from './routes/locationRoutes';
import { marketAreaRoutes } from './routes/marketAreaRoutes';
import { memberEmailRoutes } from './routes/memberEmailRoutes';
import { ownerBillingRoutes, ownerBillingWebhookHandler } from './routes/ownerBillingRoutes';
import { ownerPortalAiRoutes } from './routes/ownerPortalAiRoutes';
import { ownerWelcomeEmailRoutes } from './routes/ownerWelcomeEmailRoutes';
import { ownerPortalWorkspaceRoutes } from './routes/ownerPortalWorkspaceRoutes';
import { opsRoutes } from './routes/opsRoutes';
import { profileRoutes } from './routes/profileRoutes';
import { profileStateRoutes } from './routes/profileStateRoutes';
import { resendWebhookHandler } from './routes/resendWebhookRoutes';
import { routeStateRoutes } from './routes/routeStateRoutes';
import { storefrontRoutes } from './routes/storefrontRoutes';
import { assertSecureServerConfig, serverConfig } from './config';
import { hasBackendFirebaseConfig } from './firebase';
import { backendStorefrontSourceStatus } from './sources';
import { isShuttingDown } from './observability/shutdownState';

export function createApp() {
  assertSecureServerConfig();
  const app = express();
  const readRateLimiter = createRateLimitMiddleware({
    name: 'read',
    windowMs: 60_000,
    max: serverConfig.readRateLimitPerMinute,
    methods: ['GET'],
  });

  app.set('trust proxy', serverConfig.trustProxyHops);
  app.use(requestTelemetryMiddleware);
  app.use(createRequestTimeoutMiddleware(30_000));

  app.use(
    cors({
      origin: serverConfig.corsOrigin,
    }),
  );
  app.use(securityHeadersMiddleware);
  app.use(etagMiddleware);
  const webhookRateLimiter = createRateLimitMiddleware({
    name: 'webhook',
    windowMs: 60_000,
    max: 120,
    methods: ['POST'],
  });
  app.post(
    '/owner-billing/stripe/webhook',
    webhookRateLimiter,
    express.raw({ type: 'application/json', limit: '256kb' }),
    ownerBillingWebhookHandler,
  );
  app.post(
    '/email/webhooks/resend',
    webhookRateLimiter,
    express.raw({ type: 'application/json', limit: '256kb' }),
    resendWebhookHandler,
  );
  app.use(express.json({ limit: '128kb' }));
  app.use(contentTypeEnforcementMiddleware);
  app.use(createAuditLogMiddleware());
  app.use(suspiciousActivityMiddleware);

  app.get('/livez', (_request, response) => {
    response.status(200).json({ status: 'alive' });
  });

  app.get('/readyz', async (_request, response) => {
    if (isShuttingDown) {
      response.status(503).json({ status: 'shutting-down' });
      return;
    }

    try {
      const firestoreReady =
        backendStorefrontSourceStatus.activeMode === 'firestore' ||
        backendStorefrontSourceStatus.activeMode === 'mock';
      if (!firestoreReady) {
        response.status(503).json({ status: 'not ready', reason: 'source-unavailable' });
        return;
      }
      response.status(200).json({ status: 'ready' });
    } catch {
      response.status(503).json({ status: 'not ready', reason: 'internal' });
    }
  });

  app.get('/health', (_request, response) => {
    const storageMode =
      backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory';

    response.json({
      ok: true,
      source: {
        requestedMode: backendStorefrontSourceStatus.requestedMode,
        activeMode: backendStorefrontSourceStatus.activeMode,
        fallbackReason: backendStorefrontSourceStatus.fallbackReason,
      },
      profileStorage: storageMode,
      routeStateStorage: storageMode,
      gamificationStorage: storageMode,
      authVerification: hasBackendFirebaseConfig ? 'firebase-admin' : 'disabled',
      allowDevSeed: serverConfig.allowDevSeed,
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.use(readRateLimiter);

  app.use('/', analyticsRoutes);
  app.use('/', clientRuntimeRoutes);
  app.use('/', communityRoutes);
  app.use('/', favoriteDealAlertRoutes);
  app.use('/', gamificationRoutes);
  app.use('/', leaderboardRoutes);
  app.use('/', locationRoutes);
  app.use('/', marketAreaRoutes);
  app.use('/', memberEmailRoutes);
  app.use('/', ownerBillingRoutes);
  app.use('/', ownerPortalAiRoutes);
  app.use('/', ownerWelcomeEmailRoutes);
  app.use('/', ownerPortalWorkspaceRoutes);
  app.use('/', opsRoutes);
  app.use('/', adminRoutes);
  app.use('/', profileRoutes);
  app.use('/', profileStateRoutes);
  app.use('/', routeStateRoutes);
  app.use('/', storefrontRoutes);
  setupExpressErrorMonitoring(app);
  app.use(backendErrorHandler);

  return app;
}
