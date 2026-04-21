import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  clearStorefrontCommunityMemoryStateForTests,
  getStorefrontAppReviewAggregates,
  listStorefrontAppReviews,
  submitStorefrontAppReview,
  submitStorefrontReport,
  StorefrontCommunityError,
} from './storefrontCommunityService';
import { createPublicCommunityAuthorId } from './publicCommunityIdentityService';

afterEach(() => {
  clearStorefrontCommunityMemoryStateForTests();
});

test('listStorefrontAppReviews returns opaque public author ids and marks the matching viewer review', async () => {
  await submitStorefrontAppReview({
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    authorName: 'Test Reviewer',
    rating: 5,
    text: 'This is a detailed review for the storefront.',
    tags: ['Helpful'],
    photoCount: 0,
  });

  const [viewerReview] = await listStorefrontAppReviews('storefront-1', 'profile-1');
  const [otherViewerReview] = await listStorefrontAppReviews('storefront-1', 'profile-2');

  assert.ok(viewerReview);
  assert.equal(
    viewerReview.authorProfileId,
    createPublicCommunityAuthorId('profile-1', 'storefront-1'),
  );
  assert.notEqual(viewerReview.authorProfileId, 'profile-1');
  assert.equal(viewerReview.isOwnReview, true);

  assert.ok(otherViewerReview);
  assert.equal(
    otherViewerReview.authorProfileId,
    createPublicCommunityAuthorId('profile-1', 'storefront-1'),
  );
  assert.equal(otherViewerReview.isOwnReview, false);
});

test('storefront review author names never expose email addresses', async () => {
  await submitStorefrontAppReview({
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    authorName: 'private@example.com',
    rating: 5,
    text: 'This is a detailed review for the storefront.',
    tags: ['Helpful'],
    photoCount: 0,
  });

  const [review] = await listStorefrontAppReviews('storefront-1', 'profile-2');

  assert.equal(review?.authorName, 'Canopy Trove member');
});

test('public author ids are scoped to the storefront instead of staying global', async () => {
  await submitStorefrontAppReview({
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    authorName: 'Scoped Reviewer',
    rating: 5,
    text: 'Storefront one review text that should not leak across stores.',
    tags: ['Helpful'],
    photoCount: 0,
  });
  await submitStorefrontAppReview({
    storefrontId: 'storefront-2',
    profileId: 'profile-1',
    authorName: 'Scoped Reviewer',
    rating: 4,
    text: 'Storefront two review text that should get a different public token.',
    tags: ['Helpful'],
    photoCount: 0,
  });

  const [firstStoreReview] = await listStorefrontAppReviews('storefront-1', 'profile-2');
  const [secondStoreReview] = await listStorefrontAppReviews('storefront-2', 'profile-2');

  assert.ok(firstStoreReview?.authorProfileId);
  assert.ok(secondStoreReview?.authorProfileId);
  assert.notEqual(firstStoreReview?.authorProfileId, secondStoreReview?.authorProfileId);
});

test('getStorefrontAppReviewAggregates computes per-storefront counts and average ratings', async () => {
  await submitStorefrontAppReview({
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    authorName: 'Reviewer One',
    rating: 5,
    text: 'First review text for storefront one.',
    tags: ['Helpful'],
    photoCount: 0,
  });
  await submitStorefrontAppReview({
    storefrontId: 'storefront-2',
    profileId: 'profile-2',
    authorName: 'Reviewer Two',
    rating: 4,
    text: 'First review text for storefront two.',
    tags: ['Helpful'],
    photoCount: 0,
  });
  await submitStorefrontAppReview({
    storefrontId: 'storefront-2',
    profileId: 'profile-3',
    authorName: 'Reviewer Three',
    rating: 5,
    text: 'Second review text for storefront two.',
    tags: ['Helpful'],
    photoCount: 0,
  });

  const aggregates = await getStorefrontAppReviewAggregates();

  assert.deepEqual(aggregates.get('storefront-1'), {
    reviewCount: 1,
    averageRating: 5,
  });
  assert.deepEqual(aggregates.get('storefront-2'), {
    reviewCount: 2,
    averageRating: 4.5,
  });
});

test('submitStorefrontReport derives review context from the stored review instead of trusting client data', async () => {
  const reviewSubmission = await submitStorefrontAppReview({
    storefrontId: 'storefront-1',
    profileId: 'profile-1',
    authorName: 'Trusted Reviewer',
    rating: 4,
    text: 'Actual stored review text that should be reflected in the report context.',
    tags: ['Calm'],
    photoCount: 0,
  });

  const report = await submitStorefrontReport({
    storefrontId: 'storefront-1',
    profileId: 'reporter-1',
    authorName: 'Reporter',
    reason: 'Review content issue',
    description: 'Flagging this review for moderation.',
    reportTarget: 'review',
    reportedReviewId: reviewSubmission.review.id,
    reportedReviewAuthorProfileId: 'spoofed-profile',
    reportedReviewAuthorName: 'Spoofed Name',
    reportedReviewExcerpt: 'Spoofed excerpt',
  });

  assert.equal(report.reportTarget, 'review');
  assert.equal(report.reportedReviewId, reviewSubmission.review.id);
  assert.equal(
    report.reportedReviewAuthorProfileId,
    createPublicCommunityAuthorId('profile-1', 'storefront-1'),
  );
  assert.equal(report.reportedReviewAuthorName, 'Trusted Reviewer');
  assert.match(report.reportedReviewExcerpt ?? '', /Actual stored review text/);
});

test('storefront reports never store email addresses as public author names', async () => {
  const report = await submitStorefrontReport({
    storefrontId: 'storefront-1',
    profileId: 'reporter-1',
    authorName: 'reporter@example.com',
    reason: 'Storefront issue',
    description: 'Flagging this storefront for moderation.',
    reportTarget: 'storefront',
  });

  assert.equal(report.authorName, 'Canopy Trove user');
});

test('submitStorefrontReport rejects review reports for missing reviews', async () => {
  await assert.rejects(
    () =>
      submitStorefrontReport({
        storefrontId: 'storefront-1',
        profileId: 'reporter-1',
        authorName: 'Reporter',
        reason: 'Review content issue',
        description: 'Flagging this review for moderation.',
        reportTarget: 'review',
        reportedReviewId: 'missing-review',
      }),
    (error: unknown) => error instanceof StorefrontCommunityError && error.statusCode === 404,
  );
});
