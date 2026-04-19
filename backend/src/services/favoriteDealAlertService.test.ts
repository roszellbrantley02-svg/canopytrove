import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { StorefrontSummaryApiDocument } from '../types';
import { backendStorefrontSource } from '../sources';
import { clearStorefrontBackendCache } from './storefrontCacheService';

const favoriteDealAlertServicePath = require.resolve('./favoriteDealAlertService');
const originalGetSummariesByIds = backendStorefrontSource.getSummariesByIds;

function createSummary(
  overrides: Partial<StorefrontSummaryApiDocument> = {},
): StorefrontSummaryApiDocument {
  return {
    id: 'storefront-1',
    licenseId: 'license-1',
    marketId: 'market-1',
    displayName: 'Storefront One',
    legalName: 'Storefront One LLC',
    addressLine1: '123 Main St',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    latitude: 42.6526,
    longitude: -73.7562,
    distanceMiles: 1.2,
    travelMinutes: 4,
    rating: 4.6,
    reviewCount: 18,
    openNow: true,
    hours: ['Mon-Fri 9:00 AM-9:00 PM'],
    isVerified: true,
    mapPreviewLabel: 'Albany dispensary',
    promotionText: '20% off flower',
    promotionBadges: ['Hot deal'],
    promotionExpiresAt: null,
    activePromotionId: 'promo-1',
    activePromotionCount: 1,
    favoriteFollowerCount: 12,
    menuUrl: 'https://example.com/menu',
    verifiedOwnerBadgeLabel: 'Verified owner',
    ownerFeaturedBadges: ['Women-owned'],
    ownerCardSummary: 'Fresh owner summary.',
    premiumCardVariant: 'hot_deal',
    promotionPlacementSurfaces: ['browse'],
    promotionPlacementScope: 'storefront_area',
    placeId: 'place-1',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    promotionAndroidEligible: true,
    isVisible: true,
    ...overrides,
  };
}

afterEach(() => {
  backendStorefrontSource.getSummariesByIds = originalGetSummariesByIds;
  clearStorefrontBackendCache();
  delete require.cache[favoriteDealAlertServicePath];
});

test('syncFavoriteDealAlerts removes hidden storefront promotions from saved alert state', async () => {
  let currentSummaries = [
    createSummary({
      id: 'visible-storefront',
      displayName: 'Visible Storefront',
      promotionText: '20% off flower',
      isVisible: true,
    }),
    createSummary({
      id: 'hidden-storefront',
      displayName: 'Hidden Storefront',
      promotionText: 'Secret deal',
      isVisible: true,
    }),
  ];

  backendStorefrontSource.getSummariesByIds = async () => currentSummaries;
  clearStorefrontBackendCache();
  delete require.cache[favoriteDealAlertServicePath];

  const { syncFavoriteDealAlerts } =
    require('./favoriteDealAlertService') as typeof import('./favoriteDealAlertService');

  const firstSync = await syncFavoriteDealAlerts({
    profileId: 'profile-hidden-filter',
    savedStorefrontIds: ['visible-storefront', 'hidden-storefront'],
    allowNotifications: false,
  });

  assert.deepEqual(firstSync.state.activeDealFingerprintsByStorefrontId, {
    'hidden-storefront': 'secret deal',
    'visible-storefront': '20% off flower',
  });

  currentSummaries = [
    createSummary({
      id: 'visible-storefront',
      displayName: 'Visible Storefront',
      promotionText: '20% off flower',
      isVisible: true,
    }),
    createSummary({
      id: 'hidden-storefront',
      displayName: 'Hidden Storefront',
      promotionText: 'Secret deal',
      isVisible: false,
    }),
  ];

  clearStorefrontBackendCache();
  const secondSync = await syncFavoriteDealAlerts({
    profileId: 'profile-hidden-filter',
    savedStorefrontIds: ['visible-storefront', 'hidden-storefront'],
    allowNotifications: false,
  });

  assert.deepEqual(secondSync.notifications, []);
  assert.deepEqual(secondSync.state.activeDealFingerprintsByStorefrontId, {
    'visible-storefront': '20% off flower',
  });
});
