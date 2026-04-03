import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

function loadConfigModule() {
  const modulePath = require.resolve('./config');
  delete require.cache[modulePath];
  return require('./config') as typeof import('./config');
}

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_OWNER_MONTHLY_PRICE_ID;
  delete process.env.STRIPE_OWNER_ANNUAL_PRICE_ID;
  delete process.env.OWNER_BILLING_SUCCESS_URL;
  delete process.env.OWNER_BILLING_CANCEL_URL;
  delete process.env.OWNER_BILLING_PORTAL_RETURN_URL;
  delete process.env.LAUNCH_PROGRAM_START_AT;
  delete process.env.LAUNCH_PROGRAM_DURATION_DAYS;
  delete process.env.LAUNCH_EARLY_ADOPTER_LIMIT;
  delete process.env.OWNER_LAUNCH_TRIAL_DAYS;
});

test('reports missing owner billing env vars without webhook by default', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_OWNER_MONTHLY_PRICE_ID = 'price_monthly';

  const config = loadConfigModule();

  assert.deepEqual(config.getMissingOwnerBillingBackendEnvVars(), [
    'STRIPE_OWNER_ANNUAL_PRICE_ID',
    'OWNER_BILLING_SUCCESS_URL',
    'OWNER_BILLING_CANCEL_URL',
    'OWNER_BILLING_PORTAL_RETURN_URL',
  ]);
  assert.equal(config.hasConfiguredOwnerBillingBackend(), false);
});

test('includes webhook secret in readiness checks when requested', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_OWNER_MONTHLY_PRICE_ID = 'price_monthly';
  process.env.STRIPE_OWNER_ANNUAL_PRICE_ID = 'price_annual';
  process.env.OWNER_BILLING_SUCCESS_URL = 'https://canopytrove.com/success';
  process.env.OWNER_BILLING_CANCEL_URL = 'https://canopytrove.com/cancel';
  process.env.OWNER_BILLING_PORTAL_RETURN_URL = 'https://canopytrove.com/portal';

  const config = loadConfigModule();

  assert.deepEqual(config.getMissingOwnerBillingBackendEnvVars({ includeWebhook: true }), [
    'STRIPE_WEBHOOK_SECRET',
  ]);
  assert.equal(config.hasConfiguredOwnerBillingBackend(), true);
  assert.equal(config.hasConfiguredOwnerBillingBackend({ includeWebhook: true }), false);
});

test('parses launch program config with defaults', () => {
  process.env.LAUNCH_PROGRAM_START_AT = '2026-04-20T00:00:00.000Z';

  const config = loadConfigModule();

  assert.equal(config.serverConfig.launchProgramStartAt, '2026-04-20T00:00:00.000Z');
  assert.equal(config.serverConfig.launchProgramDurationDays, 183);
  assert.equal(config.serverConfig.launchEarlyAdopterLimit, 500);
  assert.equal(config.serverConfig.ownerLaunchTrialDays, 30);
});

test('allows launch program config overrides', () => {
  process.env.LAUNCH_PROGRAM_START_AT = '2026-04-20T00:00:00.000Z';
  process.env.LAUNCH_PROGRAM_DURATION_DAYS = '180';
  process.env.LAUNCH_EARLY_ADOPTER_LIMIT = '250';
  process.env.OWNER_LAUNCH_TRIAL_DAYS = '45';

  const config = loadConfigModule();

  assert.equal(config.serverConfig.launchProgramDurationDays, 180);
  assert.equal(config.serverConfig.launchEarlyAdopterLimit, 250);
  assert.equal(config.serverConfig.ownerLaunchTrialDays, 45);
});

