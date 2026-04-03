import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RequestValidationError } from './errors';
import { parseReviewSubmissionBody } from './validationCommunity';

function createReviewBody(overrides?: Record<string, unknown>) {
  return {
    profileId: 'profile-1',
    rating: 5,
    text: 'A strong storefront visit with clear menu signage.',
    ...overrides,
  };
}

test('accepts giphy-hosted gif urls in review submissions', () => {
  const parsed = parseReviewSubmissionBody(
    createReviewBody({
      gifUrl: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    })
  );

  assert.equal(
    parsed.gifUrl,
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif'
  );
});

test('rejects non-giphy gif urls in review submissions', () => {
  assert.throws(
    () =>
      parseReviewSubmissionBody(
        createReviewBody({
          gifUrl: 'https://tracker.example.com/pixel.gif',
        })
      ),
    (error: unknown) =>
      error instanceof RequestValidationError &&
      error.message === 'body.gifUrl must use a valid Giphy URL.'
  );
});
