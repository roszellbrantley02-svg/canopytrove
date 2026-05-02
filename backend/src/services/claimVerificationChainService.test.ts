import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateClaimChain, type ClaimEvaluationInput } from './claimVerificationChainService';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';

function ocmRecord(overrides: Partial<OcmLicenseRecord> = {}): OcmLicenseRecord {
  return {
    license_number: 'OCM-RETL-24-000053',
    license_type: 'Adult-Use Retail Dispensary',
    licensee_name: 'Twisted Cannabis FLX LLC',
    license_status: 'Active',
    address: '501 Exchange St',
    city: 'Geneva',
    state: 'NY',
    zip_code: '14456',
    ...overrides,
  };
}

function claim(overrides: Partial<ClaimEvaluationInput> = {}): ClaimEvaluationInput {
  return {
    claimId: 'owner-1__shop-primary',
    ownerUid: 'owner-1',
    dispensaryId: 'shop-primary',
    claimStatus: 'pending',
    shopOwnershipVerified: true,
    ocmRecord: ocmRecord(),
    ocmConfidence: 'address',
    ...overrides,
  };
}

// ============================================================================
// Single-claim path
// ============================================================================

test('single claim: approves when OTP verified + OCM match present', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [claim()],
  });

  assert.equal(result.isCluster, false);
  assert.equal(result.clusterSize, 1);
  const verdict = result.verdicts.get('owner-1__shop-primary');
  assert.equal(verdict?.approved, true);
  if (verdict?.approved) {
    assert.equal(verdict.reason, 'single_claim_passed');
    assert.equal(verdict.clusterSize, 1);
  }
});

test('single claim: defers when claim is already approved', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [claim({ claimStatus: 'approved' })],
  });
  const verdict = result.verdicts.get('owner-1__shop-primary');
  assert.equal(verdict?.approved, false);
  if (!verdict?.approved) assert.equal(verdict?.reason, 'claim_not_pending');
});

test('single claim: defers when OTP not verified', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [claim({ shopOwnershipVerified: false })],
  });
  const verdict = result.verdicts.get('owner-1__shop-primary');
  assert.equal(verdict?.approved, false);
  if (!verdict?.approved) assert.equal(verdict?.reason, 'shop_phone_not_verified');
});

test('single claim: defers when OCM confidence is none', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [claim({ ocmConfidence: 'none', ocmRecord: null })],
  });
  const verdict = result.verdicts.get('owner-1__shop-primary');
  assert.equal(verdict?.approved, false);
  if (!verdict?.approved) assert.equal(verdict?.reason, 'ocm_not_matched');
});

// ============================================================================
// 2-shop cluster (1 sibling)
// ============================================================================

test('2-shop cluster: approves both when entity_name matches and primary OTP verified', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [
      claim({ claimId: 'owner-1__shop-primary', dispensaryId: 'shop-primary' }),
      claim({
        claimId: 'owner-1__shop-sibling',
        dispensaryId: 'shop-sibling',
        shopOwnershipVerified: false, // Sibling doesn't need OTP for 2-shop cluster
        ocmRecord: ocmRecord({
          license_number: 'OCM-RETL-26-000485',
          address: '4123 State Route 96',
          city: 'Manchester',
          zip_code: '14504',
        }),
      }),
    ],
  });

  assert.equal(result.isCluster, true);
  assert.equal(result.clusterSize, 2);
  const primaryVerdict = result.verdicts.get('owner-1__shop-primary');
  const siblingVerdict = result.verdicts.get('owner-1__shop-sibling');
  assert.equal(primaryVerdict?.approved, true);
  assert.equal(siblingVerdict?.approved, true);
  if (siblingVerdict?.approved) assert.equal(siblingVerdict.reason, 'cluster_member_passed');
});

test('2-shop cluster: defers sibling when entity_name does NOT match', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [
      claim({ claimId: 'owner-1__shop-primary', dispensaryId: 'shop-primary' }),
      claim({
        claimId: 'owner-1__shop-sibling',
        dispensaryId: 'shop-sibling',
        shopOwnershipVerified: false,
        ocmRecord: ocmRecord({
          license_number: 'OCM-RETL-26-OTHER',
          licensee_name: 'Different Entity LLC',
        }),
      }),
    ],
  });

  const primaryVerdict = result.verdicts.get('owner-1__shop-primary');
  const siblingVerdict = result.verdicts.get('owner-1__shop-sibling');
  assert.equal(primaryVerdict?.approved, true); // Primary still passes on its own
  assert.equal(siblingVerdict?.approved, false);
  if (!siblingVerdict?.approved) assert.equal(siblingVerdict?.reason, 'cluster_entity_mismatch');
});

test('2-shop cluster: collapses entire cluster when primary OTP not verified', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [
      claim({ claimId: 'owner-1__shop-primary', shopOwnershipVerified: false }),
      claim({ claimId: 'owner-1__shop-sibling', shopOwnershipVerified: true }),
    ],
  });
  // Both denied with primary's failure reason — cluster requires verified anchor.
  assert.equal(result.verdicts.get('owner-1__shop-primary')?.approved, false);
  assert.equal(result.verdicts.get('owner-1__shop-sibling')?.approved, false);
});

// ============================================================================
// 3+ shop cluster (dual-OTP requirement)
// ============================================================================

test('3-shop cluster: defers all when no sibling has OTP verified (dual-OTP requirement)', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [
      claim({ claimId: 'owner-1__shop-primary', shopOwnershipVerified: true }),
      claim({ claimId: 'owner-1__shop-sib1', shopOwnershipVerified: false }),
      claim({ claimId: 'owner-1__shop-sib2', shopOwnershipVerified: false }),
    ],
  });

  assert.equal(result.clusterSize, 3);
  for (const verdict of result.verdicts.values()) {
    assert.equal(verdict.approved, false);
    if (!verdict.approved) assert.equal(verdict.reason, 'cluster_dual_otp_required');
  }
});

test('3-shop cluster: approves all when primary AND one sibling have OTP verified', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [
      claim({ claimId: 'owner-1__shop-primary', shopOwnershipVerified: true }),
      claim({ claimId: 'owner-1__shop-sib1', shopOwnershipVerified: true }),
      claim({ claimId: 'owner-1__shop-sib2', shopOwnershipVerified: false }),
    ],
  });

  for (const verdict of result.verdicts.values()) {
    assert.equal(verdict.approved, true);
  }
});

test('dualOtpThreshold=2 forces 2-shop clusters to also require dual OTP', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    dualOtpThreshold: 2,
    claims: [
      claim({ claimId: 'owner-1__shop-primary', shopOwnershipVerified: true }),
      claim({ claimId: 'owner-1__shop-sibling', shopOwnershipVerified: false }),
    ],
  });
  assert.equal(result.verdicts.get('owner-1__shop-primary')?.approved, false);
  assert.equal(result.verdicts.get('owner-1__shop-sibling')?.approved, false);
});

// ============================================================================
// Edge cases
// ============================================================================

test('returns primary_not_in_input when primaryClaimId not in claims list', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'nonexistent',
    claims: [claim({ claimId: 'owner-1__shop-other' })],
  });
  const verdict = result.verdicts.get('owner-1__shop-other');
  assert.equal(verdict?.approved, false);
  if (!verdict?.approved) assert.equal(verdict?.reason, 'primary_not_in_input');
});

test('entity_name match is case-insensitive (uses normalized key)', () => {
  const result = evaluateClaimChain({
    ownerUid: 'owner-1',
    primaryClaimId: 'owner-1__shop-primary',
    claims: [
      claim({
        claimId: 'owner-1__shop-primary',
        ocmRecord: ocmRecord({ licensee_name: 'Twisted Cannabis FLX LLC' }),
      }),
      claim({
        claimId: 'owner-1__shop-sibling',
        shopOwnershipVerified: false,
        // Same entity, different casing — must still match.
        ocmRecord: ocmRecord({
          license_number: 'OCM-RETL-26-OTHER',
          licensee_name: 'TWISTED CANNABIS FLX LLC',
        }),
      }),
    ],
  });
  assert.equal(result.verdicts.get('owner-1__shop-sibling')?.approved, true);
});
