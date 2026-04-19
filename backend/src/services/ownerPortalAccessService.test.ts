import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Request } from 'express';

type FirebaseAuthOverride = {
  verifyIdToken: (token: string) => Promise<Record<string, unknown>>;
  getUser: (uid: string) => Promise<Record<string, unknown>>;
};

type TestGlobals = typeof globalThis & {
  __CANOPY_TEST_BACKEND_FIREBASE_AUTH__?: FirebaseAuthOverride;
};

const originalOwnerPortalAllowlist = process.env.OWNER_PORTAL_ALLOWLIST;

function clearTestModules() {
  for (const modulePath of [
    '../config',
    '../firebase',
    './ownerPortalAccessService',
    './ownerPortalAuthClaimsService',
  ]) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // Module may not have been loaded yet.
    }
  }
}

function setTestAuthOverride(override: FirebaseAuthOverride | null) {
  const testGlobals = globalThis as TestGlobals;
  if (override) {
    testGlobals.__CANOPY_TEST_BACKEND_FIREBASE_AUTH__ = override;
    return;
  }

  delete testGlobals.__CANOPY_TEST_BACKEND_FIREBASE_AUTH__;
}

function buildRequest(token: string | null): Request {
  return {
    header(name: string) {
      if (name.toLowerCase() !== 'authorization' || !token) {
        return undefined;
      }

      return `Bearer ${token}`;
    },
  } as Request;
}

async function loadOwnerPortalAccessModule(tag: string) {
  clearTestModules();
  return import(`./ownerPortalAccessService?${tag}=${Date.now()}`);
}

afterEach(() => {
  setTestAuthOverride(null);
  if (originalOwnerPortalAllowlist === undefined) {
    delete process.env.OWNER_PORTAL_ALLOWLIST;
  } else {
    process.env.OWNER_PORTAL_ALLOWLIST = originalOwnerPortalAllowlist;
  }
  clearTestModules();
});

test('ensureOwnerPortalAccess rejects authenticated members without owner claims', async () => {
  process.env.NODE_ENV = 'test';
  setTestAuthOverride({
    verifyIdToken: async (token: string) => {
      assert.equal(token, 'member-token');
      return {
        uid: 'member-portal-1',
        email: 'member@example.com',
        role: 'member',
      };
    },
    getUser: async (uid: string) => ({ uid }),
  });

  const { OwnerPortalAccessError, ensureOwnerPortalAccess } =
    await loadOwnerPortalAccessModule('member');

  let thrownError: unknown = null;
  try {
    await ensureOwnerPortalAccess(buildRequest('member-token'));
    assert.fail('Expected owner portal access check to reject member claims.');
  } catch (error) {
    thrownError = error;
  }

  assert.ok(thrownError instanceof OwnerPortalAccessError);
  if (!(thrownError instanceof OwnerPortalAccessError)) {
    throw thrownError;
  }

  const ownerPortalError = thrownError as InstanceType<typeof OwnerPortalAccessError>;
  assert.equal(ownerPortalError.statusCode, 403);
  assert.equal(ownerPortalError.message, 'This account does not have owner access.');
});

test('ensureOwnerPortalAccess accepts owner claims', async () => {
  process.env.NODE_ENV = 'test';
  process.env.OWNER_PORTAL_ALLOWLIST = 'owner@example.com';
  setTestAuthOverride({
    verifyIdToken: async (token: string) => {
      assert.equal(token, 'owner-token');
      return {
        uid: 'owner-portal-1',
        email: 'owner@example.com',
        role: 'owner',
      };
    },
    getUser: async (uid: string) => ({ uid }),
  });

  const { ensureOwnerPortalAccess } = await loadOwnerPortalAccessModule('owner');
  const result = await ensureOwnerPortalAccess(buildRequest('owner-token'));

  assert.deepEqual(result, {
    ownerUid: 'owner-portal-1',
    ownerEmail: 'owner@example.com',
  });
});

test('ensureOwnerPortalClaimSyncAccess accepts authenticated members before owner claims exist', async () => {
  process.env.NODE_ENV = 'test';
  setTestAuthOverride({
    verifyIdToken: async (token: string) => {
      assert.equal(token, 'member-sync-token');
      return {
        uid: 'member-sync-1',
        email: 'member@example.com',
        role: 'member',
      };
    },
    getUser: async (uid: string) => ({ uid }),
  });

  const { ensureOwnerPortalClaimSyncAccess } = await loadOwnerPortalAccessModule('member');
  const result = await ensureOwnerPortalClaimSyncAccess(buildRequest('member-sync-token'));

  assert.deepEqual(result, {
    ownerUid: 'member-sync-1',
    ownerEmail: 'member@example.com',
  });
});
