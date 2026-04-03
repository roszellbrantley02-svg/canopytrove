import { describe, expect, it } from 'vitest';
import {
  createReviewPhotoStoragePath,
  getReviewPhotoFileExtension,
} from './storefrontReviewPhotoPath';

describe('storefrontReviewPhotoPath', () => {
  it('builds a private pending storage path for review photos', () => {
    expect(
      createReviewPhotoStoragePath({
        ownerUid: 'owner-123',
        storefrontId: 'store-456',
        reviewDraftId: 'draft-789',
        fileName: 'review photo.jpg',
      }),
    ).toBe('owner-private/owner-123/review-media/store-456/draft-789/review-photo.jpg');
  });

  it('derives a safe file extension from mime type when the name has none', () => {
    expect(getReviewPhotoFileExtension('photo', 'image/heic')).toBe('.heic');
  });
});
