import { requestJson } from './storefrontBackendHttp';

export const MAX_REVIEW_PHOTOS = 4;

export type ReviewPhotoUploadFile = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
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

type ReviewPhotoUploadSessionResponse = {
  id: string;
  contentType: string;
  sizeBytes: number;
  uploadMode: 'signed_url' | 'memory';
  uploadUrl: string | null;
};

type ReviewPhotoCreateResponse = {
  ok: boolean;
  uploadSession: ReviewPhotoUploadSessionResponse;
};

type ReviewPhotoCompleteResponse = {
  ok: boolean;
  publicUrl: string | null;
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
};

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

  return '.jpg';
}

async function createBlobFromUri(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected photo.');
  }

  return response.blob();
}

function requestStorefrontBackendJson<T>(
  pathname: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
) {
  const body =
    init && Object.prototype.hasOwnProperty.call(init, 'body')
      ? JSON.stringify(init.body)
      : undefined;
  const headers = new Headers(init?.headers);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  return requestJson<T>(pathname, {
    ...init,
    headers: body === undefined ? init?.headers : headers,
    body,
  });
}

export async function uploadPendingReviewPhoto(input: {
  storefrontId: string;
  profileId: string;
  file: ReviewPhotoUploadFile;
}) {
  const normalizedSize = typeof input.file.size === 'number' ? Math.floor(input.file.size) : null;
  if (!normalizedSize || normalizedSize <= 0) {
    throw new Error('Review photos need a valid file size before upload.');
  }

  const extension = getFileExtension(input.file);
  const fileName = sanitizeFileSegment(
    input.file.name.trim() || `review-photo-${Date.now().toString(36)}${extension}`,
  );

  const created = await requestStorefrontBackendJson<ReviewPhotoCreateResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads`,
    {
      method: 'POST',
      body: {
        profileId: input.profileId,
        fileName,
        contentType: input.file.mimeType ?? 'image/jpeg',
        sizeBytes: normalizedSize,
      },
    },
  );

  const uploadSession = created.uploadSession;
  if (!uploadSession.uploadUrl) {
    throw new Error('Review photo uploads are not available in this environment.');
  }

  const blob = await createBlobFromUri(input.file.uri);
  const uploadResponse = await fetch(uploadSession.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': uploadSession.contentType,
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('The selected photo could not be uploaded to the moderation queue.');
  }

  const completed = await requestStorefrontBackendJson<ReviewPhotoCompleteResponse>(
    `/storefront-details/${encodeURIComponent(input.storefrontId)}/reviews/photo-uploads/${encodeURIComponent(uploadSession.id)}/complete`,
    {
      method: 'POST',
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

export async function discardPendingReviewPhoto(input: {
  storefrontId: string;
  photoUploadId: string;
}) {
  try {
    await requestStorefrontBackendJson<{
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
