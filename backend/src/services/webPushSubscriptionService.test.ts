import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const firebaseModulePath = require.resolve('../firebase');
const subscriptionServicePath = require.resolve('./webPushSubscriptionService');

const originalFirebaseCache = require.cache[firebaseModulePath];

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

function setFirestoreUnavailable() {
  // Returning null from getBackendFirebaseDb forces the in-memory fallback path,
  // which gives us a deterministic store to assert against without needing
  // a live Firestore.
  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => null,
  });
}

function loadFreshService() {
  delete require.cache[subscriptionServicePath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./webPushSubscriptionService') as typeof import('./webPushSubscriptionService');
}

beforeEach(() => {
  setFirestoreUnavailable();
});

afterEach(() => {
  if (originalFirebaseCache) require.cache[firebaseModulePath] = originalFirebaseCache;
  else delete require.cache[firebaseModulePath];
  delete require.cache[subscriptionServicePath];
});

test('hashEndpoint returns stable 32-char lowercase hex', () => {
  const service = loadFreshService();
  const hash = service.hashEndpoint('https://fcm.googleapis.com/fcm/send/abc');
  assert.equal(hash.length, 32);
  assert.match(hash, /^[a-f0-9]{32}$/);
  // Same input → same output
  assert.equal(hash, service.hashEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
  // Different input → different output
  assert.notEqual(hash, service.hashEndpoint('https://fcm.googleapis.com/fcm/send/xyz'));
});

test('upsert + list returns the stored subscription', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  const stored = await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'p256dh-bytes',
    auth: 'auth-bytes',
    userAgent: 'Mozilla/5.0',
  });
  assert.equal(stored.ownerUid, 'owner-1');
  assert.equal(stored.endpointHash.length, 32);
  assert.equal(stored.userAgent, 'Mozilla/5.0');

  const listed = await service.listOwnerWebPushSubscriptions('owner-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.endpoint, 'https://fcm.googleapis.com/fcm/send/abc');
  assert.equal(listed[0]!.p256dh, 'p256dh-bytes');
});

test('upsert is idempotent on the same endpoint and refreshes lastSeenAt', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  const first = await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'p256dh-1',
    auth: 'auth-1',
  });

  // Tiny delay so the lastSeenAt timestamp can advance past the first one.
  await new Promise((resolve) => setTimeout(resolve, 5));

  const second = await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'p256dh-2',
    auth: 'auth-2',
  });

  assert.equal(first.endpointHash, second.endpointHash);
  // createdAt is preserved across upserts
  assert.equal(first.createdAt, second.createdAt);
  // lastSeenAt advanced
  assert.ok(
    new Date(second.lastSeenAt).getTime() >= new Date(first.lastSeenAt).getTime(),
    'lastSeenAt should advance on re-upsert',
  );
  // New keys overwrite stale ones (browser may rotate them)
  assert.equal(second.p256dh, 'p256dh-2');

  const listed = await service.listOwnerWebPushSubscriptions('owner-1');
  assert.equal(listed.length, 1, 'second upsert should not create a duplicate');
});

test('multiple endpoints per owner are kept independent', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/laptop',
    p256dh: 'k1',
    auth: 'a1',
  });
  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
    p256dh: 'k2',
    auth: 'a2',
  });

  const listed = await service.listOwnerWebPushSubscriptions('owner-1');
  assert.equal(listed.length, 2);
  const endpoints = listed.map((sub) => sub.endpoint).sort();
  assert.deepEqual(endpoints, [
    'https://fcm.googleapis.com/fcm/send/laptop',
    'https://fcm.googleapis.com/fcm/send/phone',
  ]);
});

test('subscriptions are scoped to ownerUid', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-A',
    endpoint: 'https://fcm.googleapis.com/fcm/send/x',
    p256dh: 'k',
    auth: 'a',
  });
  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-B',
    endpoint: 'https://fcm.googleapis.com/fcm/send/y',
    p256dh: 'k',
    auth: 'a',
  });

  const a = await service.listOwnerWebPushSubscriptions('owner-A');
  const b = await service.listOwnerWebPushSubscriptions('owner-B');
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0]!.endpoint, 'https://fcm.googleapis.com/fcm/send/x');
  assert.equal(b[0]!.endpoint, 'https://fcm.googleapis.com/fcm/send/y');
});

test('deleteOwnerWebPushSubscription removes by endpoint', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: 'k',
    auth: 'a',
  });

  const result = await service.deleteOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  });
  assert.equal(result.deleted, true);

  const remaining = await service.listOwnerWebPushSubscriptions('owner-1');
  assert.equal(remaining.length, 0);
});

test('deleteOwnerWebPushSubscription returns missing_endpoint when no identifier provided', async () => {
  const service = loadFreshService();
  const result = await service.deleteOwnerWebPushSubscription({ ownerUid: 'owner-1' });
  assert.equal(result.deleted, false);
  if (!result.deleted) {
    assert.equal(result.reason, 'missing_endpoint');
  }
});

test('deleteAllOwnerWebPushSubscriptions wipes only the requested owner', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/x',
    p256dh: 'k',
    auth: 'a',
  });
  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/y',
    p256dh: 'k',
    auth: 'a',
  });
  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-2',
    endpoint: 'https://fcm.googleapis.com/fcm/send/z',
    p256dh: 'k',
    auth: 'a',
  });

  const result = await service.deleteAllOwnerWebPushSubscriptions('owner-1');
  assert.equal(result.deletedCount, 2);

  assert.equal((await service.listOwnerWebPushSubscriptions('owner-1')).length, 0);
  assert.equal((await service.listOwnerWebPushSubscriptions('owner-2')).length, 1);
});

test('pruneExpiredWebPushSubscriptions removes only the listed endpoints', async () => {
  const service = loadFreshService();
  service.__resetInMemoryWebPushSubscriptionsForTests();

  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/dead',
    p256dh: 'k',
    auth: 'a',
  });
  await service.upsertOwnerWebPushSubscription({
    ownerUid: 'owner-1',
    endpoint: 'https://fcm.googleapis.com/fcm/send/live',
    p256dh: 'k',
    auth: 'a',
  });

  const result = await service.pruneExpiredWebPushSubscriptions({
    ownerUid: 'owner-1',
    expiredEndpoints: ['https://fcm.googleapis.com/fcm/send/dead'],
  });
  assert.equal(result.prunedCount, 1);

  const remaining = await service.listOwnerWebPushSubscriptions('owner-1');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]!.endpoint, 'https://fcm.googleapis.com/fcm/send/live');
});

test('pruneExpiredWebPushSubscriptions short-circuits on empty endpoint list', async () => {
  const service = loadFreshService();
  const result = await service.pruneExpiredWebPushSubscriptions({
    ownerUid: 'owner-1',
    expiredEndpoints: [],
  });
  assert.equal(result.prunedCount, 0);
});
