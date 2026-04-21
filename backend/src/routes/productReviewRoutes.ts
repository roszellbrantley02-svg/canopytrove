/**
 * Product Review Routes
 *
 *   POST /products/:slug/reviews                — submit (member-auth required)
 *   GET  /products/:slug/reviews                — list + aggregate (public-read, gated in UI)
 *   POST /products/:slug/reviews/:id/helpful    — upvote (member-auth required)
 *   POST /products/:slug/reviews/:id/report     — flag (member-auth required)
 *   GET  /me/product-reviews                    — member's own reviews (auth required)
 *   GET  /products/community-favorites          — community top products (public-read)
 *
 * Reviews are gated in the UI — viewing lives only in Profile → My Products —
 * but the list endpoints stay HTTP-public so the app can prefetch without
 * extra auth round-trips. Submissions require a signed-in member account.
 */

import { Router } from 'express';
import { z } from 'zod';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { serverConfig } from '../config';
import { logger } from '../observability/logger';
import {
  ensureAuthenticatedProfileWriteAccess,
  ensureRealMemberWriteAccess,
  getProfileAccessErrorStatus,
} from '../services/profileAccessService';
import {
  PRODUCT_REVIEW_EFFECT_TAGS,
  ProductReviewError,
  clearProductReviewAggregateCache,
  getCommunityFavoriteProducts,
  getProductReviewAggregate,
  listProductReviews,
  listProductReviewsByProfile,
  markProductReviewHelpful,
  submitProductReview,
  submitProductReviewReport,
  type ProductReviewEffectTag,
} from '../services/productReviewService';
import { parseProductSlugParam } from '../services/productSlugService';
import { getSafePublicDisplayName } from '../http/publicIdentity';

export const productReviewRoutes = Router();

/* ── Rate limiters ──────────────────────────────────────────────────── */

productReviewRoutes.use(
  createRateLimitMiddleware({
    name: 'product-review-ip-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PUT', 'DELETE'],
  }),
);

const reviewWriteUserRateLimiter = createUserRateLimitMiddleware({
  name: 'product-review-write',
  windowMs: 60_000,
  max: 15,
});

const reportRateLimiter = createRateLimitMiddleware({
  name: 'product-review-report',
  windowMs: 60_000,
  max: 5,
  methods: ['POST'],
});

/* ── Schemas ────────────────────────────────────────────────────────── */

const EffectTagSchema = z.enum(
  PRODUCT_REVIEW_EFFECT_TAGS as unknown as [ProductReviewEffectTag, ...ProductReviewEffectTag[]],
);

const ReviewSubmissionSchema = z
  .object({
    profileId: z.string().min(1).max(200),
    brandName: z.string().min(1).max(120),
    productName: z.string().min(1).max(200),
    authorName: z.string().min(1).max(60),
    rating: z.number().int().min(1).max(5),
    text: z.string().min(10).max(2000),
    effectTags: z.array(EffectTagSchema).max(4).default([]),
    photoUploadIds: z.array(z.string().min(1).max(120)).max(4).default([]),
    photoCount: z.number().int().min(0).max(4).default(0),
  })
  .strict();

const ReportSchema = z
  .object({
    profileId: z.string().min(1).max(200),
    reason: z.string().min(1).max(60),
    description: z.string().max(600).default(''),
  })
  .strict();

const HelpfulSchema = z
  .object({
    profileId: z.string().min(1).max(200),
  })
  .strict();

/* ── Helpers ────────────────────────────────────────────────────────── */

function respondProfileAccessError(
  response: Parameters<typeof productReviewRoutes.get>[1] extends never ? never : any,
  error: unknown,
) {
  const status = getProfileAccessErrorStatus(error);
  response.status(status).json({
    ok: false,
    error: error instanceof Error ? error.message : 'Forbidden',
  });
}

function respondZodError(response: any, error: z.ZodError) {
  response.status(400).json({
    ok: false,
    error: 'Invalid request body',
    details: error.issues,
  });
}

/* ── Routes ─────────────────────────────────────────────────────────── */

productReviewRoutes.get('/products/community-favorites', async (request, response) => {
  try {
    const favorites = await getCommunityFavoriteProducts();
    response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    response.json({ ok: true, favorites });
  } catch (error) {
    logger.error('[productReview] community-favorites failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

productReviewRoutes.get('/me/product-reviews', async (request, response) => {
  const profileId = typeof request.query.profileId === 'string' ? request.query.profileId : '';
  if (!profileId) {
    response.status(400).json({ ok: false, error: 'profileId query parameter is required' });
    return;
  }
  try {
    const { accountId } = await ensureAuthenticatedProfileWriteAccess(request, profileId);
    const records = await listProductReviewsByProfile(profileId);
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({
      ok: true,
      reviews: records.map((record) => ({
        id: record.id,
        productSlug: record.productSlug,
        brandName: record.brandName,
        productName: record.productName,
        rating: record.rating,
        text: record.text,
        effectTags: record.effectTags,
        photoUrls: record.photoUrls ?? [],
        photoCount: record.photoIds.length,
        createdAt: record.createdAt,
      })),
      accountId,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ProfileAccessError') {
      respondProfileAccessError(response, error);
      return;
    }
    logger.error('[productReview] /me/product-reviews failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

productReviewRoutes.get('/products/:slug/reviews', async (request, response) => {
  const slug = parseProductSlugParam(request.params.slug);
  if (!slug) {
    response.status(400).json({ ok: false, error: 'Invalid product slug' });
    return;
  }
  const viewerProfileId =
    typeof request.query.viewerProfileId === 'string' ? request.query.viewerProfileId : null;
  try {
    const [reviews, aggregate] = await Promise.all([
      listProductReviews(slug, viewerProfileId),
      getProductReviewAggregate(slug),
    ]);
    response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    response.json({ ok: true, reviews, aggregate });
  } catch (error) {
    logger.error('[productReview] list failed', {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

productReviewRoutes.post(
  '/products/:slug/reviews',
  reviewWriteUserRateLimiter,
  async (request, response) => {
    const slug = parseProductSlugParam(request.params.slug);
    if (!slug) {
      response.status(400).json({ ok: false, error: 'Invalid product slug' });
      return;
    }

    let body: z.infer<typeof ReviewSubmissionSchema>;
    try {
      body = ReviewSubmissionSchema.parse(request.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        respondZodError(response, error);
        return;
      }
      throw error;
    }

    let accountId: string;
    try {
      const access = await ensureRealMemberWriteAccess(
        request,
        body.profileId,
        'You must be signed in with a real account to leave a product review.',
      );
      accountId = access.accountId;
    } catch (error) {
      respondProfileAccessError(response, error);
      return;
    }

    try {
      const result = await submitProductReview({
        productSlug: slug,
        brandName: body.brandName,
        productName: body.productName,
        profileId: body.profileId,
        accountId,
        authorName: getSafePublicDisplayName(body.authorName, 'Canopy Trove member'),
        rating: body.rating,
        text: body.text,
        effectTags: body.effectTags,
        photoCount: body.photoCount,
        photoUploadIds: body.photoUploadIds,
      });
      clearProductReviewAggregateCache();
      response.setHeader('Cache-Control', 'no-store');
      response.json({ ok: true, review: result.review, photoModeration: result.photoModeration });
      logger.info('[productReview] submitted', {
        reviewId: result.review.id,
        productSlug: slug,
      });
    } catch (error) {
      if (error instanceof ProductReviewError) {
        response.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      logger.error('[productReview] submit failed', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
);

productReviewRoutes.post(
  '/products/:slug/reviews/:reviewId/helpful',
  reviewWriteUserRateLimiter,
  async (request, response) => {
    const slug = parseProductSlugParam(request.params.slug);
    const reviewId = typeof request.params.reviewId === 'string' ? request.params.reviewId : '';
    if (!slug || !reviewId) {
      response.status(400).json({ ok: false, error: 'Invalid parameters' });
      return;
    }

    let body: z.infer<typeof HelpfulSchema>;
    try {
      body = HelpfulSchema.parse(request.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        respondZodError(response, error);
        return;
      }
      throw error;
    }

    try {
      await ensureRealMemberWriteAccess(
        request,
        body.profileId,
        'You must be signed in with a real account to mark a review helpful.',
      );
    } catch (error) {
      respondProfileAccessError(response, error);
      return;
    }

    try {
      const result = await markProductReviewHelpful(reviewId, body.profileId);
      response.setHeader('Cache-Control', 'no-store');
      response.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof ProductReviewError) {
        response.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      logger.error('[productReview] helpful failed', {
        reviewId,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
);

productReviewRoutes.post(
  '/products/:slug/reviews/:reviewId/report',
  reportRateLimiter,
  async (request, response) => {
    const slug = parseProductSlugParam(request.params.slug);
    const reviewId = typeof request.params.reviewId === 'string' ? request.params.reviewId : '';
    if (!slug || !reviewId) {
      response.status(400).json({ ok: false, error: 'Invalid parameters' });
      return;
    }

    let body: z.infer<typeof ReportSchema>;
    try {
      body = ReportSchema.parse(request.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        respondZodError(response, error);
        return;
      }
      throw error;
    }

    let accountId: string;
    try {
      const access = await ensureRealMemberWriteAccess(
        request,
        body.profileId,
        'You must be signed in with a real account to report a review.',
      );
      accountId = access.accountId;
    } catch (error) {
      respondProfileAccessError(response, error);
      return;
    }

    try {
      const report = await submitProductReviewReport({
        reviewId,
        productSlug: slug,
        reporterProfileId: body.profileId,
        reporterAccountId: accountId,
        reason: body.reason,
        description: body.description,
      });
      response.setHeader('Cache-Control', 'no-store');
      response.json({ ok: true, reportId: report.id });
    } catch (error) {
      if (error instanceof ProductReviewError) {
        response.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      logger.error('[productReview] report failed', {
        reviewId,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({ ok: false, error: 'Internal server error' });
    }
  },
);
