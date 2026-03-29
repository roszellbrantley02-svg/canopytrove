import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketArea, StorefrontGamificationState } from '../types/storefront';

const marketAreaMocks = vi.hoisted(() => ({
  getAvailableMarketAreas: vi.fn(),
  getCachedMarketAreas: vi.fn(),
}));

const locationMocks = vi.hoisted(() => ({
  findNearestArea: vi.fn(),
  getBestAvailableDeviceLocation: vi.fn(),
  getCachedDeviceLocation: vi.fn(),
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
    locationMocks.resolveDeviceLocationLabel.mockReset();
    locationMocks.resolveSearchLocation.mockReset();
    preferenceMocks.loadStorefrontPreferences.mockReset();
    preferenceMocks.saveStorefrontPreferences.mockReset();

    marketAreaMocks.getCachedMarketAreas.mockReturnValue(marketAreas);
    marketAreaMocks.getAvailableMarketAreas.mockResolvedValue(marketAreas);
    locationMocks.getCachedDeviceLocation.mockReturnValue(null);
    locationMocks.getBestAvailableDeviceLocation.mockResolvedValue({ coordinates: null });
    locationMocks.findNearestArea.mockImplementation((_areas, coordinates) =>
      coordinates.latitude > 42 ? marketAreas[1] : marketAreas[0]
    );
  });

  function HookHarness() {
    const [savedStorefrontIds, setSavedStorefrontIds] = React.useState<string[]>([]);
    const [gamificationState, setGamificationState] = React.useState<StorefrontGamificationState>(
      createGamificationState('profile-1')
    );

    latestValue = useStorefrontQueryModel({
      cachedPreferences: {
        selectedAreaId: 'nyc',
        searchQuery: 'Union',
        locationQuery: '10012',
        searchLocation: { latitude: 40.725, longitude: -73.997 },
        searchLocationLabel: 'NoHo, Manhattan',
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

  it('hydrates active search context from cached preferences', () => {
    act(() => {
      renderer = create(<HookHarness />);
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
      })
    );
  });

  it('updates the active location when a new search location is applied', async () => {
    locationMocks.resolveSearchLocation.mockResolvedValue({
      coordinates: { latitude: 43.05, longitude: -76.15 },
      label: 'Syracuse, NY',
    });

    act(() => {
      renderer = create(<HookHarness />);
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
});
