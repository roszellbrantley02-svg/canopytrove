import { Router, json } from 'express';
import { logger } from '../observability/logger';
import { parseStorefrontIdParam } from '../http/validation';
import { createRequestTimeoutMiddleware, disableRequestTimeout } from '../http/requestTimeout';
import { ensureProfileWriteAccess } from '../services/profileAccessService';
import {
  createReviewPhotoUploadSession,
  receiveReviewPhotoBytes,
  completeReviewPhotoUpload,
  ReviewPhotoModerationError,
} from '../services/reviewPhotoModerationService';

/**
 * Single-shot photo upload endpoint (JSON + base64).
 *
 * Combines session creation, byte storage, and moderation into ONE request.
 * The frontend sends a JSON body:
 *
 *   {
 *     "profileId": "...",
 *     "fileName": "photo.jpg",
 *     "contentType": "image/jpeg",
 *     "imageBase64": "<base64-encoded image bytes>"
 *   }
 *
 * Using JSON/base64 instead of raw binary avoids all the React Native fetch
 * issues with Blob bodies on iOS/Android. The ~33% base64 overhead is
 * acceptable because images are compressed client-side to ~300-500KB first.
 *
 * Must be mounted BEFORE the global express.json() so we can set a higher
 * body limit (12 MB for base64 overhead) without affecting other routes.
 */
export const photoUploadOneShotRoute = Router();

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// Dedicated JSON parser with a 12 MB limit for base64-encoded images.
// Base64 adds ~33% overhead: an 8 MB raw image becomes ~10.7 MB in base64,
// plus a few KB of JSON wrapper. 12 MB gives comfortable headroom up to the
// MAX_REVIEW_PHOTO_BYTES (8 MB raw) declared in reviewPhotoModerationService.
const photoJsonParser = json({ limit: '12mb' });

photoUploadOneShotRoute.post(
  '/storefront-details/:storefrontId/reviews/photo-uploads/one-shot',
  // Cancel the global 30s timeout and apply a generous 90s ceiling.
  // This route does upload + conversion + moderation in a single request.
  disableRequestTimeout(),
  createRequestTimeoutMiddleware(90_000),
  photoJsonParser,
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
      const fileName =
        typeof body.fileName === 'string' && body.fileName.trim()
          ? body.fileName.trim()
          : `photo-${Date.now().toString(36)}.jpg`;
      const contentType =
        typeof body.contentType === 'string' && ALLOWED_CONTENT_TYPES.has(body.contentType.trim())
          ? body.contentType.trim()
          : 'image/jpeg';
      const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';

      if (!profileId) {
        response.status(400).json({
          ok: false,
          error: 'Upload failed: profileId is required.',
        });
        return;
      }

      if (!imageBase64) {
        response.status(400).json({
          ok: false,
          error: 'Upload failed: imageBase64 is required.',
        });
        return;
      }

      // Verify auth — caller must own this profile.
      const { accountId } = await ensureProfileWriteAccess(request, profileId);
      if (!accountId) {
        response.status(403).json({
          ok: false,
          error: 'Sign-in required: a signed-in account is needed for photo uploads.',
        });
        return;
      }

      // Decode base64 → raw bytes.
      let imageBytes: Buffer;
      try {
        imageBytes = Buffer.from(imageBase64, 'base64');
      } catch {
        response.status(400).json({
          ok: false,
          error: 'Upload failed: imageBase64 is not valid base64.',
        });
        return;
      }

      if (imageBytes.length === 0) {
        response.status(400).json({
          ok: false,
          error: 'Upload failed: image data is empty.',
        });
        return;
      }

      const sizeBytes = imageBytes.length;

      // Step 1: Create upload session (force memory mode — bytes go straight in).
      const uploadSession = await createReviewPhotoUploadSession({
        storefrontId,
        profileId,
        fileName,
        contentType,
        sizeBytes,
        forceMemoryMode: true,
      });

      // Step 2: Receive bytes into the session.
      await receiveReviewPhotoBytes(uploadSession.id, imageBytes);

      // Step 3: Complete (moderation + approval).
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
        response.status(error.statusCode).json({
          ok: false,
          error: error.message,
        });
        return;
      }

      logger.error('[photo-upload-one-shot] Unexpected error', {
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        ok: false,
        error: 'Upload failed: an unexpected error occurred.',
      });
    }
  },
);
