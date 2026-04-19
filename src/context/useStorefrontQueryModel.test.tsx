import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredStorefrontPreferences } from '../services/storefrontPreferencesService';
import type { MarketArea, StorefrontGamificationState } from '../types/storefront';

const marketAreaMocks = vi.hoisted(() => ({
  getAvailableMarketAreas: vi.fn(),
  getCachedMarketAreas: vi.fn(),
}));

const locationMocks = vi.hoisted(() => ({
  findNearestArea: vi.fn(),
  getBestAvailableDeviceLocation: vi.fn(),
  getCachedDeviceLocation: vi.fn(),
  getPassiveDeviceLocation: vi.fn(),
  resolveDeviceLocationLabel: vi.fn(),
  resolveSearchLocation: vi.fn(),
}));

const preferenceMocks = vi.hoisted(() => ({
  loadStorefrontPreferences: vi.fn(),
  saveStorefrontPreferences: vi.fn(),
}));

vi.mock('../services/marketAreaService', () => ({
  getAvailableMarketAreas: marketAreaMocks.getAvailableMarketAreas,
  getCachedMarketAreas: marketAreaMocks.getCachedMarketAreas,
}));

vi.mock('../services/locationService', () => ({
  findNearestArea: locationMocks.findNearestArea,
  getBestAvailableDeviceLocation: locationMocks.getBestAvailableDeviceLocation,
  getCachedDeviceLocation: locationMocks.getCachedDeviceLocation,
  getPassiveDeviceLocation: locationMocks.getPassiveDeviceLocation,
  resolveDeviceLocationLabel: locationMocks.resolveDeviceLocationLabel,
  resolveSearchLocation: locationMocks.resolveSearchLocation,
}));

vi.mock('../services/storefrontPreferencesService', () => ({
  loadStorefrontPreferences: preferenceMocks.loadStorefrontPreferences,
  saveStorefrontPreferences: preferenceMocks.saveStorefrontPreferences,
}));

vi.mock('../services/canopyTroveGamificationService', () => ({
  normalizeGamificationState: vi.fn((_profileId, state) => state),
}));

import { useStorefrontQueryModel } from './useStorefrontQueryModel';

function createGamificationState(profileId: string): StorefrontGamificationState {
  return {
    profileId,
    totalPoints: 0,
    totalReviews: 0,
    totalPhotos: 0,
    totalHelpfulVotes: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastReviewDate: null,
    lastActiveDate: null,
    dispensariesVisited: 0,
    visitedStorefrontIds: [],
    badges: [],
    joinedDate: '2026-03-01T00:00:00.000Z',
    level: 1,
    nextLevelPoints: 100,
    reviewsWithPhotos: 0,
    detailedReviews: 0,
    fiveStarReviews: 0,
    oneStarReviews: 0,
    commentsWritten: 0,
    reportsSubmitted: 0,
    friendsInvited: 0,
    followersCount: 0,
    totalRoutesStarted: 0,
  };
}

const marketAreas: MarketArea[] = [
  {
    id: 'nyc',
    label: 'New York City',
    subtitle: 'NYC',
    center: { latitude: 40.7128, longitude: -74.006 },
  },
  {
    id: 'central-ny',
    label: 'Central New York',
    subtitle: 'CNY',
    center: { latitude: 43.0481, longitude: -76.1474 },
  },
];

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

type HookHarnessProps = {
  accountId?: string | null;
  cachedPreferences: StoredStorefrontPreferences | null;
};

describe('useStorefrontQueryModel', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useStorefrontQueryModel> | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    latestValue = null;
    marketAreaMocks.getAvailableMarketAreas.mockReset();
    marketAreaMocks.getCachedMarketAreas.mockReset();
    locationMocks.findNearestArea.mockReset();
    locationMocks.getBestAvailableDeviceLocation.mockReset();
    locationMocks.getCachedDeviceLocation.mockReset();
    locationMocks.getPassiveDeviceLocation.mockReset();
    locationMocks.resolveDeviceLocationLabel.mockReset();
    locationMocks.resolveSearchLocation.mockReset();
    preferenceMocks.loadStorefrontPreferences.mockReset();
    preferenceMocks.saveStorefrontPreferences.mockReset();

    marketAreaMocks.getCachedMarketAreas.mockReturnValue(marketAreas);
    marketAreaMocks.getAvailableMarketAreas.mockResolvedValue(marketAreas);
    locationMocks.getCachedDeviceLocation.mockReturnValue(null);
    locationMocks.getPassiveDeviceLocation.mockResolvedValue({ coordinates: null });
    locationMocks.getBestAvailableDeviceLocation.mockResolvedValue({ coordinates: null });
    locationMocks.findNearestArea.mockImplementation((_areas, coordinates) =>
      coordinates.latitude > 42 ? marketAreas[1] : marketAreas[0],
    );
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function HookHarness({ accountId = null, cachedPreferences }: HookHarnessProps) {
    const [savedStorefrontIds, setSavedStorefrontIds] = React.useState<string[]>([]);
    const [gamificationState, setGamificationState] = React.useState<StorefrontGamificationState>(
      createGamificationState('profile-1'),
    );

    latestValue = useStorefrontQueryModel({
      cachedPreferences,
      profileId: 'profile-1',
      accountId,
      profileCreatedAt: '2026-03-01T00:00:00.000Z',
      savedStorefrontIds,
      gamificationState,
      setSavedStorefrontIds,
      setGamificationState,
    });

    return null;
  }

  it('hydrates active search context from cached preferences', () => {
    act(() => {
      renderer = create(
        <HookHarness
          cachedPreferences={{
            selectedAreaId: 'nyc',
            searchQuery: 'Union',
            locationQuery: '10012',
            searchLocation: { latitude: 40.725, longitude: -73.997 },
            searchLocationLabel: 'NoHo, Manhattan',
            browseSortKey: 'distance',
            browseHotDealsOnly: false,
            deviceLocationLabel: null,
          }}
        />,
      );
    });

    expect(latestValue?.selectedAreaId).toBe('nyc');
    expect(latestValue?.searchQuery).toBe('Union');
    expect(latestValue?.activeLocationMode).toBe('search');
    expect(latestValue?.activeLocationLabel).toBe('NoHo, Manhattan');
    expect(latestValue?.storefrontQuery).toEqual(
      expect.objectContaining({
        areaId: 'nyc',
        searchQuery: 'Union',
        locationLabel: 'NoHo, Manhattan',
      }),
    );
  });

  it('updates the active location when a new search location is applied', async () => {
    locationMocks.resolveSearchLocation.mockResolvedValue({
      coordinates: { latitude: 43.05, longitude: -76.15 },
      label: 'Syracuse, NY',
    });

    act(() => {
      renderer = create(
        <HookHarness
          cachedPreferences={{
            selectedAreaId: 'nyc',
            searchQuery: 'Union',
            locationQuery: '10012',
            searchLocation: { latitude: 40.725, longitude: -73.997 },
            searchLocationLabel: 'NoHo, Manhattan',
            browseSortKey: 'distance',
            browseHotDealsOnly: false,
            deviceLocationLabel: null,
          }}
        />,
      );
    });

    await act(async () => {
      latestValue?.setLocationQuery('Syracuse, NY');
      await flushPromises();
    });

    await act(async () => {
      await latestValue?.applyLocationQuery();
      await flushPromises();
    });

    expect(locationMocks.resolveSearchLocation).toHaveBeenCalledWith('Syracuse, NY', marketAreas);
    expect(latestValue?.selectedAreaId).toBe('central-ny');
    expect(latestValue?.activeLocationMode).toBe('search');
    expect(latestValue?.activeLocationLabel).toBe('Syracuse, NY');
    expect(latestValue?.activeLocation).toEqual({ latitude: 43.05, longitude: -76.15 });
  });

  it('uses the resolved market area id when cached preferences contain a stale area id', async () => {
    function InvalidAreaHarness() {
      const [savedStorefrontIds, setSavedStorefrontIds] = React.useState<string[]>([]);
      const [gamificationState, setGamificationState] = React.useState<StorefrontGamificationState>(
        createGamificationState('profile-1'),
      );

      latestValue = useStorefrontQueryModel({
        cachedPreferences: {
          selectedAreaId: 'upstate-all',
          searchQuery: '',
          locationQuery: 'Central New York',
          searchLocation: null,
          searchLocationLabel: null,
          browseSortKey: 'distance',
          browseHotDealsOnly: false,
          deviceLocationLabel: null,
        },
        profileId: 'profile-1',
        profileCreatedAt: '2026-03-01T00:00:00.000Z',
        savedStorefrontIds,
        gamificationState,
        setSavedStorefrontIds,
        setGamificationState,
      });

      return null;
    }

    act(() => {
      renderer = create(<InvalidAreaHarness />);
    });

    expect(latestValue?.selectedAreaId).toBe('nyc');
    expect(latestValue?.storefrontQuery.areaId).toBe('nyc');

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue?.selectedAreaId).toBe('nyc');
    expect(latestValue?.storefrontQuery.areaId).toBe('nyc');
  });

  it('does not let delayed preference hydration overwrite an early user edit', async () => {
    let resolvePreferences: ((value: object | null) => void) | null = null;
    preferenceMocks.loadStorefrontPreferences.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreferences = resolve;
        }),
    );

    function HydrationHarness() {
      const [savedStorefrontIds, setSavedStorefrontIds] = React.useState<string[]>([]);
      const [gamificationState, setGamificationState] = React.useState<StorefrontGamificationState>(
        createGamificationState('profile-1'),
      );

      latestValue = useStorefrontQueryModel({
        cachedPreferences: null,
        profileId: 'profile-1',
        accountId: null,
        profileCreatedAt: '2026-03-01T00:00:00.000Z',
        savedStorefrontIds,
        gamificationState,
        setSavedStorefrontIds,
        setGamificationState,
      });

      return null;
    }

    act(() => {
      renderer = create(<HydrationHarness />);
    });

    await act(async () => {
      latestValue?.setSearchQuery('Buffalo');
      await flushPromises();
    });

    await act(async () => {
      resolvePreferences?.({
        selectedAreaId: 'central-ny',
        searchQuery: 'Union',
        locationQuery: 'Syracuse, NY',
      });
      await flushPromises();
    });

    expect(latestValue?.searchQuery).toBe('Buffalo');
    expect(latestValue?.selectedAreaId).toBe('nyc');
  });

  it('loads and saves storefront preferences in the authenticated account scope', async () => {
    vi.useFakeTimers();
    preferenceMocks.loadStorefrontPreferences.mockResolvedValue(null);

    act(() => {
      renderer = create(<HookHarness accountId="account-123" cachedPreferences={null} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(preferenceMocks.loadStorefrontPreferences).toHaveBeenCalledWith('account-123');

    await act(async () => {
      latestValue?.setSearchQuery('Albany');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(preferenceMocks.saveStorefrontPreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchQuery: 'Albany',
      }),
      'account-123',
    );
  });

  it('does not persist guest preferences into an authenticated account before hydration finishes', async () => {
    vi.useFakeTimers();

    let resolvePreferences: ((value: StoredStorefrontPreferences | null) => void) | null = null;
    preferenceMocks.loadStorefrontPreferences.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreferences = resolve;
        }),
    );

    act(() => {
      renderer = create(
        <HookHarness
          accountId={null}
          cachedPreferences={{
            selectedAreaId: 'nyc',
            searchQuery: 'Guest search',
            locationQuery: 'Guest location',
          }}
        />,
      );
    });

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    preferenceMocks.saveStorefrontPreferences.mockClear();

    act(() => {
      renderer?.update(<HookHarness accountId="account-456" cachedPreferences={null} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(preferenceMocks.loadStorefrontPreferences).toHaveBeenCalledWith('account-456');
    expect(preferenceMocks.saveStorefrontPreferences).not.toHaveBeenCalled();

    await act(async () => {
      resolvePreferences?.({
        selectedAreaId: 'central-ny',
        searchQuery: 'Member search',
        locationQuery: 'Syracuse, NY',
      });
      await Promise.resolve();
    });

    await act(async () => {
      latestValue?.setSearchQuery('Member update');
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(preferenceMocks.saveStorefrontPreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchQuery: 'Member update',
      }),
      'account-456',
    );
  });
});
