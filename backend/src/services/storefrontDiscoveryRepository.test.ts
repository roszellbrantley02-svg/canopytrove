import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const ENV_KEYS = [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_PROJECT_ID',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
  'FIREBASE_DATABASE_ID',
  'K_SERVICE',
  'K_REVISION',
  'K_CONFIGURATION',
];

function clearFirebaseEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

async function loadRepository() {
  return import(`./storefrontDiscoveryRepository?test=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  clearFirebaseEnv();
});

afterEach(async () => {
  clearFirebaseEnv();
  const { clearStorefrontDiscoveryRepositoryState } = await loadRepository();
  clearStorefrontDiscoveryRepositoryState();
});

test('persists discovery candidates, runs, and state in memory when firestore is unavailable', async () => {
  const {
    clearStorefrontDiscoveryRepositoryState,
    getLatestStorefrontDiscoveryRun,
    getStorefrontDiscoveryCandidate,
    listStorefrontDiscoveryCandidates,
    listStorefrontDiscoveryRuns,
    loadStorefrontDiscoveryState,
    saveStorefrontDiscoveryCandidate,
    saveStorefrontDiscoveryRun,
    saveStorefrontDiscoveryState,
  } = await loadRepository();

  clearStorefrontDiscoveryRepositoryState();

  const candidate = {
    id: 'ny-store-1',
    sourceKind: 'ocm_verified_seed' as const,
    source: {
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
      routeMode: 'verified' as const,
    },
    googlePlaceId: 'place-1',
    googleEnrichment: null,
    publicationStatus: 'hidden' as const,
    publicationReason: 'Hidden until manual publish after public-open verification.',
    discoveredAt: '2026-03-30T00:00:00.000Z',
    lastCheckedAt: '2026-03-30T00:00:00.000Z',
    publishedAt: null,
    publishedSummaryId: null,
    publishedDetailId: null,
    updatedAt: '2026-03-30T00:00:00.000Z',
  };

  const run = {
    id: 'run-1',
    reason: 'manual' as const,
    status: 'completed' as const,
    startedAt: '2026-03-30T00:00:00.000Z',
    finishedAt: '2026-03-30T00:10:00.000Z',
    sourceCount: 1,
    candidateCount: 1,
    hiddenCount: 1,
    readyForPublishCount: 0,
    publishedCount: 0,
    suppressedCount: 0,
    failedCount: 0,
    limit: 1,
    marketId: 'ny-launch',
    lastError: null,
  };

  const state = {
    lastRunId: run.id,
    lastRunAt: run.startedAt,
    lastSuccessfulRunAt: run.finishedAt,
    nextRunAt: '2026-04-13T00:10:00.000Z',
    lastRunReason: run.reason,
    lastRunStatus: run.status,
    lastError: null,
    totalSourceCount: 1,
    candidateCount: 1,
    hiddenCount: 1,
    readyForPublishCount: 0,
    publishedCount: 0,
    suppressedCount: 0,
    lastRunLimit: 1,
    lastRunMarketId: 'ny-launch',
  };

  await saveStorefrontDiscoveryCandidate(candidate);
  await saveStorefrontDiscoveryRun(run);
  await saveStorefrontDiscoveryState(state);

  assert.equal((await getStorefrontDiscoveryCandidate('ny-store-1'))?.publicationStatus, 'hidden');
  assert.equal((await listStorefrontDiscoveryCandidates(5)).length, 1);
  assert.equal((await listStorefrontDiscoveryRuns(5)).length, 1);
  assert.equal((await getLatestStorefrontDiscoveryRun())?.id, 'run-1');
  assert.deepEqual(await loadStorefrontDiscoveryState(), state);
});

test('strips undefined values from nested discovery payloads before firestore writes', async () => {
  const { stripUndefinedDeep } = await loadRepository();

  const sanitized = stripUndefinedDeep({
    id: 'candidate-1',
    source: {
      id: 'storefront-1',
      placeId: undefined,
      metadata: {
        optional: undefined,
        openNow: false,
      },
    },
    publishedAt: null,
    fields: [1, undefined, { keep: true, drop: undefined }],
  });

  assert.deepEqual(sanitized, {
    id: 'candidate-1',
    source: {
      id: 'storefront-1',
      metadata: {
        openNow: false,
      },
    },
    publishedAt: null,
    fields: [1, { keep: true }],
  });
  assert.equal('placeId' in sanitized.source, false);
  assert.equal('optional' in sanitized.source.metadata, false);
});
