import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontSummary } from '../types/storefront';

const reactNativeMocks = vi.hoisted(() => ({
  canOpenURL: vi.fn(),
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
    canOpenURL: reactNativeMocks.canOpenURL,
    openURL: reactNativeMocks.openURL,
  },
  Platform: reactNativeMocks.Platform,
}));

vi.mock('./postVisitPromptService', () => ({
  startPostVisitJourney: postVisitMocks.startPostVisitJourney,
}));

const storefront = {
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
  'displayName' | 'addressLine1' | 'city' | 'state' | 'zip' | 'coordinates' | 'placeId'
>;

const encodedAddress = encodeURIComponent('Canopy Trove Albany, 123 Main St, Albany, NY 12207');
const nativeUrl = `geo:0,0?q=${encodedAddress}`;
const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&destination_place_id=place-123&travelmode=driving`;
const coordinateFallbackUrl =
  'https://www.google.com/maps/dir/?api=1&destination=42.6526,-73.7562&travelmode=driving';

async function loadService() {
  vi.resetModules();
  return import('./navigationService');
}

describe('navigationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactNativeMocks.Platform.OS = 'android';
    reactNativeMocks.canOpenURL.mockResolvedValue(false);
    reactNativeMocks.openURL.mockResolvedValue(undefined);
    postVisitMocks.startPostVisitJourney.mockResolvedValue(undefined);
  });

  it('falls back to the Google Maps address route before raw coordinates when native routing is unavailable', async () => {
    const service = await loadService();

    reactNativeMocks.canOpenURL.mockImplementation(async (url: string) => url === webUrl);

    await service.openStorefrontRoute(storefront, 'verified');

    expect(reactNativeMocks.canOpenURL).toHaveBeenNthCalledWith(1, nativeUrl);
    expect(reactNativeMocks.canOpenURL).toHaveBeenNthCalledWith(2, webUrl);
    expect(reactNativeMocks.openURL).toHaveBeenCalledTimes(1);
    expect(reactNativeMocks.openURL).toHaveBeenCalledWith(webUrl);
  });

  it('falls back to the Google Maps address route when opening the native route throws', async () => {
    const service = await loadService();

    reactNativeMocks.canOpenURL.mockResolvedValue(true);
    reactNativeMocks.openURL
      .mockRejectedValueOnce(new Error('native route failed'))
      .mockResolvedValueOnce(undefined);

    await service.openStorefrontRoute(storefront, 'verified');

    expect(reactNativeMocks.openURL).toHaveBeenNthCalledWith(1, nativeUrl);
    expect(reactNativeMocks.openURL).toHaveBeenNthCalledWith(2, webUrl);
    expect(reactNativeMocks.openURL).not.toHaveBeenCalledWith(coordinateFallbackUrl);
  });
});
