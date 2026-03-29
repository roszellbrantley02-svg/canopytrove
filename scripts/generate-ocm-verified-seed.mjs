import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const workspaceRoot = path.resolve(process.cwd());
const targetPath = path.join(
  workspaceRoot,
  'src',
  'data',
  'ocmVerifiedStorefrontRecords.generated.ts'
);

const OCM_VERIFICATION_URL = 'https://cannabis.ny.gov/dispensary-location-verification';
const BUY_LEGAL_AUTOCOMPLETE_URL = 'https://buylegal.cannabis.ny.gov/api/map/search/autoComplete';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const GEOCODER_CONCURRENCY = 8;
const CENSUS_BENCHMARK = 'Public_AR_Current';
const BUY_LEGAL_RADIUS_MILES = 100;

const marketAreas = [
  { id: 'central-ny', center: { latitude: 43.2207, longitude: -76.8158 } },
  { id: 'finger-lakes', center: { latitude: 42.9101, longitude: -76.7966 } },
  { id: 'rochester', center: { latitude: 43.1566, longitude: -77.6088 } },
  { id: 'western-ny', center: { latitude: 42.8864, longitude: -78.8784 } },
  { id: 'capital-region', center: { latitude: 42.6526, longitude: -73.7562 } },
  { id: 'hudson-valley', center: { latitude: 41.7004, longitude: -73.921 } },
  { id: 'nyc', center: { latitude: 40.7128, longitude: -74.006 } },
  { id: 'long-island', center: { latitude: 40.7891, longitude: -73.135 } },
  { id: 'southern-tier', center: { latitude: 42.0987, longitude: -75.9179 } },
  { id: 'north-country', center: { latitude: 43.9748, longitude: -75.9108 } },
];

const htmlEntityMap = new Map([
  ['&nbsp;', ' '],
  ['&#160;', ' '],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&#34;', '"'],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&lt;', '<'],
  ['&gt;', '>'],
]);

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMiles(origin, destination) {
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const latitudeA = toRadians(origin.latitude);
  const latitudeB = toRadians(destination.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  const namedDecoded = Array.from(htmlEntityMap.entries()).reduce(
    (current, [entity, replacement]) => current.replaceAll(entity, replacement),
    value
  );

  return namedDecoded
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    );
}

function stripTags(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function normalizeMatchText(value) {
  return value
    .toLowerCase()
    .replace(/\bu\.?\s*s\.?\b/g, 'us')
    .replace(/\bstate route\b/g, ' ')
    .replace(/\bstate highway\b/g, ' ')
    .replace(/\bhighway\b/g, ' ')
    .replace(/\broute\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchVerificationHtmlWithFetch() {
  const response = await fetch(OCM_VERIFICATION_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const text = await response.text();
  if (!response.ok || !text.includes('<table class="table">')) {
    throw new Error(`Fetch returned ${response.status} without the verification table.`);
  }

  return text;
}

function fetchVerificationHtmlWithCurl() {
  const text = execFileSync(
    'curl.exe',
    ['-sS', '-L', '-A', USER_AGENT, OCM_VERIFICATION_URL],
    {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  if (!text.includes('<table class="table">')) {
    throw new Error('curl did not return the OCM verification table.');
  }

  return text;
}

async function fetchVerificationHtml() {
  try {
    return await fetchVerificationHtmlWithFetch();
  } catch {
    return fetchVerificationHtmlWithCurl();
  }
}

function extractTableBody(html) {
  const match = html.match(/<table class="table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!match) {
    throw new Error('Could not find the OCM verification table body.');
  }

  return match[1];
}

function extractHref(cellHtml) {
  const match = cellHtml.match(/<a [^>]*href="([^"]+)"/i);
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function cleanStoreName(rawName) {
  const cleaned = normalizeWhitespace(rawName.replace(/\*+/g, '').replace(/\u00a0/g, ' '));
  return cleaned.replace(/\s+\(\s*dba\s+/i, ' (dba ').trim();
}

function parseVerificationRows(tableBodyHtml) {
  const rows = [];
  const rowMatches = tableBodyHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const cells = Array.from(rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map(
      (cellMatch) => cellMatch[1]
    );

    if (cells.length !== 5) {
      continue;
    }

    const rawName = stripTags(cells[0]);
    const addressLine1 = stripTags(cells[1]);
    const city = stripTags(cells[2]);
    const zip = stripTags(cells[3]);
    const websiteText = stripTags(cells[4]);
    const websiteHref = extractHref(cells[4]);

    const isTemporaryDeliveryOnly = /\*{3}/.test(rawName) || addressLine1 === '-' || zip === '-';
    if (isTemporaryDeliveryOnly) {
      continue;
    }

    const displayName = cleanStoreName(rawName);
    if (!displayName || !addressLine1 || !city || !zip) {
      continue;
    }

    rows.push({
      displayName,
      legalName: displayName,
      addressLine1,
      city,
      zip,
      website:
        websiteText && !/^website coming soon$/i.test(websiteText)
          ? websiteHref ?? `https://${websiteText.replace(/^https?:\/\//i, '')}`
          : null,
      isMicrobusiness: /\*{2}/.test(rawName),
    });
  }

  return rows;
}

function buildStructuredGeocoderUrl(row) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/address');
  url.searchParams.set('street', row.addressLine1);
  url.searchParams.set('city', row.city);
  url.searchParams.set('state', 'NY');
  url.searchParams.set('zip', row.zip);
  url.searchParams.set('benchmark', CENSUS_BENCHMARK);
  url.searchParams.set('format', 'json');
  return url;
}

function buildOneLineGeocoderUrl(row) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', `${row.addressLine1}, ${row.city}, NY ${row.zip}`);
  url.searchParams.set('benchmark', CENSUS_BENCHMARK);
  url.searchParams.set('format', 'json');
  return url;
}

function buildNominatimUrl(row) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', `${row.addressLine1}, ${row.city}, NY ${row.zip}`);
  return url;
}

function buildBuyLegalAutocompleteUrl(searchText, center) {
  const url = new URL(BUY_LEGAL_AUTOCOMPLETE_URL);
  url.searchParams.set('searchText', searchText);
  url.searchParams.set('radius', String(BUY_LEGAL_RADIUS_MILES));
  url.searchParams.set('latitude', String(center.latitude));
  url.searchParams.set('longitude', String(center.longitude));
  return url;
}

function extractCensusCoordinates(payload) {
  const match = payload?.result?.addressMatches?.[0];
  if (!match?.coordinates) {
    return null;
  }

  return {
    latitude: Number(match.coordinates.y),
    longitude: Number(match.coordinates.x),
  };
}

async function geocodeRow(row) {
  const structuredResponse = await fetch(buildStructuredGeocoderUrl(row));
  if (structuredResponse.ok) {
    const structuredPayload = await structuredResponse.json();
    const structuredCoordinates = extractCensusCoordinates(structuredPayload);
    if (structuredCoordinates) {
      return structuredCoordinates;
    }
  }

  const oneLineResponse = await fetch(buildOneLineGeocoderUrl(row));
  if (oneLineResponse.ok) {
    const oneLinePayload = await oneLineResponse.json();
    const oneLineCoordinates = extractCensusCoordinates(oneLinePayload);
    if (oneLineCoordinates) {
      return oneLineCoordinates;
    }
  }

  const buyLegalCoordinates = await geocodeWithBuyLegalAutocomplete(row);
  if (buyLegalCoordinates) {
    return buyLegalCoordinates;
  }

  const nominatimResponse = await fetch(buildNominatimUrl(row), {
    headers: {
      'User-Agent': 'CanopyTroveOCMSeed/1.0',
    },
  });

  if (!nominatimResponse.ok) {
    return null;
  }

  const nominatimPayload = await nominatimResponse.json();
  const nominatimMatch = Array.isArray(nominatimPayload) ? nominatimPayload[0] : null;
  if (!nominatimMatch?.lat || !nominatimMatch?.lon) {
    return null;
  }

  return {
    latitude: Number(nominatimMatch.lat),
    longitude: Number(nominatimMatch.lon),
  };
}

function isPlausibleBuyLegalMatch(match, row) {
  const haystack = normalizeMatchText([match.display, match.value].filter(Boolean).join(' '));
  const normalizedName = normalizeMatchText(row.displayName);
  const normalizedAddress = normalizeMatchText(row.addressLine1);
  const normalizedCity = normalizeMatchText(row.city);

  if (match.type === 'business') {
    return haystack.includes(normalizedName) || haystack.includes(normalizedAddress);
  }

  const cityOrZipMatches = haystack.includes(normalizedCity) || haystack.includes(row.zip);
  if (!cityOrZipMatches) {
    return false;
  }

  return haystack.includes(normalizedAddress);
}

async function geocodeWithBuyLegalAutocomplete(row) {
  const searchTerms = [
    row.displayName,
    row.addressLine1,
    `${row.addressLine1}, ${row.city}`,
    `${row.addressLine1}, ${row.city}, NY ${row.zip}`,
  ];

  for (const center of marketAreas.map((area) => area.center)) {
    for (const searchText of searchTerms) {
      const response = await fetch(buildBuyLegalAutocompleteUrl(searchText, center), {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        continue;
      }

      const match = payload.find((item) => isPlausibleBuyLegalMatch(item, row));
      if (match?.latitude && match?.longitude) {
        return {
          latitude: Number(match.latitude),
          longitude: Number(match.longitude),
        };
      }
    }
  }

  return null;
}

async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(GEOCODER_CONCURRENCY, items.length) }, () => runWorker())
  );

  return results;
}

function getNearestMarketId(latitude, longitude) {
  const coordinates = { latitude, longitude };
  let nearestArea = marketAreas[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const area of marketAreas) {
    const currentDistance = calculateDistanceMiles(area.center, coordinates);
    if (currentDistance < nearestDistance) {
      nearestArea = area;
      nearestDistance = currentDistance;
    }
  }

  return nearestArea.id;
}

function createSeedKey(record) {
  const normalize = (value) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ');

  return [record.addressLine1, record.city, record.zip].map(normalize).join('|');
}

function toStorefrontRecord(row, coordinates) {
  const normalizedName = slugify(`${row.zip}-${row.city}-${row.displayName}`);
  return {
    id: `ocm-${normalizedName}`,
    licenseId: `OCM-VERIFY-${normalizedName}`.toUpperCase(),
    marketId: getNearestMarketId(coordinates.latitude, coordinates.longitude),
    displayName: row.displayName,
    legalName: row.legalName,
    addressLine1: row.addressLine1,
    city: row.city,
    state: 'NY',
    zip: row.zip,
    coordinates,
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 0,
    reviewCount: 0,
    openNow: false,
    isVerified: true,
    mapPreviewLabel: 'Verified OCM storefront',
    thumbnailUrl: null,
    phone: null,
    website: row.website,
    hours: ['Hours not published yet'],
    appReviewCount: 0,
    appReviews: [],
    photoUrls: [],
    amenities: row.isMicrobusiness ? ['State licensed', 'Microbusiness retail'] : ['State licensed'],
    editorialSummary:
      'Verified adult-use storefront from the New York OCM public dispensary verification list.',
    routeMode: 'verified',
  };
}

const html = await fetchVerificationHtml();
const tableBodyHtml = extractTableBody(html);
const parsedRows = parseVerificationRows(tableBodyHtml);

const uniqueRows = Array.from(
  new Map(parsedRows.map((row) => [createSeedKey(row), row])).values()
);

const geocodedRows = await mapWithConcurrency(uniqueRows, async (row, index) => {
  const coordinates = await geocodeRow(row);
  if (!coordinates) {
    console.warn(
      `[ocm-seed] unresolved ${index + 1}/${uniqueRows.length}: ${row.displayName} | ${row.addressLine1}, ${row.city}, NY ${row.zip}`
    );
    return null;
  }

  return toStorefrontRecord(row, coordinates);
});

const storefrontRecords = geocodedRows
  .filter(Boolean)
  .sort((left, right) => left.displayName.localeCompare(right.displayName));

const output = `import { StorefrontRecord } from '../types/storefrontRecord';

// Generated by scripts/generate-ocm-verified-seed.mjs from the NY OCM dispensary verification page.
// Do not hand-edit this file.
export const ocmVerifiedStorefrontRecords: StorefrontRecord[] = ${JSON.stringify(storefrontRecords, null, 2)};
`;

fs.writeFileSync(targetPath, output);

console.log(
  `Generated ${storefrontRecords.length} OCM verified storefront records from ${uniqueRows.length} routable verification rows.`
);
