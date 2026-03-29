import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import {
  parseOwnerPortalAlertSyncBody,
  parseOwnerPortalProfileToolsBody,
  parseOwnerPortalPromotionBody,
  parseOwnerPortalPromotionIdParam,
  parseOwnerPortalReviewReplyBody,
  parseReviewIdParam,
} from '../http/validation';
import {
  getOwnerPortalAccessErrorStatus,
  ensureOwnerPortalAccess,
} from '../services/ownerPortalAccessService';
import { syncOwnerPortalAlerts } from '../services/ownerPortalAlertService';
import {
  createOwnerPortalPromotion,
  getOwnerPortalWorkspace,
  replyToOwnerPortalReview,
  saveOwnerPortalProfileTools,
  updateOwnerPortalPromotion,
} from '../services/ownerPortalWorkspaceService';

export const ownerPortalWorkspaceRoutes = Router();
ownerPortalWorkspaceRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PUT'],
  })
);

ownerPortalWorkspaceRoutes.get('/owner-portal/workspace', async (request, response) => {
  try {
    const { ownerUid } = await ensureOwnerPortalAccess(request);
    response.json(await getOwnerPortalWorkspace(ownerUid));
  } catch (error) {
    response.status(getOwnerPortalAccessErrorStatus(error)).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown owner workspace failure',
    });
  }
});

ownerPortalWorkspaceRoutes.put('/owner-portal/profile-tools', async (request, response) => {
  try {
    const { ownerUid } = await ensureOwnerPortalAccess(request);
    response.json(
      await saveOwnerPortalProfileTools(
        ownerUid,
        parseOwnerPortalProfileToolsBody(request.body)
      )
    );
  } catch (error) {
    response.status(getOwnerPortalAccessErrorStatus(error)).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown owner profile tools failure',
    });
  }
});

ownerPortalWorkspaceRoutes.post('/owner-portal/promotions', async (request, response) => {
  try {
    const { ownerUid } = await ensureOwnerPortalAccess(request);
    response.json(
      await createOwnerPortalPromotion(ownerUid, parseOwnerPortalPromotionBody(request.body))
    );
  } catch (error) {
    response.status(getOwnerPortalAccessErrorStatus(error)).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown owner promotion failure',
    });
  }
});

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/promotions/:promotionId',
  async (request, response) => {
    try {
      const { ownerUid } = await ensureOwnerPortalAccess(request);
      response.json(
        await updateOwnerPortalPromotion(
          ownerUid,
          parseOwnerPortalPromotionIdParam(request.params.promotionId),
          parseOwnerPortalPromotionBody(request.body)
        )
      );
    } catch (error) {
      response.status(getOwnerPortalAccessErrorStatus(error)).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown owner promotion update failure',
      });
    }
  }
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/reviews/:reviewId/reply',
  async (request, response) => {
    try {
      const { ownerUid } = await ensureOwnerPortalAccess(request);
      response.json(
        await replyToOwnerPortalReview(
          ownerUid,
          parseReviewIdParam(request.params.reviewId),
          parseOwnerPortalReviewReplyBody(request.body).text
        )
      );
    } catch (error) {
      response.status(getOwnerPortalAccessErrorStatus(error)).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown owner review reply failure',
      });
    }
  }
);

ownerPortalWorkspaceRoutes.post('/owner-portal/alerts/sync', async (request, response) => {
  try {
    const { ownerUid } = await ensureOwnerPortalAccess(request);
    response.json(
      await syncOwnerPortalAlerts({
        ownerUid,
        ...parseOwnerPortalAlertSyncBody(request.body),
      })
    );
  } catch (error) {
    response.status(getOwnerPortalAccessErrorStatus(error)).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown owner alert sync failure',
    });
  }
});
