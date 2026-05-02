import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';
import {
  clearOcmLicenseCacheForTests,
  findOcmRecordsByLicenseeName,
  normalizeLicenseeNameKey,
  verifyAgainstCache,
} from './ocmLicenseCacheService';

const originalFetch = global.fetch;
const BASE_TIME_MS = Date.UTC(2026, 3, 20, 12, 0, 0);

function createRetailRecord(overrides: Partial<OcmLicenseRecord> = {}): OcmLicenseRecord {
  return {
    license_number: 'RDIS-123456',
    license_type: 'Adult-Use Retail Dispensary',
    licensee_name: 'Hudson Cannabis LLC',
    dba_name: 'Hudson House',
    license_status: 'Active',
    address: '123 Main Street',
    city: 'New York',
    state: 'NY',
    zip_code: '10001',
    ...overrides,
  };
}

function mockOcmFetch(records: OcmLicenseRecord[], calls: string[]) {
  global.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => records,
    } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  clearOcmLicenseCacheForTests();
});

afterEach(() => {
  global.fetch = originalFetch;
  clearOcmLicenseCacheForTests();
  mock.reset();
});

test('verifyAgainstCache indexes active retail licenses by license, address, and name', async () => {
  const calls: string[] = [];
  mock.method(Date, 'now', () => BASE_TIME_MS);
  mockOcmFetch(
    [
      createRetailRecord(),
      createRetailRecord({
        license_number: 'CULT-999',
        license_type: 'Adult-Use Cultivator',
        licensee_name: 'Not A Storefront LLC',
      }),
    ],
    calls,
  );

  const licenseMatch = await verifyAgainstCache({ licenseNumber: ' rdis-123456 ' });
  const addressMatch = await verifyAgainstCache({
    address: '123 Main St.',
    zip: '10001-0001',
  });
  const nameMatch = await verifyAgainstCache({
    name: 'Hudson Cannabis',
    zip: '10001',
  });

  assert.equal(licenseMatch.licensed, true);
  assert.equal(licenseMatch.confidence, 'exact');
  assert.equal(licenseMatch.record?.license_number, 'RDIS-123456');
  assert.equal(addressMatch.licensed, true);
  assert.equal(addressMatch.confidence, 'address');
  assert.equal(nameMatch.licensed, true);
  assert.equal(nameMatch.confidence, 'name');
  assert.equal(calls.length, 1);
});

test('verifyAgainstCache reuses a fresh cache entry inside the one-hour TTL', async () => {
  const calls: string[] = [];
  let now = BASE_TIME_MS;
  mock.method(Date, 'now', () => now);
  mockOcmFetch([createRetailRecord()], calls);

  await verifyAgainstCache({ licenseNumber: 'RDIS-123456' });
  now = BASE_TIME_MS + 30 * 60 * 1000;
  const secondMatch = await verifyAgainstCache({ licenseNumber: 'RDIS-123456' });

  assert.equal(secondMatch.licensed, true);
  assert.equal(secondMatch.confidence, 'exact');
  assert.equal(calls.length, 1);
});

test('normalizeLicenseeNameKey uppercases and trims for cluster lookup', () => {
  assert.equal(normalizeLicenseeNameKey('Twisted Cannabis FLX LLC'), 'TWISTED CANNABIS FLX LLC');
  assert.equal(normalizeLicenseeNameKey('  flynnstoned corporation  '), 'FLYNNSTONED CORPORATION');
  assert.equal(normalizeLicenseeNameKey(''), null);
  assert.equal(normalizeLicenseeNameKey(null), null);
  assert.equal(normalizeLicenseeNameKey(undefined), null);
});

test('findOcmRecordsByLicenseeName returns every retail record under the same legal entity', async () => {
  const calls: string[] = [];
  mock.method(Date, 'now', () => BASE_TIME_MS);
  mockOcmFetch(
    [
      // Twisted Cannabis FLX LLC — 3 retail siblings
      createRetailRecord({
        license_number: 'OCM-RETL-24-000053',
        licensee_name: 'Twisted Cannabis FLX LLC',
        address: '501 Exchange St',
        city: 'Geneva',
        zip_code: '14456',
      }),
      createRetailRecord({
        license_number: 'OCM-RETL-26-000485',
        licensee_name: 'Twisted Cannabis FLX LLC',
        address: '4123 State Route 96',
        city: 'Manchester',
        zip_code: '14504',
      }),
      createRetailRecord({
        license_number: 'OCM-RETL-26-000495',
        licensee_name: 'Twisted Cannabis FLX LLC',
        address: '2 E Main St',
        city: 'Bloomfield',
        zip_code: '14469',
      }),
      // Different entity — should NOT show up in the cluster
      createRetailRecord({
        license_number: 'OCM-RETL-24-OTHER',
        licensee_name: 'Some Other LLC',
        address: '1 Other St',
        city: 'Albany',
        zip_code: '12207',
      }),
      // Cultivator with same licensee_name — should NOT show up
      // (filtered out by isConsumerFacingRetailType in the cache build)
      createRetailRecord({
        license_number: 'OCM-CULT-24-FAKE',
        license_type: 'Adult-Use Cultivator',
        licensee_name: 'Twisted Cannabis FLX LLC',
        address: '999 Farm Rd',
      }),
    ],
    calls,
  );

  // Trigger a cache fill
  await verifyAgainstCache({ licenseNumber: 'OCM-RETL-24-000053' });

  const cluster = await findOcmRecordsByLicenseeName('Twisted Cannabis FLX LLC');
  assert.equal(cluster.length, 3, 'should return 3 retail siblings, not the cultivator');
  const numbers = cluster.map((r) => r.license_number).sort();
  assert.deepEqual(numbers, ['OCM-RETL-24-000053', 'OCM-RETL-26-000485', 'OCM-RETL-26-000495']);
});

test('findOcmRecordsByLicenseeName treats casing differences as the same cluster', async () => {
  const calls: string[] = [];
  mock.method(Date, 'now', () => BASE_TIME_MS);
  mockOcmFetch(
    [
      createRetailRecord({
        license_number: 'A',
        licensee_name: 'FLYNNSTONED CORPORATION',
      }),
      createRetailRecord({
        license_number: 'B',
        licensee_name: 'FLYNNSTONED CORPORATION',
        address: '999 Other St',
      }),
    ],
    calls,
  );
  await verifyAgainstCache({ licenseNumber: 'A' });

  // Caller passes a mixed-case input — the cache normalizes both sides.
  const cluster = await findOcmRecordsByLicenseeName('FlynnStoned Corporation');
  assert.equal(cluster.length, 2);
});

test('findOcmRecordsByLicenseeName returns [] for unknown entities and empty inputs', async () => {
  const calls: string[] = [];
  mock.method(Date, 'now', () => BASE_TIME_MS);
  mockOcmFetch([createRetailRecord()], calls);
  await verifyAgainstCache({ licenseNumber: 'RDIS-123456' });

  assert.deepEqual(await findOcmRecordsByLicenseeName('Nobody LLC'), []);
  assert.deepEqual(await findOcmRecordsByLicenseeName(''), []);
});

test('verifyAgainstCache serves stale data while a refresh fails inside the stale window', async () => {
  const calls: string[] = [];
  let now = BASE_TIME_MS;
  mock.method(Date, 'now', () => now);
  mockOcmFetch([createRetailRecord()], calls);

  await verifyAgainstCache({ licenseNumber: 'RDIS-123456' });
  global.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    throw new Error('OCM temporarily unavailable');
  }) as typeof fetch;
  now = BASE_TIME_MS + 61 * 60 * 1000;

  const staleMatch = await verifyAgainstCache({ licenseNumber: 'RDIS-123456' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(staleMatch.licensed, true);
  assert.equal(staleMatch.confidence, 'exact');
  assert.equal(staleMatch.asOf, new Date(BASE_TIME_MS).toISOString());
  assert.equal(calls.length, 2);
});
