import { describe, expect, it } from 'vitest';
import {
  getReviewValidationError,
  getReviewValidationHint,
  MIN_EDIT_REVIEW_TEXT_LENGTH,
  MAX_REVIEW_PHOTOS,
} from './reviewComposerShared';

describe('reviewComposerShared', () => {
  it('requires twenty characters by default for new reviews', () => {
    expect(getReviewValidationError(12, '', 0)).toBe('Add at least 8 more characters to submit.');
  });

  it('allows shorter existing reviews to be edited at the backend threshold', () => {
    expect(getReviewValidationError(12, '', 0, MIN_EDIT_REVIEW_TEXT_LENGTH)).toBeNull();
  });

  it('rejects review submissions that exceed the photo limit', () => {
    expect(getReviewValidationError(24, '', MAX_REVIEW_PHOTOS + 1)).toBe(
      `Attach no more than ${MAX_REVIEW_PHOTOS} review photos.`,
    );
  });

  it('mentions that attached photos stay private until approved', () => {
    expect(getReviewValidationHint(24, 2)).toBe('Photos stay private until they are approved.');
  });
});
