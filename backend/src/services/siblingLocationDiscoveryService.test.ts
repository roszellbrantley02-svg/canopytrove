import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { StorefrontSummaryApiDocument } from '../types';
import { backendStorefrontSource } from '../sources';
import { clearOcmLicenseCacheForTests, verifyAgainstCache } from './ocmLicenseCacheService';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';
import {
  clearSiblingResolverIndexForTests,
  discoverSiblingLocations,
} from './siblingLocationDiscoveryService';

const originalFetch = global.fetch;
const originalGetSummariesByIds = backendStorefrontSource.getSummariesByIds;
const originalGetAllSummaries = backendStorefrontSource.getAllSummaries;
const BASE_TIME_MS = Date.UTC(2026, 4, 2, 12, 0, 0);

function createRetailRecord(overrides: Partial<OcmLicenseRecord> = {}): OcmLicenseRecord {
  return {
    license_number: 'OCM-RETL-24-000053',
    license_type: 'Adult-Use Retail Dispensary',
    licensee_name: 'Twisted Cannabis FLX LLC',
    dba_name: 'Twisted Cannabis FLX',
    license_status: 'Active',
    address: '501 Exchange St',
    city: 'Geneva',
    state: 'NY',
    zip_code: '14456',
    ...overrides,
  };
}

function createSummary(
  overrides: Partial<StorefrontSummaryApiDocument> = {},
): StorefrontSummaryApiDocument {
  return {
    id: 'shop-primary',
    licenseId: 'license-1',
    marketId: 'market-1',
    displayName: 'Twisted Cannabis FLX',
    legalName: 'Twisted Cannabis FLX LLC',
    addressLine1: '501 Exchange St',
    city: 'Geneva',
    state: 'NY',
    zip: '14456',
    latitude: 42.87,
    longitude: -76.99,
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 0,
    reviewCount: 0,
    openNow: true,
    hours: [],
    isVerified: false,
    mapPreviewLabel: 'Geneva dispensary',
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    activePromotionCount: 0,
    favoriteFollowerCount: 0,
    menuUrl: null,
    verifiedOwnerBadgeLabel: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    premiumCardVariant: 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: 'storefront_area',
    placeId: undefined,
    thumbnailUrl: null,
    promotionAndroidEligible: false,
    isVisible: true,
    ...overrides,
  };
}

function mockOcmFetch(records: OcmLicenseRecord[]) {
  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => records,
    }) as Response) as typeof fetch;
}

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  clearOcmLicenseCacheForTests();
  clearSiblingResolverIndexForTests();
  mock.method(Date, 'now', () => BASE_TIME_MS);
  // Default getAllSummaries to empty so legacy tests that don't care about
  // dispensaryId resolution still see all-null results. Tests that care
  // about resolution override per-test.
  backendStorefrontSource.getAllSummaries = async () => [];
});

afterEach(() => {
  global.fetch = originalFetch;
  backendStorefrontSource.getSummariesByIds = originalGetSummariesByIds;
  backendStorefrontSource.getAllSummaries = originalGetAllSummaries;
  clearOcmLicenseCacheForTests();
  clearSiblingResolverIndexForTests();
  mock.reset();
});

test('discoverSiblingLocations returns the cluster minus the primary', async () => {
  mockOcmFetch([
    createRetailRecord({
      license_number: 'OCM-RETL-24-000053',
      address: '501 Exchange St',
      zip_code: '14456',
    }),
    createRetailRecord({
      license_number: 'OCM-RETL-26-000485',
      address: '4123 State Route 96',
      city: 'Manchester',
      zip_code: '14504',
    }),
    createRetailRecord({
      license_number: 'OCM-RETL-26-000495',
      address: '2 E Main St',
      city: 'Bloomfield',
      zip_code: '14469',
    }),
  ]);
  // Trigger the cache fill so the OCM data is available.
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });

  backendStorefrontSource.getSummariesByIds = async () => [createSummary()];

  const result = await discoverSiblingLocations('shop-primary');

  assert.equal(result.reason, null);
  assert.equal(result.primaryLicenseeName, 'Twisted Cannabis FLX LLC');
  assert.equal(result.primaryOcmRecord?.license_number, 'OCM-RETL-24-000053');
  assert.equal(result.siblings.length, 2);
  const siblingNumbers = result.siblings.map((s) => s.ocmRecord.license_number).sort();
  assert.deepEqual(siblingNumbers, ['OCM-RETL-26-000485', 'OCM-RETL-26-000495']);
  // dispensaryId resolution is deferred to PR-D — siblings should be null.
  assert.equal(
    result.siblings.every((s) => s.dispensaryId === null),
    true,
  );
});

test('discoverSiblingLocations marks active vs inactive siblings correctly', async () => {
  mockOcmFetch([
    createRetailRecord({
      license_number: 'OCM-RETL-24-000053',
      address: '501 Exchange St',
      zip_code: '14456',
    }),
    createRetailRecord({
      license_number: 'OCM-RETL-26-EXPIRED',
      license_status: 'Expired',
      address: '4123 State Route 96',
      city: 'Manchester',
      zip_code: '14504',
    }),
  ]);
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });
  backendStorefrontSource.getSummariesByIds = async () => [createSummary()];

  const result = await discoverSiblingLocations('shop-primary');
  assert.equal(result.siblings.length, 1);
  assert.equal(result.siblings[0].active, false);
});

test('discoverSiblingLocations returns ocm_match_not_found when storefront does not match OCM', async () => {
  mockOcmFetch([
    createRetailRecord({
      license_number: 'OCM-RETL-24-000053',
      address: 'Different Address',
      zip_code: '99999',
    }),
  ]);
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });

  // Storefront has a totally different address from anything in OCM cache.
  backendStorefrontSource.getSummariesByIds = async () => [
    createSummary({
      id: 'unknown-shop',
      addressLine1: 'Nowhere St',
      zip: '00000',
      displayName: 'Mystery Shop',
      legalName: 'Mystery Shop LLC',
    }),
  ];

  const result = await discoverSiblingLocations('unknown-shop');
  assert.equal(result.reason, 'ocm_match_not_found');
  assert.equal(result.primaryOcmRecord, null);
  assert.deepEqual(result.siblings, []);
});

test('discoverSiblingLocations returns storefront_not_found when directory has no match', async () => {
  mockOcmFetch([createRetailRecord()]);
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });
  backendStorefrontSource.getSummariesByIds = async () => [];

  const result = await discoverSiblingLocations('missing-shop');
  assert.equal(result.reason, 'storefront_not_found');
  assert.equal(result.primaryOcmRecord, null);
});

test('discoverSiblingLocations returns empty result for blank id', async () => {
  const result = await discoverSiblingLocations('');
  assert.equal(result.reason, 'storefront_not_found');
});

test('discoverSiblingLocations resolves sibling dispensaryId when storefront exists in directory', async () => {
  mockOcmFetch([
    createRetailRecord({
      license_number: 'OCM-RETL-24-000053',
      address: '501 Exchange St',
      zip_code: '14456',
    }),
    createRetailRecord({
      license_number: 'OCM-RETL-26-000485',
      address: '4123 State Route 96',
      city: 'Manchester',
      zip_code: '14504',
    }),
    createRetailRecord({
      license_number: 'OCM-RETL-26-000495',
      address: '2 E Main St',
      city: 'Bloomfield',
      zip_code: '14469',
    }),
  ]);
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });
  backendStorefrontSource.getSummariesByIds = async () => [createSummary()];
  // Two of three siblings exist in our directory; the third (Bloomfield)
  // doesn't and should surface as dispensaryId: null.
  backendStorefrontSource.getAllSummaries = async () => [
    createSummary(),
    createSummary({
      id: 'shop-manchester',
      addressLine1: '4123 State Route 96',
      zip: '14504',
      displayName: 'Twisted Cannabis Manchester',
    }),
  ];

  const result = await discoverSiblingLocations('shop-primary');
  assert.equal(result.siblings.length, 2);
  const manchester = result.siblings.find(
    (s) => s.ocmRecord.license_number === 'OCM-RETL-26-000485',
  );
  const bloomfield = result.siblings.find(
    (s) => s.ocmRecord.license_number === 'OCM-RETL-26-000495',
  );
  assert.equal(manchester?.dispensaryId, 'shop-manchester');
  assert.equal(bloomfield?.dispensaryId, null);
});

test('discoverSiblingLocations resolver matches addresses across casing/punctuation differences', async () => {
  mockOcmFetch([
    createRetailRecord({
      license_number: 'OCM-RETL-24-000053',
      address: '501 Exchange St',
      zip_code: '14456',
    }),
    createRetailRecord({
      license_number: 'OCM-RETL-26-000485',
      // OCM record uses "Street", our directory uses "St" — the resolver
      // must normalize both to the same key.
      address: '4123 State Route 96',
      city: 'Manchester',
      zip_code: '14504',
    }),
  ]);
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });
  backendStorefrontSource.getSummariesByIds = async () => [createSummary()];
  backendStorefrontSource.getAllSummaries = async () => [
    createSummary(),
    createSummary({
      id: 'shop-manchester',
      addressLine1: '4123 STATE ROUTE 96.',
      zip: '14504-1234',
      displayName: 'Twisted Cannabis Manchester',
    }),
  ];

  const result = await discoverSiblingLocations('shop-primary');
  const manchester = result.siblings.find(
    (s) => s.ocmRecord.license_number === 'OCM-RETL-26-000485',
  );
  assert.equal(manchester?.dispensaryId, 'shop-manchester');
});

test('discoverSiblingLocations returns empty siblings list for single-location entity', async () => {
  mockOcmFetch([
    createRetailRecord({
      license_number: 'OCM-RETL-24-SOLO',
      licensee_name: 'Solo Shop LLC',
      address: '1 Solo St',
      zip_code: '14456',
    }),
  ]);
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-SOLO' });
  backendStorefrontSource.getSummariesByIds = async () => [
    createSummary({
      id: 'solo-shop',
      addressLine1: '1 Solo St',
      zip: '14456',
      displayName: 'Solo Shop',
      legalName: 'Solo Shop LLC',
    }),
  ];

  const result = await discoverSiblingLocations('solo-shop');
  assert.equal(result.reason, null);
  assert.equal(result.primaryLicenseeName, 'Solo Shop LLC');
  assert.deepEqual(result.siblings, []);
});
