import cors from 'cors';
import express from 'express';
import { createAppCheckGuardMiddleware } from './http/appCheckGuard';
import { backendErrorHandler } from './http/errors';
import { contentTypeEnforcementMiddleware } from './http/contentTypeEnforcement';
import { createAuditLogMiddleware } from './http/auditLog';
import { createRateLimitMiddleware } from './http/rateLimit';
import { securityHeadersMiddleware } from './http/securityHeaders';
import { suspiciousActivityMiddleware } from './http/suspiciousActivityDetector';
import { etagMiddleware } from './http/etag';
import { createRequestTimeoutMiddleware, disableRequestTimeout } from './http/requestTimeout';
import { responseValidatorMiddleware } from './http/responseValidator';
import { isIpFlagged } from './http/abuseScoring';
import { createOriginGuardMiddleware } from './http/originGuard';
import { setupExpressErrorMonitoring } from './observability/sentry';
import { logger } from './observability/logger';
import { requestTelemetryMiddleware } from './observability/requestTelemetry';
import { adminRoutes } from './routes/adminRoutes';
import { analyticsRoutes } from './routes/analyticsRoutes';
import { clientRuntimeRoutes } from './routes/clientRuntimeRoutes';
import { communityRoutes } from './routes/communityRoutes';
import { communitySafetyStateRoutes } from './routes/communitySafetyStateRoutes';
import { favoriteDealAlertRoutes } from './routes/favoriteDealAlertRoutes';
import { favoriteBrandRoutes } from './routes/favoriteBrandRoutes';
import { gamificationRoutes } from './routes/gamificationRoutes';
import { leaderboardRoutes } from './routes/leaderboardRoutes';
import { licenseVerifyRoutes } from './routes/licenseVerifyRoutes';
import { locationRoutes } from './routes/locationRoutes';
import { scanIngestRoutes } from './routes/scanIngestRoutes';
import { paymentMethodsRoutes } from './routes/paymentMethodsRoutes';
import { productResolveRoutes } from './routes/productResolveRoutes';
import { productContributionRoutes } from './routes/productContributionRoutes';
import { productReviewRoutes } from './routes/productReviewRoutes';
import { marketAreaRoutes } from './routes/marketAreaRoutes';
import { memberEmailRoutes } from './routes/memberEmailRoutes';
import { emailUnsubscribeRoutes } from './routes/emailUnsubscribeRoutes';
import { emailVerificationRoutes } from './routes/emailVerificationRoutes';
import { ownerBillingRoutes, ownerBillingWebhookHandler } from './routes/ownerBillingRoutes';
import { appStoreNotificationRoutes } from './routes/appStoreNotificationRoutes';
import { phoneVerificationRoutes } from './routes/phoneVerificationRoutes';
import { shopOwnershipVerificationRoutes } from './routes/shopOwnershipVerificationRoutes';
import { shopClaimNotificationRoutes } from './routes/shopClaimNotificationRoutes';
import { ownerPortalBulkClaimRoutes } from './routes/ownerPortalBulkClaimRoutes';
import { ownerPortalTaxVerificationRoutes } from './routes/ownerPortalTaxVerificationRoutes';
import { stripeIdentityWebhookHandler } from './routes/stripeIdentityRoutes';
import { ownerPortalAiRoutes } from './routes/ownerPortalAiRoutes';
import { aiShopBootstrapRoutes } from './routes/aiShopBootstrapRoutes';
import { aiInventoryRoutes } from './routes/aiInventoryRoutes';
import { ownerWelcomeEmailRoutes } from './routes/ownerWelcomeEmailRoutes';
import { ownerPortalWorkspaceRoutes } from './routes/ownerPortalWorkspaceRoutes';
import { ownerPortalWebPushRoutes } from './routes/ownerPortalWebPushRoutes';
import { eventRoutes } from './routes/eventRoutes';
import { ownerMultiLocationRoutes } from './routes/ownerMultiLocationRoutes';
import { opsRoutes } from './routes/opsRoutes';
import { profileRoutes } from './routes/profileRoutes';
import { profileStateRoutes } from './routes/profileStateRoutes';
import { resendWebhookHandler } from './routes/resendWebhookRoutes';
import { routeStateRoutes } from './routes/routeStateRoutes';
import { giphyGatewayRoutes } from './routes/giphyGatewayRoutes';
import { sitemapRoutes } from './routes/sitemapRoutes';
import { storefrontRoutes } from './routes/storefrontRoutes';
import { accountSecurityRoutes } from './routes/accountSecurityRoutes';
import { usernameRequestRoutes } from './routes/usernameRequestRoutes';
import { pushSubscriptionRoutes } from './routes/pushSubscriptionRoutes';
import { webBeaconRoutes } from './routes/webBeaconRoutes';
import { photoUploadBytesRoute } from './routes/photoUploadBytesRoute';
import {
  createReviewPhotoUploadSession,
  receiveReviewPhotoBytes,
  completeReviewPhotoUpload,
  ReviewPhotoModerationError,
} from './services/reviewPhotoModerationService';
import { parseStorefrontIdParam } from './http/validation';
import { ensureProfileWriteAccess } from './services/profileAccessService';
import { checkCommunityVelocity } from './http/communityVelocityGuard';
import { assertSecureServerConfig, serverConfig } from './config';
import { hasBackendFirebaseConfig } from './firebase';
import { backendStorefrontSourceStatus } from './sources';
import { isShuttingDown } from './observability/shutdownState';

function shouldBypassAbuseGate(method: string) {
  const normalizedMethod = method.toUpperCase();
  return (
    normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS'
  );
}

export function createApp() {
  assertSecureServerConfig();
  const app = express();
  const readRateLimiter = createRateLimitMiddleware({
    name: 'read',
    windowMs: 60_000,
    max: serverConfig.readRateLimitPerMinute,
    methods: ['GET'],
    abuseSignalPoints: 0,
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
  app.use(createOriginGuardMiddleware());
  app.use(responseValidatorMiddleware);
  app.use(etagMiddleware);
  const webhookRateLimiter = createRateLimitMiddleware({
    name: 'webhook',
    windowMs: 60_000,
    max: 120,
    methods: ['POST'],
  });
  const reviewPhotoUploadRateLimiter = createRateLimitMiddleware({
    name: 'review-photo-upload',
    windowMs: 60_000,
    max: 12,
    methods: ['POST', 'PUT'],
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
  app.post(
    '/identity-verification/stripe/webhook',
    webhookRateLimiter,
    express.raw({ type: 'application/json', limit: '256kb' }),
    stripeIdentityWebhookHandler,
  );
  // Beacon routes (CSP reports, web vitals) must be mounted BEFORE the
  // JSON-only content-type enforcement. Browsers send CSP violation reports
  // with Content-Type: application/csp-report, which would be rejected by
  // the enforcement middleware.
  app.use(
    '/',
    express.json({
      limit: '64kb',
      type: [
        'application/json',
        'application/csp-report',
        'application/reports+json',
        'text/plain',
      ],
    }),
    webBeaconRoutes,
  );

  // One-shot photo upload (JSON + base64). Must be mounted BEFORE the
  // global 128 KB JSON parser so it gets the higher 12 MB limit.
  // Inlined here instead of a separate file to guarantee deployment.
  const PHOTO_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]);

  function sanitizePhotoFileName(input: string): string {
    // Strip path traversal characters and allow only alphanumeric, dots, hyphens, underscores
    const sanitized = input
      .replace(/[^a-zA-Z0-9._-]/g, '') // Remove unsafe characters
      .replace(/^\.+/, ''); // Remove leading dots

    // Return sanitized name or safe default if empty
    return sanitized && sanitized.length > 0 ? sanitized : `photo-${Date.now().toString(36)}.jpg`;
  }
  app.post(
    '/storefront-details/:storefrontId/reviews/photo-uploads/one-shot',
    reviewPhotoUploadRateLimiter,
    disableRequestTimeout(),
    createRequestTimeoutMiddleware(90_000),
    express.json({ limit: '12mb' }),
    async (request, response) => {
      try {
        const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
        const body = request.body as {
          profileId?: unknown;
          fileName?: unknown;
          contentType?: unknown;
          imageBase64?: unknown;
        };

        const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
        const fileName = sanitizePhotoFileName(
          typeof body.fileName === 'string' ? body.fileName : '',
        );
        const contentType =
          typeof body.contentType === 'string' && PHOTO_CONTENT_TYPES.has(body.contentType.trim())
            ? body.contentType.trim()
            : 'image/jpeg';
        const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';

        if (!profileId) {
          response.status(400).json({ ok: false, error: 'Upload failed: profileId is required.' });
          return;
        }
        if (!imageBase64) {
          response
            .status(400)
            .json({ ok: false, error: 'Upload failed: imageBase64 is required.' });
          return;
        }

        const { accountId } = await ensureProfileWriteAccess(request, profileId);
        if (!accountId) {
          response.status(403).json({
            ok: false,
            error: 'Sign-in required: a signed-in account is needed for photo uploads.',
          });
          return;
        }

        const velocityResult = checkCommunityVelocity(
          profileId,
          'photo_upload',
          request.ip || 'unknown',
        );
        if (!velocityResult.allowed) {
          response.status(429).json({
            ok: false,
            error: velocityResult.reason,
          });
          return;
        }

        let imageBytes: Buffer;
        try {
          imageBytes = Buffer.from(imageBase64, 'base64');
        } catch {
          response
            .status(400)
            .json({ ok: false, error: 'Upload failed: imageBase64 is not valid base64.' });
          return;
        }
        if (imageBytes.length === 0) {
          response.status(400).json({ ok: false, error: 'Upload failed: image data is empty.' });
          return;
        }

        const uploadSession = await createReviewPhotoUploadSession({
          storefrontId,
          profileId,
          fileName,
          contentType,
          sizeBytes: imageBytes.length,
          forceMemoryMode: true,
        });

        await receiveReviewPhotoBytes(uploadSession.id, imageBytes);
        const completed = await completeReviewPhotoUpload(uploadSession.id);

        response.json({
          ok: true,
          uploadSession: {
            id: completed.session.id,
            contentType: completed.session.contentType,
            sizeBytes: completed.session.sizeBytes,
            uploadMode: completed.session.uploadMode,
            uploadUrl: null,
          },
          session: {
            id: completed.session.id,
            moderationStatus: completed.session.moderationStatus,
            moderationDecision: completed.session.moderationDecision,
            moderationReason: completed.session.moderationReason,
          },
          publicUrl: completed.publicUrl,
        });
      } catch (error) {
        if (error instanceof ReviewPhotoModerationError) {
          response.status(error.statusCode).json({ ok: false, error: error.message });
          return;
        }
        logger.error('[photo-upload-one-shot] Unexpected error', {
          error: error instanceof Error ? error.message : String(error),
        });
        response
          .status(500)
          .json({ ok: false, error: 'Upload failed: an unexpected error occurred.' });
      }
    },
  );

  // Raw review-photo byte upload. This lets the web client avoid base64
  // overhead when the browser already has a Blob/File from a phone camera
  // or photo library selection.
  app.use('/', photoUploadBytesRoute);

  // Health probes — must be above abuse middleware so Cloud Run health checks are never blocked
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

  // Public health check — safe, no infrastructure details
  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  // Sitemap + robots.txt — above abuse middleware so crawlers are never blocked
  app.use('/', sitemapRoutes);

  app.use(express.json({ limit: '128kb' }));
  app.use(contentTypeEnforcementMiddleware);
  app.use(createAuditLogMiddleware());
  app.use(suspiciousActivityMiddleware);

  // App Check verification. Runs in "log" mode by default — missing or
  // invalid tokens are logged as warnings but requests still proceed.
  // Flip APP_CHECK_ENFORCEMENT=enforce in Cloud Run once real iOS
  // clients are sending tokens reliably (~1 week post-rollout).
  app.use(createAppCheckGuardMiddleware());

  // Abuse-scored IP gate — flagged IPs get rejected before route handlers
  app.use((request, response, next) => {
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    if (!shouldBypassAbuseGate(request.method) && isIpFlagged(ip)) {
      response.status(429).json({
        error: 'Request rate exceeded. Please slow down and try again later.',
      });
      return;
    }
    next();
  });

  app.use(readRateLimiter);

  app.use('/', analyticsRoutes);
  app.use('/', clientRuntimeRoutes);
  app.use('/', communityRoutes);
  app.use('/', communitySafetyStateRoutes);
  app.use('/', favoriteDealAlertRoutes);
  app.use('/', favoriteBrandRoutes);
  app.use('/', gamificationRoutes);
  app.use('/', leaderboardRoutes);
  app.use('/', licenseVerifyRoutes);
  app.use('/', locationRoutes);
  app.use('/', scanIngestRoutes);
  app.use('/', paymentMethodsRoutes);
  app.use('/', productResolveRoutes);
  app.use('/', productContributionRoutes);
  app.use('/', productReviewRoutes);
  app.use('/', marketAreaRoutes);
  app.use('/', memberEmailRoutes);
  app.use('/', emailUnsubscribeRoutes);
  app.use('/', emailVerificationRoutes);
  app.use('/', ownerBillingRoutes);
  app.use('/', appStoreNotificationRoutes);
  app.use('/', phoneVerificationRoutes);
  app.use('/', shopOwnershipVerificationRoutes);
  app.use('/', shopClaimNotificationRoutes);
  app.use('/', ownerPortalBulkClaimRoutes);
  app.use('/', ownerPortalTaxVerificationRoutes);
  app.use('/', ownerPortalAiRoutes);
  app.use('/', aiShopBootstrapRoutes);
  app.use('/', aiInventoryRoutes);
  app.use('/', ownerWelcomeEmailRoutes);
  app.use('/', ownerPortalWorkspaceRoutes);
  app.use('/', ownerPortalWebPushRoutes);
  app.use('/', eventRoutes);
  app.use('/', ownerMultiLocationRoutes);
  app.use('/', opsRoutes);
  app.use('/', adminRoutes);
  app.use('/push', pushSubscriptionRoutes);
  app.use('/', profileRoutes);
  app.use('/', profileStateRoutes);
  app.use('/', giphyGatewayRoutes);
  app.use('/', routeStateRoutes);
  app.use('/', storefrontRoutes);
  app.use('/', accountSecurityRoutes);
  app.use('/', usernameRequestRoutes);
  // webBeaconRoutes mounted earlier (before content-type enforcement)
  setupExpressErrorMonitoring(app);
  app.use(backendErrorHandler);

  return app;
}
