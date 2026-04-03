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
  parseReviewPhotoUploadBody,
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
  StorefrontCommunityError,
  submitStorefrontAppReview,
  submitStorefrontReport,
  updateStorefrontAppReview,
} from '../services/storefrontCommunityService';
import {
  createReviewPhotoUploadSession,
  completeReviewPhotoUpload,
  discardReviewPhotoUpload,
  getReviewPhotoUploadSession,
} from '../services/reviewPhotoModerationService';
import { getStorefrontDetail } from '../storefrontService';

export const communityRoutes = Router();
const storefrontReportRateLimiter = createRateLimitMiddleware({
  name: 'storefront-report',
  windowMs: 60_000,
  max: 10,
  methods: ['POST'],
});
communityRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PUT', 'DELETE'],
  })
);

communityRoutes.post('/storefront-details/:storefrontId/reviews', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const body = parseReviewSubmissionBody(request.body);
  const { accountId } = await ensureProfileWriteAccess(request, body.profileId);

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
  const reviewInput = {
    ...input,
    photoUploadIds: body.photoUploadIds,
  };

  if (reviewInput.photoUploadIds.length && !accountId) {
    response.status(403).json({
      ok: false,
      error: 'Signed-in access is required to attach review photos.',
    });
    return;
  }

  let reviewSubmission: Awaited<ReturnType<typeof submitStorefrontAppReview>>;
  try {
    reviewSubmission = await submitStorefrontAppReview(reviewInput);
  } catch (error) {
    if (error instanceof StorefrontCommunityError) {
      response.status(error.statusCode).json({
        ok: false,
        error: error.message,
      });
      return;
    }

    throw error;
  }
  const review = reviewSubmission.review;
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
        photoCount: reviewSubmission.photoModeration?.submittedCount ?? review.photoCount,
      },
    }),
  ]);

  response.json({
    detail,
    rewardResult,
    photoModeration: reviewSubmission.photoModeration,
  });
});

communityRoutes.put('/storefront-details/:storefrontId/reviews/:reviewId', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const reviewId = parseReviewIdParam(request.params.reviewId);
  const body = parseReviewSubmissionBody(request.body);
  const { accountId } = await ensureProfileWriteAccess(request, body.profileId);

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
  const reviewInput = {
    ...input,
    reviewId,
    photoUploadIds: body.photoUploadIds,
  };

  if (reviewInput.photoUploadIds.length && !accountId) {
    response.status(403).json({
      ok: false,
      error: 'Signed-in access is required to attach review photos.',
    });
    return;
  }

  let reviewSubmission: Awaited<ReturnType<typeof updateStorefrontAppReview>>;
  try {
    reviewSubmission = await updateStorefrontAppReview(reviewInput);
  } catch (error) {
    if (error instanceof StorefrontCommunityError) {
      response.status(error.statusCode).json({
        ok: false,
        error: error.message,
      });
      return;
    }

    throw error;
  }

  invalidateCachedStorefrontDetail(storefrontId);
  const detail = await getStorefrontDetail(storefrontId);
  response.json({
    detail,
    rewardResult: null,
    photoModeration: reviewSubmission.photoModeration,
  });
});

communityRoutes.post('/storefront-details/:storefrontId/reviews/photo-uploads', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const body = parseReviewPhotoUploadBody(request.body);
  const { accountId } = await ensureProfileWriteAccess(request, body.profileId);

  if (!accountId) {
    response.status(403).json({
      ok: false,
      error: 'Signed-in access is required to upload review photos.',
    });
    return;
  }

  const uploadSession = await createReviewPhotoUploadSession({
    storefrontId,
    profileId: body.profileId,
    reviewId: body.reviewId ?? null,
    fileName: body.fileName,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
  });

  response.status(201).json({
    ok: true,
    uploadSession,
  });
});

communityRoutes.post(
  '/storefront-details/:storefrontId/reviews/photo-uploads/:photoId/complete',
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const photoId = request.params.photoId;
    const uploadSession = await getReviewPhotoUploadSession(photoId);

    if (!uploadSession) {
      response.status(404).json({
        ok: false,
        error: 'Review photo upload not found.',
      });
      return;
    }

    const { accountId } = await ensureProfileWriteAccess(request, uploadSession.profileId);
    if (!accountId) {
      response.status(403).json({
        ok: false,
        error: 'Signed-in access is required to complete review photo uploads.',
      });
      return;
    }

    if (uploadSession.storefrontId !== storefrontId) {
      response.status(400).json({
        ok: false,
        error: 'Review photo upload does not belong to this storefront.',
      });
      return;
    }

    const result = await completeReviewPhotoUpload(photoId);
    invalidateCachedStorefrontDetail(storefrontId);
    response.json({
      ok: true,
      ...result,
    });
  }
);

communityRoutes.delete(
  '/storefront-details/:storefrontId/reviews/photo-uploads/:photoId',
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const photoId = request.params.photoId;
    const uploadSession = await getReviewPhotoUploadSession(photoId);

    if (!uploadSession) {
      response.status(404).json({
        ok: false,
        error: 'Review photo upload not found.',
      });
      return;
    }

    const { accountId } = await ensureProfileWriteAccess(request, uploadSession.profileId);
    if (!accountId) {
      response.status(403).json({
        ok: false,
        error: 'Signed-in access is required to delete review photo uploads.',
      });
      return;
    }

    if (uploadSession.storefrontId !== storefrontId) {
      response.status(400).json({
        ok: false,
        error: 'Review photo upload does not belong to this storefront.',
      });
      return;
    }

    await discardReviewPhotoUpload(photoId);
    response.json({
      ok: true,
      photoId,
    });
  }
);

communityRoutes.post(
  '/storefront-details/:storefrontId/reports',
  storefrontReportRateLimiter,
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const body = parseReportSubmissionBody(request.body);

    const input: StorefrontReportSubmissionInput = {
      storefrontId,
      profileId: body.profileId,
      authorName: body.authorName || 'Canopy Trove user',
      reason: body.reason,
      description: body.description,
      reportTarget: body.reportTarget,
      reportedReviewId: body.reportedReviewId,
      reportedReviewAuthorProfileId: body.reportedReviewAuthorProfileId ?? null,
      reportedReviewAuthorName: body.reportedReviewAuthorName ?? null,
      reportedReviewExcerpt: body.reportedReviewExcerpt ?? null,
    };

    await ensureProfileWriteAccess(request, input.profileId);
    const report = await submitStorefrontReport(input);
    const rewardResult = await applyGamificationEvent(input.profileId, {
      activityType: 'report_submitted',
    });

    void notifyOwnersOfStorefrontActivity({
      storefrontId,
      title:
        input.reportTarget === 'review'
          ? 'New review report on your storefront'
          : 'New report on your storefront',
      body:
        input.reportTarget === 'review'
          ? `${input.authorName} flagged a review for ${input.reason}.`
          : `${input.authorName} flagged this storefront for ${input.reason}.`,
      data: {
        kind: 'owner_report',
        reportId: report.id,
      },
    });

    response.json({
      ok: true,
      rewardResult,
    });
  }
);

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
