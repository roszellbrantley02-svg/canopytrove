import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAppReviewAggregateFallback,
  isCompleteStorefrontSummaryDocument,
  isOwnerPrivateStorefrontDocument,
} from './firestoreStorefrontSource';

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

test('isOwnerPrivateStorefrontDocument detects owner-private storefront records', () => {
  assert.equal(isOwnerPrivateStorefrontDocument({ visibilityScope: 'owner_private' }), true);
  assert.equal(isOwnerPrivateStorefrontDocument({ visibilityScope: 'public' }), false);
  assert.equal(isOwnerPrivateStorefrontDocument({}), false);
});

test('applyAppReviewAggregateFallback uses live app review metrics when summary metrics are blank', () => {
  const result = applyAppReviewAggregateFallback(
    {
      id: 'storefront-1',
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
      rating: 0,
      reviewCount: 0,
      openNow: true,
      hours: [],
      isVerified: true,
      mapPreviewLabel: '1.4 mi route preview',
      promotionText: null,
      promotionBadges: [],
      promotionExpiresAt: null,
      activePromotionId: null,
      favoriteFollowerCount: null,
      menuUrl: null,
      verifiedOwnerBadgeLabel: null,
      ownerFeaturedBadges: [],
      ownerCardSummary: null,
      premiumCardVariant: 'standard',
      promotionPlacementSurfaces: [],
      promotionPlacementScope: null,
      thumbnailUrl: null,
    },
    {
      reviewCount: 2,
      averageRating: 4.5,
    },
  );

  assert.equal(result.reviewCount, 2);
  assert.equal(result.rating, 4.5);
});

test('applyAppReviewAggregateFallback preserves existing summary metrics when they are already populated', () => {
  const result = applyAppReviewAggregateFallback(
    {
      id: 'storefront-1',
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
      hours: [],
      isVerified: true,
      mapPreviewLabel: '1.4 mi route preview',
      promotionText: null,
      promotionBadges: [],
      promotionExpiresAt: null,
      activePromotionId: null,
      favoriteFollowerCount: null,
      menuUrl: null,
      verifiedOwnerBadgeLabel: null,
      ownerFeaturedBadges: [],
      ownerCardSummary: null,
      premiumCardVariant: 'standard',
      promotionPlacementSurfaces: [],
      promotionPlacementScope: null,
      thumbnailUrl: null,
    },
    {
      reviewCount: 2,
      averageRating: 4.5,
    },
  );

  assert.equal(result.reviewCount, 200);
  assert.equal(result.rating, 4.8);
});
