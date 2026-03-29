import { StorefrontDetails, StorefrontSummary } from '../types/storefront';
import { hasPublishedStorefrontHours, normalizeStorefrontHours } from '../utils/storefrontHours';

type GoogleSearchPlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
};

type GooglePlaceDetailResponse = {
  id?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
  };
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
};

export type StorefrontOperationalEnrichment = {
  phone: string | null;
  website: string | null;
  hours: string[];
  openNow: boolean | null;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null;
const PLACE_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DETAIL_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 2_000;

let googlePlacesConfigEnabled = Boolean(GOOGLE_MAPS_API_KEY);

const placeIdCache = new Map<string, CacheEntry<string | null>>();
const placeIdInFlight = new Map<string, Promise<string | null>>();
const operationalCache = new Map<string, CacheEntry<StorefrontOperationalEnrichment | null>>();
const operationalInFlight = new Map<string, Promise<StorefrontOperationalEnrichment | null>>();

function hasFreshValue<T>(entry?: CacheEntry<T>) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

async function resolveCached<T>(
  key: string,
  cache: Map<string, CacheEntry<T>>,
  inFlight: Map<string, Promise<T>>,
  ttlMs: number,
  loader: () => Promise<T>
) {
  const cached = cache.get(key);
  if (hasFreshValue(cached)) {
    return cached!.value;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const next = loader()
    .then((value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      inFlight.delete(key);
      return value;
    })
    .catch((error) => {
      inFlight.delete(key);
      throw error;
    });

  inFlight.set(key, next);
  return next;
}

function disableGooglePlacesConfig() {
  googlePlacesConfigEnabled = false;
}

function normalizeHours(value: string[] | undefined) {
  return normalizeStorefrontHours(value);
}

function normalizeDetailString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function requestGoogleJson<T>(
  url: string,
  init: RequestInit,
  fieldMask: string
): Promise<T | null> {
  if (!GOOGLE_MAPS_API_KEY || !googlePlacesConfigEnabled) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Goog-Api-Key', GOOGLE_MAPS_API_KEY);
    headers.set('X-Goog-FieldMask', fieldMask);

    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        disableGooglePlacesConfig();
      }
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeMatchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/\bu\.?\s*s\.?\b/g, 'us')
    .replace(/\bstate route\b/g, 'route')
    .replace(/\bstate rt\b/g, 'route')
    .replace(/\bstate hwy\b/g, 'highway')
    .replace(/\brt\b/g, 'route')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createSearchQueries(summary: StorefrontSummary) {
  return [
    `${summary.displayName} ${summary.addressLine1}, ${summary.city}, NY ${summary.zip}`,
    `${summary.displayName} ${summary.city}, NY`,
    `${summary.addressLine1}, ${summary.city}, NY ${summary.zip}`,
  ];
}

function isPlausiblePlaceMatch(candidate: GoogleSearchPlace, summary: StorefrontSummary) {
  const normalizedName = normalizeMatchValue(summary.displayName);
  const normalizedAddress = normalizeMatchValue(summary.addressLine1);
  const normalizedCity = normalizeMatchValue(summary.city);
  const normalizedDisplay = normalizeMatchValue(candidate.displayName?.text ?? '');
  const normalizedFormattedAddress = normalizeMatchValue(candidate.formattedAddress ?? '');

  const nameMatches =
    normalizedDisplay.includes(normalizedName) ||
    normalizedName.includes(normalizedDisplay) ||
    normalizedFormattedAddress.includes(normalizedName);
  const addressMatches =
    normalizedFormattedAddress.includes(normalizedAddress) ||
    normalizedAddress
      .split(' ')
      .filter((token) => token.length > 3)
      .every((token) => normalizedFormattedAddress.includes(token));
  const cityMatches =
    normalizedFormattedAddress.includes(normalizedCity) ||
    normalizedFormattedAddress.includes(summary.zip.toLowerCase());

  return cityMatches && (addressMatches || nameMatches);
}

async function matchPlaceId(summary: StorefrontSummary) {
  if (!GOOGLE_MAPS_API_KEY || !googlePlacesConfigEnabled) {
    return null;
  }

  if (summary.placeId?.trim()) {
    return summary.placeId.trim();
  }

  return resolveCached(
    summary.id,
    placeIdCache,
    placeIdInFlight,
    PLACE_ID_TTL_MS,
    async () => {
      for (const query of createSearchQueries(summary)) {
        const payload = await requestGoogleJson<{ places?: GoogleSearchPlace[] }>(
          'https://places.googleapis.com/v1/places:searchText',
          {
            method: 'POST',
            body: JSON.stringify({
              textQuery: query,
              pageSize: 5,
              languageCode: 'en',
              regionCode: 'US',
              locationBias: {
                circle: {
                  center: {
                    latitude: summary.coordinates.latitude,
                    longitude: summary.coordinates.longitude,
                  },
                  radius: 10000,
                },
              },
            }),
          },
          'places.id,places.displayName,places.formattedAddress'
        );

        const match = payload?.places?.find((candidate) => isPlausiblePlaceMatch(candidate, summary));
        if (match?.id) {
          return match.id;
        }
      }

      return null;
    }
  );
}

async function loadPlaceDetail(placeId: string) {
  return resolveCached(
    placeId,
    operationalCache,
    operationalInFlight,
    DETAIL_TTL_MS,
    async () => {
      const payload = await requestGoogleJson<GooglePlaceDetailResponse>(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          method: 'GET',
        },
        'id,websiteUri,nationalPhoneNumber,regularOpeningHours.weekdayDescriptions,regularOpeningHours.openNow,currentOpeningHours.openNow,currentOpeningHours.weekdayDescriptions'
      );

      if (!payload?.id) {
        return null;
      }

      return {
        phone: normalizeDetailString(payload.nationalPhoneNumber) ?? null,
        website: normalizeDetailString(payload.websiteUri) ?? null,
        hours: normalizeHours(
          payload.regularOpeningHours?.weekdayDescriptions ??
            payload.currentOpeningHours?.weekdayDescriptions
        ),
        openNow:
          typeof payload.currentOpeningHours?.openNow === 'boolean'
            ? payload.currentOpeningHours.openNow
            : typeof payload.regularOpeningHours?.openNow === 'boolean'
              ? payload.regularOpeningHours.openNow
              : null,
      };
    }
  );
}

export async function getStorefrontOperationalEnrichment(summary: StorefrontSummary) {
  if (!hasStorefrontOperationalConfig()) {
    return null;
  }

  const placeId = await matchPlaceId(summary);
  if (!placeId) {
    return null;
  }

  return loadPlaceDetail(placeId);
}

export function hasStorefrontOperationalConfig() {
  return Boolean(GOOGLE_MAPS_API_KEY) && googlePlacesConfigEnabled;
}

export function needsStorefrontOperationalEnrichment(detail: StorefrontDetails | null) {
  if (!hasStorefrontOperationalConfig()) {
    return false;
  }

  if (!detail) {
    return true;
  }

  return (
    !normalizeDetailString(detail.website) ||
    !normalizeDetailString(detail.phone) ||
    !hasPublishedStorefrontHours(detail.hours) ||
    typeof detail.openNow !== 'boolean'
  );
}

export async function applyStorefrontOperationalEnrichment(
  detail: StorefrontDetails,
  summary: StorefrontSummary
) {
  if (!hasStorefrontOperationalConfig()) {
    return detail;
  }

  const enrichment = await getStorefrontOperationalEnrichment(summary);
  if (!enrichment) {
    return detail;
  }

  return {
    ...detail,
    phone: normalizeDetailString(detail.phone) ?? enrichment.phone,
    website: normalizeDetailString(detail.website) ?? enrichment.website,
    hours: hasPublishedStorefrontHours(detail.hours)
      ? normalizeStorefrontHours(detail.hours)
      : enrichment.hours.length
        ? enrichment.hours
        : [],
    openNow: typeof enrichment.openNow === 'boolean' ? enrichment.openNow : detail.openNow,
  };
}
