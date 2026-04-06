import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorageMocks = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: () => {
      store.clear();
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMocks.getItem,
    setItem: asyncStorageMocks.setItem,
    removeItem: asyncStorageMocks.removeItem,
  },
}));

import {
  createOwnerPortalPreviewPromotion,
  getOwnerPortalPreviewStorefrontDetails,
  getOwnerPortalPreviewStorefrontSummaries,
  getOwnerPortalPreviewWorkspace,
  resetOwnerPortalPreviewState,
  saveOwnerPortalPreviewProfileTools,
} from './ownerPortalPreviewService';

describe('ownerPortalPreviewService', () => {
  beforeEach(async () => {
    asyncStorageMocks.clear();
    asyncStorageMocks.getItem.mockClear();
    asyncStorageMocks.setItem.mockClear();
    asyncStorageMocks.removeItem.mockClear();
    await resetOwnerPortalPreviewState();
  });

  it('surfaces preview promotions on the claimed storefront summary', async () => {
    await createOwnerPortalPreviewPromotion({
      title: 'Flash Drop',
      description: 'Fresh small-batch drop live in the preview workspace.',
      badges: ['Fresh Drop', 'Today Only'],
      startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      audiences: ['all_followers'],
      alertFollowersOnStart: true,
      cardTone: 'hot_deal',
      placementSurfaces: ['browse', 'nearby', 'hot_deals'],
      placementScope: 'storefront_area',
    });

    const summaries = await getOwnerPortalPreviewStorefrontSummaries();
    const claimedStorefront = summaries[0];
    const workspace = await getOwnerPortalPreviewWorkspace();

    expect(claimedStorefront.activePromotionCount).toBeGreaterThan(0);
    expect(claimedStorefront.promotionText).toBe(
      'Fresh small-batch drop live in the preview workspace.',
    );
    expect(workspace.promotions.some((promotion) => promotion.title === 'Flash Drop')).toBe(true);
  });

  it('feeds profile tool edits into the claimed storefront detail payload', async () => {
    await saveOwnerPortalPreviewProfileTools({
      menuUrl: 'https://canopytrove.com/test-menu',
      verifiedBadgeLabel: 'Preview Verified Owner',
      featuredBadges: ['Fast pickup', 'Curated drops'],
      cardSummary: 'Preview storefront ready for owner tool testing.',
    });

    const workspace = await getOwnerPortalPreviewWorkspace();
    const detail = await getOwnerPortalPreviewStorefrontDetails(
      workspace.storefrontSummary?.id ?? 'canopy-trove-preview-store',
    );

    expect(detail?.menuUrl).toBe('https://canopytrove.com/test-menu');
    expect(detail?.verifiedOwnerBadgeLabel).toBe('Preview Verified Owner');
    expect(detail?.ownerFeaturedBadges).toEqual(['Fast pickup', 'Curated drops']);
    expect(detail?.editorialSummary).toBe('Preview storefront ready for owner tool testing.');
  });
});
