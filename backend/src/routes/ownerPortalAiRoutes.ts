import { Router } from 'express';
import { serverConfig } from '../config';
import { recordAbuseSignal } from '../http/abuseScoring';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { parseOwnerAiDraftBody, parseReviewIdParam } from '../http/validation';
import {
  createOwnerPortalJsonRoute,
  resolveOwnerPortalRequestAccess,
} from './ownerPortalRouteUtils';
import {
  generateOwnerAiProfileSuggestion,
  generateOwnerAiPromotionDraft,
  generateOwnerAiReviewReplyDraft,
  getOwnerAiActionPlan,
} from '../services/ownerPortalAiService';
import { requireTierAccess } from '../services/ownerTierGatingService';
import {
  assertOwnerAiDailyQuota,
  OwnerAiQuotaExceededError,
} from '../services/ownerPortalAiUsageService';
import { getOwnerPortalAccessErrorStatus } from '../services/ownerPortalAccessService';

export const ownerPortalAiRoutes = Router();
const ownerAiUserRateLimiter = createUserRateLimitMiddleware({
  name: 'owner-ai',
  windowMs: 60_000,
  max: serverConfig.ownerAiUserRateLimitPerMinute,
  persistent: true,
});

ownerPortalAiRoutes.use(
  '/owner-portal/ai',
  createRateLimitMiddleware({
    name: 'owner-ai-write',
    windowMs: 60_000,
    max: Math.max(10, Math.floor(serverConfig.writeRateLimitPerMinute / 3)),
    methods: ['GET', 'POST'],
  }),
);
ownerPortalAiRoutes.use('/owner-portal/ai', async (request, response, next) => {
  try {
    await resolveOwnerPortalRequestAccess(request);
    next();
  } catch (error) {
    response.status(getOwnerPortalAccessErrorStatus(error)).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Owner authentication is required.',
    });
  }
});
ownerPortalAiRoutes.use('/owner-portal/ai', ownerAiUserRateLimiter);
ownerPortalAiRoutes.use('/owner-portal/ai', async (request, response, next) => {
  try {
    const { ownerUid } = await resolveOwnerPortalRequestAccess(request);
    const quota = await assertOwnerAiDailyQuota(ownerUid);
    response.setHeader('X-OwnerAi-Daily-Limit', String(quota.limit));
    response.setHeader('X-OwnerAi-Daily-Remaining', String(quota.remaining));
    next();
  } catch (error) {
    if (error instanceof OwnerAiQuotaExceededError) {
      recordAbuseSignal(
        request.ip || request.socket.remoteAddress || 'unknown',
        2,
        request.originalUrl,
      );
      response.setHeader('X-OwnerAi-Daily-Limit', String(error.quota.limit));
      response.setHeader('X-OwnerAi-Daily-Remaining', String(error.quota.remaining));
      response.status(error.statusCode).json({
        ok: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    next(error);
  }
});

ownerPortalAiRoutes.get(
  '/owner-portal/ai/action-plan',
  createOwnerPortalJsonRoute('Unknown owner AI action-plan failure', async ({ ownerUid }) => {
    await requireTierAccess(ownerUid, 'pro', 'AI action plans');
    return getOwnerAiActionPlan(ownerUid);
  }),
);

ownerPortalAiRoutes.post(
  '/owner-portal/ai/promotion-draft',
  createOwnerPortalJsonRoute(
    'Unknown owner AI promotion failure',
    async ({ ownerUid, request }) => {
      await requireTierAccess(ownerUid, 'pro', 'AI promotion drafts');
      return generateOwnerAiPromotionDraft(ownerUid, parseOwnerAiDraftBody(request.body));
    },
  ),
);

ownerPortalAiRoutes.post(
  '/owner-portal/ai/profile-suggestion',
  createOwnerPortalJsonRoute('Unknown owner AI profile failure', async ({ ownerUid, request }) => {
    await requireTierAccess(ownerUid, 'pro', 'AI profile suggestions');
    return generateOwnerAiProfileSuggestion(ownerUid, parseOwnerAiDraftBody(request.body));
  }),
);

ownerPortalAiRoutes.post(
  '/owner-portal/ai/reviews/:reviewId/reply-draft',
  createOwnerPortalJsonRoute('Unknown owner AI review failure', async ({ ownerUid, request }) => {
    await requireTierAccess(ownerUid, 'pro', 'AI review reply drafts');
    return generateOwnerAiReviewReplyDraft(
      ownerUid,
      parseReviewIdParam(request.params.reviewId),
      parseOwnerAiDraftBody(request.body),
    );
  }),
);
