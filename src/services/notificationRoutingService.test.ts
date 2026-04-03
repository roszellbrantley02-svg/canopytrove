import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorefrontSummary } from '../types/storefront';

(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
vi.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));
vi.mock('./ownerPortalSessionService', () => ({
  ensureOwnerPortalSessionReady: vi.fn(),
}));

let resolveNotificationNavigationRequest: any;
let ensureOwnerPortalSessionReady: any;

beforeAll(async () => {
  ({ resolveNotificationNavigationRequest } = await import('./notificationRoutingService'));
  ({ ensureOwnerPortalSessionReady } = await import('./ownerPortalSessionService'));
});

beforeEach(() => {
  vi.mocked(ensureOwnerPortalSessionReady).mockReset();
});

function createStorefrontSummary(id: string): StorefrontSummary {
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
    distanceMiles: 1.2,
    travelMinutes: 6,
    rating: 4.6,
    reviewCount: 32,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: '1.2 mi route preview',
    promotionText: '20% off flower',
    thumbnailUrl: null,
  };
}

describe('notification routing', () => {
  it('opens storefront detail when a favorite deal tap resolves a storefront', async () => {
    const storefront = createStorefrontSummary('store-1');

    await expect(
      resolveNotificationNavigationRequest(
        {
          kind: 'favorite_store_deal',
          storefrontId: storefront.id,
        },
        {
          loadStorefrontSummary: vi.fn().mockResolvedValue(storefront),
        },
      ),
    ).resolves.toEqual({
      routeName: 'StorefrontDetail',
      params: {
        storefront,
      },
    });
  });

  it('falls back to hot deals when a favorite deal storefront cannot be resolved', async () => {
    await expect(
      resolveNotificationNavigationRequest(
        {
          kind: 'favorite_store_deal',
          storefrontId: 'missing-store',
        },
        {
          loadStorefrontSummary: vi.fn().mockResolvedValue(null),
        },
      ),
    ).resolves.toEqual({
      routeName: 'HotDeals',
      params: undefined,
    });
  });

  it('routes owner review notifications into the review inbox', async () => {
    vi.mocked(ensureOwnerPortalSessionReady).mockResolvedValue({
      ok: true,
      role: 'owner',
      syncedAt: null,
    });

    await expect(
      resolveNotificationNavigationRequest({
        kind: 'owner_review',
      }),
    ).resolves.toEqual({
      routeName: 'OwnerPortalReviewInbox',
      params: undefined,
    });
  });

  it('falls back to owner access when an owner review notification cannot finalize the owner session', async () => {
    vi.mocked(ensureOwnerPortalSessionReady).mockRejectedValueOnce(
      new Error('Owner access is not ready.'),
    );

    await expect(
      resolveNotificationNavigationRequest({
        kind: 'owner_review',
      }),
    ).resolves.toEqual({
      routeName: 'OwnerPortalAccess',
      params: undefined,
    });
  });

  it('routes license compliance reminders into the owner home screen', async () => {
    vi.mocked(ensureOwnerPortalSessionReady).mockResolvedValue({
      ok: true,
      role: 'owner',
      syncedAt: null,
    });

    await expect(
      resolveNotificationNavigationRequest({
        kind: 'owner_license_compliance',
      }),
    ).resolves.toEqual({
      routeName: 'OwnerPortalHome',
      params: undefined,
    });
  });

  it('routes admin runtime alerts into the admin runtime screen', async () => {
    await expect(
      resolveNotificationNavigationRequest({
        kind: 'runtime_incident_alert',
        source: 'admin_runtime',
      }),
    ).resolves.toEqual({
      routeName: 'AdminRuntimePanel',
      params: undefined,
    });
  });

  it('routes owner runtime alerts into the owner workspace', async () => {
    vi.mocked(ensureOwnerPortalSessionReady).mockResolvedValue({
      ok: true,
      role: 'owner',
      syncedAt: null,
    });

    await expect(
      resolveNotificationNavigationRequest({
        kind: 'runtime_incident_alert',
        source: 'owner_portal',
      }),
    ).resolves.toEqual({
      routeName: 'OwnerPortalHome',
      params: undefined,
    });
  });
});
