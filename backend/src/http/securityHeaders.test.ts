import assert from 'node:assert/strict';
import { test } from 'node:test';
import { securityHeadersMiddleware } from './securityHeaders';

function createMockResponse() {
  const headers = new Map<string, string>();

  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };
}

test('securityHeadersMiddleware sets same-origin cross-origin resource policy', () => {
  const response = createMockResponse();
  let nextCalled = false;

  securityHeadersMiddleware(
    {
      hostname: 'api.canopytrove.example',
    } as never,
    response as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(
    response.headers.get('Strict-Transport-Security'),
    'max-age=31536000; includeSubDomains; preload',
  );
  assert.equal(nextCalled, true);
});

test('securityHeadersMiddleware skips HSTS for localhost', () => {
  const response = createMockResponse();

  securityHeadersMiddleware(
    {
      hostname: 'localhost',
    } as never,
    response as never,
    () => {},
  );

  assert.equal(response.headers.has('Strict-Transport-Security'), false);
});
