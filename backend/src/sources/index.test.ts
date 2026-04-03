import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import path from 'node:path';

const ORIGINAL_ENV = {
  STOREFRONT_BACKEND_SOURCE: process.env.STOREFRONT_BACKEND_SOURCE,
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
  K_SERVICE: process.env.K_SERVICE,
  K_REVISION: process.env.K_REVISION,
  K_CONFIGURATION: process.env.K_CONFIGURATION,
};

function restoreEnvValue(name: keyof typeof ORIGINAL_ENV, value: string | undefined) {
  if (typeof value === 'string') {
    process.env[name] = value;
    return;
  }

  delete process.env[name];
}

async function loadSourcesModule() {
  const backendSourceRoot = `${path.resolve(__dirname, '..')}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }

  return import(`./index?test=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.K_SERVICE;
  delete process.env.K_REVISION;
  delete process.env.K_CONFIGURATION;
});

afterEach(() => {
  restoreEnvValue('STOREFRONT_BACKEND_SOURCE', ORIGINAL_ENV.STOREFRONT_BACKEND_SOURCE);
  restoreEnvValue('FIREBASE_SERVICE_ACCOUNT_JSON', ORIGINAL_ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
  restoreEnvValue('GOOGLE_APPLICATION_CREDENTIALS', ORIGINAL_ENV.GOOGLE_APPLICATION_CREDENTIALS);
  restoreEnvValue('FIREBASE_PROJECT_ID', ORIGINAL_ENV.FIREBASE_PROJECT_ID);
  restoreEnvValue('GOOGLE_CLOUD_PROJECT', ORIGINAL_ENV.GOOGLE_CLOUD_PROJECT);
  restoreEnvValue('GCLOUD_PROJECT', ORIGINAL_ENV.GCLOUD_PROJECT);
  restoreEnvValue('K_SERVICE', ORIGINAL_ENV.K_SERVICE);
  restoreEnvValue('K_REVISION', ORIGINAL_ENV.K_REVISION);
  restoreEnvValue('K_CONFIGURATION', ORIGINAL_ENV.K_CONFIGURATION);
});

test('keeps explicit mock mode available for storefront reads', async () => {
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';

  const { backendStorefrontSource, backendStorefrontSourceStatus } = await loadSourcesModule();
  const summaries = await backendStorefrontSource.getAllSummaries();

  assert.equal(backendStorefrontSourceStatus.requestedMode, 'mock');
  assert.equal(backendStorefrontSourceStatus.activeMode, 'mock');
  assert.equal(backendStorefrontSourceStatus.available, true);
  assert.ok(summaries.length > 0);
});

test('fails loudly when firestore mode is requested without backend Firebase config', async () => {
  process.env.STOREFRONT_BACKEND_SOURCE = 'firestore';

  const {
    backendStorefrontSource,
    backendStorefrontSourceStatus,
    warmBackendStorefrontSource,
  } = await loadSourcesModule();

  assert.equal(backendStorefrontSourceStatus.requestedMode, 'firestore');
  assert.equal(backendStorefrontSourceStatus.activeMode, 'firestore');
  assert.equal(backendStorefrontSourceStatus.available, false);
  assert.match(String(backendStorefrontSourceStatus.fallbackReason), /Missing backend Firebase/i);
  await assert.rejects(
    () => backendStorefrontSource.getAllSummaries(),
    /backend Firebase environment config is missing/i
  );
  await assert.rejects(
    () => warmBackendStorefrontSource(),
    /backend Firebase environment config is missing/i
  );
});
