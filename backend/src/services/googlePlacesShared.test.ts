import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
});

afterEach(async () => {
  const { clearGooglePlacesCaches, setGooglePlacesDbForTests } = await import('./googlePlacesShared');
  const {
    clearFirestoreStorefrontSourceCache,
  } = await import('../sources/firestoreStorefrontSource');
  setGooglePlacesDbForTests(null);
  clearGooglePlacesCaches();
  clearFirestoreStorefrontSourceCache();
  if (typeof ORIGINAL_NODE_ENV === 'string') {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    return;
  }

  delete process.env.NODE_ENV;
});

test('persistPlaceId clears Firestore storefront source caches after a successful write', async () => {
  const {
    clearFirestoreStorefrontSourceCache,
    getFirestoreStorefrontSourceCacheStateForTests,
    seedFirestoreStorefrontSourceCacheForTests,
  } = await import('../sources/firestoreStorefrontSource');
  const { persistPlaceId, setGooglePlacesDbForTests } = await import('./googlePlacesShared');
  clearFirestoreStorefrontSourceCache();
  seedFirestoreStorefrontSourceCacheForTests();

  let setCalls = 0;
  const firestoreStub = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return {
                exists: true,
              };
            },
            async set() {
              setCalls += 1;
            },
          };
        },
      };
    },
  };
  setGooglePlacesDbForTests(firestoreStub as never);

  assert.deepEqual(getFirestoreStorefrontSourceCacheStateForTests(), {
    scopedSummaryCacheSize: 1,
    scopedSummaryInFlightSize: 1,
    nearbySummaryCacheSize: 1,
    nearbySummaryInFlightSize: 1,
    hasMaterializedSummaryCache: true,
    hasMaterializedSummaryInFlight: true,
  });

  await persistPlaceId('test-storefront', 'test-place-id');

  assert.equal(setCalls, 1);
  assert.deepEqual(getFirestoreStorefrontSourceCacheStateForTests(), {
    scopedSummaryCacheSize: 0,
    scopedSummaryInFlightSize: 0,
    nearbySummaryCacheSize: 0,
    nearbySummaryInFlightSize: 0,
    hasMaterializedSummaryCache: false,
    hasMaterializedSummaryInFlight: false,
  });
});
