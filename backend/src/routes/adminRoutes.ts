import { Router } from 'express';
import { serverConfig } from '../config';
import { hasBackendFirebaseConfig } from '../firebase';
import { backendStorefrontSourceStatus } from '../sources';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { ensureAdminApiKeyConfigured, ensureAdminApiKeyMatch } from '../http/adminAccess';
import {
  getBackendSeedCounts,
  seedBackendFirestoreCollections,
} from '../services/firestoreSeedService';
import { dispatchFavoriteDealAlertsForAllProfiles } from '../services/favoriteDealAlertService';
import {
  clearStorefrontBackendCache,
  invalidateCachedStorefrontDetail,
} from '../services/storefrontCacheService';
import { clearBackendStorefrontSourceCaches, warmBackendStorefrontSource } from '../sources';
import { adminBatchWelcomeEmailRoutes } from './adminBatchWelcomeEmailRoutes';
import { adminDiscoveryRoutes } from './adminDiscoveryRoutes';
import { adminOwnerMutationCooldownRoutes } from './adminOwnerMutationCooldownRoutes';
import { adminPlaceIdBackfillRoutes } from './adminPlaceIdBackfillRoutes';
import { adminPushNotificationRoutes } from './adminPushNotificationRoutes';
import {
  getAdminReviewReadiness,
  getAdminReviewQueue,
  getAdminReviewPhotoQueue,
  parseAdminReviewBody,
  reviewBusinessVerification,
  reviewIdentityVerification,
  reviewOwnerClaim,
  reviewStorefrontPhoto,
  reviewStorefrontReport,
} from '../services/adminReviewService';
import {
  exportMemberEmailSubscriptionsCsv,
  listMemberEmailSubscriptions,
} from '../services/memberEmailSubscriptionService';
import { listResendWebhookEvents } from '../services/resendWebhookService';

/**
 * Validates and bounds limit query parameter to safe integer [1, 100]
 */
function parseAdminLimitParam(value: unknown, fallback = 25): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(100, Math.floor(parsed));
}

export const adminRoutes = Router();
adminRoutes.use(
  '/admin',
  createRateLimitMiddleware({
    name: 'admin',
    windowMs: 10 * 60_000,
    max: serverConfig.adminRateLimitPerTenMinutes,
  }),
);
adminRoutes.use('/admin', ensureAdminApiKeyConfigured);
adminRoutes.use('/admin', ensureAdminApiKeyMatch);

adminRoutes.use('/admin/reviews', (_request, response, next) => {
  const readiness = getAdminReviewReadiness();
  if (!readiness.ok) {
    response.status(503).json({
      ok: false,
      error: `Admin review is not fully configured. Missing: ${readiness.missingRequirements.join(', ')}.`,
    });
    return;
  }

  next();
});

adminRoutes.get('/admin/health', (_request, response) => {
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

adminRoutes.get('/admin/seed-status', (_request, response) => {
  response.json({
    enabled: serverConfig.allowDevSeed,
    counts: getBackendSeedCounts(),
  });
});

adminRoutes.post('/admin/seed-firestore', async (request, response) => {
  if (!serverConfig.allowDevSeed) {
    response.status(403).json({
      ok: false,
      error: 'Dev seed endpoint is disabled.',
    });
    return;
  }

  const confirmHeader = request.header('x-confirm-destructive')?.trim();
  if (confirmHeader !== 'seed-confirmed') {
    response.status(403).json({
      ok: false,
      error: 'Destructive operation requires x-confirm-destructive: seed-confirmed header.',
    });
    return;
  }

  try {
    const result = await seedBackendFirestoreCollections();
    clearStorefrontBackendCache();
    clearBackendStorefrontSourceCaches();
    await warmBackendStorefrontSource();
    response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown seed failure',
    });
  }
});

adminRoutes.post('/admin/dispatch-favorite-deal-alerts', async (_request, response) => {
  if (!serverConfig.allowDevSeed) {
    response.status(403).json({
      ok: false,
      error: 'Favorite-deal dispatch endpoint is disabled.',
    });
    return;
  }

  try {
    response.json({
      ok: true,
      ...(await dispatchFavoriteDealAlertsForAllProfiles()),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown favorite-deal dispatch failure',
    });
  }
});

adminRoutes.get('/admin/email-subscriptions', async (request, response) => {
  try {
    const includeUnsubscribed = request.query.includeUnsubscribed === 'true';
    const result = await listMemberEmailSubscriptions({
      includeUnsubscribed,
    });
    if (request.query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        'attachment; filename="canopytrove-email-subscriptions.csv"',
      );
      response.send(exportMemberEmailSubscriptionsCsv(result.items));
      return;
    }

    response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown email subscription export failure',
    });
  }
});

adminRoutes.get('/admin/email-delivery-events', async (request, response) => {
  try {
    const limit = parseAdminLimitParam(request.query.limit, 25);
    response.json({
      ok: true,
      ...(await listResendWebhookEvents({ limit })),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error:
        error instanceof Error ? error.message : 'Unknown email delivery event listing failure',
    });
  }
});

adminRoutes.use('/admin', adminBatchWelcomeEmailRoutes);
adminRoutes.use('/admin/discovery', adminDiscoveryRoutes);
adminRoutes.use('/admin/place-ids', adminPlaceIdBackfillRoutes);
adminRoutes.use('/admin/push', adminPushNotificationRoutes);
adminRoutes.use('/', adminOwnerMutationCooldownRoutes);

adminRoutes.get('/admin/reviews/queue', async (request, response) => {
  try {
    const limit = parseAdminLimitParam(request.query.limit, 25);
    response.json(await getAdminReviewQueue(limit));
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown admin review failure',
    });
  }
});

adminRoutes.get('/admin/reviews/photo-moderation/queue', async (request, response) => {
  try {
    const limit = parseAdminLimitParam(request.query.limit, 25);
    response.json({
      ok: true,
      reviewPhotos: await getAdminReviewPhotoQueue(limit),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown review-photo moderation failure',
    });
  }
});

adminRoutes.post('/admin/reviews/claims/:claimId', async (request, response) => {
  try {
    response.json(
      await reviewOwnerClaim(request.params.claimId, parseAdminReviewBody(request.body)),
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown claim review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/business-verifications/:ownerUid', async (request, response) => {
  try {
    response.json(
      await reviewBusinessVerification(request.params.ownerUid, parseAdminReviewBody(request.body)),
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error:
        error instanceof Error ? error.message : 'Unknown business verification review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/identity-verifications/:ownerUid', async (request, response) => {
  try {
    response.json(
      await reviewIdentityVerification(request.params.ownerUid, parseAdminReviewBody(request.body)),
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error:
        error instanceof Error ? error.message : 'Unknown identity verification review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/storefront-reports/:reportId', async (request, response) => {
  try {
    response.json(
      await reviewStorefrontReport(request.params.reportId, parseAdminReviewBody(request.body)),
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown storefront report review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/photo-moderation/:photoId', async (request, response) => {
  try {
    const result = await reviewStorefrontPhoto(
      request.params.photoId,
      parseAdminReviewBody(request.body),
    );
    invalidateCachedStorefrontDetail(result.session.storefrontId);
    response.json(result);
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown review-photo moderation failure',
    });
  }
});
