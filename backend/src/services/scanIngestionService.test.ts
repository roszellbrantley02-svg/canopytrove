import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { OcmLookupResult } from './ocmLicenseLookupService';
import type { BrandPageResolution } from './brandPageResolverService';

const firebaseModulePath = require.resolve('../firebase');
const ocmLookupModulePath = require.resolve('./ocmLicenseLookupService');
const brandPageResolverModulePath = require.resolve('./brandPageResolverService');
const scanIngestionServicePath = require.resolve('./scanIngestionService');

const originalFirebaseModule = require.cache[firebaseModulePath];
const originalOcmLookupModule = require.cache[ocmLookupModulePath];
const originalBrandPageResolverModule = require.cache[brandPageResolverModulePath];

type FakeDocumentData = Record<string, unknown>;
type FakeDocumentRef = {
  id: string;
  path: string;
  collection: (name: string) => { doc: (id: string) => FakeDocumentRef };
};
type FakeSnapshot = {
  exists: boolean;
  id: string;
  data: () => FakeDocumentData | undefined;
};
type FakeTransaction = {
  get: (ref: FakeDocumentRef) => Promise<FakeSnapshot>;
  set: (ref: FakeDocumentRef, data: FakeDocumentData, options?: { merge?: boolean }) => void;
};

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

function restoreCachedModule(modulePath: string, originalModule: NodeJS.Module | undefined) {
  if (originalModule) {
    require.cache[modulePath] = originalModule;
    return;
  }

  delete require.cache[modulePath];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeRecords(target: FakeDocumentData, source: FakeDocumentData) {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      mergeRecords(existing as FakeDocumentData, value as FakeDocumentData);
      continue;
    }

    target[key] = cloneJson(value);
  }

  return target;
}

function createDocRef(path: string): FakeDocumentRef {
  return {
    id: path.split('/').at(-1) ?? path,
    path,
    collection: (name: string) => ({
      doc: (id: string) => createDocRef(`${path}/${name}/${id}`),
    }),
  };
}

function createFakeDb() {
  const documents = new Map<string, FakeDocumentData>();

  return {
    documents,
    db: {
      collection: (name: string) => ({
        doc: (id: string) => createDocRef(`${name}/${id}`),
      }),
      runTransaction: async <T>(callback: (transaction: FakeTransaction) => Promise<T>) => {
        const pendingWrites: Array<{
          path: string;
          data: FakeDocumentData;
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

function createMissingLicenseResult(): OcmLookupResult {
  return {
    found: false,
    active: false,
    record: null,
    matchScore: null,
    error: null,
  };
}

function loadScanService(
  options: {
    db?: ReturnType<typeof createFakeDb>['db'] | null;
    lookupOcmLicense?: (licenseNumber: string) => Promise<OcmLookupResult>;
    resolveBrandPage?: (rawUrl: string) => Promise<BrandPageResolution>;
  } = {},
) {
  delete require.cache[scanIngestionServicePath];
  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => options.db ?? null,
  });
  setCachedModule(ocmLookupModulePath, {
    lookupOcmLicense: options.lookupOcmLicense ?? (async () => createMissingLicenseResult()),
  });
  setCachedModule(brandPageResolverModulePath, {
    resolveBrandPage: options.resolveBrandPage ?? (async () => ({ outcome: 'none' as const })),
  });

  return require('./scanIngestionService') as typeof import('./scanIngestionService');
}

function listCollectionDocuments(fakeDb: ReturnType<typeof createFakeDb>, collectionName: string) {
  return Array.from(fakeDb.documents.entries()).filter(([path]) =>
    path.startsWith(`${collectionName}/`),
  );
}

afterEach(() => {
  delete require.cache[scanIngestionServicePath];
  restoreCachedModule(firebaseModulePath, originalFirebaseModule);
  restoreCachedModule(ocmLookupModulePath, originalOcmLookupModule);
  restoreCachedModule(brandPageResolverModulePath, originalBrandPageResolverModule);
});

test('ingestScan routes known and generic COA URLs to verified product resolutions', async () => {
  const fakeDb = createFakeDb();
  const { ingestScan } = loadScanService({ db: fakeDb.db });

  const cases = [
    {
      rawCode: 'https://coa.kaychalabs.com/reports/KAYCHA-123',
      labName: 'kaycha_labs',
      batchId: 'KAYCHA-123',
    },
    {
      rawCode: 'https://nygreenanalytics.com/reports/NYGA-456',
      labName: 'ny_green_analytics',
      batchId: 'NYGA-456',
    },
    {
      rawCode: 'https://www.proverdelabs.com/coa/PV-789',
      labName: 'proverde_laboratories',
      batchId: 'PV-789',
    },
    {
      rawCode: 'https://keystonestatetesting.com/test/KEY-321',
      labName: 'keystone_state_testing',
      batchId: 'KEY-321',
    },
    {
      rawCode: 'https://results.actlabs.com/coa/ACT-654',
      labName: 'act_laboratories',
      batchId: 'ACT-654',
    },
    {
      rawCode: 'https://lab.example.com/coa/GEN-987?brand=Hudson%20Flower',
      labName: 'generic',
      batchId: 'GEN-987',
      brandName: 'Hudson Flower',
    },
  ] as const;

  for (const [index, scanCase] of cases.entries()) {
    const result = await ingestScan({
      rawCode: scanCase.rawCode,
      installId: `install-lab-${index}`,
    });

    assert.equal(result.persisted, true);
    assert.equal(result.resolution.kind, 'product');
    assert.equal(result.resolution.catalogState, 'verified');
    assert.equal(result.resolution.coa.labName, scanCase.labName);
    assert.equal(result.resolution.coa.batchId, scanCase.batchId);
    if ('brandName' in scanCase) {
      assert.equal(result.resolution.coa.brandName, scanCase.brandName);
    }
  }

  assert.equal(listCollectionDocuments(fakeDb, 'productScans').length, cases.length);
});

test('ingestScan dedupes repeated product scans and increments brand counters once', async () => {
  const fakeDb = createFakeDb();
  const { ingestScan } = loadScanService({ db: fakeDb.db });
  const input = {
    rawCode: 'https://coa.kaychalabs.com/reports/DEDUP-123',
    installId: 'install-dedup',
    nearStorefrontId: 'storefront-1',
  };

  const first = await ingestScan(input);
  const second = await ingestScan(input);

  assert.equal(first.persisted, true);
  assert.equal(second.persisted, false);
  assert.equal(listCollectionDocuments(fakeDb, 'productScans').length, 1);
  assert.equal(
    (fakeDb.documents.get('brandCounters/kaycha_labs:DEDUP-123') as { totalScans?: number })
      ?.totalScans,
    1,
  );
});

test('ingestScan classifies UPCs as uncatalogued products without OCM lookup', async () => {
  let lookupCount = 0;
  const { ingestScan } = loadScanService({
    lookupOcmLicense: async () => {
      lookupCount += 1;
      return createMissingLicenseResult();
    },
  });

  const result = await ingestScan({
    rawCode: '012345678905',
    installId: 'install-upc',
  });

  assert.equal(result.persisted, false);
  assert.equal(result.resolution.kind, 'product');
  assert.equal(result.resolution.catalogState, 'uncatalogued');
  assert.equal(result.resolution.coa.labName, 'unknown_lab');
  assert.equal(result.resolution.coa.upc, '012345678905');
  assert.equal(lookupCount, 0);
});

test('ingestScan resolves OCM license-pattern scans as verified or unverified licenses', async () => {
  const { ingestScan } = loadScanService({
    lookupOcmLicense: async (licenseNumber) =>
      licenseNumber === 'OCM-2026-VERIFIED'
        ? {
            found: true,
            active: true,
            record: {
              license_number: 'OCM-2026-VERIFIED',
              license_type: 'Adult-Use Retail Dispensary',
              licensee_name: 'Verified Store LLC',
              license_status: 'Active',
            },
            matchScore: null,
            error: null,
          }
        : createMissingLicenseResult(),
  });

  const verified = await ingestScan({
    rawCode: ' ocm-2026-verified ',
    installId: 'install-license-verified',
  });
  const unverified = await ingestScan({
    rawCode: 'OCM-2026-MISSING',
    installId: 'install-license-missing',
  });

  assert.equal(verified.resolution.kind, 'license');
  assert.equal(verified.resolution.verificationState, 'verified');
  assert.equal(verified.resolution.license.licenseeName, 'Verified Store LLC');
  assert.equal(unverified.resolution.kind, 'license');
  assert.equal(unverified.resolution.verificationState, 'unverified');
  assert.equal(unverified.resolution.license.status, 'unverified');
});

test('ingestScan preserves brand-site URL when a brand page chains through to a known lab', async () => {
  const brandUrl = 'https://brand.example/products/blue-dream';
  const { ingestScan } = loadScanService({
    resolveBrandPage: async (rawUrl) => {
      assert.equal(rawUrl, brandUrl);
      return {
        outcome: 'chained_to_known_lab',
        sourceLabUrl: 'https://coa.kaychalabs.com/reports/CHAIN-123',
        coa: {
          labName: 'kaycha_labs',
          batchId: 'CHAIN-123',
          coaUrl: 'https://coa.kaychalabs.com/reports/CHAIN-123',
          retrievedAt: new Date().toISOString(),
        },
      };
    },
  });

  const result = await ingestScan({
    rawCode: brandUrl,
    installId: 'install-brand-page',
  });

  assert.equal(result.resolution.kind, 'product');
  assert.equal(result.resolution.catalogState, 'verified');
  assert.equal(result.resolution.coa.labName, 'kaycha_labs');
  assert.equal(result.resolution.coa.batchId, 'CHAIN-123');
  assert.equal(result.resolution.coa.brandWebsiteUrl, brandUrl);
});
