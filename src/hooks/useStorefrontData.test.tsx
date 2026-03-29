import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontDetails, StorefrontSummary } from '../types/storefront';

const snapshotMocks = vi.hoisted(() => ({
  getCachedLatestNearbySummarySnapshot: vi.fn(),
  getCachedStorefrontDetailSnapshot: vi.fn(),
  loadLatestNearbySummarySnapshot: vi.fn(),
  loadStorefrontDetailSnapshot: vi.fn(),
}));

const repositoryMocks = vi.hoisted(() => ({
  getCachedStorefrontDetails: vi.fn(),
  getStorefrontDetails: vi.fn(),
  invalidateStorefrontDetails: vi.fn(),
}));

const runtimeReportingMocks = vi.hoisted(() => ({
  reportRuntimeError: vi.fn(),
}));

const operationalDataMocks = vi.hoisted(() => ({
  applyStorefrontOperationalEnrichment: vi.fn(),
  needsStorefrontOperationalEnrichment: vi.fn(),
}));

vi.mock('../repositories/storefrontRepository', () => ({
  storefrontRepository: repositoryMocks,
}));

vi.mock('../config/storefrontSourceConfig', () => ({
  storefrontSourceMode: 'api',
}));

vi.mock('../services/runtimeReportingService', () => ({
  reportRuntimeError: runtimeReportingMocks.reportRuntimeError,
}));

vi.mock('../services/storefrontOperationalDataService', () => ({
  applyStorefrontOperationalEnrichment: operationalDataMocks.applyStorefrontOperationalEnrichment,
  needsStorefrontOperationalEnrichment: operationalDataMocks.needsStorefrontOperationalEnrichment,
}));

vi.mock('../services/recentStorefrontService', () => ({
  getCachedRecentStorefrontIds: vi.fn(() => []),
  loadRecentStorefrontIds: vi.fn(async () => []),
  subscribeToRecentStorefrontIds: vi.fn(() => () => undefined),
}));

vi.mock('../services/storefrontSummarySnapshotService', () => ({
  getCachedBrowseSummarySnapshot: vi.fn(() => null),
  getCachedLatestNearbySummarySnapshot: snapshotMocks.getCachedLatestNearbySummarySnapshot,
  getCachedNearbySummarySnapshot: vi.fn(() => null),
  getCachedStorefrontDetailSnapshot: snapshotMocks.getCachedStorefrontDetailSnapshot,
  loadBrowseSummarySnapshot: vi.fn(async () => null),
  loadLatestNearbySummarySnapshot: snapshotMocks.loadLatestNearbySummarySnapshot,
  loadNearbySummarySnapshot: vi.fn(async () => null),
  loadStorefrontDetailSnapshot: snapshotMocks.loadStorefrontDetailSnapshot,
  saveBrowseSummarySnapshot: vi.fn(async () => undefined),
  saveStorefrontDetailSnapshot: vi.fn(async () => undefined),
  saveNearbySummarySnapshot: vi.fn(async () => undefined),
  subscribeToStorefrontDetailSnapshot: vi.fn(() => () => undefined),
}));

import { useNearbyWarmSnapshot, useStorefrontDetails } from './useStorefrontData';

function createSummary(id: string): StorefrontSummary {
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
    rating: 4.7,
    reviewCount: 12,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: '1.0 mi route preview',
    thumbnailUrl: null,
  };
}

function createDetail(storefrontId: string, overrides?: Partial<StorefrontDetails>): StorefrontDetails {
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
        tags: ['Friendly staff'],
        helpfulCount: 0,
      },
    ],
    photoUrls: [],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
    ...overrides,
  };
}

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('useNearbyWarmSnapshot', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: StorefrontSummary[] = [];

  beforeEach(() => {
    latestValue = [];
    renderer?.unmount();
    renderer = null;
    snapshotMocks.getCachedLatestNearbySummarySnapshot.mockReset();
    snapshotMocks.getCachedStorefrontDetailSnapshot.mockReset();
    snapshotMocks.loadLatestNearbySummarySnapshot.mockReset();
    snapshotMocks.loadStorefrontDetailSnapshot.mockReset();
    repositoryMocks.getCachedStorefrontDetails.mockReset();
    repositoryMocks.getStorefrontDetails.mockReset();
    operationalDataMocks.applyStorefrontOperationalEnrichment.mockReset();
    operationalDataMocks.needsStorefrontOperationalEnrichment.mockReset();
    operationalDataMocks.applyStorefrontOperationalEnrichment.mockImplementation(async (detail) => detail);
    operationalDataMocks.needsStorefrontOperationalEnrichment.mockReturnValue(false);
  });

  function HookHarness() {
    latestValue = useNearbyWarmSnapshot();
    return null;
  }

  it('returns cached warm Nearby data immediately when it exists', () => {
    const cached = [createSummary('cached')];
    snapshotMocks.getCachedLatestNearbySummarySnapshot.mockReturnValue(cached);

    act(() => {
      renderer = create(<HookHarness />);
    });

    expect(latestValue).toEqual(cached);
    expect(snapshotMocks.loadLatestNearbySummarySnapshot).not.toHaveBeenCalled();
  });

  it('hydrates from the async warm snapshot when memory is empty', async () => {
    const loaded = [createSummary('loaded')];
    snapshotMocks.getCachedLatestNearbySummarySnapshot
      .mockReturnValueOnce(null)
      .mockReturnValue(null);
    snapshotMocks.loadLatestNearbySummarySnapshot.mockResolvedValue(loaded);

    act(() => {
      renderer = create(<HookHarness />);
    });

    expect(latestValue).toEqual([]);

    await act(async () => {
      await flushPromises();
    });

    expect(snapshotMocks.loadLatestNearbySummarySnapshot).toHaveBeenCalledTimes(1);
    expect(latestValue).toEqual(loaded);
  });
});

describe('useStorefrontDetails', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: {
    data: StorefrontDetails | null;
    isLoading: boolean;
    isOperationalDataPending: boolean;
    error: string | null;
  } = {
    data: null,
    isLoading: false,
    isOperationalDataPending: false,
    error: null,
  };

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    latestValue = { data: null, isLoading: false, isOperationalDataPending: false, error: null };
    repositoryMocks.getCachedStorefrontDetails.mockReset();
    repositoryMocks.getStorefrontDetails.mockReset();
    repositoryMocks.invalidateStorefrontDetails.mockReset();
    snapshotMocks.getCachedStorefrontDetailSnapshot.mockReset();
    snapshotMocks.loadStorefrontDetailSnapshot.mockReset();
    runtimeReportingMocks.reportRuntimeError.mockReset();
    operationalDataMocks.applyStorefrontOperationalEnrichment.mockReset();
    operationalDataMocks.needsStorefrontOperationalEnrichment.mockReset();
    operationalDataMocks.applyStorefrontOperationalEnrichment.mockImplementation(async (detail) => detail);
    operationalDataMocks.needsStorefrontOperationalEnrichment.mockReturnValue(false);
    vi.useRealTimers();
  });

  function HookHarness() {
    latestValue = useStorefrontDetails('store-1');
    return null;
  }

  it('hydrates immediately from cached repository detail before refreshing', async () => {
    const cached = createDetail('store-1', { phone: '555-0001' });
    const live = createDetail('store-1', { phone: '555-9999' });
    repositoryMocks.getCachedStorefrontDetails.mockReturnValue(cached);
    repositoryMocks.getStorefrontDetails.mockResolvedValue(live);

    act(() => {
      renderer = create(<HookHarness />);
    });

    expect(latestValue.data).toEqual(cached);
    expect(latestValue.isLoading).toBe(false);
    expect(latestValue.isOperationalDataPending).toBe(false);

    await act(async () => {
      await flushPromises();
    });

    expect(repositoryMocks.getStorefrontDetails).toHaveBeenCalledWith('store-1');
    expect(latestValue.data).toEqual(live);
    expect(latestValue.isLoading).toBe(false);
    expect(latestValue.isOperationalDataPending).toBe(false);
  });

  it('surfaces an error when the live detail fetch fails', async () => {
    const failure = new Error('detail failed');
    repositoryMocks.getCachedStorefrontDetails.mockReturnValue(null);
    repositoryMocks.getStorefrontDetails.mockRejectedValue(failure);

    act(() => {
      renderer = create(<HookHarness />);
    });

    expect(latestValue.isLoading).toBe(true);

    await act(async () => {
      await flushPromises();
    });

    expect(runtimeReportingMocks.reportRuntimeError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        source: 'storefront-detail-fetch',
        screen: 'StorefrontDetail',
      })
    );
    expect(latestValue.data).toBeNull();
    expect(latestValue.isLoading).toBe(false);
    expect(latestValue.isOperationalDataPending).toBe(false);
    expect(latestValue.error).toBe('Unable to load the latest storefront details right now.');
  });

  it('hydrates missing operational data when the detail payload needs enrichment', async () => {
    const emptyOperationalDetail = createDetail('store-1', {
      phone: null,
      website: null,
      hours: [],
      openNow: null,
    });
    const enrichedDetail = createDetail('store-1', {
      phone: '555-7777',
      website: 'https://canopytrove.example',
      hours: ['Mon-Sun 9am-9pm'],
      openNow: false,
    });
    repositoryMocks.getCachedStorefrontDetails.mockReturnValue(null);
    repositoryMocks.getStorefrontDetails.mockResolvedValue(emptyOperationalDetail);
    operationalDataMocks.needsStorefrontOperationalEnrichment.mockReturnValue(true);
    operationalDataMocks.applyStorefrontOperationalEnrichment.mockResolvedValue(enrichedDetail);

    function OperationalHookHarness() {
      latestValue = useStorefrontDetails('store-1', createSummary('store-1'));
      return null;
    }

    act(() => {
      renderer = create(<OperationalHookHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue.isOperationalDataPending).toBe(true);

    await act(async () => {
      await flushPromises();
    });

    expect(operationalDataMocks.applyStorefrontOperationalEnrichment).toHaveBeenCalledWith(
      emptyOperationalDetail,
      expect.objectContaining({
        id: 'store-1',
      })
    );
    expect(latestValue.isOperationalDataPending).toBe(false);
    expect(latestValue.data).toEqual(enrichedDetail);
  });
});
