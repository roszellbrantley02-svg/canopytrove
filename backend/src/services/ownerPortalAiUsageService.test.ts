import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

let assertOwnerAiDailyQuota: typeof import('./ownerPortalAiUsageService').assertOwnerAiDailyQuota;
let clearOwnerAiUsageMemoryStateForTests: typeof import('./ownerPortalAiUsageService').clearOwnerAiUsageMemoryStateForTests;
let consumeOwnerAiDailyQuota: typeof import('./ownerPortalAiUsageService').consumeOwnerAiDailyQuota;
let OwnerAiQuotaExceededError: typeof import('./ownerPortalAiUsageService').OwnerAiQuotaExceededError;

beforeEach(async () => {
  process.env.NODE_ENV = 'test';
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  process.env.OWNER_AI_DAILY_REQUEST_LIMIT = '2';
  ({
    assertOwnerAiDailyQuota,
    clearOwnerAiUsageMemoryStateForTests,
    consumeOwnerAiDailyQuota,
    OwnerAiQuotaExceededError,
  } = await import('./ownerPortalAiUsageService'));
  clearOwnerAiUsageMemoryStateForTests();
});

afterEach(() => {
  clearOwnerAiUsageMemoryStateForTests();
  delete process.env.OWNER_AI_DAILY_REQUEST_LIMIT;
});

test('tracks owner AI daily quota per owner account', async () => {
  const first = await consumeOwnerAiDailyQuota('owner-1');
  const second = await consumeOwnerAiDailyQuota('owner-1');
  const third = await consumeOwnerAiDailyQuota('owner-1');

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test('keeps owner AI daily quota isolated per owner account', async () => {
  await consumeOwnerAiDailyQuota('owner-1');
  const otherOwner = await consumeOwnerAiDailyQuota('owner-2');

  assert.equal(otherOwner.allowed, true);
  assert.equal(otherOwner.remaining, 1);
});

test('throws a typed error when the owner AI daily quota is exhausted', async () => {
  await assertOwnerAiDailyQuota('owner-1');
  await assertOwnerAiDailyQuota('owner-1');

  await assert.rejects(
    () => assertOwnerAiDailyQuota('owner-1'),
    (error: unknown) => {
      assert.ok(error instanceof OwnerAiQuotaExceededError);
      assert.equal(error.quota.limit, 2);
      assert.equal(error.code, 'OWNER_AI_DAILY_LIMIT_REACHED');
      return true;
    },
  );
});
