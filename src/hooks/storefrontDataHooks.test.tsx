import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import type { CanopyTroveAuthSession } from '../types/identity';

const snapshotMocks = vi.hoisted(() => ({
  getCachedBrowseSummarySnapshot: vi.fn(),
  getCachedLatestNearbySummarySnapshot: vi.fn(),
  getCachedStorefrontDetailSnapshot: vi.fn(),
  loadBrowseSummarySnapshot: vi.fn(),
  loadLatestNearbySummarySnapshot: vi.fn(),
  loadStorefrontDetailSnapshot: vi.fn(),
  saveBrowseSummarySnapshot: vi.fn(),
}));

const repositoryMocks = vi.hoisted(() => ({
  getBrowseSummaries: vi.fn(),
  getCachedStorefrontDetails: vi.fn(),
  getSavedSummaries: vi.fn(),
  getNearbySummaries: vi.fn(),
  getStorefrontDetails: vi.fn(),
  invalidateStorefrontDetails: vi.fn(),
}));

const runtimeReportingMocks = vi.hoisted(() => ({
  reportRuntimeError: vi.fn(),
}));

const storefrontPromotionOverrideMocks = vi.hoisted(() => ({
  getStorefrontPromotionOverrideRevision: vi.fn(() => 0),
  initializeStorefrontPromotionOverrides: vi.fn(async () => undefined),
  subscribeToStorefrontPromotionOverrideRevision: vi.fn(() => () => undefined),
}));

const storefrontControllerState = vi.hoisted(() => ({
  authSession: {
    status: 'signed-out',
    uid: null,
    isAnonymous: false,
    displayName: null,
    email: null,
  } as CanopyTroveAuthSession,
}));

const storefrontControllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(() => ({
    authSession: storefrontControllerState.authSession,
  })),
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

vi.mock('../services/storefrontPromotionOverrideService', () => ({
  getStorefrontPromotionOverrideRevision:
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision,
  initializeStorefrontPromotionOverrides:
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides,
  subscribeToStorefrontPromotionOverrideRevision:
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision,
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: storefrontControllerMocks.useStorefrontProfileController,
}));

vi.mock('../services/recentStorefrontService', () => ({
  getCachedRecentStorefrontIds: vi.fn(() => []),
  loadRecentStorefrontIds: vi.fn(async () => []),
  subscribeToRecentStorefrontIds: vi.fn(() => () => undefined),
}));

vi.mock('../services/storefrontSummarySnapshotService', () => ({
  getCachedBrowseSummarySnapshot: snapshotMocks.getCachedBrowseSummarySnapshot,
  getCachedLatestNearbySummarySnapshot: snapshotMocks.getCachedLatestNearbySummarySnapshot,
  getCachedNearbySummarySnapshot: vi.fn(() => null),
  getCachedStorefrontDetailSnapshot: snapshotMocks.getCachedStorefrontDetailSnapshot,
  loadBrowseSummarySnapshot: snapshotMocks.loadBrowseSummarySnapshot,
  loadLatestNearbySummarySnapshot: snapshotMocks.loadLatestNearbySummarySnapshot,
  loadNearbySummarySnapshot: vi.fn(async () => null),
  loadStorefrontDetailSnapshot: snapshotMocks.loadStorefrontDetailSnapshot,
  saveBrowseSummarySnapshot: snapshotMocks.saveBrowseSummarySnapshot,
  saveStorefrontDetailSnapshot: vi.fn(async () => undefined),
  saveNearbySummarySnapshot: vi.fn(async () => undefined),
  subscribeToStorefrontDetailSnapshot: vi.fn(() => () => undefined),
}));

import { useBrowseSummaries, useNearbyWarmSnapshot } from './useStorefrontSummaryData';
import { useStorefrontDetails } from './useStorefrontDetailData';
import { useSavedSummaries } from './useStorefrontSavedSummaryData';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function createDetail(
  storefrontId: string,
  overrides?: Partial<StorefrontDetails>,
): StorefrontDetails {
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
    queueMicrotask(resolve);
  });
}

describe('useBrowseSummaries', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: {
    data: {
      items: StorefrontSummary[];
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    isLoading: boolean;
    error: string | null;
  } = {
    data: {
      items: [],
      total: 0,
      limit: 4,
      offset: 0,
      hasMore: false,
    },
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    storefrontControllerState.authSession = {
      status: 'signed-out',
      uid: null,
      isAnonymous: false,
      displayName: null,
      email: null,
    };
    latestValue = {
      data: {
        items: [],
        total: 0,
        limit: 4,
        offset: 0,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    };
    snapshotMocks.getCachedBrowseSummarySnapshot.mockReset();
    snapshotMocks.loadBrowseSummarySnapshot.mockReset();
    snapshotMocks.saveBrowseSummarySnapshot.mockReset();
    repositoryMocks.getBrowseSummaries.mockReset();
    runtimeReportingMocks.reportRuntimeError.mockReset();
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision.mockReset();
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision.mockReturnValue(0);
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides.mockReset();
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides.mockResolvedValue(
      undefined,
    );
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision.mockReset();
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision.mockReturnValue(
      () => undefined,
    );
  });

  function HookHarness() {
    latestValue = useBrowseSummaries(
      {
        areaId: 'all',
        searchQuery: '',
        origin: { latitude: 40.7128, longitude: -74.006 },
        locationLabel: 'New York City',
        hotDealsOnly: false,
      },
      'distance',
      4,
      0,
    );
    return null;
  }

  it('keeps cached browse data while surfacing a live fetch failure', async () => {
    const cachedItems = [createSummary('cached-1')];
    const failure = new Error('browse failed');
    snapshotMocks.getCachedBrowseSummarySnapshot.mockReturnValue({
      items: cachedItems,
      total: 1,
      limit: 4,
      offset: 0,
      hasMore: false,
    });
    repositoryMocks.getBrowseSummaries.mockRejectedValue(failure);

    act(() => {
      renderer = create(<HookHarness />);
    });

    expect(latestValue.data.items).toEqual(cachedItems);
    expect(latestValue.isLoading).toBe(true);

    await act(async () => {
      await flushPromises();
    });

    expect(runtimeReportingMocks.reportRuntimeError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        source: 'browse-summary-fetch',
      }),
    );
    expect(latestValue.data.items).toEqual(cachedItems);
    expect(latestValue.isLoading).toBe(false);
    expect(latestValue.error).toBe('browse failed');
  });

  it('clears member browse data immediately when auth scope changes to signed-out', async () => {
    const memberItems = [createSummary('member-visible')];
    const guestItems = [createSummary('guest-visible')];
    storefrontControllerState.authSession = {
      status: 'authenticated',
      uid: 'member-1',
      isAnonymous: false,
      displayName: 'Member One',
      email: 'member1@example.com',
    };
    snapshotMocks.getCachedBrowseSummarySnapshot
      .mockReturnValueOnce({
        items: memberItems,
        total: 1,
        limit: 4,
        offset: 0,
        hasMore: false,
      })
      .mockReturnValue(null);
    repositoryMocks.getBrowseSummaries
      .mockResolvedValueOnce({
        items: memberItems,
        total: 1,
        limit: 4,
        offset: 0,
        hasMore: false,
      })
      .mockResolvedValueOnce({
        items: guestItems,
        total: 1,
        limit: 4,
        offset: 0,
        hasMore: false,
      });

    act(() => {
      renderer = create(<HookHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue.data.items).toEqual(memberItems);

    storefrontControllerState.authSession = {
      status: 'signed-out',
      uid: null,
      isAnonymous: false,
      displayName: null,
      email: null,
    };

    act(() => {
      renderer?.update(<HookHarness />);
    });

    expect(latestValue.data.items).toEqual([]);

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue.data.items).toEqual(guestItems);
  });

  it('skips browse fetches when disabled', async () => {
    function DisabledHarness() {
      latestValue = useBrowseSummaries(
        {
          areaId: 'all',
          searchQuery: '',
          origin: { latitude: 40.7128, longitude: -74.006 },
          locationLabel: 'New York City',
          hotDealsOnly: false,
        },
        'distance',
        4,
        0,
        { enabled: false },
      );
      return null;
    }

    act(() => {
      renderer = create(<DisabledHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(repositoryMocks.getBrowseSummaries).not.toHaveBeenCalled();
    expect(latestValue.isLoading).toBe(false);
    expect(latestValue.error).toBeNull();
    expect(latestValue.data.items).toEqual([]);
  });
});

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
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision.mockReset();
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision.mockReturnValue(0);
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides.mockReset();
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides.mockResolvedValue(
      undefined,
    );
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision.mockReset();
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision.mockReturnValue(
      () => undefined,
    );
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
    expect(snapshotMocks.loadLatestNearbySummarySnapshot).toHaveBeenCalledTimes(1);
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
      }),
    );
    expect(latestValue.data).toBeNull();
    expect(latestValue.isLoading).toBe(false);
    expect(latestValue.isOperationalDataPending).toBe(false);
    expect(latestValue.error).toBe('Unable to load the latest storefront details right now.');
  });

  it('rechecks the backend detail when operational data is still pending', async () => {
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
    repositoryMocks.getStorefrontDetails
      .mockResolvedValueOnce(emptyOperationalDetail)
      .mockResolvedValueOnce(enrichedDetail);
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
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
        vi.advanceTimersByTime(1_300);
        await flushPromises();
      });

      expect(repositoryMocks.getStorefrontDetails).toHaveBeenCalledTimes(2);
      expect(latestValue.isOperationalDataPending).toBe(false);
      expect(latestValue.data).toEqual(enrichedDetail);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('ignores stale detail responses after the requested storefront id changes', async () => {
    let setStorefrontId: React.Dispatch<React.SetStateAction<string>> | null = null;
    let resolveFirstRequest: ((value: StorefrontDetails) => void) | null = null;
    let resolveSecondRequest: ((value: StorefrontDetails) => void) | null = null;

    repositoryMocks.getCachedStorefrontDetails.mockReturnValue(null);
    repositoryMocks.getStorefrontDetails.mockImplementation(
      (storefrontId: string) =>
        new Promise<StorefrontDetails>((resolve) => {
          if (storefrontId === 'store-1') {
            resolveFirstRequest = resolve;
            return;
          }

          resolveSecondRequest = resolve;
        }),
    );

    function SwitchingHarness() {
      const [storefrontId, setStorefrontIdState] = React.useState('store-1');
      setStorefrontId = setStorefrontIdState;
      latestValue = useStorefrontDetails(storefrontId);
      return null;
    }

    act(() => {
      renderer = create(<SwitchingHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(resolveFirstRequest).toBeTypeOf('function');
    expect(latestValue.isLoading).toBe(true);

    act(() => {
      setStorefrontId?.('store-2');
    });

    await act(async () => {
      await flushPromises();
    });

    expect(resolveSecondRequest).toBeTypeOf('function');

    await act(async () => {
      resolveFirstRequest?.(createDetail('store-1', { phone: '555-1111' }));
      await flushPromises();
    });

    expect(latestValue.data).toBeNull();
    expect(latestValue.isLoading).toBe(true);

    const secondDetail = createDetail('store-2', { phone: '555-2222' });
    await act(async () => {
      resolveSecondRequest?.(secondDetail);
      await flushPromises();
    });

    expect(latestValue.data).toEqual(secondDetail);
    expect(latestValue.isLoading).toBe(false);
  });
});

describe('useSavedSummaries', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: {
    data: StorefrontSummary[];
    isLoading: boolean;
    error: string | null;
  } = {
    data: [],
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    storefrontControllerState.authSession = {
      status: 'authenticated',
      uid: 'member-9',
      isAnonymous: false,
      displayName: 'Member Nine',
      email: 'member9@example.com',
    };
    latestValue = {
      data: [],
      isLoading: false,
      error: null,
    };
    repositoryMocks.getSavedSummaries.mockReset();
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision.mockReset();
    storefrontPromotionOverrideMocks.getStorefrontPromotionOverrideRevision.mockReturnValue(0);
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides.mockReset();
    storefrontPromotionOverrideMocks.initializeStorefrontPromotionOverrides.mockResolvedValue(
      undefined,
    );
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision.mockReset();
    storefrontPromotionOverrideMocks.subscribeToStorefrontPromotionOverrideRevision.mockReturnValue(
      () => undefined,
    );
  });

  function SavedHarness() {
    latestValue = useSavedSummaries(['store-1']);
    return null;
  }

  it('resets saved storefront data immediately when auth scope changes', async () => {
    const memberItems = [createSummary('saved-member')];
    repositoryMocks.getSavedSummaries.mockResolvedValueOnce(memberItems).mockResolvedValueOnce([]);

    act(() => {
      renderer = create(<SavedHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue.data).toEqual(memberItems);

    storefrontControllerState.authSession = {
      status: 'signed-out',
      uid: null,
      isAnonymous: false,
      displayName: null,
      email: null,
    };

    act(() => {
      renderer?.update(<SavedHarness />);
    });

    expect(latestValue.data).toEqual([]);

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue.data).toEqual([]);
  });
});
