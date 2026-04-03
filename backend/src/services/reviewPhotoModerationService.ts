import { randomUUID } from 'node:crypto';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { serverConfig } from '../config';
import { getBackendFirebaseStorage } from '../firebase';

export type ReviewPhotoModerationStatus =
  | 'pending_upload'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'needs_manual_review'
  | 'failed';

export type ReviewPhotoModerationDecision = 'approved' | 'rejected' | 'needs_manual_review';

export type ReviewPhotoUploadSession = {
  id: string;
  storefrontId: string;
  profileId: string;
  reviewId: string | null;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  pendingStoragePath: string;
  approvedStoragePath: string;
  moderationStatus: ReviewPhotoModerationStatus;
  moderationDecision: ReviewPhotoModerationDecision | null;
  moderationModel: string | null;
  moderationReason: string | null;
  moderationCategories: string[];
  moderationScore: number | null;
  uploadMode: 'signed_url' | 'memory';
  uploadUrl: string | null;
  uploadExpiresAt: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
  attachedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewPhotoUploadSessionResponse = ReviewPhotoUploadSession & {
  maximumBytes: number;
};

export type ReviewPhotoModerationQueueItem = ReviewPhotoUploadSession & {
  publicUrl: string | null;
  previewUrl: string | null;
};

export type ReviewPhotoAttachmentSummary = {
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  message: string | null;
};

export type ReviewPhotoAttachmentResult = {
  photoIds: string[];
  photoUrls: string[];
  moderationSummary: ReviewPhotoAttachmentSummary;
};

const REVIEW_PHOTOS_COLLECTION = 'storefront_review_photos';
const MAX_REVIEW_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_REVIEW_PHOTOS_PER_REVIEW = 4;
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const APPROVED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type StoredReviewPhotoUploadSession = ReviewPhotoUploadSession;

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAiModerationResult = {
  decision: ReviewPhotoModerationDecision;
  reason: string;
  categories: string[];
  score: number | null;
};

const reviewPhotoUploadStore = new Map<string, StoredReviewPhotoUploadSession>();
const reviewPhotoBytesStore = new Map<string, Buffer>();
let reviewPhotoModerationFetch: typeof fetch = fetch;

export class ReviewPhotoModerationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

function getReviewPhotoCollection() {
  return getOptionalFirestoreCollection<StoredReviewPhotoUploadSession>(REVIEW_PHOTOS_COLLECTION);
}

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function getNowIso() {
  return new Date().toISOString();
}

function normalizeTrimmedString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeContentType(value: unknown) {
  return typeof value === 'string' && ALLOWED_CONTENT_TYPES.has(value.trim())
    ? value.trim()
    : null;
}

function normalizeSizeBytes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function normalizeStatus(value: unknown): ReviewPhotoModerationStatus {
  if (
    value === 'pending_upload' ||
    value === 'processing' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'needs_manual_review' ||
    value === 'failed'
  ) {
    return value;
  }

  return 'pending_upload';
}

function normalizeDecision(value: unknown): ReviewPhotoModerationDecision | null {
  if (value === 'approved' || value === 'rejected' || value === 'needs_manual_review') {
    return value;
  }

  return null;
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim())
    )
  ).slice(0, 12);
}

function normalizeScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeStoredRecord(record: Partial<StoredReviewPhotoUploadSession>): StoredReviewPhotoUploadSession {
  const createdAt = normalizeTrimmedString(record.createdAt, getNowIso());
  const updatedAt = normalizeTrimmedString(record.updatedAt, getNowIso());

  return {
    id: normalizeTrimmedString(record.id) || createId('review-photo'),
    storefrontId: normalizeTrimmedString(record.storefrontId),
    profileId: normalizeTrimmedString(record.profileId),
    reviewId: record.reviewId === null ? null : normalizeTrimmedString(record.reviewId) || null,
    originalFileName: normalizeTrimmedString(record.originalFileName, 'review-photo'),
    contentType: normalizeContentType(record.contentType) ?? 'image/jpeg',
    sizeBytes: Math.max(0, Math.floor(normalizeSizeBytes(record.sizeBytes) ?? 0)),
    pendingStoragePath: normalizeTrimmedString(record.pendingStoragePath),
    approvedStoragePath: normalizeTrimmedString(record.approvedStoragePath),
    moderationStatus: normalizeStatus(record.moderationStatus),
    moderationDecision: normalizeDecision(record.moderationDecision),
    moderationModel: record.moderationModel === null ? null : normalizeTrimmedString(record.moderationModel) || null,
    moderationReason:
      record.moderationReason === null ? null : normalizeTrimmedString(record.moderationReason) || null,
    moderationCategories: normalizeCategories(record.moderationCategories),
    moderationScore: normalizeScore(record.moderationScore),
    uploadMode: record.uploadMode === 'memory' ? 'memory' : 'signed_url',
    uploadUrl: record.uploadUrl === null ? null : normalizeTrimmedString(record.uploadUrl) || null,
    uploadExpiresAt:
      record.uploadExpiresAt === null ? null : normalizeTrimmedString(record.uploadExpiresAt) || null,
    approvedAt: record.approvedAt === null ? null : normalizeTrimmedString(record.approvedAt) || null,
    reviewedAt: record.reviewedAt === null ? null : normalizeTrimmedString(record.reviewedAt) || null,
    attachedAt: record.attachedAt === null ? null : normalizeTrimmedString(record.attachedAt) || null,
    deletedAt: record.deletedAt === null ? null : normalizeTrimmedString(record.deletedAt) || null,
    createdAt,
    updatedAt,
  };
}

function getBucket() {
  return getBackendFirebaseStorage()?.bucket() ?? null;
}

function buildPendingStoragePath(input: {
  storefrontId: string;
  profileId: string;
  photoId: string;
  fileName: string;
}) {
  return [
    'community-review-media',
    'pending',
    input.profileId,
    input.storefrontId,
    input.photoId,
    input.fileName,
  ].join('/');
}

function buildApprovedStoragePath(input: {
  storefrontId: string;
  reviewId: string;
  photoId: string;
  fileName: string;
}) {
  return ['community-review-media', 'approved', input.storefrontId, input.reviewId, input.photoId, input.fileName].join('/');
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'review-photo';
}

function isEligibleForAutoModeration(contentType: string, sizeBytes: number) {
  return ALLOWED_CONTENT_TYPES.has(contentType) && sizeBytes > 0 && sizeBytes <= MAX_REVIEW_PHOTO_BYTES;
}

function buildModerationFallbackReason() {
  return 'Automatic moderation is unavailable. This photo must be reviewed manually before it can be published.';
}

function buildAttachmentMessage(summary: {
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
}) {
  if (summary.pendingCount > 0 && summary.approvedCount > 0) {
    return `${summary.approvedCount} photo${summary.approvedCount === 1 ? '' : 's'} cleared automatically. ${summary.pendingCount} photo${summary.pendingCount === 1 ? '' : 's'} will stay hidden until manual review finishes.`;
  }

  if (summary.pendingCount > 0) {
    return `${summary.pendingCount} photo${summary.pendingCount === 1 ? '' : 's'} will stay hidden until manual review finishes.`;
  }

  if (summary.approvedCount > 0 && summary.approvedCount === summary.submittedCount) {
    return 'Attached photos passed strict moderation and are now visible with this review.';
  }

  if (summary.rejectedCount > 0) {
    return `${summary.rejectedCount} photo${summary.rejectedCount === 1 ? '' : 's'} could not be published.`;
  }

  return null;
}

function getOpenAiModerationConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || serverConfig.openAiApiKey;
  const model = process.env.OPENAI_MODEL?.trim() || serverConfig.openAiModel;

  return {
    apiKey: apiKey ?? null,
    model: model ?? 'gpt-4o-mini',
  };
}

async function getStoredPhotoRecord(photoId: string) {
  const collectionRef = getReviewPhotoCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(photoId).get();
    if (!snapshot.exists) {
      return null;
    }

    return normalizeStoredRecord(snapshot.data() as Partial<StoredReviewPhotoUploadSession>);
  }

  return reviewPhotoUploadStore.get(photoId) ?? null;
}

async function saveStoredPhotoRecord(record: StoredReviewPhotoUploadSession) {
  const normalized = normalizeStoredRecord(record);
  const collectionRef = getReviewPhotoCollection();
  if (collectionRef) {
    await collectionRef.doc(normalized.id).set(normalized);
  } else {
    reviewPhotoUploadStore.set(normalized.id, normalized);
  }

  return normalized;
}

async function deleteStoredPhotoRecord(photoId: string) {
  const collectionRef = getReviewPhotoCollection();
  if (collectionRef) {
    await collectionRef.doc(photoId).delete();
  }

  reviewPhotoUploadStore.delete(photoId);
  reviewPhotoBytesStore.delete(photoId);
}

async function getPhotoDownloadBytes(photo: StoredReviewPhotoUploadSession) {
  const bucket = getBucket();
  if (bucket) {
    const file = bucket.file(photo.pendingStoragePath);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }

    const [buffer] = await file.download();
    return buffer;
  }

  return reviewPhotoBytesStore.get(photo.id) ?? null;
}

async function uploadPhotoToApprovedPath(photo: StoredReviewPhotoUploadSession, reviewId: string) {
  const bucket = getBucket();
  if (!bucket) {
    return null;
  }

  const approvedPath = buildApprovedStoragePath({
    storefrontId: photo.storefrontId,
    reviewId,
    photoId: photo.id,
    fileName: photo.originalFileName,
  });
  const pendingFile = bucket.file(photo.pendingStoragePath);
  const approvedFile = bucket.file(approvedPath);
  await pendingFile.copy(approvedFile);
  await pendingFile.delete({ ignoreNotFound: true }).catch(() => undefined);
  return approvedPath;
}

async function moveApprovedPhotoToReviewPath(
  photo: StoredReviewPhotoUploadSession,
  reviewId: string
) {
  const nextApprovedPath = buildApprovedStoragePath({
    storefrontId: photo.storefrontId,
    reviewId,
    photoId: photo.id,
    fileName: photo.originalFileName,
  });

  if (photo.approvedStoragePath === nextApprovedPath) {
    return nextApprovedPath;
  }

  const bucket = getBucket();
  if (!bucket) {
    return nextApprovedPath;
  }

  const sourceFile = bucket.file(photo.approvedStoragePath);
  const [exists] = await sourceFile.exists();
  if (!exists) {
    return photo.approvedStoragePath;
  }

  const targetFile = bucket.file(nextApprovedPath);
  await sourceFile.copy(targetFile);
  await sourceFile.delete({ ignoreNotFound: true }).catch(() => undefined);
  return nextApprovedPath;
}

async function deletePhotoStorage(photo: StoredReviewPhotoUploadSession) {
  const bucket = getBucket();
  if (!bucket) {
    reviewPhotoBytesStore.delete(photo.id);
    return;
  }

  await Promise.allSettled([
    bucket.file(photo.pendingStoragePath).delete({ ignoreNotFound: true }),
    bucket.file(photo.approvedStoragePath).delete({ ignoreNotFound: true }),
  ]);
}

async function createSignedUploadUrl(photo: StoredReviewPhotoUploadSession) {
  const bucket = getBucket();
  if (!bucket) {
    return null;
  }

  const [uploadUrl] = await bucket.file(photo.pendingStoragePath).getSignedUrl({
    action: 'write',
    version: 'v4',
    expires: Date.now() + UPLOAD_URL_TTL_MS,
    contentType: photo.contentType,
  });

  return uploadUrl;
}

async function createSignedReadUrl(storagePath: string) {
  const bucket = getBucket();
  if (!bucket) {
    return null;
  }

  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    version: 'v4',
    expires: Date.now() + APPROVED_URL_TTL_MS,
  });

  return downloadUrl;
}

async function promoteUploadedPhoto(
  photo: StoredReviewPhotoUploadSession,
  moderation: {
    reason: string;
    categories: string[];
    score: number | null;
    model: string | null;
  },
  reviewedAt = getNowIso()
) {
  if (photo.moderationStatus === 'approved' && photo.approvedStoragePath) {
    const updated = await saveStoredPhotoRecord({
      ...photo,
      moderationStatus: 'approved',
      moderationDecision: 'approved',
      moderationReason: moderation.reason,
      moderationCategories: moderation.categories,
      moderationScore: moderation.score,
      moderationModel: moderation.model,
      approvedAt: photo.approvedAt ?? reviewedAt,
      reviewedAt,
      updatedAt: reviewedAt,
    });

    return {
      session: updated,
      publicUrl: (await createSignedReadUrl(updated.approvedStoragePath)) ?? null,
    };
  }

  const imageBytes = await getPhotoDownloadBytes(photo);
  if (!imageBytes) {
    throw new Error('Review photo upload file not found.');
  }

  const copiedPath = await uploadPhotoToApprovedPath(photo, photo.reviewId ?? 'unattached');
  const publicUrl = copiedPath ? await createSignedReadUrl(copiedPath) : null;

  const approved = await saveStoredPhotoRecord({
    ...photo,
    approvedStoragePath: copiedPath ?? photo.approvedStoragePath,
    moderationStatus: 'approved',
    moderationDecision: 'approved',
    moderationReason: moderation.reason,
    moderationCategories: moderation.categories,
    moderationScore: moderation.score,
    moderationModel: moderation.model,
    approvedAt: reviewedAt,
    reviewedAt,
    updatedAt: reviewedAt,
  });

  return {
    session: approved,
    publicUrl,
  };
}

function buildPhotoModerationPrompt() {
  return [
    'Evaluate the attached image for a cannabis storefront review.',
    'Be strict.',
    'Reject explicit nudity, sexual content, genital exposure, fetish content, sexualized poses, minors, violence, hateful content, or anything unsafe for a dispensary review page.',
    'Approve only if the image is a normal, non-explicit storefront or product photo with no nudity or sexual content and no policy risk.',
    'If the image is ambiguous, partially obscured, too low quality, or uncertain, return needs_manual_review.',
    'Return valid JSON only with keys decision, reason, categories, score.',
    'decision must be one of approved, rejected, needs_manual_review.',
  ].join(' ');
}

async function runStrictPhotoModeration(photo: StoredReviewPhotoUploadSession, imageBytes: Buffer) {
  const moderationConfig = getOpenAiModerationConfig();
  if (!moderationConfig.apiKey) {
    return {
      decision: 'needs_manual_review' as const,
      reason: buildModerationFallbackReason(),
      categories: ['manual_review_required'],
      score: null,
      model: null,
    };
  }

  try {
    const response = await reviewPhotoModerationFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${moderationConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: moderationConfig.model,
        temperature: 0,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: `${buildPhotoModerationPrompt()}\nDo not mention policy text in the output beyond the concise reason.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  storefrontId: photo.storefrontId,
                  profileId: photo.profileId,
                  fileName: photo.originalFileName,
                  contentType: photo.contentType,
                  sizeBytes: photo.sizeBytes,
                }),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${photo.contentType};base64,${imageBytes.toString('base64')}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI moderation request failed with ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI moderation response did not include content.');
    }

    const parsed = JSON.parse(content) as {
      decision?: unknown;
      reason?: unknown;
      categories?: unknown;
      score?: unknown;
    };

    const decision = normalizeDecision(parsed.decision);
    if (!decision) {
      throw new Error('OpenAI moderation response used an invalid decision.');
    }

    return {
      decision,
      reason: normalizeTrimmedString(parsed.reason, buildModerationFallbackReason()),
      categories: normalizeCategories(parsed.categories),
      score: normalizeScore(parsed.score),
      model: moderationConfig.model,
    };
  } catch {
    return {
      decision: 'needs_manual_review' as const,
      reason: buildModerationFallbackReason(),
      categories: ['manual_review_required'],
      score: null,
      model: moderationConfig.model,
    };
  }
}

export function clearReviewPhotoModerationMemoryStateForTests() {
  reviewPhotoUploadStore.clear();
  reviewPhotoBytesStore.clear();
  reviewPhotoModerationFetch = fetch;
}

export function seedReviewPhotoUploadBytesForTests(photoId: string, bytes: Buffer) {
  reviewPhotoBytesStore.set(photoId, bytes);
}

export function setReviewPhotoModerationFetchForTests(nextFetch: typeof fetch | null) {
  reviewPhotoModerationFetch = nextFetch ?? fetch;
}

export async function createReviewPhotoUploadSession(input: {
  storefrontId: string;
  profileId: string;
  reviewId?: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const contentType = normalizeContentType(input.contentType);
  if (!contentType) {
    throw new ReviewPhotoModerationError(
      'Only JPEG, PNG, and WEBP review photos are supported.',
      400
    );
  }

  const sizeBytes = normalizeSizeBytes(input.sizeBytes);
  if (!sizeBytes || sizeBytes > MAX_REVIEW_PHOTO_BYTES) {
    throw new ReviewPhotoModerationError(
      `Review photos must be smaller than ${Math.floor(MAX_REVIEW_PHOTO_BYTES / (1024 * 1024))}MB.`,
      400
    );
  }

  const photoId = createId('review-photo');
  const sanitizedFileName = sanitizeFileName(input.fileName);
  const pendingStoragePath = buildPendingStoragePath({
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    photoId,
    fileName: sanitizedFileName,
  });
  const approvedStoragePath = buildApprovedStoragePath({
    storefrontId: input.storefrontId,
    reviewId: input.reviewId ?? 'unattached',
    photoId,
    fileName: sanitizedFileName,
  });

  const session: StoredReviewPhotoUploadSession = normalizeStoredRecord({
    id: photoId,
    storefrontId: input.storefrontId,
    profileId: input.profileId,
    reviewId: input.reviewId ?? null,
    originalFileName: sanitizedFileName,
    contentType,
    sizeBytes,
    pendingStoragePath,
    approvedStoragePath,
    moderationStatus: 'pending_upload',
    moderationDecision: null,
    moderationModel: null,
    moderationReason: null,
    moderationCategories: [],
    moderationScore: null,
    uploadMode: getBucket() ? 'signed_url' : 'memory',
    uploadUrl: null,
    uploadExpiresAt: null,
    approvedAt: null,
    reviewedAt: null,
    attachedAt: null,
    deletedAt: null,
    createdAt: getNowIso(),
    updatedAt: getNowIso(),
  });

  session.uploadUrl = await createSignedUploadUrl(session);
  session.uploadExpiresAt = session.uploadUrl ? new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString() : null;
  await saveStoredPhotoRecord(session);

  return {
    ...session,
    maximumBytes: MAX_REVIEW_PHOTO_BYTES,
  } satisfies ReviewPhotoUploadSessionResponse;
}

export async function completeReviewPhotoUpload(photoId: string) {
  const current = await getStoredPhotoRecord(photoId);
  if (!current) {
    throw new ReviewPhotoModerationError('Review photo upload session not found.', 404);
  }

  if (current.moderationStatus === 'approved') {
    return {
      session: current,
      publicUrl: current.approvedStoragePath
        ? (await createSignedReadUrl(current.approvedStoragePath)) ?? null
        : null,
    };
  }

  if (
    current.moderationStatus === 'rejected' ||
    current.moderationStatus === 'needs_manual_review' ||
    current.moderationStatus === 'failed'
  ) {
    return {
      session: current,
      publicUrl: null,
    };
  }

  const nowIso = getNowIso();
  const nextProcessing = await saveStoredPhotoRecord({
    ...current,
    moderationStatus: 'processing',
    reviewedAt: current.reviewedAt,
    updatedAt: nowIso,
  });

  const imageBytes = await getPhotoDownloadBytes(nextProcessing);
  if (!imageBytes) {
    const failed = await saveStoredPhotoRecord({
      ...nextProcessing,
      moderationStatus: 'failed',
      moderationDecision: 'needs_manual_review',
      moderationReason: 'The uploaded file was not found after upload completion.',
      reviewedAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      session: failed,
      publicUrl: null,
    };
  }

  if (!isEligibleForAutoModeration(nextProcessing.contentType, nextProcessing.sizeBytes)) {
    const manual = await saveStoredPhotoRecord({
      ...nextProcessing,
      moderationStatus: 'needs_manual_review',
      moderationDecision: 'needs_manual_review',
      moderationReason: 'The upload type or size is not eligible for automatic publication.',
      reviewedAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      session: manual,
      publicUrl: null,
    };
  }

  const moderation = await runStrictPhotoModeration(nextProcessing, imageBytes);

  if (moderation.decision === 'approved') {
    return promoteUploadedPhoto(nextProcessing, moderation, nowIso);
  }

  if (moderation.decision === 'rejected') {
    await deletePhotoStorage(nextProcessing);
    const rejected = await saveStoredPhotoRecord({
      ...nextProcessing,
      moderationStatus: 'rejected',
      moderationDecision: 'rejected',
      moderationReason: moderation.reason,
      moderationCategories: moderation.categories,
      moderationScore: moderation.score,
      moderationModel: moderation.model,
      reviewedAt: nowIso,
      deletedAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      session: rejected,
      publicUrl: null,
    };
  }

  const manual = await saveStoredPhotoRecord({
    ...nextProcessing,
    moderationStatus: 'needs_manual_review',
    moderationDecision: 'needs_manual_review',
    moderationReason: moderation.reason,
    moderationCategories: moderation.categories,
    moderationScore: moderation.score,
    moderationModel: moderation.model,
    reviewedAt: nowIso,
    updatedAt: nowIso,
  });

  return {
    session: manual,
    publicUrl: null,
  };
}

export async function attachReviewPhotosToReview(options: {
  storefrontId: string;
  reviewId: string;
  profileId: string;
  photoUploadIds: string[];
}): Promise<ReviewPhotoAttachmentResult> {
  if (!options.photoUploadIds.length) {
    return {
      photoIds: [],
      photoUrls: [],
      moderationSummary: {
        submittedCount: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        message: null,
      },
    };
  }

  const requestedPhotoIds = Array.from(new Set(options.photoUploadIds));
  if (requestedPhotoIds.length > MAX_REVIEW_PHOTOS_PER_REVIEW) {
    throw new ReviewPhotoModerationError(
      `Reviews can include at most ${MAX_REVIEW_PHOTOS_PER_REVIEW} photos.`,
      400
    );
  }

  const photos = await Promise.all(
    requestedPhotoIds.map((photoId) => getStoredPhotoRecord(photoId))
  );
  if (photos.some((photo) => !photo)) {
    throw new ReviewPhotoModerationError(
      'One or more review photo uploads were not found.',
      404
    );
  }

  const readyPhotos = photos as StoredReviewPhotoUploadSession[];
  const invalidPhoto = readyPhotos.find((photo) => {
    return (
      photo.storefrontId !== options.storefrontId ||
      photo.profileId !== options.profileId ||
      (photo.moderationStatus !== 'approved' &&
        photo.moderationStatus !== 'needs_manual_review')
    );
  });

  if (invalidPhoto) {
    throw new ReviewPhotoModerationError(
      'Attached review photos must finish moderation for this storefront and profile before review submission.',
      409
    );
  }

  const nowIso = getNowIso();
  const attachedPhotos = await Promise.all(
    readyPhotos.map(async (photo) => {
      const nextApprovedStoragePath =
        photo.moderationStatus === 'approved'
          ? await moveApprovedPhotoToReviewPath(photo, options.reviewId)
          : buildApprovedStoragePath({
              storefrontId: photo.storefrontId,
              reviewId: options.reviewId,
              photoId: photo.id,
              fileName: photo.originalFileName,
            });

      const session = await saveStoredPhotoRecord({
        ...photo,
        reviewId: options.reviewId,
        approvedStoragePath: nextApprovedStoragePath,
        attachedAt: nowIso,
        updatedAt: nowIso,
      });

      return {
        session,
        publicUrl:
          session.moderationStatus === 'approved'
            ? (await createSignedReadUrl(session.approvedStoragePath)) ?? null
            : null,
      };
    })
  );

  const approvedPhotos = attachedPhotos.filter(
    (entry): entry is {
      session: StoredReviewPhotoUploadSession & { moderationStatus: 'approved' };
      publicUrl: string | null;
    } => entry.session.moderationStatus === 'approved'
  );
  const pendingPhotos = attachedPhotos.filter(
    (entry) => entry.session.moderationStatus === 'needs_manual_review'
  );
  const moderationSummary: ReviewPhotoAttachmentSummary = {
    submittedCount: requestedPhotoIds.length,
    approvedCount: approvedPhotos.length,
    pendingCount: pendingPhotos.length,
    rejectedCount: 0,
    message: buildAttachmentMessage({
      submittedCount: requestedPhotoIds.length,
      approvedCount: approvedPhotos.length,
      pendingCount: pendingPhotos.length,
      rejectedCount: 0,
    }),
  };

  return {
    photoIds: approvedPhotos.map((photo) => photo.session.id),
    photoUrls: approvedPhotos
      .map((photo) => photo.publicUrl)
      .filter((value): value is string => Boolean(value)),
    moderationSummary,
  };
}

export async function listReviewPhotoModerationQueue(limit = 50) {
  const normalizedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const collectionRef = getReviewPhotoCollection();
  let records: StoredReviewPhotoUploadSession[] = [];

  if (collectionRef) {
    const snapshot = await collectionRef
      .orderBy('createdAt', 'desc')
      .limit(Math.min(200, normalizedLimit * 4))
      .get();
    records = snapshot.docs
      .map((documentSnapshot) =>
        normalizeStoredRecord(documentSnapshot.data() as Partial<StoredReviewPhotoUploadSession>)
      )
      .filter((record) => record.moderationStatus === 'needs_manual_review')
      .slice(0, normalizedLimit);
  } else {
    records = Array.from(reviewPhotoUploadStore.values())
      .map(normalizeStoredRecord)
      .filter((record) => record.moderationStatus === 'needs_manual_review')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, normalizedLimit);
  }

  const settledQueue = await Promise.allSettled(
    records.map(async (record) => ({
      ...record,
      publicUrl:
        record.moderationStatus === 'approved'
          ? await createSignedReadUrl(record.approvedStoragePath)
          : null,
      previewUrl:
        record.moderationStatus === 'approved'
          ? await createSignedReadUrl(record.approvedStoragePath)
          : await createSignedReadUrl(record.pendingStoragePath),
    }))
  );
  const queue = settledQueue.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }
    console.warn(
      `[reviewPhotoModerationService] failed to build queue entry for record ${records[index]?.id ?? 'unknown'}:`,
      result.reason
    );
    return [];
  });

  return queue;
}

export async function reviewReviewPhotoUpload(
  photoId: string,
  input: {
    decision: ReviewPhotoModerationDecision;
    reviewNotes: string | null;
  }
) {
  const current = await getStoredPhotoRecord(photoId);
  if (!current) {
    throw new ReviewPhotoModerationError('Review photo upload not found.', 404);
  }

  const nowIso = getNowIso();
  if (input.decision === 'approved') {
    const promoted = await promoteUploadedPhoto(current, {
      reason: input.reviewNotes ?? current.moderationReason ?? 'Approved by admin moderation.',
      categories: current.moderationCategories,
      score: current.moderationScore,
      model: current.moderationModel,
    }, nowIso);
    return {
      ok: true,
      photoId,
      moderationStatus: 'approved' as const,
      publicUrl: promoted.publicUrl,
      session: promoted.session,
    };
  }

  if (input.decision === 'rejected') {
    await deletePhotoStorage(current);
    const rejected = await saveStoredPhotoRecord({
      ...current,
      moderationStatus: 'rejected',
      moderationDecision: 'rejected',
      moderationReason: input.reviewNotes ?? current.moderationReason,
      reviewedAt: nowIso,
      deletedAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      ok: true,
      photoId,
      moderationStatus: 'rejected' as const,
      publicUrl: null,
      session: rejected,
    };
  }

  const manual = await saveStoredPhotoRecord({
    ...current,
    moderationStatus: 'needs_manual_review',
    moderationDecision: 'needs_manual_review',
    moderationReason: input.reviewNotes ?? current.moderationReason,
    reviewedAt: nowIso,
    updatedAt: nowIso,
  });

  return {
    ok: true,
    photoId,
    moderationStatus: 'needs_manual_review' as const,
    publicUrl: null,
    session: manual,
  };
}

export async function deleteReviewPhotoUploadsForProfile(profileId: string) {
  const collectionRef = getReviewPhotoCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('profileId', '==', profileId).get();
    const deleteResults = await Promise.allSettled(
      snapshot.docs.map(async (documentSnapshot) => {
        const record = normalizeStoredRecord(documentSnapshot.data() as Partial<StoredReviewPhotoUploadSession>);
        await deletePhotoStorage(record);
        await documentSnapshot.ref.delete();
      })
    );
    for (const result of deleteResults) {
      if (result.status === 'rejected') {
        console.warn(
          '[reviewPhotoModerationService] failed to delete a photo upload during profile cleanup:',
          result.reason
        );
      }
    }
    return;
  }

  for (const [photoId, record] of reviewPhotoUploadStore.entries()) {
    if (record.profileId === profileId) {
      await deletePhotoStorage(record);
      reviewPhotoUploadStore.delete(photoId);
      reviewPhotoBytesStore.delete(photoId);
    }
  }
}

export async function discardReviewPhotoUpload(photoId: string) {
  const current = await getStoredPhotoRecord(photoId);
  if (!current) {
    return false;
  }

  await deletePhotoStorage(current);
  await deleteStoredPhotoRecord(photoId);
  return true;
}

export async function getApprovedReviewPhotoUrls(photoIds: string[]) {
  const settledRecords = await Promise.allSettled(photoIds.map((photoId) => getStoredPhotoRecord(photoId)));
  const photoRecords = settledRecords.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value ? [result.value] : [];
    }
    console.warn(
      `[reviewPhotoModerationService] failed to fetch photo record ${photoIds[index] ?? 'unknown'}:`,
      result.reason
    );
    return [];
  });
  const approvedRecords = photoRecords.filter(
    (photo): photo is StoredReviewPhotoUploadSession => photo.moderationStatus === 'approved'
  );

  const settledUrls = await Promise.allSettled(
    approvedRecords.map(async (photo) => ({
      id: photo.id,
      url: (await createSignedReadUrl(photo.approvedStoragePath)) ?? null,
    }))
  );
  return settledUrls.flatMap((result, index) => {
    if (result.status === 'fulfilled' && result.value.url) {
      return [result.value.url];
    }
    if (result.status === 'rejected') {
      console.warn(
        `[reviewPhotoModerationService] failed to generate signed URL for photo ${approvedRecords[index]?.id ?? 'unknown'}:`,
        result.reason
      );
    }
    return [];
  });
}

export async function getReviewPhotoUploadSession(photoId: string) {
  return getStoredPhotoRecord(photoId);
}
