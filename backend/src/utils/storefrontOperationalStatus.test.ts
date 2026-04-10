import assert from 'node:assert/strict';
import test from 'node:test';
import { computeOpenNowFromHours } from './storefrontOperationalStatus';

test('computeOpenNowFromHours uses the storefront timezone instead of the server timezone', () => {
  assert.equal(
    computeOpenNowFromHours(
      ['Friday: 10:00 AM - 8:00 PM'],
      new Date('2026-04-10T16:30:00.000Z'),
      'America/Los_Angeles',
    ),
    false,
  );
});

test('computeOpenNowFromHours keeps overnight storefronts open after midnight when today is closed', () => {
  assert.equal(
    computeOpenNowFromHours(
      ['Thursday: 4:00 PM - 2:00 AM', 'Friday: Closed'],
      new Date('2026-04-10T05:30:00.000Z'),
      'America/New_York',
    ),
    true,
  );
});
