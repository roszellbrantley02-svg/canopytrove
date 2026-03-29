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

