import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

type ComplianceServiceModule = typeof import('./ownerPortalLicenseComplianceService');
type CleanupServiceModule = typeof import('./accountCleanupService');

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

async function loadComplianceService(): Promise<ComplianceServiceModule> {
  return import(`./ownerPortalLicenseComplianceService?test=${Date.now()}-${Math.random()}`);
}

async function loadCleanupService(): Promise<CleanupServiceModule> {
  return import(`./accountCleanupService?test=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  clearFirebaseEnv();
});

afterEach(async () => {
  clearFirebaseEnv();
  const { clearOwnerLicenseComplianceMemoryStateForTests, stopOwnerLicenseComplianceScheduler } =
    await loadComplianceService();
  clearOwnerLicenseComplianceMemoryStateForTests();
  stopOwnerLicenseComplianceScheduler();
});

test('deleteProfileAccountData removes compliance records for the owner profile', async () => {
  const {
    clearOwnerLicenseComplianceMemoryStateForTests,
    saveOwnerLicenseCompliance,
    getOwnerLicenseCompliance,
  } = await loadComplianceService();
  const { deleteProfileAccountData } = await loadCleanupService();

  clearOwnerLicenseComplianceMemoryStateForTests();

  await saveOwnerLicenseCompliance({
    ownerUid: 'owner-cleanup',
    dispensaryId: 'disp-cleanup',
    input: {
      licenseNumber: 'LICENSE-42',
      licenseType: 'Retail Dispensary',
      expiresAt: '2026-04-05T00:00:00.000Z',
    },
  });

  assert.ok(await getOwnerLicenseCompliance('owner-cleanup', 'disp-cleanup'));

  const result = await deleteProfileAccountData('owner-cleanup');
  assert.equal(result.ok, true);

  assert.equal(await getOwnerLicenseCompliance('owner-cleanup', 'disp-cleanup'), null);
});

test('deleteProfileAccountData leaves the profile record intact when dependent cleanup fails', async () => {
  const { AccountCleanupError, deleteProfileAccountData } = await loadCleanupService();
  const completedSteps: string[] = [];

  await assert.rejects(
    () =>
      deleteProfileAccountData('owner-cleanup', {
        async deleteRouteState() {
          completedSteps.push('route_state');
          return true;
        },
        async deleteGamificationState() {
          completedSteps.push('gamification_state');
          return true;
        },
        async deleteFavoriteDealAlertRecord() {
          completedSteps.push('favorite_deal_alerts');
          return true;
        },
        async deleteCommunityContentForProfile() {
          throw new Error('community cleanup failed');
        },
        async deleteOwnerLicenseComplianceRecordsForOwner() {
          completedSteps.push('owner_license_compliance');
        },
        async deleteOwnerBusinessVerificationRecord() {
          completedSteps.push('owner_business_verification');
        },
        async deleteProfile() {
          completedSteps.push('profile_record');
          return true;
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof AccountCleanupError);
      assert.deepEqual(error.failures, [
        {
          step: 'community_content',
          message: 'community cleanup failed',
        },
      ]);
      return true;
    },
  );

  assert.deepEqual(completedSteps, [
    'route_state',
    'gamification_state',
    'favorite_deal_alerts',
    'owner_license_compliance',
    'owner_business_verification',
  ]);
});
