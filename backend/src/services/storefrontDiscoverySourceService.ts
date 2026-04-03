import { ocmVerifiedStorefrontRecords } from '../../../src/data/ocmVerifiedStorefrontRecords.generated';
import type { StorefrontRecord } from '../../../src/types/storefrontRecord';
import { StorefrontDiscoverySourceKind } from './storefrontDiscoveryModels';

export const STOREFRONT_DISCOVERY_SOURCE_KIND: StorefrontDiscoverySourceKind = 'ocm_verified_seed';

type DiscoverySourceFilter = {
  marketId?: string | null;
  limit?: number | null;
};

type OcmVerificationRow = {
  displayName: string;
  legalName: string;
  addressLine1: string;
  city: string;
  state: 'NY';
  zip: string;
  website: string | null;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const OCM_VERIFICATION_URL = 'https://cannabis.ny.gov/dispensary-location-verification';
const DISCOVERY_SOURCE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const USER_AGENT = 'CanopyTroveStorefrontDiscovery/1.0';
const CENSUS_BENCHMARK = 'Public_AR_Current';
export const LIVE_DISCOVERY_PENDING_HOURS_LABEL = 'Verified store hours pending';
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
] as const;

const fallbackStorefrontRecords = ocmVerifiedStorefrontRecords
  .filter((record) => record.state.trim().toUpperCase() === 'NY')
  .slice()
  .sort((left, right) => left.displayName.localeCompare(right.displayName));

const fallbackByStrongKey = new Map<string, StorefrontRecord>();
const fallbackByNameZip = new Map<string, StorefrontRecord>();
const fallbackByAddressZip = new Map<string, StorefrontRecord>();

for (const record of fallbackStorefrontRecords) {
  fallbackByStrongKey.set(createStrongLookupKey(record.displayName, record.addressLine1, record.city, record.zip), record);
  fallbackByNameZip.set(createNameZipLookupKey(record.displayName, record.zip), record);
  fallbackByAddressZip.set(createAddressZipLookupKey(record.addressLine1, record.zip), record);
}

let discoverySourceCache:
  | {
      expiresAt: number;
      records: StorefrontRecord[];
      source: 'live' | 'seed';
    }
  | null = null;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMiles(origin: Coordinates, destination: Coordinates) {
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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeLookupValue(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\bu\.?\s*s\.?\b/g, 'us')
    .replace(/\bstate route\b/g, 'route')
    .replace(/\bstate hwy\b/g, 'highway')
    .replace(/\brt\b/g, 'route')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string) {
  return normalizeWhitespace(
    value
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;|&#34;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
  );
}

function stripTags(value: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function extractHref(cellHtml: string) {
  const match = cellHtml.match(/<a [^>]*href="([^"]+)"/i);
  return match ? decodeHtmlEntities(match[1]!).trim() : null;
}

function cleanStoreName(rawName: string) {
  const cleaned = normalizeWhitespace(rawName.replace(/\*+/g, '').replace(/\u00a0/g, ' '));
  return cleaned.replace(/\s+\(\s*dba\s+/i, ' (dba ').trim();
}

function createStrongLookupKey(displayName: string, addressLine1: string, city: string, zip: string) {
  return [
    normalizeLookupValue(displayName),
    normalizeLookupValue(addressLine1),
    normalizeLookupValue(city),
    normalizeLookupValue(zip),
  ].join('|');
}

function createNameZipLookupKey(displayName: string, zip: string) {
  return [normalizeLookupValue(displayName), normalizeLookupValue(zip)].join('|');
}

function createAddressZipLookupKey(addressLine1: string, zip: string) {
  return [normalizeLookupValue(addressLine1), normalizeLookupValue(zip)].join('|');
}

function isProductionLikeEnvironment() {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.STOREFRONT_DISCOVERY_SCHEDULER_ENABLED === 'true' ||
      process.env.NODE_ENV === 'production'
  );
}

function allowCheckedInSeedFallback() {
  return !isProductionLikeEnvironment();
}

function hasTrustedFallbackOperationalState(record: StorefrontRecord | null) {
  return Boolean(record?.hours?.length);
}

function buildStructuredGeocoderUrl(row: OcmVerificationRow) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/address');
  url.searchParams.set('street', row.addressLine1);
  url.searchParams.set('city', row.city);
  url.searchParams.set('state', row.state);
  url.searchParams.set('zip', row.zip);
  url.searchParams.set('benchmark', CENSUS_BENCHMARK);
  url.searchParams.set('format', 'json');
  return url;
}

function buildOneLineGeocoderUrl(row: OcmVerificationRow) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', `${row.addressLine1}, ${row.city}, ${row.state} ${row.zip}`);
  url.searchParams.set('benchmark', CENSUS_BENCHMARK);
  url.searchParams.set('format', 'json');
  return url;
}

function buildNominatimUrl(row: OcmVerificationRow) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', `${row.addressLine1}, ${row.city}, ${row.state} ${row.zip}`);
  return url;
}

function extractCensusCoordinates(payload: unknown): Coordinates | null {
  const addressMatches = (payload as { result?: { addressMatches?: Array<{ coordinates?: { x?: number; y?: number } }> } })?.result?.addressMatches;
  const coordinates = addressMatches?.[0]?.coordinates;
  if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
    return null;
  }

  return {
    latitude: coordinates.y,
    longitude: coordinates.x,
  };
}

async function geocodeRow(row: OcmVerificationRow): Promise<Coordinates | null> {
  try {
    const structuredResponse = await fetch(buildStructuredGeocoderUrl(row), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    if (structuredResponse.ok) {
      const structuredPayload = (await structuredResponse.json()) as unknown;
      const structuredCoordinates = extractCensusCoordinates(structuredPayload);
      if (structuredCoordinates) {
        return structuredCoordinates;
      }
    }
  } catch {
    // Fall through to the next geocoder.
  }

  try {
    const oneLineResponse = await fetch(buildOneLineGeocoderUrl(row), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    if (oneLineResponse.ok) {
      const oneLinePayload = (await oneLineResponse.json()) as unknown;
      const oneLineCoordinates = extractCensusCoordinates(oneLinePayload);
      if (oneLineCoordinates) {
        return oneLineCoordinates;
      }
    }
  } catch {
    // Fall through to the next geocoder.
  }

  try {
    const nominatimResponse = await fetch(buildNominatimUrl(row), {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    if (!nominatimResponse.ok) {
      return null;
    }

    const nominatimPayload = (await nominatimResponse.json()) as Array<{
      lat?: string;
      lon?: string;
    }>;
    const nominatimMatch = Array.isArray(nominatimPayload) ? nominatimPayload[0] : null;
    if (!nominatimMatch?.lat || !nominatimMatch?.lon) {
      return null;
    }

    const latitude = Number(nominatimMatch.lat);
    const longitude = Number(nominatimMatch.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}

function resolveMarketId(coordinates: Coordinates) {
  let closestMarketId = 'nyc';
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const marketArea of marketAreas) {
    const nextDistance = calculateDistanceMiles(marketArea.center, coordinates);
    if (nextDistance < closestDistance) {
      closestDistance = nextDistance;
      closestMarketId = marketArea.id;
    }
  }

  return closestMarketId;
}

async function fetchVerificationHtml() {
  const response = await fetch(OCM_VERIFICATION_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const text = await response.text();
  if (!response.ok || !text.includes('<table class="table">')) {
    throw new Error(`Storefront discovery source fetch failed with ${response.status}.`);
  }

  return text;
}

function parseVerificationRows(html: string) {
  const tableMatch = html.match(/<table class="table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tableMatch) {
    throw new Error('Could not find the OCM verification table body.');
  }

  const rows: OcmVerificationRow[] = [];
  const rowMatches = tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells = Array.from(rowMatch[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map(
      (cellMatch) => cellMatch[1]!
    );
    if (cells.length !== 5) {
      continue;
    }

    const rawName = stripTags(cells[0]!);
    const addressLine1 = stripTags(cells[1]!);
    const city = stripTags(cells[2]!);
    const zip = stripTags(cells[3]!);
    const websiteText = stripTags(cells[4]!);
    const websiteHref = extractHref(cells[4]!);
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
      state: 'NY',
      zip,
      website:
        websiteText && !/^website coming soon$/i.test(websiteText)
          ? websiteHref ?? `https://${websiteText.replace(/^https?:\/\//i, '')}`
          : null,
    });
  }

  return rows;
}

function findFallbackRecord(row: OcmVerificationRow) {
  return (
    fallbackByStrongKey.get(
      createStrongLookupKey(row.displayName, row.addressLine1, row.city, row.zip)
    ) ??
    fallbackByNameZip.get(createNameZipLookupKey(row.displayName, row.zip)) ??
    fallbackByAddressZip.get(createAddressZipLookupKey(row.addressLine1, row.zip)) ??
    null
  );
}

function buildLiveSourceRecord(
  row: OcmVerificationRow,
  fallbackRecord: StorefrontRecord | null,
  coordinates: Coordinates
): StorefrontRecord {
  const generatedStorefrontId =
    slugify(`${row.displayName}-${row.city}-${row.zip}`) || slugify(row.displayName);
  const storefrontId = fallbackRecord?.id ?? generatedStorefrontId;
  const marketId = fallbackRecord?.marketId ?? resolveMarketId(coordinates);
  const hasTrustedFallbackHours = hasTrustedFallbackOperationalState(fallbackRecord);

  return {
    id: storefrontId,
    licenseId: fallbackRecord?.licenseId ?? `ny-ocm-${storefrontId}`,
    marketId,
    displayName: row.displayName,
    legalName: row.legalName,
    addressLine1: row.addressLine1,
    city: row.city,
    state: row.state,
    zip: row.zip,
    coordinates,
    distanceMiles: fallbackRecord?.distanceMiles ?? 0,
    travelMinutes: fallbackRecord?.travelMinutes ?? 0,
    rating: fallbackRecord?.rating ?? 0,
    reviewCount: fallbackRecord?.reviewCount ?? 0,
    openNow: hasTrustedFallbackHours ? (fallbackRecord?.openNow ?? null) : null,
    isVerified: true,
    mapPreviewLabel:
      hasTrustedFallbackHours
        ? (fallbackRecord?.mapPreviewLabel ?? LIVE_DISCOVERY_PENDING_HOURS_LABEL)
        : LIVE_DISCOVERY_PENDING_HOURS_LABEL,
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    favoriteFollowerCount: fallbackRecord?.favoriteFollowerCount ?? null,
    menuUrl: fallbackRecord?.menuUrl ?? row.website,
    verifiedOwnerBadgeLabel: fallbackRecord?.verifiedOwnerBadgeLabel ?? null,
    ownerFeaturedBadges: fallbackRecord?.ownerFeaturedBadges ?? [],
    ownerCardSummary: fallbackRecord?.ownerCardSummary ?? null,
    premiumCardVariant: fallbackRecord?.premiumCardVariant ?? 'standard',
    promotionPlacementSurfaces: fallbackRecord?.promotionPlacementSurfaces ?? [],
    promotionPlacementScope: fallbackRecord?.promotionPlacementScope ?? null,
    placeId: fallbackRecord?.placeId,
    thumbnailUrl: fallbackRecord?.thumbnailUrl ?? null,
    phone: fallbackRecord?.phone ?? null,
    website: row.website ?? fallbackRecord?.website ?? null,
    hours: hasTrustedFallbackHours ? (fallbackRecord?.hours ?? []) : [],
    appReviewCount: fallbackRecord?.appReviewCount ?? 0,
    appReviews: fallbackRecord?.appReviews ?? [],
    photoUrls: fallbackRecord?.photoUrls ?? [],
    amenities: fallbackRecord?.amenities ?? [],
    editorialSummary:
      fallbackRecord?.editorialSummary ?? 'Tracked from the New York OCM verified dispensary feed.',
    routeMode: fallbackRecord?.routeMode ?? 'verified',
  };
}

async function buildLiveSourceRecords() {
  const html = await fetchVerificationHtml();
  const rows = parseVerificationRows(html);
  const nextRecords = new Map<string, StorefrontRecord>();

  for (const row of rows) {
    const fallbackRecord = findFallbackRecord(row);
    const coordinates = (await geocodeRow(row)) ?? fallbackRecord?.coordinates;
    if (!coordinates) {
      continue;
    }

    const nextRecord = buildLiveSourceRecord(row, fallbackRecord, coordinates);
    nextRecords.set(nextRecord.id, nextRecord);
  }

  return Array.from(nextRecords.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
}

async function loadStorefrontDiscoverySourceRecords() {
  if (discoverySourceCache && discoverySourceCache.expiresAt > Date.now()) {
    return discoverySourceCache.records;
  }

  try {
    const liveRecords = await buildLiveSourceRecords();
    if (liveRecords.length > 0) {
      discoverySourceCache = {
        expiresAt: Date.now() + DISCOVERY_SOURCE_CACHE_TTL_MS,
        records: liveRecords,
        source: 'live',
      };
      return liveRecords;
    }
    throw new Error('Storefront discovery source fetch returned no live verified storefront records.');
  } catch (error) {
    if (!allowCheckedInSeedFallback()) {
      if (discoverySourceCache?.source === 'live') {
        return discoverySourceCache.records;
      }

      throw error;
    }
  }

  discoverySourceCache = {
    expiresAt: Date.now() + DISCOVERY_SOURCE_CACHE_TTL_MS,
    records: fallbackStorefrontRecords,
    source: 'seed',
  };
  return fallbackStorefrontRecords;
}

export function clearStorefrontDiscoverySourceCacheForTests() {
  discoverySourceCache = null;
}

export async function listStorefrontDiscoverySources(filter: DiscoverySourceFilter = {}) {
  const marketId = filter.marketId?.trim().toLowerCase() || null;
  const limit =
    typeof filter.limit === 'number' && Number.isFinite(filter.limit)
      ? Math.max(0, Math.floor(filter.limit))
      : null;

  const records = (await loadStorefrontDiscoverySourceRecords())
    .filter((record) => record.state.trim().toUpperCase() === 'NY')
    .filter((record) => {
      if (!marketId) {
        return true;
      }

      return record.marketId.trim().toLowerCase() === marketId;
    });

  if (limit === null) {
    return records;
  }

  return records.slice(0, limit);
}

export async function getStorefrontDiscoverySourceCount(filter: DiscoverySourceFilter = {}) {
  return (await listStorefrontDiscoverySources(filter)).length;
}
