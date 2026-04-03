import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type {
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../../../src/types/ownerPortal';
import type { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from '../types';
import {
  applyOwnerWorkspaceDetailEnhancements,
  applyOwnerWorkspaceSummaryEnhancements,
  storefrontDetailEnhancementCache,
  storefrontSummaryEnhancementCache,
} from './ownerPortalWorkspaceData';

function createSummary(
  storefrontId: string,
  overrides: Partial<StorefrontSummaryApiDocument> = {}
): StorefrontSummaryApiDocument {
  return {
    id: storefrontId,
    licenseId: `license-${storefrontId}`,
    marketId: 'market-1',
    displayName: 'Canopy Trove Test Store',
    legalName: 'Canopy Trove Test Store LLC',
    addressLine1: '123 Main Street',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    latitude: 42.6526,
    longitude: -73.7562,
    distanceMiles: 1.4,
    travelMinutes: 6,
    rating: 4.7,
    reviewCount: 32,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: 'Albany preview',
    menuUrl: 'https://existing.example/menu',
    verifiedOwnerBadgeLabel: 'Existing badge',
    ownerFeaturedBadges: ['Existing badge'],
    ownerCardSummary: 'Existing owner summary.',
    premiumCardVariant: 'standard',
    promotionPlacementSurfaces: ['nearby'],
    promotionPlacementScope: 'storefront_area',
    thumbnailUrl: 'https://existing.example/thumb.jpg',
    ...overrides,
  };
}

function createDetail(
  storefrontId: string,
  overrides: Partial<StorefrontDetailApiDocument> = {}
): StorefrontDetailApiDocument {
  return {
    storefrontId,
    phone: '555-0100',
    website: 'https://existing.example',
    hours: ['Mon-Fri 9am-9pm'],
    openNow: true,
    hasOwnerClaim: true,
    menuUrl: 'https://existing.example/menu',
    verifiedOwnerBadgeLabel: 'Existing badge',
    favoriteFollowerCount: 9,
    ownerFeaturedBadges: ['Existing badge'],
    activePromotions: [],
    photoCount: 1,
    appReviewCount: 0,
    appReviews: [],
    photoUrls: ['https://existing.example/detail.jpg'],
    amenities: ['Parking'],
    editorialSummary: 'Existing editorial summary.',
    routeMode: 'preview',
    ...overrides,
  };
}

function createProfileTools(
  storefrontId: string,
  overrides: Partial<OwnerStorefrontProfileToolsDocument> = {}
): OwnerStorefrontProfileToolsDocument {
  return {
    storefrontId,
    ownerUid: 'owner-1',
    menuUrl: 'https://owner.example/menu',
    featuredPhotoUrls: ['https://owner.example/featured.jpg'],
    cardPhotoUrl: 'https://owner.example/card.jpg',
    featuredPhotoPaths: [],
    cardPhotoPath: null,
    verifiedBadgeLabel: 'Verified owner',
    featuredBadges: ['Women-owned'],
    cardSummary: 'Fresh owner summary.',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createPromotion(
  storefrontId: string,
  overrides: Partial<OwnerStorefrontPromotionDocument> = {}
): OwnerStorefrontPromotionDocument {
  const now = Date.now();
  return {
    id: `promotion-${storefrontId}`,
    storefrontId,
    ownerUid: 'owner-1',
    title: 'Lunch drop',
    description: 'Buy one get one gummies',
    badges: ['BOGO'],
    startsAt: new Date(now - 30 * 60 * 1000).toISOString(),
    endsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    audience: 'all_followers',
    alertFollowersOnStart: true,
    cardTone: 'hot_deal',
    placementSurfaces: ['browse', 'nearby'],
    placementScope: 'storefront_area',
    followersAlertedAt: null,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function clearEnhancementCaches() {
  storefrontSummaryEnhancementCache.clear();
  storefrontDetailEnhancementCache.clear();
}

beforeEach(() => {
  clearEnhancementCaches();
});

afterEach(() => {
  clearEnhancementCaches();
});

test('summary enhancements keep existing profile fields when profile tools loading fails', async () => {
  const summary = createSummary('summary-partial');
  const promotion = createPromotion(summary.id);
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const result = await applyOwnerWorkspaceSummaryEnhancements(summary, {
      getProfileTools: async () => {
        throw new Error('profile tools unavailable');
      },
      getActivePromotion: async () => promotion,
      getFollowerCount: async () => 0,
      hydrateProfileTools: async (profileTools) => profileTools,
    });

    assert.equal(result.menuUrl, summary.menuUrl);
    assert.deepEqual(result.ownerFeaturedBadges, summary.ownerFeaturedBadges);
    assert.equal(result.thumbnailUrl, summary.thumbnailUrl);
    assert.equal(result.activePromotionId, promotion.id);
    assert.equal(result.promotionText, promotion.description);
    assert.equal(result.premiumCardVariant, 'hot_deal');
    assert.deepEqual(result.promotionPlacementSurfaces, promotion.placementSurfaces);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /profileTools/);
  } finally {
    console.warn = originalWarn;
  }
});

test('detail enhancements keep the existing follower count when follower loading fails', async () => {
  const detail = createDetail('detail-partial');
  const profileTools = createProfileTools(detail.storefrontId);
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const result = await applyOwnerWorkspaceDetailEnhancements(detail, {
      getProfileTools: async () => profileTools,
      getActivePromotion: async () => null,
      getFollowerCount: async () => {
        throw new Error('followers unavailable');
      },
      hydrateProfileTools: async (rawProfileTools) => rawProfileTools,
    });

    assert.equal(result.favoriteFollowerCount, detail.favoriteFollowerCount);
    assert.equal(result.menuUrl, profileTools.menuUrl);
    assert.equal(result.verifiedOwnerBadgeLabel, profileTools.verifiedBadgeLabel);
    assert.deepEqual(result.ownerFeaturedBadges, profileTools.featuredBadges);
    assert.deepEqual(result.photoUrls, [
      profileTools.cardPhotoUrl as string,
      profileTools.featuredPhotoUrls[0] as string,
      ...detail.photoUrls,
    ]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /followerCount/);
  } finally {
    console.warn = originalWarn;
  }
});

test('detail enhancements keep existing media fields when profile tool hydration fails', async () => {
  const detail = createDetail('detail-hydration-failure');
  const profileTools = createProfileTools(detail.storefrontId);
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const result = await applyOwnerWorkspaceDetailEnhancements(detail, {
      getProfileTools: async () => profileTools,
      getActivePromotion: async () => null,
      getFollowerCount: async () => 42,
      hydrateProfileTools: async () => {
        throw new Error('signed url generation failed');
      },
    });

    assert.equal(result.favoriteFollowerCount, 42);
    assert.equal(result.menuUrl, detail.menuUrl);
    assert.equal(result.verifiedOwnerBadgeLabel, detail.verifiedOwnerBadgeLabel);
    assert.deepEqual(result.ownerFeaturedBadges, detail.ownerFeaturedBadges);
    assert.deepEqual(result.photoUrls, detail.photoUrls);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /profileToolsMedia/);
  } finally {
    console.warn = originalWarn;
  }
});
