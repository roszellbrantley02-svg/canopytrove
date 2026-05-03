import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const firebaseModulePath = require.resolve('../firebase');
const configModulePath = require.resolve('../config');
const ownerPortalAuthorizationServicePath = require.resolve('./ownerPortalAuthorizationService');
const launchProgramServicePath = require.resolve('./launchProgramService');
const ownerBillingServicePath = require.resolve('./ownerBillingService');

const originalFetch = global.fetch;
const originalModuleEntries = new Map(
  [
    firebaseModulePath,
    configModulePath,
    ownerPortalAuthorizationServicePath,
    launchProgramServicePath,
  ].map((modulePath) => [modulePath, require.cache[modulePath]]),
);

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

function buildSubscription(
  overrides: Partial<{
    provider: string;
    externalSubscriptionId: string | null;
    status: string;
  }> = {},
) {
  return {
    ownerUid: 'owner-1',
    dispensaryId: 'shop-primary',
    provider: 'stripe',
    externalCustomerId: 'cus_X',
    externalSubscriptionId: 'sub_X',
    planId: 'pro_monthly',
    tier: 'pro',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function setupFirebaseStub(subscriptionData: ReturnType<typeof buildSubscription> | null) {
  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: subscriptionData !== null,
            data: () => subscriptionData,
          }),
        }),
      }),
    }),
    hasBackendFirebaseConfig: true,
    getBackendFirebaseAuth: () => null,
    getBackendFirebaseAppCheck: () => null,
  });
}

function setupConfigStub(
  overrides: Partial<{
    stripeSecretKey: string | null;
    stripeAdditionalLocationPriceId: string | null;
  }> = {},
) {
  setCachedModule(configModulePath, {
    serverConfig: {
      stripeSecretKey: 'sk_test_FAKE',
      stripeAdditionalLocationPriceId: 'price_FAKE',
      ...overrides,
    },
    isProductionLikeBackendRuntime: () => false,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  delete require.cache[ownerBillingServicePath];

  for (const [modulePath, cachedModule] of originalModuleEntries.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
      continue;
    }
    delete require.cache[modulePath];
  }
});

test('returns not_configured when stripeSecretKey is missing', async () => {
  setupConfigStub({ stripeSecretKey: null });
  setupFirebaseStub(buildSubscription());

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_configured');
});

test('returns not_configured when stripeAdditionalLocationPriceId is missing', async () => {
  setupConfigStub({ stripeAdditionalLocationPriceId: null });
  setupFirebaseStub(buildSubscription());

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_configured');
});

test('returns no_subscription when owner has no subscription doc', async () => {
  setupConfigStub();
  setupFirebaseStub(null);

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'no_subscription');
});

test('returns not_stripe when subscription provider is apple_iap', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription({ provider: 'apple_iap', externalSubscriptionId: null }));

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_stripe');
});

test('returns not_stripe when subscription provider is stripe but externalSubscriptionId is null', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription({ externalSubscriptionId: null }));

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_stripe');
});

test('returns not_active when subscription status is canceled', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription({ status: 'canceled' }));

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_active');
});

test('returns not_active when subscription status is inactive', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription({ status: 'inactive' }));

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'not_active');
});

test('returns stripe_error when GET subscription fails (non-OK response)', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription());

  // Mock fetch to return a 500 from Stripe
  global.fetch = (async () =>
    ({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Stripe is having a bad day' } }),
    }) as Response) as typeof fetch;

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok && result.reason === 'stripe_error') {
    assert.match(result.message, /Stripe is having a bad day/);
  } else {
    assert.fail(`Expected stripe_error reason, got: ${JSON.stringify(result)}`);
  }
});

test('noop when target count matches existing item quantity', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription());

  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'sub_X',
        status: 'active',
        items: {
          data: [
            { id: 'si_pro', price: { id: 'price_pro', recurring: { interval: 'month' } } },
            {
              id: 'si_addl',
              quantity: 2,
              price: { id: 'price_FAKE', recurring: { interval: 'month' } },
            },
          ],
        },
      }),
    }) as Response) as typeof fetch;

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 2 });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.action, 'noop');
    assert.equal(result.quantity, 2);
  }
});

test('noop when target is 0 and no existing item', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription());

  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'sub_X',
        status: 'active',
        items: {
          data: [{ id: 'si_pro', price: { id: 'price_pro', recurring: { interval: 'month' } } }],
        },
      }),
    }) as Response) as typeof fetch;

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: 0 });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.action, 'noop');
    assert.equal(result.quantity, 0);
  }
});

test('clamps negative target counts to 0 (defensive)', async () => {
  setupConfigStub();
  setupFirebaseStub(buildSubscription());

  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'sub_X',
        status: 'active',
        items: {
          data: [{ id: 'si_pro', price: { id: 'price_pro', recurring: { interval: 'month' } } }],
        },
      }),
    }) as Response) as typeof fetch;

  delete require.cache[ownerBillingServicePath];
  const { syncAdditionalLocationBilling } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');
  const result = await syncAdditionalLocationBilling({ ownerUid: 'owner-1', targetCount: -5 });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.quantity, 0); // clamped from -5
  }
});
