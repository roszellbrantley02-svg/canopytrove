import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import path from 'node:path';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_DATE_NOW = Date.now;

async function loadGooglePlacesModules() {
  const servicesRoot = `${path.resolve(__dirname)}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(`${servicesRoot}googlePlaces`)) {
      delete require.cache[modulePath];
    }
  }

  const [client, shared] = await Promise.all([
    import('./googlePlacesClient'),
    import('./googlePlacesShared'),
  ]);
  return {
    ...client,
    ...shared,
  };
}

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-google-maps-key';
});

afterEach(() => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  globalThis.fetch = ORIGINAL_FETCH;
  Date.now = ORIGINAL_DATE_NOW;
});

test('requestGoogleJson does not send the Google Maps key to non-Google hosts', async () => {
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('fetch should not run for non-Google hosts');
  }) as typeof fetch;

  const { requestGoogleJson } = await loadGooglePlacesModules();
  const result = await requestGoogleJson(
    'https://example.com/places',
    {
      method: 'GET',
    },
    '*',
  );

  assert.equal(result, null);
  assert.equal(fetchCalled, false);
});

test('requestGoogleJson includes auth headers only for Google Places URLs', async () => {
  const receivedHeaders: Record<string, string | null> = {
    apiKey: null,
    fieldMask: null,
    customHeader: null,
  };
  globalThis.fetch = (async (_url, init) => {
    const headers = new Headers(init?.headers);
    receivedHeaders.apiKey = headers.get('X-Goog-Api-Key');
    receivedHeaders.fieldMask = headers.get('X-Goog-FieldMask');
    receivedHeaders.customHeader = headers.get('X-Custom-Header');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }) as typeof fetch;

  const { requestGoogleJson } = await loadGooglePlacesModules();
  const result = await requestGoogleJson(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'X-Custom-Header': 'present',
      },
    },
    'places.id',
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(receivedHeaders, {
    apiKey: 'test-google-maps-key',
    fieldMask: 'places.id',
    customHeader: 'present',
  });
});

test('requestGoogleJson keeps Google Places available after a 400 response', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'bad request' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

  const { hasGooglePlacesConfig, requestGoogleJson } = await loadGooglePlacesModules();
  const result = await requestGoogleJson(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
    },
    'places.id',
  );

  assert.equal(result, null);
  assert.equal(hasGooglePlacesConfig(), true);
});

test('requestGoogleJson temporarily degrades Google Places after a 403 and recovers automatically', async () => {
  let now = 1_000;
  Date.now = () => now;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

  const { getGooglePlacesRuntimeStateForTests, hasGooglePlacesConfig, requestGoogleJson } =
    await loadGooglePlacesModules();
  const result = await requestGoogleJson(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
    },
    'places.id',
  );

  assert.equal(result, null);
  assert.equal(hasGooglePlacesConfig(), false);
  const runtimeState = getGooglePlacesRuntimeStateForTests();
  assert.equal(runtimeState.lastFailureStatus, 403);
  assert.ok(runtimeState.degradedUntilMs > now);

  now = runtimeState.degradedUntilMs + 1;
  assert.equal(hasGooglePlacesConfig(), true);
});
