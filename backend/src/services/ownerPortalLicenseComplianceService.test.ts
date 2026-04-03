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

async function loadService() {
  return import(`./ownerPortalLicenseComplianceService?test=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  clearFirebaseEnv();
});

afterEach(async () => {
  clearFirebaseEnv();
  const { clearOwnerLicenseComplianceMemoryStateForTests, stopOwnerLicenseComplianceScheduler } =
    await loadService();
  clearOwnerLicenseComplianceMemoryStateForTests();
  stopOwnerLicenseComplianceScheduler();
});

test('derives renewal and reminder stages from the NY renewal window', async () => {
  const service = await loadService();

  const expiresAt = '2027-12-31T00:00:00.000Z';
  assert.equal(
    service.deriveOwnerLicenseRenewalStatus({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2026-07-01T00:00:00.000Z',
    }),
    'active'
  );
  assert.equal(
    service.deriveOwnerLicenseRenewalStatus({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-10-01T00:00:00.000Z',
    }),
    'window_open'
  );
  assert.equal(
    service.deriveOwnerLicenseRenewalStatus({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-11-15T00:00:00.000Z',
    }),
    'urgent'
  );
  assert.equal(
    service.deriveOwnerLicenseRenewalStatus({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2028-01-01T00:00:00.000Z',
    }),
    'expired'
  );
  assert.equal(
    service.deriveOwnerLicenseRenewalStatus({
      expiresAt,
      renewalSubmittedAt: '2027-10-01T00:00:00.000Z',
      nowIso: '2027-11-15T00:00:00.000Z',
    }),
    'submitted'
  );

  assert.equal(
    service.deriveOwnerLicenseReminderStage({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-09-02T00:00:00.000Z',
    }),
    '120_day'
  );
  assert.equal(
    service.deriveOwnerLicenseReminderStage({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-10-02T00:00:00.000Z',
    }),
    '90_day'
  );
  assert.equal(
    service.deriveOwnerLicenseReminderStage({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-11-02T00:00:00.000Z',
    }),
    '60_day'
  );
  assert.equal(
    service.deriveOwnerLicenseReminderStage({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-12-01T00:00:00.000Z',
    }),
    '30_day'
  );
  assert.equal(
    service.deriveOwnerLicenseReminderStage({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-12-18T00:00:00.000Z',
    }),
    '14_day'
  );
  assert.equal(
    service.deriveOwnerLicenseReminderStage({
      expiresAt,
      renewalSubmittedAt: null,
      nowIso: '2027-12-26T00:00:00.000Z',
    }),
    '7_day'
  );
});

test('normalizes and persists license compliance records in the in-memory fallback', async () => {
  const service = await loadService();

  service.clearOwnerLicenseComplianceMemoryStateForTests();

  const saved = await service.saveOwnerLicenseCompliance({
    ownerUid: 'owner-1',
    dispensaryId: 'disp-1',
    input: {
      licenseNumber: ' NY-12345 ',
      licenseType: ' Retail Dispensary ',
      issuedAt: '2025-02-01T00:00:00.000Z',
      expiresAt: '2026-07-28T00:00:00.000Z',
      renewalSubmittedAt: '2026-03-16T00:00:00.000Z',
      notes: '  submit renewal packet  ',
    },
  });

  assert.equal(saved.ownerUid, 'owner-1');
  assert.equal(saved.dispensaryId, 'disp-1');
  assert.equal(saved.licenseNumber, 'NY-12345');
  assert.equal(saved.licenseType, 'Retail Dispensary');
  assert.equal(saved.jurisdiction, 'NY');
  assert.equal(saved.issuedAt, '2025-02-01T00:00:00.000Z');
  assert.equal(saved.expiresAt, '2026-07-28T00:00:00.000Z');
  assert.equal(saved.renewalSubmittedAt, '2026-03-16T00:00:00.000Z');
  assert.equal(saved.renewalWindowStartsAt, '2026-03-30T00:00:00.000Z');
  assert.equal(saved.renewalUrgentAt, '2026-05-29T00:00:00.000Z');
  assert.equal(saved.renewalStatus, 'submitted');
  assert.equal(saved.notes, 'submit renewal packet');

  const loaded = await service.getOwnerLicenseCompliance('owner-1', 'disp-1');
  assert.deepEqual(loaded, saved);
});

test('seeds compliance from a verification record when no explicit owner record exists', async () => {
  const service = await loadService();

  service.clearOwnerLicenseComplianceMemoryStateForTests();
  service.seedOwnerBusinessVerificationForTests({
    ownerUid: 'owner-seeded',
    dispensaryId: 'disp-seeded',
    licenseNumber: 'SEED-99',
    licenseType: 'Retail Dispensary',
    state: 'NY',
  });

  const record = await service.getOwnerLicenseCompliance('owner-seeded', 'disp-seeded');
  assert.ok(record);
  assert.equal(record?.source, 'verification_seed');
  assert.equal(record?.licenseNumber, 'SEED-99');
  assert.equal(record?.licenseType, 'Retail Dispensary');
  assert.equal(record?.jurisdiction, 'NY');
});

test('deletes compliance and business verification data for the owner cleanly', async () => {
  const service = await loadService();

  service.clearOwnerLicenseComplianceMemoryStateForTests();
  service.seedOwnerBusinessVerificationForTests({
    ownerUid: 'owner-cleanup',
    dispensaryId: 'disp-cleanup',
    licenseNumber: 'CLEAN-1',
    licenseType: 'Retail Dispensary',
    state: 'NY',
  });

  await service.getOwnerLicenseCompliance('owner-cleanup', 'disp-cleanup');
  await service.deleteOwnerLicenseComplianceRecordsForOwner('owner-cleanup');
  await service.deleteOwnerBusinessVerificationRecord('owner-cleanup');

  assert.equal(await service.getOwnerLicenseCompliance('owner-cleanup', 'disp-cleanup'), null);
});
