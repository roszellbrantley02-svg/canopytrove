import { describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getCanopyTroveAuthCacheKey: vi.fn(() => 'signed-out'),
}));

vi.mock('./canopyTroveAuthService', () => ({
  getCanopyTroveAuthCacheKey: authMocks.getCanopyTroveAuthCacheKey,
}));

import {
  stripMemberOnlyDealsFromDetail,
  stripMemberOnlyDealsFromSummary,
} from './storefrontMemberDealAccessService';
import type { StorefrontDetails, StorefrontSummary } from '../types/storefront';

function createSummary(): StorefrontSummary {
  return {
    id: 'store-1',
    licenseId: 'license-1',
    marketId: 'nyc',
    displayName: 'Canopy Store',
    legalName: 'Canopy Store LLC',
    addressLine1: '1 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    distanceMiles: 1.1,
    travelMinutes: 5,
    rating: 4.6,
    reviewCount: 12,
    openNow: true,
    isVerified: true,
    mapPreviewLabel: 'Verified OCM storefront',
    promotionText: '20% off flower',
    promotionBadges: ['20% off'],
    promotionExpiresAt: '2026-04-01T00:00:00.000Z',
    activePromotionId: 'promo-1',
    activePromotionCount: 2,
    premiumCardVariant: 'hot_deal',
    thumbnailUrl: 'https://example.com/store.jpg',
  };
}

function createDetail(): StorefrontDetails {
  return {
    storefrontId: 'store-1',
    phone: '555-0100',
    website: 'https://example.com',
    hours: ['Mon-Fri 9am-9pm'],
    openNow: true,
    hasOwnerClaim: true,
    activePromotions: [
      {
        id: 'promo-1',
        title: 'Today only',
        description: '20% off flower',
        badges: ['20% off'],
        startsAt: '2026-03-31T12:00:00.000Z',
        endsAt: '2026-04-01T00:00:00.000Z',
        cardTone: 'hot_deal',
      },
    ],
    photoCount: 4,
    appReviewCount: 1,
    appReviews: [
      {
        id: 'review-1',
        authorName: 'Member One',
        authorProfileId: 'profile-1',
        rating: 5,
        relativeTime: 'Just now',
        text: 'Great storefront.',
        photoUrls: ['https://example.com/review-photo.jpg'],
        tags: [],
        helpfulCount: 0,
      },
    ],
    photoUrls: [
      'https://example.com/store-1.jpg',
      'https://example.com/store-2.jpg',
      'https://example.com/store-3.jpg',
      'https://example.com/store-4.jpg',
    ],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
  };
}

describe('storefrontMemberDealAccessService', () => {
  it('keeps one featured live deal visible while hiding signed-out thumbnails', () => {
    expect(stripMemberOnlyDealsFromSummary(createSummary())).toMatchObject({
      promotionText: '20% off flower',
      promotionBadges: ['20% off'],
      activePromotionId: 'promo-1',
      activePromotionCount: 2,
      thumbnailUrl: null,
    });
  });

  it('keeps two storefront photo previews while hiding signed-out deal stacks and review media', () => {
    expect(stripMemberOnlyDealsFromDetail(createDetail())).toMatchObject({
      activePromotions: [],
      photoCount: 4,
      photoUrls: ['https://example.com/store-1.jpg', 'https://example.com/store-2.jpg'],
      appReviews: [
        expect.objectContaining({
          photoUrls: [],
        }),
      ],
    });
  });
});
