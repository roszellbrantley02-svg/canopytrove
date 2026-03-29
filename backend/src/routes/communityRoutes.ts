import { Router } from 'express';
import {
  StorefrontReportSubmissionInput,
  StorefrontReviewSubmissionInput,
} from '../../../src/types/storefront';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import {
  parseHelpfulVoteBody,
  parseReportSubmissionBody,
  parseReviewIdParam,
  parseReviewSubmissionBody,
  parseStorefrontIdParam,
} from '../http/validation';
import { invalidateCachedStorefrontDetail } from '../services/storefrontCacheService';
import { applyGamificationEvent } from '../services/gamificationEventService';
import { ensureProfileWriteAccess } from '../services/profileAccessService';
import { notifyOwnersOfStorefrontActivity } from '../services/ownerPortalAlertService';
import {
  markStorefrontAppReviewHelpful,
  submitStorefrontAppReview,
  submitStorefrontReport,
} from '../services/storefrontCommunityService';
import { getStorefrontDetail } from '../storefrontService';

export const communityRoutes = Router();
communityRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  })
);

communityRoutes.post('/storefront-details/:storefrontId/reviews', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const body = parseReviewSubmissionBody(request.body);

  const input: StorefrontReviewSubmissionInput = {
    storefrontId,
    profileId: body.profileId,
      authorName: body.authorName || 'Canopy Trove user',
    rating: body.rating,
    text: body.text,
    gifUrl: body.gifUrl,
    tags: body.tags,
    photoCount: body.photoCount,
  };

  await ensureProfileWriteAccess(request, input.profileId);
  const review = await submitStorefrontAppReview(input);
  invalidateCachedStorefrontDetail(storefrontId);

  void notifyOwnersOfStorefrontActivity({
    storefrontId,
    title: 'New review on your storefront',
    body: `${review.authorName} left a ${review.rating.toFixed(1)} star review.`,
    data: {
      kind: 'owner_review',
      reviewId: review.id,
    },
  });

  const [detail, rewardResult] = await Promise.all([
    getStorefrontDetail(storefrontId),
    applyGamificationEvent(input.profileId, {
      activityType: 'review_submitted',
      payload: {
        rating: input.rating,
        textLength: input.text.length,
        photoCount: input.photoCount,
      },
    }),
  ]);

  response.json({
    detail,
    rewardResult,
  });
});

communityRoutes.post('/storefront-details/:storefrontId/reports', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const body = parseReportSubmissionBody(request.body);

  const input: StorefrontReportSubmissionInput = {
    storefrontId,
    profileId: body.profileId,
      authorName: body.authorName || 'Canopy Trove user',
    reason: body.reason,
    description: body.description,
  };

  await ensureProfileWriteAccess(request, input.profileId);
  const report = await submitStorefrontReport(input);
  const rewardResult = await applyGamificationEvent(input.profileId, {
    activityType: 'report_submitted',
  });

  void notifyOwnersOfStorefrontActivity({
    storefrontId,
    title: 'New report on your storefront',
    body: `${input.authorName} flagged this storefront for ${input.reason}.`,
    data: {
      kind: 'owner_report',
      reportId: report.id,
    },
  });

  response.json({
    ok: true,
    rewardResult,
  });
});

communityRoutes.post('/storefront-details/:storefrontId/reviews/:reviewId/helpful', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const reviewId = parseReviewIdParam(request.params.reviewId);
  const body = parseHelpfulVoteBody(request.body);

  await ensureProfileWriteAccess(request, body.profileId);
  const helpfulResult = await markStorefrontAppReviewHelpful({
    storefrontId,
    reviewId,
    profileId: body.profileId,
  });

  invalidateCachedStorefrontDetail(storefrontId);

  if (
    helpfulResult.didApply &&
    helpfulResult.reviewAuthorProfileId &&
    helpfulResult.reviewAuthorProfileId !== body.profileId
  ) {
    await applyGamificationEvent(helpfulResult.reviewAuthorProfileId, {
      activityType: 'helpful_vote_received',
      payload: {
        count: 1,
      },
    });
  }

  response.json({
    detail: await getStorefrontDetail(storefrontId),
    didApply: helpfulResult.didApply,
    reviewAuthorProfileId: helpfulResult.reviewAuthorProfileId,
  });
});
