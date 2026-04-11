import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const configModulePath = require.resolve('../config');
const firestoreCollectionsModulePath = require.resolve('../firestoreCollections');
const sourcesModulePath = require.resolve('../sources');
const expoPushServiceModulePath = require.resolve('./expoPushService');
const opsAlertSubscriptionServiceModulePath = require.resolve('./opsAlertSubscriptionService');

const originalModuleEntries = new Map(
  [
    configModulePath,
    firestoreCollectionsModulePath,
    sourcesModulePath,
    expoPushServiceModulePath,
    opsAlertSubscriptionServiceModulePath,
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
  delete require.cache[opsAlertSubscriptionServiceModulePath];

  for (const [modulePath, cachedModule] of originalModuleEntries.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
      continue;
    }

    delete require.cache[modulePath];
  }
});

test('notifyRuntimeAlertSubscribers paginates firestore subscription records before dispatching', async () => {
  const firstPageDocs = Array.from({ length: 500 }, (_value, index) => ({
    id: `owner:${index + 1}`,
    data: () => ({
      id: `owner:${index + 1}`,
      source: 'owner_portal',
      ownerUid: `owner-${index + 1}`,
      devicePushToken: `ExponentPushToken[first-${index + 1}]`,
      updatedAt: '2026-04-01T00:00:00.000Z',
    }),
  }));
  const secondPageDocs = [
    {
      id: 'owner:501',
      data: () => ({
        id: 'owner:501',
        source: 'owner_portal',
        ownerUid: 'owner-501',
        devicePushToken: 'ExponentPushToken[second-501]',
        updatedAt: '2026-04-01T00:00:00.000Z',
      }),
    },
  ];
  let startAfterCalls = 0;
  let dispatchedMessageCount = 0;

  function createQuery(pageIndex: number) {
    const docs = pageIndex === 0 ? firstPageDocs : secondPageDocs;

    return {
      startAfter(documentSnapshot: { id: string }) {
        startAfterCalls += 1;
        assert.equal(documentSnapshot.id, 'owner:500');
        return createQuery(pageIndex + 1);
      },
      async get() {
        return {
          empty: docs.length === 0,
          docs,
        };
      },
    };
  }

  setCachedModule(configModulePath, {
    serverConfig: {
      opsAlertCooldownMinutes: 5,
    },
  });

  setCachedModule(firestoreCollectionsModulePath, {
    getOptionalFirestoreCollection: () => ({
      limit(count: number) {
        assert.equal(count, 500);
        return createQuery(0);
      },
    }),
  });

  setCachedModule(sourcesModulePath, {
    backendStorefrontSourceStatus: {
      activeMode: 'firestore',
    },
  });

  setCachedModule(expoPushServiceModulePath, {
    sendExpoPushMessages: async (messages: Array<{ to: string }>) => {
      dispatchedMessageCount = messages.length;
      return messages.map(() => ({
        status: 'ok',
      }));
    },
  });

  delete require.cache[opsAlertSubscriptionServiceModulePath];
  const { notifyRuntimeAlertSubscribers } =
    require('./opsAlertSubscriptionService') as typeof import('./opsAlertSubscriptionService');

  const result = await notifyRuntimeAlertSubscribers({
    title: 'Runtime degraded',
    body: 'Investigate storefront readiness.',
  });

  assert.equal(startAfterCalls, 1);
  assert.equal(dispatchedMessageCount, 501);
  assert.equal(result.notifiedSubscriberCount, 501);
  assert.equal(result.storage, 'firestore');
});
