import assert from 'node:assert/strict';
import test from 'node:test';
import { isCompleteStorefrontSummaryDocument } from './firestoreStorefrontSource';

test('isCompleteStorefrontSummaryDocument rejects sparse ghost summaries', () => {
  assert.equal(
    isCompleteStorefrontSummaryDocument({
      placeId: 'ChIJTcHmhGdZwokRwnIFhap40EQ',
    }),
    false,
  );
});

test('isCompleteStorefrontSummaryDocument accepts published storefront summaries', () => {
  assert.equal(
    isCompleteStorefrontSummaryDocument({
      licenseId: 'license-1',
      marketId: 'nyc',
      displayName: 'Culture House',
      legalName: 'Culture House',
      addressLine1: '958 Sixth Ave',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      latitude: 40.750355691258,
      longitude: -73.987276115973,
      distanceMiles: 1.4,
      travelMinutes: 8,
      rating: 4.8,
      reviewCount: 200,
      openNow: true,
      isVerified: true,
      mapPreviewLabel: '1.4 mi route preview',
    }),
    true,
  );
});

test('isCompleteStorefrontSummaryDocument rejects malformed partial summaries missing published metrics', () => {
  assert.equal(
    isCompleteStorefrontSummaryDocument({
      licenseId: 'license-1',
      marketId: 'nyc',
      displayName: 'Culture House',
      legalName: 'Culture House',
      addressLine1: '958 Sixth Ave',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      latitude: 40.750355691258,
      longitude: -73.987276115973,
      distanceMiles: 1.4,
      travelMinutes: 8,
      rating: 4.8,
      reviewCount: 200,
      isVerified: true,
      mapPreviewLabel: '1.4 mi route preview',
    }),
    false,
  );
});
