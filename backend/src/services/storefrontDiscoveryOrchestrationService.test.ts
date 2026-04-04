import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import type { StorefrontRecord } from '../../../src/types/storefrontRecord';
import { buildDiscoveryCandidateDocument } from './storefrontDiscoveryEnrichmentService';
import {
  clearStorefrontDiscoveryRepositoryState,
  getStorefrontDiscoveryCandidate,
  saveStorefrontDiscoveryCandidate,
} from './storefrontDiscoveryRepository';

async function loadService() {
  return import(`./storefrontDiscoveryOrchestrationService?test=${Date.now()}-${Math.random()}`);
}

function createStorefrontRecord(overrides: Partial<StorefrontRecord> = {}): StorefrontRecord {
  return {
    id: 'ny-store-2',
    licenseId: 'LIC-002',
    marketId: 'ny-launch',
    displayName: 'Canopy Trove SoHo',
    legalName: 'Canopy Trove SoHo LLC',
    addressLine1: '456 Broadway',
    city: 'New York',
    state: 'NY',
    zip: '10012',
    coordinates: {
      latitude: 40.723,
      longitude: -74.0,
    },
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 4.7,
    reviewCount: 91,
    openNow: true,
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

afterEach(async () => {
  clearStorefrontDiscoveryRepositoryState();
  const { stopStorefrontDiscoveryScheduler } = await loadService();
  stopStorefrontDiscoveryScheduler();
});

test('calculates the next storefront discovery run on a biweekly cadence', async () => {
  const { calculateNextStorefrontDiscoveryRunAt } = await loadService();

  assert.equal(
    calculateNextStorefrontDiscoveryRunAt(
      '2026-03-30T00:00:00.000Z',
      new Date('2026-03-30T00:00:00.000Z'),
    ),
    '2026-04-13T00:00:00.000Z',
  );
  assert.equal(
    calculateNextStorefrontDiscoveryRunAt(null, new Date('2026-03-30T00:00:00.000Z')),
    '2026-04-13T00:00:00.000Z',
  );
});

test('schedules a failed storefront discovery retry for one hour later', async () => {
  const { calculateFailedStorefrontDiscoveryRetryAt } = await loadService();

  assert.equal(
    calculateFailedStorefrontDiscoveryRetryAt(
      '2026-03-30T00:00:00.000Z',
      new Date('2026-03-30T00:00:00.000Z'),
    ),
    '2026-03-30T01:00:00.000Z',
  );
});

test('treats stale state as sweep-due and future state as scheduled', async () => {
  const { isStorefrontDiscoverySweepDue } = await loadService();

  assert.equal(
    isStorefrontDiscoverySweepDue(
      {
        lastSuccessfulRunAt: '2026-03-01T00:00:00.000Z',
        nextRunAt: '2026-03-14T00:00:00.000Z',
      },
      Date.parse('2026-03-30T00:00:00.000Z'),
    ),
    true,
  );
  assert.equal(
    isStorefrontDiscoverySweepDue(
      {
        lastSuccessfulRunAt: '2026-03-30T00:00:00.000Z',
        nextRunAt: '2026-04-13T00:00:00.000Z',
      },
      Date.parse('2026-03-30T00:00:00.000Z'),
    ),
    false,
  );
});

test('publishes a ready candidate and keeps the hidden staging record in sync', async () => {
  const { publishStorefrontDiscoveryCandidate } = await loadService();

  clearStorefrontDiscoveryRepositoryState();
  const source = createStorefrontRecord({
    openNow: true,
  });
  const stagedCandidate = buildDiscoveryCandidateDocument(source, {
    googlePlaceId: 'google-place-44',
    googleEnrichment: {
      businessStatus: 'OPERATIONAL',
      phone: '212-555-0444',
      website: 'https://soho.example',
      hours: ['Monday: 9:00 AM - 9:00 PM'],
      openNow: true,
    },
    nowIso: '2026-03-30T00:00:00.000Z',
  });

  await saveStorefrontDiscoveryCandidate(stagedCandidate);

  const result = await publishStorefrontDiscoveryCandidate(stagedCandidate.id);
  const publishedCandidate = await getStorefrontDiscoveryCandidate(stagedCandidate.id);

  assert.equal(result.ok, true);
  assert.equal(result.candidate.publicationStatus, 'published');
  assert.equal(result.summary.openNow, true);
  assert.equal(result.detail.phone, '212-555-0444');
  assert.equal(result.detail.website, 'https://soho.example');
  assert.equal(publishedCandidate?.publicationStatus, 'published');
  assert.equal(publishedCandidate?.publishedSummaryId, stagedCandidate.id);
  assert.equal(publishedCandidate?.publishedDetailId, stagedCandidate.id);
});

test('persists published storefront summary/detail atomically with a single batch commit', async () => {
  const {
    buildPublishedStorefrontDetailDocument,
    buildPublishedStorefrontSummaryDocument,
    persistPublishedStorefrontDocumentsForTests,
  } = await loadService();

  const source = createStorefrontRecord({
    openNow: true,
    website: 'https://soho.example',
    phone: '212-555-0123',
    hours: ['Monday: 9:00 AM - 9:00 PM'],
  });
  const summary = buildPublishedStorefrontSummaryDocument(source, 'google-place-55', null);
  const detail = buildPublishedStorefrontDetailDocument(source, null);
  const writes: Array<{ path: string; value: Record<string, unknown> }> = [];
  let commitCount = 0;

  const fakeDb = {
    collection(name: string) {
      return {
        doc(id: string) {
          return { path: `${name}/${id}` };
        },
      };
    },
    batch() {
      return {
        set(reference: { path: string }, value: Record<string, unknown>) {
          writes.push({ path: reference.path, value });
          return this;
        },
        async commit() {
          commitCount += 1;
        },
      };
    },
  };

  await persistPublishedStorefrontDocumentsForTests(
    source.id,
    summary,
    detail,
    '2026-03-30T00:00:00.000Z',
    {
      refreshCaches: false,
      dbOverride: fakeDb,
    },
  );

  assert.equal(commitCount, 1);
  assert.deepEqual(
    writes.map((write) => write.path),
    ['storefront_summaries/ny-store-2', 'storefront_details/ny-store-2'],
  );
  assert.equal(writes[0]?.value.ingestSource, 'registry');
  assert.equal(writes[1]?.value.ingestSource, 'registry');
});
