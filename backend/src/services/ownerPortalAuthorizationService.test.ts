import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const firebaseModulePath = require.resolve('../firebase');
const ownerPortalWorkspaceDataModulePath = require.resolve('./ownerPortalWorkspaceData');
const ownerPortalAuthorizationServicePath = require.resolve('./ownerPortalAuthorizationService');

const originalModuleEntries = new Map(
  [firebaseModulePath, ownerPortalWorkspaceDataModulePath, ownerPortalAuthorizationServicePath].map(
    (modulePath) => [modulePath, require.cache[modulePath]],
  ),
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
  delete require.cache[ownerPortalAuthorizationServicePath];

  for (const [modulePath, cachedModule] of originalModuleEntries.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
      continue;
    }

    delete require.cache[modulePath];
  }
});

test('getOwnerAuthorizationState falls back to ownerProfile.dispensaryId when no canonical storefront is linked yet', async () => {
  let queriedOwnerUid: string | null = null;
  let orderByField: string | null = null;

  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => ({
      collection(name: string) {
        if (name === 'dispensaries') {
          return {
            where(field: string, operator: string, ownerUid: string) {
              assert.equal(field, 'ownerUid');
              assert.equal(operator, '==');
              queriedOwnerUid = ownerUid;

              return {
                orderBy(fieldName: string) {
                  orderByField = fieldName;

                  return {
                    limit(count: number) {
                      assert.equal(count, 1);

                      return {
                        get: async () => ({
                          empty: true,
                          docs: [],
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (
          name === 'businessVerifications' ||
          name === 'identityVerifications' ||
          name === 'subscriptions'
        ) {
          return {
            doc(documentId: string) {
              assert.equal(documentId, 'owner-1');
              return {
                get: async () => ({
                  exists: false,
                }),
              };
            },
          };
        }

        if (name === 'dispensaryClaims') {
          return {
            doc(documentId: string) {
              assert.equal(documentId, 'owner-1_disp-123');
              return {
                get: async () => ({
                  exists: true,
                  data: () => ({
                    ownerUid: 'owner-1',
                    dispensaryId: 'disp-123',
                    claimStatus: 'approved',
                    submittedAt: '2026-04-01T00:00:00.000Z',
                    reviewedAt: '2026-04-02T00:00:00.000Z',
                    reviewNotes: null,
                  }),
                }),
              };
            },
            where() {
              throw new Error(
                'Claim fallback query should not run when canonical claim id is resolved.',
              );
            },
          };
        }

        throw new Error(`Unexpected collection lookup: ${name}`);
      },
    }),
  });

  setCachedModule(ownerPortalWorkspaceDataModulePath, {
    getOwnerProfile: async (ownerUid: string) => {
      assert.equal(ownerUid, 'owner-1');
      return {
        uid: ownerUid,
        companyName: 'Fallback Dispensary',
        dispensaryId: 'disp-123',
        businessVerificationStatus: 'verified',
        identityVerificationStatus: 'approved',
        subscriptionStatus: 'trial',
        onboardingStep: 'completed',
        badgeLevel: 2,
        legalName: 'Fallback Dispensary LLC',
        phone: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      };
    },
  });

  delete require.cache[ownerPortalAuthorizationServicePath];
  const { getOwnerAuthorizationState } =
    require('./ownerPortalAuthorizationService') as typeof import('./ownerPortalAuthorizationService');

  const state = await getOwnerAuthorizationState('owner-1');

  assert.equal(queriedOwnerUid, 'owner-1');
  assert.equal(orderByField, '__name__');
  assert.equal(state.storefrontId, 'disp-123');
  assert.equal(state.ownerClaim?.dispensaryId, 'disp-123');
  assert.equal(state.businessVerificationStatus, 'verified');
  assert.equal(state.identityVerificationStatus, 'approved');
  assert.equal(state.hasVerifiedBusiness, true);
  assert.equal(state.hasVerifiedIdentity, true);
  assert.equal(state.hasActiveSubscription, false);
});
