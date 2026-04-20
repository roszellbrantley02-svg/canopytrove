import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import type { OcmLicenseRecord } from './ocmLicenseLookupService';
import { clearOcmLicenseCacheForTests, verifyAgainstCache } from './ocmLicenseCacheService';

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
