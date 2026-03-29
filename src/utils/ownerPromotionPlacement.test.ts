import { describe, expect, it } from 'vitest';
import { StorefrontSummary } from '../types/storefront';
import {
  matchesPriorityPlacement,
  sortSummariesByPriorityPlacement,
} from './ownerPromotionPlacement';

function createSummary(
  id: string,
  options: Partial<StorefrontSummary> = {}
): StorefrontSummary {
  return {
    id,
    licenseId: `license-${id}`,
    marketId: 'nyc',
    displayName: `Store ${id}`,
    legalName: `Store ${id} LLC`,
    addressLine1: `${id} Main St`,
    city: 'New York',
    state: 'NY',
    zip: '10001',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    distanceMiles: 1,
    travelMinutes: 4,
    rating: 4.5,
    reviewCount: 10,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: '1.0 mi route preview',
    ...options,
  };
}

describe('ownerPromotionPlacement', () => {
  it('matches storefront-area boosts on nearby without an explicit area filter', () => {
    const summary = createSummary('priority-1', {
      activePromotionId: 'promo-1',
      promotionPlacementSurfaces: ['nearby'],
      promotionPlacementScope: 'storefront_area',
    });

    expect(matchesPriorityPlacement(summary, { surface: 'nearby' })).toBe(true);
  });

  it('only matches storefront-area browse boosts inside the matching area', () => {
    const summary = createSummary('priority-2', {
      activePromotionId: 'promo-2',
      marketId: 'finger-lakes',
      promotionPlacementSurfaces: ['browse'],
      promotionPlacementScope: 'storefront_area',
    });

    expect(
      matchesPriorityPlacement(summary, { surface: 'browse', areaId: 'finger-lakes' })
    ).toBe(true);
    expect(matchesPriorityPlacement(summary, { surface: 'browse', areaId: 'all' })).toBe(false);
  });

  it('moves matching hot deals ahead of regular items while preserving original order inside each group', () => {
    const regular = createSummary('regular', { distanceMiles: 1.2 });
    const boosted = createSummary('boosted', {
      distanceMiles: 4.6,
      activePromotionId: 'promo-boosted',
      promotionPlacementSurfaces: ['hot_deals'],
      promotionPlacementScope: 'statewide',
      premiumCardVariant: 'hot_deal',
    });
    const secondaryBoosted = createSummary('boosted-2', {
      distanceMiles: 6.1,
      activePromotionId: 'promo-boosted-2',
      promotionPlacementSurfaces: ['hot_deals'],
      promotionPlacementScope: 'statewide',
      premiumCardVariant: 'owner_featured',
    });

    expect(
      sortSummariesByPriorityPlacement([regular, boosted, secondaryBoosted], {
        surface: 'hot_deals',
        areaId: 'all',
      }).map((item) => item.id)
    ).toEqual(['boosted', 'boosted-2', 'regular']);
  });
});
