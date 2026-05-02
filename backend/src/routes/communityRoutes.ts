import { Router } from 'express';
import { logger } from '../observability/logger';
import {
  StorefrontReportSubmissionInput,
  StorefrontReviewSubmissionInput,
} from '../../../src/types/storefront';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { getSafeErrorMessage } from '../http/errors';
import {
  parseHelpfulVoteBody,
  parseReportSubmissionBody,
  parseReviewPhotoUploadBody,
  parseReviewIdParam,
  parseReviewSubmissionBody,
  parseStorefrontIdParam,
} from '../http/validation';
import {
  clearStorefrontBackendCache,
  invalidateCachedStorefrontDetail,
} from '../services/storefrontCacheService';
import { applyGamificationEvent } from '../services/gamificationEventService';
import {
  ensureAuthenticatedProfileWriteAccess,
  ensureProfileWriteAccess,
  resolveVerifiedRequestIdentity,
} from '../services/profileAccessService';
import { notifyOwnersOfStorefrontActivity } from '../services/ownerPortalAlertService';
import {
  clearStorefrontAppReviewAggregateCache,
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
import { checkContentQuality } from '../http/contentQualityGuard';
import { checkCommunityVelocity } from '../http/communityVelocityGuard';
import { getSafePublicDisplayName } from '../http/publicIdentity';

export const communityRoutes = Router();
const storefrontReportRateLimiter = createRateLimitMiddleware({
  name: 'storefront-report',
  windowMs: 60_000,
  max: 5,
  methods: ['POST'],
});
communityRoutes.use(
  createRateLimitMiddleware({
    name: 'community-ip-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PUT', 'DELETE'],
  }),
);
const communityUserRateLimiter = createUserRateLimitMiddleware({
  name: 'community-write',
  windowMs: 60_000,
  max: 30,
});

communityRoutes.post(
  '/storefront-details/:storefrontId/reviews',
  communityUserRateLimiter,
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const body = parseReviewSubmissionBody(request.body);
    const { accountId } = await ensureProfileWriteAccess(request, body.profileId);

    // Reviews require a signed-in account.
    if (!accountId) {
      response.status(403).json({
        ok: false,
        error: 'You must be signed in to leave a review.',
      });
      return;
    }

    // Content quality check
    const qualityResult = checkContentQuality(body.text, {
      minLength: 10,
      maxUrls: 1,
      context: 'review',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
    });
    if (!qualityResult.pass) {
      response.status(422).json({
        ok: false,
        error:
          'Your review needs a bit more detail. Please write at least a couple sentences about your experience.',
      });
      return;
    }

    // Per-profile velocity check
    const velocityResult = checkCommunityVelocity(
      body.profileId,
      'review_submit',
      request.ip || 'unknown',
    );
    if (!velocityResult.allowed) {
      response.status(429).json({
        ok: false,
        error: velocityResult.reason,
      });
      return;
    }

    const input: StorefrontReviewSubmissionInput = {
      storefrontId,
      profileId: body.profileId,
      // accountId comes from the verified ID token (ensureProfileWriteAccess
      // above). The route already gates on accountId being present, so this
      // is always a real Firebase Auth uid for new submissions. Captured on
      // the review record so we can correlate reviews to accounts in
      // analytics, owner-side "verified user" badges, deal-digest signals,
      // and gamification — none of which were possible before this commit.
      authorAccountId: accountId,
      authorName: getSafePublicDisplayName(body.authorName, 'Canopy Trove member'),
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
        error: 'Sign-in required: a signed-in account is needed to attach review photos.',
      });
      return;
    }

    let reviewSubmission: Awaited<ReturnType<typeof submitStorefrontAppReview>>;
    try {
      reviewSubmission = await submitStorefrontAppReview(reviewInput);
    } catch (error) {
      if (error instanceof StorefrontCommunityError) {
        const requestId = response.getHeader('X-CanopyTrove-Request-Id');
        response.status(error.statusCode).json({
          ok: false,
          error: getSafeErrorMessage(
            error,
            error.statusCode,
            typeof requestId === 'string' ? requestId : null,
          ),
        });
        return;
      }

      throw error;
    }
    const review = reviewSubmission.review;
    clearStorefrontAppReviewAggregateCache();
    clearStorefrontBackendCache();
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

    // Detail refresh is a convenience — must not fail the primary write response.
    // Include viewer context so the caller gets a personalized payload (e.g. isOwnReview).
    let detail: Awaited<ReturnType<typeof getStorefrontDetail>> | null = null;
    try {
      detail = await getStorefrontDetail(storefrontId, {
        includeMemberDeals: true,
        viewerContext: { profileId: body.profileId },
        clientPlatform: 'web',
      });
    } catch (detailError) {
      logger.error('[community] post-write detail refresh failed for review_submitted', {
        error: detailError instanceof Error ? detailError.message : String(detailError),
      });
    }

    // Gamification is a side effect — must not fail the primary write response
    let rewardResult: Awaited<ReturnType<typeof applyGamificationEvent>> | null = null;
    try {
      rewardResult = await applyGamificationEvent(
        input.profileId,
        {
          activityType: 'review_submitted',
          payload: {
            rating: input.rating,
            textLength: input.text.length,
            photoCount: reviewSubmission.photoModeration?.submittedCount ?? review.photoCount,
          },
        },
        {
          clientIp: request.ip || 'unknown',
        },
      );
    } catch (gamificationError) {
      logger.error('[community] gamification side effect failed for review_submitted', {
        error:
          gamificationError instanceof Error
            ? gamificationError.message
            : String(gamificationError),
      });
    }

    response.json({
      detail,
      rewardResult,
      photoModeration: reviewSubmission.photoModeration,
    });
  },
);

communityRoutes.put(
  '/storefront-details/:storefrontId/reviews/:reviewId',
  communityUserRateLimiter,
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const reviewId = parseReviewIdParam(request.params.reviewId);
    const body = parseReviewSubmissionBody(request.body);
    const { accountId } = await ensureAuthenticatedProfileWriteAccess(
      request,
      body.profileId,
      'You must be signed in to update a review.',
    );

    // Content quality check on update
    const qualityResult = checkContentQuality(body.text, {
      minLength: 10,
      maxUrls: 1,
      context: 'review_update',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
    });
    if (!qualityResult.pass) {
      response.status(422).json({
        ok: false,
        error:
          'Your review needs a bit more detail. Please write at least a couple sentences about your experience.',
      });
      return;
    }

    const velocityResult = checkCommunityVelocity(
      body.profileId,
      'review_update',
      request.ip || 'unknown',
    );
    if (!velocityResult.allowed) {
      response.status(429).json({
        ok: false,
        error: velocityResult.reason,
      });
      return;
    }

    const input: StorefrontReviewSubmissionInput = {
      storefrontId,
      profileId: body.profileId,
      // Same accountId capture as the create-review route — the update
      // path also gates on a verified ID token, so accountId is always
      // a real Firebase Auth uid here.
      authorAccountId: accountId,
      authorName: getSafePublicDisplayName(body.authorName, 'Canopy Trove member'),
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
        error: 'Sign-in required: a signed-in account is needed to attach review photos.',
      });
      return;
    }

    let reviewSubmission: Awaited<ReturnType<typeof updateStorefrontAppReview>>;
    try {
      reviewSubmission = await updateStorefrontAppReview(reviewInput);
    } catch (error) {
      if (error instanceof StorefrontCommunityError) {
        const requestId = response.getHeader('X-CanopyTrove-Request-Id');
        response.status(error.statusCode).json({
          ok: false,
          error: getSafeErrorMessage(
            error,
            error.statusCode,
            typeof requestId === 'string' ? requestId : null,
          ),
        });
        return;
      }

      throw error;
    }

    clearStorefrontAppReviewAggregateCache();
    clearStorefrontBackendCache();
    invalidateCachedStorefrontDetail(storefrontId);

    // Detail refresh is a convenience — must not fail the primary write response
    let detail: Awaited<ReturnType<typeof getStorefrontDetail>> | null = null;
    try {
      detail = await getStorefrontDetail(storefrontId, {
        includeMemberDeals: true,
        viewerContext: { profileId: body.profileId },
        clientPlatform: 'web',
      });
    } catch (detailError) {
      logger.error('[community] post-write detail refresh failed for review_updated', {
        error: detailError instanceof Error ? detailError.message : String(detailError),
      });
    }

    response.json({
      detail,
      rewardResult: null,
      photoModeration: reviewSubmission.photoModeration,
    });
  },
);

communityRoutes.post(
  '/storefront-details/:storefrontId/reviews/photo-uploads',
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const body = parseReviewPhotoUploadBody(request.body);
    const { accountId } = await ensureProfileWriteAccess(request, body.profileId);

    if (!accountId) {
      response.status(403).json({
        ok: false,
        error: 'Sign-in required: a signed-in account is needed to upload review photos.',
      });
      return;
    }

    // Per-profile velocity check for photo uploads
    const velocityResult = checkCommunityVelocity(
      body.profileId,
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

    const uploadSession = await createReviewPhotoUploadSession({
      storefrontId,
      profileId: body.profileId,
      reviewId: body.reviewId ?? null,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      forceMemoryMode: body.forceMemoryMode ?? false,
    });

    response.status(201).json({
      ok: true,
      uploadSession,
    });
  },
);

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
        error: 'Sign-in required: a signed-in account is needed to complete photo uploads.',
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
  },
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
        error: 'Sign-in required: a signed-in account is needed to delete photo uploads.',
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
  },
);

communityRoutes.post(
  '/storefront-details/:storefrontId/reports',
  storefrontReportRateLimiter,
  communityUserRateLimiter,
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const body = parseReportSubmissionBody(request.body);

    const input: StorefrontReportSubmissionInput = {
      storefrontId,
      profileId: body.profileId,
      authorName: getSafePublicDisplayName(body.authorName, 'Canopy Trove user'),
      reason: body.reason,
      description: body.description,
      reportTarget: body.reportTarget,
      reportedReviewId: body.reportedReviewId,
      reportedReviewAuthorName: body.reportedReviewAuthorName
        ? getSafePublicDisplayName(body.reportedReviewAuthorName, 'Canopy Trove member')
        : null,
      reportedReviewExcerpt: body.reportedReviewExcerpt ?? null,
    };

    await ensureAuthenticatedProfileWriteAccess(
      request,
      input.profileId,
      'You must be signed in to report a storefront or review.',
    );

    // Per-profile velocity check for reports
    const velocityResult = checkCommunityVelocity(
      input.profileId,
      'report_submit',
      request.ip || 'unknown',
    );
    if (!velocityResult.allowed) {
      response.status(429).json({
        ok: false,
        error: velocityResult.reason,
      });
      return;
    }

    let report: Awaited<ReturnType<typeof submitStorefrontReport>>;
    try {
      report = await submitStorefrontReport(input);
    } catch (error) {
      if (error instanceof StorefrontCommunityError) {
        const requestId = response.getHeader('X-CanopyTrove-Request-Id');
        response.status(error.statusCode).json({
          ok: false,
          error: getSafeErrorMessage(
            error,
            error.statusCode,
            typeof requestId === 'string' ? requestId : null,
          ),
        });
        return;
      }

      throw error;
    }

    // Gamification is a side effect — must not fail the primary write response
    let rewardResult: Awaited<ReturnType<typeof applyGamificationEvent>> | null = null;
    try {
      rewardResult = await applyGamificationEvent(
        input.profileId,
        {
          activityType: 'report_submitted',
        },
        {
          clientIp: request.ip || 'unknown',
        },
      );
    } catch (gamificationError) {
      logger.error('[community] gamification side effect failed for report_submitted', {
        error:
          gamificationError instanceof Error
            ? gamificationError.message
            : String(gamificationError),
      });
    }

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
  },
);

communityRoutes.post(
  '/storefront-details/:storefrontId/reviews/:reviewId/helpful',
  async (request, response) => {
    const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
    const reviewId = parseReviewIdParam(request.params.reviewId);
    const body = parseHelpfulVoteBody(request.body);

    await ensureAuthenticatedProfileWriteAccess(
      request,
      body.profileId,
      'You must be signed in to mark a review as helpful.',
    );

    // Per-profile velocity check for helpful votes
    const velocityResult = checkCommunityVelocity(
      body.profileId,
      'helpful_vote',
      request.ip || 'unknown',
    );
    if (!velocityResult.allowed) {
      response.status(429).json({
        ok: false,
        error: velocityResult.reason,
      });
      return;
    }

    const helpfulResult = await markStorefrontAppReviewHelpful({
      storefrontId,
      reviewId,
      profileId: body.profileId,
    });

    invalidateCachedStorefrontDetail(storefrontId);

    // Gamification is a side effect — must not fail the primary write response
    if (
      helpfulResult.didApply &&
      helpfulResult.reviewAuthorProfileId &&
      helpfulResult.reviewAuthorProfileId !== body.profileId
    ) {
      try {
        await applyGamificationEvent(
          helpfulResult.reviewAuthorProfileId,
          {
            activityType: 'helpful_vote_received',
            payload: {
              count: 1,
            },
          },
          {
            clientIp: request.ip || 'unknown',
          },
        );
      } catch (gamificationError) {
        logger.error('[community] gamification side effect failed for helpful_vote_received', {
          error:
            gamificationError instanceof Error
              ? gamificationError.message
              : String(gamificationError),
        });
      }
    }

    // Detail refresh is a convenience — must not fail the primary write response
    let detail: Awaited<ReturnType<typeof getStorefrontDetail>> | null = null;
    try {
      detail = await getStorefrontDetail(storefrontId);
    } catch (detailError) {
      logger.error('[community] post-write detail refresh failed for helpful_vote', {
        error: detailError instanceof Error ? detailError.message : String(detailError),
      });
    }

    response.json({
      detail,
      didApply: helpfulResult.didApply,
    });
  },
);
