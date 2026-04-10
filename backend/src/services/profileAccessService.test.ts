import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Request } from 'express';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_K_SERVICE = process.env.K_SERVICE;

function loadProfileAccessModules() {
  const modulePaths = [
    require.resolve('../config'),
    require.resolve('../firestoreCollections'),
    require.resolve('../firebase'),
    require.resolve('./profileService'),
    require.resolve('./profileAccessService'),
  ];

  for (const modulePath of modulePaths) {
    delete require.cache[modulePath];
  }

  return {
    profileService: require('./profileService') as typeof import('./profileService'),
    profileAccessService:
      require('./profileAccessService') as typeof import('./profileAccessService'),
  };
}

function createRequest(authorizationHeader: string): Request {
  return {
    method: 'PUT',
    ip: '127.0.0.1',
    originalUrl: '/profiles/test-profile',
    header(name: string) {
      if (name.toLowerCase() === 'authorization') {
        return authorizationHeader;
      }
      return undefined;
    },
  } as Request;
}

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  if (ORIGINAL_K_SERVICE === undefined) {
    delete process.env.K_SERVICE;
  } else {
    process.env.K_SERVICE = ORIGINAL_K_SERVICE;
  }
});

test('ensureProfileWriteAccess blocks signed-in takeover of an existing anonymous profile', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.K_SERVICE;

  const { profileService, profileAccessService } = loadProfileAccessModules();
  await profileService.saveProfile({
    id: 'guest-profile',
    kind: 'anonymous',
    accountId: null,
    displayName: null,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  });

  await assert.rejects(
    () =>
      profileAccessService.ensureProfileWriteAccess(
        createRequest('Bearer test-authenticated:user-1'),
        'guest-profile',
      ),
    (error: unknown) =>
      error instanceof profileAccessService.ProfileAccessError && error.statusCode === 409,
  );

  const storedProfile = await profileService.getProfile('guest-profile');
  assert.equal(storedProfile.kind, 'anonymous');
  assert.equal(storedProfile.accountId, null);
});

test('ensureProfileWriteAccess still auto-creates a fresh authenticated profile when the document is missing', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.K_SERVICE;

  const { profileService, profileAccessService } = loadProfileAccessModules();
  const result = await profileAccessService.ensureProfileWriteAccess(
    createRequest('Bearer test-authenticated:user-1'),
    'fresh-profile',
  );

  assert.equal(result.accountId, 'user-1');
  assert.equal(result.profile.id, 'fresh-profile');
  assert.equal(result.profile.kind, 'authenticated');
  assert.equal(result.profile.accountId, 'user-1');

  const storedProfile = await profileService.getProfile('fresh-profile');
  assert.equal(storedProfile.kind, 'authenticated');
  assert.equal(storedProfile.accountId, 'user-1');
});

test('ensureAuthenticatedProfileWriteAccess rejects anonymous writes with a 403', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.K_SERVICE;

  const { profileAccessService } = loadProfileAccessModules();

  await assert.rejects(
    () =>
      profileAccessService.ensureAuthenticatedProfileWriteAccess(
        createRequest(''),
        'anonymous-profile',
        'Sign-in required for this action.',
      ),
    (error: unknown) =>
      error instanceof profileAccessService.ProfileAccessError &&
      error.statusCode === 403 &&
      error.message === 'Sign-in required for this action.',
  );
});

test('ensureAuthenticatedProfileWriteAccess preserves authenticated access for the profile owner', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.K_SERVICE;

  const { profileAccessService } = loadProfileAccessModules();
  const result = await profileAccessService.ensureAuthenticatedProfileWriteAccess(
    createRequest('Bearer test-authenticated:user-2'),
    'fresh-authenticated-profile',
  );

  assert.equal(result.accountId, 'user-2');
  assert.equal(result.profile.id, 'fresh-authenticated-profile');
  assert.equal(result.profile.kind, 'authenticated');
  assert.equal(result.profile.accountId, 'user-2');
});
