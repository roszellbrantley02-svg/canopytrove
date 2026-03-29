import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import {
  getBackendSeedCounts,
  seedBackendFirestoreCollections,
} from '../services/firestoreSeedService';
import { dispatchFavoriteDealAlertsForAllProfiles } from '../services/favoriteDealAlertService';
import { clearStorefrontBackendCache } from '../services/storefrontCacheService';
import { clearBackendStorefrontSourceCaches, warmBackendStorefrontSource } from '../sources';
import {
  getAdminReviewReadiness,
  getAdminReviewQueue,
  parseAdminReviewBody,
  reviewBusinessVerification,
  reviewIdentityVerification,
  reviewOwnerClaim,
  reviewStorefrontReport,
} from '../services/adminReviewService';

export const adminRoutes = Router();
adminRoutes.use(
  createRateLimitMiddleware({
    name: 'admin',
    windowMs: 10 * 60_000,
    max: serverConfig.adminRateLimitPerTenMinutes,
  })
);

adminRoutes.use('/admin/reviews', (request, response, next) => {
  const readiness = getAdminReviewReadiness();
  const expectedApiKey = process.env.ADMIN_API_KEY?.trim() || serverConfig.adminApiKey;
  if (!expectedApiKey) {
    response.status(503).json({
      ok: false,
      error: `Admin review is not fully configured. Missing: ${readiness.missingRequirements.join(', ')}.`,
    });
    return;
  }

  const providedApiKey = request.header('x-admin-api-key')?.trim();
  if (providedApiKey !== expectedApiKey) {
    response.status(401).json({
      ok: false,
      error: 'Invalid admin API key.',
    });
    return;
  }

  next();
});

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

adminRoutes.get('/admin/seed-status', (_request, response) => {
  response.json({
    enabled: serverConfig.allowDevSeed,
    counts: getBackendSeedCounts(),
  });
});

adminRoutes.post('/admin/seed-firestore', async (_request, response) => {
  if (!serverConfig.allowDevSeed) {
    response.status(403).json({
      ok: false,
      error: 'Dev seed endpoint is disabled.',
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

adminRoutes.get('/admin/reviews/queue', async (request, response) => {
  try {
    response.json(await getAdminReviewQueue(request.query.limit));
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown admin review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/claims/:claimId', async (request, response) => {
  try {
    response.json(
      await reviewOwnerClaim(request.params.claimId, parseAdminReviewBody(request.body))
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
      await reviewBusinessVerification(
        request.params.ownerUid,
        parseAdminReviewBody(request.body)
      )
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown business verification review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/identity-verifications/:ownerUid', async (request, response) => {
  try {
    response.json(
      await reviewIdentityVerification(
        request.params.ownerUid,
        parseAdminReviewBody(request.body)
      )
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown identity verification review failure',
    });
  }
});

adminRoutes.post('/admin/reviews/storefront-reports/:reportId', async (request, response) => {
  try {
    response.json(
      await reviewStorefrontReport(
        request.params.reportId,
        parseAdminReviewBody(request.body)
      )
    );
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown storefront report review failure',
    });
  }
});
