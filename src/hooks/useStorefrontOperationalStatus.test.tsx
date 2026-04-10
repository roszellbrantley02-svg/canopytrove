import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStorefrontOperationalStatus } from './useStorefrontOperationalStatus';
import {
  clearStorefrontRepositoryCache,
  storefrontRepository,
} from '../repositories/storefrontRepository';
import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function createSummary(overrides?: Partial<StorefrontSummary>): StorefrontSummary {
  return {
    id: 'store-1',
    licenseId: 'license-1',
    marketId: 'market-1',
    displayName: 'Canopy Shop',
    legalName: 'Canopy Shop LLC',
    addressLine1: '123 Main St',
    city: 'Rochester',
    state: 'NY',
    zip: '14604',
    coordinates: {
      latitude: 43.1566,
      longitude: -77.6088,
    },
    distanceMiles: 1.2,
    travelMinutes: 5,
    rating: 4.6,
    reviewCount: 22,
    openNow: true,
    hours: [],
    isVerified: true,
    mapPreviewLabel: 'Downtown',
    ...overrides,
  };
}

function createDetail(overrides?: Partial<StorefrontDetails>): StorefrontDetails {
  return {
    storefrontId: 'store-1',
    phone: null,
    website: null,
    hours: [],
    openNow: null,
    hasOwnerClaim: false,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    favoriteFollowerCount: null,
    ownerFeaturedBadges: [],
    activePromotions: [],
    photoCount: 0,
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
    ...overrides,
  };
}

describe('useStorefrontOperationalStatus', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useStorefrontOperationalStatus> | null = null;

  beforeEach(() => {
    clearStorefrontRepositoryCache();
    renderer = null;
    latestValue = null;
  });

  afterEach(() => {
    renderer?.unmount();
    clearStorefrontRepositoryCache();
  });

  function HookHarness({ storefront }: { storefront: StorefrontSummary }) {
    latestValue = useStorefrontOperationalStatus(storefront);
    return null;
  }

  it('updates card status when cached detail data becomes available', () => {
    const storefront = createSummary({ openNow: true, hours: [] });
    const today = DAY_NAMES[new Date().getDay()];

    act(() => {
      renderer = create(<HookHarness storefront={storefront} />);
    });

    expect(latestValue?.openNow).toBe(true);

    act(() => {
      storefrontRepository.primeStorefrontDetails(
        storefront.id,
        createDetail({
          hours: [`${today}: Closed`],
          openNow: false,
        }),
      );
    });

    expect(latestValue?.openNow).toBe(false);
  });
});
