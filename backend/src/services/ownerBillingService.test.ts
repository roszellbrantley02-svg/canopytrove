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
