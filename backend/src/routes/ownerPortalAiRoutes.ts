import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseOwnerAiDraftBody, parseReviewIdParam } from '../http/validation';
import { createOwnerPortalJsonRoute } from './ownerPortalRouteUtils';
import {
  generateOwnerAiProfileSuggestion,
  generateOwnerAiPromotionDraft,
  generateOwnerAiReviewReplyDraft,
  getOwnerAiActionPlan,
} from '../services/ownerPortalAiService';

export const ownerPortalAiRoutes = Router();
ownerPortalAiRoutes.use(
  '/owner-portal/ai',
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: Math.max(10, Math.floor(serverConfig.writeRateLimitPerMinute / 3)),
    methods: ['GET', 'POST'],
  })
);

ownerPortalAiRoutes.get(
  '/owner-portal/ai/action-plan',
  createOwnerPortalJsonRoute('Unknown owner AI action-plan failure', async ({ ownerUid }) =>
    getOwnerAiActionPlan(ownerUid)
  )
);

ownerPortalAiRoutes.post(
  '/owner-portal/ai/promotion-draft',
  createOwnerPortalJsonRoute('Unknown owner AI promotion failure', async ({
    ownerUid,
    request,
  }) => generateOwnerAiPromotionDraft(ownerUid, parseOwnerAiDraftBody(request.body)))
);

ownerPortalAiRoutes.post(
  '/owner-portal/ai/profile-suggestion',
  createOwnerPortalJsonRoute('Unknown owner AI profile failure', async ({
    ownerUid,
    request,
  }) => generateOwnerAiProfileSuggestion(ownerUid, parseOwnerAiDraftBody(request.body)))
);

ownerPortalAiRoutes.post(
  '/owner-portal/ai/reviews/:reviewId/reply-draft',
  createOwnerPortalJsonRoute('Unknown owner AI review failure', async ({
    ownerUid,
    request,
  }) =>
    generateOwnerAiReviewReplyDraft(
      ownerUid,
      parseReviewIdParam(request.params.reviewId),
      parseOwnerAiDraftBody(request.body)
    )
  )
);
