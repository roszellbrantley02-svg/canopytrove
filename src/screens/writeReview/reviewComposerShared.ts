export const MIN_REVIEW_TEXT_LENGTH = 20;
export const MIN_EDIT_REVIEW_TEXT_LENGTH = 10;

export const REVIEW_TAGS = [
  'Fast checkout',
  'Helpful staff',
  'Good parking',
  'Selection',
  'Easy to find',
] as const;

export const REVIEW_EMOJIS = [
  '\u{1F525}',
  '\u{1F49A}',
  '\u{2728}',
  '\u{1F44F}',
  '\u{1F4B8}',
] as const;

export const MAX_REVIEW_PHOTOS = 4;

export function normalizeGifUrlInput(value: string) {
  return value.trim();
}

export function parseGifUrl(value: string) {
  const normalizedValue = normalizeGifUrlInput(value);
  if (!normalizedValue) {
    return null;
  }

  try {
    const candidate = new URL(normalizedValue);
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      return null;
    }

    return candidate.toString();
  } catch {
    return null;
  }
}

export function getReviewValidationError(
  textLength: number,
  gifUrlInput: string,
  photoCount = 0,
  minReviewTextLength = MIN_REVIEW_TEXT_LENGTH,
) {
  if (textLength < minReviewTextLength) {
    const remainingCharacters = minReviewTextLength - textLength;
    return `Add at least ${remainingCharacters} more characters to submit.`;
  }

  if (photoCount > MAX_REVIEW_PHOTOS) {
    return `Attach no more than ${MAX_REVIEW_PHOTOS} review photos.`;
  }

  if (normalizeGifUrlInput(gifUrlInput) && !parseGifUrl(gifUrlInput)) {
    return 'Use a valid GIF URL starting with http or https.';
  }

  return null;
}

export function getReviewValidationHint(
  textLength: number,
  photoCount = 0,
  minReviewTextLength = MIN_REVIEW_TEXT_LENGTH,
) {
  if (textLength < minReviewTextLength) {
    const remainingCharacters = minReviewTextLength - textLength;
    return `Add at least ${remainingCharacters} more characters before you post.`;
  }

  if (photoCount > 0) {
    return `Photos stay private until they are approved.`;
  }

  return 'Review looks good. Submit when ready.';
}

export function getReviewSubmitErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('401')) {
    return 'Your session expired. Sign in again and retry your review.';
  }

  if (message.includes('403')) {
    return 'This profile cannot submit reviews for this storefront right now.';
  }

  if (message.includes('429')) {
    return 'Too many review attempts. Please wait a moment and try again.';
  }

  if (message.trim()) {
    return message;
  }

  return 'Could not submit the review. Please try again.';
}
