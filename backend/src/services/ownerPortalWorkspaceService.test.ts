import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOwnerPrivateStorefrontSnapshot } from './ownerPortalWorkspaceService';

test('buildOwnerPrivateStorefrontSnapshot supports registry-style storefront records', () => {
  const snapshot = buildOwnerPrivateStorefrontSnapshot(
    'demo-storefront',
    {
      storefrontName: 'Reviewer Demo Store',
      legalBusinessName: 'Reviewer Demo Holdings LLC',
      address: '120 Demo Ave',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    'Reviewer-only demo storefront',
    ['Private demo'],
  );

  assert.deepEqual(snapshot, {
    id: 'demo-storefront',
    displayName: 'Reviewer Demo Store',
    addressLine1: '120 Demo Ave',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    promotionText: 'Reviewer-only demo storefront',
    promotionBadges: ['Private demo'],
  });
});

test('buildOwnerPrivateStorefrontSnapshot supports summary-style storefront records', () => {
  const snapshot = buildOwnerPrivateStorefrontSnapshot('demo-storefront', {
    displayName: 'Reviewer Demo Store',
    legalName: 'Reviewer Demo Holdings LLC',
    addressLine1: '120 Demo Ave',
    city: 'New York',
    state: 'NY',
    zip: '10001',
  });

  assert.deepEqual(snapshot, {
    id: 'demo-storefront',
    displayName: 'Reviewer Demo Store',
    addressLine1: '120 Demo Ave',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    promotionText: null,
    promotionBadges: [],
  });
});

test('buildOwnerPrivateStorefrontSnapshot returns null when no storefront name is available', () => {
  const snapshot = buildOwnerPrivateStorefrontSnapshot('demo-storefront', {
    addressLine1: '120 Demo Ave',
    city: 'New York',
    state: 'NY',
    zip: '10001',
  });

  assert.equal(snapshot, null);
});
