import { describe, expect, it } from 'vitest';
import {
  getReviewValidationError,
  getReviewValidationHint,
  MIN_EDIT_REVIEW_TEXT_LENGTH,
  MAX_REVIEW_PHOTOS,
} from './reviewComposerShared';

describe('reviewComposerShared', () => {
  // Lowered from 20 → 10 on May 2 2026 to match the backend's
  // checkContentQuality minimum and unblock legit short reviews
  // ("Great place!", "Helpful staff"). The test was previously
  // asserting a 12-char input fell short of 20 by 8 chars; now 12
  // exceeds the 10-char floor and is valid.
  it('requires ten characters by default for new reviews', () => {
    expect(getReviewValidationError(5, '', 0)).toBe('Add at least 5 more characters to submit.');
    expect(getReviewValidationError(10, '', 0)).toBeNull();
    expect(getReviewValidationError(12, '', 0)).toBeNull();
  });

  it('allows existing reviews to be edited at the backend threshold', () => {
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
