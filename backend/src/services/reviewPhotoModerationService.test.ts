import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

function loadService() {
  return import(`./reviewPhotoModerationService?test=${Date.now()}-${Math.random()}`);
}

function createFakeStorageBucket() {
  const storedFiles = new Map<string, Buffer>();

  const bucket = {
    name: 'fake-review-photo-bucket',
    file(path: string) {
      return {
        async exists() {
          return [storedFiles.has(path)] as [boolean];
        },
        async download() {
          const bytes = storedFiles.get(path);
          if (!bytes) {
            throw new Error(`Missing fake file: ${path}`);
          }
          return [Buffer.from(bytes)] as [Buffer];
        },
        async save(bytes: Buffer) {
          storedFiles.set(path, Buffer.from(bytes));
        },
        async delete() {
          storedFiles.delete(path);
        },
        async getSignedUrl() {
          return [`https://example.invalid/${encodeURIComponent(path)}`] as [string];
        },
        async copy(target: { save: (bytes: Buffer) => Promise<unknown> }) {
          const bytes = storedFiles.get(path);
          if (!bytes) {
            throw new Error(`Missing fake file for copy: ${path}`);
          }
          await target.save(Buffer.from(bytes));
        },
      };
    },
  };

  return { bucket, storedFiles };
}

beforeEach(async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  const service = await loadService();
  service.setSkipBucketCheckForTests(true);
});

afterEach(async () => {
  const service = await loadService();
  service.clearReviewPhotoModerationMemoryStateForTests();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.PHOTO_MODERATION_MODE;
});

test('falls back to manual review in strict mode when no moderation provider is configured', async () => {
  process.env.PHOTO_MODERATION_MODE = 'strict';
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

  delete process.env.PHOTO_MODERATION_MODE;
});

test('auto-approves when no moderation provider is configured in auto_approve mode', async () => {
  // auto_approve is the default — no env var needed.
  const service = await loadService();

  const session = await service.createReviewPhotoUploadSession({
    storefrontId: 'storefront-1b',
    profileId: 'profile-1b',
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
  });

  service.seedReviewPhotoUploadBytesForTests(session.id, Buffer.from('not-a-real-image'));

  const completed = await service.completeReviewPhotoUpload(session.id);

  assert.equal(completed.session.moderationStatus, 'approved');
  assert.equal(completed.session.moderationDecision, 'approved');
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

test('allows manual-review photos to stay linked to the review without publishing them (strict mode)', async () => {
  process.env.PHOTO_MODERATION_MODE = 'strict';
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

  // Photos awaiting manual review stay tracked on the review so they
  // appear automatically when a moderator approves them later — but
  // they never leak to public `photoUrls` until approval.
  assert.deepEqual(attached.photoIds, [session.id]);
  assert.deepEqual(attached.photoUrls, []);
  assert.equal(attached.moderationSummary.approvedCount, 0);
  assert.equal(attached.moderationSummary.pendingCount, 1);
  assert.match(attached.moderationSummary.message ?? '', /manual review/i);

  delete process.env.PHOTO_MODERATION_MODE;
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

test('completes memory-mode uploads even when storage is configured but the pending file is absent', async () => {
  const service = await loadService();
  const fakeStorage = createFakeStorageBucket();
  service.setReviewPhotoStorageBucketForTests(fakeStorage.bucket);

  const session = await service.createReviewPhotoUploadSession({
    storefrontId: 'storefront-memory-live-regression',
    profileId: 'profile-memory-live-regression',
    fileName: 'one-shot.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    forceMemoryMode: true,
  });

  assert.equal(session.uploadMode, 'memory');
  await service.receiveReviewPhotoBytes(session.id, Buffer.from('fake-image-bytes'));

  const completed = await service.completeReviewPhotoUpload(session.id);

  assert.equal(completed.session.moderationStatus, 'approved');
  assert.equal(completed.session.moderationDecision, 'approved');
  assert.ok(completed.session.approvedStoragePath);
  assert.ok(fakeStorage.storedFiles.has(completed.session.approvedStoragePath));
});
