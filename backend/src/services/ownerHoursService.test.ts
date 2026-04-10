import assert from 'node:assert/strict';
import test from 'node:test';
import { computeOpenNowFromOwnerHours } from './ownerHoursService';

test('computeOpenNowFromOwnerHours uses the storefront timezone instead of the server timezone', () => {
  assert.equal(
    computeOpenNowFromOwnerHours(
      [
        {
          day: 'Friday',
          open: '10:00 AM',
          close: '8:00 PM',
          closed: false,
        },
      ],
      new Date('2026-04-10T16:30:00.000Z'),
      'America/Los_Angeles',
    ),
    false,
  );
});

test('computeOpenNowFromOwnerHours keeps overnight owner hours open after midnight when today is closed', () => {
  assert.equal(
    computeOpenNowFromOwnerHours(
      [
        {
          day: 'Thursday',
          open: '4:00 PM',
          close: '2:00 AM',
          closed: false,
        },
        {
          day: 'Friday',
          open: null,
          close: null,
          closed: true,
        },
      ],
      new Date('2026-04-10T05:30:00.000Z'),
      'America/New_York',
    ),
    true,
  );
});
