import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GooglePlacesEnrichment } from './googlePlacesShared';
import type { StorefrontRecord } from '../../../src/types/storefrontRecord';
import {
  buildDiscoveryCandidateDocument,
  buildPublishedStorefrontDetailDocument,
  buildPublishedStorefrontSummaryDocument,
  deriveDiscoveryPublicationStatus,
} from './storefrontDiscoveryEnrichmentService';
import { LIVE_DISCOVERY_PENDING_HOURS_LABEL } from './storefrontDiscoverySourceService';

function createStorefrontRecord(overrides: Partial<StorefrontRecord> = {}): StorefrontRecord {
  return {
    id: 'ny-store-1',
    licenseId: 'LIC-001',
    marketId: 'ny-launch',
    displayName: 'Canopy Trove Midtown',
    legalName: 'Canopy Trove Midtown LLC',
    addressLine1: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    coordinates: {
      latitude: 40.7484,
      longitude: -73.9857,
    },
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 4.8,
    reviewCount: 128,
    openNow: false,
    isVerified: true,
    mapPreviewLabel: 'Open now',
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    favoriteFollowerCount: null,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    premiumCardVariant: 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    placeId: undefined,
    thumbnailUrl: null,
    phone: null,
    website: null,
    hours: [],
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
    ...overrides,
  };
}

test('derives publish state from NY verification and open status', () => {
  const nyOpen = createStorefrontRecord({
    openNow: true,
  });
  const closedNy = createStorefrontRecord({
    openNow: false,
  });
  const outOfState = createStorefrontRecord({
    state: 'NJ',
  });
  const unverified = createStorefrontRecord({
    isVerified: false,
  });
  const googleEnrichment: GooglePlacesEnrichment = {
    phone: '212-555-0100',
    website: 'https://canopytrove.example',
    hours: ['Monday: 9:00 AM - 9:00 PM'],
    openNow: true,
  };
  const hoursPending = createStorefrontRecord({
    openNow: true,
    hours: [],
    mapPreviewLabel: LIVE_DISCOVERY_PENDING_HOURS_LABEL,
  });

  assert.deepEqual(deriveDiscoveryPublicationStatus(outOfState, null), {
    publicationStatus: 'suppressed',
    publicationReason: 'Source storefront is outside the New York launch scope.',
  });
  assert.deepEqual(deriveDiscoveryPublicationStatus(unverified, null), {
    publicationStatus: 'suppressed',
    publicationReason: 'Source storefront is not verified in the OCM feed.',
  });
  assert.deepEqual(deriveDiscoveryPublicationStatus(closedNy, null), {
    publicationStatus: 'hidden',
    publicationReason: 'Hidden until manual publish after public-open verification.',
  });
  assert.deepEqual(deriveDiscoveryPublicationStatus(nyOpen, null), {
    publicationStatus: 'ready_for_publish',
    publicationReason: 'Storefront is publicly open and eligible for manual publish.',
  });
  assert.deepEqual(deriveDiscoveryPublicationStatus(closedNy, googleEnrichment), {
    publicationStatus: 'ready_for_publish',
    publicationReason: 'Storefront is publicly open and eligible for manual publish.',
  });
  assert.deepEqual(deriveDiscoveryPublicationStatus(hoursPending, null), {
    publicationStatus: 'ready_for_publish',
    publicationReason: 'Storefront is publicly open and eligible for manual publish.',
  });
});

test('keeps a previously published candidate published while refreshing its data', () => {
  const source = createStorefrontRecord({
    openNow: true,
  });
  const baseCandidate = buildDiscoveryCandidateDocument(source, {
    googlePlaceId: 'google-place-1',
    googleEnrichment: {
      phone: '212-555-0100',
      website: 'https://canopytrove.example',
      hours: ['Monday: 9:00 AM - 9:00 PM'],
      openNow: true,
    },
    nowIso: '2026-03-30T00:00:00.000Z',
  });
  const publishedCandidate = buildDiscoveryCandidateDocument(source, {
    googlePlaceId: 'google-place-2',
    googleEnrichment: {
      phone: '212-555-0200',
      website: 'https://updated.example',
      hours: ['Tuesday: 10:00 AM - 8:00 PM'],
      openNow: true,
    },
    existing: {
      ...baseCandidate,
      publicationStatus: 'published',
      publicationReason: 'Published manually from the discovery staging queue.',
      publishedAt: '2026-03-29T12:00:00.000Z',
      publishedSummaryId: 'ny-store-1',
      publishedDetailId: 'ny-store-1',
    },
    nowIso: '2026-03-30T00:00:00.000Z',
  });

  assert.equal(publishedCandidate.publicationStatus, 'published');
  assert.equal(
    publishedCandidate.publicationReason,
    'Published manually from the discovery staging queue.',
  );
  assert.equal(publishedCandidate.publishedAt, '2026-03-29T12:00:00.000Z');
  assert.equal(publishedCandidate.publishedSummaryId, 'ny-store-1');
  assert.equal(publishedCandidate.publishedDetailId, 'ny-store-1');
  assert.equal(publishedCandidate.googlePlaceId, 'google-place-2');
  assert.equal(publishedCandidate.googleEnrichment?.phone, '212-555-0200');
});

test('builds published storefront documents from the discovery staging source', () => {
  const source = createStorefrontRecord({
    openNow: false,
    website: 'https://store.example',
    phone: '212-555-0199',
    hours: ['Monday: 9:00 AM - 9:00 PM'],
    thumbnailUrl: 'https://store.example/thumb.png',
  });
  const googleEnrichment: GooglePlacesEnrichment = {
    phone: '212-555-0111',
    website: 'https://google.example',
    hours: ['Monday: 10:00 AM - 8:00 PM', 'Tuesday: 10:00 AM - 8:00 PM'],
    openNow: true,
    location: {
      latitude: 40.751,
      longitude: -73.983,
    },
  };

  const summary = buildPublishedStorefrontSummaryDocument(
    source,
    'google-place-3',
    googleEnrichment,
  );
  const detail = buildPublishedStorefrontDetailDocument(source, googleEnrichment);

  assert.equal(summary.placeId, 'google-place-3');
  assert.equal(summary.rating, 4.8);
  assert.equal(summary.reviewCount, 128);
  assert.equal(summary.openNow, true);
  assert.deepEqual(summary.hours, ['Monday: 10:00 AM - 8:00 PM', 'Tuesday: 10:00 AM - 8:00 PM']);
  assert.equal(summary.latitude, 40.751);
  assert.equal(summary.longitude, -73.983);
  assert.equal(summary.menuUrl, 'https://store.example');
  assert.equal(summary.thumbnailUrl, 'https://store.example/thumb.png');
  assert.equal(detail.phone, '212-555-0111');
  assert.equal(detail.website, 'https://google.example');
  assert.deepEqual(detail.hours, ['Monday: 10:00 AM - 8:00 PM', 'Tuesday: 10:00 AM - 8:00 PM']);
  assert.equal(detail.openNow, true);
  assert.deepEqual(detail.photoUrls, []);
  assert.equal(detail.routeMode, 'verified');
});

test('keeps published detail open state unknown when live discovery only knows the store is verified', () => {
  const source = createStorefrontRecord({
    openNow: true,
    hours: [],
    mapPreviewLabel: LIVE_DISCOVERY_PENDING_HOURS_LABEL,
  });

  const summary = buildPublishedStorefrontSummaryDocument(source, null, null);
  const detail = buildPublishedStorefrontDetailDocument(source, null);

  assert.equal(summary.openNow, true);
  assert.equal(detail.openNow, null);
});
