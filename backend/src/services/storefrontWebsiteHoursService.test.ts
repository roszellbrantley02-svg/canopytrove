import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { StorefrontRecord } from '../../../src/types/storefrontRecord';

let clearWebsiteHoursCacheForTests: typeof import('./storefrontWebsiteHoursService').clearWebsiteHoursCacheForTests;
let resolveWebsiteHoursFallback: typeof import('./storefrontWebsiteHoursService').resolveWebsiteHoursFallback;

const originalFetch = globalThis.fetch;

function createSourceRecord(website: string): StorefrontRecord {
  return {
    id: 'store-1',
    licenseId: 'license-1',
    marketId: 'nyc',
    displayName: 'Store',
    legalName: 'Store',
    addressLine1: '1 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 0,
    reviewCount: 0,
    openNow: null,
    isVerified: true,
    mapPreviewLabel: 'Verified OCM storefront',
    thumbnailUrl: null,
    phone: null,
    website,
    hours: ['Hours not published yet'],
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [],
    amenities: [],
    editorialSummary: null,
    routeMode: 'verified',
  };
}

beforeEach(async () => {
  ({ clearWebsiteHoursCacheForTests, resolveWebsiteHoursFallback } =
    await import('./storefrontWebsiteHoursService'));
  clearWebsiteHoursCacheForTests();
});

afterEach(() => {
  clearWebsiteHoursCacheForTests();
  globalThis.fetch = originalFetch;
});

test('extracts in-store hours from website html and ignores drive-thru hours', async () => {
  globalThis.fetch = (async () =>
    new Response(
      `
      <html>
        <body>
          <h2>In-store hours</h2>
          <p>Monday: 10 a.m. - 9 p.m.<br />Tuesday: 10 a.m. - 9 p.m.<br />Wednesday: 10 a.m. - 9 p.m.<br />Thursday: 10 a.m. - 10 p.m.<br />Friday: 10 a.m. - 10 p.m.<br />Saturday: 10 a.m. - 10 p.m.<br />Sunday: 11 a.m. - 8 p.m.</p>
          <h2>Drive-thru hours</h2>
          <p>Monday: 10 a.m. - 8 p.m.<br />Tuesday: 10 a.m. - 8 p.m.</p>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      },
    )) as typeof fetch;

  const result = await resolveWebsiteHoursFallback(createSourceRecord('https://example.com'), null);
  assert.ok(result);
  assert.deepEqual(result.hours, [
    'Monday: 10:00 AM - 9:00 PM',
    'Tuesday: 10:00 AM - 9:00 PM',
    'Wednesday: 10:00 AM - 9:00 PM',
    'Thursday: 10:00 AM - 10:00 PM',
    'Friday: 10:00 AM - 10:00 PM',
    'Saturday: 10:00 AM - 10:00 PM',
    'Sunday: 11:00 AM - 8:00 PM',
  ]);
  assert.equal(result.hoursSource, 'website');
});

test('expands day-range website hours blocks into per-day display strings', async () => {
  globalThis.fetch = (async () =>
    new Response(
      `
      <html>
        <body>
          <h2>Store Hours</h2>
          <p>Friday/Saturday: 10am - 10pm</p>
          <p>Sunday - Thursday: 10am - 9pm</p>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      },
    )) as typeof fetch;

  const result = await resolveWebsiteHoursFallback(createSourceRecord('https://example.com'), {
    phone: null,
    website: 'https://example.com',
    hours: [],
    openNow: true,
    hoursSource: 'google',
    businessStatus: 'OPERATIONAL',
    location: null,
  });
  assert.ok(result);
  assert.equal(result.openNow, true);
  assert.deepEqual(result.hours, [
    'Monday: 10:00 AM - 9:00 PM',
    'Tuesday: 10:00 AM - 9:00 PM',
    'Wednesday: 10:00 AM - 9:00 PM',
    'Thursday: 10:00 AM - 9:00 PM',
    'Friday: 10:00 AM - 10:00 PM',
    'Saturday: 10:00 AM - 10:00 PM',
    'Sunday: 10:00 AM - 9:00 PM',
  ]);
});

test('returns existing google hours unchanged when they are already present', async () => {
  let fetchCount = 0;
  globalThis.fetch = (async (..._args: Parameters<typeof fetch>) => {
    fetchCount += 1;
    return new Response('', { status: 500 });
  }) as typeof fetch;

  const googleEnrichment = {
    phone: null,
    website: 'https://example.com',
    hours: ['Monday: 9:00 AM - 9:00 PM'],
    openNow: false,
    hoursSource: 'google' as const,
    businessStatus: 'OPERATIONAL',
    location: null,
  };

  const result = await resolveWebsiteHoursFallback(
    createSourceRecord('https://example.com'),
    googleEnrichment,
  );
  assert.equal(result, googleEnrichment);
  assert.equal(fetchCount, 0);
});

test('uses confirmed official website hour overrides before fetching the website', async () => {
  let fetchCount = 0;
  globalThis.fetch = (async (..._args: Parameters<typeof fetch>) => {
    fetchCount += 1;
    return new Response('', { status: 500 });
  }) as typeof fetch;

  const result = await resolveWebsiteHoursFallback(
    {
      ...createSourceRecord('https://www.thetravelagency.co'),
      id: 'ocm-11217-brooklyn-the-travel-agency-downtown-brooklyn',
      displayName: 'The Travel Agency Downtown Brooklyn',
      legalName: 'The Travel Agency Downtown Brooklyn',
    },
    null,
  );

  assert.ok(result);
  assert.equal(
    result.website,
    'https://www.thetravelagency.co/dispensaries/downtown-brooklyn-new-york/',
  );
  assert.deepEqual(result.hours, [
    'Monday: 9:00 AM - 11:00 PM',
    'Tuesday: 9:00 AM - 11:00 PM',
    'Wednesday: 9:00 AM - 11:00 PM',
    'Thursday: 9:00 AM - 11:00 PM',
    'Friday: 9:00 AM - 12:00 AM',
    'Saturday: 9:00 AM - 12:00 AM',
    'Sunday: 9:00 AM - 11:00 PM',
  ]);
  assert.equal(result.hoursSource, 'website');
  assert.equal(fetchCount, 0);
});
