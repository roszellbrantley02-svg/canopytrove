import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { serverConfig } from '../config';
import {
  clearTaxIdCacheForTests,
  findTaxRecordsByTpid,
  normalizeLegalNameForTaxJoin,
  verifyOwnerTaxId,
  type TaxRecord,
} from './taxIdVerificationService';

const originalFetch = global.fetch;
const originalFlag = serverConfig.taxIdVerificationEnabled;
const originalSalt = serverConfig.taxIdHashSalt;
const BASE_TIME_MS = Date.UTC(2026, 4, 2, 12, 0, 0);

function setFlag(value: boolean) {
  (serverConfig as { taxIdVerificationEnabled: boolean }).taxIdVerificationEnabled = value;
}

function setSalt(value: string | null) {
  (serverConfig as { taxIdHashSalt: string | null }).taxIdHashSalt = value;
}

function mockFetch(records: Array<Partial<TaxRecord>>) {
  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () =>
        records.map((r) => ({
          external_tpid: r.externalTpid,
          legal_name: r.legalName,
          ocm_license_number: r.ocmLicenseNumber,
          physical_address: r.physicalAddress,
          physical_city: r.physicalCity,
          physical_zip: r.physicalZip,
        })),
    }) as Response) as typeof fetch;
}

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  clearTaxIdCacheForTests();
  setFlag(originalFlag);
  setSalt(originalSalt);
  mock.method(Date, 'now', () => BASE_TIME_MS);
});

afterEach(() => {
  global.fetch = originalFetch;
  clearTaxIdCacheForTests();
  setFlag(originalFlag);
  setSalt(originalSalt);
  mock.reset();
});

// ============================================================================
// Normalization helper
// ============================================================================

test('normalizeLegalNameForTaxJoin uppercases and strips punctuation for cross-dataset match', () => {
  // OCM-side: "Twisted Cannabis FLX LLC"
  // Tax-side: "TWISTED CANNABIS FLX LLC."
  // Both must produce the same key.
  assert.equal(
    normalizeLegalNameForTaxJoin('Twisted Cannabis FLX LLC'),
    'TWISTED CANNABIS FLX LLC',
  );
  assert.equal(
    normalizeLegalNameForTaxJoin('TWISTED CANNABIS FLX LLC.'),
    'TWISTED CANNABIS FLX LLC',
  );
  assert.equal(normalizeLegalNameForTaxJoin('100 North 3rd Ltd'), '100 NORTH 3RD LTD');
  assert.equal(normalizeLegalNameForTaxJoin('100 NORTH 3RD LTD.'), '100 NORTH 3RD LTD');
  assert.equal(normalizeLegalNameForTaxJoin(''), null);
  assert.equal(normalizeLegalNameForTaxJoin(null), null);
});

// ============================================================================
// Cache lookup
// ============================================================================

test('findTaxRecordsByTpid returns every record sharing the same tpid', async () => {
  mockFetch([
    {
      externalTpid: '123456789',
      legalName: 'TWISTED CANNABIS FLX LLC',
      ocmLicenseNumber: 'OCM-RETL-24-000053',
    },
    {
      externalTpid: '123456789',
      legalName: 'TWISTED CANNABIS FLX LLC',
      ocmLicenseNumber: 'OCM-RETL-26-000485',
    },
    {
      externalTpid: '999000111',
      legalName: 'OTHER SHOP LLC',
      ocmLicenseNumber: 'OCM-RETL-24-OTHER',
    },
  ]);

  const records = await findTaxRecordsByTpid('123456789');
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((r) => r.ocmLicenseNumber).sort(), [
    'OCM-RETL-24-000053',
    'OCM-RETL-26-000485',
  ]);
});

test('findTaxRecordsByTpid normalizes input (strips non-digits)', async () => {
  mockFetch([
    {
      externalTpid: '123456789',
      legalName: 'TEST LLC',
      ocmLicenseNumber: 'OCM-RETL-24-TEST',
    },
  ]);

  const records = await findTaxRecordsByTpid('123-45-6789');
  assert.equal(records.length, 1);
});

test('findTaxRecordsByTpid returns [] for unknown TPID', async () => {
  mockFetch([{ externalTpid: '111', legalName: 'X', ocmLicenseNumber: 'L' }]);
  assert.deepEqual(await findTaxRecordsByTpid('999'), []);
  assert.deepEqual(await findTaxRecordsByTpid(''), []);
});

// ============================================================================
// verifyOwnerTaxId — flag and validation
// ============================================================================

test('verifyOwnerTaxId returns feature_disabled when flag is off', async () => {
  setFlag(false);
  const result = await verifyOwnerTaxId({
    ownerUid: 'owner-1',
    tpid: '123456789',
    primaryDispensaryId: 'shop-1',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'feature_disabled');
});

test('verifyOwnerTaxId returns salt_missing when TAX_ID_HASH_SALT is unset', async () => {
  setFlag(true);
  setSalt(null);
  const result = await verifyOwnerTaxId({
    ownerUid: 'owner-1',
    tpid: '123456789',
    primaryDispensaryId: 'shop-1',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'salt_missing');
});

test('verifyOwnerTaxId rejects empty tpid', async () => {
  setFlag(true);
  setSalt('test-salt');
  const result = await verifyOwnerTaxId({
    ownerUid: 'owner-1',
    tpid: '',
    primaryDispensaryId: 'shop-1',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'invalid_input');
});

test('verifyOwnerTaxId rejects tpid with no digits', async () => {
  setFlag(true);
  setSalt('test-salt');
  const result = await verifyOwnerTaxId({
    ownerUid: 'owner-1',
    tpid: 'abc-def',
    primaryDispensaryId: 'shop-1',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'invalid_input');
});

test('verifyOwnerTaxId rejects empty ownerUid or primaryDispensaryId', async () => {
  setFlag(true);
  setSalt('test-salt');
  const result = await verifyOwnerTaxId({
    ownerUid: '',
    tpid: '123456789',
    primaryDispensaryId: 'shop-1',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'invalid_input');
});

test('verifyOwnerTaxId returns db_unavailable when Firebase is not configured', async () => {
  setFlag(true);
  setSalt('test-salt');
  // No global.fetch mock and no Firebase config in the test env.
  const result = await verifyOwnerTaxId({
    ownerUid: 'owner-1',
    tpid: '123456789',
    primaryDispensaryId: 'shop-1',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'db_unavailable');
});
