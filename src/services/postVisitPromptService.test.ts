import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontSummary } from '../types/storefront';

const asyncStorageMocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

const locationMocks = vi.hoisted(() => ({
  getBestAvailableDeviceLocation: vi.fn(),
}));

const communityMocks = vi.hoisted(() => ({
  getCachedStorefrontCommunityState: vi.fn(),
  loadStorefrontCommunityState: vi.fn(),
}));

const recentMocks = vi.hoisted(() => ({
  markStorefrontAsRecent: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMocks.getItem,
    setItem: asyncStorageMocks.setItem,
    removeItem: asyncStorageMocks.removeItem,
  },
}));

vi.mock('../config/brand', () => ({
  brand: {
    storageNamespace: 'test-app',
  },
}));

vi.mock('./locationDeviceService', () => ({
  getBestAvailableDeviceLocation: locationMocks.getBestAvailableDeviceLocation,
}));

vi.mock('./storefrontCommunityLocalService', () => ({
  getCachedStorefrontCommunityState: communityMocks.getCachedStorefrontCommunityState,
  loadStorefrontCommunityState: communityMocks.loadStorefrontCommunityState,
}));

vi.mock('./recentStorefrontService', () => ({
  markStorefrontAsRecent: recentMocks.markStorefrontAsRecent,
}));

const storefront: StorefrontSummary = {
  id: 'storefront-1',
  licenseId: 'license-1',
  marketId: 'nyc',
  displayName: 'Test Storefront',
  legalName: 'Test Storefront LLC',
  addressLine1: '123 Main St',
  city: 'Albany',
  state: 'NY',
  zip: '12207',
  coordinates: {
    latitude: 42.6526,
    longitude: -73.7562,
  },
  distanceMiles: 1.2,
  travelMinutes: 6,
  rating: 4.8,
  reviewCount: 24,
  openNow: true,
  isVerified: true,
  mapPreviewLabel: 'Albany',
};

async function loadService() {
  vi.resetModules();
  return import('./postVisitPromptService');
}

describe('postVisitPromptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorageMocks.getItem.mockResolvedValue(null);
    asyncStorageMocks.setItem.mockResolvedValue(undefined);
    locationMocks.getBestAvailableDeviceLocation.mockResolvedValue({
      coordinates: null,
    });
    communityMocks.getCachedStorefrontCommunityState.mockReturnValue(null);
    communityMocks.loadStorefrontCommunityState.mockResolvedValue({
      appReviewsByStorefrontId: {},
    });
    recentMocks.markStorefrontAsRecent.mockResolvedValue(undefined);
  });

  it('starts a journey and records the storefront as recent', async () => {
    const service = await loadService();

    const state = await service.startPostVisitJourney({
      profileId: 'guest-1',
      isAuthenticated: false,
      routeMode: 'verified',
      sourceScreen: 'Browse',
      storefront,
    });

    expect(recentMocks.markStorefrontAsRecent).toHaveBeenCalledWith('storefront-1');
    expect(state.activeJourney?.storefront.id).toBe('storefront-1');
  });

  it('creates a pending prompt when arrival is detected at journey start', async () => {
    locationMocks.getBestAvailableDeviceLocation.mockResolvedValue({
      coordinates: {
        latitude: storefront.coordinates.latitude,
        longitude: storefront.coordinates.longitude,
      },
    });

    communityMocks.loadStorefrontCommunityState.mockResolvedValue({
      appReviewsByStorefrontId: {},
    });

    const service = await loadService();

    const state = await service.startPostVisitJourney({
      profileId: 'guest-2',
      isAuthenticated: false,
      routeMode: 'verified',
      sourceScreen: 'Nearby',
      storefront,
    });

    expect(state.activeJourney).toBeNull();
    expect(state.pendingPrompt?.storefront.id).toBe('storefront-1');
    expect(state.pendingPrompt?.source).toBe('foreground_arrival');
  });

  it('evaluatePostVisitJourney returns current state when no active journey', async () => {
    const service = await loadService();

    const state = await service.evaluatePostVisitJourney();

    expect(state.activeJourney).toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('evaluatePostVisitJourney detects arrival and creates a prompt', async () => {
    locationMocks.getBestAvailableDeviceLocation.mockResolvedValueOnce({
      coordinates: null,
    });

    const service = await loadService();

    await service.startPostVisitJourney({
      profileId: 'guest-3',
      isAuthenticated: false,
      routeMode: 'verified',
      sourceScreen: 'Browse',
      storefront,
    });

    locationMocks.getBestAvailableDeviceLocation.mockResolvedValue({
      coordinates: {
        latitude: storefront.coordinates.latitude,
        longitude: storefront.coordinates.longitude,
      },
    });

    communityMocks.loadStorefrontCommunityState.mockResolvedValue({
      appReviewsByStorefrontId: {},
    });

    const state = await service.evaluatePostVisitJourney();

    expect(state.activeJourney).toBeNull();
    expect(state.pendingPrompt?.storefront.id).toBe('storefront-1');
    expect(state.pendingPrompt?.source).toBe('app_resume_arrival');
  });

  it('clearPostVisitJourney removes both journey and prompt', async () => {
    const service = await loadService();

    await service.startPostVisitJourney({
      profileId: 'guest-4',
      isAuthenticated: false,
      routeMode: 'verified',
      sourceScreen: 'Browse',
      storefront,
    });

    const state = await service.clearPostVisitJourney();

    expect(state.activeJourney).toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('dismissPostVisitPrompt clears only the pending prompt', async () => {
    locationMocks.getBestAvailableDeviceLocation.mockResolvedValue({
      coordinates: {
        latitude: storefront.coordinates.latitude,
        longitude: storefront.coordinates.longitude,
      },
    });

    communityMocks.loadStorefrontCommunityState.mockResolvedValue({
      appReviewsByStorefrontId: {},
    });

    const service = await loadService();

    await service.startPostVisitJourney({
      profileId: 'guest-5',
      isAuthenticated: false,
      routeMode: 'verified',
      sourceScreen: 'Browse',
      storefront,
    });

    const beforeDismiss = service.getPostVisitFollowUpState();
    expect(beforeDismiss.pendingPrompt).not.toBeNull();

    const afterDismiss = await service.dismissPostVisitPrompt();
    expect(afterDismiss.pendingPrompt).toBeNull();
  });
});
