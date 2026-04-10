import { Router, raw } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseStorefrontIdParam } from '../http/validation';
import { ensureProfileWriteAccess } from '../services/profileAccessService';
import {
  getReviewPhotoUploadSession,
  receiveReviewPhotoBytes,
  ReviewPhotoModerationError,
} from '../services/reviewPhotoModerationService';

/**
 * Handles direct binary uploads for memory-mode photo upload sessions.
 *
 * This route must be mounted BEFORE express.json() and the content-type
 * enforcement middleware because the request body is raw image bytes
 * (e.g. image/jpeg), not JSON.
 */
export const photoUploadBytesRoute = Router();
const photoUploadRateLimiter = createRateLimitMiddleware({
  name: 'review-photo-upload-bytes',
  windowMs: 60_000,
  max: 24,
  methods: ['PUT'],
});

// Accept raw image bodies up to 12 MB (matches MAX_REVIEW_PHOTO_BYTES).
const rawImageParser = raw({
  type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  limit: '12mb',
});

photoUploadBytesRoute.put(
  '/storefront-details/:storefrontId/reviews/photo-uploads/:photoId/bytes',
  photoUploadRateLimiter,
  rawImageParser,
  async (request, response) => {
    try {
      const storefrontParam = Array.isArray(request.params.storefrontId)
        ? request.params.storefrontId[0]
        : request.params.storefrontId;
      const photoParam = Array.isArray(request.params.photoId)
        ? request.params.photoId[0]
        : request.params.photoId;
      const storefrontId = parseStorefrontIdParam(storefrontParam);
      const photoId = photoParam;
      if (!photoId) {
        response.status(400).json({
          ok: false,
          error: 'Upload failed: missing photo upload identifier.',
        });
        return;
      }
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
          error: 'Sign-in required: a signed-in account is needed for photo uploads.',
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

      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        response.status(400).json({
          ok: false,
          error: 'Upload failed: request body must contain the photo file bytes.',
        });
        return;
      }

      const result = await receiveReviewPhotoBytes(photoId, request.body);
      response.json(result);
    } catch (error) {
      if (error instanceof ReviewPhotoModerationError) {
        response.status(error.statusCode).json({
          ok: false,
          error: error.message,
        });
        return;
      }

      response.status(500).json({
        ok: false,
        error: 'Upload failed: an unexpected error occurred.',
      });
    }
  },
);
