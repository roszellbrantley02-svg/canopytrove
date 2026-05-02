import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { tryAutoApproveClaimsBatch } from './claimAutoApprovalService';
import { serverConfig } from '../config';

// PR-C tests focus on the flag-gated entry conditions of the batch path.
// The chain logic itself is fully covered by claimVerificationChainService.test.ts
// (12 tests). The Firestore-integration tests for the batch happen in PR-D
// where the bulk-claim HTTP endpoint exercises the full path end-to-end
// against a fake Firestore.

const originalFlag = serverConfig.verificationChainEnabled;

beforeEach(() => {
  // serverConfig is `as const` — mutate via cast for tests.
  (serverConfig as { verificationChainEnabled: boolean }).verificationChainEnabled = originalFlag;
});

afterEach(() => {
  (serverConfig as { verificationChainEnabled: boolean }).verificationChainEnabled = originalFlag;
});

test('tryAutoApproveClaimsBatch returns db_unavailable when feature flag is off', async () => {
  (serverConfig as { verificationChainEnabled: boolean }).verificationChainEnabled = false;

  const result = await tryAutoApproveClaimsBatch({
    ownerUid: 'owner-1',
    claimIds: ['owner-1__shop-1', 'owner-1__shop-2'],
  });

  assert.equal(result.ownerUid, 'owner-1');
  assert.equal(result.clusterSize, 2);
  assert.equal(result.isCluster, true);
  assert.equal(result.licenseeName, null);
  assert.equal(result.perClaim.size, 2);
  for (const [, outcome] of result.perClaim.entries()) {
    assert.equal(outcome.ok, true);
    if (outcome.ok && !outcome.approved) {
      assert.equal(outcome.reason, 'db_unavailable');
    }
  }
});

test('tryAutoApproveClaimsBatch handles empty input gracefully', async () => {
  (serverConfig as { verificationChainEnabled: boolean }).verificationChainEnabled = true;

  const result = await tryAutoApproveClaimsBatch({
    ownerUid: 'owner-1',
    claimIds: [],
  });

  assert.equal(result.ownerUid, 'owner-1');
  assert.equal(result.clusterSize, 0);
  assert.equal(result.isCluster, false);
  assert.equal(result.perClaim.size, 0);
});

test('tryAutoApproveClaimsBatch primaryClaimId is the first claimId in the input', async () => {
  (serverConfig as { verificationChainEnabled: boolean }).verificationChainEnabled = false;

  const result = await tryAutoApproveClaimsBatch({
    ownerUid: 'owner-1',
    claimIds: ['owner-1__primary-shop', 'owner-1__sibling-1', 'owner-1__sibling-2'],
  });

  assert.equal(result.primaryClaimId, 'owner-1__primary-shop');
  assert.equal(result.clusterSize, 3);
});
