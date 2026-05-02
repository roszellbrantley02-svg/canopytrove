import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { serverConfig } from '../config';
import {
  BULK_CLAIM_MAX_SIZE,
  getBulkClaimBatchStatus,
  getSiblingsForOwnerStorefront,
  submitBulkClaim,
} from './bulkClaimService';

// PR-D unit tests focus on the flag-gating + input validation surface of the
// bulk claim service. The full Firestore happy path is exercised by the
// route-level integration tests in app.test.ts (where the in-memory Firestore
// fake covers create/read/transaction semantics). Keeps unit tests fast and
// independent of Firebase setup.

const originalBulkFlag = serverConfig.bulkClaimEnabled;

function setFlag(value: boolean) {
  (serverConfig as { bulkClaimEnabled: boolean }).bulkClaimEnabled = value;
}

beforeEach(() => {
  setFlag(originalBulkFlag);
});

afterEach(() => {
  setFlag(originalBulkFlag);
});

test('submitBulkClaim returns feature_disabled when flag is off', async () => {
  setFlag(false);
  const result = await submitBulkClaim({
    ownerUid: 'owner-1',
    primaryDispensaryId: 'shop-primary',
    siblingDispensaryIds: ['shop-sibling-1'],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'feature_disabled');
});

test('submitBulkClaim rejects empty ownerUid', async () => {
  setFlag(true);
  const result = await submitBulkClaim({
    ownerUid: '',
    primaryDispensaryId: 'shop-primary',
    siblingDispensaryIds: ['shop-sibling-1'],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'invalid_input');
});

test('submitBulkClaim rejects empty primaryDispensaryId', async () => {
  setFlag(true);
  const result = await submitBulkClaim({
    ownerUid: 'owner-1',
    primaryDispensaryId: '',
    siblingDispensaryIds: ['shop-sibling-1'],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'invalid_input');
});

test(`submitBulkClaim rejects more than ${BULK_CLAIM_MAX_SIZE} total cluster size`, async () => {
  setFlag(true);
  // Cluster = 1 primary + N siblings. Reject when N + 1 > MAX.
  const siblings = Array.from({ length: BULK_CLAIM_MAX_SIZE }, (_, i) => `shop-${i}`);
  const result = await submitBulkClaim({
    ownerUid: 'owner-1',
    primaryDispensaryId: 'shop-primary',
    siblingDispensaryIds: siblings,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'too_many_locations');
});

test('submitBulkClaim rejects duplicate sibling dispensaryIds', async () => {
  setFlag(true);
  const result = await submitBulkClaim({
    ownerUid: 'owner-1',
    primaryDispensaryId: 'shop-primary',
    siblingDispensaryIds: ['shop-sibling-1', 'shop-sibling-2', 'shop-sibling-1'],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'duplicate_locations');
});

test('submitBulkClaim drops sibling IDs that match primary (no error, just filters)', async () => {
  setFlag(true);
  // Primary in siblings list should be silently filtered. Then we need a db
  // for the next step, which we don't have, so result will be db_unavailable
  // after passing validation.
  const result = await submitBulkClaim({
    ownerUid: 'owner-1',
    primaryDispensaryId: 'shop-primary',
    siblingDispensaryIds: ['shop-primary', 'shop-sibling-1'],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'db_unavailable');
});

test('submitBulkClaim trims whitespace and ignores blank entries', async () => {
  setFlag(true);
  const result = await submitBulkClaim({
    ownerUid: 'owner-1',
    primaryDispensaryId: '  shop-primary  ',
    siblingDispensaryIds: ['  shop-sibling-1  ', '', '  shop-sibling-2  '],
  });
  // Validation passes; db check fails since we have no Firebase configured.
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'db_unavailable');
});

test('getBulkClaimBatchStatus returns null when flag is off', async () => {
  setFlag(false);
  const result = await getBulkClaimBatchStatus({
    ownerUid: 'owner-1',
    batchId: 'batch_xyz',
  });
  assert.equal(result, null);
});

test('getSiblingsForOwnerStorefront returns null when flag is off', async () => {
  setFlag(false);
  const result = await getSiblingsForOwnerStorefront({
    ownerUid: 'owner-1',
    dispensaryId: 'shop-1',
  });
  assert.equal(result, null);
});

test('getSiblingsForOwnerStorefront returns null when dispensaryId is empty', async () => {
  setFlag(true);
  const result = await getSiblingsForOwnerStorefront({
    ownerUid: 'owner-1',
    dispensaryId: '',
  });
  assert.equal(result, null);
});
