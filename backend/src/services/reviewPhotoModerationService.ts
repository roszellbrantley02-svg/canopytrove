import { randomUUID } from 'node:crypto';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { logger } from '../observability/logger';
import { serverConfig } from '../config';
import { getBackendFirebaseStorage } from '../firebase';
import { stripImageMetadata } from './imageExifStripper';

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
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/**
 * Content types that need server-side conversion to JPEG before
 * moderation and storage. The converted bytes replace the original.
 */
const CONVERTIBLE_CONTENT_TYPES = new Set(['image/heic', 'image/heif']);

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
let skipBucketCheckForTests = false;

type StorageFileLike = {
  exists: () => Promise<[boolean]>;
  download: () => Promise<[Buffer]>;
  save: (
    bytes: Buffer,
    options?: {
      metadata?: {
        contentType?: string;
      };
    },
  ) => Promise<unknown>;
  delete: (options?: { ignoreNotFound?: boolean }) => Promise<unknown>;
  getSignedUrl: (options: {
    action: 'write' | 'read';
    version: 'v4';
    expires: number;
    contentType?: string;
  }) => Promise<[string]>;
  copy: (target: unknown) => Promise<unknown>;
};

type StorageBucketLike = {
  name: string;
  file: (path: string) => StorageFileLike;
};

let bucketOverrideForTests: StorageBucketLike | null = null;

export class ReviewPhotoModerationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
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

/**
 * Convert image bytes (any sharp-supported format including HEIC/HEIF)
 * to JPEG. Uses dynamic require so the server still starts if sharp is
 * not installed — callers catch and route to manual review.
 */
async function convertToJpeg(inputBytes: Buffer): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = require('sharp') as (input: Buffer) => {
    jpeg: (options: { quality: number }) => { toBuffer: () => Promise<Buffer> };
  };
  return sharp(inputBytes).jpeg({ quality: 84 }).toBuffer();
}

function normalizeContentType(value: unknown) {
  return typeof value === 'string' && ALLOWED_CONTENT_TYPES.has(value.trim()) ? value.trim() : null;
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
        .map((entry) => entry.trim()),
    ),
  ).slice(0, 12);
}

function normalizeScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeStoredRecord(
  record: Partial<StoredReviewPhotoUploadSession>,
): StoredReviewPhotoUploadSession {
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
    moderationModel:
      record.moderationModel === null
        ? null
        : normalizeTrimmedString(record.moderationModel) || null,
    moderationReason:
      record.moderationReason === null
        ? null
        : normalizeTrimmedString(record.moderationReason) || null,
    moderationCategories: normalizeCategories(record.moderationCategories),
    moderationScore: normalizeScore(record.moderationScore),
    uploadMode: record.uploadMode === 'memory' ? 'memory' : 'signed_url',
    uploadUrl: record.uploadUrl === null ? null : normalizeTrimmedString(record.uploadUrl) || null,
    uploadExpiresAt:
      record.uploadExpiresAt === null
        ? null
        : normalizeTrimmedString(record.uploadExpiresAt) || null,
    approvedAt:
      record.approvedAt === null ? null : normalizeTrimmedString(record.approvedAt) || null,
    reviewedAt:
      record.reviewedAt === null ? null : normalizeTrimmedString(record.reviewedAt) || null,
    attachedAt:
      record.attachedAt === null ? null : normalizeTrimmedString(record.attachedAt) || null,
    deletedAt: record.deletedAt === null ? null : normalizeTrimmedString(record.deletedAt) || null,
    createdAt,
    updatedAt,
  };
}

function getBucket() {
  if (bucketOverrideForTests) {
    return bucketOverrideForTests;
  }

  if (skipBucketCheckForTests) {
    return null;
  }

  const storage = getBackendFirebaseStorage();
  if (!storage) {
    return null;
  }

  try {
    const bucket = storage.bucket();
    // bucket() returns an object even when no bucket name is configured.
    // Verify the bucket has a valid name so downstream signed-URL calls
    // don't blow up with a confusing 500.
    if (!bucket.name) {
      return null;
    }

    return bucket;
  } catch {
    return null;
  }
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
  return [
    'community-review-media',
    'approved',
    input.storefrontId,
    input.reviewId,
    input.photoId,
    input.fileName,
  ].join('/');
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
  return (
    ALLOWED_CONTENT_TYPES.has(contentType) && sizeBytes > 0 && sizeBytes <= MAX_REVIEW_PHOTO_BYTES
  );
}

function buildModerationFallbackReason() {
  return 'Automatic moderation is unavailable. Photo was auto-approved.';
}

/**
 * Returns the current photo moderation mode.
 *
 * - `auto_approve` (default): Only reject clearly harmful content (explicit
 *   nudity, violence, minors, hate). Everything else — including ambiguous,
 *   low-quality, or uncertain images — is approved automatically. When the
 *   OpenAI API is unavailable the photo is auto-approved as well.
 *
 * - `strict`: Original behaviour. Ambiguous images route to
 *   `needs_manual_review` (requires a review dashboard to clear them).
 *
 * Set via the `PHOTO_MODERATION_MODE` environment variable.
 */
function getPhotoModerationMode(): 'auto_approve' | 'strict' {
  const raw = process.env.PHOTO_MODERATION_MODE?.trim().toLowerCase();
  if (raw === 'strict') {
    return 'strict';
  }
  return 'auto_approve';
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
  const memoryBytes = reviewPhotoBytesStore.get(photo.id) ?? null;
  if (photo.uploadMode === 'memory' && memoryBytes) {
    return memoryBytes;
  }

  const bucket = getBucket();
  if (bucket) {
    const file = bucket.file(photo.pendingStoragePath);
    const [exists] = await file.exists();
    if (!exists) {
      return memoryBytes;
    }

    const [buffer] = await file.download();
    return buffer;
  }

  return memoryBytes;
}

async function uploadPhotoToApprovedPath(
  photo: StoredReviewPhotoUploadSession,
  reviewId: string,
  preloadedBytes?: Buffer | null,
) {
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

  // Download → strip EXIF metadata (GPS, device info) → upload to approved path.
  // This protects user privacy by removing location and camera data before
  // the photo becomes publicly readable.
  //
  // When the upload was memory-mode (one-shot endpoint), the bytes never
  // hit the bucket's pending path, so we accept pre-loaded bytes directly
  // instead of trying to download from a path that doesn't exist.
  let rawBytes: Buffer;
  if (preloadedBytes) {
    rawBytes = preloadedBytes;
  } else {
    const pendingFile = bucket.file(photo.pendingStoragePath);
    const [downloaded] = await pendingFile.download();
    rawBytes = downloaded;
  }
  const strippedBytes = stripImageMetadata(rawBytes, photo.contentType);

  const approvedFile = bucket.file(approvedPath);
  await approvedFile.save(strippedBytes, {
    metadata: { contentType: photo.contentType },
  });

  // Clean up the pending file only when we actually downloaded from it
  // (signed_url mode). In memory mode there is no pending file in storage.
  if (!preloadedBytes) {
    await bucket
      .file(photo.pendingStoragePath)
      .delete({ ignoreNotFound: true })
      .catch(() => undefined);
  }
  return approvedPath;
}

async function moveApprovedPhotoToReviewPath(
  photo: StoredReviewPhotoUploadSession,
  reviewId: string,
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
  await sourceFile.copy(targetFile as unknown as string);
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

  try {
    const [uploadUrl] = await bucket.file(photo.pendingStoragePath).getSignedUrl({
      action: 'write',
      version: 'v4',
      expires: Date.now() + UPLOAD_URL_TTL_MS,
      contentType: photo.contentType,
    });

    return uploadUrl;
  } catch {
    // Signed URL creation can fail if the service account lacks
    // iam.serviceAccounts.signBlob permission or the bucket name
    // is misconfigured. Fall back to memory upload mode.
    return null;
  }
}

async function createSignedReadUrl(storagePath: string) {
  const bucket = getBucket();
  if (!bucket) {
    return null;
  }

  try {
    const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
      action: 'read',
      version: 'v4',
      expires: Date.now() + APPROVED_URL_TTL_MS,
    });

    return downloadUrl;
  } catch {
    // Signed URL creation can fail if the service account lacks
    // iam.serviceAccounts.signBlob permission (common on Cloud Run).
    // Return null so the upload still succeeds — the photo is stored
    // in the bucket and the URL can be generated later once the
    // permission is granted.
    return null;
  }
}

async function promoteUploadedPhoto(
  photo: StoredReviewPhotoUploadSession,
  moderation: {
    reason: string;
    categories: string[];
    score: number | null;
    model: string | null;
  },
  reviewedAt = getNowIso(),
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
    throw new Error('Upload failed: review photo file not found in storage.');
  }

  const copiedPath = await uploadPhotoToApprovedPath(
    photo,
    photo.reviewId ?? 'unattached',
    photo.uploadMode === 'memory' ? imageBytes : null,
  );
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
  const mode = getPhotoModerationMode();

  if (mode === 'strict') {
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

  // auto_approve mode: approve everything except clearly harmful content.
  return [
    'Evaluate the attached image for a cannabis dispensary review.',
    'This is a cannabis industry app — photos of cannabis products, packaging, storefronts, menus, and related items are expected and normal.',
    'APPROVE the image unless it clearly contains one of these: explicit nudity or sexual content, content involving minors, graphic violence or gore, hateful symbols or slurs.',
    'Low quality, blurry, dark, partially obscured, or ambiguous photos should be APPROVED — do not penalize image quality.',
    'Cannabis products, paraphernalia, packaging, dispensary interiors, and exteriors should all be APPROVED.',
    'Return valid JSON only with keys decision, reason, categories, score.',
    'decision must be one of approved, rejected.',
  ].join(' ');
}

async function runStrictPhotoModeration(photo: StoredReviewPhotoUploadSession, imageBytes: Buffer) {
  const moderationConfig = getOpenAiModerationConfig();
  const mode = getPhotoModerationMode();

  if (!moderationConfig.apiKey) {
    // No API key → in auto_approve mode we just approve the photo
    // instead of blocking it in a manual-review limbo.
    if (mode === 'auto_approve') {
      return {
        decision: 'approved' as const,
        reason: buildModerationFallbackReason(),
        categories: [] as string[],
        score: null,
        model: null,
      };
    }
    return {
      decision: 'needs_manual_review' as const,
      reason: buildModerationFallbackReason(),
      categories: ['manual_review_required'],
      score: null,
      model: null,
    };
  }

  try {
    const response = await reviewPhotoModerationFetch(
      'https://api.openai.com/v1/chat/completions',
      {
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
      },
    );

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
    // API call failed — auto-approve instead of blocking when in
    // auto_approve mode (there is no manual review dashboard).
    if (mode === 'auto_approve') {
      return {
        decision: 'approved' as const,
        reason: 'Automatic moderation encountered an error. Photo was auto-approved.',
        categories: [] as string[],
        score: null,
        model: moderationConfig.model,
      };
    }
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
  skipBucketCheckForTests = false;
  bucketOverrideForTests = null;
}

export function seedReviewPhotoUploadBytesForTests(photoId: string, bytes: Buffer) {
  reviewPhotoBytesStore.set(photoId, bytes);
}

export function setReviewPhotoModerationFetchForTests(nextFetch: typeof fetch | null) {
  reviewPhotoModerationFetch = nextFetch ?? fetch;
}

export function setSkipBucketCheckForTests(skip: boolean) {
  skipBucketCheckForTests = skip;
}

export function setReviewPhotoStorageBucketForTests(bucket: StorageBucketLike | null) {
  bucketOverrideForTests = bucket;
}

export async function createReviewPhotoUploadSession(input: {
  storefrontId: string;
  profileId: string;
  reviewId?: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Force memory-mode upload (skip signed-URL attempt). Used by the
   *  one-shot endpoint that already has the bytes in hand. */
  forceMemoryMode?: boolean;
}) {
  const contentType = normalizeContentType(input.contentType);
  if (!contentType) {
    throw new ReviewPhotoModerationError(
      'Unsupported format: only JPEG, PNG, WEBP, and HEIC photos are accepted.',
      400,
    );
  }

  const sizeBytes = normalizeSizeBytes(input.sizeBytes);
  if (!sizeBytes || sizeBytes > MAX_REVIEW_PHOTO_BYTES) {
    throw new ReviewPhotoModerationError(
      `File too large: review photos must be under ${Math.floor(MAX_REVIEW_PHOTO_BYTES / (1024 * 1024))} MB.`,
      400,
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

  // Attempt to mint a signed upload URL. If Cloud Storage is not
  // configured or the service account lacks signBlob permission, fall
  // back to memory-mode so the frontend can upload bytes directly
  // through the backend instead of to Cloud Storage.
  const bucket = input.forceMemoryMode ? null : getBucket();
  let uploadMode: 'signed_url' | 'memory' = bucket ? 'signed_url' : 'memory';

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
    uploadMode,
    uploadUrl: null,
    uploadExpiresAt: null,
    approvedAt: null,
    reviewedAt: null,
    attachedAt: null,
    deletedAt: null,
    createdAt: getNowIso(),
    updatedAt: getNowIso(),
  });

  if (uploadMode === 'signed_url') {
    session.uploadUrl = await createSignedUploadUrl(session);
    if (session.uploadUrl) {
      session.uploadExpiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString();
    } else {
      // Signed URL creation failed (signBlob permission, bucket
      // misconfiguration, etc.). Downgrade to memory mode so the
      // frontend can upload bytes through the backend directly.
      session.uploadMode = 'memory';
      session.uploadExpiresAt = null;
    }
  }

  await saveStoredPhotoRecord(session);

  return {
    ...session,
    maximumBytes: MAX_REVIEW_PHOTO_BYTES,
  } satisfies ReviewPhotoUploadSessionResponse;
}

/**
 * Receives raw photo bytes for a memory-mode upload session. This is the
 * fallback path used when Cloud Storage signed URLs are unavailable (missing
 * signBlob permission, bucket misconfiguration, etc.). The bytes are held
 * in-memory until moderation completes, after which they can be promoted to
 * Cloud Storage if the bucket becomes available.
 */
export async function receiveReviewPhotoBytes(photoId: string, bytes: Buffer) {
  const session = await getStoredPhotoRecord(photoId);
  if (!session) {
    throw new ReviewPhotoModerationError('Review photo upload session not found.', 404);
  }

  if (session.uploadMode !== 'memory') {
    throw new ReviewPhotoModerationError(
      'Upload failed: this session expects a signed-URL upload, not a direct byte upload.',
      400,
    );
  }

  if (session.moderationStatus !== 'pending_upload') {
    throw new ReviewPhotoModerationError(
      'Upload failed: this session has already received its photo bytes.',
      409,
    );
  }

  if (bytes.length > MAX_REVIEW_PHOTO_BYTES) {
    throw new ReviewPhotoModerationError(
      `File too large: review photos must be under ${Math.floor(MAX_REVIEW_PHOTO_BYTES / (1024 * 1024))} MB.`,
      400,
    );
  }

  reviewPhotoBytesStore.set(photoId, bytes);
  await saveStoredPhotoRecord({
    ...session,
    sizeBytes: bytes.length,
    updatedAt: getNowIso(),
  });

  return { ok: true };
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
        ? ((await createSignedReadUrl(current.approvedStoragePath)) ?? null)
        : null,
    };
  }

  if (current.moderationStatus === 'rejected' || current.moderationStatus === 'failed') {
    return {
      session: current,
      publicUrl: null,
    };
  }

  // Photos previously stuck in needs_manual_review can be auto-promoted
  // when auto_approve mode is active, unblocking them without a dashboard.
  if (current.moderationStatus === 'needs_manual_review') {
    if (getPhotoModerationMode() === 'auto_approve') {
      return promoteUploadedPhoto(current, {
        reason: current.moderationReason ?? 'Auto-approved (no manual review dashboard).',
        categories: current.moderationCategories,
        score: current.moderationScore,
        model: current.moderationModel,
      });
    }
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

  let imageBytes = await getPhotoDownloadBytes(nextProcessing);
  if (!imageBytes) {
    const failed = await saveStoredPhotoRecord({
      ...nextProcessing,
      moderationStatus: 'failed',
      moderationDecision: 'needs_manual_review',
      moderationReason: 'Upload failed: the photo file was not found after upload.',
      reviewedAt: nowIso,
      updatedAt: nowIso,
    });
    return {
      session: failed,
      publicUrl: null,
    };
  }

  // Convert HEIC/HEIF to JPEG so downstream moderation and storage
  // always deal with a widely-supported format.
  if (CONVERTIBLE_CONTENT_TYPES.has(nextProcessing.contentType)) {
    try {
      imageBytes = await convertToJpeg(imageBytes);
      nextProcessing.contentType = 'image/jpeg';
      nextProcessing.sizeBytes = imageBytes.length;
      await saveStoredPhotoRecord({
        ...nextProcessing,
        updatedAt: getNowIso(),
      });
      // Replace in-memory bytes if present (memory-mode uploads)
      if (reviewPhotoBytesStore.has(nextProcessing.id)) {
        reviewPhotoBytesStore.set(nextProcessing.id, imageBytes);
      }
    } catch {
      // If conversion fails: in auto_approve mode, approve anyway
      // since there is no manual review dashboard. In strict mode,
      // route to manual review.
      if (getPhotoModerationMode() === 'auto_approve') {
        return promoteUploadedPhoto(
          nextProcessing,
          {
            reason: 'Image format conversion failed. Photo was auto-approved.',
            categories: [],
            score: null,
            model: null,
          },
          nowIso,
        );
      }
      const manual = await saveStoredPhotoRecord({
        ...nextProcessing,
        moderationStatus: 'needs_manual_review',
        moderationDecision: 'needs_manual_review',
        moderationReason:
          'Needs manual review: the image format could not be converted automatically.',
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });
      return {
        session: manual,
        publicUrl: null,
      };
    }
  }

  if (!isEligibleForAutoModeration(nextProcessing.contentType, nextProcessing.sizeBytes)) {
    if (getPhotoModerationMode() === 'auto_approve') {
      return promoteUploadedPhoto(
        nextProcessing,
        {
          reason: 'Photo could not be verified automatically. Auto-approved.',
          categories: [],
          score: null,
          model: null,
        },
        nowIso,
      );
    }
    const manual = await saveStoredPhotoRecord({
      ...nextProcessing,
      moderationStatus: 'needs_manual_review',
      moderationDecision: 'needs_manual_review',
      moderationReason: 'Needs manual review: this photo could not be verified automatically.',
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

  // In auto_approve mode, promote needs_manual_review to approved
  // since there is no manual review dashboard to clear these.
  if (getPhotoModerationMode() === 'auto_approve') {
    return promoteUploadedPhoto(
      nextProcessing,
      {
        reason: moderation.reason,
        categories: moderation.categories,
        score: moderation.score,
        model: moderation.model,
      },
      nowIso,
    );
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
      400,
    );
  }

  const photos = await Promise.all(
    requestedPhotoIds.map((photoId) => getStoredPhotoRecord(photoId)),
  );
  if (photos.some((photo) => !photo)) {
    throw new ReviewPhotoModerationError('One or more review photo uploads were not found.', 404);
  }

  const readyPhotos = photos as StoredReviewPhotoUploadSession[];
  const invalidPhoto = readyPhotos.find((photo) => {
    return (
      photo.storefrontId !== options.storefrontId ||
      photo.profileId !== options.profileId ||
      (photo.moderationStatus !== 'approved' && photo.moderationStatus !== 'needs_manual_review')
    );
  });

  if (invalidPhoto) {
    throw new ReviewPhotoModerationError(
      'Upload still processing: attached photos must finish moderation before review submission.',
      409,
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
            ? ((await createSignedReadUrl(session.approvedStoragePath)) ?? null)
            : null,
      };
    }),
  );

  const approvedPhotos = attachedPhotos.filter(
    (
      entry,
    ): entry is {
      session: StoredReviewPhotoUploadSession & { moderationStatus: 'approved' };
      publicUrl: string | null;
    } => entry.session.moderationStatus === 'approved',
  );
  const pendingPhotos = attachedPhotos.filter(
    (entry) => entry.session.moderationStatus === 'needs_manual_review',
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

  // Track IDs for every photo that made it through initial moderation
  // (approved OR pending manual review). Photos still in manual review
  // stay off the public-facing `photoUrls` list — `getApprovedReviewPhotoUrls`
  // filters by `moderationStatus === 'approved'` at read time — but keeping
  // their IDs on the review means they become visible automatically the
  // moment a moderator approves them, instead of being permanently orphaned.
  const trackedPhotoIds = attachedPhotos.map((entry) => entry.session.id);

  return {
    photoIds: trackedPhotoIds,
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
        normalizeStoredRecord(documentSnapshot.data() as Partial<StoredReviewPhotoUploadSession>),
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
    })),
  );
  const queue = settledQueue.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }
    logger.warn(
      `[reviewPhotoModerationService] failed to build queue entry for record ${records[index]?.id ?? 'unknown'}:`,
      result.reason,
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
  },
) {
  const current = await getStoredPhotoRecord(photoId);
  if (!current) {
    throw new ReviewPhotoModerationError('Review photo upload not found.', 404);
  }

  const nowIso = getNowIso();
  if (input.decision === 'approved') {
    const promoted = await promoteUploadedPhoto(
      current,
      {
        reason: input.reviewNotes ?? current.moderationReason ?? 'Approved by admin moderation.',
        categories: current.moderationCategories,
        score: current.moderationScore,
        model: current.moderationModel,
      },
      nowIso,
    );
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
        const record = normalizeStoredRecord(
          documentSnapshot.data() as Partial<StoredReviewPhotoUploadSession>,
        );
        await deletePhotoStorage(record);
        await documentSnapshot.ref.delete();
      }),
    );
    for (const result of deleteResults) {
      if (result.status === 'rejected') {
        logger.warn(
          '[reviewPhotoModerationService] failed to delete a photo upload during profile cleanup:',
          result.reason,
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
  const settledRecords = await Promise.allSettled(
    photoIds.map((photoId) => getStoredPhotoRecord(photoId)),
  );
  const photoRecords = settledRecords.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value ? [result.value] : [];
    }
    logger.warn(
      `[reviewPhotoModerationService] failed to fetch photo record ${photoIds[index] ?? 'unknown'}:`,
      result.reason,
    );
    return [];
  });
  const approvedRecords = photoRecords.filter(
    (photo): photo is StoredReviewPhotoUploadSession => photo.moderationStatus === 'approved',
  );

  const settledUrls = await Promise.allSettled(
    approvedRecords.map(async (photo) => ({
      id: photo.id,
      url: (await createSignedReadUrl(photo.approvedStoragePath)) ?? null,
    })),
  );
  return settledUrls.flatMap((result, index) => {
    if (result.status === 'fulfilled' && result.value.url) {
      return [result.value.url];
    }
    if (result.status === 'rejected') {
      logger.warn(
        `[reviewPhotoModerationService] failed to generate signed URL for photo ${approvedRecords[index]?.id ?? 'unknown'}:`,
        result.reason,
      );
    }
    return [];
  });
}

export async function getReviewPhotoUploadSession(photoId: string) {
  return getStoredPhotoRecord(photoId);
}
