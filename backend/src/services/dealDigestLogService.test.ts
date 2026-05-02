import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

function clearBackendModuleCache() {
  const backendSourceRoot = `${path.resolve(__dirname, '..')}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }
}

beforeEach(() => {
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  clearBackendModuleCache();
});

afterEach(async () => {
  const { clearDealDigestLogStateForTests } = await import('./dealDigestLogService');
  clearDealDigestLogStateForTests();
  clearBackendModuleCache();
});

test('getUtcDayKey returns YYYYMMDD format', async () => {
  const { getUtcDayKey } = await import('./dealDigestLogService');
  const key = getUtcDayKey(new Date('2026-05-02T12:00:00Z'));
  assert.equal(key, '20260502');
});

test('getUtcDayKey rolls based on UTC, not local time', async () => {
  const { getUtcDayKey } = await import('./dealDigestLogService');
  // 2026-05-03 at 03:00 UTC is still May 2 in NY (EDT = UTC-4) — but
  // the key follows UTC, so it should be 20260503.
  const key = getUtcDayKey(new Date('2026-05-03T03:00:00Z'));
  assert.equal(key, '20260503');
});

test('wasDigestSentToday returns false when no record exists', async () => {
  const { wasDigestSentToday } = await import('./dealDigestLogService');
  const result = await wasDigestSentToday('acct_x', '20260502');
  assert.equal(result, false);
});

test('recordDigestSent then wasDigestSentToday returns true (memory mode)', async () => {
  const { recordDigestSent, wasDigestSentToday } = await import('./dealDigestLogService');

  await recordDigestSent({
    accountId: 'acct_x',
    profileId: 'profile_x',
    shopCount: 3,
    providerMessageId: 'msg-1',
    utcDayKey: '20260502',
  });

  const result = await wasDigestSentToday('acct_x', '20260502');
  assert.equal(result, true);
});

test('recordDigestSent for one day does not affect another day', async () => {
  const { recordDigestSent, wasDigestSentToday } = await import('./dealDigestLogService');

  await recordDigestSent({
    accountId: 'acct_x',
    profileId: 'profile_x',
    shopCount: 1,
    providerMessageId: 'msg-1',
    utcDayKey: '20260502',
  });

  const todaySent = await wasDigestSentToday('acct_x', '20260502');
  const tomorrowSent = await wasDigestSentToday('acct_x', '20260503');
  assert.equal(todaySent, true);
  assert.equal(tomorrowSent, false);
});

test('recordDigestSent for one account does not affect another account', async () => {
  const { recordDigestSent, wasDigestSentToday } = await import('./dealDigestLogService');

  await recordDigestSent({
    accountId: 'acct_x',
    profileId: 'profile_x',
    shopCount: 1,
    providerMessageId: 'msg-1',
    utcDayKey: '20260502',
  });

  const xSent = await wasDigestSentToday('acct_x', '20260502');
  const ySent = await wasDigestSentToday('acct_y', '20260502');
  assert.equal(xSent, true);
  assert.equal(ySent, false);
});
