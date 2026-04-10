import { Platform } from 'react-native';
import { requestJson, requestRawUpload } from './storefrontBackendHttp';

export const MAX_REVIEW_PHOTOS = 4;

export type ReviewPhotoUploadFile = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  webFile?: Blob | File | null;
};

export type ReviewPhotoUploadResult = {
  photoUploadId: string;
  moderationStatus:
    | 'pending_upload'
    | 'processing'
    | 'approved'
    | 'rejected'
    | 'needs_manual_review'
    | 'failed';
  moderationDecision: 'approved' | 'rejected' | 'needs_manual_review' | null;
  moderationReason: string | null;
  publicUrl: string | null;
};

type OneShotUploadResponse = {
  ok: boolean;
  session: {
    id: string;
    moderationStatus:
      | 'pending_upload'
      | 'processing'
      | 'approved'
      | 'rejected'
      | 'needs_manual_review'
      | 'failed';
    moderationDecision: 'approved' | 'rejected' | 'needs_manual_review' | null;
    moderationReason: string | null;
  };
  publicUrl: string | null;
};

type ReviewPhotoUploadSessionResponse = {
  ok: boolean;
  uploadSession: {
    id: string;
    moderationStatus:
      | 'pending_upload'
      | 'processing'
      | 'approved'
      | 'rejected'
      | 'needs_manual_review'
      | 'failed';
    moderationDecision: 'approved' | 'rejected' | 'needs_manual_review' | null;
    moderationReason: string | null;
    contentType: string;
    sizeBytes: number;
    uploadMode: 'signed_url' | 'memory';
    uploadUrl: string | null;
    uploadExpiresAt: string | null;
    maximumBytes: number;
  };
};

type ReviewPhotoUploadCompleteResponse = {
  ok: boolean;
  session: {
    id: string;
    moderationStatus:
      | 'pending_upload'
      | 'processing'
      | 'approved'
      | 'rejected'
      | 'needs_manual_review'
      | 'failed';
    moderationDecision: 'approved' | 'rejected' | 'needs_manual_review' | null;
    moderationReason: string | null;
  };
  publicUrl: string | null;
};

export function getReviewPhotoUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';

  if (
    message.includes('Could not refresh the signed-in Canopy Trove session.') ||
    message.includes('Invalid authentication token.') ||
    message.includes('Sign-in required:')
  ) {
    return 'Your session expired. Sign out and sign back in, then retry the photo upload.';
  }

  if (message.includes('This profile belongs to a different account.')) {
    return 'This browser profile is linked to a different account. Sign out, sign back in, and retry the photo upload.';
  }

  if (
    message.includes('Failed to fetch') ||
    message.includes('Network request failed') ||
    message.includes('Load failed')
  ) {
    return 'Photo upload could not reach the API. If you are on canopy-trove.web.app, switch to canopytrove-webapp.web.app or app.canopytrove.com and retry.';
  }

  if (message.includes('Request already in progress:')) {
    return 'Photo upload is already in progress. Wait a moment, then retry.';
  }

  if (message.includes('413')) {
    return 'This photo is too large to upload. Try a smaller image.';
  }

  return message || 'Upload failed: unable to upload this photo.';
}

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function getFileExtension(file: ReviewPhotoUploadFile) {
  const fileName = file.name.trim();
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex >= 0 && lastDotIndex < fileName.length - 1) {
    return `.${sanitizeFileSegment(fileName.slice(lastDotIndex + 1).toLowerCase())}`;
  }

  if (file.mimeType?.startsWith('image/png')) {
    return '.png';
  }

  if (file.mimeType?.startsWith('image/webp')) {
    return '.webp';
  }

  if (file.mimeType?.startsWith('image/heic') || file.mimeType?.startsWith('image/heif')) {
    return '.heic';
  }

  return '.jpg';
}

/**
 * Read a local file URI and return its contents as a base64 string.
 *
 * Works on every platform:
 *   - Web: fetch → blob → FileReader.readAsDataURL
 *   - iOS/Android: same fetch → blob → FileReader path (React Native
 *     polyfills FileReader and it handles local file:// URIs correctly)
 *
 * This avoids the unreliable Blob-as-fetch-body path that causes
 * "Load failed" on iOS/WebKit.
 */
async function readFileAsBase64(file: ReviewPhotoUploadFile): Promise<string> {
  const blob = await readFileAsBlob(file);
  if (!blob.size) {
    throw new Error('Upload failed: selected photo is empty.');
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
      } else {
        reject(new Error('Upload failed: could not encode the photo.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Upload failed: could not read the photo file.'));
    };
    reader.readAsDataURL(blob);
  });
}

async function readFileAsBlob(file: ReviewPhotoUploadFile): Promise<Blob> {
  if (file.webFile) {
    return file.webFile;
  }

  const response = await fetch(file.uri);
  if (!response.ok) {
    throw new Error('Upload failed: unable to read the selected photo.');
  }

  return response.blob();
}

async function uploadPendingReviewPhotoWeb(input: {
  storefrontId: string;
  profileId: string;
  file: ReviewPhotoUploadFile;
}) {
  const blob = await readFileAsBlob(input.file);
  if (!blob.size) {
    throw new Error('Upload failed: selected photo is empty.');
  }

  const extension = getFileExtension(input.file);
  const fileName = sanitizeFileSegment(
    input.file.name.trim() || `review-photo-${Date.now().toString(36)}${extension}`,
  );
  const contentType = (input.file.mimeType ?? blob.type) || 'image/jpeg';

  const created = await requestJson<ReviewPhotoUploadSessionResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: input.profileId,
        fileName,
        contentType,
        sizeBytes: blob.size,
        forceMemoryMode: true,
      }),
    },
  );

  const uploadSession = created.uploadSession;

  if (uploadSession.uploadMode === 'memory') {
    await requestRawUpload(
      `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads/${encodeURIComponent(uploadSession.id)}/bytes`,
      blob,
      {
        method: 'PUT',
        contentType,
        timeoutMs: 120_000,
      },
    );
  } else if (uploadSession.uploadMode === 'signed_url' && uploadSession.uploadUrl) {
    const signedUploadResponse = await fetch(uploadSession.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (!signedUploadResponse.ok) {
      throw new Error(`Upload failed with ${signedUploadResponse.status}`);
    }
  } else {
    throw new Error('Upload failed: the photo upload session was incomplete.');
  }

  const completed = await requestJson<ReviewPhotoUploadCompleteResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads/${encodeURIComponent(uploadSession.id)}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
    {
      timeoutMs: 120_000,
    },
  );

  return {
    photoUploadId: completed.session.id,
    moderationStatus: completed.session.moderationStatus,
    moderationDecision: completed.session.moderationDecision,
    moderationReason: completed.session.moderationReason,
    publicUrl: completed.publicUrl,
  } satisfies ReviewPhotoUploadResult;
}

/**
 * Upload a review photo in a single JSON request (one-shot).
 *
 * Sends the image as base64 inside a plain JSON POST to the backend's
 * one-shot endpoint which handles session creation, storage, and moderation
 * all at once — no signed URLs or multi-step handshake required.
 *
 * Why this approach:
 * - Avoids GCS signed URLs entirely (no signBlob IAM permission needed)
 * - No CORS config needed on the storage bucket
 * - Single request = fewer failure points
 * - Using JSON/base64 instead of raw Blob bodies avoids the React Native
 *   fetch issues on iOS/Android that cause "Load failed" errors
 * - The ~33% base64 overhead is acceptable because images are compressed
 *   client-side to ~300-500 KB first (base64 → ~400-670 KB, well within limits)
 */
export async function uploadPendingReviewPhoto(input: {
  storefrontId: string;
  profileId: string;
  file: ReviewPhotoUploadFile;
}) {
  if (Platform.OS === 'web') {
    try {
      return await uploadPendingReviewPhotoWeb(input);
    } catch (error) {
      throw new Error(getReviewPhotoUploadErrorMessage(error));
    }
  }

  const imageBase64 = await readFileAsBase64(input.file);

  const extension = getFileExtension(input.file);
  const fileName = sanitizeFileSegment(
    input.file.name.trim() || `review-photo-${Date.now().toString(36)}${extension}`,
  );
  const contentType = input.file.mimeType ?? 'image/jpeg';

  let result: OneShotUploadResponse;
  try {
    result = await requestJson<OneShotUploadResponse>(
      `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads/one-shot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: input.profileId,
          fileName,
          contentType,
          imageBase64,
        }),
      },
      {
        // Give the upload + moderation plenty of time (2 minutes).
        timeoutMs: 120_000,
      },
    );
  } catch (error) {
    throw new Error(getReviewPhotoUploadErrorMessage(error));
  }

  return {
    photoUploadId: result.session.id,
    moderationStatus: result.session.moderationStatus,
    moderationDecision: result.session.moderationDecision,
    moderationReason: result.session.moderationReason,
    publicUrl: result.publicUrl,
  } satisfies ReviewPhotoUploadResult;
}

export async function discardPendingReviewPhoto(input: {
  storefrontId: string;
  photoUploadId: string;
}) {
  try {
    await requestJson<{
      ok: boolean;
    }>(
      `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads/${encodeURIComponent(input.photoUploadId)}`,
      {
        method: 'DELETE',
      },
    );
  } catch {
    // Draft cleanup is best-effort only.
  }
}
