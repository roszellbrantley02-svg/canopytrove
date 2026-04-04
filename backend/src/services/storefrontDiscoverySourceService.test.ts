import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = [
  'K_SERVICE',
  'CLOUD_RUN_JOB',
  'STOREFRONT_DISCOVERY_SCHEDULER_ENABLED',
  'NODE_ENV',
] as const;

type DiscoverySourceServiceModule = typeof import('./storefrontDiscoverySourceService');

async function loadService(): Promise<DiscoverySourceServiceModule> {
  return import(`./storefrontDiscoverySourceService?test=${Date.now()}-${Math.random()}`);
}

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(async () => {
  clearEnv();
  globalThis.fetch = ORIGINAL_FETCH;
  const { clearStorefrontDiscoverySourceCacheForTests } = await loadService();
  clearStorefrontDiscoverySourceCacheForTests();
});

test('falls back to checked-in seed records outside production when the live OCM fetch fails', async () => {
  globalThis.fetch = (async () => {
    throw new Error('live discovery unavailable');
  }) as typeof fetch;

  const { listStorefrontDiscoverySources } = await loadService();
  const records = await listStorefrontDiscoverySources({ limit: 2 });

  assert.equal(records.length, 2);
  assert.ok(records.every((record) => record.state === 'NY'));
});

test('does not fall back to checked-in seed records in production when the live OCM fetch fails', async () => {
  process.env.K_SERVICE = 'canopytrove-api';
  globalThis.fetch = (async () => {
    throw new Error('live discovery unavailable');
  }) as typeof fetch;

  const { listStorefrontDiscoverySources } = await loadService();

  await assert.rejects(
    () => listStorefrontDiscoverySources({ limit: 1 }),
    /live discovery unavailable/,
  );
});

test('marks unmatched live OCM rows as hours-pending instead of defaulting them closed', async () => {
  globalThis.fetch = (async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.startsWith('https://cannabis.ny.gov/dispensary-location-verification')) {
      return new Response(
        `
          <table class="table">
            <tbody>
              <tr>
                <td>Fresh Leaf Discovery</td>
                <td>999 Discovery Ave</td>
                <td>Testville</td>
                <td>10101</td>
                <td><a href="https://freshleaf.example">freshleaf.example</a></td>
              </tr>
            </tbody>
          </table>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        },
      );
    }

    if (url.startsWith('https://geocoding.geo.census.gov/geocoder/locations/address')) {
      return new Response(
        JSON.stringify({
          result: {
            addressMatches: [
              {
                coordinates: {
                  x: -73.994,
                  y: 40.728,
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    throw new Error(`Unexpected fetch URL in discovery source test: ${url}`);
  }) as typeof fetch;

  const { LIVE_DISCOVERY_PENDING_HOURS_LABEL, listStorefrontDiscoverySources } =
    await loadService();
  const records = await listStorefrontDiscoverySources({ limit: 1 });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.displayName, 'Fresh Leaf Discovery');
  assert.equal(records[0]?.openNow, null);
  assert.equal(records[0]?.mapPreviewLabel, LIVE_DISCOVERY_PENDING_HOURS_LABEL);
  assert.deepEqual(records[0]?.hours, []);
});
