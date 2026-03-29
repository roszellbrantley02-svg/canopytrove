import cors from 'cors';
import express from 'express';
import { backendErrorHandler } from './http/errors';
import { createRateLimitMiddleware } from './http/rateLimit';
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
import { ownerBillingRoutes, ownerBillingWebhookHandler } from './routes/ownerBillingRoutes';
import { ownerPortalWorkspaceRoutes } from './routes/ownerPortalWorkspaceRoutes';
import { profileRoutes } from './routes/profileRoutes';
import { profileStateRoutes } from './routes/profileStateRoutes';
import { routeStateRoutes } from './routes/routeStateRoutes';
import { storefrontRoutes } from './routes/storefrontRoutes';
import { serverConfig } from './config';
import { hasBackendFirebaseConfig } from './firebase';
import { backendStorefrontSourceStatus } from './sources';

export function createApp() {
  const app = express();
  const readRateLimiter = createRateLimitMiddleware({
    name: 'read',
    windowMs: 60_000,
    max: serverConfig.readRateLimitPerMinute,
    methods: ['GET'],
  });

  app.set('trust proxy', true);
  app.use(requestTelemetryMiddleware);

  app.use(
    cors({
      origin: serverConfig.corsOrigin,
    })
  );
  app.post(
    '/owner-billing/stripe/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    ownerBillingWebhookHandler
  );
  app.use(express.json({ limit: '128kb' }));
  app.use(readRateLimiter);

  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      source: backendStorefrontSourceStatus,
      profileStorage:
        backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
      routeStateStorage:
        backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
      gamificationStorage:
        backendStorefrontSourceStatus.activeMode === 'firestore' ? 'firestore' : 'memory',
      authVerification: hasBackendFirebaseConfig ? 'firebase-admin' : 'disabled',
      allowDevSeed: serverConfig.allowDevSeed,
      requestLoggingEnabled: serverConfig.requestLoggingEnabled,
    });
  });

  app.use('/', adminRoutes);
  app.use('/', analyticsRoutes);
  app.use('/', clientRuntimeRoutes);
  app.use('/', communityRoutes);
  app.use('/', favoriteDealAlertRoutes);
  app.use('/', gamificationRoutes);
  app.use('/', leaderboardRoutes);
  app.use('/', locationRoutes);
  app.use('/', marketAreaRoutes);
  app.use('/', ownerBillingRoutes);
  app.use('/', ownerPortalWorkspaceRoutes);
  app.use('/', profileRoutes);
  app.use('/', profileStateRoutes);
  app.use('/', routeStateRoutes);
  app.use('/', storefrontRoutes);
  app.use(backendErrorHandler);

  return app;
}
