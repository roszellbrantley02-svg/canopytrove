import assert from 'node:assert/strict';
import { describe, beforeEach, afterEach, test } from 'node:test';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRateLimitMiddleware, clearRateLimitState } from './rateLimit';

function createTestServer(maxRequests: number, windowMs: number, methods?: string[]) {
  const middleware = createRateLimitMiddleware({
    name: 'test-limit',
    max: maxRequests,
    windowMs,
    methods,
  });

  const server = createServer((req, res) => {
    middleware(req as any, res as any, () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  return server;
}

async function makeRequest(url: string): Promise<{ status: number; headers: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port),
      path: urlObj.pathname,
      method: 'GET',
    };

    const req = require('node:http').request(options, (res: any) => {
      const headers: Record<string, any> = {};
      Object.keys(res.headers).forEach((key) => {
        headers[key] = res.headers[key];
      });
      resolve({ status: res.statusCode, headers });
    });

    req.on('error', reject);
    req.end();
  });
}

describe('rateLimit middleware', () => {
  let server: Server | null = null;
  let serverUrl: string = '';

  afterEach(async () => {
    clearRateLimitState();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      server = null;
    }
  });

  test('allows requests under the limit', (t, done) => {
    server = createTestServer(5, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        const result = await makeRequest(serverUrl);
        assert.equal(result.status, 200);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('allows multiple requests under the limit', (t, done) => {
    server = createTestServer(5, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        for (let i = 0; i < 5; i++) {
          const result = await makeRequest(serverUrl);
          assert.equal(result.status, 200);
        }
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('blocks requests over the limit with 429 status', (t, done) => {
    server = createTestServer(3, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        // Make 3 successful requests
        for (let i = 0; i < 3; i++) {
          const result = await makeRequest(serverUrl);
          assert.equal(result.status, 200);
        }

        // 4th request should be blocked
        const result = await makeRequest(serverUrl);
        assert.equal(result.status, 429);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('sets X-RateLimit-Limit header', (t, done) => {
    server = createTestServer(10, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        const result = await makeRequest(serverUrl);
        assert.equal(result.headers['x-ratelimit-limit'], '10');
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('sets X-RateLimit-Remaining header with correct count', (t, done) => {
    server = createTestServer(5, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        const result = await makeRequest(serverUrl);
        assert.equal(result.headers['x-ratelimit-remaining'], '4');
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('sets X-RateLimit-Reset header with positive value', (t, done) => {
    server = createTestServer(5, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        const result = await makeRequest(serverUrl);
        const resetSeconds = parseInt(result.headers['x-ratelimit-reset']);
        assert(resetSeconds >= 1, 'Reset should be at least 1 second');
        assert(resetSeconds <= 60, 'Reset should be within window');
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('sets Retry-After header on rate limit response', (t, done) => {
    server = createTestServer(2, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        // Exhaust limit
        for (let i = 0; i < 2; i++) {
          await makeRequest(serverUrl);
        }

        // Check that blocked request has Retry-After
        const result = await makeRequest(serverUrl);
        assert.equal(result.status, 429);
        assert(result.headers['retry-after'], 'Should have Retry-After header');
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('resets counter after window expires', (t, done) => {
    server = createTestServer(2, 100); // Short 100ms window
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        // Make 2 requests to exhaust limit
        for (let i = 0; i < 2; i++) {
          const result = await makeRequest(serverUrl);
          assert.equal(result.status, 200);
        }

        // 3rd request should be blocked
        let result = await makeRequest(serverUrl);
        assert.equal(result.status, 429);

        // Wait for window to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Request should succeed after reset
        result = await makeRequest(serverUrl);
        assert.equal(result.status, 200);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('tracks requests per IP separately', (t, done) => {
    // This is a simplified test since all requests come from localhost
    server = createTestServer(2, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        // Make 2 requests
        for (let i = 0; i < 2; i++) {
          const result = await makeRequest(serverUrl);
          assert.equal(result.status, 200);
        }

        // 3rd should be blocked (same IP)
        const result = await makeRequest(serverUrl);
        assert.equal(result.status, 429);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('respects method filtering when specified', (t, done) => {
    // Create middleware that only rate limits POST requests
    const middleware = createRateLimitMiddleware({
      name: 'post-only',
      max: 1,
      windowMs: 60000,
      methods: ['POST'],
    });

    const server2 = createServer((req, res) => {
      middleware(req as any, res as any, () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    server2.listen(0, async () => {
      const address = server2.address() as AddressInfo;
      const url = `http://localhost:${address.port}/`;

      try {
        const result = await makeRequest(url);
        // GET request should not be rate limited
        assert.equal(result.status, 200);
        done();
      } catch (error) {
        done(error);
      } finally {
        server2.close();
      }
    });
  });

  test('decrements remaining count correctly with multiple requests', (t, done) => {
    server = createTestServer(10, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        for (let i = 0; i < 5; i++) {
          const result = await makeRequest(serverUrl);
          assert.equal(result.status, 200);
          const remaining = parseInt(result.headers['x-ratelimit-remaining']);
          assert.equal(remaining, 10 - (i + 1));
        }
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test('returns 0 remaining when limit is exhausted', (t, done) => {
    server = createTestServer(2, 60000);
    server.listen(0, async () => {
      const address = server!.address() as AddressInfo;
      serverUrl = `http://localhost:${address.port}/`;

      try {
        for (let i = 0; i < 2; i++) {
          await makeRequest(serverUrl);
        }

        const result = await makeRequest(serverUrl);
        assert.equal(result.status, 429);
        assert.equal(result.headers['x-ratelimit-remaining'], '0');
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
