import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOwnerActiveLocation, assertOwnerOwnsLocation } from './ownerMultiLocationService';
import { ownerProfileStore } from './ownerPortalWorkspaceData';

// These tests exercise the pure-logic helpers that do not require Firestore.
// The in-memory ownerProfileStore is used as the data source when no DB is configured.

describe('resolveOwnerActiveLocation', () => {
  beforeEach(() => {
    ownerProfileStore.clear();
  });

  test('returns null when owner profile does not exist', async () => {
    const result = await resolveOwnerActiveLocation('no-owner', 'sf-1');
    assert.equal(result, null);
  });

  test('returns primary when no location is requested', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const result = await resolveOwnerActiveLocation('owner-1', null);
    assert.equal(result, 'primary-sf');
  });

  test('returns primary when requested ID matches primary', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const result = await resolveOwnerActiveLocation('owner-1', 'primary-sf');
    assert.equal(result, 'primary-sf');
  });

  test('returns additional location when valid', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      additionalLocationIds: ['extra-sf-1', 'extra-sf-2'],
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const result = await resolveOwnerActiveLocation('owner-1', 'extra-sf-2');
    assert.equal(result, 'extra-sf-2');
  });

  test('falls back to primary when requested ID is not in additional locations', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      additionalLocationIds: ['extra-sf-1'],
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const result = await resolveOwnerActiveLocation('owner-1', 'bogus-id');
    assert.equal(result, 'primary-sf');
  });
});

describe('assertOwnerOwnsLocation', () => {
  beforeEach(() => {
    ownerProfileStore.clear();
  });

  test('throws when owner profile does not exist', async () => {
    await assert.rejects(() => assertOwnerOwnsLocation('no-owner', 'sf-1'), {
      message: 'Owner profile not found.',
    });
  });

  test('does not throw for primary location', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await assert.doesNotReject(() => assertOwnerOwnsLocation('owner-1', 'primary-sf'));
  });

  test('does not throw for additional location', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      additionalLocationIds: ['extra-sf-1'],
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await assert.doesNotReject(() => assertOwnerOwnsLocation('owner-1', 'extra-sf-1'));
  });

  test('throws when storefront is not owned', async () => {
    ownerProfileStore.set('owner-1', {
      ownerUid: 'owner-1',
      dispensaryId: 'primary-sf',
      additionalLocationIds: [],
      email: 'o@test.com',
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscriptionStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await assert.rejects(() => assertOwnerOwnsLocation('owner-1', 'other-sf'), {
      message: 'You do not manage this storefront location.',
    });
  });
});
