import { describe, expect, it } from 'vitest';
import {
  getReviewValidationError,
  getReviewValidationHint,
  MAX_REVIEW_PHOTOS,
} from './reviewComposerShared';

describe('reviewComposerShared', () => {
  it('rejects review submissions that exceed the photo limit', () => {
    expect(getReviewValidationError(24, '', MAX_REVIEW_PHOTOS + 1)).toBe(
      `Attach no more than ${MAX_REVIEW_PHOTOS} review photos.`,
    );
  });

  it('mentions the private moderation queue when photos are attached', () => {
    expect(getReviewValidationHint(24, 2)).toBe(
      'Photos are uploaded privately first and stay hidden until moderation approves them.',
    );
  });
});
