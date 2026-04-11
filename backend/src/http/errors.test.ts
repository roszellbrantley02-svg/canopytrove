import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSafeErrorMessage } from './errors';

test('getSafeErrorMessage preserves 4xx error messages', () => {
  const message = getSafeErrorMessage(new Error('Invalid request payload.'), 400, 'req_test');
  assert.equal(message, 'Invalid request payload.');
});

test('getSafeErrorMessage hides 5xx error messages behind a generic response', () => {
  const message = getSafeErrorMessage(new Error('Database connection leaked credentials.'), 500);
  assert.equal(message, 'Internal server error');
});
