import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Server } from 'node:http';

let activeServer: Server | null = null;

beforeEach(() => {
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  process.env.ALLOW_DEV_SEED = 'false';
  process.env.READ_RATE_LIMIT_PER_MINUTE = '240';
  process.env.WRITE_RATE_LIMIT_PER_MINUTE = '60';
  process.env.ADMIN_RATE_LIMIT_PER_TEN_MINUTES = '10';
});

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    activeServer = null;
  }

  const { clearRateLimitState } = await import('./http/rateLimit');
  clearRateLimitState();
  const { clearAnalyticsEventState } = await import('./services/analyticsEventService');
  clearAnalyticsEventState();
});

async function startTestServer() {
  const backendSourceRoot = `${path.sep}canopy-trove-3-restored${path.sep}backend${path.sep}src${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }

  const { createApp } = await import('./app');
  const app = createApp();

  const server = app.listen(0);
  activeServer = server;

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', (error) => reject(error));
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
  };
}

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    headers: response.headers,
  };
}

test('rejects invalid storefront summary pagination', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/storefront-summaries?limit=999');

  assert.equal(response.status, 400);
  assert.equal(response.json?.error, 'limit must be at most 24.');
});

test('rejects malformed community review payloads', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/storefront-details/test-store/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profileId: 'profile-1',
      rating: 6,
      text: 'test',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(response.json?.error, 'body.rating must be at most 5.');
});

test('applies stricter rate limits to admin routes', async () => {
  const { baseUrl } = await startTestServer();

  let lastResponse = null as Awaited<ReturnType<typeof request>> | null;
  for (let index = 0; index < 11; index += 1) {
    lastResponse = await request(baseUrl, '/admin/seed-status');
  }

  assert.ok(lastResponse);
  assert.equal(lastResponse.status, 429);
  assert.equal(lastResponse.json?.error, 'Too many requests. Please retry shortly.');
  assert.equal(lastResponse.headers.get('retry-after'), '600');
});

test('reports missing admin review api key explicitly', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/reviews/queue');

  assert.equal(response.status, 503);
  assert.equal(
    response.json?.error,
    'Admin review is not fully configured. Missing: ADMIN_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
  );
});

test('reports missing admin firebase config after admin auth succeeds', async () => {
  process.env.ADMIN_API_KEY = 'admin-secret';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/reviews/queue', {
    headers: {
      'x-admin-api-key': 'admin-secret',
    },
  });

  assert.equal(response.status, 503);
  assert.equal(
    response.json?.error,
    'Admin review is not fully configured. Missing: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
  );
});

test('accepts client runtime error reports', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/client-errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Detail fetch failed',
      source: 'storefront-detail-fetch',
      screen: 'StorefrontDetail',
      isFatal: false,
      platform: 'android',
      reportedAt: new Date().toISOString(),
    }),
  });

  assert.equal(response.status, 202);
  assert.equal(response.json?.ok, true);
});

test('accepts analytics event batches', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform: 'android',
      events: [
        {
          eventType: 'app_open',
          installId: 'install-1',
          sessionId: 'session-1',
          occurredAt: new Date().toISOString(),
          screen: 'Nearby',
          metadata: {
            reason: 'cold_start',
          },
        },
      ],
    }),
  });

  assert.equal(response.status, 202);
  assert.equal(response.json?.ok, true);
  assert.equal(response.json?.accepted, 1);
});
