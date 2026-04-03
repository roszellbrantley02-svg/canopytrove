export function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export function getReviewPhotoFileExtension(fileName: string, mimeType: string | null) {
  const trimmedName = fileName.trim();
  const lastDotIndex = trimmedName.lastIndexOf('.');
  if (lastDotIndex >= 0 && lastDotIndex < trimmedName.length - 1) {
    return `.${sanitizeFileSegment(trimmedName.slice(lastDotIndex + 1).toLowerCase())}`;
  }

  if (mimeType?.startsWith('image/jpeg')) {
    return '.jpg';
  }

  if (mimeType?.startsWith('image/png')) {
    return '.png';
  }

  if (mimeType?.startsWith('image/webp')) {
    return '.webp';
  }

  if (mimeType?.startsWith('image/heic') || mimeType?.startsWith('image/heif')) {
    return '.heic';
  }

  return '.jpg';
}

export function createReviewPhotoStoragePath(input: {
  ownerUid: string;
  storefrontId: string;
  reviewDraftId: string;
  fileName: string;
}) {
  return [
    'owner-private',
    sanitizeFileSegment(input.ownerUid),
    'review-media',
    sanitizeFileSegment(input.storefrontId),
    sanitizeFileSegment(input.reviewDraftId),
    sanitizeFileSegment(input.fileName),
  ].join('/');
}
