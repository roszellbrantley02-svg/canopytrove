import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

function loadService() {
  return import(`./reviewPhotoModerationService?test=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

afterEach(async () => {
  const service = await loadService();
  service.clearReviewPhotoModerationMemoryStateForTests();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

test('falls back to manual review when no moderation provider is configured', async () => {
  const service = await loadService();

  const session = await service.createReviewPhotoUploadSession({
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
  });

  service.seedReviewPhotoUploadBytesForTests(session.id, Buffer.from('not-a-real-image'));

  const completed = await service.completeReviewPhotoUpload(session.id);

  assert.equal(completed.session.moderationStatus, 'needs_manual_review');
  assert.equal(completed.session.moderationDecision, 'needs_manual_review');
  assert.equal(completed.publicUrl, null);
});

test('promotes a clean photo when moderation approves it', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-4o-mini';
  const mockFetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'approved',
                reason: 'Clean storefront product photo.',
                categories: ['product_photo'],
                score: 0.02,
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )) as unknown as typeof fetch;

  try {
    const service = await loadService();
    service.setReviewPhotoModerationFetchForTests(mockFetch);
    const session = await service.createReviewPhotoUploadSession({
      storefrontId: 'storefront-2',
      profileId: 'profile-2',
      fileName: 'product.png',
      contentType: 'image/png',
      sizeBytes: 2048,
    });

    service.seedReviewPhotoUploadBytesForTests(session.id, Buffer.from('fake-image-bytes'));

    const completed = await service.completeReviewPhotoUpload(session.id);

    assert.equal(completed.session.moderationStatus, 'approved');
    assert.equal(completed.session.moderationDecision, 'approved');
    assert.equal(completed.session.moderationReason, 'Clean storefront product photo.');

    const attached = await service.attachReviewPhotosToReview({
      storefrontId: 'storefront-2',
      reviewId: 'review-2',
      profileId: 'profile-2',
      photoUploadIds: [session.id],
    });

    assert.deepEqual(attached.photoIds, [session.id]);
    assert.equal(attached.moderationSummary.approvedCount, 1);
    assert.equal(attached.moderationSummary.pendingCount, 0);
  } finally {
    const service = await loadService();
    service.setReviewPhotoModerationFetchForTests(null);
  }
});

test('allows manual-review photos to stay linked to the review without publishing them', async () => {
  const service = await loadService();

  const session = await service.createReviewPhotoUploadSession({
    storefrontId: 'storefront-3',
    profileId: 'profile-3',
    fileName: 'photo.webp',
    contentType: 'image/webp',
    sizeBytes: 1024,
  });

  service.seedReviewPhotoUploadBytesForTests(session.id, Buffer.from('not-a-real-image'));
  const completed = await service.completeReviewPhotoUpload(session.id);
  assert.equal(completed.session.moderationStatus, 'needs_manual_review');

  const attached = await service.attachReviewPhotosToReview({
    storefrontId: 'storefront-3',
    reviewId: 'review-1',
    profileId: 'profile-3',
    photoUploadIds: [session.id],
  });

  assert.deepEqual(attached.photoIds, []);
  assert.equal(attached.moderationSummary.approvedCount, 0);
  assert.equal(attached.moderationSummary.pendingCount, 1);
  assert.match(attached.moderationSummary.message ?? '', /manual review/i);
});

test('keeps approved review photos approved when completion is retried', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.OPENAI_MODEL = 'gpt-4o-mini';
  const mockFetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'approved',
                reason: 'Clean storefront product photo.',
                categories: ['product_photo'],
                score: 0.01,
              }),
            },
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )) as unknown as typeof fetch;

  try {
    const service = await loadService();
    service.setReviewPhotoModerationFetchForTests(mockFetch);
    const session = await service.createReviewPhotoUploadSession({
      storefrontId: 'storefront-4',
      profileId: 'profile-4',
      fileName: 'approved.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 2048,
    });

    service.seedReviewPhotoUploadBytesForTests(session.id, Buffer.from('fake-image-bytes'));

    const completed = await service.completeReviewPhotoUpload(session.id);
    const completedAgain = await service.completeReviewPhotoUpload(session.id);

    assert.equal(completed.session.moderationStatus, 'approved');
    assert.equal(completedAgain.session.moderationStatus, 'approved');
    assert.equal(completedAgain.session.moderationDecision, 'approved');
    assert.equal(completedAgain.session.moderationReason, 'Clean storefront product photo.');
  } finally {
    const service = await loadService();
    service.setReviewPhotoModerationFetchForTests(null);
  }
});
