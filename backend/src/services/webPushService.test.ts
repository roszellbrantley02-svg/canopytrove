import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const configModulePath = require.resolve('../config');
const webPushModulePath = require.resolve('web-push');
const webPushServicePath = require.resolve('./webPushService');

const originalConfigCache = require.cache[configModulePath];
const originalWebPushCache = require.cache[webPushModulePath];
const originalServiceCache = require.cache[webPushServicePath];

type WebPushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

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

function setVapidConfig(configured: boolean) {
  setCachedModule(configModulePath, {
    serverConfig: configured
      ? {
          webPushVapidPublicKey: 'BPub_KEY',
          webPushVapidPrivateKey: 'PrivKey',
          webPushVapidSubject: 'mailto:test@example.com',
        }
      : {
          webPushVapidPublicKey: null,
          webPushVapidPrivateKey: null,
          webPushVapidSubject: null,
        },
  });
}

type RecordedCall = {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  payload: string;
};

function setWebPushModule(behavior: {
  vapidCalls: string[][];
  recordedCalls: RecordedCall[];
  errorOnEndpoint?: { endpoint: string; statusCode: number };
}) {
  const stub = {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => {
      behavior.vapidCalls.push([subject, publicKey, privateKey]);
    },
    sendNotification: async (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      body: string,
    ) => {
      behavior.recordedCalls.push({ subscription, payload: body });
      if (behavior.errorOnEndpoint && subscription.endpoint === behavior.errorOnEndpoint.endpoint) {
        const error = new Error('push service rejected') as Error & { statusCode: number };
        error.statusCode = behavior.errorOnEndpoint.statusCode;
        throw error;
      }
      return { statusCode: 201 };
    },
  };
  setCachedModule(webPushModulePath, stub);
}

function loadFreshService() {
  delete require.cache[webPushServicePath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./webPushService') as typeof import('./webPushService');
}

const validSubscription: WebPushSubscriptionRecord = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abcdef',
  p256dh: 'p256dh-public-key-bytes',
  auth: 'auth-secret-bytes',
};

beforeEach(() => {
  setVapidConfig(true);
});

afterEach(() => {
  if (originalConfigCache) require.cache[configModulePath] = originalConfigCache;
  else delete require.cache[configModulePath];
  if (originalWebPushCache) require.cache[webPushModulePath] = originalWebPushCache;
  else delete require.cache[webPushModulePath];
  if (originalServiceCache) require.cache[webPushServicePath] = originalServiceCache;
  else delete require.cache[webPushServicePath];
});

test('sendWebPushNotification returns skipped when VAPID config is missing', async () => {
  setVapidConfig(false);
  const service = loadFreshService();
  const result = await service.sendWebPushNotification(validSubscription, {
    title: 'Hi',
    body: 'World',
  });
  assert.equal(result.status, 'skipped');
  if (result.status === 'skipped') {
    assert.equal(result.reason, 'not_configured');
  }
});

test('sendWebPushNotification returns skipped on invalid subscription shape', async () => {
  const calls: RecordedCall[] = [];
  setWebPushModule({ vapidCalls: [], recordedCalls: calls });
  const service = loadFreshService();
  const result = await service.sendWebPushNotification(
    { endpoint: '', p256dh: '', auth: '' },
    { title: 'Hi', body: 'World' },
  );
  assert.equal(result.status, 'skipped');
  if (result.status === 'skipped') {
    assert.equal(result.reason, 'invalid_subscription');
  }
  assert.equal(calls.length, 0);
});

test('sendWebPushNotification calls web-push.sendNotification with serialized payload', async () => {
  const calls: RecordedCall[] = [];
  const vapidCalls: string[][] = [];
  setWebPushModule({ vapidCalls, recordedCalls: calls });
  const service = loadFreshService();
  const result = await service.sendWebPushNotification(validSubscription, {
    title: 'New review',
    body: 'You got a 5-star review',
    url: '/owner-portal/reviews',
    tag: 'review-123',
    data: { storefrontId: 'shop-1' },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.endpoint, validSubscription.endpoint);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.subscription.endpoint, validSubscription.endpoint);

  const body = JSON.parse(calls[0]!.payload);
  assert.equal(body.title, 'New review');
  assert.equal(body.body, 'You got a 5-star review');
  assert.equal(body.url, '/owner-portal/reviews');
  assert.equal(body.tag, 'review-123');
  assert.deepEqual(body.data, { storefrontId: 'shop-1' });

  // setVapidDetails must be invoked exactly once during the lazy load.
  assert.equal(vapidCalls.length, 1);
  assert.equal(vapidCalls[0]![0], 'mailto:test@example.com');
});

test('sendWebPushNotification flags expired endpoints when push service returns 410', async () => {
  const calls: RecordedCall[] = [];
  setWebPushModule({
    vapidCalls: [],
    recordedCalls: calls,
    errorOnEndpoint: { endpoint: validSubscription.endpoint, statusCode: 410 },
  });
  const service = loadFreshService();
  const result = await service.sendWebPushNotification(validSubscription, {
    title: 'Hi',
    body: 'World',
  });
  assert.equal(result.status, 'expired');
  if (result.status === 'expired') {
    assert.equal(result.statusCode, 410);
    assert.equal(result.endpoint, validSubscription.endpoint);
  }
});

test('sendWebPushNotification flags 404, 401, 403 as expired (treat as dead)', async () => {
  for (const statusCode of [404, 401, 403]) {
    const calls: RecordedCall[] = [];
    setWebPushModule({
      vapidCalls: [],
      recordedCalls: calls,
      errorOnEndpoint: { endpoint: validSubscription.endpoint, statusCode },
    });
    const service = loadFreshService();
    const result = await service.sendWebPushNotification(validSubscription, {
      title: 'Hi',
      body: 'World',
    });
    assert.equal(result.status, 'expired', `statusCode ${statusCode} should be treated as expired`);
  }
});

test('sendWebPushNotification surfaces non-expired errors as error', async () => {
  const calls: RecordedCall[] = [];
  setWebPushModule({
    vapidCalls: [],
    recordedCalls: calls,
    errorOnEndpoint: { endpoint: validSubscription.endpoint, statusCode: 500 },
  });
  const service = loadFreshService();
  const result = await service.sendWebPushNotification(validSubscription, {
    title: 'Hi',
    body: 'World',
  });
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.equal(result.statusCode, 500);
  }
});

test('sendWebPushNotifications fans out and returns one result per subscription', async () => {
  const calls: RecordedCall[] = [];
  setWebPushModule({
    vapidCalls: [],
    recordedCalls: calls,
    errorOnEndpoint: { endpoint: 'https://example.com/dead', statusCode: 410 },
  });
  const service = loadFreshService();
  const subs: WebPushSubscriptionRecord[] = [
    validSubscription,
    {
      endpoint: 'https://example.com/dead',
      p256dh: 'p256dh',
      auth: 'auth',
    },
    {
      endpoint: 'https://example.com/live',
      p256dh: 'p256dh',
      auth: 'auth',
    },
  ];
  const results = await service.sendWebPushNotifications(subs, { title: 'Hi', body: 'World' });

  assert.equal(results.length, 3);
  assert.equal(results[0]!.status, 'ok');
  assert.equal(results[1]!.status, 'expired');
  assert.equal(results[2]!.status, 'ok');
  assert.equal(calls.length, 3);
});

test('sendWebPushNotifications short-circuits to empty array when no subscriptions', async () => {
  const service = loadFreshService();
  const results = await service.sendWebPushNotifications([], { title: 'Hi', body: 'World' });
  assert.deepEqual(results, []);
});

test('isWebPushConfigured reflects current VAPID config state', async () => {
  setVapidConfig(true);
  let service = loadFreshService();
  assert.equal(service.isWebPushConfigured(), true);

  setVapidConfig(false);
  service = loadFreshService();
  assert.equal(service.isWebPushConfigured(), false);
});
