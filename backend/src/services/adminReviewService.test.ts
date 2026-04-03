import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAdminReviewQueueSections } from './adminReviewService';
import type { ReviewPhotoModerationQueueItem } from './reviewPhotoModerationService';

function createQueuePhoto(id: string): ReviewPhotoModerationQueueItem {
  const nowIso = new Date().toISOString();
  return {
    id,
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    reviewId: null,
    originalFileName: 'photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    pendingStoragePath: `community-review-media/pending/profile-1/storefront-1/${id}/photo.jpg`,
    approvedStoragePath: `community-review-media/approved/storefront-1/review-1/${id}/photo.jpg`,
    moderationStatus: 'needs_manual_review',
    moderationDecision: 'needs_manual_review',
    moderationModel: null,
    moderationReason: 'Needs manual review.',
    moderationCategories: ['manual_review'],
    moderationScore: null,
    uploadMode: 'memory',
    uploadUrl: null,
    uploadExpiresAt: null,
    approvedAt: null,
    reviewedAt: nowIso,
    attachedAt: null,
    deletedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    publicUrl: null,
    previewUrl: null,
  };
}

test('keeps partial admin review queue data when one loader fails', async () => {
  const originalWarn = console.warn;
  const loggedWarnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    loggedWarnings.push(args);
  };

  try {
    const result = await loadAdminReviewQueueSections({
      claims: async () => [{ id: 'claim-1', ownerUid: 'owner-1' }],
      businessVerifications: async () => {
        throw new Error('business verification queue unavailable');
      },
      identityVerifications: async () => [{ id: 'identity-1', ownerUid: 'owner-2' }],
      storefrontReports: async () => [{ id: 'report-1', storefrontId: 'storefront-1' }],
      reviewPhotos: async () => [createQueuePhoto('photo-1')],
    });

    assert.deepEqual(result.claims, [{ id: 'claim-1', ownerUid: 'owner-1' }]);
    assert.deepEqual(result.businessVerifications, []);
    assert.deepEqual(result.identityVerifications, [{ id: 'identity-1', ownerUid: 'owner-2' }]);
    assert.deepEqual(result.storefrontReports, [{ id: 'report-1', storefrontId: 'storefront-1' }]);
    assert.deepEqual(result.reviewPhotos.map((photo) => photo.id), ['photo-1']);
    assert.deepEqual(result.warnings, ['businessVerifications']);
    assert.equal(loggedWarnings.length, 1);
    assert.match(String(loggedWarnings[0]?.[0] ?? ''), /businessVerifications/);
  } finally {
    console.warn = originalWarn;
  }
});

test('returns a clean admin review queue result when every loader succeeds', async () => {
  const result = await loadAdminReviewQueueSections({
    claims: async () => [{ id: 'claim-1' }],
    businessVerifications: async () => [{ id: 'business-1' }],
    identityVerifications: async () => [{ id: 'identity-1' }],
    storefrontReports: async () => [{ id: 'report-1' }],
    reviewPhotos: async () => [createQueuePhoto('photo-1')],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.claims, [{ id: 'claim-1' }]);
  assert.deepEqual(result.businessVerifications, [{ id: 'business-1' }]);
  assert.deepEqual(result.identityVerifications, [{ id: 'identity-1' }]);
  assert.deepEqual(result.storefrontReports, [{ id: 'report-1' }]);
  assert.deepEqual(result.reviewPhotos.map((photo) => photo.id), ['photo-1']);
});
