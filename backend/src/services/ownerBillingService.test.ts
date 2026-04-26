import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Request } from 'express';

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

test('createOwnerBillingCheckoutSession blocks duplicate trial and active subscriptions before Stripe', async () => {
  let currentSubscriptionStatus: 'trial' | 'active' = 'trial';
  let fetchCalled = false;

  setCachedModule(firebaseModulePath, {
    hasBackendFirebaseConfig: true,
    getBackendFirebaseAuth: () => ({
      verifyIdToken: async () => ({
        uid: 'owner-1',
        email: 'owner@example.com',
        auth_time: Math.floor(Date.now() / 1000),
      }),
      getUser: async () => ({
        uid: 'owner-1',
        email: 'owner@example.com',
      }),
    }),
    getBackendFirebaseDb: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              ownerUid: 'owner-1',
              dispensaryId: 'storefront-1',
              provider: 'stripe',
              externalCustomerId: 'cus_123',
              externalSubscriptionId: 'sub_123',
              planId: 'price_monthly',
              tier: 'verified',
              status: currentSubscriptionStatus,
              billingCycle: 'monthly',
              currentPeriodStart: '2026-01-01T00:00:00.000Z',
              currentPeriodEnd: '2026-02-01T00:00:00.000Z',
              cancelAtPeriodEnd: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            }),
          }),
        }),
      }),
    }),
  });

  setCachedModule(configModulePath, {
    serverConfig: {
      stripeSecretKey: 'sk_test_123',
      stripeWebhookSecret: 'whsec_test',
      stripeOwnerMonthlyPriceId: 'price_monthly',
      stripeOwnerAnnualPriceId: 'price_annual',
      stripeVerifiedMonthlyPriceId: null,
      stripeVerifiedAnnualPriceId: null,
      stripeGrowthMonthlyPriceId: null,
      stripeGrowthAnnualPriceId: null,
      stripeProMonthlyPriceId: null,
      stripeProAnnualPriceId: null,
      stripeOwnerSuccessUrl: 'https://example.com/success',
      stripeOwnerCancelUrl: 'https://example.com/cancel',
      stripeOwnerPortalReturnUrl: 'https://example.com/portal',
      launchProgramStartAt: null,
      launchProgramDurationDays: 183,
      launchEarlyAdopterLimit: 500,
      ownerLaunchTrialDays: 0,
    },
    getMissingOwnerBillingBackendEnvVars: () => [],
  });

  setCachedModule(ownerPortalAuthorizationServicePath, {
    getOwnerAuthorizationState: async () => ({
      ownerUid: 'owner-1',
      ownerProfile: {
        uid: 'owner-1',
        dispensaryId: 'storefront-1',
        subscriptionStatus: currentSubscriptionStatus,
      },
      storefrontId: 'storefront-1',
      ownerClaim: null,
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscription: {
        ownerUid: 'owner-1',
        dispensaryId: 'storefront-1',
        status: currentSubscriptionStatus,
      },
      hasVerifiedBusiness: true,
      hasVerifiedIdentity: true,
      hasActiveSubscription: true,
    }),
    isVerifiedOwnerStatus: (value: unknown) => value === 'verified' || value === 'approved',
  });

  setCachedModule(launchProgramServicePath, {
    resolveOwnerLaunchTrialOffer: async () => ({
      trialDays: 0,
      claim: null,
    }),
  });

  global.fetch = (async () => {
    fetchCalled = true;
    throw new Error('Stripe should not be called for duplicate subscriptions.');
  }) as typeof fetch;

  delete require.cache[ownerBillingServicePath];
  const { createOwnerBillingCheckoutSession, OwnerBillingError } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');

  const request = {
    header(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return 'Bearer owner-token';
      }

      return undefined;
    },
  } as Request;

  for (const status of ['trial', 'active'] as const) {
    currentSubscriptionStatus = status;
    fetchCalled = false;

    await assert.rejects(
      () => createOwnerBillingCheckoutSession(request, 'monthly', 'verified'),
      (error: unknown) => {
        assert.ok(error instanceof OwnerBillingError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /active subscription/i);
        return true;
      },
    );

    assert.equal(fetchCalled, false);
  }
});

test('createOwnerBillingCheckoutSession namespaces Stripe idempotency keys by tier', async () => {
  const observedIdempotencyKeys: string[] = [];
  const storedSubscriptions = new Map<string, Record<string, unknown>>();

  setCachedModule(firebaseModulePath, {
    hasBackendFirebaseConfig: true,
    getBackendFirebaseAuth: () => ({
      verifyIdToken: async () => ({
        uid: 'owner-1',
        email: 'owner@example.com',
        auth_time: Math.floor(Date.now() / 1000),
      }),
      getUser: async () => ({
        uid: 'owner-1',
        email: 'owner@example.com',
      }),
    }),
    getBackendFirebaseDb: () => ({
      collection: (_collectionName: string) => ({
        doc: (id: string) => ({
          get: async () => {
            const record = storedSubscriptions.get(id);
            return {
              exists: Boolean(record),
              data: () => record,
            };
          },
          set: async (value: Record<string, unknown>) => {
            storedSubscriptions.set(id, value);
          },
        }),
      }),
    }),
  });

  setCachedModule(configModulePath, {
    serverConfig: {
      stripeSecretKey: 'sk_test_123',
      stripeWebhookSecret: 'whsec_test',
      stripeOwnerMonthlyPriceId: 'price_owner_monthly',
      stripeOwnerAnnualPriceId: 'price_owner_annual',
      stripeVerifiedMonthlyPriceId: 'price_verified_monthly',
      stripeVerifiedAnnualPriceId: 'price_verified_annual',
      stripeGrowthMonthlyPriceId: 'price_growth_monthly',
      stripeGrowthAnnualPriceId: 'price_growth_annual',
      stripeProMonthlyPriceId: 'price_pro_monthly',
      stripeProAnnualPriceId: 'price_pro_annual',
      stripeOwnerSuccessUrl: 'https://example.com/success',
      stripeOwnerCancelUrl: 'https://example.com/cancel',
      stripeOwnerPortalReturnUrl: 'https://example.com/portal',
      launchProgramStartAt: null,
      launchProgramDurationDays: 183,
      launchEarlyAdopterLimit: 500,
      ownerLaunchTrialDays: 0,
    },
    getMissingOwnerBillingBackendEnvVars: () => [],
  });

  setCachedModule(ownerPortalAuthorizationServicePath, {
    getOwnerAuthorizationState: async () => ({
      ownerUid: 'owner-1',
      ownerProfile: {
        uid: 'owner-1',
        dispensaryId: 'storefront-1',
        subscriptionStatus: 'inactive',
      },
      storefrontId: 'storefront-1',
      ownerClaim: null,
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscription: null,
      hasVerifiedBusiness: true,
      hasVerifiedIdentity: true,
      hasActiveSubscription: false,
    }),
    isVerifiedOwnerStatus: (value: unknown) => value === 'verified' || value === 'approved',
  });

  setCachedModule(launchProgramServicePath, {
    resolveOwnerLaunchTrialOffer: async () => ({
      trialDays: 0,
      claim: null,
    }),
  });

  global.fetch = (async (_input, init) => {
    const headers = new Headers(init?.headers);
    const idempotencyKey = headers.get('Idempotency-Key');
    if (idempotencyKey) {
      observedIdempotencyKeys.push(idempotencyKey);
    }

    return new Response(
      JSON.stringify({
        id: `cs_test_${observedIdempotencyKeys.length}`,
        url: `https://example.com/checkout/${observedIdempotencyKeys.length}`,
        customer: 'cus_123',
        subscription: null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }) as typeof fetch;

  delete require.cache[ownerBillingServicePath];
  const { createOwnerBillingCheckoutSession } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');

  const request = {
    header(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return 'Bearer owner-token';
      }

      return undefined;
    },
  } as Request;

  const verifiedResponse = await createOwnerBillingCheckoutSession(request, 'monthly', 'verified');
  const growthResponse = await createOwnerBillingCheckoutSession(request, 'monthly', 'growth');

  assert.equal(verifiedResponse.ok, true);
  assert.equal(growthResponse.ok, true);
  assert.deepEqual(observedIdempotencyKeys, [
    'owner-billing:owner-1:verified:monthly:price_verified_monthly',
    'owner-billing:owner-1:growth:monthly:price_growth_monthly',
  ]);
});

test('syncOwnerAppleSubscription stores Apple-managed owner access in the shared subscription doc', async () => {
  const storedSubscriptions = new Map<string, Record<string, unknown>>();
  const storedProfiles = new Map<string, Record<string, unknown>>();

  setCachedModule(firebaseModulePath, {
    hasBackendFirebaseConfig: true,
    getBackendFirebaseAuth: () => ({
      verifyIdToken: async () => ({
        uid: 'owner-1',
        email: 'owner@example.com',
        auth_time: Math.floor(Date.now() / 1000),
      }),
    }),
    getBackendFirebaseDb: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            const store = name === 'subscriptions' ? storedSubscriptions : storedProfiles;
            const record = store.get(id);
            return {
              exists: Boolean(record),
              data: () => record,
            };
          },
          set: async (value: Record<string, unknown>) => {
            const store = name === 'subscriptions' ? storedSubscriptions : storedProfiles;
            store.set(id, {
              ...(store.get(id) ?? {}),
              ...value,
            });
          },
        }),
      }),
    }),
  });

  setCachedModule(configModulePath, {
    serverConfig: {
      stripeSecretKey: 'sk_test_123',
      stripeWebhookSecret: 'whsec_test',
      stripeOwnerMonthlyPriceId: 'price_owner_monthly',
      stripeOwnerAnnualPriceId: 'price_owner_annual',
      stripeVerifiedMonthlyPriceId: 'price_verified_monthly',
      stripeVerifiedAnnualPriceId: 'price_verified_annual',
      stripeGrowthMonthlyPriceId: 'price_growth_monthly',
      stripeGrowthAnnualPriceId: 'price_growth_annual',
      stripeProMonthlyPriceId: 'price_pro_monthly',
      stripeProAnnualPriceId: 'price_pro_annual',
      stripeOwnerSuccessUrl: 'https://example.com/success',
      stripeOwnerCancelUrl: 'https://example.com/cancel',
      stripeOwnerPortalReturnUrl: 'https://example.com/portal',
      launchProgramStartAt: null,
      launchProgramDurationDays: 183,
      launchEarlyAdopterLimit: 500,
      ownerLaunchTrialDays: 0,
    },
    getMissingOwnerBillingBackendEnvVars: () => [],
  });

  setCachedModule(ownerPortalAuthorizationServicePath, {
    getOwnerAuthorizationState: async () => ({
      ownerUid: 'owner-1',
      ownerProfile: {
        uid: 'owner-1',
        dispensaryId: 'storefront-1',
        subscriptionStatus: 'inactive',
      },
      storefrontId: 'storefront-1',
      ownerClaim: null,
      businessVerificationStatus: 'verified',
      identityVerificationStatus: 'verified',
      subscription: null,
      hasVerifiedBusiness: true,
      hasVerifiedIdentity: true,
      hasActiveSubscription: false,
    }),
    isVerifiedOwnerStatus: (value: unknown) => value === 'verified' || value === 'approved',
  });

  setCachedModule(launchProgramServicePath, {
    resolveOwnerLaunchTrialOffer: async () => ({
      trialDays: 0,
      claim: null,
    }),
  });

  delete require.cache[ownerBillingServicePath];
  const { syncOwnerAppleSubscription } =
    require('./ownerBillingService') as typeof import('./ownerBillingService');

  const request = {
    header(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return 'Bearer owner-token';
      }

      return undefined;
    },
  } as Request;

  const response = await syncOwnerAppleSubscription(request, {
    productId: 'com.rezell.canopytrove.owner.growth.monthly.v3',
    transactionId: '2000001000001',
    originalTransactionId: '1000000999999',
    purchaseToken: 'signed-jws-value',
    currentPlanId: 'com.rezell.canopytrove.owner.growth.monthly.v3',
    environmentIOS: 'Sandbox',
    expirationDateMs: Date.now() + 7 * 24 * 60 * 60 * 1000,
    transactionDateMs: Date.now(),
    isAutoRenewing: true,
    purchaseState: 'purchased',
    renewalInfoIOS: {
      pendingUpgradeProductId: null,
      gracePeriodExpirationDateMs: null,
      isInBillingRetry: false,
      expirationReason: null,
    },
  });

  assert.equal(response.ok, true);
  assert.equal(response.provider, 'apple_iap');
  assert.equal(response.tier, 'growth');
  assert.equal(response.billingCycle, 'monthly');

  const storedSubscription = storedSubscriptions.get('owner-1');
  assert.ok(storedSubscription);
  assert.equal(storedSubscription?.provider, 'apple_iap');
  assert.equal(storedSubscription?.tier, 'growth');
  assert.equal(
    storedSubscription?.planId,
    'com.rezell.canopytrove.owner.growth.monthly.v3',
  );
  assert.equal(storedSubscription?.externalSubscriptionId, '1000000999999');
});
