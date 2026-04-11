import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from './types';

const sourcesModulePath = require.resolve('./sources');
const loggerModulePath = require.resolve('./observability/logger');
const storefrontCacheServiceModulePath = require.resolve('./services/storefrontCacheService');
const googlePlacesServiceModulePath = require.resolve('./services/googlePlacesService');
const ownerClaimPresenceServiceModulePath = require.resolve('./services/ownerClaimPresenceService');
const ownerPortalWorkspaceServiceModulePath = require.resolve('./services/ownerPortalWorkspaceService');
const storefrontCommunityServiceModulePath = require.resolve('./services/storefrontCommunityService');
const storefrontServiceModulePath = require.resolve('./storefrontService');

const originalModuleEntries = new Map(
  [
    sourcesModulePath,
    loggerModulePath,
    storefrontCacheServiceModulePath,
    googlePlacesServiceModulePath,
    ownerClaimPresenceServiceModulePath,
    ownerPortalWorkspaceServiceModulePath,
    storefrontCommunityServiceModulePath,
  ].map((modulePath) => [modulePath, require.cache[modulePath]]),
);

function setCachedModule(modulePath: string, exports: unknown) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
    children: [],
    path: modulePath,
  } as unknown as NodeJS.Module;
}

function createSummary(
  overrides: Partial<StorefrontSummaryApiDocument> = {},
): StorefrontSummaryApiDocument {
  return {
    id: 'storefront-hidden',
    licenseId: 'license-1',
    marketId: 'market-1',
    displayName: 'Hidden Storefront',
    legalName: 'Hidden Storefront LLC',
    addressLine1: '123 Main St',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    latitude: 42.6526,
    longitude: -73.7562,
    distanceMiles: 1.2,
    travelMinutes: 4,
    rating: 4.7,
    reviewCount: 19,
    openNow: true,
    hours: ['Mon-Fri 9:00 AM-9:00 PM'],
    isVerified: true,
    mapPreviewLabel: 'Albany dispensary',
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    activePromotionCount: 0,
    favoriteFollowerCount: 12,
    menuUrl: 'https://example.com/menu',
    verifiedOwnerBadgeLabel: 'Verified owner',
    ownerFeaturedBadges: [],
    ownerCardSummary: 'Summary',
    premiumCardVariant: 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    placeId: 'place-1',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    promotionAndroidEligible: true,
    isVisible: true,
    ...overrides,
  };
}

function createDetail(overrides: Partial<StorefrontDetailApiDocument> = {}): StorefrontDetailApiDocument {
  return {
    storefrontId: 'storefront-hidden',
    phone: '555-0100',
    website: 'https://example.com',
    hours: ['Mon-Fri 9:00 AM-9:00 PM'],
    openNow: true,
    hasOwnerClaim: false,
    menuUrl: 'https://example.com/menu',
    verifiedOwnerBadgeLabel: 'Verified owner',
    favoriteFollowerCount: 12,
    ownerFeaturedBadges: [],
    activePromotions: [],
    photoCount: 0,
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [],
    amenities: [],
    editorialSummary: 'Editorial summary',
    routeMode: 'verified',
    ...overrides,
  };
}

afterEach(() => {
  delete require.cache[storefrontServiceModulePath];

  for (const [modulePath, cachedModule] of originalModuleEntries.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
      continue;
    }

    delete require.cache[modulePath];
  }
});

test('getStorefrontDetail suppresses detail payloads for hidden storefront summaries', async () => {
  let currentSummary = createSummary({ isVisible: true });
  const detail = createDetail();

  setCachedModule(sourcesModulePath, {
    backendStorefrontSource: {
      getAllSummaries: async () => [currentSummary],
      getSummariesByIds: async () => [currentSummary],
      getSummaryPage: async () => ({
        items: [currentSummary],
        total: 1,
        limit: 1,
        offset: 0,
      }),
      getSummaries: async () => [currentSummary],
      getDetailsById: async () => detail,
    },
    backendStorefrontSourceStatus: {
      requestedMode: 'mock',
      activeMode: 'mock',
      available: true,
      fallbackReason: null,
    },
  });

  setCachedModule(loggerModulePath, {
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
  });

  setCachedModule(storefrontCacheServiceModulePath, {
    getCachedStorefrontDetail: async (
      _storefrontId: string,
      loader: () => Promise<StorefrontDetailApiDocument | null>,
    ) => loader(),
    getCachedStorefrontSummariesByIds: async (
      _ids: string[],
      loader: () => Promise<StorefrontSummaryApiDocument[]>,
    ) => loader(),
    getCachedStorefrontSummaryPage: async (
      _query: unknown,
      loader: () => Promise<unknown>,
    ) => loader(),
    invalidateCachedStorefrontDetail() {},
  });

  setCachedModule(googlePlacesServiceModulePath, {
    backfillGooglePlaceIdsForSummaries() {},
    getCachedGooglePlacesEnrichment: () => null,
    getGooglePlacesEnrichment: async () => null,
    hasInFlightGooglePlacesEnrichment: () => false,
    hasGooglePlacesConfig: () => false,
    prewarmGooglePlacesEnrichmentForSummaries() {},
  });

  setCachedModule(ownerClaimPresenceServiceModulePath, {
    hasStorefrontOwnerClaim: async () => false,
  });

  setCachedModule(ownerPortalWorkspaceServiceModulePath, {
    applyOwnerWorkspaceDetailEnhancements: async (value: StorefrontDetailApiDocument) => value,
    applyOwnerWorkspaceSummaryEnhancements: async (value: StorefrontSummaryApiDocument) => value,
  });

  setCachedModule(storefrontCommunityServiceModulePath, {
    listStorefrontAppReviews: async () => [],
  });

  delete require.cache[storefrontServiceModulePath];
  const { getStorefrontDetail } = require('./storefrontService') as typeof import('./storefrontService');

  const visibleDetail = await getStorefrontDetail('storefront-hidden');
  assert.equal(visibleDetail?.storefrontId, 'storefront-hidden');

  currentSummary = createSummary({ isVisible: false });
  const hiddenDetail = await getStorefrontDetail('storefront-hidden');
  assert.equal(hiddenDetail, null);
});
