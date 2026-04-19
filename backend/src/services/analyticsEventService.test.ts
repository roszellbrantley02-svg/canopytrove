import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const firebaseModulePath = require.resolve('../firebase');
const analyticsEventServicePath = require.resolve('./analyticsEventService');

const originalFirebaseModule = require.cache[firebaseModulePath];

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
  delete require.cache[analyticsEventServicePath];

  if (originalFirebaseModule) {
    require.cache[firebaseModulePath] = originalFirebaseModule;
    return;
  }

  delete require.cache[firebaseModulePath];
});

test('recordAnalyticsEvents buckets daily metrics by receivedAt instead of client occurredAt', async () => {
  const writes: Array<{
    path: string;
    data: Record<string, unknown>;
    merge: boolean;
  }> = [];

  const fakeDb = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        path: `${name}/${id}`,
      }),
    }),
    batch: () => ({
      set: (
        ref: { path: string },
        data: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => {
        writes.push({
          path: ref.path,
          data,
          merge: options?.merge === true,
        });
      },
      commit: async () => undefined,
    }),
    getAll: async (...refs: Array<{ id: string }>) =>
      refs.map((ref) => ({
        exists: false,
        id: ref.id,
      })),
  };

  setCachedModule(firebaseModulePath, {
    getBackendFirebaseDb: () => fakeDb,
  });

  const { recordAnalyticsEvents } =
    require('./analyticsEventService') as typeof import('./analyticsEventService');

  const result = await recordAnalyticsEvents(
    {
      platform: 'ios',
      events: [
        {
          eventId: 'event-1',
          eventType: 'app_open',
          installId: 'install-1',
          sessionId: 'session-1',
          occurredAt: '2026-03-01T10:00:00.000Z',
          screen: 'Nearby',
        },
      ],
    },
    {
      ipAddress: '203.0.113.10',
      receivedAt: '2026-04-19T12:30:00.000Z',
      userAgent: 'unit-test',
    },
  );

  assert.equal(result.accepted, 1);

  const rawEventWrite = writes.find((write) => write.path === 'analytics_events/event-1');
  assert.ok(rawEventWrite);
  assert.equal(rawEventWrite?.data.occurredAt, '2026-03-01T10:00:00.000Z');
  assert.equal(rawEventWrite?.data.receivedAt, '2026-04-19T12:30:00.000Z');

  const dailyMetricWrite = writes.find(
    (write) => write.path === 'analytics_daily_app_metrics/2026-04-19',
  );
  assert.ok(dailyMetricWrite);
});
