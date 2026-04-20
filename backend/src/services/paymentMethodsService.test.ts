import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { StorefrontSummaryApiDocument } from '../types';

const firebaseModulePath = require.resolve('../firebase');
const googlePlacesServiceModulePath = require.resolve('./googlePlacesService');
const paymentMethodsServicePath = require.resolve('./paymentMethodsService');

const originalFirebaseModule = require.cache[firebaseModulePath];
const originalGooglePlacesServiceModule = require.cache[googlePlacesServiceModulePath];

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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeRecords(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      mergeRecords(target[key] as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }

    target[key] = cloneJson(value);
  }

  return target;
}

function createFakeDb() {
  const documents = new Map<string, Record<string, unknown>>();

  const createDocRef = (path: string) => ({
    id: path.split('/').at(-1) ?? path,
    path,
    collection: (name: string) => ({
      doc: (id: string) => createDocRef(`${path}/${name}/${id}`),
    }),
    get: async () => {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        id: path.split('/').at(-1) ?? path,
        data: () => data,
      };
    },
  });

  return {
    documents,
    db: {
      collection: (name: string) => ({
        doc: (id: string) => createDocRef(`${name}/${id}`),
      }),
      runTransaction: async (
        callback: (transaction: {
          get: (ref: { path: string; id: string }) => Promise<{
            exists: boolean;
            id: string;
            data: () => Record<string, unknown> | undefined;
          }>;
          set: (
            ref: { path: string },
            data: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => void;
        }) => Promise<'created' | 'updated' | 'deduped'>,
      ) => {
        const pendingWrites: Array<{
          path: string;
          data: Record<string, unknown>;
          merge: boolean;
        }> = [];

        const result = await callback({
          get: async (ref) => {
            const data = documents.get(ref.path);
            return {
              exists: data !== undefined,
              id: ref.id,
              data: () => data,
            };
          },
          set: (ref, data, options) => {
            pendingWrites.push({
              path: ref.path,
              data,
              merge: options?.merge === true,
            });
          },
        });

        for (const write of pendingWrites) {
          const existing = documents.get(write.path);
          if (!write.merge || !existing) {
            documents.set(write.path, cloneJson(write.data));
            continue;
          }

          documents.set(write.path, mergeRecords(cloneJson(existing), write.data));
        }

        return result;
      },
    },
  };
}

afterEach(() => {
  delete require.cache[paymentMethodsServicePath];

  if (originalFirebaseModule) {
    require.cache[firebaseModulePath] = originalFirebaseModule;
  } else {
    delete require.cache[firebaseModulePath];
  }

  if (originalGooglePlacesServiceModule) {
    require.cache[googlePlacesServiceModulePath] = originalGooglePlacesServiceModule;
  } else {
    delete require.cache[googlePlacesServiceModulePath];
  }
});

function createSummary(overrides: Partial<StorefrontSummaryApiDocument> = {}) {
  return {
    id: 'storefront-1',
    licenseId: 'license-1',
    marketId: 'nyc',
    displayName: 'Canopy Trove Test',
    legalName: 'Canopy Trove Test LLC',
    addressLine1: '1 Example Ave',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    latitude: 40.75,
    longitude: -73.99,
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 0,
    reviewCount: 0,
    openNow: true,
    hours: [],
    isVerified: true,
    mapPreviewLabel: 'Verified OCM storefront',
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
    ...overrides,
  } satisfies StorefrontSummaryApiDocument;
}

test('recordCommunityPaymentReport dedupes repeated install votes and updates flipped votes', async () => {
  const fakeDb = createFakeDb();

  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => fakeDb.db,
  });

  const { recordCommunityPaymentReport } =
    require('./paymentMethodsService') as typeof import('./paymentMethodsService');

  const firstResult = await recordCommunityPaymentReport({
    storefrontId: 'storefront-1',
    methodId: 'cash',
    accepted: true,
    installId: 'install-1',
  });
  const duplicateResult = await recordCommunityPaymentReport({
    storefrontId: 'storefront-1',
    methodId: 'cash',
    accepted: true,
    installId: 'install-1',
  });
  const flippedResult = await recordCommunityPaymentReport({
    storefrontId: 'storefront-1',
    methodId: 'cash',
    accepted: false,
    installId: 'install-1',
  });

  assert.equal(firstResult.outcome, 'created');
  assert.equal(duplicateResult.outcome, 'deduped');
  assert.equal(flippedResult.outcome, 'updated');

  const aggregate = fakeDb.documents.get('payment_method_reports/storefront-1');
  assert.ok(aggregate);
  assert.deepEqual((aggregate as { counts?: Record<string, unknown> }).counts?.cash, {
    accepted: 0,
    rejected: 1,
  });

  const votePaths = Array.from(fakeDb.documents.keys()).filter((path) => path.includes('/votes/'));
  assert.equal(votePaths.length, 1);
});

test('attachPaymentMethodsToSummaries seeds baseline cash when sources are unavailable', async () => {
  const fakeDb = createFakeDb();

  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => fakeDb.db,
  });
  setCachedModule(googlePlacesServiceModulePath, {
    getGooglePlacesEnrichment: async () => null,
  });

  const { attachPaymentMethodsToSummaries } =
    require('./paymentMethodsService') as typeof import('./paymentMethodsService');

  const [summary] = await attachPaymentMethodsToSummaries([createSummary()]);

  assert.ok(summary?.paymentMethods);
  assert.deepEqual(summary.paymentMethods.methods, [
    {
      methodId: 'cash',
      accepted: true,
      source: 'google',
    },
  ]);
  assert.equal(summary.paymentMethods.hasOwnerDeclaration, false);
});
