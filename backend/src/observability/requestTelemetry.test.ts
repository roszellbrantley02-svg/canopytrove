import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const sentryModulePath = require.resolve('@sentry/node');
const configModulePath = require.resolve('../config');
const sourcesModulePath = require.resolve('../sources');
const loggerModulePath = require.resolve('./logger');
const requestTelemetryModulePath = require.resolve('./requestTelemetry');

const originalModuleEntries = new Map(
  [
    sentryModulePath,
    configModulePath,
    sourcesModulePath,
    loggerModulePath,
    requestTelemetryModulePath,
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
  delete require.cache[requestTelemetryModulePath];

  for (const [modulePath, cachedModule] of originalModuleEntries.entries()) {
    if (cachedModule) {
      require.cache[modulePath] = cachedModule;
      continue;
    }

    delete require.cache[modulePath];
  }
});

test('requestTelemetryMiddleware sets request headers and tags Sentry with the request id', () => {
  const setTagCalls: Array<{ key: string; value: string }> = [];
  const logCalls: Array<{ message: string; payload: Record<string, unknown> }> = [];

  setCachedModule(sentryModulePath, {
    setTag(key: string, value: string) {
      setTagCalls.push({ key, value });
    },
  });

  setCachedModule(configModulePath, {
    serverConfig: {
      requestLoggingEnabled: true,
    },
  });

  setCachedModule(sourcesModulePath, {
    backendStorefrontSourceStatus: {
      activeMode: 'mock',
    },
  });

  setCachedModule(loggerModulePath, {
    logger: {
      info(message: string, payload: Record<string, unknown>) {
        logCalls.push({ message, payload });
      },
    },
  });

  delete require.cache[requestTelemetryModulePath];
  const { requestTelemetryMiddleware } =
    require('./requestTelemetry') as typeof import('./requestTelemetry');

  const headers = new Map<string, string>();
  let finishHandler: (() => void) | null = null;
  let endCalled = false;
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    once(event: string, handler: () => void) {
      if (event === 'finish') {
        finishHandler = handler;
      }
    },
    end() {
      endCalled = true;
    },
  };

  requestTelemetryMiddleware(
    {
      method: 'GET',
      originalUrl: '/health',
      ip: '127.0.0.1',
      header(name: string) {
        if (name === 'X-Correlation-ID') {
          return 'corr-123';
        }

        return undefined;
      },
    } as never,
    response as never,
    () => {},
  );

  const requestId = headers.get('X-CanopyTrove-Request-Id');
  assert.ok(requestId);
  assert.equal(headers.get('X-Correlation-ID'), 'corr-123');
  assert.deepEqual(setTagCalls, [{ key: 'requestId', value: requestId! }]);

  response.end();
  const capturedFinishHandler = finishHandler as unknown as (() => void) | null;
  if (typeof capturedFinishHandler === 'function') {
    capturedFinishHandler();
  }

  assert.equal(endCalled, true);
  assert.ok(headers.get('X-CanopyTrove-Response-Time-Ms'));
  assert.equal(logCalls.length, 1);
  assert.equal(logCalls[0]?.message, 'http_request');
  assert.equal(logCalls[0]?.payload.requestId, requestId);
  assert.equal(logCalls[0]?.payload.correlationId, 'corr-123');
});
