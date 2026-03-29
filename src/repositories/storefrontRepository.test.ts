import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontDetails, StorefrontSummary } from '../types/storefront';

const sourceMocks = vi.hoisted(() => ({
  getSummaryPage: vi.fn(),
  getAllSummaries: vi.fn(),
  getSummariesByIds: vi.fn(),
  getDetailsById: vi.fn(),
}));

vi.mock('../sources', () => ({
  storefrontSource: {
    getAllSummaries: sourceMocks.getAllSummaries,
    getSummariesByIds: sourceMocks.getSummariesByIds,
    getSummaryPage: sourceMocks.getSummaryPage,
    getSummaries: vi.fn(),
    getDetailsById: sourceMocks.getDetailsById,
  },
}));

vi.mock('../config/storefrontSourceConfig', () => ({
  storefrontSourceMode: 'mock',
}));

vi.mock('../services/storefrontCommunityLocalService', () => ({
  mergeLocalStorefrontCommunityIntoDetail: (detail: unknown) => detail,
}));

import { clearStorefrontRepositoryCache, storefrontRepository } from './storefrontRepository';

function createSummary(id: string, distanceMiles: number): StorefrontSummary {
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
      latitude: 40.7128 + distanceMiles / 1000,
      longitude: -74.006,
    },
    distanceMiles,
    travelMinutes: Math.max(3, Math.round(distanceMiles * 2)),
    rating: 4.5,
    reviewCount: 10,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: `${distanceMiles.toFixed(1)} mi route preview`,
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    thumbnailUrl: null,
  };
}

function createDetail(storefrontId: string): StorefrontDetails {
  return {
    storefrontId,
    phone: '555-0100',
    website: 'https://example.com',
    hours: ['Mon-Fri 9am-9pm'],
    openNow: true,
    hasOwnerClaim: false,
    appReviewCount: 1,
    appReviews: [
      {
        id: 'review-1',
        authorName: 'CanopyTrove user',
        authorProfileId: 'profile-1',
        rating: 5,
        relativeTime: 'Just now',
        text: 'Solid selection.',
        tags: [],
        helpfulCount: 0,
      },
    ],
    photoUrls: [],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
  };
}

describe('storefrontRepository.getNearbySummaries', () => {
  beforeEach(() => {
    clearStorefrontRepositoryCache();
    sourceMocks.getSummaryPage.mockReset();
    sourceMocks.getAllSummaries.mockReset();
    sourceMocks.getSummariesByIds.mockReset();
    sourceMocks.getDetailsById.mockReset();
  });

  it('returns the radius-bounded first page when it already has three results', async () => {
    const nearbyItems = [createSummary('a', 0.8), createSummary('b', 1.2), createSummary('c', 1.9)];
    sourceMocks.getSummaryPage.mockResolvedValueOnce({
      items: nearbyItems,
      total: 3,
      limit: 3,
      offset: 0,
    });

    const result = await storefrontRepository.getNearbySummaries({
      areaId: 'nyc',
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
      locationLabel: 'New York, NY',
    });

    expect(result).toEqual(nearbyItems);
    expect(sourceMocks.getSummaryPage).toHaveBeenCalledTimes(1);
    expect(sourceMocks.getSummaryPage).toHaveBeenCalledWith({
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
      radiusMiles: 35,
      sortKey: 'distance',
      limit: 3,
      offset: 0,
      prioritySurface: 'nearby',
    });
  });

  it('falls back to unrestricted origin search when the radius page underfills', async () => {
    const localItems = [createSummary('a', 0.8), createSummary('b', 1.2)];
    const fallbackItems = [createSummary('a', 0.8), createSummary('b', 1.2), createSummary('c', 36.4)];

    sourceMocks.getSummaryPage
      .mockResolvedValueOnce({
        items: localItems,
        total: 2,
        limit: 3,
        offset: 0,
      })
      .mockResolvedValueOnce({
        items: fallbackItems,
        total: 3,
        limit: 3,
        offset: 0,
      });

    const result = await storefrontRepository.getNearbySummaries({
      areaId: 'nyc',
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
      locationLabel: 'New York, NY',
    });

    expect(result).toEqual(fallbackItems);
    expect(sourceMocks.getSummaryPage).toHaveBeenCalledTimes(2);
    expect(sourceMocks.getSummaryPage).toHaveBeenNthCalledWith(1, {
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
      radiusMiles: 35,
      sortKey: 'distance',
      limit: 3,
      offset: 0,
      prioritySurface: 'nearby',
    });
    expect(sourceMocks.getSummaryPage).toHaveBeenNthCalledWith(2, {
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
      sortKey: 'distance',
      limit: 3,
      offset: 0,
      prioritySurface: 'nearby',
    });
  });
});

describe('storefrontRepository.getBrowseSummaries', () => {
  beforeEach(() => {
    clearStorefrontRepositoryCache();
    sourceMocks.getSummaryPage.mockReset();
    sourceMocks.getAllSummaries.mockReset();
  });

  it('pages statewide browse results without the nearby radius cap', async () => {
    const browseItems = [
      createSummary('a', 2.1),
      createSummary('b', 6.4),
      createSummary('c', 42.8),
      createSummary('d', 155.2),
    ];
    sourceMocks.getSummaryPage.mockResolvedValueOnce({
      items: browseItems,
      total: 12,
      limit: 4,
      offset: 0,
    });

    const result = await storefrontRepository.getBrowseSummaries(
      {
        areaId: 'all',
        searchQuery: '',
        origin: { latitude: 40.7128, longitude: -74.006 },
        locationLabel: 'New York, NY',
      },
      'distance',
      4,
      0
    );

    expect(result).toEqual({
      items: browseItems,
      total: 12,
      limit: 4,
      offset: 0,
      hasMore: true,
    });
    expect(sourceMocks.getSummaryPage).toHaveBeenCalledWith({
      areaId: undefined,
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
      sortKey: 'distance',
      limit: 4,
      offset: 0,
      prioritySurface: 'browse',
    });
  });

  it('builds hot-deal browse pages from all known summaries', async () => {
    sourceMocks.getAllSummaries.mockResolvedValue([
      {
        ...createSummary('deal-1', 4.8),
        promotionText: '15% off pre-rolls',
      },
      {
        ...createSummary('deal-2', 8.2),
        promotionText: null,
      },
      {
        ...createSummary('deal-3', 12.5),
        promotionText: 'Free edible with purchase',
      },
    ]);

    const result = await storefrontRepository.getBrowseSummaries(
      {
        areaId: 'all',
        searchQuery: '',
        origin: { latitude: 40.7128, longitude: -74.006 },
        locationLabel: 'New York, NY',
        hotDealsOnly: true,
      },
      'distance',
      4,
      0
    );

    expect(sourceMocks.getSummaryPage).not.toHaveBeenCalled();
    expect(sourceMocks.getAllSummaries).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(['deal-1', 'deal-3']);
    expect(result.hasMore).toBe(false);
  });
});

describe('storefrontRepository.getStorefrontDetails', () => {
  beforeEach(() => {
    clearStorefrontRepositoryCache();
    sourceMocks.getDetailsById.mockReset();
  });

  it('reuses the in-memory detail cache for repeat loads', async () => {
    const detail = createDetail('store-1');
    sourceMocks.getDetailsById.mockResolvedValue(detail);

    const first = await storefrontRepository.getStorefrontDetails('store-1');
    const second = await storefrontRepository.getStorefrontDetails('store-1');

    expect(first).toEqual(detail);
    expect(second).toEqual(detail);
    expect(sourceMocks.getDetailsById).toHaveBeenCalledTimes(1);
  });
});
