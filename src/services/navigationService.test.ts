import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontSummary } from '../types/storefront';

const reactNativeMocks = vi.hoisted(() => ({
  openURL: vi.fn(),
  Platform: {
    OS: 'android',
  },
}));

const postVisitMocks = vi.hoisted(() => ({
  startPostVisitJourney: vi.fn(),
}));

vi.mock('react-native', () => ({
  Linking: {
    openURL: reactNativeMocks.openURL,
  },
  Platform: reactNativeMocks.Platform,
}));

vi.mock('./postVisitPromptService', () => ({
  startPostVisitJourney: postVisitMocks.startPostVisitJourney,
}));

const storefront = {
  id: 'store-1',
  displayName: 'Canopy Trove Albany',
  addressLine1: '123 Main St',
  city: 'Albany',
  state: 'NY',
  zip: '12207',
  coordinates: {
    latitude: 42.6526,
    longitude: -73.7562,
  },
  placeId: 'place-123',
} satisfies Pick<
  StorefrontSummary,
  'id' | 'displayName' | 'addressLine1' | 'city' | 'state' | 'zip' | 'coordinates' | 'placeId'
>;

const fullStorefront = {
  ...storefront,
  licenseId: 'license-1',
  marketId: 'market-1',
  legalName: 'Canopy Trove Albany LLC',
  distanceMiles: 1.2,
  travelMinutes: 5,
  rating: 4.5,
  reviewCount: 12,
  openNow: true,
  hours: [],
  isVerified: true,
  mapPreviewLabel: 'Albany',
} satisfies StorefrontSummary;

const encodedAddress = encodeURIComponent('Canopy Trove Albany, 123 Main St, Albany, NY 12207');
const nativeUrl = `geo:0,0?q=${encodedAddress}`;
const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&destination_place_id=place-123&travelmode=driving`;

async function loadService() {
  vi.resetModules();
  return import('./navigationService');
}

describe('navigationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactNativeMocks.Platform.OS = 'android';
    reactNativeMocks.openURL.mockResolvedValue(undefined);
    postVisitMocks.startPostVisitJourney.mockResolvedValue(undefined);
  });

  it('falls back to the Google Maps address route when opening the native route throws', async () => {
    const service = await loadService();

    reactNativeMocks.openURL
      .mockRejectedValueOnce(new Error('native route failed'))
      .mockResolvedValueOnce(undefined);

    await service.openStorefrontRoute(storefront, 'verified');

    expect(reactNativeMocks.openURL).toHaveBeenNthCalledWith(1, nativeUrl);
    expect(reactNativeMocks.openURL).toHaveBeenNthCalledWith(2, webUrl);
  });

  it('fires route reward tracking and post-visit tracking without blocking navigation', async () => {
    const service = await loadService();
    const onRouteStarted = vi.fn();

    await service.openStorefrontRoute(storefront, 'verified', {
      profileId: 'profile-1',
      accountId: 'account-1',
      isAuthenticated: true,
      sourceScreen: 'Browse',
      storefront: fullStorefront,
      onRouteStarted,
    });

    expect(onRouteStarted).toHaveBeenCalledWith({
      storefrontId: 'store-1',
      routeMode: 'verified',
    });
    expect(postVisitMocks.startPostVisitJourney).toHaveBeenCalledWith({
      profileId: 'profile-1',
      accountId: 'account-1',
      isAuthenticated: true,
      routeMode: 'verified',
      sourceScreen: 'Browse',
      storefront: fullStorefront,
    });
    expect(reactNativeMocks.openURL).toHaveBeenCalledWith(nativeUrl);
  });
});
