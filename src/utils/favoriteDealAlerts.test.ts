import { describe, expect, it } from 'vitest';
import {
  createFavoriteDealFingerprint,
  EMPTY_FAVORITE_DEAL_ALERT_STATE,
  getFavoriteDealAlertChanges,
} from './favoriteDealAlerts';
import type { StorefrontSummary } from '../types/storefront';

function createSummary(id: string, promotionText?: string | null): StorefrontSummary {
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
    rating: 0,
    reviewCount: 0,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: '1.0 mi route preview',
    promotionText: promotionText ?? null,
    thumbnailUrl: null,
  };
}

describe('favorite deal alerts', () => {
  it('normalizes promotion text into a stable fingerprint', () => {
    expect(createFavoriteDealFingerprint('  20%   off   flower  ')).toBe('20% off flower');
  });

  it('hydrates silently on the first sync', () => {
    const changes = getFavoriteDealAlertChanges({
      previousState: EMPTY_FAVORITE_DEAL_ALERT_STATE,
      savedSummaries: [createSummary('store-1', '20% off flower')],
      allowNotifications: true,
    });

    expect(changes.notifications).toHaveLength(0);
    expect(changes.nextState.activeDealFingerprintsByStorefrontId).toEqual({
      'store-1': '20% off flower',
    });
  });

  it('notifies when a saved storefront gets a new deal after hydration', () => {
    const changes = getFavoriteDealAlertChanges({
      previousState: {
        hasHydrated: true,
        activeDealFingerprintsByStorefrontId: {},
      },
      savedSummaries: [createSummary('store-1', '20% off flower')],
      allowNotifications: true,
    });

    expect(changes.notifications.map((summary) => summary.id)).toEqual(['store-1']);
  });

  it('does not notify during silent refreshes', () => {
    const changes = getFavoriteDealAlertChanges({
      previousState: {
        hasHydrated: true,
        activeDealFingerprintsByStorefrontId: {},
      },
      savedSummaries: [createSummary('store-1', '20% off flower')],
      allowNotifications: false,
    });

    expect(changes.notifications).toHaveLength(0);
  });
});
